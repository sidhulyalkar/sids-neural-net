# Codex Implementation Brief: Realistic MICrONS / Allen-Style Neuron Rendering

## Objective

Refactor the current personal website neural homepage so the visual language moves from **cartoon neural-network symbols** to **realistic neuronal morphology rendering** inspired by Allen Institute / MICrONS / NeuroMorpho-style reconstructions.

The current scene structure is directionally good: large portfolio navigation nodes, axon-like connections, dark background, click/hover navigation. The problem is the rendering style:

- Somas look like flat beige circles.
- Dendrites and axons are too smooth.
- Satellite dots make the scene feel decorative rather than biological.
- Branches look like radial rods, not reconstructed neurites.
- The scene feels symbolic rather than like a real microscopy/connectomics atlas.

The new target is: **real morphology-informed neurons, smooth performance, accurate SWC support, and readable portfolio navigation.**

---

## Visual Target

Use the following references as the north star:

- Allen/MICrONS-style dense neuronal reconstruction imagery.
- Neuroglancer/connectomics skeleton renderings.
- Real neuronal morphologies from SWC files.
- Dark background with multicolor biological tracings.
- Sharp, irregular branching neurites.
- Sparse, clear somas.
- Fine terminal arborization.
- Subtle scientific glow, not chunky neon.

The final page should feel like an **interactive connectomics atlas under glass**, not a diagram made of cartoon nodes.

---

## Non-Negotiable Design Constraints

The website is still a portfolio interface. Preserve:

- Existing navigation labels.
- Existing click targets.
- Existing routes.
- Existing page transitions unless they need minor adaptation.
- Readable labels.
- Clear main navigation nodes.

Current main nodes include, or may include:

- `Origin Signal`
- `Field Inputs`
- `Future Circuits`
- `Light Field`
- `Open Channel`
- `Literature Trace`
- `Build Log`

Each main node should become a **portfolio neuron**:

- One clear soma/core.
- A readable label chip.
- A realistic dendritic/axonal arbor.
- A clickable hit area larger than the soma.
- Hover/focus behavior.
- Optional SWC-backed morphology.

---

## Implementation Strategy

Build this in two layers:

### Layer 1: Procedural Realistic Morphologies

This is the immediate visual upgrade. It should work without external data.

Generate deterministic morphology skeletons per portfolio node using seeded randomness.

### Layer 2: Real SWC Morphology Support

Add a parser and renderer for actual `.swc` files. This enables true morphology-based rendering using real neuron reconstructions.

If an SWC file is available for a node, render it. If it fails to load, use the procedural fallback.

---

## Suggested File Structure

Add or adapt the project toward this structure:

```txt
public/
  morphologies/
    README.md
    example-neuron-01.swc
    example-neuron-02.swc
    example-neuron-03.swc
    example-neuron-04.swc
    example-neuron-05.swc

scripts/
  download-example-swc.js
  # or
  download_example_swc.py

src/
  data/
    portfolioNeurons.ts

  lib/
    morphology/
      parseSWC.ts
      generateProceduralNeuron.ts
      normalizeMorphology.ts
      buildSegments.ts
      seededRandom.ts
      morphologyTypes.ts

  components/
    neural/
      NeuralScene.tsx
      MorphologyNeuron.tsx
      AxonBundle.tsx
      OrganicSoma.tsx
      LabelChip.tsx
```

Adapt names to match the existing codebase.

---

## Core Data Types

Create reusable morphology types.

```ts
export type MorphologyPoint = {
  id: number;
  type?: number; // SWC type: 1 soma, 2 axon, 3 basal dendrite, 4 apical dendrite
  x: number;
  y: number;
  z: number;
  radius: number;
  parent: number; // -1 for root
};

export type MorphologySegment = {
  source: MorphologyPoint;
  target: MorphologyPoint;
  depth: number;
  branchId: string;
};

export type PortfolioNeuron = {
  id: string;
  label: string;
  route?: string;
  position: [number, number, number];
  scale?: number;
  color: string;
  source: "procedural" | "swc";
  swcUrl?: string;
  seed?: string;
};
```

---

## SWC Format Requirements

Implement `parseSWC(text: string): MorphologyPoint[]`.

SWC rows are whitespace-delimited:

```txt
n T x y z R P
```

Where:

- `n`: node id
- `T`: compartment type
- `x, y, z`: 3D coordinates
- `R`: radius
- `P`: parent id, usually `-1` for root

Parser behavior:

- Ignore empty lines.
- Ignore comment lines beginning with `#`.
- Parse whitespace-separated rows.
- Reject malformed rows gracefully.
- Preserve IDs and parent IDs.
- Clamp tiny or huge radii to safe render values later, not in the parser.
- Return clean `MorphologyPoint[]`.

Example implementation target:

```ts
export function parseSWC(text: string): MorphologyPoint[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 7) return null;

      const [id, type, x, y, z, radius, parent] = parts;
      const point = {
        id: Number(id),
        type: Number(type),
        x: Number(x),
        y: Number(y),
        z: Number(z),
        radius: Number(radius),
        parent: Number(parent),
      };

      const valid =
        Number.isFinite(point.id) &&
        Number.isFinite(point.type ?? 0) &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.z) &&
        Number.isFinite(point.radius) &&
        Number.isFinite(point.parent);

      return valid ? point : null;
    })
    .filter((p): p is MorphologyPoint => p !== null);
}
```

---

## Build Segments from SWC

Implement `morphologyToSegments(points: MorphologyPoint[]): MorphologySegment[]`.

Requirements:

- Map points by `id`.
- For every point with a valid parent, create a segment.
- Skip orphaned parent references safely.
- Track depth from root if feasible.
- Preserve compartment type for styling if useful.

```ts
export function morphologyToSegments(points: MorphologyPoint[]): MorphologySegment[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  const depthCache = new Map<number, number>();

  function depthOf(point: MorphologyPoint): number {
    if (depthCache.has(point.id)) return depthCache.get(point.id)!;
    if (point.parent < 0 || !byId.has(point.parent)) {
      depthCache.set(point.id, 0);
      return 0;
    }
    const d = depthOf(byId.get(point.parent)!) + 1;
    depthCache.set(point.id, d);
    return d;
  }

  return points
    .filter((p) => p.parent >= 0 && byId.has(p.parent))
    .map((target) => {
      const source = byId.get(target.parent)!;
      return {
        source,
        target,
        depth: depthOf(target),
        branchId: `${source.id}-${target.id}`,
      };
    });
}
```

---

## Normalize Morphology

Implement `normalizeMorphology(points, options)`.

Goals:

- Center morphology around origin.
- Scale it to fit a target radius or bounding box.
- Preserve aspect ratio.
- Optionally flatten or exaggerate `z` for 2.5D display.
- Clamp visual radius for readability.

Behavior:

```ts
type NormalizeOptions = {
  targetRadius?: number;
  center?: [number, number, number];
  zScale?: number;
  minVisualRadius?: number;
  maxVisualRadius?: number;
};
```

Important:

- The rendering should not distort neuron identity too aggressively.
- Real SWC morphologies can be very large and anisotropic.
- Normalize for display, but keep metadata/comments explaining that this is visual normalization.

---

## Procedural Morphology Generator

Implement:

```ts
generateProceduralNeuronMorphology(options): MorphologyPoint[]
```

The generator should create realistic neuron-like skeletons when no SWC file is present.

Requirements:

- Deterministic seed per portfolio node.
- One soma/root point.
- 5–10 primary neurites.
- 3–7 branch levels.
- Branch probability decreases with depth.
- Path direction should be irregular, noisy, and biological.
- Branches must taper with distance and depth.
- Include terminal twigs.
- Avoid perfect radial symmetry.
- Avoid decorative beads/dots.
- Use angular jitter and segment-level randomness.
- Include one or two longer axon-like projections on selected nodes.
- Do not create smooth circular spaghetti.

Pseudo-logic:

```ts
function growBranch(parent, direction, depth, radius, length) {
  const segmentCount = randomInt(4, 10);
  let current = parent;

  for each segment:
    direction = normalize(direction + noiseVector * jitter)
    next = current + direction * variableStepLength
    next.radius = radius * taper
    add next point with parent=current.id
    current = next

  if depth < maxDepth:
    maybe spawn 1–3 child branches
    each child direction = rotate current direction by irregular bifurcation angle
    child length = length * random(0.45, 0.85)
    child radius = radius * random(0.55, 0.78)
}
```

Recommended visual settings:

```ts
const defaultProceduralOptions = {
  primaryBranches: [5, 10],
  maxDepth: [4, 7],
  segmentLength: [8, 28],
  branchProbability: 0.72,
  branchProbabilityFalloff: 0.72,
  jitter: 0.45,
  taper: 0.82,
  terminalTwigChance: 0.35,
  longAxonChance: 0.4,
};
```

---

## Seeded Random Utility

Do not use `Math.random()` directly for morphology generation.

Create:

```ts
export function hashStringToSeed(input: string): number
export function mulberry32(seed: number): () => number
```

This ensures every neuron has a stable shape across reloads.

---

## Rendering Requirements

First inspect the existing renderer. Then choose the best strategy based on what is already in the app.

### If using SVG

Render each morphology as layered polylines:

1. Outer glow stroke: wider, low opacity.
2. Middle color stroke: medium opacity.
3. Inner bright core stroke: very thin, higher opacity.

Use:

- `polyline` for jagged biological geometry.
- Avoid perfectly smooth bezier curves.
- `stroke-linecap="round"` only lightly. The overall shape should remain sharp and traced.
- `vector-effect="non-scaling-stroke"` where helpful.
- SVG filters only if performance remains good.

### If using Canvas

Best for dense 2D/2.5D scenes.

- Render morphology to offscreen canvas.
- Draw tapered segments.
- Use `globalCompositeOperation = "lighter"` sparingly.
- Animate hover/pulse overlays separately.
- Keep hit detection separate from visual drawing.
- Avoid full expensive redraws unless needed.

### If using Three.js / React Three Fiber

Best for realistic 3D.

Use one of:

- `Line2` / fat lines for screen-space line width.
- Instanced tapered cylinders/cones for segment rendering.
- `TubeGeometry` only if segment count is reasonable.
- Batched BufferGeometry for performance.

Add:

- Bloom.
- Fog.
- Depth-based opacity.
- Subtle camera parallax.
- Emissive materials with restrained intensity.

Performance note: thousands of separate React components will be slow. Batch geometry.

---

## Organic Soma Rendering

Replace perfect circular somas with organic, irregular soma cores.

Soma requirements:

- One clear core per navigation node.
- Uneven boundary using noise-displaced polygon or shader.
- Semi-transparent dark fill.
- Colored rim/glow.
- Tiny internal texture or faint nucleus highlight.
- No dense clusters of decorative dots.
- Sparse synapse/puncta dots only along neurites if used.

SVG/canvas version:

- Generate 24–48 boundary points around a circle.
- Radius = baseRadius * noise angle.
- Draw closed irregular path.
- Layer subtle glow and fill.

Three.js version:

- Use low-poly sphere or custom mesh with vertex displacement.
- Use emissive rim material.
- Add subtle internal glow.

---

## Axon Bundles Between Portfolio Nodes

Current smooth inter-node curves should become irregular axon bundles.

Implement:

```ts
generateAxonBundle(start, end, options): AxonStrand[]
```

Requirements:

- 3–8 thin strands per connection.
- Each strand follows the same general route but with independent jitter.
- Use segmented polylines, not smooth Beziers.
- Add occasional tiny offshoots.
- Taper slightly.
- Use low opacity until hover/click.
- On click, animate an action-potential-like pulse along the bundle.

Visual goal:

- The connection should still guide the eye.
- It should feel like biological axon tracts, not UI noodles.

---

## Interaction

Preserve existing interactions but restyle them biologically.

Hover:

- Brighten hovered soma and arbor.
- Slightly increase opacity of its morphology.
- Dim unrelated neurons.
- Show label clearly.

Click:

- Trigger a pulse through connected axon bundle.
- Pulse should travel like calcium/electrical propagation.
- Then navigate.

Idle animation:

- Very subtle shimmer.
- Slow soma breathing/pulse.
- Occasional tiny traveling glints.
- No bouncy or cartoon motion.

---

## Color System

Use a dark scientific atlas palette:

```ts
const background = {
  black: "#020306",
  navy: "#050814",
};

const neuronColors = {
  cyan: "#4dfcff",
  violet: "#9b5cff",
  magenta: "#ff4fd8",
  green: "#70ff8a",
  amber: "#ffd166",
  blue: "#4f8cff",
};
```

Rules:

- Background morphology: low alpha.
- Active/hovered morphology: higher alpha.
- Do not over-bloom.
- Keep labels legible.
- Avoid beige cartoon fills.

---

## Portfolio Node Data Example

Create or update `portfolioNeurons.ts`:

```ts
export const portfolioNeurons: PortfolioNeuron[] = [
  {
    id: "identity",
    label: "Origin Signal",
    route: "/identity",
    position: [0, 0, 0],
    color: "#4dfcff",
    source: "swc",
    swcUrl: "/morphologies/example-neuron-01.swc",
    seed: "identity",
    scale: 1.2,
  },
  {
    id: "field-inputs",
    label: "Field Inputs",
    route: "/field-inputs",
    position: [-320, -180, -20],
    color: "#70ff8a",
    source: "swc",
    swcUrl: "/morphologies/example-neuron-02.swc",
    seed: "field-inputs",
  },
  {
    id: "future-circuits",
    label: "Future Circuits",
    route: "/research-ideas",
    position: [340, -220, 30],
    color: "#ff4fd8",
    source: "swc",
    swcUrl: "/morphologies/example-neuron-03.swc",
    seed: "research-ideas",
  },
  {
    id: "light-field",
    label: "Light Field",
    route: "/visual-field-notes",
    position: [-420, 160, 10],
    color: "#ffd166",
    source: "swc",
    swcUrl: "/morphologies/example-neuron-04.swc",
    seed: "visual-field-notes",
  },
  {
    id: "build-log",
    label: "Build Log",
    route: "/build-cortex",
    position: [260, 260, -10],
    color: "#9b5cff",
    source: "swc",
    swcUrl: "/morphologies/example-neuron-05.swc",
    seed: "build-cortex",
  },
];
```

If SWC files are not available, fall back to procedural rendering.

---

## Script Requirement: Download Example SWC Files

Add a script that can download about 5 example SWC files into:

```txt
public/morphologies/
```

The script should be robust and documented.

Preferred script path:

```txt
scripts/download_example_swc.py
```

The script should:

1. Create `public/morphologies/` if it does not exist.
2. Query NeuroMorpho metadata using the public API when available.
3. Select 5 neurons from a reasonable query.
4. Build SWC download URLs.
5. Download `.swc` files.
6. Save them as:
   - `example-neuron-01.swc`
   - `example-neuron-02.swc`
   - `example-neuron-03.swc`
   - `example-neuron-04.swc`
   - `example-neuron-05.swc`
7. Create `public/morphologies/manifest.json`.
8. Print clear instructions if the API fails.
9. Avoid crashing silently.
10. Include fallback hardcoded known URLs only if they are verified.

Important:
- Use NeuroMorpho for broad public SWC availability.
- Allen Cell Types / MICrONS data can be added later, but NeuroMorpho is easier for immediate SWC rendering.
- Do not commit huge raw image stacks.
- SWC skeleton files are small and appropriate for the website.

---

## Python Script Template for Codex to Add

Create `scripts/download_example_swc.py` with this implementation or an improved equivalent:

```py
#!/usr/bin/env python3
"""
Download example SWC neuron morphology files for local website rendering.

Default output:
  public/morphologies/example-neuron-01.swc
  public/morphologies/example-neuron-02.swc
  ...

Data source:
  NeuroMorpho.Org metadata API + SWC file paths.

Notes:
  NeuroMorpho SWC file URLs are commonly organized as:
    https://neuromorpho.org/dableFiles/{archive}/{version}/{neuron_name}.swc

  For many records:
    archive = record["archive"].lower()
    version = "CNG version" for standardized SWC files
    version = "Source-Version" for original SWC files

  This script first tries standardized CNG SWC files, then source SWC files.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests


API_BASE = "https://neuromorpho.org/api"
SWC_BASE = "https://neuromorpho.org/dableFiles"


def slugify(value: str) -> str:
    value = value.strip().replace(" ", "_")
    value = re.sub(r"[^A-Za-z0-9_.-]+", "_", value)
    return value.strip("_") or "neuron"


def get_json(url: str, params: dict[str, str] | None = None, timeout: int = 30) -> dict[str, Any]:
    response = requests.get(
        url,
        params=params,
        timeout=timeout,
        headers={"User-Agent": "personal-website-swc-downloader/1.0"},
    )
    response.raise_for_status()
    return response.json()


def query_neuromorpho(query: str, size: int) -> list[dict[str, Any]]:
    """
    Query NeuroMorpho records.

    Example query strings:
      species:mouse
      species:mouse AND brain_region:cortex
      archive:Allen Cell Types
      neuron_name:*
    """
    url = f"{API_BASE}/neuron/select"
    params = {
        "q": query,
        "size": str(max(size, 5)),
        "page": "0",
    }

    data = get_json(url, params=params)
    embedded = data.get("_embedded", {})
    records = embedded.get("neuronResources", [])

    if not isinstance(records, list):
        return []

    return records


def candidate_swc_urls(record: dict[str, Any]) -> list[str]:
    archive = str(record.get("archive", "")).lower()
    neuron_name = str(record.get("neuron_name", ""))

    if not archive or not neuron_name:
        return []

    # URL-escape path components while preserving common filename characters.
    archive_q = quote(archive, safe="")
    name_q = quote(neuron_name, safe="")

    # Try standardized SWC first, then source/original version.
    # NeuroMorpho examples often use these folder names.
    versions = ["CNG%20version", "Source-Version"]

    return [
        f"{SWC_BASE}/{archive_q}/{version}/{name_q}.swc"
        for version in versions
    ]


def looks_like_swc(text: str) -> bool:
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 7:
            rows.append(parts)
        if len(rows) >= 5:
            return True
    return False


def download_text(url: str, timeout: int = 45) -> str:
    response = requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": "personal-website-swc-downloader/1.0"},
    )
    response.raise_for_status()
    return response.text


def download_swc_for_record(record: dict[str, Any]) -> tuple[str, str] | None:
    for url in candidate_swc_urls(record):
        try:
            text = download_text(url)
            if looks_like_swc(text):
                return url, text
            print(f"Skipped non-SWC response: {url}", file=sys.stderr)
        except Exception as exc:
            print(f"Could not download {url}: {exc}", file=sys.stderr)
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out-dir",
        default="public/morphologies",
        help="Directory where SWC files should be saved.",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of SWC files to download.",
    )
    parser.add_argument(
        "--query",
        default="species:mouse AND brain_region:cortex",
        help="NeuroMorpho search query.",
    )
    parser.add_argument(
        "--metadata-size",
        type=int,
        default=30,
        help="Number of metadata records to inspect while searching for downloadable SWC files.",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    readme = out_dir / "README.md"
    readme.write_text(
        "# Example SWC Morphologies\n\n"
        "These files are example neuron morphology skeletons for local rendering.\n"
        "They were downloaded by `scripts/download_example_swc.py`.\n\n"
        "SWC columns are:\n\n"
        "```txt\n"
        "id type x y z radius parent\n"
        "```\n",
        encoding="utf-8",
    )

    print(f"Querying NeuroMorpho: {args.query}")
    try:
        records = query_neuromorpho(args.query, args.metadata_size)
    except Exception as exc:
        print(f"Failed to query NeuroMorpho API: {exc}", file=sys.stderr)
        print(
            "\nFallback options:\n"
            "1. Try again later.\n"
            "2. Change --query to a broader query, such as 'species:mouse'.\n"
            "3. Manually place .swc files into public/morphologies/.\n",
            file=sys.stderr,
        )
        return 1

    if not records:
        print("No NeuroMorpho records returned. Try a broader --query.", file=sys.stderr)
        return 1

    manifest: list[dict[str, Any]] = []
    downloaded = 0

    for record in records:
        if downloaded >= args.count:
            break

        neuron_name = str(record.get("neuron_name", f"neuron-{downloaded + 1}"))
        archive = str(record.get("archive", "unknown"))
        result = download_swc_for_record(record)

        if result is None:
            continue

        source_url, swc_text = result
        downloaded += 1

        filename = f"example-neuron-{downloaded:02d}.swc"
        path = out_dir / filename
        path.write_text(swc_text, encoding="utf-8")

        manifest.append(
            {
                "file": filename,
                "source_url": source_url,
                "neuron_name": neuron_name,
                "archive": archive,
                "species": record.get("species"),
                "brain_region": record.get("brain_region"),
                "cell_type": record.get("cell_type"),
            }
        )

        print(f"Downloaded {filename}: {neuron_name} [{archive}]")
        time.sleep(0.25)

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    if downloaded < args.count:
        print(
            f"\nDownloaded only {downloaded}/{args.count} files. "
            "Try increasing --metadata-size or using a broader --query.",
            file=sys.stderr,
        )
        return 2

    print(f"\nDone. Saved {downloaded} SWC files to {out_dir}")
    print(f"Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

---

## Add NPM Script or README Command

If this is a Node/React repo, add a simple command to `package.json` if appropriate:

```json
{
  "scripts": {
    "swc:download": "python scripts/download_example_swc.py"
  }
}
```

Or document:

```bash
python scripts/download_example_swc.py --count 5
```

Optional variants:

```bash
python scripts/download_example_swc.py \
  --query "species:mouse AND brain_region:cortex" \
  --count 5 \
  --metadata-size 50
```

---

## Rendering Accuracy Notes

Codex should include comments explaining:

- SWC files are morphological skeletons, not raw microscopy images.
- They contain compartments and radius values, not volumetric image texture.
- Realistic rendering comes from:
  - faithful parent-child skeleton structure,
  - radius/taper visualization,
  - organic soma rendering,
  - subtle glow/fog,
  - high-quality line/tube rendering,
  - performance-aware batching.

Do not claim the website is rendering raw MICrONS image volumes unless actual volumetric data is used. This project should render **morphological skeleton reconstructions**, which is the right data format for smooth web performance.

---

## Smoothness / Performance Requirements

The site must remain smooth.

Implement these guardrails:

- Generate morphology once per node.
- Memoize parsed SWC and procedural morphologies.
- Batch geometry where possible.
- Avoid thousands of React DOM/SVG nodes if performance suffers.
- Use LOD:
  - Far or small neurons: fewer terminal segments.
  - Hovered/focused neuron: more detail.
- Use opacity fading instead of constant high-density rendering.
- Use canvas/WebGL for dense renderings if SVG becomes slow.
- Do not put animation tick values in React state.
- Use refs, requestAnimationFrame, shaders, or canvas draw loop.
- Measure performance in devtools.

Target:

- 60 fps on a modern laptop if possible.
- At minimum, smooth interaction without jank.

---

## Visual Acceptance Criteria

The redesign is successful when:

- The scene no longer looks cartoonish.
- Somas are organic and sparse.
- Dendrites/axons are thin, branching, tapered, and irregular.
- Main nodes are still readable and clickable.
- Labels are clear.
- Small decorative dots are removed or drastically reduced.
- Axon connections are bundles of thin irregular strands, not smooth UI noodles.
- Hover/click interactions feel like neural activity propagation.
- SWC files can be loaded from `public/morphologies/`.
- Procedural fallback works if SWC files fail.
- The code is organized and maintainable.
- The visual effect resembles real reconstructed neuron morphology.

---

## Step-by-Step Work Plan for Codex

1. Inspect current rendering code.
2. Identify whether SVG, Canvas, Three.js, or React Three Fiber is being used.
3. Preserve all current navigation and route behavior.
4. Create morphology types and utilities.
5. Add SWC parser.
6. Add morphology normalization.
7. Add segment builder.
8. Add seeded procedural morphology generator.
9. Add example SWC downloader script.
10. Update portfolio node config to support `source`, `swcUrl`, `seed`, and `color`.
11. Replace cartoon node visuals with morphology renderer.
12. Replace smooth axon curves with irregular axon bundles.
13. Add organic soma rendering.
14. Add hover focus and click pulse.
15. Add performance memoization and LOD.
16. Test with procedural fallback.
17. Run SWC download script and test with real SWC files.
18. Verify website still builds.
19. Commit in logical chunks.
20. Summarize changes and remaining TODOs.

---

## Commit Plan

Use small commits:

```txt
feat(morphology): add SWC parser and morphology utilities
feat(morphology): add deterministic procedural neuron generator
feat(data): add portfolio neuron config and SWC source support
feat(rendering): replace cartoon nodes with morphology neurons
feat(rendering): add organic soma and axon bundle rendering
feat(scripts): add example SWC downloader
perf(rendering): add memoization and LOD for neural scene
```

---

## Final Note

Do not simply tune colors. This is a structural upgrade from **symbolic neuron decorations** to **morphology-driven biological rendering**.

The best version of this page should feel like a living atlas of neural identity: crisp, scientific, mysterious, smooth, and real.
