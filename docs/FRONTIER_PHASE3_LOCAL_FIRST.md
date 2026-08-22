# FRONTIER Phase 3: Out-of-Core Memory, Local Signals, and Peer Sync

Phase 3 extends FRONTIER without changing its local-first contract. The browser remains the source of truth for semantic memory and recommendation state. New subsystems are optional, bounded, and designed to fail closed to the existing Phase 2 experience.

## 1. Out-of-core semantic memory

The original 1,000-vector IndexedDB store remains the **hot tier**, not the lifetime limit.

Every new 384D embedding is also archived through `chunkedVectorStore.worker.ts` into a separate IndexedDB database. Chunking, vector quantization, neighborhood selection, and decompression happen inside the worker.

### Storage layout

- vectors are symmetrically quantized from Float32 to Int8 with one scale value per vector
- normalized-vector cosine direction is preserved while cold vector bytes are reduced by roughly 4x
- a deterministic random projection creates a coarse semantic grid key
- each grid bucket is paged into chunks of at most 96 vectors
- each chunk stores a 64D normalized centroid in a small manifest record
- a directory maps item IDs to chunk IDs
- the UI never loads all cold vectors at once

When the active sequence target changes, the worker compares its 64D projection to chunk centroids, pages only the nearest semantic chunks, then returns the closest vectors. At most a small bounded neighborhood enters the resident in-memory map.

The retrieved neighborhood contributes a deliberately small memory term to the live ranking target. The recurrent sequence remains dominant, so old archives can reinforce context without trapping the feed in historical interests.

### Capacity

There is no FRONTIER-imposed lifetime item count on the cold archive. Actual capacity is still bounded by the browser's IndexedDB/storage quota. Quota failures degrade to the 1,000-item hot tier and do not block reading or ranking.

## 2. Continuous local signal bridge

`signalProcessorWorker.ts` owns a typed-array ring buffer and a slowly calibrated temporal-instability estimator.

The output is a normalized `0..1` **signal-load proxy**. It is intentionally generic and non-diagnostic. FRONTIER does not claim that a generic sensor stream measures fatigue, attention, stress, or cognitive capacity. Device-specific validation belongs to the sensor integration, not the recommender.

The signal proxy changes only one behavior:

- positive **implicit** sequence evidence is attenuated by at most 45% at maximum load
- negative evidence is preserved
- explicit likes/dislikes/saves are preserved exactly
- the slower long-term preference model keeps the original interaction evidence

This makes the physiological path conservative and reversible.

### Inputs

Nothing connects by default.

Two local adapters are available:

1. **Local WebSocket relay**
   - only `localhost`, `127.0.0.1`, or `::1` are accepted
   - accepts binary Float32 frames, JSON `{ values: [...] }`, JSON `{ value: n }`, or simple numeric text
   - enable with localStorage key `frontier-signal-bridge-v1`, for example:

```json
{ "enabled": true, "url": "ws://127.0.0.1:8765" }
```

2. **Web Bluetooth**
   - must be initiated from a browser user gesture
   - caller supplies service UUID, characteristic UUID, and optionally a device-specific decoder
   - no medical-device protocol is silently assumed

External local integrations can also dispatch `frontier:signal-samples` with `{ values }`.

All filtering and load estimation run in a dedicated worker.

## 3. Local-first CRDT / WebRTC mesh

`meshSync.ts` implements a zero-dependency state-based CRDT model and a thin WebRTC DataChannel transport.

### CRDT state

- recurrent 64D/384D sequence state: deterministic LWW register using Lamport-style logical clock + actor tie-break
- engagement values: per-item PN counters, merged by per-actor maxima
- vector chunks: LWW chunk registers that can carry manifest-only state or an optional encoded payload
- small configuration values: LWW registers

The merge operation is deterministic, commutative for concurrent state, and idempotent.

`MeshStateBridge` mirrors semantic telemetry into the local CRDT state even when no peer is connected. A WebRTC peer is instantiated only when pairing is explicitly requested.

### Pairing

FRONTIER deliberately has no hidden signaling service. Pairing is manual:

1. device A creates an offer
2. the offer is transferred to device B
3. device B returns an answer
4. device A accepts the answer

The bridge exposes `frontier:mesh-command` / `frontier:mesh-response` browser events so a future minimal pairing sheet or QR flow can sit on top without changing the synchronization core.

With no configured STUN/TURN servers, WebRTC uses local candidates and is best suited to LAN/direct environments. Callers can deliberately provide ICE servers if internet traversal is desired. If pairing fails, FRONTIER simply remains offline-local.

RTCDataChannel traffic is encrypted by the browser's DTLS transport. No central database is required for live peer synchronization.

## Performance guardrails

- cold chunking/decompression: worker only
- physiological filtering: worker only
- active cold neighborhood: bounded to a handful of chunks
- resident semantic map: bounded independently of archive size
- cold vector encoding: Int8 + per-vector scale
- WebRTC connection: created only on explicit pairing
- signal bridge: opt-in only
- no TensorFlow.js, Yjs, Automerge, vector database, CRDT package, or signal-processing dependency

## Failure behavior

| Failure | Behavior |
| --- | --- |
| IndexedDB quota exhausted | continue with hot vectors/in-memory ranking |
| chunk worker unavailable | current feed is embedded normally |
| signal worker unavailable | sequence weight is unmodified |
| malformed sensor frame | ignore frame |
| local WebSocket unavailable | remain disconnected |
| Web Bluetooth unavailable | integration action fails without affecting FRONTIER |
| WebRTC unavailable/fails | local CRDT state remains authoritative |
| peer sends malformed state | ignore payload |

Phase 3 is therefore additive. None of these systems are required for the core feed to remain functional.
