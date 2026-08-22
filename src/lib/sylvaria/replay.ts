export const SYLVARIA_REPLAY_SCHEMA = 1 as const;
export const SYLVARIA_ENGINE_VERSION = '0.11.0' as const;
export const SYLVARIA_OFFICIAL_SEED = 110001;
export const SYLVARIA_MAX_REPLAY_TICKS = 120 * 60 * 20;
export const SYLVARIA_MAX_REPLAY_EVENTS = 20_000;
export const SYLVARIA_MAX_REPLAY_BYTES = 120 * 1024;

export const SYLVARIA_ACTIONS = [
  'w-down',
  'w-up',
  'a-down',
  'a-up',
  's-down',
  's-up',
  'd-down',
  'd-up',
  'cut-up',
  'cut-down',
  'cut-left',
  'cut-right',
] as const;

export type SylvariaReplayAction = (typeof SYLVARIA_ACTIONS)[number];
export type SylvariaReplayActionCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type SylvariaReplayEvent = {
  tick: number;
  action: SylvariaReplayActionCode;
};

export type SylvariaReplayEnvelope = {
  schema: typeof SYLVARIA_REPLAY_SCHEMA;
  engineVersion: typeof SYLVARIA_ENGINE_VERSION;
  engineHash: string;
  seed: number;
  durationTicks: number;
  input: string;
};

export type SylvariaReplayLimits = {
  maxTicks?: number;
  maxEvents?: number;
  maxBytes?: number;
};

const limitValue = (value: number | undefined, fallback: number) => value ?? fallback;

function assertSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

function assertActionCode(value: number): asserts value is SylvariaReplayActionCode {
  if (!Number.isInteger(value) || value < 0 || value >= SYLVARIA_ACTIONS.length) {
    throw new Error(`invalid Sylvaria replay action code ${value}`);
  }
}

function varintLength(value: number) {
  let remaining = value;
  let length = 1;
  while (remaining >= 0x80) {
    remaining = Math.floor(remaining / 0x80);
    length += 1;
  }
  return length;
}

function pushVarint(out: number[], value: number) {
  assertSafeInteger(value, 'varint');
  let remaining = value;
  do {
    let byte = remaining % 0x80;
    remaining = Math.floor(remaining / 0x80);
    if (remaining > 0) byte |= 0x80;
    out.push(byte);
  } while (remaining > 0);
}

function readVarint(bytes: Uint8Array, offset: number) {
  let value = 0;
  let multiplier = 1;
  let cursor = offset;
  for (let count = 0; count < 5; count += 1) {
    if (cursor >= bytes.length) throw new Error('truncated Sylvaria replay varint');
    const byte = bytes[cursor];
    cursor += 1;
    value += (byte & 0x7f) * multiplier;
    if (!Number.isSafeInteger(value)) throw new Error('Sylvaria replay varint exceeds safe integer range');
    if ((byte & 0x80) === 0) {
      const consumed = cursor - offset;
      if (varintLength(value) !== consumed) throw new Error('non-canonical Sylvaria replay varint');
      return { value, next: cursor };
    }
    multiplier *= 0x80;
  }
  throw new Error('Sylvaria replay varint is too long');
}

export function encodeSylvariaReplayEvents(
  events: readonly SylvariaReplayEvent[],
  limits: SylvariaReplayLimits = {},
) {
  const maxTicks = limitValue(limits.maxTicks, SYLVARIA_MAX_REPLAY_TICKS);
  const maxEvents = limitValue(limits.maxEvents, SYLVARIA_MAX_REPLAY_EVENTS);
  const maxBytes = limitValue(limits.maxBytes, SYLVARIA_MAX_REPLAY_BYTES);
  if (events.length > maxEvents) throw new Error(`Sylvaria replay exceeds ${maxEvents} events`);

  const out: number[] = [];
  let previousTick = 0;
  for (const [index, event] of events.entries()) {
    assertSafeInteger(event.tick, `event ${index} tick`);
    assertActionCode(event.action);
    if (event.tick < 1) throw new Error('Sylvaria replay events must begin at tick 1 or later');
    if (event.tick > maxTicks) throw new Error(`Sylvaria replay event exceeds tick limit ${maxTicks}`);
    if (event.tick < previousTick) throw new Error('Sylvaria replay events must be monotonic by tick');
    const delta = event.tick - previousTick;
    const packed = delta * 16 + event.action;
    pushVarint(out, packed);
    if (out.length > maxBytes) throw new Error(`Sylvaria replay exceeds ${maxBytes} encoded bytes`);
    previousTick = event.tick;
  }
  return Uint8Array.from(out);
}

export function decodeSylvariaReplayEvents(
  bytes: Uint8Array,
  limits: SylvariaReplayLimits = {},
) {
  const maxTicks = limitValue(limits.maxTicks, SYLVARIA_MAX_REPLAY_TICKS);
  const maxEvents = limitValue(limits.maxEvents, SYLVARIA_MAX_REPLAY_EVENTS);
  const maxBytes = limitValue(limits.maxBytes, SYLVARIA_MAX_REPLAY_BYTES);
  if (bytes.byteLength > maxBytes) throw new Error(`Sylvaria replay exceeds ${maxBytes} encoded bytes`);

  const events: SylvariaReplayEvent[] = [];
  let cursor = 0;
  let tick = 0;
  while (cursor < bytes.length) {
    if (events.length >= maxEvents) throw new Error(`Sylvaria replay exceeds ${maxEvents} events`);
    const { value: packed, next } = readVarint(bytes, cursor);
    cursor = next;
    const action = packed % 16;
    assertActionCode(action);
    const delta = Math.floor(packed / 16);
    tick += delta;
    if (tick < 1) throw new Error('Sylvaria replay events must begin at tick 1 or later');
    if (tick > maxTicks) throw new Error(`Sylvaria replay event exceeds tick limit ${maxTicks}`);
    events.push({ tick, action });
  }
  return events;
}

export function sylvariaActionName(code: SylvariaReplayActionCode) {
  return SYLVARIA_ACTIONS[code];
}

export function sylvariaReplayBytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url');
}

export function sylvariaReplayBytesFromBase64Url(value: string, maxBytes = SYLVARIA_MAX_REPLAY_BYTES) {
  if (typeof value !== 'string' || value.length > Math.ceil((maxBytes * 4) / 3) + 8) {
    throw new Error('Sylvaria replay base64url payload is too large');
  }
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Sylvaria replay input must be canonical base64url');
  const bytes = Uint8Array.from(Buffer.from(value, 'base64url'));
  if (bytes.byteLength > maxBytes) throw new Error(`Sylvaria replay exceeds ${maxBytes} encoded bytes`);
  if (sylvariaReplayBytesToBase64Url(bytes) !== value) throw new Error('Sylvaria replay input is not canonical base64url');
  return bytes;
}

export function validateSylvariaReplayEnvelope(value: unknown): SylvariaReplayEnvelope {
  if (!value || typeof value !== 'object') throw new Error('Sylvaria replay envelope must be an object');
  const input = value as Partial<SylvariaReplayEnvelope>;
  if (input.schema !== SYLVARIA_REPLAY_SCHEMA) throw new Error(`unsupported Sylvaria replay schema ${String(input.schema)}`);
  if (input.engineVersion !== SYLVARIA_ENGINE_VERSION) throw new Error(`unsupported Sylvaria engine version ${String(input.engineVersion)}`);
  if (typeof input.engineHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.engineHash)) throw new Error('Sylvaria engine hash must be lowercase SHA-256');
  if (!Number.isSafeInteger(input.seed) || input.seed !== SYLVARIA_OFFICIAL_SEED) throw new Error('Sylvaria replay seed is not the active official seed');
  if (!Number.isSafeInteger(input.durationTicks) || (input.durationTicks ?? 0) < 1 || (input.durationTicks ?? 0) > SYLVARIA_MAX_REPLAY_TICKS) {
    throw new Error(`Sylvaria replay duration must be 1..${SYLVARIA_MAX_REPLAY_TICKS} ticks`);
  }
  const bytes = sylvariaReplayBytesFromBase64Url(input.input ?? '');
  const events = decodeSylvariaReplayEvents(bytes);
  const lastTick = events.at(-1)?.tick ?? 0;
  if (lastTick > (input.durationTicks ?? 0)) throw new Error('Sylvaria replay contains input after declared duration');
  return input as SylvariaReplayEnvelope;
}
