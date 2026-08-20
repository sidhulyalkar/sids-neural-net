'use client';

export function SpotifyEmbed({ spotifyId, title }: { spotifyId: string; title: string }) {
  return (
    <iframe
      title={`Listen to ${title} on Spotify`}
      src={`https://open.spotify.com/embed/track/${encodeURIComponent(spotifyId)}?utm_source=generator&theme=0`}
      width="100%"
      height="152"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      className="block w-full rounded-lg border-0"
    />
  );
}
