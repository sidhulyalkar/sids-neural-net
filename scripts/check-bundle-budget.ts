import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = '.next/static/chunks';
const MAX_SINGLE_CHUNK_BYTES = 2_000_000;
const MAX_TOTAL_CHUNK_BYTES = 12_000_000;

type Entry = { path: string; bytes: number };

async function walk(path: string, entries: Entry[]) {
  for (const name of await readdir(path)) {
    const full = join(path, name);
    const info = await stat(full);
    if (info.isDirectory()) await walk(full, entries);
    else if (name.endsWith('.js')) entries.push({ path: relative(ROOT, full), bytes: info.size });
  }
}

const entries: Entry[] = [];
await walk(ROOT, entries);
entries.sort((a, b) => b.bytes - a.bytes);
const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const largest = entries[0];

console.log(`Bundle budget: ${entries.length} JS chunks, ${(total / 1_000_000).toFixed(2)} MB total.`);
for (const entry of entries.slice(0, 10)) console.log(`  ${(entry.bytes / 1000).toFixed(1)} kB  ${entry.path}`);

const failures: string[] = [];
if (largest && largest.bytes > MAX_SINGLE_CHUNK_BYTES) failures.push(`largest chunk ${(largest.bytes / 1_000_000).toFixed(2)} MB exceeds ${(MAX_SINGLE_CHUNK_BYTES / 1_000_000).toFixed(2)} MB`);
if (total > MAX_TOTAL_CHUNK_BYTES) failures.push(`total chunk payload ${(total / 1_000_000).toFixed(2)} MB exceeds ${(MAX_TOTAL_CHUNK_BYTES / 1_000_000).toFixed(2)} MB`);
if (entries.length === 0) failures.push('no Next.js JavaScript chunks found');

if (failures.length) {
  for (const failure of failures) console.error(`Bundle budget FAIL: ${failure}`);
  process.exit(1);
}
console.log('Bundle budget PASS.');
