import { NextRequest, NextResponse } from 'next/server';
import { getFrontierSession } from '@/lib/frontier/auth';
import { compactFrontierCloudMemory, parseFrontierPersistedState } from '@/lib/frontier/memoryMerge';
import { getRemoteMemory, putRemoteMemory, remoteMemoryConfigured } from '@/lib/frontier/remoteStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET() {
  const user = await getFrontierSession();
  if (!user) return privateJson({ error: 'unauthorized' }, 401);
  if (!remoteMemoryConfigured()) return privateJson({ configured: false, memory: null }, 503);
  try {
    const memory = await getRemoteMemory(user.sub);
    return privateJson({ configured: true, memory });
  } catch (error) {
    return privateJson({
      configured: true,
      memory: null,
      error: error instanceof Error ? error.message : 'remote memory unavailable',
    }, 503);
  }
}

export async function PUT(request: NextRequest) {
  const user = await getFrontierSession();
  if (!user) return privateJson({ error: 'unauthorized' }, 401);
  if (!remoteMemoryConfigured()) return privateJson({ error: 'remote memory is not configured' }, 503);

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 1_500_000) {
    return privateJson({ error: 'memory payload too large' }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: 'invalid JSON' }, 400);
  }
  const object = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const incoming = parseFrontierPersistedState(object.state);
  if (!incoming) return privateJson({ error: 'invalid FRONTIER memory payload' }, 400);

  try {
    // Behavior aggregates and the learned profile are the long-term memory. Raw
    // history is bounded before cloud storage so the model can grow for years
    // without turning the sync payload into an ever-expanding event archive.
    const compacted = compactFrontierCloudMemory(incoming);
    const memory = await putRemoteMemory(user.sub, compacted);
    return privateJson({ ok: true, memory });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : 'could not save memory' }, 503);
  }
}
