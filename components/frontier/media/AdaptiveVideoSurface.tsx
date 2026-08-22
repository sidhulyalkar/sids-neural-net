'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { canPlayNativeHls, shouldAutoplayMedia, supportsMediaSource } from '@/lib/frontier/media/capabilities';
import { FrontierMseController } from '@/lib/frontier/media/mse';
import { frontierMediaTelemetry } from '@/lib/frontier/media/telemetry';
import type { FrontierVideoStream } from '@/lib/frontier/types';
import { GpuImageSurface } from './GpuImageSurface';
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

function pickStream(streams: FrontierVideoStream[] | undefined): FrontierVideoStream | undefined {
  if (!streams?.length) return undefined;
  return streams.find((stream) => stream.kind === 'frontier-fmp4')
    ?? streams.find((stream) => stream.kind === 'hls')
    ?? streams.find((stream) => stream.kind === 'progressive');
}

export function AdaptiveVideoSurface({ id, url, poster, alt, streams, onUnavailable }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingFlip = useRef(false);
  const playingStarted = useRef<number>();
  const startRecorded = useRef(false);
  const lastQuality = useRef({ total: 0, dropped: 0 });
  const visibility = useMediaVisibility(shellRef);
  const { captureFlip, playFlip, cancelFlip } = useMediaFlip(stageRef);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const stream = useMemo(() => pickStream(streams), [streams]);
  const mountedPlayer = visibility !== 'off' || expanded;

  useEffect(() => {
    if (failed) onUnavailable?.();
  }, [failed, onUnavailable]);

  useEffect(() => {
    if (!expanded) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      captureFlip();
      pendingFlip.current = true;
      setExpanded(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [captureFlip, expanded]);

  useLayoutEffect(() => {
    if (!pendingFlip.current) return;
    pendingFlip.current = false;
    playFlip();
  }, [expanded, playFlip]);

  useEffect(() => () => cancelFlip(), [cancelFlip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mountedPlayer) return;
    let disposed = false;
    let mse: FrontierMseController | undefined;
    let objectUrl: string | undefined;

    const attach = async () => {
      playingStarted.current = performance.now();
      startRecorded.current = false;
      try {
        if (stream?.kind === 'frontier-fmp4' && supportsMediaSource()) {
          mse = new FrontierMseController(video);
          await mse.attach({ initUrl: stream.initUrl, variants: stream.variants }, shellRef.current?.clientWidth ?? 960);
          return;
        }
        if (stream?.kind === 'hls' && canPlayNativeHls(video)) {
          video.src = stream.manifestUrl;
          return;
        }
        if (stream?.kind === 'progressive') {
          video.src = stream.url;
          return;
        }
        if (url) {
          video.src = url;
          return;
        }
        setFailed(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    };

    void attach();
    return () => {
      disposed = true;
      mse?.destroy();
      if (!mse) {
        video.pause();
        objectUrl = video.src.startsWith('blob:') ? video.src : undefined;
        video.removeAttribute('src');
        video.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mountedPlayer, stream, url]);

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
    captureFlip();
    pendingFlip.current = true;
    setExpanded((value) => !value);
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
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
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
