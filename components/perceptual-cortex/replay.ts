import type { PerceptualWorldState } from './signalTypes';
export type ReplayFrame = { timeMs: number; world: Pick<PerceptualWorldState, 'excitation' | 'coherence' | 'entropy' | 'plasticity' | 'zoom' | 'bilateralStrength' | 'facialActivity' | 'lowBand' | 'midBand' | 'highBand'> };
export class ReplayRecorder {
  private frames: ReplayFrame[] = []; private lastCapture = -Infinity;
  capture(timeMs: number, world: PerceptualWorldState) {
    if (timeMs - this.lastCapture < 80) return; this.lastCapture = timeMs;
    this.frames.push({ timeMs: Math.round(timeMs), world: { excitation: world.excitation, coherence: world.coherence, entropy: world.entropy, plasticity: world.plasticity, zoom: world.zoom, bilateralStrength: world.bilateralStrength, facialActivity: world.facialActivity, lowBand: world.lowBand, midBand: world.midBand, highBand: world.highBand } });
    if (this.frames.length > 4500) this.frames.shift();
  }
  snapshot() { return this.frames.map((frame) => ({ ...frame, world: { ...frame.world } })); }
  reset() { this.frames = []; this.lastCapture = -Infinity; }
}
