# FRONTIER Phase 9 — Synthesis & Reactive Environments

Phase 9 adds local technical synthesis, audio-reactive atmosphere, and scientific source planes without changing FRONTIER's recommendation authority graph.

## Authority graph

```text
real source material
  → normalized FrontierItem
  → exact unseen boundary
  → semantic / freshness / credibility ranking
  → trajectory-aware exploration
  → deterministic Convergence / Velocity / grounded artifacts
  → spatial presentation
      ├─ native scientific planes
      ├─ expanded-media audio reactivity
      └─ explicit opt-in local WebGPU synthesis
```

Generated synthesis is a leaf of this graph. It never flows back into ranking, source credibility, Watch/Avoid, trajectory state, the exact seen ledger, implicit behavior evidence, source-yield accounting, or candidate identity.

## 1. Local Convergence synthesis

### Explicit opt-in

Expanding a Convergence Node does not create a worker, import WebLLM, probe model weights, or download a model. The first `Synthesize locally` action creates the worker and starts local model initialization.

The normal FRONTIER feed remains completely usable when:

- WebGPU is absent;
- no compatible adapter is available;
- the model asset cannot be downloaded;
- WebGPU device state is lost;
- the worker terminates;
- the generated response fails FRONTIER's grounding contract.

In every failure mode the deterministic source list, summaries, artifacts, and canonical links remain available.

### Runtime isolation

The synthesis worker is created from a local Blob module only after explicit user action. WebLLM is dynamically imported inside that worker rather than included in FRONTIER's normal application dependency graph.

Pinned runtime:

```text
https://esm.run/@mlc-ai/web-llm@0.2.84
```

Default model class:

```text
Llama-3.2-1B-Instruct-q4f16_1-MLC
Llama-3.2-1B-Instruct-q4f32_1-MLC  (non-shader-f16 fallback)
```

A 1B instruct model is intentional. Local synthesis is supplemental assistance, so FRONTIER does not make multi-gigabyte 8B-class inference a prerequisite for ordinary browsing.

### Evidence bounds

Convergence remains deterministic and source-backed before the model is involved.

- Up to 8 real members may be retained by a Convergence Node.
- Each member may retain at most 1,200 characters of normalized verbatim source summary evidence.
- Local synthesis selects at most 6 members.
- Total text supplied to a synthesis request is bounded to approximately 8,000 characters.
- No hidden fetch of a source body occurs from the worker.

The model is instructed to emit exactly three concise bullets, each carrying at least one `[S#]` citation into the visible Convergence member list. The controller rejects malformed JSON, missing citations, invalid citation indexes, more/fewer than three bullets, or bullets over 240 characters.

Accepted output shape:

```json
{"bullets":["... [S1]","... [S2][S3]","... [S1][S3]"]}
```

Generated bullets exist only in component state. They are labeled `Generated on this device` and are disposable.

### Device loss

The worker recognizes probable WebGPU device-loss/destroyed failures, unloads its engine, returns a recoverable error, and allows the user to retry into a fresh local session. Device loss never removes the grounded evidence surface.

## 2. Audio-reactive ambient field

### Safe media interception

`createMediaElementSource()` can change playback behavior for cross-origin media without usable CORS headers. FRONTIER therefore only analyzes a native `HTMLAudioElement` / `HTMLVideoElement` when one of these conditions is true:

- it uses a `MediaStream` / `srcObject`;
- it uses a `blob:` URL;
- it uses a `data:` URL;
- its URL is same-origin;
- it is explicitly marked as CORS-safe by the media pipeline.

Unknown publisher media, YouTube iframes, and other embedded players are never intercepted. If a media element is not safe to tap, playback stays untouched and audio momentum remains zero.

### Lifetime

The audio analyser is attached only while a fluid spatial card is expanded. A subtree observer handles media that mounts after expansion. Collapse/unmount removes listeners and stops the analysis loop.

A per-window registry and `WeakMap<HTMLMediaElement, Binding>` guarantee that a native media element receives at most one `MediaElementAudioSourceNode` during its DOM lifetime.

### FFT contract

```text
FFT size                1024
smoothingTimeConstant   0.76
sub-bass                 24–92 Hz
low-mid                  92–320 Hz
```

The lower bin boundary uses `ceil(lowHz / hzPerBin)`, preventing the DC bin from leaking into the sub-bass signal.

Band energy is RMS over normalized FFT magnitudes. A small silence floor is removed before momentum is formed:

```text
instantaneous ≈ 0.72 * sqrt(subBass) + 0.28 * sqrt(lowMid)
```

Momentum uses a faster attack (`0.34`) and slower release (`0.105`) and is clamped to `[0,1]`.

Analysis runs inside `requestAnimationFrame` only while the expanded media is actually playing. Window event publishing is further bounded to meaningful momentum deltas or roughly 10 Hz heartbeats.

### Ambient shader

The existing low-power WebGL2 canvas retains its approximately 24 fps single-fullscreen-draw budget. It consumes the latest audio momentum and interpolates it into a deliberately restrained `u_audioMomentum` uniform.

Audio can only make small changes to:

- field frequency;
- advection speed;
- low-frequency warp amplitude;
- contour density;
- atmospheric energy;
- breathing amplitude.

It never replaces the exploration-state uniform and never changes semantic ranking.

`prefers-reduced-motion: reduce` forces audio momentum to zero in the ambient canvas.

## 3. Scientific source planes

Phase 9 extracts bounded scientific structures from the source text already carried by the item. It does not fetch or invent missing equations/code.

Recognized structures:

- fenced code blocks: `````lang ... `````;
- display math: `$$ ... $$`;
- display math: `\[ ... \]`;
- technical inline backticks when they contain code-like syntax.

Bounds:

```text
max normal planes       3
max fenced code chars   1200
max math chars           520
max inline code chars    220
```

Fenced-code ranges are protected before math scanning so a `$$...$$` string inside code is never misclassified as an equation.

### Code

Code highlighting is a deterministic tokenizer. Source characters are rendered through ordinary React text nodes. No code is evaluated and no HTML is injected.

### Math

A compact parser handles a useful native MathML subset:

- identifiers and numbers;
- operators;
- groups;
- superscript/subscript;
- `\frac`;
- common Greek symbols and mathematical operators.

The renderer uses native MathML DOM elements through typed `React.createElement`. It does not use `dangerouslySetInnerHTML`, and the original formula text remains visible beneath the rendered plane as an inspectable source fallback.

## Performance and privacy invariants

Phase 9 keeps these properties:

1. No SLM inference on the UI thread.
2. No model runtime/model-weight network request merely from opening a Convergence Node.
3. No generated synthesis becomes preference evidence.
4. No audio FFT loop runs for collapsed or paused media.
5. No unsafe cross-origin media is routed through Web Audio.
6. No article HTML/code is interpreted as executable markup.
7. Scientific extraction is bounded and deterministic.
8. Existing FLIP media-node continuity remains authoritative.
9. Exact seen-ledger identity behavior is unchanged.
10. Media presence remains presentation information, never semantic rank authority.

## Validation

Phase 9 adds unit coverage for:

- convergence evidence bounds;
- source-order scientific extraction;
- code-range protection from math parsing;
- literal treatment of hostile HTML strings;
- native MathML AST construction;
- DC-safe FFT ranges;
- bounded audio attack/release dynamics;
- bounded local synthesis evidence;
- exact three-bullet cited output validation;
- pinned browser-sized runtime/model selection.

The production browser gate additionally expands the real Phase 8 fluid card and asserts:

- native math plane visible;
- code plane visible;
- local synthesis control/fallback visible;
- no WebLLM/model request before explicit synthesis;
- the playing `MediaStream` video remains intact;
- the expanded video becomes the sole active reactive-audio binding;
- the analyser uses the 1024-point FFT contract.

The existing Phase 8 interruption choreography continues to run first, so Phase 9 cannot gain a green browser badge by weakening kinetic interaction guarantees.
