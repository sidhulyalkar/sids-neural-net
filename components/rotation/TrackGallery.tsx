'use client';

import type { Track } from '@/lib/spotify/manifest';
import { formatMovement, rankMovement } from './listeningStats';
import { SpotifyAttribution } from './SpotifyAttribution';

export function TrackGallery({ tracks, comparisonTracks, selectedId, onSelect }: {
  tracks: Track[];
  comparisonTracks: Track[];
  selectedId: string | null;
  onSelect: (track: Track) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <SpotifyAttribution />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tracks.slice(0, 20).map((track) => {
          const movement = formatMovement(rankMovement(track.spotifyId, tracks, comparisonTracks));
          const selected = selectedId === track.spotifyId;

          return (
            <article
              key={track.spotifyId}
              className={`group overflow-hidden rounded-xl border backdrop-blur-xl transition ${
                selected
                  ? 'border-amber/60 bg-amber/10 shadow-[0_0_45px_rgba(255,190,70,.08)]'
                  : 'border-white/10 bg-black/35 hover:border-white/25 hover:bg-black/50'
              }`}
            >
              <a
                href={track.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${track.title} by ${track.artist} on Spotify`}
                className="block aspect-square bg-white/[.03] p-2"
              >
                {track.albumArtUrl ? (
                  // Spotify artwork is kept unaltered and links directly back to Spotify.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.albumArtUrl}
                    alt={`${track.album || track.title} artwork`}
                    className="h-full w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="grid h-full place-items-center rounded-lg border border-white/10 bg-gradient-to-br from-violet/10 via-cyan/5 to-rose/10 font-mono text-[10px] uppercase tracking-[.18em] text-white/30">
                    Spotify
                  </div>
                )}
              </a>

              <div className="p-3">
                <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[.14em]">
                  <span className="text-amber/80">#{track.rank.toString().padStart(2, '0')}</span>
                  <span className={movement.direction === 'up' ? 'text-green/80' : movement.direction === 'down' ? 'text-rose/80' : 'text-white/35'}>
                    {movement.label}
                  </span>
                </div>

                <a href={track.spotifyUrl} target="_blank" rel="noreferrer" className="block">
                  <p className="line-clamp-2 text-sm font-medium leading-5 text-white/90 group-hover:text-white">{track.title}</p>
                  <p className="mt-1 line-clamp-1 font-mono text-[10px] uppercase tracking-[.12em] text-white/45">{track.artist}</p>
                </a>

                <button
                  type="button"
                  onClick={() => onSelect(track)}
                  aria-pressed={selected}
                  className="mt-3 w-full rounded-full border border-white/10 bg-white/[.03] px-3 py-2 font-mono text-[9px] uppercase tracking-[.15em] text-white/55 transition hover:border-green/30 hover:text-green"
                >
                  {selected ? 'Listening panel open' : 'Listen here'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
