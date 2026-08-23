import type { FrontierSequenceState } from '../vector/sequenceModel';

export type MeshClock = { counter: number; actor: string };

export type LwwRegister<T> = {
  clock: MeshClock;
  value: T;
};

export type PnCounter = {
  positive: Record<string, number>;
  negative: Record<string, number>;
};

export type SerializedSequenceState = {
  state: number[];
  target: number[];
  updatedAt: number;
  interactions: number;
};

export type MeshChunkPayload = {
  chunkId: string;
  hash: string;
  /** Optional base64 payload. Manifests can synchronize without eagerly sending chunk bytes. */
  payload?: string;
  count: number;
  updatedAt: number;
};

export type FrontierMeshState = {
  version: 1;
  actorId: string;
  logicalCounter: number;
  sequence?: LwwRegister<SerializedSequenceState>;
  engagements: Record<string, PnCounter>;
  chunks: Record<string, LwwRegister<MeshChunkPayload>>;
  config: Record<string, LwwRegister<string | number | boolean | null>>;
};

function compareClock(left: MeshClock, right: MeshClock): number {
  if (left.counter !== right.counter) return left.counter - right.counter;
  return left.actor.localeCompare(right.actor);
}

export function mergeLwwRegister<T>(left: LwwRegister<T> | undefined, right: LwwRegister<T> | undefined): LwwRegister<T> | undefined {
  if (!left) return right;
  if (!right) return left;
  return compareClock(left.clock, right.clock) >= 0 ? left : right;
}

export function emptyPnCounter(): PnCounter {
  return { positive: {}, negative: {} };
}

export function pnCounterValue(counter: PnCounter): number {
  const positive = Object.values(counter.positive).reduce((sum, value) => sum + value, 0);
  const negative = Object.values(counter.negative).reduce((sum, value) => sum + value, 0);
  return positive - negative;
}

export function incrementPnCounter(counter: PnCounter, actor: string, delta: number): PnCounter {
  if (!Number.isFinite(delta) || delta === 0) return counter;
  const next: PnCounter = {
    positive: { ...counter.positive },
    negative: { ...counter.negative },
  };
  if (delta > 0) next.positive[actor] = (next.positive[actor] ?? 0) + delta;
  else next.negative[actor] = (next.negative[actor] ?? 0) + Math.abs(delta);
  return next;
}

export function mergePnCounter(left: PnCounter | undefined, right: PnCounter | undefined): PnCounter {
  const output = emptyPnCounter();
  for (const source of [left?.positive ?? {}, right?.positive ?? {}]) {
    for (const [actor, value] of Object.entries(source)) output.positive[actor] = Math.max(output.positive[actor] ?? 0, value);
  }
  for (const source of [left?.negative ?? {}, right?.negative ?? {}]) {
    for (const [actor, value] of Object.entries(source)) output.negative[actor] = Math.max(output.negative[actor] ?? 0, value);
  }
  return output;
}

export function createFrontierMeshState(actorId: string): FrontierMeshState {
  return {
    version: 1,
    actorId,
    logicalCounter: 0,
    engagements: {},
    chunks: {},
    config: {},
  };
}

export function serializeSequenceState(state: FrontierSequenceState): SerializedSequenceState {
  return {
    state: Array.from(state.state),
    target: Array.from(state.target),
    updatedAt: state.updatedAt,
    interactions: state.interactions,
  };
}

export function deserializeSequenceState(state: SerializedSequenceState): FrontierSequenceState {
  return {
    state: Float32Array.from(state.state),
    target: Float32Array.from(state.target),
    updatedAt: state.updatedAt,
    interactions: state.interactions,
  };
}

export function withSequenceState(state: FrontierMeshState, sequence: FrontierSequenceState): FrontierMeshState {
  const counter = state.logicalCounter + 1;
  return {
    ...state,
    logicalCounter: counter,
    sequence: {
      clock: { counter, actor: state.actorId },
      value: serializeSequenceState(sequence),
    },
  };
}

export function withEngagementDelta(state: FrontierMeshState, itemId: string, delta: number): FrontierMeshState {
  return {
    ...state,
    logicalCounter: state.logicalCounter + 1,
    engagements: {
      ...state.engagements,
      [itemId]: incrementPnCounter(state.engagements[itemId] ?? emptyPnCounter(), state.actorId, delta),
    },
  };
}

export function withChunkRegister(state: FrontierMeshState, chunk: MeshChunkPayload): FrontierMeshState {
  const counter = state.logicalCounter + 1;
  return {
    ...state,
    logicalCounter: counter,
    chunks: {
      ...state.chunks,
      [chunk.chunkId]: {
        clock: { counter, actor: state.actorId },
        value: chunk,
      },
    },
  };
}

export function mergeFrontierMeshState(local: FrontierMeshState, remote: FrontierMeshState): FrontierMeshState {
  const engagements: Record<string, PnCounter> = {};
  for (const itemId of new Set([...Object.keys(local.engagements), ...Object.keys(remote.engagements)])) {
    engagements[itemId] = mergePnCounter(local.engagements[itemId], remote.engagements[itemId]);
  }

  const chunks: FrontierMeshState['chunks'] = {};
  for (const chunkId of new Set([...Object.keys(local.chunks), ...Object.keys(remote.chunks)])) {
    const merged = mergeLwwRegister(local.chunks[chunkId], remote.chunks[chunkId]);
    if (merged) chunks[chunkId] = merged;
  }

  const config: FrontierMeshState['config'] = {};
  for (const key of new Set([...Object.keys(local.config), ...Object.keys(remote.config)])) {
    const merged = mergeLwwRegister(local.config[key], remote.config[key]);
    if (merged) config[key] = merged;
  }

  return {
    version: 1,
    actorId: local.actorId,
    logicalCounter: Math.max(local.logicalCounter, remote.logicalCounter),
    sequence: mergeLwwRegister(local.sequence, remote.sequence),
    engagements,
    chunks,
    config,
  };
}

export type FrontierMeshStatus = 'offline' | 'connecting' | 'connected' | 'failed';

export type FrontierMeshPeerOptions = {
  actorId: string;
  initialState?: FrontierMeshState;
  iceServers?: RTCIceServer[];
  onState?: (state: FrontierMeshState) => void;
  onStatus?: (status: FrontierMeshStatus) => void;
};

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const onState = () => {
      if (peer.iceGatheringState !== 'complete') return;
      peer.removeEventListener('icegatheringstatechange', onState);
      resolve();
    };
    peer.addEventListener('icegatheringstatechange', onState);
    window.setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', onState);
      resolve();
    }, 4_000);
  });
}

/**
 * Manual-signaling WebRTC mesh peer. With no configured STUN/TURN servers the
 * default path is LAN/local candidate pairing. RTCDataChannel transport is DTLS
 * encrypted by the browser. Failure simply leaves the local CRDT state intact.
 */
export class FrontierMeshPeer {
  private readonly peer: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private state: FrontierMeshState;
  private closed = false;

  constructor(private readonly options: FrontierMeshPeerOptions) {
    if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC unavailable');
    this.state = options.initialState ?? createFrontierMeshState(options.actorId);
    this.peer = new RTCPeerConnection({ iceServers: options.iceServers ?? [] });
    this.peer.ondatachannel = (event) => this.attachChannel(event.channel);
    this.peer.onconnectionstatechange = () => {
      const status = this.peer.connectionState;
      if (status === 'connected') this.options.onStatus?.('connected');
      else if (status === 'failed' || status === 'disconnected' || status === 'closed') this.options.onStatus?.(status === 'closed' ? 'offline' : 'failed');
      else this.options.onStatus?.('connecting');
    };
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => {
      this.options.onStatus?.('connected');
      this.sendState();
    };
    channel.onclose = () => this.options.onStatus?.('offline');
    channel.onerror = () => this.options.onStatus?.('failed');
    channel.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const remote = JSON.parse(event.data) as FrontierMeshState;
        if (remote.version !== 1 || !remote.actorId) return;
        this.state = mergeFrontierMeshState(this.state, remote);
        this.options.onState?.(this.state);
      } catch {
        // Ignore malformed or incompatible peer payloads.
      }
    };
  }

  private sendState(): void {
    if (this.channel?.readyState !== 'open') return;
    this.channel.send(JSON.stringify(this.state));
  }

  updateState(next: FrontierMeshState): void {
    this.state = next;
    this.options.onState?.(next);
    this.sendState();
  }

  snapshot(): FrontierMeshState { return this.state; }

  async createOffer(): Promise<string> {
    this.options.onStatus?.('connecting');
    const channel = this.peer.createDataChannel('frontier-state', { ordered: true });
    this.attachChannel(channel);
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    await waitForIceGathering(this.peer);
    return JSON.stringify(this.peer.localDescription);
  }

  async acceptOffer(serializedOffer: string): Promise<string> {
    this.options.onStatus?.('connecting');
    const offer = JSON.parse(serializedOffer) as RTCSessionDescriptionInit;
    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    await waitForIceGathering(this.peer);
    return JSON.stringify(this.peer.localDescription);
  }

  async acceptAnswer(serializedAnswer: string): Promise<void> {
    const answer = JSON.parse(serializedAnswer) as RTCSessionDescriptionInit;
    await this.peer.setRemoteDescription(answer);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.channel?.close();
    this.peer.close();
    this.options.onStatus?.('offline');
  }
}
