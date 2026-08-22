import { NextResponse } from 'next/server';

import {
  issueSylvariaRunTicket,
  sylvariaRequestFingerprint,
} from '../../../../src/lib/sylvaria/leaderboard';
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

function unavailable() {
  return NextResponse.json(
    { ranked: false, configured: false, error: 'Ranked Sylvaria runs are not configured on this deployment.' },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const config = getSylvariaServerConfig();
  if (!config) return unavailable();

  try {
    const engineHash = sylvariaAuthoritativeEngineHash();
    const store = new SupabaseSylvariaStore(config);
    await store.registerEngine({
      engineVersion: SYLVARIA_ENGINE_VERSION,
      engineHash,
      buildSha: config.buildSha,
      officialSeed: SYLVARIA_OFFICIAL_SEED,
    });

    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = request.headers.get('user-agent')?.slice(0, 240) || 'unknown';
    const requestFingerprint = sylvariaRequestFingerprint(config.leaderboardSecret, [forwardedFor, userAgent]);
    const issued = await issueSylvariaRunTicket({
      secret: config.leaderboardSecret,
      store,
      buildSha: config.buildSha,
      engineHash,
      requestFingerprint,
    });

    return NextResponse.json({
      ranked: true,
      configured: true,
      ticket: issued.token,
      engineVersion: issued.claims.engineVersion,
      engineHash: issued.claims.engineHash,
      seed: issued.claims.seed,
      expiresAt: issued.claims.expiresAt,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Sylvaria run-ticket issuance failed', error);
    return NextResponse.json(
      { ranked: false, configured: true, error: 'Unable to issue a ranked-run ticket.' },
      { status: 429, headers: { 'cache-control': 'no-store' } },
    );
  }
}
