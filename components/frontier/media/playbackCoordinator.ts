'use client';

type ActivePlayback = {
  id: string;
  video: HTMLVideoElement;
};

let activePlayback: ActivePlayback | undefined;

/**
 * FRONTIER deliberately permits one actively decoding/playing feed video at a
 * time. Warm neighbors may hold metadata, but claiming playback pauses the prior
 * surface before the browser has to decode two high-frame-rate streams at once.
 */
export function claimFrontierPlayback(id: string, video: HTMLVideoElement): void {
  const previous = activePlayback;
  if (previous && previous.video !== video) previous.video.pause();
  activePlayback = { id, video };
}

export function releaseFrontierPlayback(id: string, video: HTMLVideoElement): void {
  if (activePlayback?.id === id && activePlayback.video === video) activePlayback = undefined;
}

export function activeFrontierPlaybackId(): string | undefined {
  return activePlayback?.id;
}
