import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  FRONTIER_OAUTH_INTENT_COOKIE,
  FRONTIER_OAUTH_RETURN_COOKIE,
  FRONTIER_OAUTH_STATE_COOKIE,
  authConfigured,
  authOrigin,
  ephemeralCookieOptions,
  safeReturnPath,
} from '@/lib/frontier/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json({ error: 'Google sign-in is not configured' }, { status: 503 });
  }

  const clientId = process.env.FRONTIER_GOOGLE_CLIENT_ID!.trim();
  const origin = authOrigin(request.nextUrl.origin);
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'));
  const intent = request.nextUrl.searchParams.get('intent') === 'youtube' ? 'youtube' : 'signin';
  const state = randomBytes(24).toString('base64url');
  const scopes = ['openid', 'email', 'profile'];
  if (intent === 'youtube') scopes.push('https://www.googleapis.com/auth/youtube.readonly');

  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.searchParams.set('client_id', clientId);
  authorization.searchParams.set('redirect_uri', `${origin}/api/auth/google/callback`);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('scope', scopes.join(' '));
  authorization.searchParams.set('state', state);
  authorization.searchParams.set('include_granted_scopes', 'true');
  authorization.searchParams.set('access_type', 'offline');
  if (intent === 'youtube') authorization.searchParams.set('prompt', 'consent');

  const response = NextResponse.redirect(authorization);
  const options = ephemeralCookieOptions();
  response.cookies.set(FRONTIER_OAUTH_STATE_COOKIE, state, options);
  response.cookies.set(FRONTIER_OAUTH_RETURN_COOKIE, returnTo, options);
  response.cookies.set(FRONTIER_OAUTH_INTENT_COOKIE, intent, options);
  return response;
}
