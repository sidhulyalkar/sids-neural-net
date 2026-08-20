'use client';

import type { Track } from '@/lib/spotify/manifest';

export function TrackGallery({ tracks, selectedId, onSelect }: {
  tracks: Track[];
  selectedId: string | null;
  onSelect: (track: Track) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {tracks.map((track) => (
        <button
          key={track.spotifyId}
          onClick={() => onSelect(track)}
          className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${
            selectedId === track.spotifyId ? 'border-amber/60 bg-amber/10' : 'border-white/10 bg-black/30 hover:border-white/30'
          }`}
        >
          <div className="aspect-square w-full bg-gradient-to-br from-violet/30 via-cyan/20 to-rose/30">
            {track.albumArtUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="p-2">
            <p className="truncate font-mono text-[11px] text-white/85">{track.title}</p>
            <p className="truncate font-mono text-[9px] uppercase tracking-[.14em] text-white/45">{track.artist}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
