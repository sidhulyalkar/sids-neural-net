import { NextRequest, NextResponse } from 'next/server';
import {
  FRONTIER_OAUTH_INTENT_COOKIE,
  FRONTIER_OAUTH_RETURN_COOKIE,
  FRONTIER_OAUTH_STATE_COOKIE,
  FRONTIER_SESSION_COOKIE,
  authConfigured,
  authOrigin,
  createSessionToken,
  safeReturnPath,
  sessionCookieOptions,
} from '@/lib/frontier/auth';
import {
  getGoogleGrant,
  putGoogleGrant,
  remoteMemoryConfigured,
  type GoogleGrant,
} from '@/lib/frontier/remoteStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function redirectWithStatus(origin: string, returnTo: string, key: string, value: string): NextResponse {
  const target = new URL(returnTo, origin);
  target.searchParams.set(key, value);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const origin = authOrigin(request.nextUrl.origin);
  const returnTo = safeReturnPath(request.cookies.get(FRONTIER_OAUTH_RETURN_COOKIE)?.value);
  const expectedState = request.cookies.get(FRONTIER_OAUTH_STATE_COOKIE)?.value;
  const intent = request.cookies.get(FRONTIER_OAUTH_INTENT_COOKIE)?.value === 'youtube' ? 'youtube' : 'signin';
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');

  if (!authConfigured() || !expectedState || !state || expectedState !== state || !code) {
    return redirectWithStatus(origin, returnTo, 'auth', 'failed');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.FRONTIER_GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.FRONTIER_GOOGLE_CLIENT_SECRET!.trim(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${origin}/api/auth/google/callback`,
    }),
    cache: 'no-store',
  });
  const token = await tokenResponse.json() as GoogleTokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    return redirectWithStatus(origin, returnTo, 'auth', token.error ?? 'failed');
  }

  const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  });
  const user = await userResponse.json() as GoogleUserInfo;
  if (!userResponse.ok || !user.sub || !user.email || user.email_verified === false) {
    return redirectWithStatus(origin, returnTo, 'auth', 'identity-failed');
  }

  const sessionToken = createSessionToken({
    sub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
  });

  let importStatus: string | undefined;
  if (intent === 'youtube') {
    if (!remoteMemoryConfigured()) {
      importStatus = 'storage-required';
    } else {
      const previous = await getGoogleGrant(user.sub).catch(() => null);
      const expiresAt = Date.now() + Math.max(60, token.expires_in ?? 3600) * 1000;
      const grant: GoogleGrant = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? previous?.refreshToken,
        expiresAt,
        scope: token.scope ?? previous?.scope ?? '',
        tokenType: token.token_type ?? previous?.tokenType ?? 'Bearer',
      };
      try {
        await putGoogleGrant(user.sub, grant);
        importStatus = 'connected';
      } catch {
        importStatus = 'storage-failed';
      }
    }
  }

  const target = new URL(returnTo, origin);
  target.searchParams.set('auth', 'google');
  if (importStatus) target.searchParams.set('googleImport', importStatus);
  const response = NextResponse.redirect(target);
  response.cookies.set(FRONTIER_SESSION_COOKIE, sessionToken, sessionCookieOptions());
  response.cookies.delete(FRONTIER_OAUTH_STATE_COOKIE);
  response.cookies.delete(FRONTIER_OAUTH_RETURN_COOKIE);
  response.cookies.delete(FRONTIER_OAUTH_INTENT_COOKIE);
  return response;
}
