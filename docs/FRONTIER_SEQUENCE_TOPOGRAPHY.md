# FRONTIER sequence state and latent topography

FRONTIER's local semantic layer now models two different timescales instead of forcing every interaction into one average.

## Fast reading-context state

The primary next-item semantic target is a 64-dimensional recurrent state:

```text
x[k+1] = 0.85 x[k] + B (w u[k])
y[k]   = C x[k]
```

- `u[k]` is the interacted item's 384D browser-local embedding.
- `w` is the bounded semantic evidence from explicit feedback or meaningful implicit behavior such as dwell and reading depth.
- `B` is a deterministic implicit random projection from 384D to 64D.
- `C` is the matching deterministic back-projection into the 384D ranking space.
- `x[k]` is persisted locally in the existing IndexedDB profile store under a separate key, so no database migration is needed.

The projection matrix is never materialized. Its signs are generated deterministically from input/latent indices, eliminating roughly 100 KB of persistent matrix state and making the recurrence identical after a reload.

The recurrent state is deliberately interaction-decayed rather than session-averaged. A run of neural-signal-processing interactions therefore moves the target into that local context; a later run of music-production interactions can replace that short-term momentum instead of permanently blending both topics into a single ambiguous centroid.

## Slow prior

The previous seven-day-decayed EWMA interest vector remains as a durable cold-start prior and failure fallback. It is no longer the only semantic target.

During the first few recurrent interactions, FRONTIER blends the sequence target with the slow prior. After the context model has enough evidence, the sequence prediction becomes the primary dense target used by the hybrid ranker.

This separation gives FRONTIER:

- a stable long-term taste prior,
- fast context switching,
- negative-evidence repulsion,
- deterministic offline behavior,
- a safe fallback when workers or IndexedDB are blocked.

## Worker lifecycle

`components/frontier/vector/sequenceModelWorker.ts` owns the mutable recurrent state. `useSequenceModelWorker.ts` provides a small request/response bridge.

On startup:

1. read the persisted sequence state from IndexedDB;
2. hydrate the worker;
3. serialize semantic telemetry events through the existing telemetry queue;
4. update the worker with the interacted item's vector and evidence weight;
5. persist the returned 64D state + 384D target;
6. rerank against the new target.

The worker receives cloned/transferred `ArrayBuffer`s, so it never mutates vectors held by the UI.

## 3D latent topography

The Radar view now visualizes the actual browser-local vector index rather than a hand-positioned topic SVG.

`FrontierLatentCanvas.tsx` reads up to the same 1,000 active vectors already permitted by the IndexedDB LRU. Reading a Radar snapshot does not touch vector LRU timestamps.

### Projection

`latentProjectionWorker.ts` runs deterministic matrix-free PCA using `randomizedPca3()`.

The implementation:

- centers the active vectors;
- estimates three principal directions with power iteration;
- computes covariance-vector products as `X^T(Xv)` without allocating a 384x384 covariance matrix;
- orthogonalizes successive components;
- projects all active vectors into three dimensions;
- applies robust 96th-percentile axis scaling so one outlier cannot flatten the rest of the manifold.

For 1,000 x 384 embeddings, all high-dimensional iteration happens in a dedicated worker.

### Rendering

The point cloud uses one WebGL2 vertex buffer and one `gl.drawArrays(gl.POINTS, ...)` call.

Each interleaved point contains:

```text
x, y, z, freshness, engagement
```

The fragment shader renders anti-aliased circular point sprites. Brightness is driven by freshness, while engagement adds a restrained secondary tint. This remains a visualization of real locally stored discovery vectors, not generated topic art.

### Camera

The camera is intentionally lightweight:

- drag: orbit
- Shift-drag / middle / secondary drag: pan
- wheel: zoom
- `/`: return focus to FRONTIER search
- `Esc`: reset camera

Velocity is damped after interaction. There is no permanent animation loop: frames continue only while the camera has meaningful residual motion or the pointer is actively dragging.

`prefers-reduced-motion` removes inertial motion while preserving direct navigation.

## Privacy

The latent map is entirely browser-local. No vector, PCA coordinate, recurrent state, or reading-history point is sent to an external vector service.

The existing optional account memory remains separate. Derived semantic vectors and the 3D projection are not silently uploaded as part of ordinary cloud synchronization.

## Failure behavior

If the sequence worker fails, ranking falls back to the durable interest prior.

If IndexedDB is blocked, in-memory ranking continues for the current page.

If the projection worker or WebGL2 is unavailable, the Radar surface degrades to a quiet local-state placeholder instead of blocking the rest of FRONTIER.

## Tests

`tests/frontier-vector.test.ts` verifies:

- the exact `0.85 I` state recurrence,
- normalized 384D sequence targets,
- negative-evidence repulsion,
- recovery of a known three-dimensional dominant manifold from higher-dimensional data,
- bounded projected coordinates,
- the existing cosine, EWMA, LRU, and hybrid-ranker contracts.
