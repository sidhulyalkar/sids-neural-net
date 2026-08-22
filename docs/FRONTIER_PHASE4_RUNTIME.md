# FRONTIER Phase 4: operational local runtime

Phase 4 turns the Phase 3 local-first cognitive architecture into an operator-usable, continuously recoverable browser system.

The goal is not to make the interface louder. The reading surface remains sparse. Runtime machinery is exposed through one collapsed **Local** control beside the Utility Dock and otherwise stays out of the way.

## Production contract

FRONTIER now treats every optional long-lived subsystem as disposable infrastructure rather than a permanent singleton.

```text
live discovery
      │
      ▼
resident semantic map ─────┐
      │                    │
      ▼                    │
hot 1,000-vector IDB       │
      │                    │
      ▼                    │
chunk archive worker ◄─────┤ runtime watchdog
      │                    │
      ▼                    │
trajectory neighborhoods   │
      │                    │
      ▼                    │
64D sequence worker ◄──────┤ runtime watchdog
      │                    │
      ├──── local signal worker ◄── localhost relay / explicit samples
      │
      └──── peer CRDT ◄──────────── WebRTC DataChannel
                  │
                  ▼
          live profile invalidation
                  │
                  ▼
           current reranker
```

The core feed does not depend on any worker, sensor, peer, WebRTC connection, or IndexedDB archive being available.

## Worker watchdogs

The chunk archive, recurrent sequence model, and continuous signal processor now share a bounded request contract:

- every RPC has an 8-second deadline
- worker errors reject all outstanding requests
- unreadable `postMessage` payloads are treated as failures
- failed workers are terminated rather than retained in a zombie state
- a later request creates a clean worker instance
- runtime health records the degraded state and consecutive failures
- normal responses clear the failure streak

This closes a browser failure mode where a worker could remain alive but stop answering, leaving unresolved promises indefinitely.

A worker restart loses only volatile worker process state. Durable vector chunks, the hot semantic index, recurrent checkpoints, and local FRONTIER memory remain in browser storage and are rehydrated on demand.

## Runtime health registry

`lib/frontier/runtime/runtimeHealth.ts` is a small process-local health registry for:

- vector archive
- sequence model
- signal processor
- localhost signal bridge
- peer mesh

States are `idle`, `starting`, `ready`, `degraded`, and `failed`.

`idle` is important: optional systems that the user has not enabled are not errors. An unpaired mesh and disabled sensor relay are healthy local-only operation.

Health changes are also emitted as `frontier:runtime-health` browser events. The collapsed Local utility uses the same registry rather than maintaining a second status model.

## Peer evidence is now behaviorally live

Phase 3 could synchronize engagement PN counters and semantic neighborhoods, but durable replication alone is not sufficient for a live recommender.

Phase 4 closes the loop.

For each received PN counter, FRONTIER:

1. excludes the receiving browser's own actor component so local evidence is not counted twice
2. compares the remote aggregate against the last successfully applied remote value
3. converts the difference into a conservative bounded peer signal
4. resolves the item's vector from the hot tier or cold archive
5. promotes a cold vector back to the hot tier when necessary
6. updates the slow long-term interest prior
7. records the imported engagement contribution
8. persists the applied remote total so reloads do not replay the same evidence

Peer evidence is deliberately weaker than direct evidence on the current browser. A large imported history can provide useful direction without abruptly rotating local taste.

## Live recurrent rehydration

A second Phase 3 integration gap was in-memory invalidation.

A peer could write a newer recurrent checkpoint or long-term interest state to IndexedDB while the mounted recommender continued using its older in-memory state.

Phase 4 introduces `frontier:mesh-profile-update`.

After a peer sequence merge or successful peer-interest reconciliation, the mounted semantic recommender:

- serializes the refresh behind its existing telemetry queue
- reloads the long-term interest prior
- reloads the recurrent sequence checkpoint
- rehydrates the sequence worker from that checkpoint
- replaces the current in-memory sequence state
- immediately recomputes the active semantic trajectory and cold-memory neighborhood

The receiving browser therefore changes ranking behavior without requiring a page reload or remount.

## Resilient localhost signal relay

The optional localhost WebSocket path now reconnects automatically after a transient failure.

Backoff starts at one second and caps at thirty seconds. Only a user-enabled loopback URL is retried. The URL validator still rejects non-loopback hosts and non-WebSocket protocols.

The signal configuration is browser-local and can be changed at runtime. Applying a new configuration emits `frontier:signal-config`, causing the invisible bridge to disconnect the old socket and apply the new one without reloading FRONTIER.

Sensor failure never blocks recommendation. It simply removes the optional positive-implicit attenuation until samples return.

## Local utility

A collapsed **Local** utility is mounted near the existing bottom controls. It contains no feed state and does not change the main reading layout.

### Runtime health

The utility reports the current state of local subsystems. Detailed failure text is kept in hover/title metadata rather than promoted into persistent dashboard chrome.

### Manual peer pairing

Pairing is now usable without developer tools:

1. on browser A, choose **Create offer**
2. copy the generated code to browser B
3. paste it on B and choose **Accept offer**
4. copy B's generated answer back to browser A
5. paste it on A and choose **Finish answer**

**Disconnect** closes the peer transport while retaining all local memory.

The pairing model remains intentionally manual. FRONTIER still does not introduce a signaling service or silent network dependency.

### Local signal relay

The same utility can enable or disable the generic local signal relay and set the loopback WebSocket URL. The default suggested endpoint is `ws://localhost:8787`.

This is an integration surface, not a medical interpretation surface. FRONTIER continues to describe the processed value only as a generic non-diagnostic signal-load proxy.

## Failure semantics

| Failure | Behavior |
| --- | --- |
| chunk worker hangs | request expires, worker is terminated, later archive access recreates it |
| sequence worker hangs | current semantic system falls back to long-term/local ranking, later use recreates it |
| signal worker hangs | signal load resets and implicit attenuation disappears until recovery |
| localhost relay disconnects | bounded reconnect loop; feed and ranking continue |
| WebRTC fails | mesh health becomes degraded; local CRDT and local recommendation continue |
| peer evidence references a missing vector | evidence remains unapplied so a later state pass can retry after the vector arrives |
| peer profile arrives while local telemetry is updating | profile rehydration is serialized behind the semantic telemetry queue |
| Local utility is never opened | all normal FRONTIER behavior is unchanged |

## Validation additions

`tests/frontier-runtime.test.ts` adds deterministic coverage for:

- runtime health aggregation
- optional idle subsystems not being classified as failures
- peer PN-counter evidence excluding the receiving actor
- conservative bounded peer-evidence import
- positive and negative peer evidence preserving direction

The existing Phase 3 tests continue to cover quantization, semantic neighborhood retrieval, signal processing, CRDT convergence, and mesh chunk round trips.

## Privacy boundary

Phase 4 does not expand the server-visible intelligence surface.

- worker health remains in the browser process
- sensor configuration remains in localStorage
- sensor samples remain local
- peer pairing remains explicit
- peer state travels directly over browser WebRTC DataChannels
- raw dwell traces and reaction history are not added to discovery requests
- no analytics endpoint receives runtime health or sensor state

The system becomes more operable without becoming more centralized.
