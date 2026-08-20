import type { AudioFeatures } from './audioFeatures';

export type TimelineSection = {
  startMs: number;
  kind: 'intro' | 'build' | 'drop' | 'break' | 'outro';
  intensity: number;
};

export type MusicTimeline = {
  version: 1;
  durationMs: number;
  bpm: number;
  downbeatMs: number;
  sections?: TimelineSection[];
  // Reserved for Tier A spectral analysis; ignored by the v1 sampler.
  spectral?: { frameMs: number; low: number[]; mid: number[]; high: number[]; centroid: number[] };
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Phase within a beat in [0,1): 0 exactly on the beat.
const beatPhase = (posMs: number, downbeatMs: number, beatMs: number) => {
  const raw = (posMs - downbeatMs) % beatMs;
  return (raw < 0 ? raw + beatMs : raw) / beatMs;
};

// Section intensity at a position; defaults to 0.5 when no sections are authored.
const sectionIntensity = (timeline: MusicTimeline, posMs: number) => {
  if (!timeline.sections?.length) return 0.5;
  let current = timeline.sections[0].intensity;
  for (const section of timeline.sections) {
    if (section.startMs <= posMs) current = section.intensity;
    else break;
  }
  return clamp01(current);
};

export function sample(timeline: MusicTimeline, posMs: number, intensity = 1): AudioFeatures {
  const beatMs = 60000 / timeline.bpm;
  const phase = beatPhase(posMs, timeline.downbeatMs, beatMs);
  const offPhase = beatPhase(posMs, timeline.downbeatMs + beatMs / 2, beatMs);
  const beatEnv = Math.exp(-phase * 6);        // kick spike, decays across the beat
  const hatEnv = Math.exp(-offPhase * 8);      // off-beat hi-hat spike
  const drive = sectionIntensity(timeline, posMs);

  const scale = (value: number) => clamp01(value * intensity);
  const smoothedRms = scale(drive * (0.35 + 0.25 * beatEnv));
  return {
    rms: smoothedRms,
    smoothedRms,
    lowEnergy: scale(drive * (0.4 + 0.6 * beatEnv)),
    midEnergy: scale(drive * 0.5),
    highEnergy: scale(drive * (0.3 + 0.5 * hatEnv)),
    spectralCentroid: scale(0.3 + 0.4 * hatEnv),
    spectralFlux: scale(beatEnv),
    onset: scale(beatEnv),
  };
}
