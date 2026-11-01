import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getIntegratedFrontierFeed } from '../lib/frontier/aggregate';
import { assertQualifiedFrontierArchive, buildFrontierDiscoveryLedger } from '../lib/frontier/discoveryLedger';

async function readPreviousLedger(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    // A corrupted ledger needs review. Never silently erase the historical
    // first-seen dates just because reading the last version failed.
    throw error;
  }
}

async function main() {
  // Full adapter deadlines only in scheduled discovery. Page rendering and
  // cached-fresh searches remain separate from this deep ingestion path.
  const feed = await getIntegratedFrontierFeed({
    includeSnapshot: false,
    adapterDeadlineMs: false,
  });
  assertQualifiedFrontierArchive(feed);

  const directory = join(process.cwd(), 'content', 'frontier');
  const snapshotPath = join(directory, 'latest.json');
  const ledgerPath = join(directory, 'discovery-ledger.json');
  await mkdir(directory, { recursive: true });
  const previous = await readPreviousLedger(ledgerPath);
  const ledger = buildFrontierDiscoveryLedger(feed, previous);

  // Prepare both files before replacing either. The existing PR qualification
  // checks the resulting snapshot and the workflow commits them together.
  const tempSnapshot = snapshotPath + '.pending';
  const tempLedger = ledgerPath + '.pending';
  await Promise.all([
    writeFile(tempSnapshot, JSON.stringify(feed, null, 2) + '\n', 'utf8'),
    writeFile(tempLedger, JSON.stringify(ledger, null, 2) + '\n', 'utf8'),
  ]);
  await rename(tempLedger, ledgerPath);
  await rename(tempSnapshot, snapshotPath);

  const online = feed.sources.filter((source) => source.ok).length;
  console.log(
    'FRONTIER qualified archive: ' +
    JSON.stringify({
      candidates: feed.items.length,
      onlineSources: online,
      totalSourceGroups: feed.sources.length,
      editorialNew: ledger.latest.editorialNew,
      discovered: ledger.latest.discovered,
      revised: ledger.latest.revised,
      unchanged: ledger.latest.unchanged,
      observedHistory: ledger.latest.retained,
      degradedSources: ledger.latest.sourceFailures,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
