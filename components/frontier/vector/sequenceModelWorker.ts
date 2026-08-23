/// <reference lib="webworker" />

import {
  emptySequenceState,
  updateSequenceState,
  type FrontierSequenceState,
} from '@/lib/frontier/vector/sequenceModel';

type HydrateRequest = {
  type: 'hydrate';
  requestId: string;
  state?: ArrayBuffer;
  target?: ArrayBuffer;
  updatedAt?: number;
  interactions?: number;
};

type UpdateRequest = {
  type: 'update';
  requestId: string;
  vector: ArrayBuffer;
  weight: number;
  at: number;
};

type ResetRequest = { type: 'reset'; requestId: string };
type Request = HydrateRequest | UpdateRequest | ResetRequest;

type StateResponse = {
  type: 'state';
  requestId: string;
  state: ArrayBuffer;
  target: ArrayBuffer;
  updatedAt: number;
  interactions: number;
};

type ErrorResponse = { type: 'error'; requestId: string; message: string };

let current: FrontierSequenceState = emptySequenceState();
let queue = Promise.resolve();

function response(requestId: string): StateResponse {
  const state = current.state.slice();
  const target = current.target.slice();
  return {
    type: 'state',
    requestId,
    state: state.buffer as ArrayBuffer,
    target: target.buffer as ArrayBuffer,
    updatedAt: current.updatedAt,
    interactions: current.interactions,
  };
}

async function handle(request: Request): Promise<void> {
  try {
    if (request.type === 'hydrate') {
      if (request.state && request.target) {
        current = {
          state: new Float32Array(request.state),
          target: new Float32Array(request.target),
          updatedAt: request.updatedAt ?? Date.now(),
          interactions: Math.max(0, request.interactions ?? 0),
        };
      } else {
        current = emptySequenceState();
      }
    } else if (request.type === 'update') {
      current = updateSequenceState(current, new Float32Array(request.vector), request.weight, request.at);
    } else {
      current = emptySequenceState();
    }

    const payload = response(request.requestId);
    self.postMessage(payload, { transfer: [payload.state, payload.target] });
  } catch (error) {
    const payload: ErrorResponse = {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'sequence model failed',
    };
    self.postMessage(payload);
  }
}

self.onmessage = (event: MessageEvent<Request>) => {
  queue = queue.then(() => handle(event.data)).catch(() => undefined);
};

export {};
