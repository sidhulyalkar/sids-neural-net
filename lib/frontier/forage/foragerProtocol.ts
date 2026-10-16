import type {
  FrontierForageCandidate,
  FrontierForageDocument,
  FrontierForageEvaluation,
} from './sourceForager';

export type FrontierForagerRequest =
  | { type: 'parse'; requestId: string; html: string; pageUrl: string }
  | {
      type: 'evaluate';
      requestId: string;
      candidates: FrontierForageCandidate[];
      vectors: Array<{ id: string; buffer: ArrayBuffer }>;
      activeState: ArrayBuffer;
    };

export type FrontierForagerResponse =
  | { type: 'parsed'; requestId: string; document: FrontierForageDocument }
  | { type: 'evaluated'; requestId: string; evaluations: FrontierForageEvaluation[] }
  | { type: 'error'; requestId: string; message: string };
