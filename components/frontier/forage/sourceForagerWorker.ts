/// <reference lib="webworker" />

import type { FrontierForagerRequest, FrontierForagerResponse } from '@/lib/frontier/forage/foragerProtocol';
import {
  evaluateFrontierForageCandidates,
  extractFrontierSourceGraph,
} from '@/lib/frontier/forage/sourceForager';

function post(response: FrontierForagerResponse): void {
  self.postMessage(response);
}

self.onmessage = (event: MessageEvent<FrontierForagerRequest>) => {
  const request = event.data;
  if (!request) return;
  try {
    if (request.type === 'parse') {
      post({
        type: 'parsed',
        requestId: request.requestId,
        document: extractFrontierSourceGraph(request.html, request.pageUrl),
      });
      return;
    }

    const vectors = new Map(request.vectors.map((entry) => [entry.id, new Float32Array(entry.buffer)]));
    const activeState = new Float32Array(request.activeState);
    post({
      type: 'evaluated',
      requestId: request.requestId,
      evaluations: evaluateFrontierForageCandidates(request.candidates, vectors, activeState),
    });
  } catch (error) {
    post({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'source forager failed',
    });
  }
};

export {};
