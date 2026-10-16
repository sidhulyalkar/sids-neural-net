export const FRONTIER_AUDIO_MOMENTUM_EVENT = 'frontier:audio-momentum';

export type FrontierAudioBands = {
  subBass: number;
  lowMid: number;
  momentum: number;
};

export type FrontierFrequencyBinRange = {
  start: number;
  end: number;
};

type Binding = {
  element: HTMLMediaElement;
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  bins: Uint8Array<ArrayBuffer>;
  frame?: number;
  momentum: number;
  lastPublished: number;
  lastPublishedAt: number;
};

type Registry = {
  context: AudioContext;
  bindings: WeakMap<HTMLMediaElement, Binding>;
  active?: Binding;
};

type FrontierWindow = Window & {
  __frontierAudioReactivity?: Registry;
};

const FFT_SIZE = 1_024;
const SMOOTHING = 0.76;
const SUB_BASS: [number, number] = [24, 92];
const LOW_MID: [number, number] = [92, 320];
const SILENCE_FLOOR = 0.018;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function frontierFrequencyBinRange(
  sampleRate: number,
  fftSize: number,
  lowHz: number,
  highHz: number,
): FrontierFrequencyBinRange {
  const bins = Math.max(1, Math.floor(fftSize / 2));
  const hzPerBin = Math.max(1e-6, sampleRate / fftSize);
  const start = Math.max(0, Math.min(bins - 1, Math.ceil(lowHz / hzPerBin)));
  const end = Math.max(start + 1, Math.min(bins, Math.floor(highHz / hzPerBin) + 1));
  return { start, end };
}

export function frontierBandEnergy(data: ArrayLike<number>, range: FrontierFrequencyBinRange): number {
  const end = Math.min(data.length, Math.max(range.start + 1, range.end));
  const start = Math.max(0, Math.min(end - 1, range.start));
  let sumSquares = 0;
  let count = 0;
  for (let index = start; index < end; index += 1) {
    const normalized = clamp01(Number(data[index] ?? 0) / 255);
    sumSquares += normalized * normalized;
    count += 1;
  }
  return count ? Math.sqrt(sumSquares / count) : 0;
}

export function frontierAudioMomentum(
  subBass: number,
  lowMid: number,
  previous = 0,
): number {
  const gatedSub = clamp01((subBass - SILENCE_FLOOR) / (1 - SILENCE_FLOOR));
  const gatedMid = clamp01((lowMid - SILENCE_FLOOR) / (1 - SILENCE_FLOOR));
  const instantaneous = clamp01(Math.sqrt(gatedSub) * 0.72 + Math.sqrt(gatedMid) * 0.28);
  const coefficient = instantaneous > previous ? 0.34 : 0.105;
  return clamp01(previous + (instantaneous - previous) * coefficient);
}

export function frontierCanAnalyzeMediaElement(element: HTMLMediaElement): boolean {
  if (element.srcObject) return true;
  const raw = element.currentSrc || element.src;
  if (!raw) return false;
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return true;
  if (element.dataset.frontierAudioCorsSafe === 'true') return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URL(raw, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function registry(): Registry | undefined {
  if (typeof window === 'undefined') return undefined;
  const owner = window as FrontierWindow;
  if (owner.__frontierAudioReactivity) return owner.__frontierAudioReactivity;
  const AudioContextCtor = window.AudioContext
    || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return undefined;
  try {
    owner.__frontierAudioReactivity = {
      context: new AudioContextCtor({ latencyHint: 'interactive' }),
      bindings: new WeakMap(),
    };
    return owner.__frontierAudioReactivity;
  } catch {
    return undefined;
  }
}

/**
 * Resume the shared analysis context while the browser still owns a trusted
 * user activation. This does not create media-source nodes or begin analysis;
 * the expanded-card effect owns that later lifecycle.
 */
export function primeFrontierAudioReactivity(): boolean {
  const state = registry();
  if (!state) return false;
  if (state.context.state === 'suspended') void state.context.resume().catch(() => undefined);
  return true;
}

function publish(bands: FrontierAudioBands) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<FrontierAudioBands>(FRONTIER_AUDIO_MOMENTUM_EVENT, { detail: bands }));
}

function stopBinding(binding: Binding, reset = true) {
  if (binding.frame !== undefined) cancelAnimationFrame(binding.frame);
  binding.frame = undefined;
  if (reset && binding.momentum !== 0) {
    binding.momentum = 0;
    binding.lastPublished = 0;
    binding.lastPublishedAt = 0;
    publish({ subBass: 0, lowMid: 0, momentum: 0 });
  }
}

function ensureBinding(element: HTMLMediaElement): Binding | undefined {
  const state = registry();
  if (!state || !frontierCanAnalyzeMediaElement(element)) return undefined;
  const existing = state.bindings.get(element);
  if (existing) return existing;
  try {
    const source = state.context.createMediaElementSource(element);
    const analyser = state.context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    source.connect(analyser);
    analyser.connect(state.context.destination);
    const binding: Binding = {
      element,
      source,
      analyser,
      bins: new Uint8Array(analyser.frequencyBinCount),
      momentum: 0,
      lastPublished: 0,
      lastPublishedAt: 0,
    };
    state.bindings.set(element, binding);
    return binding;
  } catch {
    return undefined;
  }
}

function startBinding(binding: Binding) {
  const state = registry();
  if (!state || state.active === binding && binding.frame !== undefined) return;
  if (state.active && state.active !== binding) stopBinding(state.active);
  state.active = binding;
  void state.context.resume().catch(() => undefined);

  const sample = (now: number) => {
    binding.frame = undefined;
    if (state.active !== binding || binding.element.paused || binding.element.ended || document.visibilityState === 'hidden') {
      stopBinding(binding);
      if (state.active === binding) state.active = undefined;
      return;
    }
    binding.analyser.getByteFrequencyData(binding.bins);
    const subBass = frontierBandEnergy(
      binding.bins,
      frontierFrequencyBinRange(state.context.sampleRate, binding.analyser.fftSize, SUB_BASS[0], SUB_BASS[1]),
    );
    const lowMid = frontierBandEnergy(
      binding.bins,
      frontierFrequencyBinRange(state.context.sampleRate, binding.analyser.fftSize, LOW_MID[0], LOW_MID[1]),
    );
    binding.momentum = frontierAudioMomentum(subBass, lowMid, binding.momentum);
    if (Math.abs(binding.momentum - binding.lastPublished) >= 0.008 || now - binding.lastPublishedAt >= 96) {
      binding.lastPublished = binding.momentum;
      binding.lastPublishedAt = now;
      publish({ subBass, lowMid, momentum: binding.momentum });
    }
    binding.frame = requestAnimationFrame(sample);
  };
  binding.frame = requestAnimationFrame(sample);
}

export function setFrontierAudioReactiveElement(element: HTMLMediaElement, active: boolean): boolean {
  const state = registry();
  if (!state) return false;
  const binding = active ? ensureBinding(element) : state.bindings.get(element);
  if (!binding) return false;
  if (!active) {
    stopBinding(binding);
    if (state.active === binding) state.active = undefined;
    return true;
  }
  if (!element.paused && !element.ended) startBinding(binding);
  return true;
}

export function bindFrontierAudioReactiveElement(element: HTMLMediaElement): () => void {
  if (!frontierCanAnalyzeMediaElement(element)) return () => undefined;
  const onPlay = () => setFrontierAudioReactiveElement(element, true);
  const onStop = () => setFrontierAudioReactiveElement(element, false);
  element.addEventListener('play', onPlay);
  element.addEventListener('playing', onPlay);
  element.addEventListener('pause', onStop);
  element.addEventListener('ended', onStop);
  if (!element.paused && !element.ended) onPlay();
  return () => {
    element.removeEventListener('play', onPlay);
    element.removeEventListener('playing', onPlay);
    element.removeEventListener('pause', onStop);
    element.removeEventListener('ended', onStop);
    onStop();
  };
}
