'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { advanceWorld, createInputSnapshot, type InputSnapshot } from './fusionEngine';
import { usePerceptualStore } from './perceptualStore';
import { AudioSignalSource } from './AudioSignalSource';
import { VisionSignalSource } from './VisionSignalSource';
import { ReplayRecorder, type ReplayFrame } from './replay';
import { interpretArtwork } from './artwork';
import { applySyntheticPreset, syntheticPresetLabels, type SyntheticPresetId } from './syntheticPresets';
import { initialQuality, adaptQuality, type QualityTier } from './quality';
import { visualThemeList, visualThemes, type VisualThemeId } from './visualThemes';
import { SoundscapeEngine } from './soundscape';

const CortexCanvas = dynamic(() => import('./PerceptualCortexCanvas').then((m) => m.PerceptualCortexCanvas), { ssr: false });

const isEditable = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
};

export function PerceptualCortexExperience() {
  const { phase, seed, microscopeOpen, reducedMotion, visualTheme, start, crystallize, resume, reset, toggleMicroscope, setReducedMotion, setVisualTheme } = usePerceptualStore();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const capture = useRef<(() => string) | null>(null);
  const input = useRef<InputSnapshot>(createInputSnapshot());
  const audioSource = useRef<AudioSignalSource | null>(null);
  const visionSource = useRef<VisionSignalSource | null>(null);
  const recorder = useRef(new ReplayRecorder());
  const soundscape = useRef<SoundscapeEngine | null>(null);
  const pointer = useRef({ x: 0, y: 0, time: 0 });
  const keyTimes = useRef<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [audioState, setAudioState] = useState<'off' | 'requesting' | 'active' | 'error'>('off');
  const [audioError, setAudioError] = useState('');
  const [visionState, setVisionState] = useState<'off' | 'requesting' | 'active' | 'error'>('off');
  const [visionError, setVisionError] = useState('');
  const [preset, setPreset] = useState<SyntheticPresetId | ''>('');
  const [quality, setQuality] = useState<QualityTier>('balanced');
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[]>([]);
  const [replaying, setReplaying] = useState(false);
  const [soundscapeActive, setSoundscapeActive] = useState(false);
  const [microscopeStats, setMicroscopeStats] = useState({ handsCount: 0, pinch: 0, audioRms: 0, replayCount: 0 });
  const replayStarted = useRef(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const media = matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(media.matches);
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      setQuality(initialQuality(innerWidth, memory));
    });
    return () => cancelAnimationFrame(frame);
  }, [setReducedMotion]);

  useEffect(() => {
    if (phase !== 'performing') return;
    let raf = 0; let previous = performance.now(); let lastUiUpdate = previous; let frameTotal = 0; let frameCount = 0;
    const tick = (now: number) => {
      const dt = Math.min(.05, (now - previous) / 1000); previous = now;
      if (input.current.audioActive && audioSource.current) input.current.audio = audioSource.current.sample(now);
      if (preset) applySyntheticPreset(input.current, preset, now);
      const liveWorld = usePerceptualStore.getState().worldSnapshot;
      if (replaying && replayFrames.length) { const replayTime = now - replayStarted.current; const frame = replayFrames.findLast((candidate) => candidate.timeMs <= replayTime) ?? replayFrames[0]; Object.assign(liveWorld, frame.world); soundscape.current?.update(frame.world, visualTheme); if (replayTime > replayFrames.at(-1)!.timeMs) { setReplaying(false); setSoundscapeActive(false); void soundscape.current?.stop(); soundscape.current = null; } }
      else { advanceWorld(liveWorld, input.current, now, dt); recorder.current.capture(now - (usePerceptualStore.getState().startedAt ?? now), liveWorld); }
      frameTotal += dt * 1000; frameCount += 1;
      input.current.speed *= Math.exp(-dt * 4);
      const started = usePerceptualStore.getState().startedAt;
      if (started && now - lastUiUpdate >= 1000) { setElapsed(now - started); setMicroscopeStats({ handsCount: input.current.hands.count, pinch: input.current.hands.pinch, audioRms: input.current.audio.smoothedRms, replayCount: recorder.current.snapshot().length }); if (frameCount) setQuality((current) => adaptQuality(current, frameTotal / frameCount)); frameTotal = 0; frameCount = 0; lastUiUpdate = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, preset, replayFrames, replaying, visualTheme]);

  const crystallizeSession = () => { setReplayFrames(recorder.current.snapshot()); crystallize(); };
  const playReplay = () => { if (!replayFrames.length) return; replayStarted.current = performance.now(); resume(); setReplaying(true); };
  const playSoundscape = async () => { if (!replayFrames.length) return; await soundscape.current?.stop(); const engine = new SoundscapeEngine(); await engine.start(); soundscape.current = engine; setSoundscapeActive(true); replayStarted.current = performance.now(); resume(); setReplaying(true); };

  useEffect(() => () => { void audioSource.current?.disable(); visionSource.current?.disable(); void soundscape.current?.stop(); }, []);

  const toggleVision = async () => {
    if (visionState === 'active') { visionSource.current?.disable(); visionSource.current = null; input.current.hands.active = false; input.current.face.active = false; setVisionState('off'); return; }
    setVisionState('requesting'); setVisionError(''); const source = new VisionSignalSource();
    try { await source.enable((hands, face) => { input.current.hands = hands; input.current.face = face; }, (message) => { setVisionError(message); setVisionState('error'); }); visionSource.current = source; setVisionState('active'); }
    catch (error) { source.disable(); setVisionError(error instanceof Error ? error.message : 'Camera permission was not granted.'); setVisionState('error'); }
  };

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
    const output = document.createElement('canvas'); output.width = 1920; output.height = 1080; const context = output.getContext('2d'); if (!context) return; const ctx = context;
    const highResolution = capture.current?.(); const source = highResolution ? Object.assign(new Image(), { src: highResolution }) : canvas.current;
    ctx.fillStyle = visualThemes[visualTheme].background; ctx.fillRect(0, 0, output.width, output.height);
    if (source instanceof HTMLCanvasElement) ctx.drawImage(source, 0, 0, output.width, output.height); else { source.onload = () => { ctx.drawImage(source, 0, 0, output.width, output.height); finishExport(); }; return; }
    finishExport();
    function finishExport() {
    const result = interpretArtwork(seed, usePerceptualStore.getState().worldSnapshot, visualTheme); ctx.fillStyle = 'rgba(255,255,255,.58)'; ctx.font = '24px monospace'; ctx.fillText(result.title.toUpperCase(), 54, 1020); ctx.font = '15px monospace'; ctx.fillText(`${result.theme.toUpperCase()} · SEED ${seed}`, 54, 1048);
    const link = document.createElement('a'); link.download = `perceptual-cortex-${seed}.png`; link.href = output.toDataURL('image/png'); link.click();
    }
  };

  const world = usePerceptualStore.getState().worldSnapshot;
  const artwork = interpretArtwork(seed, world, visualTheme);
  return <section className="fixed inset-0 z-40 overflow-hidden bg-[#020306]" onPointerMove={onPointerMove} onPointerLeave={() => { input.current.pointerActive = false; }}>
    <div className="absolute inset-0"><CortexCanvas seed={seed} quality={quality} themeId={visualTheme} onCanvas={(value) => { canvas.current = value; }} onCaptureReady={(value) => { capture.current = value; }} /></div>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,rgba(2,3,6,.7)_100%)]" />
    <header className="absolute left-5 right-5 top-5 z-10 flex items-start justify-between font-mono sm:left-8 sm:right-8 sm:top-8">
      <div><p className="text-[10px] uppercase tracking-[.34em] text-cyan/60">multimodal neural instrument</p><h1 className="mt-2 text-sm uppercase tracking-[.22em] text-white/90">Perceptual Cortex</h1><p className="mt-2 max-w-sm text-[9px] normal-case tracking-[.08em] text-white/35">{visualThemes[visualTheme].concept} · {visualThemes[visualTheme].description}</p></div>
      <div className="flex gap-2">
        <Link href="/rotation" className="rounded-full border border-amber/30 bg-amber/10 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-amber/80 backdrop-blur hover:text-amber">Rotation</Link>
        <Link href="/photography" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-white/60 backdrop-blur hover:text-white">Exit</Link>
      </div>
    </header>

    {phase === 'arrival' && <div className="absolute inset-0 z-20 grid place-items-center bg-[#020306]/45 p-6 backdrop-blur-[2px]">
      <div className="max-w-lg text-center"><p className="font-mono text-[10px] uppercase tracking-[.35em] text-rose/75">a dormant organism</p><h2 className="mt-5 text-3xl font-light tracking-[-.03em] text-white sm:text-5xl">Your signals give it temporary life.</h2><p className="mx-auto mt-5 max-w-md text-sm leading-6 text-white/55">Move, touch, or type rhythmically to excite and sculpt a synthetic neural field.</p><button onClick={start} className="mt-8 rounded-full border border-cyan/40 bg-cyan/10 px-7 py-3 font-mono text-xs uppercase tracking-[.22em] text-cyan hover:bg-cyan/20">Enter with pointer only</button><p className="mt-6 font-mono text-[9px] uppercase tracking-[.16em] text-white/35">No camera or microphone access · typing content is never read or stored</p></div>
    </div>}

    {phase !== 'arrival' && <div className="absolute bottom-5 left-5 right-5 z-10 flex flex-wrap items-end justify-between gap-4 sm:bottom-8 sm:left-8 sm:right-8">
      <select aria-label="Conceptual color theme" value={visualTheme} onChange={(event) => setVisualTheme(event.target.value as VisualThemeId)} className="rounded-full border border-white/15 bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-white/65">{visualThemeList.map((theme) => <option key={theme.id} value={theme.id}>{theme.label} · {theme.concept}</option>)}</select>
      <div className="flex max-w-[78vw] flex-wrap gap-2"><button onClick={toggleVision} disabled={visionState === 'requesting'} className={`rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[.18em] backdrop-blur ${visionState === 'active' ? 'border-violet/40 bg-violet/10 text-violet' : 'border-white/15 bg-black/35 text-white/65'}`}>{visionState === 'active' ? '● camera active' : visionState === 'requesting' ? 'loading vision…' : 'enable camera'}</button><button onClick={toggleAudio} disabled={audioState === 'requesting'} className={`rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[.18em] backdrop-blur ${audioState === 'active' ? 'border-green/40 bg-green/10 text-green' : 'border-white/15 bg-black/35 text-white/65'}`}>{audioState === 'active' ? '● microphone active' : audioState === 'requesting' ? 'requesting…' : 'enable microphone'}</button><select aria-label="Synthetic demonstration" value={preset} onChange={(event) => setPreset(event.target.value as SyntheticPresetId | '')} className="rounded-full border border-white/15 bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-white/65"><option value="">synthetic demo</option>{Object.entries(syntheticPresetLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button onClick={toggleMicroscope} className="rounded-full border border-white/15 bg-black/35 px-4 py-2 font-mono text-[10px] uppercase tracking-[.18em] text-white/65 backdrop-blur">{microscopeOpen ? 'Hide signal' : 'Show the signal'}</button><label className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 font-mono text-[9px] uppercase tracking-[.14em] text-white/45"><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> reduced motion</label></div>
      {phase === 'performing' ? <button onClick={crystallizeSession} className="rounded-full border border-rose/40 bg-rose/10 px-5 py-3 font-mono text-[10px] uppercase tracking-[.2em] text-rose">Crystallize this state</button> : <div className="flex flex-wrap gap-2"><button onClick={playSoundscape} disabled={!replayFrames.length || soundscapeActive} className="rounded-full border border-amber/40 bg-amber/10 px-5 py-3 font-mono text-[10px] uppercase tracking-[.18em] text-amber">{soundscapeActive ? '● soundscape playing' : 'enter audiovisual soundscape'}</button><button onClick={save} className="rounded-full border border-cyan/40 bg-cyan/10 px-5 py-3 font-mono text-[10px] uppercase tracking-[.2em] text-cyan">Save PNG</button><button onClick={playReplay} disabled={!replayFrames.length} className="rounded-full border border-violet/30 bg-violet/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[.16em] text-violet">Replay</button><button onClick={() => reset(true)} className="rounded-full border border-white/15 bg-black/35 px-4 py-3 font-mono text-[10px] uppercase tracking-[.16em] text-white/60">Same seed</button><button onClick={() => reset(false)} className="rounded-full border border-white/15 bg-black/35 px-4 py-3 font-mono text-[10px] uppercase tracking-[.16em] text-white/60">New organism</button></div>}
    </div>}

    {microscopeOpen && phase !== 'arrival' && <aside className="absolute right-5 top-24 z-10 w-72 rounded-xl border border-white/10 bg-[#050914]/80 p-4 font-mono text-[10px] text-white/55 backdrop-blur-xl sm:right-8">
      <p className="uppercase tracking-[.24em] text-cyan/75">Signal microscope · {quality}</p>{(audioError || visionError) && <p className="mt-3 rounded border border-rose/25 bg-rose/10 p-2 leading-4 text-rose/80">{audioError || visionError} Pointer mode remains available.</p>}<p className="mt-3 leading-5 text-white/35">signal → normalized features → temporal fusion → organism</p><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2"><dt>active</dt><dd className="text-right text-white/80">{world.activeModalities.join(', ')}</dd><dt>excitation</dt><dd className="text-right">{world.excitation.toFixed(3)}</dd><dt>coherence</dt><dd className="text-right">{world.coherence.toFixed(3)}</dd><dt>hands / speed</dt><dd className="text-right">{microscopeStats.handsCount} / {world.handSpeed.toFixed(2)}</dd><dt>pinch / separation</dt><dd className="text-right">{microscopeStats.pinch.toFixed(2)} / {world.handSeparation.toFixed(2)}</dd><dt>face activity</dt><dd className="text-right">{world.facialActivity.toFixed(3)}</dd><dt>audio rms</dt><dd className="text-right">{microscopeStats.audioRms.toFixed(3)}</dd><dt>session / replay</dt><dd className="text-right">{Math.floor(elapsed / 1000)}s / {microscopeStats.replayCount}</dd><dt>seed</dt><dd className="truncate text-right">{seed}</dd></dl><p className="mt-4 border-t border-white/10 pt-3 leading-5 text-white/35">Camera and audio are processed locally. No imagery, audio, landmarks, or typed content is saved.</p>
    </aside>}
    {phase === 'crystallized' && !microscopeOpen && <aside className="absolute left-5 top-24 z-10 w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-white/10 bg-[#050914]/80 p-5 backdrop-blur-xl sm:left-8"><p className="font-mono text-[9px] uppercase tracking-[.24em] text-rose/70">crystallized signal</p><h2 className="mt-3 text-xl font-light text-white">{artwork.title}</h2><dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs text-white/45"><dt>Dominant influence</dt><dd className="text-right text-white/75">{artwork.dominantInfluence}</dd><dt>Temporal character</dt><dd className="text-right text-white/75">{artwork.temporalCharacter}</dd><dt>Spatial character</dt><dd className="text-right text-white/75">{artwork.spatialCharacter}</dd><dt>Excitation profile</dt><dd className="text-right text-white/75">{artwork.excitationProfile}</dd><dt>Active modalities</dt><dd className="text-right text-white/75">{artwork.activeModalities.join(', ')}</dd></dl><p className="mt-4 text-[10px] leading-4 text-white/30">An interpretation of creative control signals, not a psychological assessment.</p></aside>}
  </section>;
}
