import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { sylvariaAuthoritativeEngineHash } from './headless';
import {
  SYLVARIA_ENGINE_VERSION,
  SYLVARIA_OFFICIAL_SEED,
} from './replay';

export const SYLVARIA_TICKET_SCHEMA = 1 as const;
export const SYLVARIA_DEFAULT_TICKET_TTL_MS = 20 * 60 * 1000;
export const SYLVARIA_TICKET_START_GRACE_MS = 5_000;
const SYLVARIA_SIMULATION_HZ = 120;

export type SylvariaRunTicketClaims = {
  schema: typeof SYLVARIA_TICKET_SCHEMA;
  engineVersion: typeof SYLVARIA_ENGINE_VERSION;
  engineHash: string;
  seed: number;
  buildSha: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

export type SylvariaRunTicketRecord = SylvariaRunTicketClaims & {
  requestFingerprint: string | null;
  usedAt: number | null;
};

export interface SylvariaTicketStore {
  issue(record: SylvariaRunTicketRecord): Promise<void>;
  claim(nonce: string, now: number): Promise<SylvariaRunTicketRecord | null>;
}

export class InMemorySylvariaTicketStore implements SylvariaTicketStore {
  private readonly records = new Map<string, SylvariaRunTicketRecord>();

  async issue(record: SylvariaRunTicketRecord) {
    if (this.records.has(record.nonce)) throw new Error('Sylvaria ticket nonce already exists');
    this.records.set(record.nonce, { ...record });
  }

  async claim(nonce: string, now: number) {
    const record = this.records.get(nonce);
    if (!record || record.usedAt !== null || record.expiresAt < now) return null;
    const claimed = { ...record, usedAt: now };
    this.records.set(nonce, claimed);
    return claimed;
  }

  peek(nonce: string) {
    const record = this.records.get(nonce);
    return record ? { ...record } : null;
  }
}

function stableJson(value: Record<string, unknown>) {
  return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])));
}

function requireSecret(secret: string | Buffer) {
  const bytes = Buffer.isBuffer(secret) ? secret : Buffer.from(secret, 'utf8');
  if (bytes.byteLength < 32) throw new Error('SYLVARIA_LEADERBOARD_SECRET must contain at least 32 bytes');
  return bytes;
}

function hmacBase64Url(secret: string | Buffer, value: string) {
  return createHmac('sha256', requireSecret(secret)).update(value).digest('base64url');
}

function equalBase64Url(left: string, right: string) {
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(left, 'base64url');
    b = Buffer.from(right, 'base64url');
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}

function assertTicketClaims(value: unknown): SylvariaRunTicketClaims {
  if (!value || typeof value !== 'object') throw new Error('Sylvaria run ticket claims must be an object');
  const claims = value as Partial<SylvariaRunTicketClaims>;
  if (claims.schema !== SYLVARIA_TICKET_SCHEMA) throw new Error('unsupported Sylvaria run ticket schema');
  if (claims.engineVersion !== SYLVARIA_ENGINE_VERSION) throw new Error('Sylvaria run ticket engine version is not current');
  if (typeof claims.engineHash !== 'string' || !/^[a-f0-9]{64}$/.test(claims.engineHash)) throw new Error('Sylvaria run ticket engine hash is invalid');
  if (claims.seed !== SYLVARIA_OFFICIAL_SEED) throw new Error('Sylvaria run ticket seed is not current');
  if (typeof claims.buildSha !== 'string' || claims.buildSha.length < 1 || claims.buildSha.length > 128) throw new Error('Sylvaria run ticket build SHA is invalid');
  if (typeof claims.nonce !== 'string' || !/^[a-f0-9-]{36}$/i.test(claims.nonce)) throw new Error('Sylvaria run ticket nonce is invalid');
  if (!Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt) || (claims.expiresAt ?? 0) <= (claims.issuedAt ?? 0)) {
    throw new Error('Sylvaria run ticket timestamps are invalid');
  }
  return claims as SylvariaRunTicketClaims;
}

export function serializeSylvariaRunTicket(claims: SylvariaRunTicketClaims, secret: string | Buffer) {
  const payload = Buffer.from(stableJson(claims as unknown as Record<string, unknown>), 'utf8').toString('base64url');
  return `${payload}.${hmacBase64Url(secret, payload)}`;
}

export function verifySylvariaRunTicketToken(
  token: string,
  secret: string | Buffer,
  options: { now?: number; engineHash?: string; buildSha?: string } = {},
) {
  if (typeof token !== 'string' || token.length > 4096) throw new Error('Sylvaria run ticket token is invalid');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) throw new Error('Sylvaria run ticket token is malformed');
  const expected = hmacBase64Url(secret, payload);
  if (!equalBase64Url(signature, expected)) throw new Error('Sylvaria run ticket signature is invalid');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Sylvaria run ticket payload is invalid');
  }
  const claims = assertTicketClaims(parsed);
  const canonicalPayload = Buffer.from(stableJson(claims as unknown as Record<string, unknown>), 'utf8').toString('base64url');
  if (canonicalPayload !== payload) throw new Error('Sylvaria run ticket payload is not canonical');
  const now = options.now ?? Date.now();
  if (now < claims.issuedAt - 30_000) throw new Error('Sylvaria run ticket is not active yet');
  if (now > claims.expiresAt) throw new Error('Sylvaria run ticket has expired');
  const expectedHash = options.engineHash ?? sylvariaAuthoritativeEngineHash();
  if (claims.engineHash !== expectedHash) throw new Error('Sylvaria run ticket engine hash is stale');
  if (options.buildSha && claims.buildSha !== options.buildSha) throw new Error('Sylvaria run ticket build SHA is stale');
  return claims;
}

export async function issueSylvariaRunTicket(options: {
  secret: string | Buffer;
  store: SylvariaTicketStore;
  now?: number;
  ttlMs?: number;
  buildSha: string;
  requestFingerprint?: string | null;
  nonce?: string;
  engineHash?: string;
}) {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? SYLVARIA_DEFAULT_TICKET_TTL_MS;
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs > SYLVARIA_DEFAULT_TICKET_TTL_MS) {
    throw new Error('Sylvaria run ticket TTL must be between 1 and 20 minutes');
  }
  const claims: SylvariaRunTicketClaims = {
    schema: SYLVARIA_TICKET_SCHEMA,
    engineVersion: SYLVARIA_ENGINE_VERSION,
    engineHash: options.engineHash ?? sylvariaAuthoritativeEngineHash(),
    seed: SYLVARIA_OFFICIAL_SEED,
    buildSha: options.buildSha,
    nonce: options.nonce ?? randomUUID(),
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  assertTicketClaims(claims);
  await options.store.issue({ ...claims, requestFingerprint: options.requestFingerprint ?? null, usedAt: null });
  return { claims, token: serializeSylvariaRunTicket(claims, options.secret) };
}

export async function claimSylvariaRunTicket(options: {
  token: string;
  secret: string | Buffer;
  store: SylvariaTicketStore;
  now?: number;
  engineHash?: string;
  buildSha?: string;
}) {
  const now = options.now ?? Date.now();
  const claims = verifySylvariaRunTicketToken(options.token, options.secret, {
    now,
    engineHash: options.engineHash,
    buildSha: options.buildSha,
  });
  const record = await options.store.claim(claims.nonce, now);
  if (!record) throw new Error('Sylvaria run ticket is expired, unknown, or already used');
  if (
    record.engineVersion !== claims.engineVersion ||
    record.engineHash !== claims.engineHash ||
    record.seed !== claims.seed ||
    record.buildSha !== claims.buildSha ||
    record.expiresAt !== claims.expiresAt
  ) throw new Error('Sylvaria run ticket storage record does not match signed claims');
  return record;
}

export function assertSylvariaReplayFitsTicketWindow(
  ticket: SylvariaRunTicketRecord,
  durationTicks: number,
  graceMs = SYLVARIA_TICKET_START_GRACE_MS,
) {
  if (!Number.isSafeInteger(durationTicks) || durationTicks < 1) throw new Error('Sylvaria ranked replay duration is invalid');
  if (!Number.isSafeInteger(graceMs) || graceMs < 0 || graceMs > 30_000) throw new Error('Sylvaria ranked replay timing grace is invalid');
  if (!Number.isSafeInteger(ticket.usedAt) || (ticket.usedAt ?? 0) < ticket.issuedAt) throw new Error('Sylvaria run ticket has no valid claim time');
  const replayMs = durationTicks * 1000 / SYLVARIA_SIMULATION_HZ;
  const ticketAgeMs = (ticket.usedAt as number) - ticket.issuedAt;
  if (replayMs > ticketAgeMs + graceMs) {
    throw new Error('Sylvaria ranked replay predates its run ticket');
  }
}

export function sylvariaRequestFingerprint(secret: string | Buffer, parts: readonly string[]) {
  return createHmac('sha256', requireSecret(secret)).update(parts.join('\u001f')).digest('hex');
}

export function createSylvariaAcceptedRunProof(options: {
  secret: string | Buffer;
  engineVersion: string;
  engineHash: string;
  buildSha: string;
  ticketNonce: string;
  replayHash: string;
  stateHash: string;
  score: number;
  durationTicks: number;
}) {
  const payload = stableJson({
    buildSha: options.buildSha,
    durationTicks: options.durationTicks,
    engineHash: options.engineHash,
    engineVersion: options.engineVersion,
    replayHash: options.replayHash,
    score: options.score,
    stateHash: options.stateHash,
    ticketNonce: options.ticketNonce,
  });
  return createHmac('sha256', requireSecret(options.secret)).update(payload).digest('hex');
}
