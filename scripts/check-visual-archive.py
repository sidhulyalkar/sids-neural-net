#!/usr/bin/env python3
"""Static checks for Visual Cortex image data."""

from __future__ import annotations

import re
import json
from pathlib import Path

from PIL import Image


ENTRY_PATTERN = re.compile(r"\{\s*id:\s*'(?P<id>[^']+)'(?P<body>.*?)\n\s*\}", re.DOTALL)
FIELD_PATTERN = re.compile(r"(?P<field>src|thumbSrc|alt|aspectRatio):\s*'(?P<value>[^']*)'")


def parse_entries(data_file: Path) -> list[dict[str, str]]:
    content = data_file.read_text()
    entries: list[dict[str, str]] = []
    for match in ENTRY_PATTERN.finditer(content):
        entry = {"id": match.group("id")}
        entry.update({field.group("field"): field.group("value") for field in FIELD_PATTERN.finditer(match.group("body"))})
        entries.append(entry)
    return entries


def public_path(url: str) -> Path:
    return Path("public") / url.lstrip("/")


def check_manifest(entries: list[dict[str, str]], errors: list[str]) -> None:
    manifest_path = Path("public/visual-archive/manifest.json")
    if not manifest_path.exists():
        errors.append("missing public/visual-archive/manifest.json")
        return

    manifest = json.loads(manifest_path.read_text())
    manifest_entries = manifest.get("images", [])
    manifest_by_id = {item.get("id"): item for item in manifest_entries if isinstance(item, dict)}
    data_ids = {entry["id"] for entry in entries}

    for image_id in data_ids:
        if image_id not in manifest_by_id:
            errors.append(f"{image_id}: missing manifest entry")

    for image_id, item in manifest_by_id.items():
        if image_id not in data_ids:
            errors.append(f"{image_id}: manifest entry is not present in visualArchive.ts")
        for field in ("src", "thumbSrc", "sourceHash", "sourceName"):
            if not item.get(field):
                errors.append(f"{image_id}: manifest missing {field}")


def main() -> int:
    entries = parse_entries(Path("src/data/visualArchive.ts"))
    if not entries:
        raise SystemExit("No visual cortex entries found.")

    errors: list[str] = []
    seen_ids: set[str] = set()
    check_manifest(entries, errors)

    for entry in entries:
        image_id = entry["id"]
        if image_id in seen_ids:
            errors.append(f"{image_id}: duplicate id")
        seen_ids.add(image_id)

        for required in ("src", "thumbSrc", "alt", "aspectRatio"):
            if not entry.get(required):
                errors.append(f"{image_id}: missing {required}")

        if len(entry.get("alt", "").strip()) < 12:
            errors.append(f"{image_id}: alt text is too short")

        for field in ("src", "thumbSrc"):
            path = public_path(entry.get(field, ""))
            if not path.exists():
                errors.append(f"{image_id}: missing {field} file {path}")
                continue
            try:
                with Image.open(path) as image:
                    image.verify()
            except Exception as exc:
                errors.append(f"{image_id}: invalid {field} image {path}: {exc}")

    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)

    print(f"Visual Cortex check passed for {len(entries)} images.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
