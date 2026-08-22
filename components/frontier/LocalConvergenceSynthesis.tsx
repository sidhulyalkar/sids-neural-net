'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Cpu, LoaderCircle, RotateCcw, X } from 'lucide-react';
import {
  frontierLocalSynthesisSupported,
  frontierSynthesisEvidence,
  parseFrontierLocalSynthesis,
  type FrontierLocalSynthesis,
} from '@/lib/frontier/synthesis/localSynthesis';
import {
  createFrontierSynthesisWorker,
  type FrontierSynthesisWorkerResponse,
} from '@/lib/frontier/synthesis/synthesisWorker';
import type { FrontierItem } from '@/lib/frontier/types';
import styles from './frontier-local-synthesis.module.css';

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; progress: number; text: string; model?: string }
  | { kind: 'ready'; synthesis: FrontierLocalSynthesis; model: string }
  | { kind: 'error'; reason: string }
  | { kind: 'unsupported'; reason: string };

export function LocalConvergenceSynthesis({ item }: { item: FrontierItem }) {
  const evidence = useMemo(() => frontierSynthesisEvidence(item), [item]);
  const workerRef = useRef<Worker>();
  const requestRef = useRef<string>();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [capabilityChecked, setCapabilityChecked] = useState(false);

  useEffect(() => {
    setCapabilityChecked(true);
    if (!frontierLocalSynthesisSupported()) {
      setState({ kind: 'unsupported', reason: 'WebGPU local inference is unavailable on this browser.' });
    }
    return () => {
      const worker = workerRef.current;
      workerRef.current = undefined;
      if (worker) {
        try { worker.postMessage({ type: 'dispose' }); } catch { /* worker already gone */ }
        worker.terminate();
      }
    };
  }, []);

  if (evidence.length < 3) return null;

  const stopWorker = () => {
    const worker = workerRef.current;
    workerRef.current = undefined;
    requestRef.current = undefined;
    if (worker) {
      try { worker.postMessage({ type: 'dispose' }); } catch { /* worker already gone */ }
      worker.terminate();
    }
  };

  const synthesize = () => {
    stopWorker();
    if (!frontierLocalSynthesisSupported()) {
      setState({ kind: 'unsupported', reason: 'WebGPU local inference is unavailable on this browser.' });
      return;
    }

    try {
      const worker = createFrontierSynthesisWorker();
      const requestId = `${item.id}:${Date.now().toString(36)}`;
      workerRef.current = worker;
      requestRef.current = requestId;
      setState({ kind: 'loading', progress: 0, text: 'Starting local WebGPU worker' });

      worker.onmessage = (event: MessageEvent<FrontierSynthesisWorkerResponse>) => {
        const message = event.data;
        if ('requestId' in message && message.requestId !== requestRef.current) return;
        if (message.type === 'progress') {
          setState({
            kind: 'loading',
            progress: message.progress,
            text: message.text,
            model: message.model,
          });
          return;
        }
        if (message.type === 'unsupported') {
          stopWorker();
          setState({ kind: 'unsupported', reason: message.reason });
          return;
        }
        if (message.type === 'error') {
          stopWorker();
          setState({ kind: 'error', reason: message.reason });
          return;
        }
        if (message.type === 'result') {
          const parsed = parseFrontierLocalSynthesis(message.raw, evidence.length);
          if (!parsed) {
            stopWorker();
            setState({
              kind: 'error',
              reason: 'The local model response failed FRONTIER’s strict three-bullet grounding contract.',
            });
            return;
          }
          setState({ kind: 'ready', synthesis: parsed, model: message.model });
        }
      };
      worker.onerror = () => {
        stopWorker();
        setState({
          kind: 'error',
          reason: 'The local synthesis worker stopped. Grounded source evidence remains unchanged.',
        });
      };
      worker.postMessage({ type: 'synthesize', requestId, evidence });
    } catch (error) {
      stopWorker();
      setState({ kind: 'error', reason: error instanceof Error ? error.message : 'Unable to start local synthesis.' });
    }
  };

  const cancel = () => {
    stopWorker();
    setState({ kind: 'idle' });
  };

  return (
    <section
      className={styles.panel}
      data-frontier-local-synthesis="opt-in"
      aria-label="Local convergence synthesis"
    >
      <div className={styles.header}>
        <span><Cpu size={11} /> Local synthesis</span>
        <small>presentation only · never ranking input</small>
      </div>

      {!capabilityChecked ? (
        <p className={styles.note}>Checking local WebGPU capability…</p>
      ) : state.kind === 'idle' ? (
        <div className={styles.optIn}>
          <p>Compare {evidence.length} grounded sources locally. First use downloads a small quantized model into browser-managed cache.</p>
          <button type="button" onClick={synthesize}>Synthesize locally</button>
        </div>
      ) : state.kind === 'loading' ? (
        <div className={styles.loading} aria-live="polite">
          <div className={styles.progressTrack} aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.max(0.02, state.progress)})` }} />
          </div>
          <p><LoaderCircle size={11} /> {state.text}</p>
          {state.model ? <small>{state.model}</small> : null}
          <button type="button" onClick={cancel}><X size={10} /> Cancel</button>
        </div>
      ) : state.kind === 'ready' ? (
        <div className={styles.result}>
          <div className={styles.generatedLabel}>Generated on this device · {state.model}</div>
          <ul>
            {state.synthesis.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
          <button type="button" onClick={synthesize}><RotateCcw size={10} /> Re-synthesize</button>
        </div>
      ) : state.kind === 'unsupported' ? (
        <p className={styles.note}>{state.reason} Converging source evidence remains available below.</p>
      ) : (
        <div className={styles.error}>
          <p>{state.reason}</p>
          <button type="button" onClick={synthesize}><RotateCcw size={10} /> Retry locally</button>
        </div>
      )}
    </section>
  );
}
