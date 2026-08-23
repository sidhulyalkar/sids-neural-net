import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getIntegratedFrontierFeed } from '../lib/frontier/aggregate';

async function main() {
  // The daily archive is the deep collection path, not the request-time UI.
  // Let each adapter use its own bounded transport timeout rather than the
  // shorter first-paint budget enforced by /api/frontier/feed.
  const feed = await getIntegratedFrontierFeed({
    includeSnapshot: false,
    adapterDeadlineMs: false,
  });
  if (feed.items.length < 8) {
    throw new Error(`Refusing to replace the FRONTIER archive with only ${feed.items.length} live items.`);
  }

  const directory = join(process.cwd(), 'content', 'frontier');
  const path = join(directory, 'latest.json');
  await mkdir(directory, { recursive: true });
  await writeFile(path, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');

  const online = feed.sources.filter((source) => source.ok).length;
  console.log(`Wrote ${feed.items.length} FRONTIER items from ${online}/${feed.sources.length} online source groups to ${path}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});