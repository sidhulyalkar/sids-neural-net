#!/usr/bin/env python3
"""Controlled, single-paper publisher HTML acquisition and source-candidate audit.

Network is opt-in and pinned to the exact versioned AgentSSL arXiv HTML URL.
The output is a private review artifact. It NEVER certifies individual figure
rights or modifies a public website.

Examples:
  python3 scripts/frontier/probe_agentssl_publisher.py --fetch --out /tmp/frontier-pilot
  python3 scripts/frontier/probe_agentssl_publisher.py --input /tmp/source.html --out /tmp/frontier-pilot
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from extract_arxiv_html import MAX_INPUT_BYTES, parse_document

PAPER_ID = "2611.17323v1"
SOURCE_URL = f"https://arxiv.org/html/{PAPER_ID}"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
MAX_REPORT_SECTIONS = 40
USER_AGENT = "FRONTIER EvidencePilot/0.1 (bounded single-paper review)"
# Purposefully no automatic redirect following, even to another arXiv endpoint.
class RefuseRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError(f"Publisher redirect not approved ({code})")


def checked_html(payload: bytes) -> bytes:
    if len(payload) > MAX_INPUT_BYTES:
        raise ValueError(f"Publisher HTML exceeds {MAX_INPUT_BYTES} byte extraction budget")
    if not payload or b"\x00" in payload:
        raise ValueError("Publisher response is empty or binary")
    payload.decode("utf-8", errors="strict")
    return payload


def fetch_exact_source() -> bytes:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html"},
        method="GET",
    )
    opener = urllib.request.build_opener(RefuseRedirect())
    with opener.open(request, timeout=20) as response:
        if response.geturl() != SOURCE_URL or response.status != 200:
            raise ValueError("Publisher identity or status changed during fetch")
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type not in ("text/html", "application/xhtml+xml"):
            raise ValueError("Expected original publisher HTML content type")
        declared_size = response.headers.get("Content-Length")
        if declared_size and int(declared_size) > MAX_INPUT_BYTES:
            raise ValueError(f"Publisher Content-Length {declared_size} exceeds {MAX_INPUT_BYTES} byte extraction budget")
        # Read a single bounded response. No images or secondary URLs fetched.
        return checked_html(response.read(MAX_INPUT_BYTES + 1))


class LicenseLinkProbe(HTMLParser):
    """Find observed on-page license links, not inferred asset-level permissions."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.license_link_observed = False
        self.license_links = []

    def handle_starttag(self, tag, attrs):
        if tag not in ("a", "link"):
            return
        attributes = dict(attrs)
        raw = (attributes.get("href") or "").strip()
        # Require the exact authority and license path, including optional
        # trailing slash. Avoid lookalike hosts or query-string spoofing.
        if re.fullmatch(r"https://creativecommons\.org/licenses/by/4\.0/?", raw):
            self.license_link_observed = True
            self.license_links.append(raw)


def source_license_audit(html: str) -> dict:
    parser = LicenseLinkProbe()
    parser.feed(html)
    parser.close()
    return {
        "paperPageLicenseLinkObserved": parser.license_link_observed,
        "paperPageLicense": "CC BY 4.0" if parser.license_link_observed else "unverified",
        "licenseReference": LICENSE_URL if parser.license_link_observed else None,
        "figureRights": "requires-separate-asset-review",
        "figureDisplayApproved": False,
    }


def create_review(payload: bytes, acquired_at: str, acquisition: str) -> tuple[dict, dict]:
    html = checked_html(payload).decode("utf-8", "strict")
    candidates = parse_document(payload, PAPER_ID)
    license_audit = source_license_audit(html)
    source_report = {
        "reportVersion": 1,
        "status": "source-candidates-only",
        "source": SOURCE_URL,
        "paperId": PAPER_ID,
        "sourceRevision": "v1",
        "acquisition": acquisition,
        "retrievedAt": acquired_at,
        "sourceHtmlSha256": hashlib.sha256(payload).hexdigest(),
        "sourceHtmlBytes": len(payload),
        "diagnostics": candidates["diagnostics"],
        "sourceHeadings": [
            {"id": section["id"], "title": section["title"], "sourceUrl": section["sourceUrl"]}
            for section in candidates["sections"][:MAX_REPORT_SECTIONS]
        ],
        "candidateFigureCount": len(candidates["figures"]),
        "license": license_audit,
        "deploymentApproved": False,
        "reviewRequirements": [
            "Verify original figure bytes and format, not URL extension alone",
            "Verify source figure ID and full publisher caption against cached HTML",
            "Review reuse license and exceptions for each figure, recording attribution",
            "Pass explicit rights approvals into the existing offline story builder",
            "Inspect the approved manifest, asset hashes and route screenshots",
        ],
    }
    return candidates, source_report


def write_report(directory: Path, candidates: dict, report: dict, source_html: bytes | None = None) -> None:
    directory.mkdir(parents=True, exist_ok=False)
    (directory / "candidates.json").write_text(
        json.dumps(candidates, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (directory / "report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    # Temporary build input only. The workflow uploads the JSON audit and
    # source-only manifests, never the downloaded publisher HTML bytes.
    if source_html is not None:
        (directory / "source.html").write_bytes(checked_html(source_html))


def main() -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    source = cli.add_mutually_exclusive_group(required=True)
    source.add_argument("--fetch", action="store_true", help="Single HTTPS GET of the pinned publisher HTML")
    source.add_argument("--input", type=Path, help="Previously acquired local HTML file")
    cli.add_argument("--out", type=Path, required=True, help="New private artifact directory")
    args = cli.parse_args()
    acquired_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    try:
        if args.fetch:
            payload = fetch_exact_source()
            acquisition = "pinned-arxiv-https"
        else:
            if not args.input.is_file() or args.input.is_symlink():
                raise ValueError("Input must be a regular, non-symlink HTML file")
            if args.input.stat().st_size > MAX_INPUT_BYTES:
                raise ValueError("Input exceeds extraction byte budget")
            payload = args.input.read_bytes()
            acquisition = "offline-reviewed-file"
        candidates, report = create_review(payload, acquired_at, acquisition)
        write_report(args.out, candidates, report, payload)
        print(json.dumps({
            "status": report["status"],
            "sha256": report["sourceHtmlSha256"],
            "bytes": report["sourceHtmlBytes"],
            "sections": report["diagnostics"]["sectionHeadings"],
            "figureElements": report["diagnostics"]["figureElementsSeen"],
            "candidateFigures": report["candidateFigureCount"],
            "paperLicenseObserved": report["license"]["paperPageLicenseLinkObserved"],
            "approvedDisplayFigures": 0,
        }))
        return 0
    except (ValueError, OSError, UnicodeError, urllib.error.URLError) as error:
        print(f"Source pilot refused: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
