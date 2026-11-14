#!/usr/bin/env python3
"""Offline, dependency-free arXiv HTML candidate extractor for FRONTIER.

Reads an already-acquired source document; this parser has NO network access.
Use with Python >=3.10. Source images are only candidates until the separate
rights+asset verification stage approves their display and content hash.

Usage:
  python3 scripts/frontier/extract_arxiv_html.py --paper-id 2611.17323v1 --input fixtures.html
  cat cached.html | python3 scripts/frontier/extract_arxiv_html.py --paper-id 2611.17323v1
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, unquote

PAPER_ID_RE = re.compile(r"^\d{4}\.\d{4,5}v[1-9]\d*$")
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9:_.-]{1,120}$")
ASSET_EXT_RE = re.compile(r"\.(?:png|jpe?g|webp)$", re.IGNORECASE)
MAX_INPUT_BYTES = 1_400_000
MAX_SECTIONS = 40
MAX_FIGURES = 12
MAX_CAPTION = 1_200
MAX_ALT = 360
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img",
    "input", "link", "meta", "param", "source", "track", "wbr",
}
IGNORED_CONTENT = {"script", "style", "template"}
HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}


def clean_text(parts: list[str], limit: int) -> str:
    text = " ".join(" ".join(parts).split())
    # Normalize non-printable controls, but do not alter scientific symbols.
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or ord(ch) >= 32)
    return text[:limit].strip()


def safe_image_url(raw: str | None, paper_id: str) -> str | None:
    if not raw or len(raw) > 700:
        return None
    base = f"https://arxiv.org/html/{paper_id}/"
    try:
        resolved = urlsplit(urljoin(base, raw.strip()))
        decoded = unquote(resolved.path)
        port = resolved.port
    except (ValueError, UnicodeError):
        return None
    if (
        resolved.scheme != "https"
        or resolved.hostname != "arxiv.org"
        or resolved.username
        or resolved.password
        or port
        or resolved.query
        or resolved.fragment
        or not decoded.startswith(f"/html/{paper_id}/")
        or ".." in decoded.split("/")
        or "%" in decoded  # reject double-encoded path escapes
        or "\\" in decoded
        or not ASSET_EXT_RE.search(decoded)
    ):
        return None
    return resolved.geturl()


def safe_anchor(value: str | None) -> str | None:
    if not value or not SAFE_ID_RE.fullmatch(value):
        return None
    return value


class ArxivSourceHTML(HTMLParser):
    """Small structural parser, not regular-expression scraping of HTML.

    Keeps only source-owned <section>, source figure, caption and image
    associations. It deliberately does not extract numerical conclusions,
    infer study results, or declare copyright/licensing permissions.
    """

    def __init__(self, paper_id: str) -> None:
        super().__init__(convert_charrefs=True)
        self.paper_id = paper_id
        self.base_url = f"https://arxiv.org/html/{paper_id}"
        self.depth = 0
        self.ignored_depth = 0
        self.section_stack: list[dict] = []
        self.active_heading: dict | None = None
        self.active_figure: dict | None = None
        self.caption_depth: int | None = None
        self.figures: list[dict] = []
        self.sections: list[dict] = []
        self.image_rejections = 0
        self.figure_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        is_void = tag in VOID_TAGS
        if not is_void:
            self.depth += 1
        if tag in IGNORED_CONTENT:
            self.ignored_depth += 1
        if self.ignored_depth:
            return

        if tag == "section":
            sid = safe_anchor(attrs_dict.get("id"))
            self.section_stack.append({
                "depth": self.depth, "id": sid, "heading": "", "recorded": False,
            })

        if tag in HEADING_TAGS and self.section_stack and self.active_heading is None:
            current = self.section_stack[-1]
            if current["id"] and not current["recorded"]:
                self.active_heading = {
                    "depth": self.depth, "section": current, "parts": [],
                }

        if tag == "figure" and self.active_figure is None:
            classes = set((attrs_dict.get("class") or "").split())
            if "ltx_figure" in classes and "ltx_table" not in classes:
                self.figure_count += 1
                section = self.section_stack[-1] if self.section_stack else None
                self.active_figure = {
                    "depth": self.depth,
                    "id": safe_anchor(attrs_dict.get("id")),
                    "sectionId": section["id"] if section else None,
                    "imageSrc": None, "alt": None, "caption": [],
                }

        if self.active_figure:
            if tag == "img" and self.active_figure["imageSrc"] is None:
                # Do not accept data URLs, responsive images where the selected
                # source is ambiguous, or untrusted hosts.
                src = safe_image_url(attrs_dict.get("src"), self.paper_id)
                if src:
                    self.active_figure["imageSrc"] = src
                    self.active_figure["alt"] = clean_text(
                        [attrs_dict.get("alt") or ""], MAX_ALT
                    )
                else:
                    self.image_rejections += 1
            elif tag == "figcaption" and self.caption_depth is None:
                self.caption_depth = self.depth

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        if self.ignored_depth:
            return
        if self.active_heading is not None:
            self.active_heading["parts"].append(data)
        if self.caption_depth is not None and self.active_figure is not None:
            self.active_figure["caption"].append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in IGNORED_CONTENT and self.ignored_depth:
            self.ignored_depth -= 1
        if self.ignored_depth:
            if tag not in VOID_TAGS:
                self.depth = max(0, self.depth - 1)
            return

        if tag in HEADING_TAGS and self.active_heading and self.depth == self.active_heading["depth"]:
            heading = self.active_heading
            section = heading["section"]
            title = clean_text(heading["parts"], 200)
            if title and len(self.sections) < MAX_SECTIONS:
                self.sections.append({
                    "id": section["id"],
                    "title": title,
                    "sourceUrl": self.base_url + "#" + quote(section["id"], safe=""),
                })
                section["heading"] = title
                section["recorded"] = True
            self.active_heading = None

        if tag == "figcaption" and self.caption_depth == self.depth:
            self.caption_depth = None

        if tag == "figure" and self.active_figure and self.depth == self.active_figure["depth"]:
            figure = self.active_figure
            self.active_figure = None
            self.caption_depth = None
            caption = clean_text(figure["caption"], MAX_CAPTION)
            image_url = figure["imageSrc"]
            if image_url and len(caption) >= 20 and len(self.figures) < MAX_FIGURES:
                figure_id = figure["id"]
                anchor_url = self.base_url + ("#" + quote(figure_id, safe="") if figure_id else "")
                self.figures.append({
                    "id": figure_id,
                    "sourceUrl": anchor_url,
                    "sectionId": figure["sectionId"],
                    "imageUrl": image_url,
                    "caption": caption,
                    "alt": figure["alt"] or caption[:MAX_ALT],
                })

        if tag == "section" and self.section_stack and self.depth == self.section_stack[-1]["depth"]:
            self.section_stack.pop()

        if tag not in VOID_TAGS:
            self.depth = max(0, self.depth - 1)

    def result(self) -> dict:
        return {
            "schemaVersion": 1,
            "adapter": "arxiv-html-candidates",
            "paperId": self.paper_id,
            "htmlUrl": self.base_url,
            "rightsStatus": "unverified",
            "sections": self.sections,
            "figures": self.figures,
            "diagnostics": {
                "figureElementsSeen": self.figure_count,
                "candidatesWithImageAndCaption": len(self.figures),
                "rejectedImageReferences": self.image_rejections,
                "sectionHeadings": len(self.sections),
            },
        }


def parse_document(content: bytes, paper_id: str) -> dict:
    if not PAPER_ID_RE.fullmatch(paper_id):
        raise ValueError("Invalid canonical arXiv versioned paper ID")
    if len(content) > MAX_INPUT_BYTES:
        raise ValueError("HTML document exceeds bounded extraction limit")
    if b"\x00" in content:
        raise ValueError("Unexpected binary data in HTML input")
    html = content.decode("utf-8", errors="strict")
    parser = ArxivSourceHTML(paper_id)
    parser.feed(html)
    parser.close()
    return parser.result()


def main() -> int:
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--paper-id", required=True, help="Canonical arXiv ID including version when known")
    args.add_argument("--input", type=Path, help="Trusted previously-downloaded HTML file; otherwise read stdin")
    options = args.parse_args()
    try:
        if options.input:
            with options.input.open("rb") as file:
                content = file.read(MAX_INPUT_BYTES + 1)
        else:
            content = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        output = parse_document(content, options.paper_id)
    except (OSError, ValueError, UnicodeDecodeError) as exc:
        print(f"arXiv HTML extraction refused: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
