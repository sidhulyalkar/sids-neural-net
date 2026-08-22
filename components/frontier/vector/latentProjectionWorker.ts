/// <reference lib="webworker" />

import { randomizedPca3 } from '@/lib/frontier/vector/pca3';

type ProjectRequest = {
  type: 'project';
  requestId: string;
  matrix: ArrayBuffer;
  rows: number;
  dimensions: number;
};

type ProjectResponse = {
  type: 'projected';
  requestId: string;
  positions: ArrayBuffer;
  explained: ArrayBuffer;
};

type ErrorResponse = { type: 'error'; requestId: string; message: string };

self.onmessage = (event: MessageEvent<ProjectRequest>) => {
  const request = event.data;
  try {
    const matrix = new Float32Array(request.matrix);
    const rows = Math.max(0, Math.min(1_000, request.rows));
    const dimensions = Math.max(1, Math.min(384, request.dimensions));
    const vectors: Float32Array[] = [];
    for (let row = 0; row < rows; row += 1) {
      const start = row * dimensions;
      vectors.push(matrix.slice(start, start + dimensions));
    }
    const result = randomizedPca3(vectors, { dimensions, iterations: rows > 600 ? 7 : 9 });
    const positions = result.positions.buffer as ArrayBuffer;
    const explained = result.explained.buffer as ArrayBuffer;
    const response: ProjectResponse = {
      type: 'projected',
      requestId: request.requestId,
      positions,
      explained,
    };
    self.postMessage(response, { transfer: [positions, explained] });
  } catch (error) {
    const response: ErrorResponse = {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'latent projection failed',
    };
    self.postMessage(response);
  }
};

export {};
