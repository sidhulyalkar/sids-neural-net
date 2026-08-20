'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { advanceWorld, createInputSnapshot, type InputSnapshot } from '../perceptual-cortex/fusionEngine';
import { usePerceptualStore } from '../perceptual-cortex/perceptualStore';
import { VisionSignalSource } from '../perceptual-cortex/VisionSignalSource';
import { initialQuality, type QualityTier } from '../perceptual-cortex/quality';
import { visualThemeList, type VisualThemeId } from '../perceptual-cortex/visualThemes';
import { parseManifest, type TimeRange, type Track } from '@/lib/spotify/manifest';
import manifestData from '@/content/music/top-tracks.json';
import { ArtistShelf } from './ArtistShelf';
import { SpotifyEmbed } from './SpotifyEmbed';
import { TrackGallery } from './TrackGallery';
import {
  comparisonRange,
  coreTrackIds,
  formatGeneratedAt,
  listeningSummary,
  timeRangeMeta,
} from './listeningStats';

const CortexCanvas = dynamic(
  () => import('../perceptual-cortex/PerceptualCortexCanvas').then((module) => module.PerceptualCortexCanvas),
  { ssr: false },
);

const manifest = parseManifest(manifestData);
const ranges: TimeRange[] = ['short_term', 'medium_term', 'long_term'];
const ignoreCanvas = (_canvas: HTMLCanvasElement) => undefined;
const ignoreCapture = (_capture: () => string) => undefined;

function Metric({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
      <p className="font-mono text-xl text-white/90">{value}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[.18em] text-amber/70">{label}</p>
      <p className="mt-2 text-[11px] leading-4 text-white/35">{note}</p>
    </div>
  );
}

export function RotationExperience() {
  const { seed, visualTheme, reducedMotion, start, setReducedMotion, setVisualTheme } = usePerceptualStore();
  const input = useRef<InputSnapshot>(createInputSnapshot());
  const pointer = useRef({ x: 0, y: 0, time: 0 });
  const visionSource = useRef<VisionSignalSource | null>(null);
  const [quality, setQuality] = useState<QualityTier>('balanced');
  const [visionState, setVisionState] = useState<'off' | 'requesting' | 'active' | 'error'>('off');
  const [range, setRange] = useState<TimeRange>('medium_term');
  const [selected, setSelected] = useState<Track | null>(null);

  const snapshot = manifest.snapshots[range];
  const previousRange = comparisonRange(range);
  const comparisonTracks = manifest.snapshots[previousRange].tracks;
  const summary = useMemo(() => listeningSummary(manifest, range), [range]);
  const coreIds = useMemo(() => coreTrackIds(manifest), []);

  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setQuality(initialQuality(innerWidth, memory));
    setReducedMotion(matchMedia('(prefers-reduced-motion: reduce)').matches);
    start();
  }, [setReducedMotion, start]);

  useEffect(() => {
    if (selected && !snapshot.tracks.some((track) => track.spotifyId === selected.spotifyId)) {
      setSelected(null);
    }
  }, [range, selected, snapshot.tracks]);

  useEffect(() => {
    let raf = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      // Spotify playback is deliberately not synchronized to the visual layer.
      input.current.audioActive = false;
      const world = usePerceptualStore.getState().worldSnapshot;
      advanceWorld(world, input.current, now, dt);
      input.current.speed *= Math.exp(-dt * 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => visionSource.current?.disable(), []);

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
        (hands, face) => {
          input.current.hands = hands;
          input.current.face = face;
        },
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
    const x = (event.clientX / innerWidth) * 2 - 1;
    const y = -(event.clientY / innerHeight) * 2 + 1;
    const dt = Math.max(8, now - pointer.current.time) / 1000;
    input.current.speed = Math.hypot(x - pointer.current.x, y - pointer.current.y) / dt;
    Object.assign(input.current, {
      x,
      y,
      pointerActive: true,
      pointerType: event.pointerType || 'unknown',
    });
    pointer.current = { x, y, time: now };
  };

  return (
    <section
      className="fixed inset-0 z-40 overflow-hidden bg-[#020306]"
      onPointerMove={onPointerMove}
      onPointerLeave={() => { input.current.pointerActive = false; }}
    >
      <div className="absolute inset-0 opacity-70">
        <CortexCanvas
          seed={seed}
          quality={quality}
          themeId={visualTheme}
          onCanvas={ignoreCanvas}
          onCaptureReady={ignoreCapture}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(2,3,6,.18),rgba(2,3,6,.72)_50%,rgba(2,3,6,.96)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#020306]/30 via-[#020306]/55 to-[#020306]" />

      <div className="relative z-10 h-full overflow-y-auto overscroll-contain">
        <header className="sticky top-0 z-20 border-b border-white/[.07] bg-[#020306]/75 px-5 py-4 backdrop-blur-2xl sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[.3em] text-amber/70">rotation / listening fingerprint</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[.16em] text-white/35">Spotify Top Items · refreshed {formatGeneratedAt(manifest.generatedAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleVision}
                disabled={visionState === 'requesting'}
                className={`rounded-full border px-3 py-2 font-mono text-[9px] uppercase tracking-[.16em] backdrop-blur transition ${
                  visionState === 'active'
                    ? 'border-violet/40 bg-violet/10 text-violet'
                    : 'border-white/10 bg-black/30 text-white/50 hover:text-white/80'
                }`}
              >
                {visionState === 'active' ? '● camera reactive' : visionState === 'requesting' ? 'loading camera…' : 'camera reacts'}
              </button>
              <Link href="/perceptual-cortex" className="rounded-full border border-white/10 bg-black/30 px-3 py-2 font-mono text-[9px] uppercase tracking-[.16em] text-white/50 hover:text-white/80">
                Cortex
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
          {manifest.isPlaceholder && (
            <div className="mb-6 rounded-xl border border-amber/30 bg-amber/10 p-4 font-mono text-[10px] leading-5 text-amber/80 backdrop-blur-xl">
              Spotify data is not published yet. Run <code>npm run music:fetch</code> with the private owner credentials to replace this development placeholder.
            </div>
          )}

          <section className="grid gap-8 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.28em] text-green/70">personal signal, three horizons</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-medium tracking-[-.035em] text-white sm:text-6xl">
                The music that keeps finding its way back.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
                A living map of my current rotation, persistent favorites, and long-running listening gravity. Spotify ranks Top Items by calculated affinity, so these are directional listening signals rather than literal play counts.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-2xl">
              <p className="font-mono text-[9px] uppercase tracking-[.2em] text-white/35">visual layer</p>
              <p className="mt-2 text-sm leading-5 text-white/65">The neural field responds to your pointer and optional camera gestures. Spotify playback stays deliberately independent.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <select
                  aria-label="Visual theme"
                  value={visualTheme}
                  onChange={(event) => setVisualTheme(event.target.value as VisualThemeId)}
                  className="max-w-full rounded-full border border-white/10 bg-black/60 px-3 py-2 font-mono text-[9px] uppercase tracking-[.12em] text-white/55"
                >
                  {visualThemeList.map((theme) => (
                    <option key={theme.id} value={theme.id}>{theme.label} · {theme.concept}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-white/45">
                  <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
                  reduced motion
                </label>
              </div>
            </div>
          </section>

          <nav aria-label="Listening time range" className="mt-10 flex w-full flex-wrap gap-2 border-b border-white/10 pb-4">
            {ranges.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={range === item}
                onClick={() => setRange(item)}
                className={`rounded-full border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[.17em] transition ${
                  range === item
                    ? 'border-amber/50 bg-amber/10 text-amber'
                    : 'border-white/10 bg-black/20 text-white/40 hover:border-white/20 hover:text-white/65'
                }`}
              >
                {timeRangeMeta[item].shortLabel}
              </button>
            ))}
            <p className="ml-auto self-center font-mono text-[9px] uppercase tracking-[.13em] text-white/30">{timeRangeMeta[range].description}</p>
          </nav>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric value={String(summary.coreTracks)} label="core tracks" note="Top-20 tracks present in all three listening windows." />
            <Metric value={String(summary.freshEntries)} label="fresh entries" note={`Tracks in this window absent from ${timeRangeMeta[previousRange].shortLabel}.`} />
            <Metric value={String(summary.uniquePrimaryArtists)} label="artist breadth" note="Unique primary artists represented in this Top 20." />
            <Metric value={`${Math.round(summary.overlap.ratio * 100)}%`} label="window overlap" note={`${summary.overlap.count} shared tracks versus ${timeRangeMeta[previousRange].shortLabel}.`} />
          </section>

          {selected && !manifest.isPlaceholder && (
            <section className="mt-8 grid gap-4 rounded-2xl border border-green/20 bg-[#06110c]/70 p-4 backdrop-blur-2xl lg:grid-cols-[1fr_1.4fr] lg:p-5">
              <div className="self-center">
                <p className="font-mono text-[9px] uppercase tracking-[.2em] text-green/65">selected from #{selected.rank}</p>
                <h2 className="mt-2 text-2xl text-white/90">{selected.title}</h2>
                <p className="mt-1 text-sm text-white/45">{selected.artist} · {selected.album}</p>
                {coreIds.has(selected.spotifyId) && <p className="mt-3 font-mono text-[9px] uppercase tracking-[.16em] text-amber/75">core signal · appears in every horizon</p>}
                <a href={selected.spotifyUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block font-mono text-[9px] uppercase tracking-[.16em] text-green/75 hover:text-green">Listen on Spotify ↗</a>
              </div>
              <SpotifyEmbed spotifyId={selected.spotifyId} title={selected.title} />
            </section>
          )}

          <section className="mt-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[.22em] text-amber/70">ranked tracks</p>
                <h2 className="mt-2 text-2xl text-white/90">Top 20 · {timeRangeMeta[range].label}</h2>
              </div>
              <p className="max-w-md text-right font-mono text-[9px] leading-4 text-white/30">Movement compares this window with {timeRangeMeta[previousRange].label.toLowerCase()}. NEW means it does not appear in that comparison Top 20.</p>
            </div>
            <TrackGallery
              tracks={snapshot.tracks}
              comparisonTracks={comparisonTracks}
              selectedId={selected?.spotifyId ?? null}
              onSelect={setSelected}
            />
          </section>

          <section className="mt-14 border-t border-white/10 pt-10">
            <div className="mb-5">
              <p className="font-mono text-[9px] uppercase tracking-[.22em] text-violet/70">artist gravity</p>
              <h2 className="mt-2 text-2xl text-white/90">The names shaping this window</h2>
            </div>
            <ArtistShelf artists={snapshot.artists} />
          </section>

          <footer className="mt-14 grid gap-5 border-t border-white/10 pt-6 text-[10px] leading-5 text-white/30 sm:grid-cols-2">
            <p>Top-track and top-artist metadata are supplied by Spotify and refreshed from the owner account using the <code>user-top-read</code> scope. Artwork and metadata link back to Spotify.</p>
            <p className="sm:text-right">No visitor Spotify login is required. No Spotify audio is downloaded, analyzed, reconstructed, or synchronized to the visual field.</p>
          </footer>
        </main>
      </div>
    </section>
  );
}
