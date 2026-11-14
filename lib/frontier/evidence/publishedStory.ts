import 'server-only';

import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { z } from 'zod';
import { parseQualifiedStoryManifest } from './eligibility';
import type { StoryManifest } from './schema';

const CONTENT_DIR = resolve(process.cwd(), 'content/frontier/stories');
const STORY_ID = /^[a-z0-9][a-z0-9_-]{2,119}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MAX_JSON = 350_000;
const MAX_ASSET = 4 * 1024 * 1024;

const AssetIndexSchema = z.array(z.strictObject({
  key: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  sourceUrl: z.url().max(2048),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  path: z.string().min(1).max(160),
  size: z.number().int().positive().max(MAX_ASSET),
})).max(12);

type AssetRecord = z.infer<typeof AssetIndexSchema>[number];
export type PublishedStory = {
  manifest: StoryManifest;
  assetPaths: Record<string, string>;
  /** Private index, never serialized to the client. */
  assetIndex: AssetRecord[];
  directory: string;
};

async function readBoundedJson(path: string): Promise<unknown> {
  const file = await lstat(path);
  if (!file.isFile() || file.isSymbolicLink() || file.size > MAX_JSON) {
    throw new Error('Published story is not a bounded regular JSON artifact');
  }
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function safeAssetFilename(entry: AssetRecord): string {
  const digest = entry.key.slice('sha256:'.length);
  const ext = entry.mimeType === 'image/png' ? 'png' : entry.mimeType === 'image/jpeg' ? 'jpg' : 'webp';
  const expected = 'assets/' + digest + '.' + ext;
  if (entry.path !== expected) throw new Error('Published asset path does not match its content hash');
  return expected;
}

export async function getPublishedStory(id: string): Promise<PublishedStory | null> {
  if (!STORY_ID.test(id)) return null;
  const directory = resolve(CONTENT_DIR, id);
  const gap = relative(CONTENT_DIR, directory);
  if (!gap || gap.startsWith('..') || isAbsolute(gap)) return null;

  // Only administratively published bundles inside the checked-in content root
  // are visible. The offline build's /tmp files are never web-accessible.
  let canonical: string;
  try {
    canonical = await realpath(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const canonicalRoot = await realpath(CONTENT_DIR);
  const relativeToRoot = relative(canonicalRoot, canonical);
  if (!relativeToRoot || relativeToRoot === '..'
    || relativeToRoot.startsWith('..' + sep) || isAbsolute(relativeToRoot)) {
    throw new Error('Published story resolves outside approved repository content root');
  }
  const manifest = parseQualifiedStoryManifest(await readBoundedJson(resolve(canonical, 'manifest.json')));
  if (manifest.itemId !== id) throw new Error('Published manifest identity does not match route ID');

  const assetIndex = AssetIndexSchema.parse(await readBoundedJson(resolve(canonical, 'assets.json')));
  const matched = new Map<string, AssetRecord>();
  for (const asset of assetIndex) {
    safeAssetFilename(asset);
    const existing = matched.get(asset.key);
    if (existing && (existing.path !== asset.path || existing.sourceUrl !== asset.sourceUrl
      || existing.size !== asset.size)) {
      throw new Error('Conflicting asset metadata for identical content hash');
    }
    matched.set(asset.key, asset);
  }
  const assetPaths: Record<string, string> = {};
  for (const figure of manifest.evidence.filter((entry) => entry.type === 'figure')) {
    if (figure.type !== 'figure' || figure.rights.display !== 'permitted') continue;
    if (!matched.has(figure.assetKey)) throw new Error('Approved figure has no corresponding published asset');
    const digest = figure.assetKey.slice('sha256:'.length);
    assetPaths[figure.assetKey] = '/api/frontier/story-assets/' + encodeURIComponent(id) + '/' + digest;
  }
  return { manifest, directory: canonical, assetIndex, assetPaths };
}

export async function readPublishedStoryAsset(
  story: PublishedStory,
  digest: string,
): Promise<{ bytes: Uint8Array; mimeType: AssetRecord['mimeType'] } | null> {
  if (!DIGEST.test(digest)) return null;
  const key = 'sha256:' + digest;
  const entry = story.assetIndex.find((candidate) => candidate.key === key);
  if (!entry || !story.manifest.evidence.some((record) =>
    record.type === 'figure' && record.assetKey === key && record.rights.display === 'permitted')) return null;
  const filename = safeAssetFilename(entry);
  const path = resolve(story.directory, filename);
  const canonical = await realpath(path);
  const rel = relative(story.directory, canonical);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error('Published asset resolves outside approved story bundle');
  }
  const file = await lstat(path);
  if (!file.isFile() || file.isSymbolicLink() || file.size !== entry.size || file.size > MAX_ASSET) {
    throw new Error('Published asset no longer matches approved metadata');
  }
  const bytes = await readFile(path);
  if (createHash('sha256').update(bytes).digest('hex') !== digest) {
    throw new Error('Published asset differs from immutable content hash');
  }
  return { bytes, mimeType: entry.mimeType };
}
