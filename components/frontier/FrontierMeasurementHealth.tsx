'use client';

import { useSyncExternalStore } from 'react';
import {
  inferLongitudinalMeasurementQuality,
  inferLongitudinalTopicRates,
  inferLongitudinalTopicTrends,
  type LongitudinalMeasurementQuality,
  type LongitudinalRateEstimate,
  type LongitudinalTopicTrend,
  type LongitudinalTrendReason,
} from '@/lib/frontier/longitudinalInference';
import {
  FRONTIER_LONGITUDINAL_CHANGE_EVENT,
  frontierLongitudinalStore,
} from '@/lib/frontier/longitudinalStore';
import styles from './frontier-minimal.module.css';

type MeasurementSnapshot = {
  status: 'idle' | 'ready' | 'error';
  quality?: LongitudinalMeasurementQuality;
  rates: LongitudinalRateEstimate[];
  trends: LongitudinalTopicTrend[];
};

const EMPTY_SNAPSHOT: MeasurementSnapshot = { status: 'idle', rates: [], trends: [] };
let snapshot: MeasurementSnapshot = EMPTY_SNAPSHOT;
let refreshPromise: Promise<void> | undefined;
let browserWired = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

async function refresh(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const archive = await frontierLongitudinalStore.archive();
      snapshot = {
        status: 'ready',
        quality: inferLongitudinalMeasurementQuality(archive, 90),
        rates: inferLongitudinalTopicRates(archive, 90).slice(0, 4),
        trends: inferLongitudinalTopicTrends(archive, 14).slice(0, 8),
      };
    } catch {
      snapshot = { status: 'error', rates: [], trends: [] };
    } finally {
      refreshPromise = undefined;
      emit();
    }
  })();
  return refreshPromise;
}

function ensureBrowserWired(): void {
  if (browserWired || typeof window === 'undefined') return;
  browserWired = true;
  window.addEventListener(FRONTIER_LONGITUDINAL_CHANGE_EVENT, () => { void refresh(); });
  void refresh();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureBrowserWired();
  return () => listeners.delete(listener);
}

function getSnapshot(): MeasurementSnapshot {
  return snapshot;
}

function getServerSnapshot(): MeasurementSnapshot {
  return EMPTY_SNAPSHOT;
}

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function durationLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  const minutes = ms / 60_000;
  return minutes < 60 ? `${minutes.toFixed(minutes < 10 ? 1 : 0)}m` : `${(minutes / 60).toFixed(1)}h`;
}

function rateLabel(rate: LongitudinalRateEstimate): string {
  return `${rate.ratePer10Min.toFixed(2)} cues / 10m · 95% CrI ${rate.lowerPer10Min.toFixed(2)}–${rate.upperPer10Min.toFixed(2)}`;
}

function measurementLabel(quality: LongitudinalMeasurementQuality): string {
  if (quality.mode === 'none') return 'No measured exposure yet';
  if (quality.mode === 'legacy-v1') return 'Legacy exposure only';
  if (quality.mode === 'mixed') return 'Measurement transition';
  if (quality.status === 'supported') return 'v2 measurement supported';
  if (quality.status === 'questionable') return 'v2 detector needs correction';
  return 'v2 detector still calibrating';
}

function reasonLabel(reason: LongitudinalTrendReason): string {
  switch (reason) {
    case 'detected': return 'BH-screened Poisson-rate change detected';
    case 'sensor-uninstrumented': return 'Waiting for v2 sensor measurement';
    case 'measurement-transition': return 'Waiting for one consistent v2 measurement era';
    case 'sensor-sampling-low': return 'Inference callback coverage is too sparse';
    case 'face-observability-low': return 'Face-observable coverage is too sparse';
    case 'measurement-unvalidated': return 'Detected cues need more explicit review';
    case 'measurement-questionable': return 'Reviewed cue precision is below the claim gate';
    case 'low-exposure': return 'Not enough face-observable exposure';
    case 'single-day': return 'Evidence has not replicated across days';
    case 'few-events': return 'Too few detected cue episodes';
    case 'small-effect': return 'Observed shift is below the material-effect gate';
    case 'multiplicity': return 'Shift did not survive the BH multiplicity screen';
    case 'stable': return 'No material detected-cue shift';
  }
}

export function FrontierMeasurementHealth() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (data.status === 'idle') return null;

  if (data.status === 'error' || !data.quality) {
    return (
      <div className={styles.habitGrid} aria-label="Longitudinal measurement health">
        <div className={styles.habitCard}>
          <span>Measurement health</span>
          <strong>Local longitudinal store unavailable</strong>
          <div className={styles.confidenceTrack} title="This diagnostic failure does not alter ranking or preference memory."><div style={{ width: '0%' }} /></div>
        </div>
      </div>
    );
  }

  const quality = data.quality;
  const detectedTrend = data.trends.find((trend) => trend.direction === 'rising' || trend.direction === 'cooling');
  const blocker = data.trends[0];
  const precision = quality.reviewAgreement;

  return (
    <section aria-label="Longitudinal sensor measurement" style={{ marginTop: 18 }}>
      <div className={styles.learningSummary}>
        <span>Measurement · {measurementLabel(quality)}</span>
        {quality.mode === 'sensor-v2' || quality.mode === 'mixed' ? <span>{durationLabel(quality.faceObservableMs)} face-observable</span> : null}
        {quality.reviewed ? <span>{quality.reviewed} reviewed cues</span> : null}
      </div>

      <div className={styles.habitGrid}>
        <div className={styles.habitCard}>
          <span>Sensor sampling</span>
          <strong>{quality.mode === 'legacy-v1' ? 'Not instrumented in legacy data' : percent(quality.sensorSamplingCoverage)}</strong>
          <div className={styles.confidenceTrack} title="Bounded local vision-callback time divided by target-attributed wall time. Browser/model stalls are missingness, not exposure.">
            <div style={{ width: quality.mode === 'legacy-v1' ? '0%' : percent(quality.sensorSamplingCoverage) }} />
          </div>
        </div>

        <div className={styles.habitCard}>
          <span>Face observability</span>
          <strong>{quality.mode === 'legacy-v1' ? 'Not instrumented in legacy data' : percent(quality.faceObservability)}</strong>
          <div className={styles.confidenceTrack} title="Face-observable inference time divided by sampled inference time. Looking away, occlusion, or detection failure cannot count as a negative response.">
            <div style={{ width: quality.mode === 'legacy-v1' ? '0%' : percent(quality.faceObservability) }} />
          </div>
        </div>

        <div className={styles.habitCard}>
          <span>Detected-cue precision</span>
          <strong>{precision === undefined ? `${quality.reviewed} reviewed · not validated` : `${percent(precision)} across ${quality.reviewed} reviewed`}</strong>
          <div className={styles.confidenceTrack} title="Agreement estimates precision of cues you reviewed. It does not estimate missed-cue sensitivity or emotion accuracy.">
            <div style={{ width: precision === undefined ? '0%' : percent(precision) }} />
          </div>
        </div>

        <div className={styles.habitCard}>
          <span>Longitudinal claim</span>
          <strong>{detectedTrend
            ? `${detectedTrend.key} · cue rate ${detectedTrend.direction}`
            : blocker ? reasonLabel(blocker.reason) : 'Awaiting enough measured history'}</strong>
          <div className={styles.confidenceTrack} title="Exact conditional Poisson rate comparison with Benjamini-Hochberg adjustment across measurement-eligible topics. Calibration assumes Poisson-like cue counts; bursty overdispersion is a model limitation, not evidence of preference change.">
            <div style={{ width: detectedTrend ? percent(detectedTrend.evidenceStrength) : '0%' }} />
          </div>
        </div>
      </div>

      {data.rates.length ? (
        <div className={styles.habitGrid} aria-label="Descriptive detected-cue rates">
          {data.rates.slice(0, 3).map((rate) => (
            <div className={styles.habitCard} key={`cue-rate-${rate.key}`}>
              <span>{rate.key}</span>
              <strong>{rateLabel(rate)}</strong>
              <div className={styles.confidenceTrack} title={`Descriptive ${rate.measurementMode} Bayesian estimate. Zero ranking authority.`}>
                <div style={{ width: percent(rate.evidenceStrength) }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <p className={styles.micro} style={{ marginTop: 10 }}>
        Detected-cue rates are descriptive observations under measured exposure, not emotion, personality, or latent-preference estimates. Change flags use an exact conditional Poisson rate screen with BH adjustment after measurement-only eligibility; event-count and material-effect gates are applied afterward. Poisson calibration is not guaranteed for bursty overdispersed cues. This panel has zero recommendation-ranking authority.
      </p>
    </section>
  );
}
