import type {
  SylvariaRunTicketRecord,
  SylvariaTicketStore,
} from './leaderboard';
import { SYLVARIA_ENGINE_VERSION } from './replay';

export type SylvariaVerifiedRunRecord = {
  playerId?: string | null;
  displayName: string;
  engineVersion: string;
  engineHash: string;
  buildSha: string;
  seed: number;
  ticketNonce: string;
  replaySchema: number;
  replayBytes: Uint8Array;
  replayHash: string;
  score: number;
  worldDepth: number;
  durationTicks: number;
  stateHash: string;
  verificationProof: string;
};

export type SylvariaLeaderboardEntry = {
  displayName: string;
  score: number;
  worldDepth: number;
  durationTicks: number;
  verifiedAt: string;
  verificationProof: string;
};

export type SylvariaServerConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  leaderboardSecret: string;
  buildSha: string;
};

function requireServerSecretKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('Sylvaria Supabase server credential is empty');
  if (/^(anon|sb_publishable_)/i.test(key)) throw new Error('Sylvaria leaderboard refuses public Supabase credentials');
  return key;
}

export function getSylvariaServerConfig(env: NodeJS.ProcessEnv = process.env): SylvariaServerConfig | null {
  const supabaseUrl = env.SYLVARIA_SUPABASE_URL?.trim();
  const rawKey = env.SYLVARIA_SUPABASE_SECRET_KEY?.trim() || env.SYLVARIA_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const leaderboardSecret = env.SYLVARIA_LEADERBOARD_SECRET?.trim();
  const buildSha = env.VERCEL_GIT_COMMIT_SHA?.trim() || env.GITHUB_SHA?.trim() || (env.NODE_ENV === 'production' ? '' : 'local-dev');
  if (!supabaseUrl || !rawKey || !leaderboardSecret || !buildSha) return null;
  if (!/^https:\/\//.test(supabaseUrl)) throw new Error('SYLVARIA_SUPABASE_URL must use https');
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    supabaseKey: requireServerSecretKey(rawKey),
    leaderboardSecret,
    buildSha,
  };
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function authHeaders(key: string) {
  const headers: Record<string, string> = {
    apikey: key,
    'content-type': 'application/json',
  };
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;
  return headers;
}

function mapTicket(row: Record<string, unknown>): SylvariaRunTicketRecord {
  return {
    schema: 1,
    engineVersion: String(row.engine_version) as typeof SYLVARIA_ENGINE_VERSION,
    engineHash: String(row.engine_hash),
    seed: Number(row.seed),
    buildSha: String(row.build_sha),
    nonce: String(row.nonce),
    issuedAt: Date.parse(String(row.issued_at)),
    expiresAt: Date.parse(String(row.expires_at)),
    requestFingerprint: row.request_fingerprint ? String(row.request_fingerprint) : null,
    usedAt: row.used_at ? Date.parse(String(row.used_at)) : null,
  };
}

export class SupabaseSylvariaStore implements SylvariaTicketStore {
  constructor(private readonly config: Pick<SylvariaServerConfig, 'supabaseUrl' | 'supabaseKey'>) {}

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.config.supabaseUrl}${path}`, {
      ...init,
      headers: { ...authHeaders(this.config.supabaseKey), ...(init.headers ?? {}) },
      cache: 'no-store',
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);
      throw new Error(`Sylvaria leaderboard storage ${response.status}: ${detail || response.statusText}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) as unknown : null;
  }

  async registerEngine(options: { engineVersion: string; engineHash: string; buildSha: string; officialSeed: number }) {
    await this.request('/rest/v1/rpc/register_sylvaria_engine', {
      method: 'POST',
      body: JSON.stringify({
        p_engine_version: options.engineVersion,
        p_engine_hash: options.engineHash,
        p_build_sha: options.buildSha,
        p_official_seed: options.officialSeed,
      }),
    });
  }

  async issue(record: SylvariaRunTicketRecord) {
    await this.request('/rest/v1/rpc/issue_sylvaria_run_ticket', {
      method: 'POST',
      body: JSON.stringify({
        p_nonce: record.nonce,
        p_engine_version: record.engineVersion,
        p_engine_hash: record.engineHash,
        p_seed: record.seed,
        p_build_sha: record.buildSha,
        p_request_fingerprint: record.requestFingerprint,
        p_issued_at: iso(record.issuedAt),
        p_expires_at: iso(record.expiresAt),
      }),
    });
  }

  async claim(nonce: string, now: number) {
    const data = await this.request('/rest/v1/rpc/claim_sylvaria_run_ticket', {
      method: 'POST',
      body: JSON.stringify({ p_nonce: nonce, p_now: iso(now) }),
    });
    const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
    return rows[0] ? mapTicket(rows[0]) : null;
  }

  async saveVerifiedRun(record: SylvariaVerifiedRunRecord) {
    await this.request('/rest/v1/sylvaria_verified_runs', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        player_id: record.playerId ?? null,
        display_name: record.displayName,
        engine_version: record.engineVersion,
        engine_hash: record.engineHash,
        build_sha: record.buildSha,
        seed: record.seed,
        ticket_nonce: record.ticketNonce,
        replay_schema: record.replaySchema,
        replay_bytes: `\\x${Buffer.from(record.replayBytes).toString('hex')}`,
        replay_sha256: record.replayHash,
        score: record.score,
        world_depth: record.worldDepth,
        duration_ticks: record.durationTicks,
        final_state_sha256: record.stateHash,
        verification_proof: record.verificationProof,
      }),
    });
  }

  async listLeaderboard(options: { engineVersion: string; engineHash: string; seed: number; limit?: number }) {
    const limit = Math.max(1, Math.min(100, options.limit ?? 25));
    const params = new URLSearchParams({
      select: 'display_name,score,world_depth,duration_ticks,verified_at,verification_proof',
      engine_version: `eq.${options.engineVersion}`,
      engine_hash: `eq.${options.engineHash}`,
      seed: `eq.${options.seed}`,
      order: 'score.desc,verified_at.asc',
      limit: String(limit),
    });
    const data = await this.request(`/rest/v1/sylvaria_verified_runs?${params.toString()}`);
    const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
    return rows.map((row): SylvariaLeaderboardEntry => ({
      displayName: String(row.display_name),
      score: Number(row.score),
      worldDepth: Number(row.world_depth),
      durationTicks: Number(row.duration_ticks),
      verifiedAt: String(row.verified_at),
      verificationProof: String(row.verification_proof),
    }));
  }
}
