export type AudioFeatures = { rms: number; smoothedRms: number; lowEnergy: number; midEnergy: number; highEnergy: number; spectralCentroid: number; spectralFlux: number; onset: number };
export const silentAudioFeatures = (): AudioFeatures => ({ rms: 0, smoothedRms: 0, lowEnergy: 0, midEnergy: 0, highEnergy: 0, spectralCentroid: 0, spectralFlux: 0, onset: 0 });
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function calculateRms(samples: Uint8Array) {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) { const centered = (sample - 128) / 128; sum += centered * centered; }
  return clamp01(Math.sqrt(sum / samples.length) * 2.4);
}

export function calculateBandEnergy(bins: Uint8Array, sampleRate: number, fftSize: number, minHz: number, maxHz: number) {
  const hzPerBin = sampleRate / fftSize;
  const start = Math.max(0, Math.floor(minHz / hzPerBin));
  const end = Math.min(bins.length, Math.ceil(maxHz / hzPerBin));
  if (end <= start) return 0;
  let sum = 0;
  for (let index = start; index < end; index++) sum += bins[index] / 255;
  return clamp01(sum / (end - start));
}

export function calculateSpectralCentroid(bins: Uint8Array) {
  let weighted = 0; let magnitude = 0;
  for (let index = 0; index < bins.length; index++) { weighted += index * bins[index]; magnitude += bins[index]; }
  return magnitude ? clamp01(weighted / magnitude / Math.max(1, bins.length - 1)) : 0;
}

export function calculateSpectralFlux(bins: Uint8Array, previous: Uint8Array) {
  if (bins.length !== previous.length || !bins.length) return 0;
  let flux = 0;
  for (let index = 0; index < bins.length; index++) flux += Math.max(0, bins[index] - previous[index]) / 255;
  return clamp01(flux / bins.length * 8);
}
