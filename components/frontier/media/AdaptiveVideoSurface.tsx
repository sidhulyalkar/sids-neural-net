'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { canPlayNativeHls, shouldAutoplayMedia, supportsMediaSource } from '@/lib/frontier/media/capabilities';
import { FrontierMseController } from '@/lib/frontier/media/mse';
import {
  prewarmFrontierVideoStream,
  registerFrontierPrefetchTarget,
} from '@/lib/frontier/media/streamPrefetcher';
import { frontierMediaTelemetry } from '@/lib/frontier/media/telemetry';
import type { FrontierVideoStream } from '@/lib/frontier/types';
import { GpuImageSurface } from './GpuImageSurface';
import { claimFrontierPlayback, releaseFrontierPlayback } from './playbackCoordinator';
import { useMediaFlip } from './useMediaFlip';
import { useMediaVisibility } from './useMediaVisibility';
import styles from './frontier-media.module.css';

type Props = {
  id: string;
  url?: string;
  poster?: string;
  alt: string;
  streams?: FrontierVideoStream[];
  onUnavailable?: () => void;
};

function orderedStreams(streams: FrontierVideoStream[] | undefined): FrontierVideoStream[] {
  if (!streams?.length) return [];
  const rank = (stream: FrontierVideoStream) => {
    if (stream.kind === 'frontier-fmp4') return 0;
    if (stream.kind === 'hls') return 1;
    return 2;
  };
  return [...streams].sort((a, b) => rank(a) - rank(b));
}

function browserOrderedStreams(video: HTMLVideoElement, streams: FrontierVideoStream[]): FrontierVideoStream[] {
  if (!canPlayNativeHls(video)) return streams;
  // Safari's native HLS stack already owns mature ABR, hardware decode, captions,
  // and power behavior. Prefer it to the custom MSE path when available.
  return [...streams].sort((a, b) => {
    const rank = (stream: FrontierVideoStream) => stream.kind === 'hls' ? 0 : stream.kind === 'frontier-fmp4' ? 1 : 2;
    return rank(a) - rank(b);
  });
}

type VirtualBoundarySnapshot = {
  node: HTMLElement;
  contentVisibility: string;
};

export function AdaptiveVideoSurface({ id, url, poster, alt, streams, onUnavailable }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingFlip = useRef(false);
  const playingStarted = useRef<number | undefined>(undefined);
  const startRecorded = useRef(false);
  const lastQuality = useRef({ total: 0, dropped: 0 });
  const virtualBoundary = useRef<VirtualBoundarySnapshot | undefined>(undefined);
  const boundaryRestoreTimer = useRef<number | undefined>(undefined);
  const visibility = useMediaVisibility(shellRef);
  const { captureFlip, playFlip, cancelFlip } = useMediaFlip(stageRef);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const streamCandidates = useMemo(() => orderedStreams(streams), [streams]);
  const mountedPlayer = visibility !== 'off' || expanded;

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;
    return registerFrontierPrefetchTarget({
      id: `video:${id}`,
      kind: 'video',
      node,
      warm: () => prewarmFrontierVideoStream(streamCandidates[0], url),
    });
  }, [id, streamCandidates, url]);

  const elevateVirtualBoundary = useCallback(() => {
    if (boundaryRestoreTimer.current !== undefined) {
      window.clearTimeout(boundaryRestoreTimer.current);
      boundaryRestoreTimer.current = undefined;
    }
    if (virtualBoundary.current) return;
    const node = shellRef.current?.closest<HTMLElement>('[data-frontier-virtual-card]');
    if (!node) return;
    virtualBoundary.current = { node, contentVisibility: node.style.contentVisibility };
    // `content-visibility:auto` creates containment that can trap a fixed
    // descendant. Temporarily disable it so the same playing video can become a
    // viewport-level FLIP surface without reparenting or remounting.
    node.style.contentVisibility = 'visible';
  }, []);

  const restoreVirtualBoundary = useCallback((delayMs = 0) => {
    if (boundaryRestoreTimer.current !== undefined) window.clearTimeout(boundaryRestoreTimer.current);
    boundaryRestoreTimer.current = window.setTimeout(() => {
      boundaryRestoreTimer.current = undefined;
      const snapshot = virtualBoundary.current;
      if (!snapshot) return;
      snapshot.node.style.contentVisibility = snapshot.contentVisibility;
      virtualBoundary.current = undefined;
    }, delayMs);
  }, []);

  useEffect(() => {
    if (failed) onUnavailable?.();
  }, [failed, onUnavailable]);

  useEffect(() => {
    setFailed(false);
  }, [id, streamCandidates, url]);

  useEffect(() => {
    if (!expanded) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previousOverflow; };
  }, [expanded]);

  const closeExpanded = useCallback(() => {
    captureFlip();
    pendingFlip.current = true;
    setExpanded(false);
  }, [captureFlip]);

  useEffect(() => {
    if (!expanded) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeExpanded();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [closeExpanded, expanded]);

  useLayoutEffect(() => {
    if (!pendingFlip.current) return;
    pendingFlip.current = false;
    playFlip();
    if (!expanded) restoreVirtualBoundary(460);
  }, [expanded, playFlip, restoreVirtualBoundary]);

  useEffect(() => () => {
    cancelFlip();
    if (boundaryRestoreTimer.current !== undefined) window.clearTimeout(boundaryRestoreTimer.current);
    const snapshot = virtualBoundary.current;
    if (snapshot) snapshot.node.style.contentVisibility = snapshot.contentVisibility;
    virtualBoundary.current = undefined;
    if (videoRef.current) releaseFrontierPlayback(id, videoRef.current);
  }, [cancelFlip, id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mountedPlayer) return;
    let disposed = false;
    let mse: FrontierMseController | undefined;

    const attach = async () => {
      playingStarted.current = performance.now();
      startRecorded.current = false;
      setFailed(false);

      for (const candidate of browserOrderedStreams(video, streamCandidates)) {
        if (disposed) return;
        if (candidate.kind === 'frontier-fmp4') {
          if (!supportsMediaSource()) continue;
          const controller = new FrontierMseController(video);
          try {
            await controller.attach(
              { initUrl: candidate.initUrl, variants: candidate.variants },
              shellRef.current?.clientWidth ?? 960
            );
            if (disposed) {
              controller.destroy();
              return;
            }
            mse = controller;
            return;
          } catch {
            controller.destroy();
            continue;
          }
        }

        if (candidate.kind === 'hls') {
          if (!canPlayNativeHls(video)) continue;
          video.src = candidate.manifestUrl;
          return;
        }

        if (candidate.kind === 'progressive') {
          video.src = candidate.url;
          return;
        }
      }

      if (url) {
        video.src = url;
        return;
      }
      if (!disposed) setFailed(true);
    };

    void attach();
    return () => {
      disposed = true;
      releaseFrontierPlayback(id, video);
      if (mse) {
        mse.destroy();
      } else {
        const objectUrl = video.src.startsWith('blob:') ? video.src : undefined;
        video.pause();
        video.removeAttribute('src');
        video.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id, mountedPlayer, streamCandidates, url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (visibility === 'active' && shouldAutoplayMedia()) {
      video.muted = muted;
      void video.play().catch(() => undefined);
    } else if (!expanded) {
      video.pause();
    }
  }, [expanded, muted, visibility]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || visibility !== 'active') return;
    const sample = () => {
      if (typeof video.getVideoPlaybackQuality !== 'function') return;
      const quality = video.getVideoPlaybackQuality();
      const total = Math.max(0, quality.totalVideoFrames - lastQuality.current.total);
      const dropped = Math.max(0, quality.droppedVideoFrames - lastQuality.current.dropped);
      lastQuality.current = { total: quality.totalVideoFrames, dropped: quality.droppedVideoFrames };
      if (total || dropped) frontierMediaTelemetry.playbackFrames(total, dropped);
    };
    const timer = window.setInterval(sample, 5_000);
    return () => {
      window.clearInterval(timer);
      sample();
    };
  }, [visibility]);

  const toggleExpanded = () => {
    if (expanded) {
      closeExpanded();
      return;
    }
    elevateVirtualBoundary();
    captureFlip();
    pendingFlip.current = true;
    setExpanded(true);
  };

  const togglePlaying = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };

  return (
    <div ref={shellRef} className={styles.videoShell}>
      {!mountedPlayer && poster ? (
        <GpuImageSurface id={`${id}:poster`} src={poster} alt={alt} className={styles.posterSurface} onUnavailable={onUnavailable} />
      ) : null}
      {mountedPlayer ? (
        <div
          ref={stageRef}
          className={`${styles.videoStage} ${expanded ? styles.videoStageExpanded : ''}`}
          data-expanded={expanded ? 'true' : 'false'}
        >
          <video
            ref={videoRef}
            className={styles.videoElement}
            playsInline
            muted={muted}
            preload={visibility === 'active' ? 'auto' : 'metadata'}
            poster={poster}
            onPlay={(event) => {
              claimFrontierPlayback(id, event.currentTarget);
              setPlaying(true);
            }}
            onPause={(event) => {
              releaseFrontierPlayback(id, event.currentTarget);
              setPlaying(false);
            }}
            onEnded={(event) => {
              releaseFrontierPlayback(id, event.currentTarget);
              setPlaying(false);
            }}
            onPlaying={() => {
              if (!startRecorded.current && playingStarted.current !== undefined) {
                startRecorded.current = true;
                frontierMediaTelemetry.videoStarted(performance.now() - playingStarted.current);
              }
            }}
            onWaiting={() => frontierMediaTelemetry.rebuffer()}
            onError={() => setFailed(true)}
          />
          <div className={styles.videoChrome}>
            <button type="button" onClick={togglePlaying} aria-label={playing ? 'Pause video' : 'Play video'}>
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
              aria-label={muted ? 'Unmute video' : 'Mute video'}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button type="button" onClick={toggleExpanded} aria-label={expanded ? 'Close media view' : 'Expand media'}>
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
