'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Link2, Radio, Unplug } from 'lucide-react';
import {
  FRONTIER_RUNTIME_HEALTH_EVENT,
  frontierRuntimeHealthSnapshot,
  type FrontierRuntimeHealth,
} from '@/lib/frontier/runtime/runtimeHealth';
import { validateLocalSignalSocketUrl } from '@/lib/frontier/signals/signalBridge';
import {
  readFrontierSignalBridgeConfig,
  writeFrontierSignalBridgeConfig,
} from '@/lib/frontier/signals/signalConfig';
import {
  FRONTIER_MESH_RESPONSE_EVENT,
  dispatchFrontierMeshCommand,
  type FrontierMeshResponse,
} from '@/lib/frontier/sync/meshCommands';
import styles from './frontier-experience.module.css';

export function FrontierRuntimeControls() {
  const [healthVersion, setHealthVersion] = useState(0);
  const [signalEnabled, setSignalEnabled] = useState(false);
  const [signalUrl, setSignalUrl] = useState('ws://localhost:8787');
  const [incomingCode, setIncomingCode] = useState('');
  const [outgoingCode, setOutgoingCode] = useState('');
  const [message, setMessage] = useState<string>();

  const health = useMemo(() => {
    void healthVersion;
    return frontierRuntimeHealthSnapshot();
  }, [healthVersion]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const config = readFrontierSignalBridgeConfig();
      setSignalEnabled(Boolean(config.enabled));
      if (config.url) setSignalUrl(config.url);
    });

    const onHealth = (_event: Event) => setHealthVersion((version) => version + 1);
    const onMeshResponse = (event: Event) => {
      const response = (event as CustomEvent<FrontierMeshResponse>).detail;
      if (!response) return;
      if (response.error) {
        setMessage(response.error);
        return;
      }
      if (response.payload) setOutgoingCode(response.payload);
      if (response.action === 'create-offer') setMessage('Offer ready. Copy it to the second browser.');
      else if (response.action === 'accept-offer') setMessage('Answer ready. Copy it back to the first browser.');
      else if (response.action === 'accept-answer') setMessage('Pairing answer accepted.');
      else if (response.action === 'close') setMessage('Peer disconnected. Local memory is unchanged.');
    };

    window.addEventListener(FRONTIER_RUNTIME_HEALTH_EVENT, onHealth);
    window.addEventListener(FRONTIER_MESH_RESPONSE_EVENT, onMeshResponse);
    return () => {
      cancelled = true;
      window.removeEventListener(FRONTIER_RUNTIME_HEALTH_EVENT, onHealth);
      window.removeEventListener(FRONTIER_MESH_RESPONSE_EVENT, onMeshResponse);
    };
  }, []);

  const saveSignal = () => {
    try {
      if (signalEnabled) validateLocalSignalSocketUrl(signalUrl);
      writeFrontierSignalBridgeConfig({ enabled: signalEnabled, url: signalUrl });
      setMessage(signalEnabled ? 'Local signal relay configured.' : 'Local signal relay disabled.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save local signal relay.');
    }
  };

  const copyOutgoing = async () => {
    if (!outgoingCode) return;
    try {
      await navigator.clipboard.writeText(outgoingCode);
      setMessage('Pairing code copied.');
    } catch {
      setMessage('Clipboard unavailable. Select and copy the code manually.');
    }
  };

  const sendIncoming = (action: 'accept-offer' | 'accept-answer') => {
    const payload = incomingCode.trim();
    if (!payload) {
      setMessage(action === 'accept-offer' ? 'Paste the first browser offer.' : 'Paste the second browser answer.');
      return;
    }
    setMessage(action === 'accept-offer' ? 'Building pairing answer…' : 'Finishing pairing…');
    dispatchFrontierMeshCommand({ action, payload });
  };

  return (
    <details className={`${styles.dataMenu} ${styles.runtimeMenu}`}>
      <summary>Local</summary>
      <div className={`${styles.dataMenuPanel} ${styles.runtimePanel}`}>
        <section className={styles.runtimeGroup} aria-label="FRONTIER local runtime health">
          <div className={styles.runtimeHeading}>
            <span>runtime</span>
            <strong>{health.overall}</strong>
          </div>
          <div className={styles.runtimeHealthList}>
            {health.entries.length ? health.entries.map((entry: FrontierRuntimeHealth) => (
              <span key={entry.subsystem} title={entry.message ?? entry.status}>
                {entry.subsystem.replace('-', ' ')} · {entry.status}
              </span>
            )) : <span>local subsystems start on demand</span>}
          </div>
        </section>

        <section className={styles.runtimeGroup} aria-label="FRONTIER peer pairing">
          <div className={styles.runtimeHeading}><span>peer memory</span><Link2 size={11} /></div>
          <p className={styles.runtimeHint}>A: create offer → B: accept offer → A: finish answer. Codes stay between the two browsers.</p>
          <div className={styles.runtimeActions}>
            <button
              type="button"
              className={styles.utilityButton}
              onClick={() => {
                setOutgoingCode('');
                setMessage('Building pairing offer…');
                dispatchFrontierMeshCommand({ action: 'create-offer' });
              }}
            ><Link2 size={11} /> Create offer</button>
            <button type="button" className={styles.utilityButton} onClick={() => dispatchFrontierMeshCommand({ action: 'close' })}>
              <Unplug size={11} /> Disconnect
            </button>
          </div>
          <textarea
            className={styles.runtimeCode}
            value={incomingCode}
            onChange={(event) => setIncomingCode(event.target.value)}
            placeholder="Paste peer offer or answer"
            aria-label="Peer pairing input"
            spellCheck={false}
          />
          <div className={styles.runtimeActions}>
            <button type="button" className={styles.utilityButton} onClick={() => sendIncoming('accept-offer')}>Accept offer</button>
            <button type="button" className={styles.utilityButton} onClick={() => sendIncoming('accept-answer')}>Finish answer</button>
          </div>
          {outgoingCode ? (
            <div className={styles.runtimeOutput}>
              <textarea className={styles.runtimeCode} readOnly value={outgoingCode} aria-label="Peer pairing output" />
              <button type="button" className={styles.utilityButton} onClick={() => void copyOutgoing()}><Copy size={11} /> Copy</button>
            </div>
          ) : null}
        </section>

        <section className={styles.runtimeGroup} aria-label="FRONTIER local signal relay">
          <div className={styles.runtimeHeading}><span>signal relay</span><Radio size={11} /></div>
          <p className={styles.runtimeHint}>Optional localhost WebSocket only. Used as a generic non-diagnostic signal-load proxy.</p>
          <label className={styles.runtimeToggle}>
            <input type="checkbox" checked={signalEnabled} onChange={(event) => setSignalEnabled(event.target.checked)} />
            enabled
          </label>
          <input
            className={styles.runtimeInput}
            value={signalUrl}
            onChange={(event) => setSignalUrl(event.target.value)}
            placeholder="ws://localhost:8787"
            aria-label="Local signal WebSocket URL"
            spellCheck={false}
          />
          <button type="button" className={styles.utilityButton} onClick={saveSignal}><Radio size={11} /> Apply</button>
        </section>

        {message ? <div className={styles.runtimeMessage} role="status">{message}</div> : null}
      </div>
    </details>
  );
}
