#!/usr/bin/env python3
"""Update the local Visual Cortex from newly downloaded photos.

Workflow:
1. Export/download selected Google Photos into photo-input/.
2. Run this script.
3. Add the emitted entries to src/data/visualArchive.ts and improve alt text.

The script is incremental. It stores a manifest in public/visual-archive/manifest.json,
skips images it has already seen, and gives only new images the next photo-### id.

Install HEIC support when needed:
  python3 -m pip install pillow-heif
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass


SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


@dataclass(frozen=True)
class PreparedImage:
    source: Path
    source_hash: str
    id: str
    web_path: Path
    thumb_path: Path
    width: int
    height: int
    is_new: bool


def natural_key(path: Path) -> list[int | str]:
    parts = re.split(r"(\d+)", path.stem.lower())
    return [int(part) if part.isdigit() else part for part in parts]


def fit_dimensions(width: int, height: int, max_width: int) -> tuple[int, int]:
    if width <= max_width:
        return width, height
    next_height = round(height * (max_width / width))
    return max_width, next_height


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def open_image(path: Path) -> Image.Image:
    image = Image.open(path)
    image = ImageOps.exif_transpose(image)
    if image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGB")
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, "#020306")
        background.paste(image, mask=image.getchannel("A"))
        image = background
    return image


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "images": []}
    return json.loads(path.read_text())


def write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def existing_ids(web_dir: Path, manifest: dict[str, Any]) -> set[int]:
    ids: set[int] = set()
    for item in manifest.get("images", []):
        match = re.fullmatch(r"photo-(\d+)", item.get("id", ""))
        if match:
            ids.add(int(match.group(1)))
    for path in web_dir.glob("photo-*.webp"):
        match = re.fullmatch(r"photo-(\d+)", path.stem)
        if match:
            ids.add(int(match.group(1)))
    return ids


def next_image_id(used: set[int]) -> str:
    index = 1
    while index in used:
        index += 1
    used.add(index)
    return f"photo-{index:03d}"


def prepare_image(
    source: Path,
    source_hash: str,
    image_id: str,
    web_dir: Path,
    thumb_dir: Path,
    web_width: int,
    thumb_width: int,
    quality: int,
    force: bool,
) -> PreparedImage:
    web_path = web_dir / f"{image_id}.webp"
    thumb_path = thumb_dir / f"{image_id}-thumb.webp"

    if web_path.exists() and thumb_path.exists() and not force:
        with Image.open(web_path) as image:
            return PreparedImage(source, source_hash, image_id, web_path, thumb_path, image.width, image.height, False)

    with open_image(source) as image:
        web_size = fit_dimensions(*image.size, max_width=web_width)
        thumb_size = fit_dimensions(*image.size, max_width=thumb_width)
        web = image.resize(web_size, Image.Resampling.LANCZOS)
        thumb = image.resize(thumb_size, Image.Resampling.LANCZOS)
        web.save(web_path, "WEBP", quality=quality, method=6)
        thumb.save(thumb_path, "WEBP", quality=max(58, quality - 10), method=6)

    return PreparedImage(source, source_hash, image_id, web_path, thumb_path, web_size[0], web_size[1], True)


def source_files(source_dir: Path) -> list[Path]:
    return sorted(
        [path for path in source_dir.iterdir() if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES],
        key=natural_key,
    )


def build_manifest_index(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        item["sourceHash"]: item
        for item in manifest.get("images", [])
        if isinstance(item, dict) and item.get("sourceHash") and item.get("id")
    }


def image_dimensions(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.width, image.height


def bootstrap_manifest(
    manifest: dict[str, Any],
    sources: list[Path],
    web_dir: Path,
    thumb_dir: Path,
) -> dict[str, Any]:
    if manifest.get("images"):
        return manifest

    existing_web = sorted(web_dir.glob("photo-*.webp"), key=natural_key)
    if len(existing_web) != len(sources):
        return manifest

    images: list[dict[str, Any]] = []
    for source, web_path in zip(sources, existing_web):
        image_id = web_path.stem
        thumb_path = thumb_dir / f"{image_id}-thumb.webp"
        if not thumb_path.exists():
            return manifest
        width, height = image_dimensions(web_path)
        images.append(
            {
                "id": image_id,
                "sourceName": source.name,
                "sourceHash": file_hash(source),
                "src": f"/visual-archive/web/{image_id}.webp",
                "thumbSrc": f"/visual-archive/thumbs/{image_id}-thumb.webp",
                "width": width,
                "height": height,
            }
        )

    return {"version": 1, "images": images}


def snippet_for(item: PreparedImage) -> str:
    src = f"/visual-archive/web/{item.id}.webp"
    thumb = f"/visual-archive/thumbs/{item.id}-thumb.webp"
    return f"""  {{
    id: '{item.id}',
    src: '{src}',
    thumbSrc: '{thumb}',
    alt: 'Selected personal photograph in the visual cortex.',
    tags: [],
    aspectRatio: '{item.width} / {item.height}',
    width: {item.width},
    height: {item.height},
  }},"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Incrementally optimize new Visual Cortex photos.")
    parser.add_argument("--input", default="photo-input", help="Source photo folder. Defaults to photo-input.")
    parser.add_argument("--fallback-input", default="visual_archive", help="Fallback source folder if --input does not exist.")
    parser.add_argument("--output", default="public/visual-archive", help="Output root folder.")
    parser.add_argument("--web-width", type=int, default=1800)
    parser.add_argument("--thumb-width", type=int, default=600)
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("--force", action="store_true", help="Rebuild existing optimized assets.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be added without writing files.")
    args = parser.parse_args()

    source_dir = Path(args.input)
    if not source_dir.exists():
        source_dir = Path(args.fallback_input)
    if not source_dir.exists():
        raise SystemExit(f"No source folder found: {args.input} or {args.fallback_input}")

    output_root = Path(args.output)
    web_dir = output_root / "web"
    thumb_dir = output_root / "thumbs"
    manifest_path = output_root / "manifest.json"
    web_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    sources = source_files(source_dir)
    if not sources:
        raise SystemExit(f"No supported images found in {source_dir}")
    manifest = bootstrap_manifest(load_manifest(manifest_path), sources, web_dir, thumb_dir)
    by_hash = build_manifest_index(manifest)
    used_ids = existing_ids(web_dir, manifest)

    prepared: list[PreparedImage] = []
    skipped = 0

    bootstrapped = bool(manifest.get("images")) and not manifest_path.exists()
    if bootstrapped and not args.dry_run:
        write_manifest(manifest_path, manifest)
        print(f"Bootstrapped manifest with {len(manifest['images'])} existing image(s).")

    for source in sources:
        digest = file_hash(source)
        existing = by_hash.get(digest)
        if existing and not args.force:
            skipped += 1
            continue

        image_id = existing["id"] if existing else next_image_id(used_ids)
        if args.dry_run:
            print(f"ADD {image_id}: {source.name}")
            continue

        try:
            item = prepare_image(source, digest, image_id, web_dir, thumb_dir, args.web_width, args.thumb_width, args.quality, args.force)
            prepared.append(item)
            print(f"{'updated' if existing else 'added'} {item.id}: {source.name} ({item.width}x{item.height})")

            manifest_item = {
                "id": item.id,
                "sourceName": source.name,
                "sourceHash": digest,
                "src": f"/visual-archive/web/{item.id}.webp",
                "thumbSrc": f"/visual-archive/thumbs/{item.id}-thumb.webp",
                "width": item.width,
                "height": item.height,
            }
            if existing:
                manifest["images"] = [
                    manifest_item if image.get("id") == item.id else image
                    for image in manifest.get("images", [])
                ]
            else:
                manifest.setdefault("images", []).append(manifest_item)
        except Exception as exc:
            print(f"SKIP {source.name}: {exc}")

    if not args.dry_run:
        manifest["images"] = sorted(manifest.get("images", []), key=lambda item: item["id"])
        write_manifest(manifest_path, manifest)

    new_items = [item for item in prepared if item.is_new]
    print(f"Skipped {skipped} already processed image(s).")
    print(f"Prepared {len(prepared)} image(s).")

    if new_items:
        print("\nAdd these entries to src/data/visualArchive.ts, then replace the alt text:")
        print("\n".join(snippet_for(item) for item in new_items))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
