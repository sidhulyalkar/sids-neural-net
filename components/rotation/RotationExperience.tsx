'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceWorld, createInputSnapshot, type InputSnapshot } from '../perceptual-cortex/fusionEngine';
import { usePerceptualStore } from '../perceptual-cortex/perceptualStore';
import { sample, type MusicTimeline } from '../perceptual-cortex/musicTimeline';
import { initialQuality, type QualityTier } from '../perceptual-cortex/quality';
import { visualThemeList, type VisualThemeId } from '../perceptual-cortex/visualThemes';
import { parseManifest, type Track } from '@/lib/spotify/manifest';
import manifestData from '@/content/music/top-tracks.json';
import { TrackGallery } from './TrackGallery';
import { SpotifyEmbed } from './SpotifyEmbed';
import type { MusicPlaybackController } from './MusicSignalSource';

const CortexCanvas = dynamic(() => import('../perceptual-cortex/PerceptualCortexCanvas').then((m) => m.PerceptualCortexCanvas), { ssr: false });

const MUSIC_INTENSITY = 1.4;
const manifest = parseManifest(manifestData);

export function RotationExperience() {
  const { seed, visualTheme, reducedMotion, start, setReducedMotion, setVisualTheme } = usePerceptualStore();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const capture = useRef<(() => string) | null>(null);
  const input = useRef<InputSnapshot>(createInputSnapshot());
  const controller = useRef<MusicPlaybackController | null>(null);
  const timeline = useRef<MusicTimeline | null>(null);
  const flash = useRef<HTMLDivElement | null>(null);
  const pointer = useRef({ x: 0, y: 0, time: 0 });
  const [selected, setSelected] = useState<Track | null>(null);
  const [quality, setQuality] = useState<QualityTier>('balanced');

  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setQuality(initialQuality(innerWidth, memory));
    setReducedMotion(matchMedia('(prefers-reduced-motion: reduce)').matches);
    start();
  }, [setReducedMotion, start]);

  const selectTrack = async (track: Track) => {
    setSelected(track);
    timeline.current = null;
    try {
      const response = await fetch(`/music/timelines/${track.spotifyId}.json`);
      timeline.current = response.ok ? ((await response.json()) as MusicTimeline) : null;
    } catch {
      timeline.current = null;
    }
  };

  const onController = useCallback((created: MusicPlaybackController) => {
    controller.current = created;
    created.play();
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

  useEffect(() => () => { controller.current?.destroy(); }, []);

  const onPointerMove = (event: React.PointerEvent) => {
    const now = performance.now();
    const x = event.clientX / innerWidth * 2 - 1;
    const y = -(event.clientY / innerHeight * 2 - 1);
    const dt = Math.max(8, now - pointer.current.time) / 1000;
    input.current.speed = Math.hypot(x - pointer.current.x, y - pointer.current.y) / dt;
    Object.assign(input.current, { x, y, pointerActive: true, pointerType: event.pointerType || 'unknown' });
    pointer.current = { x, y, time: now };
  };

  return (
    <section className="fixed inset-0 z-40 overflow-hidden bg-[#020306]" onPointerMove={onPointerMove} onPointerLeave={() => { input.current.pointerActive = false; }}>
      <div className="absolute inset-0"><CortexCanvas seed={seed} quality={quality} themeId={visualTheme} onCanvas={(v) => { canvas.current = v; }} onCaptureReady={(v) => { capture.current = v; }} /></div>
      <div ref={flash} className="pointer-events-none absolute inset-0 bg-white mix-blend-overlay" style={{ opacity: 0, transition: 'opacity 60ms linear' }} />

      <header className="absolute left-5 right-5 top-5 z-10 flex items-start justify-between font-mono sm:left-8 sm:right-8 sm:top-8">
        <div>
          <p className="text-[10px] uppercase tracking-[.34em] text-amber/70">gesture-reactive rotation</p>
          <h1 className="mt-2 text-sm uppercase tracking-[.22em] text-white/90">Sid&apos;s Rotation</h1>
          <p className="mt-2 max-w-sm text-[9px] normal-case tracking-[.08em] text-white/35">Pick a track — the organism reacts to the beat and to your hands, face, and pointer. Real audio streams from Spotify.</p>
        </div>
        <Link href="/perceptual-cortex" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-white/60 backdrop-blur hover:text-white">Cortex</Link>
      </header>

      <aside className="absolute bottom-5 left-5 right-5 z-10 max-h-[42vh] overflow-y-auto rounded-xl border border-white/10 bg-[#050914]/80 p-4 backdrop-blur-xl sm:left-8 sm:right-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <select aria-label="Conceptual color theme" value={visualTheme} onChange={(e) => setVisualTheme(e.target.value as VisualThemeId)} className="rounded-full border border-white/15 bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-white/65">
            {visualThemeList.map((theme) => <option key={theme.id} value={theme.id}>{theme.label} · {theme.concept}</option>)}
          </select>
          <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em] text-white/45"><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> reduced motion</label>
        </div>
        {selected && (
          <div className="mb-3">
            <SpotifyEmbed uri={`spotify:track:${selected.spotifyId}`} onController={onController} />
            <a href={selected.spotifyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-[9px] uppercase tracking-[.16em] text-green/70 hover:text-green">Listen on Spotify ↗</a>
          </div>
        )}
        <TrackGallery tracks={manifest.tracks} selectedId={selected?.spotifyId ?? null} onSelect={selectTrack} />
        <p className="mt-3 border-t border-white/10 pt-3 font-mono text-[9px] leading-4 text-white/30">Audio streams from Spotify. This site stores only derived beat timing — never song audio.</p>
      </aside>
    </section>
  );
}
