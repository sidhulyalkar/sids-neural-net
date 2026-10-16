'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Pause, Play, RotateCcw } from 'lucide-react';
import type { VisualMotionEntry, VisualMotionSource } from '@/src/data/visualMotion';

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function preferredSource(entry: VisualMotionEntry) {
  return entry.sources.find((source) => source.type === 'video/mp4') ?? entry.sources[0];
}

function MotionCard({ entry }: { entry: VisualMotionEntry }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selectedSrc, setSelectedSrc] = useState(() => preferredSource(entry)?.src ?? '');
  const selected = useMemo(
    () => entry.sources.find((source) => source.src === selectedSrc) ?? preferredSource(entry),
    [entry, selectedSrc]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [loaded]);

  const togglePlayback = async () => {
    if (!loaded) {
      setLoaded(true);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play().catch(() => undefined);
    else video.pause();
  };

  const chooseSource = (source: VisualMotionSource) => {
    const video = videoRef.current;
    const time = video?.currentTime ?? 0;
    const wasPlaying = Boolean(video && !video.paused);
    setSelectedSrc(source.src);
    requestAnimationFrame(() => {
      const next = videoRef.current;
      if (!next) return;
      next.currentTime = Math.min(time, Math.max(0, entry.durationSeconds - 0.1));
      if (wasPlaying) void next.play().catch(() => undefined);
    });
  };

  const fullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;
    await video.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <article className="group overflow-hidden border border-white/10 bg-black/35 shadow-[0_20px_60px_rgba(0,0,0,.28)]">
      <div className="relative overflow-hidden bg-black" style={{ aspectRatio: entry.aspectRatio }}>
        {!loaded ? (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full text-left"
            aria-label={`Load video: ${entry.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.posterSrc} alt={entry.alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/10" />
            <span className="absolute left-5 top-5 border border-white/15 bg-black/45 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/60 backdrop-blur-md">motion · {formatDuration(entry.durationSeconds)}</span>
            <span className="absolute bottom-5 left-5 flex h-12 w-12 items-center justify-center border border-cyan/45 bg-black/55 text-cyan shadow-[0_0_30px_rgba(91,222,255,.15)] backdrop-blur-md transition group-hover:border-cyan/80 group-hover:bg-cyan/10">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />
            </span>
          </button>
        ) : (
          <video
            ref={videoRef}
            key={selectedSrc}
            src={selectedSrc}
            poster={entry.posterSrc}
            preload="metadata"
            playsInline
            controls={false}
            className="h-full w-full object-contain"
            aria-label={entry.alt}
          />
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-light tracking-tight text-white">{entry.title}</h3>
            {entry.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">{entry.description}</p>}
          </div>
          <div className="text-right font-mono text-[8px] uppercase tracking-[0.15em] text-white/28">
            {entry.capturedWith && <p>{entry.capturedWith}</p>}
            {entry.location && <p className="mt-1">{entry.location}</p>}
          </div>
        </div>

        {loaded && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={togglePlayback} className="flex h-9 items-center gap-2 border border-white/10 px-3 font-mono text-[8px] uppercase tracking-[0.14em] text-white/55 transition hover:border-cyan/35 hover:text-cyan">
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? 'pause' : 'play'}
              </button>
              <button type="button" onClick={() => { const video = videoRef.current; if (video) video.currentTime = 0; }} className="flex h-9 items-center gap-2 border border-white/10 px-3 font-mono text-[8px] uppercase tracking-[0.14em] text-white/55 transition hover:border-cyan/35 hover:text-cyan" aria-label="Restart video">
                <RotateCcw className="h-3.5 w-3.5" /> restart
              </button>
              <button type="button" onClick={fullscreen} className="flex h-9 items-center gap-2 border border-white/10 px-3 font-mono text-[8px] uppercase tracking-[0.14em] text-white/55 transition hover:border-cyan/35 hover:text-cyan">
                <Maximize2 className="h-3.5 w-3.5" /> full
              </button>
            </div>

            {entry.sources.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Video quality">
                {entry.sources.map((source) => (
                  <button
                    type="button"
                    key={source.src}
                    onClick={() => chooseSource(source)}
                    className={`border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] transition ${selected?.src === source.src ? 'border-cyan/45 bg-cyan/8 text-cyan' : 'border-white/8 text-white/32 hover:text-white/60'}`}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function VisualMotionGallery({ entries }: { entries: VisualMotionEntry[] }) {
  if (!entries.length) {
    return (
      <section className="border border-dashed border-white/10 bg-white/[0.012] p-6 sm:p-8" aria-label="Visual Cortex motion archive status">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan/55">motion pipeline ready · curation pending</p>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/38">
          The motion renderer is production-ready for high-resolution action-camera footage, but no source videos are committed to the public archive yet. Clips are poster-first and load only on request so the photography experience stays fast.
        </p>
      </section>
    );
  }

  return <section className="grid gap-5 xl:grid-cols-2" aria-label="Selected personal video">{entries.map((entry) => <MotionCard key={entry.id} entry={entry} />)}</section>;
}
