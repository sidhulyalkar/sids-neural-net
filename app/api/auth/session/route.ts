import { NextResponse } from 'next/server';
import { authConfigured, getFrontierSession } from '@/lib/frontier/auth';
import { remoteMemoryConfigured } from '@/lib/frontier/remoteStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getFrontierSession();
  return NextResponse.json({
    configured: authConfigured(),
    authenticated: Boolean(user),
    syncConfigured: remoteMemoryConfigured(),
    user: user ? {
      email: user.email,
      name: user.name,
      picture: user.picture,
    } : undefined,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
