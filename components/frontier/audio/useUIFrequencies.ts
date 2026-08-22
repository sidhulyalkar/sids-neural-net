'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'frontier-ui-audio-muted-v1';
const MUTE_EVENT = 'frontier:ui-audio-muted';
const MASTER_LEVEL = 0.34;

let context: AudioContext | undefined;
let masterGain: GainNode | undefined;
let clickNoise: AudioBuffer | undefined;
let userActivated = false;
let engineMuted = false;

function persistedMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function canCreateAudioContext(): boolean {
  if (typeof window === 'undefined') return false;
  const activation = navigator.userActivation;
  return userActivated || Boolean(activation?.hasBeenActive);
}

function ensureContext(): AudioContext | undefined {
  if (!canCreateAudioContext()) return undefined;
  if (context) return context;
  try {
    context = new AudioContext({ latencyHint: 'interactive' });
    masterGain = context.createGain();
    masterGain.gain.value = engineMuted ? 0 : MASTER_LEVEL;
    masterGain.connect(context.destination);
    return context;
  } catch {
    context = undefined;
    masterGain = undefined;
    return undefined;
  }
}

function resumeContext(ctx: AudioContext): void {
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

function setEngineMuted(muted: boolean): void {
  engineMuted = muted;
  if (masterGain && context) {
    const now = context.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, now, 0.012);
  }
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (clickNoise && clickNoise.sampleRate === ctx.sampleRate) return clickNoise;
  const frames = Math.max(32, Math.round(ctx.sampleRate * 0.034));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x9e3779b9;
  for (let index = 0; index < data.length; index += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[index] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  clickNoise = buffer;
  return buffer;
}

function searchThud(): void {
  if (engineMuted) return;
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  resumeContext(ctx);

  const now = ctx.currentTime + 0.006;
  const oscillator = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(78, now);
  oscillator.frequency.exponentialRampToValueAtTime(43, now + 0.115);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(150, now);
  filter.Q.setValueAtTime(0.72, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.009);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  oscillator.start(now);
  oscillator.stop(now + 0.255);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    filter.disconnect();
    gain.disconnect();
  }, { once: true });
}

function mechanicalClick(): void {
  if (engineMuted) return;
  const ctx = ensureContext();
  if (!ctx || !masterGain) return;
  resumeContext(ctx);

  const now = ctx.currentTime + 0.003;
  const source = ctx.createBufferSource();
  const highpass = ctx.createBiquadFilter();
  const lowpass = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = noiseBuffer(ctx);
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(2_300, now);
  highpass.Q.setValueAtTime(0.62, now);
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(8_500, now);
  lowpass.Q.setValueAtTime(0.45, now);

  gain.gain.setValueAtTime(0.058, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(masterGain);
  source.start(now);
  source.stop(now + 0.034);
  source.addEventListener('ended', () => {
    source.disconnect();
    highpass.disconnect();
    lowpass.disconnect();
    gain.disconnect();
  }, { once: true });
}

export function useUIFrequencies() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const initial = persistedMuted();
    setMuted(initial);
    setEngineMuted(initial);

    const unlock = () => {
      userActivated = true;
      if (!engineMuted) {
        const ctx = ensureContext();
        if (ctx) resumeContext(ctx);
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    const onMute = (event: Event) => {
      const next = Boolean((event as CustomEvent<boolean>).detail);
      setMuted(next);
      setEngineMuted(next);
    };

    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener(MUTE_EVENT, onMute);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener(MUTE_EVENT, onMute);
    };
  }, []);

  const toggleMuted = useCallback(() => {
    userActivated = true;
    const next = !engineMuted;
    setEngineMuted(next);
    setMuted(next);
    try { window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent<boolean>(MUTE_EVENT, { detail: next }));
    if (!next) {
      const ctx = ensureContext();
      if (ctx) resumeContext(ctx);
    }
    return next;
  }, []);

  const playSearchResolved = useCallback(() => searchThud(), []);
  const playDockClick = useCallback(() => mechanicalClick(), []);

  return { muted, toggleMuted, playSearchResolved, playDockClick };
}
