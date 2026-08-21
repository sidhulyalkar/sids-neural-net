import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { FrontierPersistedState } from './types';

export type FrontierRemoteMemory = {
  version: 1;
  updatedAt: string;
  state: FrontierPersistedState;
};

export type GoogleGrant = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
  tokenType?: string;
};

type RedisResponse<T> = { result?: T; error?: string };

type EncryptedPayload = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.FRONTIER_REDIS_REST_URL?.trim()
    || process.env.UPSTASH_REDIS_REST_URL?.trim()
    || process.env.KV_REST_API_URL?.trim();
  const token = process.env.FRONTIER_REDIS_REST_TOKEN?.trim()
    || process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
    || process.env.KV_REST_API_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function remoteMemoryConfigured(): boolean {
  return Boolean(redisConfig());
}

async function redisCommand<T>(command: Array<string | number>): Promise<T | null> {
  const config = redisConfig();
  if (!config) return null;
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`remote memory returned ${response.status}`);
  const payload = await response.json() as RedisResponse<T>;
  if (payload.error) throw new Error(payload.error);
  return payload.result ?? null;
}

function userKey(sub: string, suffix: string): string {
  const digest = createHash('sha256').update(sub).digest('hex').slice(0, 32);
  return `frontier:user:${digest}:${suffix}`;
}

function encryptionKey(purpose: 'memory' | 'google'): Buffer {
  const secret = process.env.FRONTIER_AUTH_SECRET?.trim();
  if (!secret) throw new Error('FRONTIER_AUTH_SECRET is required to encrypt private FRONTIER data');
  return createHash('sha256').update(`frontier-${purpose}:${secret}`).digest();
}

function encrypt(value: unknown, purpose: 'memory' | 'google'): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(purpose), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const payload: EncryptedPayload = {
    v: 1,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: encrypted.toString('base64url'),
  };
  return JSON.stringify(payload);
}

function decrypt<T>(value: string, purpose: 'memory' | 'google'): T | null {
  try {
    const payload = JSON.parse(value) as EncryptedPayload;
    if (payload.v !== 1 || !payload.iv || !payload.tag || !payload.data) return null;
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(purpose), Buffer.from(payload.iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64url')),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export async function getRemoteMemory(sub: string): Promise<FrontierRemoteMemory | null> {
  const raw = await redisCommand<string>(['GET', userKey(sub, 'memory')]);
  return raw ? decrypt<FrontierRemoteMemory>(raw, 'memory') : null;
}

export async function putRemoteMemory(sub: string, state: FrontierPersistedState): Promise<FrontierRemoteMemory> {
  if (!remoteMemoryConfigured()) throw new Error('remote memory is not configured');
  const envelope: FrontierRemoteMemory = {
    version: 1,
    updatedAt: new Date().toISOString(),
    state,
  };
  await redisCommand<string>(['SET', userKey(sub, 'memory'), encrypt(envelope, 'memory')]);
  return envelope;
}

export async function getGoogleGrant(sub: string): Promise<GoogleGrant | null> {
  const raw = await redisCommand<string>(['GET', userKey(sub, 'google')]);
  return raw ? decrypt<GoogleGrant>(raw, 'google') : null;
}

export async function putGoogleGrant(sub: string, grant: GoogleGrant): Promise<void> {
  if (!remoteMemoryConfigured()) throw new Error('remote memory is required for Google preference imports');
  await redisCommand<string>(['SET', userKey(sub, 'google'), encrypt(grant, 'google')]);
}

export async function clearGoogleGrant(sub: string): Promise<void> {
  if (!remoteMemoryConfigured()) return;
  await redisCommand<number>(['DEL', userKey(sub, 'google')]);
}
