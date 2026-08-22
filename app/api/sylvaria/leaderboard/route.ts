import { NextResponse } from 'next/server';

import { sylvariaAuthoritativeEngineHash } from '../../../../src/lib/sylvaria/headless';
import {
  SYLVARIA_ENGINE_VERSION,
  SYLVARIA_OFFICIAL_SEED,
} from '../../../../src/lib/sylvaria/replay';
import {
  SupabaseSylvariaStore,
  getSylvariaServerConfig,
} from '../../../../src/lib/sylvaria/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getSylvariaServerConfig();
  if (!config) {
    return NextResponse.json(
      { configured: false, engineVersion: SYLVARIA_ENGINE_VERSION, entries: [] },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const engineHash = sylvariaAuthoritativeEngineHash();
    const store = new SupabaseSylvariaStore(config);
    const entries = await store.listLeaderboard({
      engineVersion: SYLVARIA_ENGINE_VERSION,
      engineHash,
      seed: SYLVARIA_OFFICIAL_SEED,
      limit: 25,
    });
    return NextResponse.json({
      configured: true,
      engineVersion: SYLVARIA_ENGINE_VERSION,
      engineHash,
      seed: SYLVARIA_OFFICIAL_SEED,
      entries,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Sylvaria leaderboard read failed', error);
    return NextResponse.json(
      { configured: true, engineVersion: SYLVARIA_ENGINE_VERSION, entries: [], error: 'Leaderboard temporarily unavailable.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
