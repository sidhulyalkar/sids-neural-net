'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { muxPlayerUrl, type VisualMotionEntry } from '@/src/data/visualMotion';

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function MotionCard({ entry }: { entry: VisualMotionEntry }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <article className="group overflow-hidden border border-white/10 bg-black/35 shadow-[0_24px_90px_rgba(0,0,0,.32)]">
      <div className="relative overflow-hidden bg-black" style={{ aspectRatio: entry.aspectRatio }}>
        {!loaded ? (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full text-left"
            aria-label={`Open video player: ${entry.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.posterSrc}
              alt={entry.alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.015]"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/15" />
            <span className="absolute left-5 top-5 border border-white/15 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/70 backdrop-blur-md">
              {entry.resolutionLabel} · {formatDuration(entry.durationSeconds)}
            </span>
            <span className="absolute bottom-5 left-5 flex h-12 w-12 items-center justify-center border border-cyan/50 bg-black/60 text-cyan shadow-[0_0_30px_rgba(91,222,255,.16)] backdrop-blur-md transition group-hover:border-cyan/85 group-hover:bg-cyan/10">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />
            </span>
          </button>
        ) : (
          <iframe
            src={muxPlayerUrl(entry.playbackId, entry.title, entry.id)}
            title={entry.title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {entry.collection && (
              <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.18em] text-cyan/50">{entry.collection}</p>
            )}
            <h3 className="text-xl font-light tracking-tight text-white">{entry.title}</h3>
            {entry.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-white/42">{entry.description}</p>}
          </div>
          <div className="shrink-0 text-right font-mono text-[8px] uppercase tracking-[0.15em] text-white/30">
            {entry.capturedWith && <p>{entry.capturedWith}</p>}
            {entry.location && <p className="mt-1">{entry.location}</p>}
            {entry.date && <p className="mt-1">{entry.date}</p>}
          </div>
        </div>

        {loaded && (
          <p className="mt-4 border-t border-white/8 pt-4 font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">
            adaptive Mux stream · fullscreen + quality controls in player
          </p>
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
          Selected films will appear here after they are uploaded to Mux and explicitly published. The page stays poster-first so high-resolution footage never blocks the initial photography experience.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-7" aria-label="Selected personal video">
      {entries.map((entry) => <MotionCard key={entry.id} entry={entry} />)}
    </section>
  );
}
