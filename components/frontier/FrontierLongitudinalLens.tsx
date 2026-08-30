'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Database, Download, ShieldCheck, Upload } from 'lucide-react';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import {
  createLongitudinalCheckin,
  frontierLongitudinalStore,
  FRONTIER_LONGITUDINAL_CHANGE_EVENT,
  LONGITUDINAL_RAW_RETENTION_DAYS,
  type LongitudinalScale,
  type LongitudinalStorageHealth,
  type LongitudinalSummary,
} from '@/lib/frontier/longitudinal';
import {
  createFrontierLocalArchive,
  parseFrontierLocalArchive,
  restoreFrontierLocalArchive,
} from '@/lib/frontier/localArchive';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierLaneId } from '@/lib/frontier/types';
import styles from './frontier-longitudinal.module.css';

function formatBytes(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return 'unknown';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMinutes(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 1) return `${Math.round(ms / 1000)}s`;
  if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function laneLabel(value: string): string {
  return FRONTIER_LANE_MAP[value as FrontierLaneId]?.shortLabel ?? value.replaceAll('_', ' ');
}

function ScaleInput({ label, value, onChange }: {
  label: string;
  value: LongitudinalScale;
  onChange: (value: LongitudinalScale) => void;
}) {
  return (
    <label className={styles.scale}>
      <span>{label}</span>
      <input
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value) as LongitudinalScale)}
        aria-label={`${label} ${value} of 5`}
      />
      <strong>{value}</strong>
    </label>
  );
}

export function FrontierLongitudinalLens() {
  const [summary, setSummary] = useState<LongitudinalSummary>();
  const [health, setHealth] = useState<LongitudinalStorageHealth>();
  const [mood, setMood] = useState<LongitudinalScale>(3);
  const [energy, setEnergy] = useState<LongitudinalScale>(3);
  const [focus, setFocus] = useState<LongitudinalScale>(3);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const importInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextSummary, nextHealth] = await Promise.all([
        frontierLongitudinalStore.summary(90),
        frontierLongitudinalStore.storageHealth(),
      ]);
      setSummary(nextSummary);
      setHealth(nextHealth);
    } catch {
      setHealth({ supported: false });
    }
  }, []);

  useEffect(() => {
    void frontierLongitudinalStore.compact().catch(() => undefined).finally(() => void refresh());
    const changed = () => void refresh();
    window.addEventListener(FRONTIER_LONGITUDINAL_CHANGE_EVENT, changed);
    return () => window.removeEventListener(FRONTIER_LONGITUDINAL_CHANGE_EVENT, changed);
  }, [refresh]);

  const saveCheckin = async () => {
    setBusy(true);
    try {
      await frontierLongitudinalStore.recordCheckin(createLongitudinalCheckin(mood, energy, focus));
      setMessage('Self-report saved locally. It is a label for later comparison, not a camera inference.');
    } catch {
      setMessage('Local longitudinal storage is unavailable in this browser.');
    } finally {
      setBusy(false);
    }
  };

  const protectStorage = async () => {
    setBusy(true);
    const persisted = await frontierLongitudinalStore.requestPersistence();
    setMessage(persisted
      ? 'Browser persistence granted. Explicit site-data clearing can still remove local memory.'
      : 'The browser did not grant persistent storage. Export a private archive for durable backup.');
    await refresh();
    setBusy(false);
  };

  const exportArchive = async () => {
    setBusy(true);
    try {
      const archive = await createFrontierLocalArchive(useFrontierStore.getState());
      const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `frontier-private-archive-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Private archive exported with profile, cue trust, and longitudinal memory.');
    } catch {
      setMessage('Could not export the private archive.');
    } finally {
      setBusy(false);
    }
  };

  const importArchive = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const archive = parseFrontierLocalArchive(JSON.parse(await file.text()) as unknown);
      if (!archive) {
        setMessage('That file is not a compatible private FRONTIER archive.');
        return;
      }
      if (!window.confirm('Replace local longitudinal memory, reaction calibration, and FRONTIER profile with this private archive?')) return;
      const restored = await restoreFrontierLocalArchive(archive, useFrontierStore.getState().importBackup);
      setMessage(restored ? 'Private archive restored.' : 'Archive restore failed validation.');
      if (restored) await refresh();
    } catch {
      setMessage('Could not read that private FRONTIER archive.');
    } finally {
      if (importInput.current) importInput.current.value = '';
      setBusy(false);
    }
  };

  const reviewed = summary?.reviewed ?? 0;
  const agreement = summary?.reviewAgreement;
  const topTopics = summary?.topTopics.slice(0, 6) ?? [];
  const topLanes = summary?.topLanes.slice(0, 4) ?? [];
  const quotaRatio = health?.usage !== undefined && health.quota
    ? Math.min(1, health.usage / health.quota)
    : undefined;

  return (
    <section className={styles.lens} aria-label="Longitudinal personal observation">
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}><Database size={12} /> Longitudinal cortex</span>
          <h2>How your responses change</h2>
          <p>Observable patterns over time. Facial cues are treated as noisy measurements, never as ground-truth mood or personality labels.</p>
        </div>
        <span className={styles.local}><ShieldCheck size={11} /> local only</span>
      </div>

      <div className={styles.metrics}>
        <div><span>Qualified camera exposure</span><strong>{formatMinutes(summary?.exposureMs ?? 0)}</strong></div>
        <div><span>Reaction episodes</span><strong>{summary?.reactions ?? 0}</strong></div>
        <div><span>Cue agreement</span><strong>{reviewed ? `${Math.round((agreement ?? 0) * 100)}%` : 'unrated'}</strong></div>
        <div><span>Explicit interactions</span><strong>{summary?.explicitInteractions ?? 0}</strong></div>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>Subinterest reactivity</span><small>90-day exposure-normalized view</small></div>
          </div>
          {topTopics.length ? (
            <div className={styles.topicList}>
              {topTopics.map((topic) => (
                <div className={styles.topic} key={topic.key}>
                  <div><strong>{topic.key}</strong><small>{topic.reactions} reactions · {formatMinutes(topic.exposureMs)} qualified exposure</small></div>
                  <span>{topic.reactivityPer10Min.toFixed(1)} / 10m</span>
                </div>
              ))}
            </div>
          ) : <p className={styles.empty}>Not enough qualified exposure yet. FRONTIER abstains rather than inventing a pattern.</p>}
          {topLanes.length ? (
            <div className={styles.laneRow}>
              {topLanes.map((lane) => <span key={lane.key}>{laneLabel(lane.key)} · {lane.reactivityPer10Min.toFixed(1)}/10m</span>)}
            </div>
          ) : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>Optional state label</span><small>self-report, not facial inference</small></div>
          </div>
          <div className={styles.scales}>
            <ScaleInput label="Mood" value={mood} onChange={setMood} />
            <ScaleInput label="Energy" value={energy} onChange={setEnergy} />
            <ScaleInput label="Focus" value={focus} onChange={setFocus} />
          </div>
          <button type="button" className={styles.primary} disabled={busy} onClick={() => void saveCheckin()}>Save check-in</button>
          {summary && summary.checkins >= 3 && summary.selfReported ? (
            <p className={styles.selfReport}>90d self-report mean · mood {summary.selfReported.mood.toFixed(1)} · energy {summary.selfReported.energy.toFixed(1)} · focus {summary.selfReported.focus.toFixed(1)}</p>
          ) : (
            <p className={styles.help}>After several check-ins, we can compare your own labels with content choices and reactivity without pretending the camera knows your internal state.</p>
          )}
        </div>
      </div>

      <div className={styles.storage}>
        <div className={styles.storageText}>
          <span><Archive size={12} /> Local data vault</span>
          <small>
            {LONGITUDINAL_RAW_RETENTION_DAYS}d high-resolution retention, then compactable day/topic/lane rollups · origin storage {formatBytes(health?.usage)}{health?.quota ? ` / ${formatBytes(health.quota)}` : ''} · {health?.persisted ? 'persistent' : 'best effort'}
          </small>
          {quotaRatio !== undefined ? <div className={styles.quota}><i style={{ width: `${Math.round(quotaRatio * 100)}%` }} /></div> : null}
        </div>
        <div className={styles.actions}>
          {health?.supported && !health.persisted ? <button type="button" disabled={busy} onClick={() => void protectStorage()}><ShieldCheck size={11} /> Protect</button> : null}
          <button type="button" disabled={busy} onClick={() => void exportArchive()}><Download size={11} /> Private archive</button>
          <button type="button" disabled={busy} onClick={() => importInput.current?.click()}><Upload size={11} /> Restore</button>
          <input ref={importInput} type="file" accept="application/json" hidden onChange={(event) => void importArchive(event.target.files?.[0])} />
        </div>
      </div>

      {message ? <p className={styles.message}>{message}</p> : null}
      <p className={styles.footnote}>Stored camera-derived records contain content context, exposure duration, sparse cue class, confidence, timing, and your correction. Frames, face landmarks, biometric templates, identity embeddings, and raw expression streams are never written to this database or cloud memory.</p>
    </section>
  );
}
