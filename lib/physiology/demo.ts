import { PersonaSnapshotSchema, type PersonaSnapshot } from './schema';

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizedSleepScores(elapsedSeconds: number) {
  const slow = elapsedSeconds * 0.035;
  const raw = {
    wake: 0.12 + 0.05 * Math.sin(slow + 0.5),
    light: 0.52 + 0.08 * Math.sin(slow + 1.8),
    deep: 0.23 + 0.06 * Math.sin(slow + 3.5),
    rem: 0.16 + 0.05 * Math.sin(slow + 5.1),
  };
  const total = raw.wake + raw.light + raw.deep + raw.rem;
  return {
    wake: raw.wake / total,
    light: raw.light / total,
    deep: raw.deep / total,
    rem: raw.rem / total,
  };
}

export function createDemoPersonaSnapshot(elapsedSeconds: number): PersonaSnapshot {
  const respiration = 14.2 + Math.sin(elapsedSeconds * 0.38) * 1.4;
  const movement = clamp(0.18 + Math.max(0, Math.sin(elapsedSeconds * 0.19)) * 0.34);
  const cardiac = 64 + Math.sin(elapsedSeconds * 0.61) * 3.5;
  const sleep = normalizedSleepScores(elapsedSeconds);

  return PersonaSnapshotSchema.parse({
    schema_version: 'physioatlas.persona.v1',
    generated_at_utc: new Date().toISOString(),
    research_only: true,
    clinical_claim_allowed: false,
    mode: 'demo',
    session_id: 'portfolio-demo',
    signals: [
      {
        key: 'respiration_rate',
        label: 'respiration',
        value: Number(respiration.toFixed(1)),
        unit: 'breaths/min',
        confidence: 0.88,
        observability: 0.92,
        origin: 'demo',
        evidence: 'demo',
        method: 'synthetic-periodic-respiration',
        reference_verified: false,
        age_ms: 0,
        available: true,
        claim_boundary: 'Synthetic visualisation value; no physiological claim.',
      },
      {
        key: 'movement_intensity',
        label: 'movement',
        value: Number(movement.toFixed(2)),
        unit: 'normalized',
        confidence: 0.91,
        observability: 0.95,
        origin: 'demo',
        evidence: 'demo',
        method: 'synthetic-motion-envelope',
        reference_verified: false,
        age_ms: 0,
        available: true,
        claim_boundary: 'Synthetic visualisation value; no activity claim.',
      },
      {
        key: 'cardiac_rate',
        label: 'cardiac rate',
        value: Number(cardiac.toFixed(0)),
        unit: 'beats/min',
        confidence: 0.72,
        observability: 0.68,
        origin: 'demo',
        evidence: 'demo',
        method: 'synthetic-cardiac-oscillator',
        reference_verified: false,
        age_ms: 0,
        available: true,
        claim_boundary: 'Synthetic visualisation value; no cardiac claim.',
      },
    ],
    sleep: {
      ...sleep,
      confidence: 0.71,
      observability: 0.83,
      model_id: 'synthetic-demo',
      reference_status: 'demo',
      claim_boundary: 'Synthetic sleep-stage visualisation; not a sleep assessment.',
    },
    overall_observability: 0.86,
    privacy: {
      raw_rf_included: false,
      raw_camera_included: false,
      biometric_template_included: false,
      identity_included: false,
      local_processing_preferred: true,
      consent_scopes: [],
    },
    notes: [
      'All values in this stream are synthetic.',
      'Load a local physioatlas.persona.v1 JSON file to replay real research output without uploading it.',
    ],
  });
}
