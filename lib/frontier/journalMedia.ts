import type { FrontierItem } from './types';

export type JournalMediaKind = 'direct-video' | 'source-video';

export type JournalMediaPlan = {
  kind: JournalMediaKind;
  sourceUrl: string;
  playableUrl?: string;
  label: string;
  durationSeconds?: number;
};

/**
 * Use verified media fields only. Never synthesize frames or embed an unknown
 * third-party player. Reject non-HTTPS/private-host links before handing a
 * direct video to the browser; video streams are loaded after a user gesture.
 */
export function journalSafePublicUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return undefined;
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost')
      || host === 'localhost' || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

/** Only progressive formats directly supported in browsers. Other source
 * media remains an externally linked source, never a pretend in-page player. */
export function journalMediaPlan(item: FrontierItem): JournalMediaPlan | null {
  const media = item.media;
  if (!media || (media.type !== 'video' && media.type !== 'youtube')) return null;
  const sourceUrl = journalSafePublicUrl(item.url);
  if (!sourceUrl) return null;
  const durationSeconds = typeof media.duration === 'number'
    && Number.isFinite(media.duration) && media.duration > 0 && media.duration <= 86_400
    ? media.duration : undefined;
  const playableUrl = media.type === 'video' ? journalSafePublicUrl(media.url) : undefined;
  const canPlay = Boolean(playableUrl && /\.(?:mp4|webm|ogv)$/i.test(new URL(playableUrl).pathname));
  return {
    kind: canPlay ? 'direct-video' : 'source-video',
    sourceUrl,
    playableUrl: canPlay ? playableUrl : undefined,
    durationSeconds,
    label: canPlay ? 'Play source clip' : 'Watch at original source',
  };
}

export function journalMediaDuration(seconds?: number): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400) return null;
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0')
    : minutes + ':' + String(remainder).padStart(2, '0');
}
