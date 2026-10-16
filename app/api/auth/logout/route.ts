import { NextResponse } from 'next/server';
import { FRONTIER_SESSION_COOKIE, sessionCookieOptions } from '@/lib/frontier/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  response.cookies.set(FRONTIER_SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
