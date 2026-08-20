import type { Artist } from '@/lib/spotify/manifest';
import { SpotifyAttribution } from './SpotifyAttribution';

export function ArtistShelf({ artists }: { artists: Artist[] }) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <SpotifyAttribution compact />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {artists.slice(0, 12).map((artist) => (
          <a
            key={artist.spotifyId}
            href={artist.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2.5 backdrop-blur transition hover:border-white/25 hover:bg-black/45"
          >
            <span className="w-7 shrink-0 text-center font-mono text-[10px] text-amber/75">#{artist.rank}</span>
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/[.04]">
              {artist.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artist.imageUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center font-mono text-[8px] text-white/25">SP</div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-white/85 group-hover:text-white">{artist.name}</p>
              <p className="mt-1 truncate font-mono text-[8px] uppercase tracking-[.13em] text-white/35">
                {artist.genres.slice(0, 2).join(' · ') || 'top artist'}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
