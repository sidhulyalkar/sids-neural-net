#!/usr/bin/env python3
"""Prepare high-quality motion assets for the Visual Cortex.

This script is intentionally outside the Next.js build. It probes a source clip,
creates browser-compatible H.264 derivatives, extracts a high-quality poster,
and writes a JSON manifest fragment ready for src/data/visualMotion.ts.

Example:
    python scripts/prepare-visual-motion.py \
      --input ~/DJI/DCIM/DJI_0012.MP4 \
      --slug coastal-ride \
      --output public/visual-motion/coastal-ride
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

VARIANTS = (
    (2160, "4K", "24M"),
    (1440, "1440p", "14M"),
    (1080, "1080p", "8M"),
)


def require_binary(name: str) -> str:
    binary = shutil.which(name)
    if not binary:
        raise SystemExit(f"Missing required binary: {name}. Install ffmpeg/ffprobe first.")
    return binary


def run(command: list[str]) -> None:
    print("+", " ".join(command))
    subprocess.run(command, check=True)


def probe(ffprobe: str, source: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate:format=duration",
            "-of",
            "json",
            str(source),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    stream = payload["streams"][0]
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "frame_rate": stream.get("r_frame_rate"),
        "duration": float(payload["format"]["duration"]),
    }


def encode_variant(ffmpeg: str, source: Path, target: Path, height: int, bitrate: str) -> None:
    run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-i",
            str(source),
            "-map_metadata",
            "-1",
            "-vf",
            f"scale=-2:min({height},ih):flags=lanczos",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-profile:v",
            "high",
            "-level:v",
            "5.2",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            "-maxrate",
            bitrate,
            "-bufsize",
            bitrate,
            "-movflags",
            "+faststart",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(target),
        ]
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--title", default=None)
    parser.add_argument("--location", default=None)
    parser.add_argument("--captured-with", default=None)
    parser.add_argument("--activity", choices=["snorkeling", "ski", "dirt-bike"])
    parser.add_argument("--animal", choices=["turtle", "shark", "manta", "ray", "reef-fish"])
    parser.add_argument("--reef", choices=["lagoon", "kelp"])
    parser.add_argument("--public-url-base", help="URL directory that hosts the media; inferred only for output inside public/.")
    parser.add_argument("--poster-time", type=float, default=None, help="Poster timestamp in seconds. Defaults to 12%% of clip duration.")
    args = parser.parse_args()

    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.slug):
        parser.error("--slug must use lowercase letters/numbers separated by hyphens")
    if args.activity == "snorkeling" and (not args.animal or not args.reef):
        parser.error("Snorkeling encounters need both --animal and --reef")
    if args.activity != "snorkeling" and (args.animal or args.reef):
        parser.error("--animal and --reef are only valid with --activity snorkeling")
    source = args.input.expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Input does not exist: {source}")

    ffmpeg = require_binary("ffmpeg")
    ffprobe = require_binary("ffprobe")
    info = probe(ffprobe, source)
    output = args.output.resolve()
    public = (Path(__file__).resolve().parents[1] / "public").resolve()
    if args.public_url_base:
        url_base = args.public_url_base.rstrip("/")
        if not (url_base.startswith("/") or url_base.startswith("https://")):
            parser.error("--public-url-base must be a root-relative or HTTPS path")
    elif output.is_relative_to(public):
        url_base = "/" + output.relative_to(public).as_posix()
    else:
        parser.error("Output is outside public/; specify --public-url-base to host the resulting media")
    output.mkdir(parents=True, exist_ok=True)

    poster_time = args.poster_time if args.poster_time is not None else min(max(info["duration"] * 0.12, 0.25), max(info["duration"] - 0.1, 0.25))
    poster = output / f"{args.slug}-poster.jpg"
    run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-ss",
            f"{poster_time:.3f}",
            "-i",
            str(source),
            "-frames:v",
            "1",
            "-vf",
            "scale='min(2560,iw)':-2:flags=lanczos",
            "-q:v",
            "2",
            str(poster),
        ]
    )

    sources = []
    for height, label, bitrate in VARIANTS:
        if height > info["height"]:
            continue
        target = output / f"{args.slug}-{height}p.mp4"
        encode_variant(ffmpeg, source, target, height, bitrate)
        sources.append(
            {
                "src": f"{url_base}/{target.name}",
                "type": "video/mp4",
                "label": label,
                "height": height,
            }
        )

    if not sources:
        height = info["height"]
        target = output / f"{args.slug}-{height}p.mp4"
        encode_variant(ffmpeg, source, target, height, "8M")
        sources.append({"src": f"{url_base}/{target.name}", "type": "video/mp4", "label": f"{height}p", "height": height})

    fragment = {
        "id": args.slug,
        "title": args.title or args.slug.replace("-", " ").title(),
        "posterSrc": f"{url_base}/{poster.name}",
        "durationSeconds": round(info["duration"], 3),
        "aspectRatio": f'{info["width"]} / {info["height"]}',
        **({"capturedWith": args.captured_with} if args.captured_with else {}),
        **({"location": args.location} if args.location else {}),
        **({"encounter": (
            {"activity": "snorkeling", "animal": args.animal, "reef": args.reef}
            if args.activity == "snorkeling" else {"activity": args.activity}
        )} if args.activity else {}),
        "sources": sources,
        "sourceProbe": info,
    }
    manifest_path = output / "manifest-fragment.json"
    manifest_path.write_text(json.dumps(fragment, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(sources)} playback variants and poster: {output}")
    print(f"Manifest fragment: {manifest_path}")


if __name__ == "__main__":
    main()
