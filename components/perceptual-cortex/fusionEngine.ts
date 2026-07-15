import type { PerceptualWorldState, SignalSourceId } from './signalTypes';
import { silentAudioFeatures, type AudioFeatures } from './audioFeatures';

const damp = (value: number, target: number, rate: number, dt: number) =>
  value + (target - value) * (1 - Math.exp(-rate * dt));
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export type InputSnapshot = {
  x: number; y: number; speed: number; pointerActive: boolean; pointerType: string;
  keyImpulse: number; cadence: number; cadenceVariation: number;
  audioActive: boolean; audio: AudioFeatures;
};

export const createInputSnapshot = (): InputSnapshot => ({ x: 0, y: 0, speed: 0, pointerActive: false, pointerType: 'mouse', keyImpulse: 0, cadence: 0, cadenceVariation: 0, audioActive: false, audio: silentAudioFeatures() });

export function advanceWorld(world: PerceptualWorldState, input: InputSnapshot, now: number, dt: number) {
  const ambient = 0.5 + 0.5 * Math.sin(now * 0.00042);
  const movement = Math.tanh(input.speed * 0.7);
  const targetExcitation = clamp01(0.1 + movement * 0.42 + input.keyImpulse * 0.28 + input.audio.smoothedRms * .5 + ambient * 0.08);
  world.timestampMs = now;
  world.pointerX = damp(world.pointerX, input.x, 12, dt);
  world.pointerY = damp(world.pointerY, input.y, 12, dt);
  world.pointerSpeed = damp(world.pointerSpeed, movement, 9, dt);
  world.excitation = damp(world.excitation, targetExcitation, targetExcitation > world.excitation ? 8 : 1.8, dt);
  world.coherence = damp(world.coherence, clamp01(0.78 - input.cadenceVariation * 0.35 + ambient * 0.1), 1.2, dt);
  world.tension = damp(world.tension, clamp01(movement * 0.45 + input.keyImpulse * 0.25), 3, dt);
  world.entropy = damp(world.entropy, clamp01(0.16 + input.cadenceVariation * 0.45 + movement * 0.22), 0.8, dt);
  world.plasticity = clamp01(world.plasticity + (movement + input.keyImpulse) * dt * 0.018);
  world.trailEnergy = damp(world.trailEnergy, input.pointerActive ? movement : 0, input.pointerActive ? 12 : 2.5, dt);
  world.growthImpulse = damp(world.growthImpulse, input.keyImpulse, input.keyImpulse > world.growthImpulse ? 18 : 2.2, dt);
  world.pulseRate = 0.2 + world.excitation * 2.4 + input.cadence * 0.35 + input.audio.onset * 1.8;
  world.propagationVelocity = 0.22 + movement * 1.35 + input.audio.midEnergy * .45;
  world.oscillationAmplitude = damp(world.oscillationAmplitude, .03 + input.audio.smoothedRms * .85, 5, dt);
  world.oscillationFrequency = damp(world.oscillationFrequency, .18 + input.audio.spectralCentroid * 1.5, 2, dt);
  world.lowBand = damp(world.lowBand, input.audio.lowEnergy, 5, dt); world.midBand = damp(world.midBand, input.audio.midEnergy, 7, dt); world.highBand = damp(world.highBand, input.audio.highEnergy, 9, dt);
  world.onsetImpulse = Math.max(input.audio.onset, world.onsetImpulse * Math.exp(-dt * 7));
  const sources: SignalSourceId[] = ['synthetic'];
  if (input.pointerActive) sources.push(input.pointerType === 'touch' ? 'touch' : 'pointer');
  if (input.cadence > 0.05 || input.keyImpulse > 0.05) sources.push('keyboard');
  if (input.audioActive) sources.push('audio');
  world.activeModalities = sources;
  input.keyImpulse *= Math.exp(-dt * 4.5);
}
