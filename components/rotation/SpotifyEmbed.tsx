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
  const desiredUri = useRef(uri);
  const mounted = useRef(false);
  const onControllerRef = useRef(onController);

  useEffect(() => {
    onControllerRef.current = onController;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    desiredUri.current = uri;
    if (!host.current) return;

    if (controller.current) {
      if (uri !== lastLoadedUri.current) {
        controller.current.loadTrack(uri);
        lastLoadedUri.current = uri;
      }
      return;
    }

    if (creating.current) return;

    startCreate();

    function startCreate() {
      if (!host.current) return;
      creating.current = true;
      const target = desiredUri.current;
      MusicPlaybackController.create(host.current, target)
        .then((created) => {
          if (!mounted.current) {
            created.destroy();
            return;
          }
          controller.current = created;
          lastLoadedUri.current = target;
          onControllerRef.current(created);
          if (desiredUri.current !== target) {
            controller.current.loadTrack(desiredUri.current);
            lastLoadedUri.current = desiredUri.current;
          }
        })
        .catch((err) => {
          console.warn('Spotify embed failed to load', err);
        })
        .finally(() => {
          creating.current = false;
          if (mounted.current && !controller.current && desiredUri.current !== target) {
            startCreate();
          }
        });
    }
  }, [uri]);

  return <div ref={host} className="w-full" />;
}
