import type { FrontierAmbientReactionKind } from './reaction';

export const FRONTIER_SENSOR_QC_SCHEMA = 'frontier-sensor-qc-v1' as const;
export const FRONTIER_SENSOR_QC_STORAGE_KEY = FRONTIER_SENSOR_QC_SCHEMA;
export const FRONTIER_SENSOR_QC_CHANGE_EVENT = 'frontier:sensor-qc-change';
export const FRONTIER_SENSOR_QC_MAX_SAMPLE_GAP_MS = 250;
export const FRONTIER_SENSOR_QC_MAX_SESSIONS = 50;
export const FRONTIER_SENSOR_QC_MAX_TRIALS_PER_SESSION = 64;

export const FRONTIER_SENSOR_QC_TRIALS = [
  'neutral_reading',
  'interesting_reading',
  'positive_expression',
  'novelty_surprise',
  'concentrated_reading',
  'low_engagement',
  'looking_away',
  'rapid_scrolling',
  'two_card_ambiguity',
  'lighting_head_position',
  'background_tab',
  'natural_browsing',
] as const;

export type SensorQcTrialLabel = typeof FRONTIER_SENSOR_QC_TRIALS[number];
export type SensorQcKindCounts = Record<FrontierAmbientReactionKind, number>;

export type SensorQcTrial = {
  id: string;
  label: SensorQcTrialLabel;
  startedAt: number;
  endedAt?: number;
  durationMs: number;
  callbackSamples: number;
  sensorSampledMs: number;
  faceObservableMs: number;
  feedSampledMs: number;
  targetAttributedMs: number;
  jointFaceTargetMs: number;
  ambiguousMultiCardMs: number;
  noTargetMs: number;
  callbackGapCount: number;
  maxCallbackGapMs: number;
  outOfOrderSamples: number;
  cues: SensorQcKindCounts;
  confirmed: SensorQcKindCounts;
  contradicted: SensorQcKindCounts;
  cueConfidenceSum: number;
  cueIntensitySum: number;
};

export type SensorQcSession = {
  id: string;
  startedAt: number;
  endedAt?: number;
  updatedAt: number;
  trials: SensorQcTrial[];
};

export type SensorQcArchive = {
  schema: typeof FRONTIER_SENSOR_QC_SCHEMA;
  sessions: SensorQcSession[];
};

export type SensorQcSample = {
  sampleAt: number;
  wallAt: number;
  foreground: boolean;
  feedActive: boolean;
  faceObservable: boolean;
  targetAttributed: boolean;
  visibleCandidates: number;
};

export type SensorQcTrialAccumulator = SensorQcTrial & { lastSampleAt?: number };
export type SensorQcTrialSnapshot = SensorQcTrial & {
  sampleCoverage?: number;
  faceCoverage?: number;
  targetAttributionCoverage?: number;
  jointCoverage?: number;
  reviewAgreement?: number;
  cueRatePerMinute?: number;
};
export type SensorQcSnapshot = {
  active: boolean;
  activeSession?: SensorQcSession;
  activeTrial?: SensorQcTrialSnapshot;
  completedSessions: number;
  completedTrials: number;
};
export type SensorQcExport = {
  schema: typeof FRONTIER_SENSOR_QC_SCHEMA;
  exportedAt: string;
  privacy: {
    aggregateOnly: true;
    contentIdentifiersIncluded: false;
    rawCameraDataIncluded: false;
  };
  summary: {
    sessions: number;
    trials: number;
    durationMs: number;
    sensorSampledMs: number;
    faceObservableMs: number;
    cues: number;
    reviewed: number;
  };
  sessions: SensorQcSession[];
};

type ActiveRuntime = {
  sessionId: string;
  trialId?: string;
  lastSampleAt?: number;
  foreground: boolean;
  hiddenSince?: number;
  hiddenMs: number;
  lastPersistAt: number;
};

const KINDS: FrontierAmbientReactionKind[] = ['affinity', 'interest', 'surprise', 'friction'];
let archiveCache: SensorQcArchive | undefined;
let runtime: ActiveRuntime | undefined;

function counts(): SensorQcKindCounts {
  return { affinity: 0, interest: 0, surprise: 0, friction: 0 };
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function validLabel(value: unknown): value is SensorQcTrialLabel {
  return typeof value === 'string' && (FRONTIER_SENSOR_QC_TRIALS as readonly string[]).includes(value);
}

function cleanCounts(value: unknown): SensorQcKindCounts {
  const source = value && typeof value === 'object' ? value as Partial<SensorQcKindCounts> : {};
  return {
    affinity: finite(source.affinity), interest: finite(source.interest),
    surprise: finite(source.surprise), friction: finite(source.friction),
  };
}

function cleanTrial(value: unknown): SensorQcTrial | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Partial<SensorQcTrial>;
  if (typeof source.id !== 'string' || !validLabel(source.label) || !Number.isFinite(source.startedAt)) return undefined;
  return {
    id: source.id,
    label: source.label,
    startedAt: source.startedAt as number,
    endedAt: Number.isFinite(source.endedAt) ? source.endedAt : undefined,
    durationMs: finite(source.durationMs),
    callbackSamples: finite(source.callbackSamples),
    sensorSampledMs: finite(source.sensorSampledMs),
    faceObservableMs: finite(source.faceObservableMs),
    feedSampledMs: finite(source.feedSampledMs),
    targetAttributedMs: finite(source.targetAttributedMs),
    jointFaceTargetMs: finite(source.jointFaceTargetMs),
    ambiguousMultiCardMs: finite(source.ambiguousMultiCardMs),
    noTargetMs: finite(source.noTargetMs),
    callbackGapCount: finite(source.callbackGapCount),
    maxCallbackGapMs: finite(source.maxCallbackGapMs),
    outOfOrderSamples: finite(source.outOfOrderSamples),
    cues: cleanCounts(source.cues),
    confirmed: cleanCounts(source.confirmed),
    contradicted: cleanCounts(source.contradicted),
    cueConfidenceSum: finite(source.cueConfidenceSum),
    cueIntensitySum: finite(source.cueIntensitySum),
  };
}

function emptyArchive(): SensorQcArchive {
  return { schema: FRONTIER_SENSOR_QC_SCHEMA, sessions: [] };
}

function loadArchive(): SensorQcArchive {
  if (archiveCache) return archiveCache;
  if (typeof window === 'undefined') return emptyArchive();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FRONTIER_SENSOR_QC_STORAGE_KEY) ?? 'null') as unknown;
    if (!parsed || typeof parsed !== 'object' || (parsed as { schema?: unknown }).schema !== FRONTIER_SENSOR_QC_SCHEMA) {
      archiveCache = emptyArchive();
      return archiveCache;
    }
    const raw = Array.isArray((parsed as { sessions?: unknown }).sessions)
      ? (parsed as { sessions: unknown[] }).sessions
      : [];
    const sessions: SensorQcSession[] = [];
    for (const candidate of raw.slice(-FRONTIER_SENSOR_QC_MAX_SESSIONS)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const source = candidate as Partial<SensorQcSession>;
      if (typeof source.id !== 'string' || !Number.isFinite(source.startedAt)) continue;
      const trials = Array.isArray(source.trials)
        ? source.trials.map(cleanTrial).filter((trial): trial is SensorQcTrial => Boolean(trial)).slice(-FRONTIER_SENSOR_QC_MAX_TRIALS_PER_SESSION)
        : [];
      sessions.push({
        id: source.id,
        startedAt: source.startedAt as number,
        endedAt: Number.isFinite(source.endedAt) ? source.endedAt : undefined,
        updatedAt: Number.isFinite(source.updatedAt) ? source.updatedAt as number : source.startedAt as number,
        trials,
      });
    }
    archiveCache = { schema: FRONTIER_SENSOR_QC_SCHEMA, sessions };
  } catch {
    archiveCache = emptyArchive();
  }
  return archiveCache;
}

function emit(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FRONTIER_SENSOR_QC_CHANGE_EVENT));
}

function persist(now = Date.now(), notify = true): void {
  if (typeof window === 'undefined') return;
  const archive = loadArchive();
  if (runtime) {
    const session = archive.sessions.find((candidate) => candidate.id === runtime?.sessionId);
    if (session) session.updatedAt = now;
  }
  try { window.localStorage.setItem(FRONTIER_SENSOR_QC_STORAGE_KEY, JSON.stringify(archive)); } catch { /* best effort */ }
  if (notify) emit();
}

function currentSession(): SensorQcSession | undefined {
  return runtime ? loadArchive().sessions.find((candidate) => candidate.id === runtime?.sessionId) : undefined;
}

function currentTrial(): SensorQcTrial | undefined {
  const session = currentSession();
  return runtime?.trialId ? session?.trials.find((candidate) => candidate.id === runtime?.trialId) : undefined;
}

function hiddenDuration(now: number): number {
  if (!runtime) return 0;
  return runtime.hiddenMs + (!runtime.foreground && runtime.hiddenSince !== undefined ? Math.max(0, now - runtime.hiddenSince) : 0);
}

function updateDuration(now = Date.now()): void {
  const trial = currentTrial();
  if (!trial) return;
  trial.durationMs = Math.max(0, now - trial.startedAt - hiddenDuration(now));
}

export function createSensorQcTrialAccumulator(label: SensorQcTrialLabel, startedAt = 0): SensorQcTrialAccumulator {
  return {
    id: 'test-trial', label, startedAt, durationMs: 0,
    callbackSamples: 0, sensorSampledMs: 0, faceObservableMs: 0,
    feedSampledMs: 0, targetAttributedMs: 0, jointFaceTargetMs: 0,
    ambiguousMultiCardMs: 0, noTargetMs: 0, callbackGapCount: 0,
    maxCallbackGapMs: 0, outOfOrderSamples: 0,
    cues: counts(), confirmed: counts(), contradicted: counts(),
    cueConfidenceSum: 0, cueIntensitySum: 0,
  };
}

export function observeSensorQcSample(state: SensorQcTrialAccumulator, sample: SensorQcSample): SensorQcTrialAccumulator {
  const next: SensorQcTrialAccumulator = {
    ...state,
    cues: { ...state.cues }, confirmed: { ...state.confirmed }, contradicted: { ...state.contradicted },
    callbackSamples: state.callbackSamples + 1,
  };
  if (!Number.isFinite(sample.sampleAt)) return next;
  if (next.lastSampleAt === undefined) {
    next.lastSampleAt = sample.sampleAt;
    return next;
  }
  const gap = sample.sampleAt - next.lastSampleAt;
  if (gap < 0) {
    next.outOfOrderSamples += 1;
    return next;
  }
  next.lastSampleAt = sample.sampleAt;
  next.maxCallbackGapMs = Math.max(next.maxCallbackGapMs, gap);
  if (gap > FRONTIER_SENSOR_QC_MAX_SAMPLE_GAP_MS) next.callbackGapCount += 1;
  if (!sample.foreground) return next;
  const credit = Math.min(gap, FRONTIER_SENSOR_QC_MAX_SAMPLE_GAP_MS);
  next.sensorSampledMs += credit;
  if (sample.faceObservable) next.faceObservableMs += credit;
  if (sample.feedActive) {
    next.feedSampledMs += credit;
    if (sample.targetAttributed) next.targetAttributedMs += credit;
    else next.noTargetMs += credit;
    if (sample.targetAttributed && sample.faceObservable) next.jointFaceTargetMs += credit;
    if (!sample.targetAttributed && Math.max(0, Math.floor(sample.visibleCandidates)) >= 2) next.ambiguousMultiCardMs += credit;
  }
  return next;
}

export function sensorQcTrialSnapshot(trial: SensorQcTrial): SensorQcTrialSnapshot {
  const reviewed = KINDS.reduce((sum, kind) => sum + trial.confirmed[kind] + trial.contradicted[kind], 0);
  const confirmed = KINDS.reduce((sum, kind) => sum + trial.confirmed[kind], 0);
  const cues = KINDS.reduce((sum, kind) => sum + trial.cues[kind], 0);
  return {
    ...trial,
    cues: { ...trial.cues }, confirmed: { ...trial.confirmed }, contradicted: { ...trial.contradicted },
    sampleCoverage: trial.durationMs > 0 ? Math.min(1, trial.sensorSampledMs / trial.durationMs) : undefined,
    faceCoverage: trial.sensorSampledMs > 0 ? Math.min(1, trial.faceObservableMs / trial.sensorSampledMs) : undefined,
    targetAttributionCoverage: trial.feedSampledMs > 0 ? Math.min(1, trial.targetAttributedMs / trial.feedSampledMs) : undefined,
    jointCoverage: trial.feedSampledMs > 0 ? Math.min(1, trial.jointFaceTargetMs / trial.feedSampledMs) : undefined,
    reviewAgreement: reviewed > 0 ? confirmed / reviewed : undefined,
    cueRatePerMinute: trial.durationMs > 0 ? cues / (trial.durationMs / 60_000) : undefined,
  };
}

export function startSensorQcSession(now = Date.now()): SensorQcSession {
  if (runtime) stopSensorQcSession(now);
  const archive = loadArchive();
  const session: SensorQcSession = { id: newId('qc-session'), startedAt: now, updatedAt: now, trials: [] };
  archive.sessions.push(session);
  archive.sessions = archive.sessions.slice(-FRONTIER_SENSOR_QC_MAX_SESSIONS);
  runtime = {
    sessionId: session.id,
    foreground: typeof document === 'undefined' || document.visibilityState === 'visible',
    hiddenSince: typeof document !== 'undefined' && document.visibilityState !== 'visible' ? now : undefined,
    hiddenMs: 0,
    lastPersistAt: now,
  };
  persist(now);
  return session;
}

export function stopSensorQcSession(now = Date.now()): SensorQcSession | undefined {
  if (!runtime) return undefined;
  finishSensorQcTrial(now);
  const session = currentSession();
  if (session) {
    session.endedAt = now;
    session.updatedAt = now;
  }
  runtime = undefined;
  persist(now);
  return session;
}

export function startSensorQcTrial(label: SensorQcTrialLabel, now = Date.now()): SensorQcTrial | undefined {
  const session = currentSession();
  if (!session || !validLabel(label) || !runtime) return undefined;
  finishSensorQcTrial(now);
  const accumulator = createSensorQcTrialAccumulator(label, now);
  const { lastSampleAt: _ignored, ...base } = accumulator;
  const trial: SensorQcTrial = { ...base, id: newId('qc-trial') };
  session.trials.push(trial);
  session.trials = session.trials.slice(-FRONTIER_SENSOR_QC_MAX_TRIALS_PER_SESSION);
  runtime.trialId = trial.id;
  runtime.lastSampleAt = undefined;
  runtime.lastPersistAt = now;
  persist(now);
  return trial;
}

export function finishSensorQcTrial(now = Date.now()): SensorQcTrial | undefined {
  const trial = currentTrial();
  if (!trial || !runtime) return undefined;
  updateDuration(now);
  trial.endedAt = now;
  runtime.trialId = undefined;
  runtime.lastSampleAt = undefined;
  persist(now);
  return trial;
}

export function sensorQcSetForeground(foreground: boolean, now = Date.now()): void {
  if (!runtime || runtime.foreground === foreground) return;
  if (!foreground) {
    runtime.foreground = false;
    runtime.hiddenSince = now;
  } else {
    if (runtime.hiddenSince !== undefined) runtime.hiddenMs += Math.max(0, now - runtime.hiddenSince);
    runtime.foreground = true;
    runtime.hiddenSince = undefined;
  }
  updateDuration(now);
  persist(now);
}

export function sensorQcRecordSample(sample: SensorQcSample): void {
  const trial = currentTrial();
  if (!trial || !runtime) return;
  const next = observeSensorQcSample({ ...trial, lastSampleAt: runtime.lastSampleAt }, sample);
  runtime.lastSampleAt = next.lastSampleAt;
  const { lastSampleAt: _ignored, ...stored } = next;
  Object.assign(trial, stored);
  updateDuration(sample.wallAt);
  if (sample.wallAt - runtime.lastPersistAt >= 1_000) {
    runtime.lastPersistAt = sample.wallAt;
    persist(sample.wallAt);
  }
}

export function sensorQcRecordCue(kind: FrontierAmbientReactionKind, confidence = 0, intensity = 0, now = Date.now()): string | undefined {
  const trial = currentTrial();
  if (!trial) return undefined;
  trial.cues[kind] += 1;
  trial.cueConfidenceSum += Math.max(0, Math.min(1, confidence));
  trial.cueIntensitySum += Math.max(0, Math.min(1, intensity));
  persist(now);
  return trial.id;
}

export function sensorQcRecordReview(kind: FrontierAmbientReactionKind, confirmed: boolean, trialId?: string, now = Date.now()): void {
  const archive = loadArchive();
  const trial = trialId
    ? archive.sessions.flatMap((session) => session.trials).find((candidate) => candidate.id === trialId)
    : currentTrial();
  if (!trial) return;
  (confirmed ? trial.confirmed : trial.contradicted)[kind] += 1;
  persist(now);
}

export function getSensorQcSnapshot(now = Date.now()): SensorQcSnapshot {
  updateDuration(now);
  const archive = loadArchive();
  const session = currentSession();
  const trial = currentTrial();
  return {
    active: Boolean(runtime),
    activeSession: session ? { ...session, trials: session.trials.map((entry) => ({ ...entry, cues: { ...entry.cues }, confirmed: { ...entry.confirmed }, contradicted: { ...entry.contradicted } })) } : undefined,
    activeTrial: trial ? sensorQcTrialSnapshot(trial) : undefined,
    completedSessions: archive.sessions.filter((entry) => entry.endedAt !== undefined).length,
    completedTrials: archive.sessions.reduce((sum, entry) => sum + entry.trials.filter((trialEntry) => trialEntry.endedAt !== undefined).length, 0),
  };
}

export function createSensorQcExport(archive: SensorQcArchive, exportedAt = new Date().toISOString()): SensorQcExport {
  const sessions = archive.sessions.map((session) => ({
    ...session,
    trials: session.trials.map((trial) => ({ ...trial, cues: { ...trial.cues }, confirmed: { ...trial.confirmed }, contradicted: { ...trial.contradicted } })),
  }));
  const trials = sessions.flatMap((session) => session.trials);
  const sumKinds = (trial: SensorQcTrial, field: 'cues' | 'confirmed' | 'contradicted') => KINDS.reduce((sum, kind) => sum + trial[field][kind], 0);
  return {
    schema: FRONTIER_SENSOR_QC_SCHEMA,
    exportedAt,
    privacy: { aggregateOnly: true, contentIdentifiersIncluded: false, rawCameraDataIncluded: false },
    summary: {
      sessions: sessions.length,
      trials: trials.length,
      durationMs: trials.reduce((sum, trial) => sum + trial.durationMs, 0),
      sensorSampledMs: trials.reduce((sum, trial) => sum + trial.sensorSampledMs, 0),
      faceObservableMs: trials.reduce((sum, trial) => sum + trial.faceObservableMs, 0),
      cues: trials.reduce((sum, trial) => sum + sumKinds(trial, 'cues'), 0),
      reviewed: trials.reduce((sum, trial) => sum + sumKinds(trial, 'confirmed') + sumKinds(trial, 'contradicted'), 0),
    },
    sessions,
  };
}

export function exportSensorQcReport(now = Date.now()): SensorQcExport {
  updateDuration(now);
  persist(now, false);
  return createSensorQcExport(loadArchive());
}

export function downloadSensorQcReport(now = Date.now()): void {
  if (typeof document === 'undefined') return;
  const report = exportSensorQcReport(now);
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `frontier-sensor-qc-${new Date(now).toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function clearSensorQcArchive(): void {
  archiveCache = emptyArchive();
  runtime = undefined;
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(FRONTIER_SENSOR_QC_STORAGE_KEY); } catch { /* best effort */ }
    emit();
  }
}

export function subscribeSensorQc(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(FRONTIER_SENSOR_QC_CHANGE_EVENT, listener);
  return () => window.removeEventListener(FRONTIER_SENSOR_QC_CHANGE_EVENT, listener);
}
