import type { AudioFeatures } from './audioFeatures';
import type { Track } from '@/lib/spotify/manifest';

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
  spectral?: { frameMs: number; low: number[]; mid: number[]; high: number[]; centroid: number[] };
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const beatPhase = (posMs: number, downbeatMs: number, beatMs: number) => {
  const raw = (posMs - downbeatMs) % beatMs;
  return (raw < 0 ? raw + beatMs : raw) / beatMs;
};

const sectionIntensity = (timeline: MusicTimeline, posMs: number) => {
  if (!timeline.sections?.length) return 0.5;
  let current = timeline.sections[0].intensity;
  for (const section of timeline.sections) {
    if (section.startMs <= posMs) current = section.intensity;
    else break;
  }
  return clamp01(current);
};

/**
 * Every curated Rotation track gets a deterministic visual timing model even
 * before a richer analyzed beat-grid is authored. This fallback is explicitly
 * approximate: it uses verified tempo metadata plus broad structural sections,
 * while playback position still comes from Spotify when available.
 */
export function timelineFromTrack(track: Track): MusicTimeline {
  const duration = track.durationMs;
  const at = (fraction: number) => Math.round(duration * fraction);
  return {
    version: 1,
    durationMs: duration,
    bpm: track.bpm,
    downbeatMs: track.downbeatMs,
    sections: [
      { startMs: 0, kind: 'intro', intensity: 0.38 },
      { startMs: at(0.14), kind: 'build', intensity: 0.58 },
      { startMs: at(0.29), kind: 'drop', intensity: 0.94 },
      { startMs: at(0.53), kind: 'break', intensity: 0.46 },
      { startMs: at(0.66), kind: 'drop', intensity: 1 },
      { startMs: at(0.9), kind: 'outro', intensity: 0.42 },
    ],
  };
}

export function sample(timeline: MusicTimeline, posMs: number, intensity = 1): AudioFeatures {
  const beatMs = 60000 / timeline.bpm;
  const phase = beatPhase(posMs, timeline.downbeatMs, beatMs);
  const offPhase = beatPhase(posMs, timeline.downbeatMs + beatMs / 2, beatMs);
  const beatEnv = Math.exp(-phase * 6);
  const hatEnv = Math.exp(-offPhase * 8);
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
