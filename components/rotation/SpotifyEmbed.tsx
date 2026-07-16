'use client';

import { useEffect, useRef } from 'react';
import { MusicPlaybackController } from './MusicSignalSource';

export function SpotifyEmbed({ uri, onController }: {
  uri: string;
  onController: (controller: MusicPlaybackController) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const controller = useRef<MusicPlaybackController | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!host.current) return;
    if (controller.current) {
      controller.current.loadTrack(uri);
      return;
    }
    MusicPlaybackController.create(host.current, uri).then((created) => {
      if (cancelled) { created.destroy(); return; }
      controller.current = created;
      onController(created);
    });
    return () => { cancelled = true; };
  }, [uri, onController]);

  useEffect(() => () => { controller.current?.destroy(); controller.current = null; }, []);

  return <div ref={host} className="w-full" />;
}
