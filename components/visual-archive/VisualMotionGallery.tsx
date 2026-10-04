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
    <article className="min-w-0">
      <div
        className="group relative overflow-hidden border border-white/10 bg-black"
        style={{ aspectRatio: entry.aspectRatio }}
      >
        {!loaded ? (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full"
            aria-label={`Play ${entry.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.posterSrc}
              alt={entry.alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.012]"
            />
            <span className="absolute inset-0 bg-black/5 transition group-hover:bg-black/0" />
            <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white/85 backdrop-blur-sm transition group-hover:scale-105 group-hover:border-white/45 group-hover:bg-black/60">
              <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
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

      <div className="mt-2.5 flex items-baseline justify-between gap-4">
        <p className="truncate text-sm font-normal tracking-tight text-white/68">{entry.title}</p>
        <p className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-white/28">
          {entry.resolutionLabel} · {formatDuration(entry.durationSeconds)}
        </p>
      </div>
    </article>
  );
}

export function VisualMotionGallery({ entries }: { entries: VisualMotionEntry[] }) {
  if (!entries.length) return null;

  return (
    <div className="grid gap-x-5 gap-y-9 lg:grid-cols-2">
      {entries.map((entry) => (
        <MotionCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
