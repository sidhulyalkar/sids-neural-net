import type { ReplayFrame } from './replay';
import type { VisualThemeId } from './visualThemes';

export type SoundscapeParameters = { rootHz: number; harmonicHz: number; shimmerHz: number; masterGain: number; noiseGain: number; filterHz: number; detune: number };
const roots: Record<VisualThemeId, number> = { homeostasis: 110, plasticity: 138.59, synchrony: 146.83, criticality: 92.5, liminality: 123.47 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function mapFrameToSound(frame: ReplayFrame['world'], theme: VisualThemeId): SoundscapeParameters {
  const rootHz = roots[theme] * (1 + frame.plasticity * .12);
  return { rootHz, harmonicHz: rootHz * (frame.coherence > .66 ? 1.5 : 1.414), shimmerHz: rootHz * (2 + frame.bilateralStrength * 1.5), masterGain: clamp(.018 + frame.excitation * .055, .012, .075), noiseGain: clamp(frame.entropy * .025 + frame.highBand * .03, 0, .045), filterHz: clamp(260 + frame.lowBand * 900 + frame.midBand * 1800 + frame.facialActivity * 700, 180, 4200), detune: (frame.entropy - .5) * 18 };
}

export class SoundscapeEngine {
  private context: AudioContext | null = null; private master: GainNode | null = null; private filter: BiquadFilterNode | null = null;
  private voices: OscillatorNode[] = []; private voiceGains: GainNode[] = []; private noise: AudioBufferSourceNode | null = null; private noiseGain: GainNode | null = null;
  async start() {
    if (this.context) return; const context = new AudioContext(); this.context = context; await context.resume();
    const master = context.createGain(); master.gain.value = 0; master.connect(context.destination); this.master = master;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 1.4; filter.connect(master); this.filter = filter;
    (['sine', 'triangle', 'sine'] as OscillatorType[]).forEach((type, index) => { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = type; gain.gain.value = index === 0 ? .65 : index === 1 ? .26 : .09; oscillator.connect(gain).connect(filter); oscillator.start(); this.voices.push(oscillator); this.voiceGains.push(gain); });
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate); const data = buffer.getChannelData(0); let state = 1842; for (let i = 0; i < data.length; i++) { state = Math.imul(state, 1664525) + 1013904223 | 0; data[i] = (state / 2147483648) * .35; }
    const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true; const noiseGain = context.createGain(); noiseGain.gain.value = 0; noise.connect(noiseGain).connect(filter); noise.start(); this.noise = noise; this.noiseGain = noiseGain;
  }
  update(frame: ReplayFrame['world'], theme: VisualThemeId) {
    if (!this.context || !this.master || !this.filter || !this.noiseGain) return; const now = this.context.currentTime; const values = mapFrameToSound(frame, theme);
    [values.rootHz, values.harmonicHz, values.shimmerHz].forEach((frequency, index) => { this.voices[index]?.frequency.setTargetAtTime(frequency, now, .08); this.voices[index]?.detune.setTargetAtTime(index ? values.detune : 0, now, .12); });
    this.master.gain.setTargetAtTime(values.masterGain, now, .12); this.noiseGain.gain.setTargetAtTime(values.noiseGain, now, .08); this.filter.frequency.setTargetAtTime(values.filterHz, now, .1);
  }
  async stop() { const context = this.context; if (!context) return; const now = context.currentTime; this.master?.gain.setTargetAtTime(0, now, .04); await new Promise((resolve) => setTimeout(resolve, 90)); this.voices.forEach((voice) => voice.stop()); this.noise?.stop(); this.voices = []; this.voiceGains = []; this.noise = null; this.context = null; this.master = null; this.filter = null; this.noiseGain = null; if (context.state !== 'closed') await context.close(); }
}
