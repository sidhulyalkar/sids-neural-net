import type { InputSnapshot } from './fusionEngine';
export type SyntheticPresetId = 'calm-breathing' | 'bilateral-bloom' | 'rhythmic-audio' | 'synaptic-storm' | 'focus-tunnel' | 'full-demonstration';
export const syntheticPresetLabels: Record<SyntheticPresetId, string> = { 'calm-breathing': 'Calm breathing', 'bilateral-bloom': 'Bilateral bloom', 'rhythmic-audio': 'Rhythmic audio', 'synaptic-storm': 'Synaptic storm', 'focus-tunnel': 'Focus tunnel', 'full-demonstration': 'Full demonstration' };
export function applySyntheticPreset(input: InputSnapshot, preset: SyntheticPresetId, timeMs: number) {
  const t = timeMs / 1000;
  if (preset === 'calm-breathing') { input.face.active = true; input.face.stillness = .88; input.face.activity = .08; }
  if (preset === 'bilateral-bloom' || preset === 'full-demonstration') { input.hands.active = true; input.hands.count = 2; input.hands.separation = Math.min(1, .25 + (Math.sin(t * 1.3) + 1) * .28); input.hands.speed = .35 + Math.abs(Math.cos(t * 1.3)) * .45; input.hands.symmetry = .9; }
  if (preset === 'rhythmic-audio' || preset === 'full-demonstration') { input.audioActive = true; input.audio.smoothedRms = .3 + Math.max(0, Math.sin(t * 6)) * .45; input.audio.lowEnergy = .45; input.audio.midEnergy = .35; input.audio.highEnergy = .25; input.audio.onset = Math.sin(t * 6) > .94 ? .9 : 0; }
  if (preset === 'synaptic-storm') { input.speed = 1.4; input.keyImpulse = Math.sin(t * 8) > .75 ? 1 : 0; input.face.active = true; input.face.activity = .75; }
  if (preset === 'focus-tunnel') { input.hands.active = true; input.hands.count = 1; input.hands.pinch = .88; input.face.active = true; input.face.stillness = .9; }
}
