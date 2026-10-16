import { z } from 'zod';

export const PersonaSignalSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean()]).nullable(),
  unit: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  observability: z.number().min(0).max(1),
  origin: z.enum(['rf', 'reference', 'camera', 'self_report', 'derived', 'demo']),
  evidence: z.enum(['measured', 'derived', 'predicted', 'self_report', 'demo']),
  method: z.string().min(1),
  reference_verified: z.boolean(),
  age_ms: z.number().int().nonnegative(),
  available: z.boolean(),
  claim_boundary: z.string().min(1),
});

export const SleepStageEstimateSchema = z
  .object({
    wake: z.number().min(0).max(1),
    light: z.number().min(0).max(1),
    deep: z.number().min(0).max(1),
    rem: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    observability: z.number().min(0).max(1),
    model_id: z.string().min(1),
    reference_status: z.enum([
      'unvalidated',
      'development-reference',
      'held-out-psg',
      'demo',
    ]),
    claim_boundary: z.string().min(1),
  })
  .superRefine((value, context) => {
    const sum = value.wake + value.light + value.deep + value.rem;
    if (Math.abs(sum - 1) > 1e-4) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sleep-stage probabilities must sum to 1',
      });
    }
  });

export const PersonaPrivacySchema = z.object({
  raw_rf_included: z.literal(false),
  raw_camera_included: z.literal(false),
  biometric_template_included: z.literal(false),
  identity_included: z.boolean(),
  local_processing_preferred: z.boolean(),
  consent_scopes: z.array(z.string()),
});

export const PersonaSnapshotSchema = z.object({
  schema_version: z.literal('physioatlas.persona.v1'),
  generated_at_utc: z.string().min(1),
  research_only: z.literal(true),
  clinical_claim_allowed: z.literal(false),
  mode: z.enum(['demo', 'replay', 'live']),
  session_id: z.string().min(1),
  subject_alias: z.string().nullable().optional(),
  signals: z.array(PersonaSignalSchema),
  sleep: SleepStageEstimateSchema.nullable().optional(),
  overall_observability: z.number().min(0).max(1),
  privacy: PersonaPrivacySchema,
  notes: z.array(z.string()),
});

export type PersonaSignal = z.infer<typeof PersonaSignalSchema>;
export type SleepStageEstimate = z.infer<typeof SleepStageEstimateSchema>;
export type PersonaSnapshot = z.infer<typeof PersonaSnapshotSchema>;

export type PersonaMoodSelfReport = 'calm' | 'curious' | 'energized' | 'sleepy';

export function getSignal(snapshot: PersonaSnapshot, key: string): PersonaSignal | undefined {
  return snapshot.signals.find((signal) => signal.key === key);
}

export function dominantSleepStage(snapshot: PersonaSnapshot): 'wake' | 'light' | 'deep' | 'rem' | 'unknown' {
  if (!snapshot.sleep) return 'unknown';

  const stages = [
    ['wake', snapshot.sleep.wake],
    ['light', snapshot.sleep.light],
    ['deep', snapshot.sleep.deep],
    ['rem', snapshot.sleep.rem],
  ] as const;

  return stages.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}
