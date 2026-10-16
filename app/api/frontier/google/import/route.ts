import { NextResponse } from 'next/server';
import { getFrontierSession } from '@/lib/frontier/auth';
import {
  deriveGooglePreferenceImport,
  type GoogleLikedVideoSignal,
  type GoogleSubscriptionSignal,
} from '@/lib/frontier/googlePreferences';
import { getGoogleGrant, putGoogleGrant, remoteMemoryConfigured, type GoogleGrant } from '@/lib/frontier/remoteStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

type SubscriptionResponse = {
  items?: Array<{
    snippet?: {
      title?: string;
      resourceId?: { channelId?: string };
    };
  }>;
  nextPageToken?: string;
};

type ChannelsResponse = {
  items?: Array<{
    contentDetails?: { relatedPlaylists?: { likes?: string } };
  }>;
};

type PlaylistItemsResponse = {
  items?: Array<{
    contentDetails?: { videoId?: string };
    snippet?: { title?: string; videoOwnerChannelTitle?: string; channelTitle?: string };
  }>;
  nextPageToken?: string;
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function refreshGrant(grant: GoogleGrant): Promise<GoogleGrant | null> {
  if (grant.expiresAt > Date.now() + 60_000) return grant;
  if (!grant.refreshToken) return null;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.FRONTIER_GOOGLE_CLIENT_ID?.trim() ?? '',
      client_secret: process.env.FRONTIER_GOOGLE_CLIENT_SECRET?.trim() ?? '',
      refresh_token: grant.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!payload.access_token) return null;
  return {
    ...grant,
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
    scope: payload.scope ?? grant.scope,
    tokenType: payload.token_type ?? grant.tokenType,
  };
}

async function googleJson<T>(url: URL, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google API returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function subscriptions(accessToken: string): Promise<GoogleSubscriptionSignal[]> {
  const output: GoogleSubscriptionSignal[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page += 1) {
    const url = new URL('https://www.googleapis.com/youtube/v3/subscriptions');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('mine', 'true');
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const payload = await googleJson<SubscriptionResponse>(url, accessToken);
    for (const item of payload.items ?? []) {
      const channelId = item.snippet?.resourceId?.channelId;
      const title = item.snippet?.title?.trim();
      if (channelId && title) output.push({ channelId, title });
    }
    pageToken = payload.nextPageToken;
    if (!pageToken) break;
  }
  return output;
}

async function likedVideos(accessToken: string): Promise<GoogleLikedVideoSignal[]> {
  const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
  channelUrl.searchParams.set('part', 'contentDetails');
  channelUrl.searchParams.set('mine', 'true');
  const channel = await googleJson<ChannelsResponse>(channelUrl, accessToken);
  const playlistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
  if (!playlistId) return [];

  const output: GoogleLikedVideoSignal[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 4; page += 1) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const payload = await googleJson<PlaylistItemsResponse>(url, accessToken);
    for (const item of payload.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      const title = item.snippet?.title?.trim();
      if (!videoId || !title || title === 'Deleted video' || title === 'Private video') continue;
      output.push({
        videoId,
        title,
        channelTitle: item.snippet?.videoOwnerChannelTitle ?? item.snippet?.channelTitle,
      });
    }
    pageToken = payload.nextPageToken;
    if (!pageToken) break;
  }
  return output;
}

export async function POST() {
  const user = await getFrontierSession();
  if (!user) return privateJson({ error: 'unauthorized' }, 401);
  if (!remoteMemoryConfigured()) return privateJson({ error: 'cloud memory is required', needsStorage: true }, 503);

  const stored = await getGoogleGrant(user.sub).catch(() => null);
  if (!stored || !stored.scope.split(/\s+/).includes(YOUTUBE_SCOPE)) {
    return privateJson({ error: 'YouTube permission has not been granted', needsConsent: true }, 403);
  }
  const grant = await refreshGrant(stored);
  if (!grant) return privateJson({ error: 'Google permission needs reconnecting', needsConsent: true }, 403);
  if (grant.accessToken !== stored.accessToken || grant.expiresAt !== stored.expiresAt) {
    await putGoogleGrant(user.sub, grant).catch(() => undefined);
  }

  try {
    const [channelSubscriptions, likes] = await Promise.all([
      subscriptions(grant.accessToken),
      likedVideos(grant.accessToken),
    ]);
    const preferences = deriveGooglePreferenceImport(channelSubscriptions, likes);
    return privateJson({ ok: true, preferences });
  } catch (error) {
    return privateJson({
      error: error instanceof Error ? error.message : 'Google preference import failed',
    }, 502);
  }
}
