'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { FrontierForagerRequest, FrontierForagerResponse } from '@/lib/frontier/forage/foragerProtocol';
import type { FrontierForageCandidate, FrontierForageDocument, FrontierForageEvaluation } from '@/lib/frontier/forage/sourceForager';
import {
  markFrontierForagedDomainProbed,
  noteFrontierForagedDomain,
  shouldProbeFrontierForagedDomain,
  upsertFrontierForagedSources,
} from '@/lib/frontier/forage/sourceRoster';
import { publishFrontierRuntimeHealth } from '@/lib/frontier/runtime/runtimeHealth';
import type { FrontierItem } from '@/lib/frontier/types';
import { projectEmbeddingToSequence } from '@/lib/frontier/vector/sequenceModel';
import { frontierVectorStore } from '@/lib/frontier/vector/vectorStore';
import { useVectorWorker } from '../vector/useVectorWorker';

const REQUEST_TIMEOUT_MS = 8_000;
const ARTICLE_REVISIT_COOLDOWN_MS = 6 * 60 * 60_000;
const MAX_RECURRING_DOMAIN_PROBES = 2;

type ParsePayload = Omit<Extract<FrontierForagerRequest, { type: 'parse' }>, 'requestId'>;
type EvaluatePayload = Omit<Extract<FrontierForagerRequest, { type: 'evaluate' }>, 'requestId'>;
type ForagerRequestPayload = ParsePayload | EvaluatePayload;

type Pending = {
  resolve: (response: FrontierForagerResponse) => void;
  reject: (error: Error) => void;
  timer: number;
};

type GatewayHtml = {
  url?: string;
  html?: string;
  error?: string;
};

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function canonicalConsiderationKey(item: FrontierItem): string {
  try {
    const url = new URL(item.url);
    url.hash = '';
    return url.toString().toLowerCase();
  } catch {
    return item.id;
  }
}

function dedupeFeeds(documents: FrontierForageDocument[]): FrontierForageCandidate[] {
  const map = new Map<string, FrontierForageCandidate>();
  for (const document of documents) {
    for (const candidate of document.feeds) {
      const key = candidate.url.toLowerCase();
      const previous = map.get(key);
      if (!previous || candidate.credibility > previous.credibility) map.set(key, candidate);
    }
  }
  return Array.from(map.values()).slice(0, 24);
}

export function useSourceForager() {
  const { embed } = useVectorWorker();
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, Pending>());
  const consideredRef = useRef(new Map<string, number>());
  const queueRef = useRef(Promise.resolve());

  const failPending = useCallback((message: string) => {
    const error = new Error(message);
    for (const pending of pendingRef.current.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(error);
    }
    pendingRef.current.clear();
  }, []);

  const ensureWorker = useCallback((): Worker | undefined => {
    if (workerRef.current) return workerRef.current;
    try {
      const worker = new Worker(new URL('./sourceForagerWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<FrontierForagerResponse>) => {
        const response = event.data;
        const pending = pendingRef.current.get(response.requestId);
        if (!pending) return;
        pendingRef.current.delete(response.requestId);
        window.clearTimeout(pending.timer);
        if (response.type === 'error') pending.reject(new Error(response.message));
        else pending.resolve(response);
      };
      worker.onerror = () => {
        failPending('source-forager worker failed');
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        publishFrontierRuntimeHealth('source-forager', 'degraded', { message: 'source-forager worker restarted' });
      };
      worker.onmessageerror = () => {
        failPending('source-forager worker returned an unreadable message');
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };
      workerRef.current = worker;
      return worker;
    } catch (error) {
      publishFrontierRuntimeHealth('source-forager', 'failed', {
        message: error instanceof Error ? error.message : 'source-forager worker unavailable',
      });
      return undefined;
    }
  }, [failPending]);

  const send = useCallback((request: ForagerRequestPayload, transfer: Transferable[] = []) => {
    const worker = ensureWorker();
    if (!worker) return Promise.reject(new Error('source-forager worker unavailable'));
    const id = requestId();
    return new Promise<FrontierForagerResponse>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pendingRef.current.delete(id);
        reject(new Error('source-forager request timed out'));
      }, REQUEST_TIMEOUT_MS);
      pendingRef.current.set(id, { resolve, reject, timer });
      try {
        const message: FrontierForagerRequest = request.type === 'parse'
          ? { ...request, requestId: id }
          : { ...request, requestId: id };
        worker.postMessage(message, { transfer });
      } catch (error) {
        window.clearTimeout(timer);
        pendingRef.current.delete(id);
        reject(error instanceof Error ? error : new Error('source-forager postMessage failed'));
      }
    });
  }, [ensureWorker]);

  const parse = useCallback(async (html: string, pageUrl: string): Promise<FrontierForageDocument> => {
    const response = await send({ type: 'parse', html, pageUrl });
    if (response.type !== 'parsed') throw new Error('source-forager parse response mismatch');
    return response.document;
  }, [send]);

  const fetchHtml = useCallback(async (url: string): Promise<FrontierForageDocument | undefined> => {
    try {
      const params = new URLSearchParams({ mode: 'html', url });
      const response = await fetch(`/api/frontier/forage?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) return undefined;
      const payload = await response.json() as GatewayHtml;
      if (!payload.html || !payload.url) return undefined;
      return await parse(payload.html, payload.url);
    } catch {
      return undefined;
    }
  }, [parse]);

  const evaluate = useCallback(async (candidates: FrontierForageCandidate[]): Promise<FrontierForageEvaluation[]> => {
    if (!candidates.length) return [];
    const sequence = await frontierVectorStore.getSequence().catch(() => undefined);
    if (!sequence?.interactions || !sequence.state?.length) return [];
    const vectors = await embed(candidates.map((candidate) => ({
      id: candidate.id,
      text: candidate.contextText.slice(0, 3_500),
    })));
    const latent = candidates.flatMap((candidate) => {
      const vector = vectors.get(candidate.id);
      if (!vector) return [];
      const projected = projectEmbeddingToSequence(vector);
      return [{ id: candidate.id, buffer: projected.buffer as ArrayBuffer }];
    });
    if (!latent.length) return [];
    const activeState = sequence.state.slice().buffer as ArrayBuffer;
    const transfers: Transferable[] = [activeState, ...latent.map((entry) => entry.buffer)];
    const response = await send({ type: 'evaluate', candidates, vectors: latent, activeState }, transfers);
    if (response.type !== 'evaluated') throw new Error('source-forager evaluation response mismatch');
    return response.evaluations;
  }, [embed, send]);

  const consider = useCallback((item: FrontierItem, strength = 1): Promise<number> => {
    const key = canonicalConsiderationKey(item);
    const now = Date.now();
    const previous = consideredRef.current.get(key) ?? 0;
    if (strength < 0.75 || now - previous < ARTICLE_REVISIT_COOLDOWN_MS) return Promise.resolve(0);
    consideredRef.current.set(key, now);

    const work = async (): Promise<number> => {
      publishFrontierRuntimeHealth('source-forager', 'starting', { message: 'mapping outbound source graph' });
      const primary = await fetchHtml(item.url);
      if (!primary) {
        publishFrontierRuntimeHealth('source-forager', 'ready', { message: 'source page was not forageable' });
        return 0;
      }

      const documents = [primary];
      const recurring: string[] = [];
      for (const domain of primary.domains) {
        const observation = await noteFrontierForagedDomain(domain.domain, domain.contextText, now);
        if (observation && shouldProbeFrontierForagedDomain(observation, now)) recurring.push(domain.domain);
      }

      for (const domain of recurring.slice(0, MAX_RECURRING_DOMAIN_PROBES)) {
        await markFrontierForagedDomainProbed(domain, now);
        const probed = await fetchHtml(`https://${domain}/`);
        if (probed) documents.push(probed);
      }

      const feeds = dedupeFeeds(documents);
      const evaluations = await evaluate(feeds);
      const written = await upsertFrontierForagedSources(evaluations, now);
      publishFrontierRuntimeHealth('source-forager', 'ready', {
        message: written.length
          ? `${written.length} autonomous source${written.length === 1 ? '' : 's'} promoted`
          : `graph observed · ${feeds.length} feed candidate${feeds.length === 1 ? '' : 's'}`,
      });
      return written.length;
    };

    const result = queueRef.current.then(work, work);
    queueRef.current = result.then(() => undefined, () => undefined);
    return result.catch((error) => {
      publishFrontierRuntimeHealth('source-forager', 'degraded', {
        message: error instanceof Error ? error.message.slice(0, 180) : 'source foraging failed',
      });
      return 0;
    });
  }, [evaluate, fetchHtml]);

  useEffect(() => () => {
    failPending('source-forager unmounted');
    workerRef.current?.terminate();
    workerRef.current = null;
    publishFrontierRuntimeHealth('source-forager', 'idle');
  }, [failPending]);

  return { consider };
}
