import { calculateBandEnergy, calculateRms, calculateSpectralCentroid, calculateSpectralFlux, silentAudioFeatures, type AudioFeatures } from './audioFeatures';

export class AudioSignalSource {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private previousFrequency: Uint8Array<ArrayBuffer> | null = null;
  private smoothedRms = 0;
  private lastOnsetAt = 0;

  async enable() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    this.context = new AudioContext(); await this.context.resume();
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = .58;
    source.connect(this.analyser);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.previousFrequency = new Uint8Array(this.analyser.frequencyBinCount);
  }

  sample(now = performance.now()): AudioFeatures {
    if (!this.analyser || !this.context || !this.timeData || !this.frequencyData || !this.previousFrequency) return silentAudioFeatures();
    this.analyser.getByteTimeDomainData(this.timeData); this.analyser.getByteFrequencyData(this.frequencyData);
    const rms = calculateRms(this.timeData); this.smoothedRms += (rms - this.smoothedRms) * (rms > this.smoothedRms ? .35 : .08);
    const flux = calculateSpectralFlux(this.frequencyData, this.previousFrequency);
    const onset = flux > .16 && this.smoothedRms > .035 && now - this.lastOnsetAt > 110 ? Math.min(1, flux * 3) : 0;
    if (onset) this.lastOnsetAt = now; this.previousFrequency.set(this.frequencyData);
    return { rms, smoothedRms: this.smoothedRms,
      lowEnergy: calculateBandEnergy(this.frequencyData, this.context.sampleRate, this.analyser.fftSize, 40, 250),
      midEnergy: calculateBandEnergy(this.frequencyData, this.context.sampleRate, this.analyser.fftSize, 250, 2400),
      highEnergy: calculateBandEnergy(this.frequencyData, this.context.sampleRate, this.analyser.fftSize, 2400, 9000),
      spectralCentroid: calculateSpectralCentroid(this.frequencyData), spectralFlux: flux, onset };
  }

  async disable() {
    this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null; this.analyser = null;
    this.timeData = null; this.frequencyData = null; this.previousFrequency = null;
    const context = this.context; this.context = null; if (context && context.state !== 'closed') await context.close();
    this.smoothedRms = 0;
  }
}
