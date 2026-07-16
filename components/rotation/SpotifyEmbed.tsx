'use client';

import { useEffect, useRef } from 'react';
import { MusicPlaybackController } from './MusicSignalSource';

export function SpotifyEmbed({ uri, onController }: {
  uri: string;
  onController: (controller: MusicPlaybackController) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const controller = useRef<MusicPlaybackController | null>(null);
  const lastLoadedUri = useRef<string | null>(null);
  const creating = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!host.current) return;
    if (controller.current) {
      if (lastLoadedUri.current !== uri) {
        controller.current.loadTrack(uri);
        lastLoadedUri.current = uri;
      }
      return;
    }
    if (creating.current) return;
    creating.current = true;
    MusicPlaybackController.create(host.current, uri).then((created) => {
      if (cancelled) { created.destroy(); return; }
      controller.current = created;
      lastLoadedUri.current = uri;
      onController(created);
    }).catch((err) => {
      console.warn('SpotifyEmbed: failed to initialize Spotify iframe API', err);
    }).finally(() => {
      creating.current = false;
    });
    return () => { cancelled = true; };
  }, [uri, onController]);

  useEffect(() => () => { controller.current?.destroy(); controller.current = null; }, []);

  return <div ref={host} className="w-full" />;
}
