'use client';

import { useEffect, useRef } from 'react';
import { MusicPlaybackController, type PlaybackState } from './MusicSignalSource';

export function SpotifyEmbed({ uri, onController, onStatus, onError }: {
  uri: string;
  onController: (controller: MusicPlaybackController) => void;
  onStatus?: (status: PlaybackState) => void;
  onError?: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const controller = useRef<MusicPlaybackController | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const lastLoadedUri = useRef<string | null>(null);
  const creating = useRef(false);
  const desiredUri = useRef(uri);
  const mounted = useRef(false);
  const onControllerRef = useRef(onController);
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onControllerRef.current = onController;
    onStatusRef.current = onStatus;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      unsubscribe.current?.();
      unsubscribe.current = null;
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    desiredUri.current = uri;
    if (!host.current) return;

    if (controller.current) {
      if (uri !== lastLoadedUri.current) {
        try {
          controller.current.loadTrack(uri);
          lastLoadedUri.current = uri;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Spotify failed to switch tracks';
          onErrorRef.current?.(message);
        }
      }
      return;
    }

    if (creating.current) return;
    startCreate();

    function startCreate() {
      if (!host.current) return;
      creating.current = true;
      onStatusRef.current?.('loading');
      const target = desiredUri.current;
      MusicPlaybackController.create(host.current, target)
        .then((created) => {
          if (!mounted.current) {
            created.destroy();
            return;
          }
          controller.current = created;
          lastLoadedUri.current = target;
          unsubscribe.current?.();
          unsubscribe.current = created.subscribe((state) => onStatusRef.current?.(state));
          onControllerRef.current(created);
          if (desiredUri.current !== target) {
            created.loadTrack(desiredUri.current);
            lastLoadedUri.current = desiredUri.current;
          }
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Spotify embed failed to load';
          console.warn(message);
          onStatusRef.current?.('error');
          onErrorRef.current?.(message);
        })
        .finally(() => {
          creating.current = false;
          if (mounted.current && !controller.current && desiredUri.current !== target) startCreate();
        });
    }
  }, [uri]);

  return <div ref={host} className="min-h-20 w-full overflow-hidden rounded-lg" aria-label="Spotify player" />;
}
