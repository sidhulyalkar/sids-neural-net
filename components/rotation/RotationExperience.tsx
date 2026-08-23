'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { advanceWorld, createInputSnapshot, type InputSnapshot } from '../perceptual-cortex/fusionEngine';
import { silentAudioFeatures } from '../perceptual-cortex/audioFeatures';
import { usePerceptualStore } from '../perceptual-cortex/perceptualStore';
import { VisionSignalSource } from '../perceptual-cortex/VisionSignalSource';
import { sample, timelineFromTrack, type MusicTimeline } from '../perceptual-cortex/musicTimeline';
import { initialQuality } from '../perceptual-cortex/quality';
import { visualThemeList, type VisualThemeId } from '../perceptual-cortex/visualThemes';
import { parseManifest, type Track } from '@/lib/spotify/manifest';
import { useHydrated, useMediaQuery, useViewportWidth } from '@/lib/hooks/useBrowserState';
import manifestData from '@/content/music/top-tracks.json';
import { TrackGallery } from './TrackGallery';
import { SpotifyEmbed } from './SpotifyEmbed';
import type { MusicPlaybackController, PlaybackState } from './MusicSignalSource';

const CortexCanvas = dynamic(() => import('../perceptual-cortex/PerceptualCortexCanvas').then((module) => module.PerceptualCortexCanvas), { ssr: false });
const MUSIC_INTENSITY = 1.4;
const manifest = parseManifest(manifestData);

type TimelineState = 'none' | 'curated-fallback' | 'analyzed';

export function RotationExperience() {
  const { seed, visualTheme, reducedMotion, start, setReducedMotion, setVisualTheme } = usePerceptualStore();
  const hydrated = useHydrated();
  const viewportWidth = useViewportWidth();
  const systemReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const effectiveReducedMotion = reducedMotion || systemReducedMotion;
  const quality = useMemo(() => {
    const memory = hydrated ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
    return initialQuality(viewportWidth, memory);
  }, [hydrated, viewportWidth]);

  const canvas = useRef<HTMLCanvasElement | null>(null);
  const capture = useRef<(() => string) | null>(null);
  const input = useRef<InputSnapshot>(createInputSnapshot());
  const controller = useRef<MusicPlaybackController | null>(null);
  const timeline = useRef<MusicTimeline | null>(null);
  const flash = useRef<HTMLDivElement | null>(null);
  const pointer = useRef({ x: 0, y: 0, time: 0 });
  const visionSource = useRef<VisionSignalSource | null>(null);
  const [selected, setSelected] = useState<Track | null>(null);
  const [visionState, setVisionState] = useState<'off' | 'requesting' | 'active' | 'error'>('off');
  const [playbackState, setPlaybackState] = useState<PlaybackState>('loading');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [timelineState, setTimelineState] = useState<TimelineState>('none');

  useEffect(() => {
    start();
  }, [start]);

  const selectTrack = async (track: Track) => {
    setSelected(track);
    setPlaybackError(null);
    timeline.current = timelineFromTrack(track);
    setTimelineState('curated-fallback');
    try {
      const response = await fetch(`/music/timelines/${track.spotifyId}.json`, { cache: 'force-cache' });
      if (!response.ok) return;
      const candidate = (await response.json()) as MusicTimeline;
      if (candidate.version === 1 && Number.isFinite(candidate.bpm) && candidate.bpm > 0 && candidate.durationMs > 0) {
        timeline.current = candidate;
        setTimelineState('analyzed');
      }
    } catch {
      // The curated fallback is intentionally sufficient for every catalog item.
    }
  };

  const onController = useCallback((created: MusicPlaybackController) => {
    controller.current = created;
    setPlaybackState(created.playbackState);
  }, []);

  useEffect(() => {
    let raf = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const music = controller.current;
      if (music && timeline.current && music.isPlaying) {
        const features = sample(timeline.current, music.getPositionMs(), MUSIC_INTENSITY);
        input.current.audio = features;
        input.current.audioActive = true;
        if (flash.current) flash.current.style.opacity = String(0.08 + features.onset * 0.32);
      } else {
        input.current.audioActive = false;
        input.current.audio = silentAudioFeatures();
        if (flash.current) flash.current.style.opacity = '0';
      }
      const world = usePerceptualStore.getState().worldSnapshot;
      advanceWorld(world, input.current, now, dt);
      input.current.speed *= Math.exp(-dt * 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => {
    controller.current?.destroy();
    visionSource.current?.disable();
  }, []);

  const toggleVision = async () => {
    if (visionState === 'active') {
      visionSource.current?.disable();
      visionSource.current = null;
      input.current.hands.active = false;
      input.current.face.active = false;
      setVisionState('off');
      return;
    }
    setVisionState('requesting');
    const source = new VisionSignalSource();
    try {
      await source.enable(
        (hands, face) => { input.current.hands = hands; input.current.face = face; },
        () => setVisionState('error'),
      );
      visionSource.current = source;
      setVisionState('active');
    } catch {
      source.disable();
      setVisionState('error');
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const now = performance.now();
    const x = event.clientX / innerWidth * 2 - 1;
    const y = -(event.clientY / innerHeight * 2 - 1);
    const dt = Math.max(8, now - pointer.current.time) / 1000;
    input.current.speed = Math.hypot(x - pointer.current.x, y - pointer.current.y) / dt;
    Object.assign(input.current, { x, y, pointerActive: true, pointerType: event.pointerType || 'unknown' });
    pointer.current = { x, y, time: now };
  };

  const playbackLabel = playbackState === 'playing'
    ? 'beat locked'
    : playbackState === 'paused' || playbackState === 'ready'
      ? 'press play in Spotify'
      : playbackState === 'error'
        ? 'Spotify unavailable'
        : 'loading Spotify';

  return (
    <section className="fixed inset-0 z-40 overflow-hidden bg-[#020306]" onPointerMove={onPointerMove} onPointerLeave={() => { input.current.pointerActive = false; }}>
      <div className="absolute inset-0"><CortexCanvas seed={seed} quality={quality} themeId={visualTheme} onCanvas={(value) => { canvas.current = value; }} onCaptureReady={(value) => { capture.current = value; }} /></div>
      <div ref={flash} className="pointer-events-none absolute inset-0 bg-white mix-blend-overlay" style={{ opacity: 0, transition: 'opacity 60ms linear' }} />

      <header className="absolute left-5 right-5 top-5 z-10 flex items-start justify-between font-mono sm:left-8 sm:right-8 sm:top-8">
        <div>
          <p className="text-[10px] uppercase tracking-[.34em] text-amber/70">music + signal reactive cortex</p>
          <h1 className="mt-2 text-sm uppercase tracking-[.22em] text-white/90">Sid&apos;s Rotation</h1>
          <p className="mt-2 max-w-lg text-[9px] normal-case leading-4 tracking-[.08em] text-white/40">Choose a track, press play in the Spotify player, and its playback position drives the same fusion engine as your pointer and optional local camera features. No song audio is copied or stored by this site.</p>
        </div>
        <Link href="/perceptual-cortex" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-white/60 backdrop-blur hover:text-white">Cortex</Link>
      </header>

      <aside className="absolute bottom-5 left-5 right-5 z-10 max-h-[46vh] overflow-y-auto rounded-xl border border-white/10 bg-[#050914]/86 p-4 backdrop-blur-xl sm:left-8 sm:right-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <select aria-label="Conceptual color theme" value={visualTheme} onChange={(event) => setVisualTheme(event.target.value as VisualThemeId)} className="rounded-full border border-white/15 bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-white/65">
            {visualThemeList.map((theme) => <option key={theme.id} value={theme.id}>{theme.label} · {theme.concept}</option>)}
          </select>
          <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em] text-white/45"><input type="checkbox" checked={effectiveReducedMotion} disabled={systemReducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /> reduced motion{systemReducedMotion ? ' · system' : ''}</label>
          <button type="button" onClick={toggleVision} disabled={visionState === 'requesting'} className={`rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[.18em] backdrop-blur ${visionState === 'active' ? 'border-violet/40 bg-violet/10 text-violet' : 'border-white/15 bg-black/35 text-white/65'}`}>{visionState === 'active' ? '● camera active' : visionState === 'requesting' ? 'loading vision…' : visionState === 'error' ? 'retry camera' : 'enable local camera'}</button>
        </div>

        {selected && (
          <div className="mb-3 rounded-lg border border-white/8 bg-black/20 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[.13em]"><span className={playbackState === 'playing' ? 'text-green/80' : playbackState === 'error' ? 'text-rose/80' : 'text-white/45'}>{playbackLabel}</span><span className="text-white/35">timing: {timelineState === 'analyzed' ? 'analyzed grid' : 'curated tempo fallback'}</span></div>
            {playbackError ? <p className="mb-2 text-[10px] leading-4 text-rose/80">Spotify could not initialize here. The visual experience and camera/pointer controls still work; use the external Spotify link for playback.</p> : null}
            <SpotifyEmbed uri={`spotify:track:${selected.spotifyId}`} onController={onController} onStatus={setPlaybackState} onError={(message) => { setPlaybackError(message); setPlaybackState('error'); }} />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><a href={selected.spotifyUrl} target="_blank" rel="noreferrer" className="font-mono text-[9px] uppercase tracking-[.16em] text-green/70 hover:text-green">Listen on Spotify ↗</a><span className="font-mono text-[9px] text-white/30">{selected.bpm} BPM · {selected.artist}</span></div>
          </div>
        )}

        <TrackGallery tracks={manifest.tracks} selectedId={selected?.spotifyId ?? null} onSelect={selectTrack} />
        <p className="mt-3 border-t border-white/10 pt-3 font-mono text-[9px] leading-4 text-white/30">16 curated tracks. Spotify owns playback; this site stores only track metadata and derived/curated timing. Missing analyzed grids fall back to explicit tempo-based timing instead of disabling the visual signal.</p>
      </aside>
    </section>
  );
}
