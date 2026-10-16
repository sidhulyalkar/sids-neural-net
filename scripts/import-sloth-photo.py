#!/usr/bin/env python3
"""Ingest the user's own rainforest sloth photo into the Visual Archive.

Usage: python scripts/import-sloth-photo.py /path/to/photo.png
Requires Pillow. Writes actual optimized media and one manifest entry;
never invents a photo if the source binary is absent.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/"public/visual-archive/web/photo-050.webp"
THUMB=ROOT/"public/visual-archive/thumbs/photo-050-thumb.webp"
ARCHIVE=ROOT/"src/data/visualArchive.ts"
MARKER="export const visualArchive: VisualArchiveEntry[] = ["

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("source",type=Path)
    args=parser.parse_args()
    if not args.source.is_file():
        parser.error("An actual source photograph is required")
    source_hash=hashlib.sha256(args.source.read_bytes()).hexdigest()
    im=ImageOps.exif_transpose(Image.open(args.source)).convert("RGB")
    orig_w,orig_h=im.size
    outputs=[]
    for output,maxwidth,quality in [(WEB,1400,82),(THUMB,360,72)]:
        output.parent.mkdir(parents=True,exist_ok=True)
        resized=im.copy()
        resized.thumbnail((maxwidth,2000),Image.Resampling.LANCZOS)
        # Re-encode from pixels: strips original camera EXIF and GPS.
        resized.save(output,"WEBP",quality=quality,method=6,exif=b"")
        outputs.append((output,resized.size))
    width,height=outputs[0][1]
    text=ARCHIVE.read_text(encoding="utf-8")
    if text.count(MARKER)!=1:
        raise RuntimeError("Visual Archive insertion anchor changed")
    if "id: 'photo-050'" not in text:
        entry=(
            "  {\n"
            "    id: 'photo-050',\n"
            "    src: '/visual-archive/web/photo-050.webp',\n"
            "    thumbSrc: '/visual-archive/thumbs/photo-050-thumb.webp',\n"
            "    alt: 'A shaggy gray-beige sloth with a pale face and dark eye mask, clinging to a lichen-covered rainforest tree and extending one arm up its trunk.',\n"
            "    title: 'Sloth in the rainforest',\n"
            "    tags: ['rainforest', 'sloth', 'wildlife'],\n"
            f"    aspectRatio: '{width} / {height}',\n"
            f"    width: {width},\n"
            f"    height: {height},\n"
            "  },\n"
        )
        text=text.replace(MARKER,MARKER+"\n"+entry)
        ARCHIVE.write_text(text,encoding="utf-8")
    else:
        assert WEB.is_file() and THUMB.is_file()
    print("Source SHA256:",source_hash)
    print("Original dimensions:",orig_w,orig_h)
    for output,size in outputs: print(str(output.relative_to(ROOT)),size)
    print("Archive photo-050 present. Commit both webp files and manifest together.")

if __name__=="__main__":main()
