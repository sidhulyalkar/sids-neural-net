import {
  dequantizeFrontierVector,
  quantizeFrontierVector,
  type FrontierChunkVector,
} from '../vector/chunkedVectorStore';
import type { MeshChunkPayload } from './meshSync';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const packed = (a << 16) | (b << 8) | c;
    output += BASE64[(packed >>> 18) & 63];
    output += BASE64[(packed >>> 12) & 63];
    output += index + 1 < bytes.length ? BASE64[(packed >>> 6) & 63] : '=';
    output += index + 2 < bytes.length ? BASE64[packed & 63] : '=';
  }
  return output;
}

function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/\s+/g, '');
  if (!clean || clean.length % 4 !== 0) return new Uint8Array();
  const output: number[] = [];
  for (let index = 0; index < clean.length; index += 4) {
    const a = BASE64.indexOf(clean[index]);
    const b = BASE64.indexOf(clean[index + 1]);
    const c = clean[index + 2] === '=' ? 0 : BASE64.indexOf(clean[index + 2]);
    const d = clean[index + 3] === '=' ? 0 : BASE64.indexOf(clean[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) return new Uint8Array();
    const packed = (a << 18) | (b << 12) | (c << 6) | d;
    output.push((packed >>> 16) & 255);
    if (clean[index + 2] !== '=') output.push((packed >>> 8) & 255);
    if (clean[index + 3] !== '=') output.push(packed & 255);
  }
  return Uint8Array.from(output);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

type EncodedEntry = {
  id: string;
  scale: number;
  vector: string;
  textHash: string;
  createdAt: number;
  lastAccessedAt: number;
  title?: string;
  sourceLabel?: string;
  lane?: string;
  publishedAt?: string;
  engagement?: number;
  lastSignalAt?: number;
};

type EncodedChunk = {
  version: 1;
  entries: EncodedEntry[];
};

export function encodeMeshVectorChunk(chunkId: string, entries: FrontierChunkVector[], updatedAt = Date.now()): MeshChunkPayload {
  const encoded: EncodedChunk = {
    version: 1,
    entries: entries.slice(0, 48).map((entry) => {
      const quantized = quantizeFrontierVector(entry.vector);
      return {
        id: entry.id,
        scale: quantized.scale,
        vector: bytesToBase64(new Uint8Array(quantized.data.buffer, quantized.data.byteOffset, quantized.data.byteLength)),
        textHash: entry.textHash,
        createdAt: entry.createdAt,
        lastAccessedAt: entry.lastAccessedAt,
        title: entry.title,
        sourceLabel: entry.sourceLabel,
        lane: entry.lane,
        publishedAt: entry.publishedAt,
        engagement: entry.engagement,
        lastSignalAt: entry.lastSignalAt,
      };
    }),
  };
  const payload = JSON.stringify(encoded);
  return {
    chunkId,
    hash: stableHash(payload),
    payload,
    count: encoded.entries.length,
    updatedAt,
  };
}

export function decodeMeshVectorChunk(chunk: MeshChunkPayload): FrontierChunkVector[] {
  if (!chunk.payload) return [];
  try {
    const decoded = JSON.parse(chunk.payload) as EncodedChunk;
    if (decoded.version !== 1 || !Array.isArray(decoded.entries)) return [];
    return decoded.entries.slice(0, 48).flatMap((entry) => {
      const bytes = base64ToBytes(entry.vector);
      if (!bytes.length) return [];
      const signed = new Int8Array(bytes.length);
      for (let index = 0; index < bytes.length; index += 1) signed[index] = bytes[index] > 127 ? bytes[index] - 256 : bytes[index];
      const vector = dequantizeFrontierVector({ scale: entry.scale, data: signed });
      return [{
        id: entry.id,
        vector,
        textHash: entry.textHash,
        createdAt: entry.createdAt,
        lastAccessedAt: entry.lastAccessedAt,
        title: entry.title,
        sourceLabel: entry.sourceLabel,
        lane: entry.lane,
        publishedAt: entry.publishedAt,
        engagement: entry.engagement,
        lastSignalAt: entry.lastSignalAt,
      }];
    });
  } catch {
    return [];
  }
}
