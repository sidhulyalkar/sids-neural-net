export type SignalSourceId = 'hand' | 'face' | 'audio' | 'pointer' | 'touch' | 'keyboard' | 'synthetic';

export type PerceptualWorldState = {
  timestampMs: number;
  pointerX: number;
  pointerY: number;
  pointerSpeed: number;
  excitation: number;
  coherence: number;
  tension: number;
  entropy: number;
  plasticity: number;
  trailEnergy: number;
  growthImpulse: number;
  pulseRate: number;
  propagationVelocity: number;
  oscillationAmplitude: number; oscillationFrequency: number;
  lowBand: number; midBand: number; highBand: number; onsetImpulse: number;
  activeModalities: SignalSourceId[];
};

export const createWorldState = (): PerceptualWorldState => ({
  timestampMs: 0, pointerX: 0, pointerY: 0, pointerSpeed: 0,
  excitation: 0.12, coherence: 0.72, tension: 0.18, entropy: 0.22,
  plasticity: 0, trailEnergy: 0, growthImpulse: 0, pulseRate: 0.2,
  propagationVelocity: 0.25, activeModalities: ['synthetic'],
  oscillationAmplitude: 0.04, oscillationFrequency: 0.2,
  lowBand: 0, midBand: 0, highBand: 0, onsetImpulse: 0,
});
