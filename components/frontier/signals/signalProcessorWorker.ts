/// <reference lib="webworker" />

import { FrontierSignalLoadEstimator } from '@/lib/frontier/signals/signalProcessing';

type Request =
  | { type: 'samples'; requestId: string; values: ArrayBuffer }
  | { type: 'reset'; requestId: string };

type Response =
  | {
      type: 'features';
      requestId: string;
      load: number;
      mean: number;
      standardDeviation: number;
      derivativeRms: number;
      sampleCount: number;
    }
  | { type: 'error'; requestId: string; message: string };

const estimator = new FrontierSignalLoadEstimator(1024);

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.type === 'reset') {
      estimator.reset();
      self.postMessage({
        type: 'features',
        requestId: request.requestId,
        load: 0,
        mean: 0,
        standardDeviation: 0,
        derivativeRms: 0,
        sampleCount: 0,
      } satisfies Response);
      return;
    }
    const values = new Float32Array(request.values);
    const features = estimator.push(values);
    self.postMessage({ type: 'features', requestId: request.requestId, ...features } satisfies Response);
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'signal processing failed',
    } satisfies Response);
  }
};

export {};
