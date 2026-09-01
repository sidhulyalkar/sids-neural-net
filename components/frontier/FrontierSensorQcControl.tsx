'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Download, Play, Square, Trash2, X } from 'lucide-react';
import {
  FRONTIER_SENSOR_QC_TRIALS,
  clearSensorQcArchive,
  downloadSensorQcReport,
  finishSensorQcTrial,
  getSensorQcSnapshot,
  sensorQcSetForeground,
  startSensorQcSession,
  startSensorQcTrial,
  stopSensorQcSession,
  subscribeSensorQc,
  type SensorQcSnapshot,
  type SensorQcTrialLabel,
} from '@/lib/frontier/sensorQc';
import styles from './frontier-sensor-qc.module.css';

const TRIAL_LABELS: Record<SensorQcTrialLabel, string> = {
  neutral_reading: 'Neutral reading',
  interesting_reading: 'Interesting reading',
  positive_expression: 'Deliberate positive cue',
  novelty_surprise: 'Deliberate novelty / surprise',
  concentrated_reading: 'Concentrated reading',
  low_engagement: 'Low engagement',
  looking_away: 'Looking away',
  rapid_scrolling: 'Rapid scrolling',
  two_card_ambiguity: 'Two-card ambiguity',
  lighting_head_position: 'Lighting / head position',
  background_tab: 'Background tab',
  natural_browsing: 'Natural browsing',
};

function pct(value?: number): string {
  return value === undefined || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)}%`;
}

function duration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  return `${(ms / 60_000).toFixed(ms < 600_000 ? 1 : 0)}m`;
}

export function FrontierSensorQcControl() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SensorQcTrialLabel>('neutral_reading');
  const [snapshot, setSnapshot] = useState<SensorQcSnapshot>(() => getSensorQcSnapshot());
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMounted(true);
    const refresh = () => setSnapshot(getSensorQcSnapshot());
    refresh();
    const unsubscribe = subscribeSensorQc(refresh);
    const timer = window.setInterval(refresh, 500);
    const visibility = () => {
      sensorQcSetForeground(document.visibilityState === 'visible');
      refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const current = snapshot.activeTrial;
  const cues = useMemo(() => current
    ? current.cues.affinity + current.cues.interest + current.cues.surprise + current.cues.friction
    : 0, [current]);

  const startSession = () => {
    startSensorQcSession();
    setSnapshot(getSensorQcSnapshot());
    setMessage('QC session started. Camera access is still controlled separately.');
  };

  const stopSession = () => {
    stopSensorQcSession();
    setSnapshot(getSensorQcSnapshot());
    setMessage('QC session saved locally. Export the aggregate report when ready.');
  };

  const beginTrial = () => {
    const trial = startSensorQcTrial(selected);
    setSnapshot(getSensorQcSnapshot());
    setMessage(trial ? `${TRIAL_LABELS[selected]} trial running.` : 'Start a QC session first.');
  };

  const endTrial = () => {
    finishSensorQcTrial();
    setSnapshot(getSensorQcSnapshot());
    setMessage('Trial saved locally. Choose the next condition when ready.');
  };

  const exportReport = () => {
    downloadSensorQcReport();
    setMessage('Aggregate QC report exported. It contains no card ids, URLs, titles, frames, landmarks, or raw expression data.');
  };

  const clear = () => {
    if (!window.confirm('Delete all local Sensor QC sessions and trials? This does not clear the rest of FRONTIER memory.')) return;
    clearSensorQcArchive();
    setSnapshot(getSensorQcSnapshot());
    setMessage('Sensor QC archive cleared.');
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${snapshot.active ? styles.triggerActive : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label="Open Sensor QC"
        aria-expanded={open}
        title="Sensor QC"
      >
        <Activity size={12} aria-hidden="true" />
      </button>

      {mounted && open ? createPortal(
        <aside className={styles.panel} aria-label="FRONTIER Sensor QC">
          <div className={styles.head}>
            <div>
              <span className={styles.eyebrow}>Sensor QC · local experiment</span>
              <strong>Measure the ruler</strong>
            </div>
            <button type="button" className={styles.iconButton} onClick={() => setOpen(false)} aria-label="Close Sensor QC"><X size={13} /></button>
          </div>

          <p className={styles.intro}>You declare the condition. FRONTIER records only aggregate coverage, attribution, cue, gap, and correction counters for that interval. QC has zero recommendation authority.</p>

          <div className={styles.sessionRow}>
            <span className={snapshot.active ? styles.live : styles.idle}>{snapshot.active ? 'SESSION LIVE' : 'SESSION OFF'}</span>
            {!snapshot.active ? (
              <button type="button" className={styles.primary} onClick={startSession}><Play size={11} /> Start QC</button>
            ) : (
              <button type="button" className={styles.secondary} onClick={stopSession}><Square size={10} /> Stop session</button>
            )}
          </div>

          <label className={styles.condition}>
            <span>Declared condition</span>
            <select value={selected} disabled={!snapshot.active || Boolean(current)} onChange={(event) => setSelected(event.target.value as SensorQcTrialLabel)}>
              {FRONTIER_SENSOR_QC_TRIALS.map((label) => <option value={label} key={label}>{TRIAL_LABELS[label]}</option>)}
            </select>
          </label>

          {snapshot.active ? (
            <div className={styles.trialRow}>
              {current ? (
                <button type="button" className={styles.primary} onClick={endTrial}><Square size={10} /> End trial</button>
              ) : (
                <button type="button" className={styles.primary} onClick={beginTrial}><Play size={11} /> Begin trial</button>
              )}
              <span>{current ? `${TRIAL_LABELS[current.label]} · ${duration(current.durationMs)}` : 'No active trial'}</span>
            </div>
          ) : null}

          {current ? (
            <div className={styles.metrics} aria-label="Live Sensor QC metrics">
              <div><span>Callback coverage</span><strong>{pct(current.sampleCoverage)}</strong></div>
              <div><span>Face observable</span><strong>{pct(current.faceCoverage)}</strong></div>
              <div><span>Target attributed</span><strong>{pct(current.targetAttributionCoverage)}</strong></div>
              <div><span>Face + target</span><strong>{pct(current.jointCoverage)}</strong></div>
              <div><span>Cues</span><strong>{cues}</strong></div>
              <div><span>Reviewed precision</span><strong>{pct(current.reviewAgreement)}</strong></div>
              <div><span>Callback gaps</span><strong>{current.callbackGapCount}</strong></div>
              <div><span>Max gap</span><strong>{Math.round(current.maxCallbackGapMs)} ms</strong></div>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button type="button" onClick={exportReport}><Download size={11} /> Export aggregate JSON</button>
            <button type="button" onClick={clear}><Trash2 size={11} /> Clear QC</button>
          </div>

          <p className={styles.protocol}>Camera analysis is separately opt-in through the reaction-loop camera control. Starting QC never requests camera permission. For a background-tab trial, begin the trial first, switch away, then return and end it.</p>
          <p className={styles.privacy}>Export: trial labels + aggregate durations/counters only. No content ids, titles, URLs, video, frames, landmarks, identity embeddings, biometric templates, or raw expression vectors.</p>
          {message ? <p className={styles.message}>{message}</p> : null}
        </aside>,
        document.body
      ) : null}
    </>
  );
}
