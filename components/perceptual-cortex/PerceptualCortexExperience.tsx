'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { advanceWorld, createInputSnapshot, type InputSnapshot } from './fusionEngine';
import { usePerceptualStore } from './perceptualStore';
import { AudioSignalSource } from './AudioSignalSource';

const CortexCanvas = dynamic(() => import('./PerceptualCortexCanvas').then((m) => m.PerceptualCortexCanvas), { ssr: false });

const isEditable = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
};

export function PerceptualCortexExperience() {
  const { phase, seed, microscopeOpen, reducedMotion, start, crystallize, resume, reset, toggleMicroscope, setReducedMotion } = usePerceptualStore();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const input = useRef<InputSnapshot>(createInputSnapshot());
  const audioSource = useRef<AudioSignalSource | null>(null);
  const pointer = useRef({ x: 0, y: 0, time: 0 });
  const keyTimes = useRef<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [audioState, setAudioState] = useState<'off' | 'requesting' | 'active' | 'error'>('off');
  const [audioError, setAudioError] = useState('');

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
  }, [setReducedMotion]);

  useEffect(() => {
    if (phase !== 'performing') return;
    let raf = 0; let previous = performance.now(); let lastUiUpdate = previous;
    const tick = (now: number) => {
      const dt = Math.min(.05, (now - previous) / 1000); previous = now;
      if (input.current.audioActive && audioSource.current) input.current.audio = audioSource.current.sample(now);
      advanceWorld(usePerceptualStore.getState().worldSnapshot, input.current, now, dt);
      input.current.speed *= Math.exp(-dt * 4);
      const started = usePerceptualStore.getState().startedAt;
      if (started && now - lastUiUpdate >= 500) { setElapsed(now - started); lastUiUpdate = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => () => { void audioSource.current?.disable(); }, []);

  const toggleAudio = async () => {
    if (audioState === 'active') {
      await audioSource.current?.disable(); audioSource.current = null;
      input.current.audioActive = false; input.current.audio = createInputSnapshot().audio; setAudioState('off'); return;
    }
    setAudioState('requesting'); setAudioError('');
    const source = new AudioSignalSource();
    try { await source.enable(); audioSource.current = source; input.current.audioActive = true; setAudioState('active'); }
    catch (error) { await source.disable(); input.current.audioActive = false; setAudioError(error instanceof Error ? error.message : 'Microphone permission was not granted.'); setAudioState('error'); }
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') { if (microscopeOpen) toggleMicroscope(); else if (phase === 'crystallized') resume(); return; }
      const now = performance.now();
      const times = keyTimes.current; times.push(now); while (times.length > 8) times.shift();
      const intervals = times.slice(1).map((value, i) => value - times[i]);
      const mean = intervals.reduce((sum, value) => sum + value, 0) / Math.max(1, intervals.length);
      const variance = intervals.reduce((sum, value) => sum + Math.abs(value - mean), 0) / Math.max(1, intervals.length);
      input.current.keyImpulse = 1;
      input.current.cadence = Math.min(1, 1000 / Math.max(120, mean || 1000));
      input.current.cadenceVariation = Math.min(1, variance / Math.max(1, mean));
    };
    addEventListener('keydown', down); return () => removeEventListener('keydown', down);
  }, [microscopeOpen, phase, resume, toggleMicroscope]);

  const onPointerMove = (event: React.PointerEvent) => {
    if (phase !== 'performing') return;
    const now = performance.now(); const x = event.clientX / innerWidth * 2 - 1; const y = -(event.clientY / innerHeight * 2 - 1);
    const dt = Math.max(8, now - pointer.current.time) / 1000;
    input.current.speed = Math.hypot(x - pointer.current.x, y - pointer.current.y) / dt;
    Object.assign(input.current, { x, y, pointerActive: true, pointerType: event.pointerType || 'unknown' });
    pointer.current = { x, y, time: now };
  };
  const save = () => {
    if (!canvas.current) return;
    const link = document.createElement('a'); link.download = `perceptual-cortex-${seed}.png`; link.href = canvas.current.toDataURL('image/png'); link.click();
  };

  const world = usePerceptualStore.getState().worldSnapshot;
  return <section className="fixed inset-0 z-40 overflow-hidden bg-[#020306]" onPointerMove={onPointerMove} onPointerLeave={() => { input.current.pointerActive = false; }}>
    <div className="absolute inset-0"><CortexCanvas seed={seed} onCanvas={(value) => { canvas.current = value; }} /></div>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,rgba(2,3,6,.7)_100%)]" />
    <header className="absolute left-5 right-5 top-5 z-10 flex items-start justify-between font-mono sm:left-8 sm:right-8 sm:top-8">
      <div><p className="text-[10px] uppercase tracking-[.34em] text-cyan/60">multimodal neural instrument</p><h1 className="mt-2 text-sm uppercase tracking-[.22em] text-white/90">Perceptual Cortex</h1></div>
      <Link href="/photography" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-white/60 backdrop-blur hover:text-white">Exit</Link>
    </header>

    {phase === 'arrival' && <div className="absolute inset-0 z-20 grid place-items-center bg-[#020306]/45 p-6 backdrop-blur-[2px]">
      <div className="max-w-lg text-center"><p className="font-mono text-[10px] uppercase tracking-[.35em] text-rose/75">a dormant organism</p><h2 className="mt-5 text-3xl font-light tracking-[-.03em] text-white sm:text-5xl">Your signals give it temporary life.</h2><p className="mx-auto mt-5 max-w-md text-sm leading-6 text-white/55">Move, touch, or type rhythmically to excite and sculpt a synthetic neural field.</p><button onClick={start} className="mt-8 rounded-full border border-cyan/40 bg-cyan/10 px-7 py-3 font-mono text-xs uppercase tracking-[.22em] text-cyan hover:bg-cyan/20">Enter with pointer only</button><p className="mt-6 font-mono text-[9px] uppercase tracking-[.16em] text-white/35">No camera or microphone access · typing content is never read or stored</p></div>
    </div>}

    {phase !== 'arrival' && <div className="absolute bottom-5 left-5 right-5 z-10 flex flex-wrap items-end justify-between gap-4 sm:bottom-8 sm:left-8 sm:right-8">
      <div className="flex flex-wrap gap-2"><button onClick={toggleAudio} disabled={audioState === 'requesting'} className={`rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[.18em] backdrop-blur ${audioState === 'active' ? 'border-green/40 bg-green/10 text-green' : 'border-white/15 bg-black/35 text-white/65'}`}>{audioState === 'active' ? '● microphone active' : audioState === 'requesting' ? 'requesting…' : 'enable microphone'}</button><button onClick={toggleMicroscope} className="rounded-full border border-white/15 bg-black/35 px-4 py-2 font-mono text-[10px] uppercase tracking-[.18em] text-white/65 backdrop-blur">{microscopeOpen ? 'Hide signal' : 'Show the signal'}</button><label className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 font-mono text-[9px] uppercase tracking-[.14em] text-white/45"><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> reduced motion</label></div>
      {phase === 'performing' ? <button onClick={crystallize} className="rounded-full border border-rose/40 bg-rose/10 px-5 py-3 font-mono text-[10px] uppercase tracking-[.2em] text-rose">Crystallize this state</button> : <div className="flex gap-2"><button onClick={save} className="rounded-full border border-cyan/40 bg-cyan/10 px-5 py-3 font-mono text-[10px] uppercase tracking-[.2em] text-cyan">Save PNG</button><button onClick={() => reset(true)} className="rounded-full border border-white/15 bg-black/35 px-4 py-3 font-mono text-[10px] uppercase tracking-[.16em] text-white/60">Same seed</button><button onClick={() => reset(false)} className="rounded-full border border-white/15 bg-black/35 px-4 py-3 font-mono text-[10px] uppercase tracking-[.16em] text-white/60">New organism</button></div>}
    </div>}

    {microscopeOpen && phase !== 'arrival' && <aside className="absolute right-5 top-24 z-10 w-72 rounded-xl border border-white/10 bg-[#050914]/80 p-4 font-mono text-[10px] text-white/55 backdrop-blur-xl sm:right-8">
      <p className="uppercase tracking-[.24em] text-cyan/75">Signal microscope</p>{audioError && <p className="mt-3 rounded border border-rose/25 bg-rose/10 p-2 leading-4 text-rose/80">{audioError} Pointer mode remains available.</p>}<p className="mt-3 leading-5 text-white/35">signal → normalized features → temporal fusion → organism</p><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2"><dt>active</dt><dd className="text-right text-white/80">{world.activeModalities.join(', ')}</dd><dt>excitation</dt><dd className="text-right">{world.excitation.toFixed(3)}</dd><dt>coherence</dt><dd className="text-right">{world.coherence.toFixed(3)}</dd><dt>entropy</dt><dd className="text-right">{world.entropy.toFixed(3)}</dd><dt>plasticity</dt><dd className="text-right">{world.plasticity.toFixed(3)}</dd><dt>audio rms</dt><dd className="text-right">{input.current.audio.smoothedRms.toFixed(3)}</dd><dt>bass / mid / high</dt><dd className="text-right">{world.lowBand.toFixed(2)} / {world.midBand.toFixed(2)} / {world.highBand.toFixed(2)}</dd><dt>session</dt><dd className="text-right">{Math.floor(elapsed / 1000)}s</dd><dt>seed</dt><dd className="truncate text-right">{seed}</dd></dl><p className="mt-4 border-t border-white/10 pt-3 leading-5 text-white/35">Audio is analyzed locally and never recorded or saved. Typed characters are never retained.</p>
    </aside>}
  </section>;
}
