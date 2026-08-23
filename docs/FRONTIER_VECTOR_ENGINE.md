# FRONTIER local vector engine

FRONTIER's semantic recommendation layer is intentionally **device-local and zero paid-API**. Content text is embedded inside a browser Web Worker, vectors live in IndexedDB, and the user-interest centroid is updated from local interaction signals. The system does not require OpenAI, Pinecone, a hosted vector database, or a recommendation service.

The existing FRONTIER behavioral model remains the resilient baseline. The vector engine is an additive reranking layer: if Web Workers, IndexedDB, model loading, or browser storage are unavailable, the ordinary feed still works.

## Runtime architecture

```text
live FrontierItem[]
        │
        ├─ title + summary + tags
        │
        ▼
vector.worker.ts
        │
        ├─ MiniLM feature extraction, 384 dimensions
        └─ deterministic local feature-hash fallback
        │
        ▼
IndexedDB / frontier-vector-index-v1
        │
        ├─ <= 1,000 item vectors (LRU)
        └─ one user-interest vector + evidence mass
        │
        ▼
ranker.ts
        │
        ├─ cosine semantic similarity
        ├─ freshness decay
        ├─ credibility
        ├─ BM25 lexical relevance
        └─ epsilon-greedy exploration
        │
        ▼
SignalBoard
```

## On-device embeddings

`components/frontier/vector/vector.worker.ts` is a module Web Worker. It never runs model inference on the main UI thread.

The preferred backend is:

- model: `Xenova/all-MiniLM-L6-v2`
- output: 384-dimensional `Float32Array`
- task: feature extraction
- pooling: mean
- normalized vectors
- quantized inference request (`q8`) where the browser/runtime supports it

The worker dynamically imports a version-pinned public Transformers.js ESM runtime rather than including ONNX/wasm machinery in FRONTIER's initial JavaScript bundle. Model/runtime assets can then be stored in the browser cache. Article titles, summaries, tags, behavioral events, and the interest vector are not sent to a paid embedding service.

### Offline/degraded fallback

Model delivery can be blocked by CSP, offline mode, extension policy, or a network failure. That must not disable local ranking.

The worker therefore includes a deterministic 384-dimensional signed feature-hash fallback built from unigrams and bigrams. It is not semantically as rich as MiniLM, but it preserves:

- local lexical geometry
- cosine search
- preference-vector updates
- IndexedDB persistence
- zero server dependency

The worker reports its current backend as `minilm` or `feature-hash` for development diagnostics. This state is not shown as permanent reading UI.

## Vector storage

`lib/frontier/vector/vectorStore.ts` uses raw IndexedDB directly, keeping FRONTIER free of another client database wrapper.

Stores:

- `vectors`: item embeddings and LRU metadata
- `profile`: the current interest vector

Every item record stores:

- item id
- vector buffer
- dimensions
- source-text hash
- creation time
- last-access time

The hard active-vector limit is **1,000**. Writes invoke deterministic LRU eviction using `lastAccessedAt`; reads refresh access time. This bounds persistent storage and keeps the active semantic index aligned with recent content.

Vectors are not included in normal FRONTIER export/cloud-memory payloads. They are derived local indexes and can be rebuilt from content. This keeps the cross-device memory contract smaller and avoids uploading an unnecessary semantic fingerprint.

Resetting learned behavior or resetting FRONTIER clears the local vector database.

## Interest vector

The interest profile is a normalized `Float32Array` plus:

- evidence mass
- last update timestamp

`updateInterestEwma()` decays accumulated evidence using a **7-day half-life** before applying the next interaction. This prevents old interests from retaining permanent weight and means the effective learning rate naturally rises when the user changes habits.

Positive evidence pulls the centroid toward an item vector. Negative evidence pushes it away. Each update is normalized before storage.

### Explicit signal weights

| Signal | Weight |
|---|---:|
| More like this | +1.00 |
| Less like this | -1.50 |
| Save | +0.80 |
| Love | +1.25 |
| Important | +1.05 |
| Surprise | +0.72 |
| Useful | +0.90 |
| Read | +0.42 |
| Already knew | +0.12 |
| Later | +0.22 |
| Meh | -0.62 |
| Hide | -1.85 |

### Implicit signal weights

- source open: +0.46
- Context/expanded reading: +0.36
- dwell: logarithmic, bounded so an abandoned tab cannot dominate the profile
- future visibility-depth events can be represented without changing the storage contract

Implicit events are emitted only while FRONTIER's existing implicit-learning control is enabled.

## Hybrid ranking

`ranker.ts` combines sparse and dense evidence.

### BM25

The browser builds a compact document-frequency table over the current candidate set and tokenizes title, summary, and tags. Query scores are normalized to `[0, 1]` within that set.

### Semantic similarity

Cosine similarity is calculated over `Float32Array` values. The hot loop is four-wide unrolled so current JavaScript engines can vectorize it without creating temporary arrays.

Cosine `[-1, 1]` is normalized to semantic relevance `[0, 1]`. Before a learned centroid exists, semantic relevance is neutral rather than pretending the system knows the user.

### Required score formula

The production score is:

```text
Score =
  0.40 × SemanticSimilarity
+ 0.30 × FreshnessDecay
+ 0.20 × CredibilityScore
+ 0.10 × BM25Score
```

The existing FRONTIER `baseScore` is retained only as a deterministic tie-breaker. It does not silently modify the requested hybrid weights.

The current explicit search phrase is synchronized from the bottom Utility Dock into the local ranker. That keeps search text inside the browser while allowing BM25 to participate in the same final score.

## Exploration bandit

Pure relevance optimization eventually collapses novelty. FRONTIER therefore applies epsilon-greedy exploration after hybrid scoring.

Default:

```text
epsilon = 0.15
```

The top three results are protected. Roughly 15% of the remaining output is selected from high-novelty candidates using:

- item novelty
- semantic distance from the current interest centroid
- deterministic daily jitter

The daily seed makes the result stable during a reading session while still changing the discovery surface over time.

## Performance contract

- model inference is Web Worker only
- vector storage is IndexedDB only
- no React state update per vector dimension
- embedding batches are capped
- indexing yields through `requestIdleCallback()` when available
- only a bounded active candidate set is indexed immediately
- ranking uses typed arrays and scalar accumulators, not object allocation inside cosine loops
- a feed remains usable before embeddings arrive and reranks progressively
- model/runtime download is not part of the initial FRONTIER application bundle

The target is not to promise that every machine can execute MiniLM while sustaining exactly 60 fps under arbitrary load. The enforceable architectural rule is stronger: expensive inference never executes on the main rendering thread, and indexing yields between batches so animation/input work keeps priority.

## Privacy contract

The semantic layer is local by construction:

- no article text is sent to an embedding API
- no user vector is sent to a vector database
- no paid model API is required
- IndexedDB is origin-scoped
- implicit learning remains user-disableable
- derived vectors are disposable and excluded from cross-device exports
- an unavailable semantic layer never blocks the page

The only network dependency of the preferred MiniLM path is fetching the public, version-pinned browser ML runtime/model assets themselves. Inference and recommendation calculations occur in the browser.