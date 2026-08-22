export type FrontierNetworkHint = {
  saveData: boolean;
  effectiveType?: string;
  downlinkMbps?: number;
};

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
    downlink?: number;
  };
};

export function supportsWebGl2(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return Boolean(canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  }));
}

export function supportsMediaSource(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaSource !== 'undefined';
}

export function canPlayNativeHls(video: HTMLVideoElement): boolean {
  return Boolean(
    video.canPlayType('application/vnd.apple.mpegurl') ||
    video.canPlayType('application/x-mpegURL')
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function networkHint(): FrontierNetworkHint {
  if (typeof navigator === 'undefined') return { saveData: false };
  const connection = (navigator as NavigatorWithConnection).connection;
  return {
    saveData: Boolean(connection?.saveData),
    effectiveType: connection?.effectiveType,
    downlinkMbps: connection?.downlink,
  };
}

export function mediaDecodeScale(): number {
  const hint = networkHint();
  if (hint.saveData) return 0.7;
  if (hint.effectiveType === 'slow-2g' || hint.effectiveType === '2g') return 0.65;
  if (hint.effectiveType === '3g') return 0.82;
  return 1;
}

export function shouldAutoplayMedia(): boolean {
  const hint = networkHint();
  if (hint.saveData) return false;
  if (hint.effectiveType === 'slow-2g' || hint.effectiveType === '2g') return false;
  return true;
}
