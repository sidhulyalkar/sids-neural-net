import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const FRONTIER_SESSION_COOKIE = 'frontier_session';
export const FRONTIER_OAUTH_STATE_COOKIE = 'frontier_oauth_state';
export const FRONTIER_OAUTH_RETURN_COOKIE = 'frontier_oauth_return';
export const FRONTIER_OAUTH_INTENT_COOKIE = 'frontier_oauth_intent';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  iat: number;
  exp: number;
};

export type FrontierUser = Pick<SessionPayload, 'sub' | 'email' | 'name' | 'picture'>;

function authSecret(): string | undefined {
  return process.env.FRONTIER_AUTH_SECRET?.trim() || undefined;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function authConfigured(): boolean {
  return Boolean(
    authSecret() &&
    process.env.FRONTIER_GOOGLE_CLIENT_ID?.trim() &&
    process.env.FRONTIER_GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function createSessionToken(user: FrontierUser, now = new Date()): string {
  const secret = authSecret();
  if (!secret) throw new Error('FRONTIER_AUTH_SECRET is not configured');
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: SessionPayload = {
    ...user,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(token: string | undefined, now = new Date()): FrontierUser | null {
  const secret = authSecret();
  if (!secret || !token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp <= Math.floor(now.getTime() / 1000)) return null;
    return { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
  } catch {
    return null;
  }
}

export async function getFrontierSession(): Promise<FrontierUser | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(FRONTIER_SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function ephemeralCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 10 * 60,
  };
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/frontier';
  return value.slice(0, 500);
}

export function authOrigin(requestOrigin: string): string {
  const configured = process.env.FRONTIER_AUTH_ORIGIN?.trim();
  if (!configured) return requestOrigin.replace(/\/$/, '');
  try {
    return new URL(configured).origin;
  } catch {
    return requestOrigin.replace(/\/$/, '');
  }
}
