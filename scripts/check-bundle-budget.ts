import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = '.next/static/chunks';
const APP_MANIFEST = '.next/app-build-manifest.json';
const REPORT_PATH = 'artifacts/bundle-budget/report.json';
const MAX_SINGLE_CHUNK_BYTES = 2_000_000;
const MAX_ROUTE_BUNDLE_BYTES = 4_000_000;
const MAX_SPLIT_INVENTORY_BYTES = 20_000_000;

type Entry = { path: string; bytes: number };
type AppBuildManifest = { pages?: Record<string, string[]> };

async function walk(path: string, entries: Entry[]) {
  for (const name of await readdir(path)) {
    const full = join(path, name);
    const info = await stat(full);
    if (info.isDirectory()) await walk(full, entries);
    else if (name.endsWith('.js')) entries.push({ path: relative(ROOT, full), bytes: info.size });
  }
}

async function routeBundles(): Promise<Array<{ route: string; bytes: number; chunks: number; files: string[] }>> {
  let manifest: AppBuildManifest;
  try {
    manifest = JSON.parse(await readFile(APP_MANIFEST, 'utf8')) as AppBuildManifest;
  } catch (error) {
    throw new Error(`Unable to read ${APP_MANIFEST}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const pages = manifest.pages ?? {};
  const routes: Array<{ route: string; bytes: number; chunks: number; files: string[] }> = [];
  for (const [route, listed] of Object.entries(pages)) {
    const chunks = [...new Set(listed.filter((entry) => entry.endsWith('.js')))];
    const files: string[] = [];
    let bytes = 0;
    for (const chunk of chunks) {
      try {
        const size = (await stat(join('.next', chunk))).size;
        bytes += size;
        files.push(chunk);
      } catch {
        // Runtime entries that are not emitted into .next/static are excluded;
        // the global chunk scan below still catches oversized emitted JS.
      }
    }
    routes.push({ route, bytes, chunks: files.length, files });
  }
  return routes.sort((a, b) => b.bytes - a.bytes);
}

const entries: Entry[] = [];
await walk(ROOT, entries);
entries.sort((a, b) => b.bytes - a.bytes);
const inventoryBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const largest = entries[0];
const routes = await routeBundles();
const largestRoute = routes[0];

const failures: string[] = [];
if (entries.length === 0) failures.push('no Next.js JavaScript chunks found');
if (routes.length === 0) failures.push('no app route bundles found in the Next.js build manifest');
if (largest && largest.bytes > MAX_SINGLE_CHUNK_BYTES) {
  failures.push(`largest emitted chunk ${(largest.bytes / 1_000_000).toFixed(2)} MB exceeds ${(MAX_SINGLE_CHUNK_BYTES / 1_000_000).toFixed(2)} MB`);
}
if (largestRoute && largestRoute.bytes > MAX_ROUTE_BUNDLE_BYTES) {
  failures.push(`largest route bundle ${largestRoute.route} is ${(largestRoute.bytes / 1_000_000).toFixed(2)} MB and exceeds ${(MAX_ROUTE_BUNDLE_BYTES / 1_000_000).toFixed(2)} MB`);
}
if (inventoryBytes > MAX_SPLIT_INVENTORY_BYTES) {
  failures.push(`all-route split inventory ${(inventoryBytes / 1_000_000).toFixed(2)} MB exceeds ${(MAX_SPLIT_INVENTORY_BYTES / 1_000_000).toFixed(2)} MB`);
}

const report = {
  generatedAt: new Date().toISOString(),
  thresholds: {
    maxSingleChunkBytes: MAX_SINGLE_CHUNK_BYTES,
    maxRouteBundleBytes: MAX_ROUTE_BUNDLE_BYTES,
    maxSplitInventoryBytes: MAX_SPLIT_INVENTORY_BYTES,
  },
  inventory: {
    bytes: inventoryBytes,
    chunks: entries.length,
    largestChunks: entries.slice(0, 20),
  },
  routes,
  failures,
};
await mkdir('artifacts/bundle-budget', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Bundle inventory: ${entries.length} split JS chunks, ${(inventoryBytes / 1_000_000).toFixed(2)} MB across the entire site.`);
console.log('Largest emitted chunks:');
for (const entry of entries.slice(0, 10)) console.log(`  ${(entry.bytes / 1000).toFixed(1)} kB  ${entry.path}`);
console.log('Largest route entry bundles:');
for (const route of routes.slice(0, 10)) console.log(`  ${(route.bytes / 1000).toFixed(1)} kB  ${route.route} (${route.chunks} chunks)`);
console.log(`Wrote bundle report to ${REPORT_PATH}.`);

if (failures.length) {
  for (const failure of failures) console.error(`Bundle budget FAIL: ${failure}`);
  process.exit(1);
}
console.log('Bundle budget PASS.');
