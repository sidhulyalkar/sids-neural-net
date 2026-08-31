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
  inferLongitudinalMeasurementQuality,
  inferLongitudinalTopicRates,
  inferLongitudinalTopicTrends,
  type LongitudinalMeasurementQuality,
  type LongitudinalRateEstimate,
  type LongitudinalTopicTrend,
} from '@/lib/frontier/longitudinalInference';
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

function samplingLabel(value: number): string {
  if (value >= 0.75) return 'well sampled';
  if (value >= 0.45) return 'moderately sampled';
  if (value >= 0.2) return 'early sample';
  return 'sparse sample';
}

function trendLabel(trend: LongitudinalTopicTrend): string {
  const arrow = trend.direction === 'rising' ? '↑' : trend.direction === 'cooling' ? '↓' : '·';
  return `${arrow} ${trend.key} · ${trend.windowDays}d detected-cue shift · q=${trend.qValue.toFixed(2)}`;
}

function measurementLabel(measurement?: LongitudinalMeasurementQuality): string {
  if (!measurement) return 'not evaluated';
  if (measurement.status === 'supported') {
    return `${Math.round((measurement.reviewAgreement ?? 0) * 100)}% agreement · ${measurement.reviewed} reviewed`;
  }
  if (measurement.status === 'questionable') {
    return `precision gate failed · ${measurement.reviewed} reviewed`;
  }
  return `${measurement.reviewed}/8 reviews before trend claims`;
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
  const [rates, setRates] = useState<LongitudinalRateEstimate[]>([]);
  const [trends, setTrends] = useState<LongitudinalTopicTrend[]>([]);
  const [measurement, setMeasurement] = useState<LongitudinalMeasurementQuality>();
  const [health, setHealth] = useState<LongitudinalStorageHealth>();
  const [mood, setMood] = useState<LongitudinalScale>(3);
  const [energy, setEnergy] = useState<LongitudinalScale>(3);
  const [focus, setFocus] = useState<LongitudinalScale>(3);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const importInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextSummary, nextHealth, archive] = await Promise.all([
        frontierLongitudinalStore.summary(90),
        frontierLongitudinalStore.storageHealth(),
        frontierLongitudinalStore.exportArchive(),
      ]);
      setSummary(nextSummary);
      setHealth(nextHealth);
      setRates(inferLongitudinalTopicRates(archive, 90));
      setTrends(inferLongitudinalTopicTrends(archive, 14));
      setMeasurement(inferLongitudinalMeasurementQuality(archive, 90));
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

  const topTopics = rates.slice(0, 6);
  const activeTrends = trends
    .filter((trend) => trend.direction === 'rising' || trend.direction === 'cooling')
    .slice(0, 4);
  const topLanes = summary?.topLanes.slice(0, 4) ?? [];
  const quotaRatio = health?.usage !== undefined && health.quota
    ? Math.min(1, health.usage / health.quota)
    : undefined;
  const noTrendExplanation = measurement?.status === 'unvalidated'
    ? 'Change claims are withheld until at least 8 detected cues are reviewed. Agreement estimates detected-cue precision only; it cannot measure reactions the camera missed.'
    : measurement?.status === 'questionable'
      ? 'Change claims are withheld because reviewed detected cues do not currently clear the 65% precision gate.'
      : 'No 14-day detected-cue shift clears 10m exposure per window, two-day replication, four events, a 35% effect, and Benjamini–Hochberg q ≤ 0.10.';

  return (
    <section className={styles.lens} aria-label="Longitudinal personal observation">
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}><Database size={12} /> Longitudinal cortex</span>
          <h2>How your responses change</h2>
          <p>Descriptive measurements over time. Facial cues are noisy observables, never ground-truth mood, personality, preference, or causal evidence.</p>
        </div>
        <span className={styles.local}><ShieldCheck size={11} /> local only</span>
      </div>

      <div className={styles.metrics}>
        <div><span>Attributed camera-on exposure</span><strong>{formatMinutes(summary?.exposureMs ?? 0)}</strong></div>
        <div><span>Detected cue episodes</span><strong>{summary?.reactions ?? 0}</strong></div>
        <div><span>Detected-cue precision</span><strong>{measurementLabel(measurement)}</strong></div>
        <div><span>Explicit interactions</span><strong>{summary?.explicitInteractions ?? 0}</strong></div>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>Subinterest detected-cue rate</span><small>90-day empirical-Bayes rate · 95% credible interval · descriptive, not causal</small></div>
          </div>
          {topTopics.length ? (
            <div className={styles.topicList}>
              {topTopics.map((topic) => (
                <div className={styles.topic} key={topic.key}>
                  <div>
                    <strong>{topic.key}</strong>
                    <small>
                      {topic.reactions} detected cues · {formatMinutes(topic.exposureMs)} attributed exposure across {topic.observedDays}d · 95% CI {topic.lowerPer10Min.toFixed(1)}–{topic.upperPer10Min.toFixed(1)}/10m · {samplingLabel(topic.evidenceStrength)}
                    </small>
                  </div>
                  <span>{topic.ratePer10Min.toFixed(1)} / 10m</span>
                </div>
              ))}
            </div>
          ) : <p className={styles.empty}>Not enough attributed exposure yet. FRONTIER abstains rather than inventing a pattern.</p>}
          {activeTrends.length ? (
            <div className={styles.laneRow} aria-label="Multiplicity-controlled detected cue trends">
              {activeTrends.map((trend) => <span key={trend.key}>{trendLabel(trend)}</span>)}
            </div>
          ) : topTopics.length ? <p className={styles.help}>{noTrendExplanation}</p> : null}
          {topLanes.length ? (
            <div className={styles.laneRow}>
              {topLanes.map((lane) => <span key={lane.key}>{laneLabel(lane.key)} · {lane.reactivityPer10Min.toFixed(1)}/10m raw detected cues</span>)}
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
            <p className={styles.help}>After several check-ins, FRONTIER can compare your own labels with observable behavior. It will not infer an internal state from facial motion.</p>
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
      <p className={styles.footnote}>Stored camera-derived records contain content context, attributed camera-on exposure, sparse cue class, confidence, timing, and your correction. Frames, face landmarks, biometric templates, identity embeddings, and raw expression streams are never written to this database or cloud memory. Topic rates use a unique-population empirical prior rather than multiplying observations by tag count. Trend claims require reviewed detected-cue precision, exposure in both windows, replication across days, event support, a material effect, and multiplicity control. These are observational associations, not latent-interest estimates or causal claims; the next measurement tranche will separately quantify sensor-observable face time so camera occlusion cannot masquerade as reduced reactivity.</p>
    </section>
  );
}
