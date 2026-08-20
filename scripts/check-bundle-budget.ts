import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = '.next/static/chunks';
const REPORT_PATH = 'artifacts/bundle-budget/report.json';
const MAX_SINGLE_CHUNK_BYTES = 2_000_000;
const MAX_SPLIT_INVENTORY_BYTES = 20_000_000;

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
const inventoryBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const largest = entries[0];

const failures: string[] = [];
if (entries.length === 0) failures.push('no Next.js JavaScript chunks found');
if (largest && largest.bytes > MAX_SINGLE_CHUNK_BYTES) {
  failures.push(`largest emitted chunk ${(largest.bytes / 1_000_000).toFixed(2)} MB exceeds ${(MAX_SINGLE_CHUNK_BYTES / 1_000_000).toFixed(2)} MB`);
}
if (inventoryBytes > MAX_SPLIT_INVENTORY_BYTES) {
  failures.push(`all-route split inventory ${(inventoryBytes / 1_000_000).toFixed(2)} MB exceeds ${(MAX_SPLIT_INVENTORY_BYTES / 1_000_000).toFixed(2)} MB`);
}

const report = {
  generatedAt: new Date().toISOString(),
  note: 'Next.js 16 removed legacy per-route JS size build metrics. This gate bounds emitted chunk size and the total split-JS inventory. CI separately runs public-route browser smoke tests; route/module analysis is captured with Next experimental-analyze.',
  thresholds: {
    maxSingleChunkBytes: MAX_SINGLE_CHUNK_BYTES,
    maxSplitInventoryBytes: MAX_SPLIT_INVENTORY_BYTES,
  },
  inventory: {
    bytes: inventoryBytes,
    chunks: entries.length,
    largestChunks: entries.slice(0, 30),
  },
  failures,
};
await mkdir('artifacts/bundle-budget', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Bundle inventory: ${entries.length} split JS chunks, ${(inventoryBytes / 1_000_000).toFixed(2)} MB across the entire route-split site.`);
console.log('Largest emitted chunks:');
for (const entry of entries.slice(0, 12)) console.log(`  ${(entry.bytes / 1000).toFixed(1)} kB  ${entry.path}`);
console.log(`Wrote bundle report to ${REPORT_PATH}.`);

if (failures.length) {
  for (const failure of failures) console.error(`Bundle budget FAIL: ${failure}`);
  process.exit(1);
}
console.log('Bundle budget PASS.');
