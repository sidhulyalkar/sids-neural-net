import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  assertSylvariaReplayFitsTicketWindow,
  claimSylvariaRunTicket,
  createSylvariaAcceptedRunProof,
} from '../../../../../src/lib/sylvaria/leaderboard';
import {
  sylvariaAuthoritativeEngineHash,
  verifySylvariaReplay,
} from '../../../../../src/lib/sylvaria/headless';
import {
  SYLVARIA_ENGINE_VERSION,
  SYLVARIA_OFFICIAL_SEED,
  sylvariaReplayBytesFromBase64Url,
  validateSylvariaReplayEnvelope,
} from '../../../../../src/lib/sylvaria/replay';
import {
  SupabaseSylvariaStore,
  getSylvariaServerConfig,
} from '../../../../../src/lib/sylvaria/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Submission = z.object({
  ticket: z.string().min(20).max(4096),
  displayName: z.string().trim().min(1).max(24).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'display name contains control characters'),
  claimedScore: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  replay: z.unknown(),
}).strict();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const config = getSylvariaServerConfig();
  if (!config) return response({ configured: false, verified: false, error: 'Ranked Sylvaria runs are not configured.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
    return response({ configured: true, verified: false, error: 'Replay submission is too large.' }, 413);
  }

  let body: z.infer<typeof Submission>;
  try {
    body = Submission.parse(await request.json());
  } catch {
    return response({ configured: true, verified: false, error: 'Invalid replay submission.' }, 400);
  }

  const store = new SupabaseSylvariaStore(config);
  const engineHash = sylvariaAuthoritativeEngineHash();

  try {
    const ticket = await claimSylvariaRunTicket({
      token: body.ticket,
      secret: config.leaderboardSecret,
      store,
      engineHash,
      buildSha: config.buildSha,
    });

    const envelope = validateSylvariaReplayEnvelope(body.replay);
    if (
      envelope.engineVersion !== ticket.engineVersion ||
      envelope.engineHash !== ticket.engineHash ||
      envelope.seed !== ticket.seed
    ) throw new Error('Replay identity does not match ranked-run ticket');
    assertSylvariaReplayFitsTicketWindow(ticket, envelope.durationTicks);

    const verified = verifySylvariaReplay(envelope, body.claimedScore);
    const replayBytes = sylvariaReplayBytesFromBase64Url(envelope.input);
    const verificationProof = createSylvariaAcceptedRunProof({
      secret: config.leaderboardSecret,
      engineVersion: SYLVARIA_ENGINE_VERSION,
      engineHash,
      buildSha: config.buildSha,
      ticketNonce: ticket.nonce,
      replayHash: verified.replayHash,
      stateHash: verified.stateHash,
      score: verified.score,
      durationTicks: envelope.durationTicks,
    });

    await store.saveVerifiedRun({
      displayName: body.displayName,
      engineVersion: SYLVARIA_ENGINE_VERSION,
      engineHash,
      buildSha: config.buildSha,
      seed: SYLVARIA_OFFICIAL_SEED,
      ticketNonce: ticket.nonce,
      replaySchema: envelope.schema,
      replayBytes,
      replayHash: verified.replayHash,
      score: verified.score,
      worldDepth: verified.worldDepth,
      durationTicks: envelope.durationTicks,
      stateHash: verified.stateHash,
      verificationProof,
    });

    return response({
      configured: true,
      verified: true,
      score: verified.score,
      worldDepth: verified.worldDepth,
      durationTicks: envelope.durationTicks,
      replayHash: verified.replayHash,
      stateHash: verified.stateHash,
      verificationProof,
    });
  } catch (error) {
    console.warn('Sylvaria ranked replay rejected', error);
    return response({ configured: true, verified: false, error: 'Replay could not be verified for the current ranked season.' }, 422);
  }
}
