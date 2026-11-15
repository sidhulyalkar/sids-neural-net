"""Offline regression suite for the real-paper acquisition audit.

Uses source-shaped synthetic HTML, never publisher bytes or live HTTP.
"""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "frontier"))
import probe_agentssl_publisher as pilot
from extract_arxiv_html import MAX_INPUT_BYTES


class PublisherProbeTests(unittest.TestCase):
    def setUp(self):
        self.fixture = Path("tests/fixtures/frontier/arxiv-synthetic-structure.html").read_bytes()

    def test_fixture_source_candidates_are_real_structural_html_not_verified_assets(self):
        candidates, report = pilot.create_review(self.fixture, "2026-11-14T23:00:00.000Z", "offline")
        self.assertEqual(candidates["paperId"], "2611.17323v1")
        self.assertEqual(candidates["diagnostics"]["sectionHeadings"], 2)
        self.assertEqual(report["candidateFigureCount"], 2)
        self.assertEqual(report["sourceHtmlSha256"], hashlib.sha256(self.fixture).hexdigest())
        self.assertEqual(report["status"], "source-candidates-only")
        self.assertEqual(report["license"]["figureRights"], "requires-separate-asset-review")
        self.assertFalse(report["license"]["figureDisplayApproved"])
        self.assertFalse(report["deploymentApproved"])
        self.assertEqual(report["sourceHeadings"][0]["sourceUrl"],
                         "https://arxiv.org/html/2611.17323v1#S1")

    def test_exact_cc_by_link_is_observation_not_license_for_any_individual_figure(self):
        reference = (
            '<a href="https://creativecommons.org/licenses/by/4.0/">CC BY</a>'
        )
        good = pilot.source_license_audit(reference)
        self.assertTrue(good["paperPageLicenseLinkObserved"])
        self.assertEqual(good["paperPageLicense"], "CC BY 4.0")
        self.assertFalse(good["figureDisplayApproved"])
        for fake in [
            'https://creativecommons.org.evil.example/licenses/by/4.0/',
            'https://creativecommons.org/licenses/by/4.0/?override=true',
            'http://creativecommons.org/licenses/by/4.0/',
            'https://creativecommons.org/licenses/by/4.1/',
            '/licenses/by/4.0/',
        ]:
            result = pilot.source_license_audit(f'<a href="{fake}">license</a>')
            self.assertFalse(result["paperPageLicenseLinkObserved"])

    def test_reject_oversize_binary_and_invalid_unicode(self):
        with self.assertRaisesRegex(ValueError, "exceeds"):
            pilot.create_review(b"a" * (MAX_INPUT_BYTES + 1), "2026-11-14T23:00:00.000Z", "offline")
        with self.assertRaisesRegex(ValueError, "binary"):
            pilot.checked_html(b"<html>\x00</html>")
        with self.assertRaises(UnicodeDecodeError):
            pilot.checked_html(b"\xff\xf7")

    def test_report_writes_to_new_directory_only_without_changing_copyright_claims(self):
        candidates, report = pilot.create_review(self.fixture, "2026-11-14T23:00:00.000Z", "offline")
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "review"
            pilot.write_report(out, candidates, report)
            self.assertEqual(sorted(x.name for x in out.iterdir()), ["candidates.json", "figure_review_queue.json", "report.json"])
            copy = json.loads((out / "report.json").read_text())
            self.assertEqual(copy["sourceHtmlSha256"], report["sourceHtmlSha256"])
            self.assertEqual(copy["license"]["paperPageLicense"], "unverified")
            queue = json.loads((out / "figure_review_queue.json").read_text())
            self.assertEqual(len(queue), 2)
            self.assertEqual(queue[0]["reviewState"], "pending")
            self.assertFalse(queue[0]["displayApproved"])
            self.assertFalse(queue[0]["assetBytesVerified"])
            self.assertEqual(queue[0]["figureRights"]["display"], "unknown")
            self.assertEqual(
                queue[0]["captionSha256"],
                hashlib.sha256(candidates["figures"][0]["caption"].encode("utf-8")).hexdigest()
            )
            with self.assertRaises(FileExistsError):
                pilot.write_report(out, candidates, report)

    def test_network_is_opt_in_pinned_and_does_not_follow_redirects(self):
        class FakeResponse:
            status = 200
            headers = {"Content-Type": "text/html; charset=utf-8", "Content-Length": "125"}

            def geturl(self):
                return pilot.SOURCE_URL

            def read(self, size):
                self_read = self_outer.fixture
                return self_read[:size]

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

        self_outer = self
        class FakeOpener:
            def open(self, request, timeout):
                self_outer.assertEqual(request.full_url, pilot.SOURCE_URL)
                self_outer.assertEqual(request.get_method(), "GET")
                self_outer.assertEqual(timeout, 20)
                self_outer.assertTrue(request.headers.get("User-agent"))
                return FakeResponse()

        with patch.object(pilot.urllib.request, "build_opener", return_value=FakeOpener()):
            self.assertEqual(pilot.fetch_exact_source(), self.fixture)
        with self.assertRaisesRegex(ValueError, "redirect not approved"):
            pilot.RefuseRedirect().redirect_request(
                None, None, 302, "redirect", {}, "https://other.example/evil"
            )

    def test_wrong_publisher_or_mime_cannot_produce_source_candidates(self):
        class BadResponse:
            status = 200
            headers = {"Content-Type": "application/pdf"}

            def geturl(self):
                return "https://arxiv.org/pdf/2611.17323v1"

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

        class BadOpener:
            def open(self, *_args, **_kwargs):
                return BadResponse()

        with patch.object(pilot.urllib.request, "build_opener", return_value=BadOpener()):
            with self.assertRaisesRegex(ValueError, "identity or status"):
                pilot.fetch_exact_source()


if __name__ == "__main__":
    unittest.main()
