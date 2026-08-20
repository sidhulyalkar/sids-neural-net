export function SpotifyAttribution({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="https://open.spotify.com/"
      target="_blank"
      rel="noreferrer"
      aria-label="Open Spotify"
      className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em] text-white/45 transition hover:text-white/75"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 fill-[#1ED760]">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.494 17.308a.748.748 0 0 1-1.03.249c-2.82-1.724-6.37-2.113-10.544-1.158a.748.748 0 1 1-.334-1.458c4.568-1.045 8.492-.595 11.66 1.341a.748.748 0 0 1 .248 1.026Zm1.472-3.273a.936.936 0 0 1-1.287.308c-3.229-1.984-8.152-2.558-11.968-1.399a.936.936 0 1 1-.543-1.79c4.364-1.324 9.788-.684 13.49 1.59a.936.936 0 0 1 .308 1.291Zm.126-3.409C15.219 8.326 8.041 8.114 4.693 9.128a1.123 1.123 0 1 1-.651-2.148c3.841-1.164 10.692-.949 15.171 1.709a1.123 1.123 0 0 1-1.146 1.931Z" />
      </svg>
      <span>{compact ? 'Spotify' : 'Data from Spotify'}</span>
    </a>
  );
}
