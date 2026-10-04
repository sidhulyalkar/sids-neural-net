#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'src/data/visualMotionManifest.json');
const CACHE_DIR = path.join(ROOT, '.cache/mux-video');
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

function usage(exitCode = 0) {
  console.log(`
Mux Visual Motion

Upload:
  npm run motion:upload -- <file-or-directory> [more files...] [options]

Options:
  --publish                     Publish immediately (default is draft)
  --featured                    Mark the entry as featured
  --recursive                   Recurse into directories
  --dry-run                     Probe/hash only; do not contact Mux
  --title <text>                Title override (single-file uploads only)
  --description <text>          Description
  --collection <text>           Collection label, e.g. Moorea
  --location <text>             Capture location
  --captured-with <text>        Camera label
  --date <YYYY-MM-DD>           Capture date
  --alt <text>                  Poster alternative text
  --poster-time <seconds>       Thumbnail time; default is 12% of duration
  --quality <basic|plus|premium> Mux video quality, default basic

Curation:
  npm run motion:publish -- <slug>
  npm run motion:unpublish -- <slug>

Recovery:
  npm run motion:resume -- <mux-upload-id>

Validation:
  npm run motion:check
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {};
  const positional = [];
  const booleanFlags = new Set(['publish', 'featured', 'recursive', 'dry-run']);
  const valueFlags = new Set([
    'title',
    'description',
    'collection',
    'location',
    'captured-with',
    'date',
    'alt',
    'poster-time',
    'quality',
  ]);

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    if (booleanFlags.has(key)) {
      options[key] = true;
      continue;
    }
    if (valueFlags.has(key)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
      options[key] = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return { options, positional };
}

function readManifest() {
  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('visualMotionManifest.json must contain a JSON array');
  return parsed;
}

function writeManifest(entries) {
  const temp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, MANIFEST_PATH);
}

function slugify(input) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'video';
}

function humanizeFilename(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function uniqueSlug(base, entries) {
  const ids = new Set(entries.map((entry) => entry.id));
  if (!ids.has(base)) return base;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!ids.has(candidate)) return candidate;
  }
  throw new Error(`Could not create a unique slug for ${base}`);
}

function collectDirectory(directory, recursive, target) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const resolved = path.join(directory, item.name);
    if (item.isDirectory()) {
      if (recursive) collectDirectory(resolved, recursive, target);
      continue;
    }
    if (item.isFile() && VIDEO_EXTENSIONS.has(path.extname(item.name).toLowerCase())) {
      target.push(resolved);
    }
  }
}

function collectFiles(inputs, recursive) {
  const found = [];
  for (const raw of inputs) {
    const resolved = path.resolve(raw);
    if (!fs.existsSync(resolved)) throw new Error(`Input does not exist: ${resolved}`);
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) collectDirectory(resolved, recursive, found);
    else if (stat.isFile() && VIDEO_EXTENSIONS.has(path.extname(resolved).toLowerCase())) found.push(resolved);
    else throw new Error(`Unsupported video input: ${resolved}`);
  }
  return [...new Set(found)].sort((a, b) => a.localeCompare(b));
}

function requireBinary(name) {
  const result = spawnSync('which', [name], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Missing required binary "${name}".`);
  }
}

function rateToNumber(rate) {
  if (!rate) return undefined;
  const [numerator, denominator = '1'] = String(rate).split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return undefined;
  return Number((numerator / denominator).toFixed(3));
}

function probeVideo(filePath) {
  requireBinary('ffprobe');
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,codec_name,r_frame_rate,color_space,color_transfer,color_primaries,pix_fmt:format=duration',
      '-of',
      'json',
      filePath,
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe failed for ${filePath}: ${result.stderr.trim()}`);
  }

  const payload = JSON.parse(result.stdout);
  const stream = payload.streams?.[0];
  const duration = Number(payload.format?.duration);
  if (!stream?.width || !stream?.height || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read usable video metadata from ${filePath}`);
  }

  return {
    width: Number(stream.width),
    height: Number(stream.height),
    durationSeconds: Number(duration.toFixed(3)),
    fps: rateToNumber(stream.r_frame_rate),
    codec: stream.codec_name || undefined,
    pixelFormat: stream.pix_fmt || undefined,
    colorSpace: stream.color_space || undefined,
    colorTransfer: stream.color_transfer || undefined,
    colorPrimaries: stream.color_primaries || undefined,
  };
}

async function sha256File(filePath) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function resolutionTier(height) {
  if (height >= 2160) return '2160p';
  if (height >= 1440) return '1440p';
  return '1080p';
}

function requireMuxCredentials() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error('Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET. Add them to .env.local.');
  }
  return { tokenId, tokenSecret };
}

async function muxRequest(endpoint, init = {}) {
  const { tokenId, tokenSecret } = requireMuxCredentials();
  const response = await fetch(`https://api.mux.com/video/v1${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Mux API ${response.status}: ${payload?.error?.messages?.join?.('; ') || payload?.error?.message || text || response.statusText}`);
  }
  return payload.data;
}

async function createDirectUpload(meta, quality) {
  return await muxRequest('/uploads', {
    method: 'POST',
    body: JSON.stringify({
      timeout: 86400,
      new_asset_settings: {
        playback_policies: ['public'],
        video_quality: quality,
        max_resolution_tier: resolutionTier(meta.height),
        passthrough: meta.id,
        meta: {
          title: meta.title,
          external_id: meta.id,
        },
      },
    }),
  });
}

function uploadFileWithCurl(filePath, uploadUrl) {
  requireBinary('curl');
  const result = spawnSync(
    'curl',
    [
      '--fail-with-body',
      '--location',
      '--retry',
      '5',
      '--retry-delay',
      '2',
      '--retry-all-errors',
      '--connect-timeout',
      '30',
      '--progress-bar',
      '--request',
      'PUT',
      '--upload-file',
      filePath,
      uploadUrl,
    ],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) throw new Error(`Upload failed for ${filePath}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUpload(uploadId, timeoutMs = 30 * 60 * 1000) {
  const started = Date.now();
  let lastStatus = '';
  while (Date.now() - started < timeoutMs) {
    const upload = await muxRequest(`/uploads/${uploadId}`);
    if (upload.status !== lastStatus) {
      console.log(`Mux upload ${uploadId}: ${upload.status}`);
      lastStatus = upload.status;
    }
    if (upload.asset_id) return upload.asset_id;
    if (['errored', 'timed_out', 'cancelled'].includes(upload.status)) {
      throw new Error(`Mux upload ${uploadId} ended with status ${upload.status}`);
    }
    await sleep(5000);
  }
  throw new Error(`Timed out waiting for Mux upload ${uploadId} to create an asset`);
}

async function waitForAsset(assetId, timeoutMs = 60 * 60 * 1000) {
  const started = Date.now();
  let lastStatus = '';
  while (Date.now() - started < timeoutMs) {
    const asset = await muxRequest(`/assets/${assetId}`);
    if (asset.status !== lastStatus) {
      console.log(`Mux asset ${assetId}: ${asset.status}`);
      lastStatus = asset.status;
    }
    if (asset.status === 'ready') return asset;
    if (asset.status === 'errored') {
      throw new Error(`Mux asset ${assetId} failed: ${JSON.stringify(asset.errors || [])}`);
    }
    await sleep(7000);
  }
  throw new Error(`Timed out waiting for Mux asset ${assetId}`);
}

function checkpointPath(uploadId) {
  return path.join(CACHE_DIR, `pending-${uploadId}.json`);
}

function saveCheckpoint(uploadId, payload) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(checkpointPath(uploadId), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

function removeCheckpoint(uploadId) {
  const filePath = checkpointPath(uploadId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function finalizeManifestEntry(meta, uploadId, asset) {
  const playbackId = asset.playback_ids?.find((item) => item.policy === 'public')?.id || asset.playback_ids?.[0]?.id;
  if (!playbackId) throw new Error(`Mux asset ${asset.id} is ready but has no playback ID`);

  const entries = readManifest();
  if (entries.some((entry) => entry.source?.sha256 === meta.source.sha256)) {
    console.log(`Skipping duplicate source already present in manifest: ${meta.source.name}`);
    removeCheckpoint(uploadId);
    return;
  }

  entries.push({
    id: meta.id,
    title: meta.title,
    ...(meta.description ? { description: meta.description } : {}),
    ...(meta.alt ? { alt: meta.alt } : {}),
    ...(meta.collection ? { collection: meta.collection } : {}),
    ...(meta.location ? { location: meta.location } : {}),
    ...(meta.capturedWith ? { capturedWith: meta.capturedWith } : {}),
    ...(meta.date ? { date: meta.date } : {}),
    tags: meta.tags || [],
    featured: Boolean(meta.featured),
    published: Boolean(meta.published),
    durationSeconds: meta.durationSeconds,
    width: meta.width,
    height: meta.height,
    ...(meta.fps ? { fps: meta.fps } : {}),
    posterTimeSeconds: meta.posterTimeSeconds,
    mux: {
      uploadId,
      assetId: asset.id,
      playbackId,
      resolutionTier: asset.resolution_tier || resolutionTier(meta.height),
      videoQuality: asset.video_quality || meta.videoQuality,
    },
    source: meta.source,
    technical: meta.technical,
  });

  entries.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.title.localeCompare(b.title));
  writeManifest(entries);
  removeCheckpoint(uploadId);

  console.log(`\nAdded ${meta.id} to src/data/visualMotionManifest.json`);
  console.log(`Playback ID: ${playbackId}`);
  console.log(meta.published ? 'Published: yes' : `Published: no (run: npm run motion:publish -- ${meta.id})`);
}

async function buildMeta(filePath, options, entries, usedSlugs) {
  const probe = probeVideo(filePath);
  const stat = fs.statSync(filePath);
  console.log(`Hashing ${path.basename(filePath)}...`);
  const sha256 = await sha256File(filePath);

  const duplicate = entries.find((entry) => entry.source?.sha256 === sha256);
  if (duplicate) {
    return { duplicate, filePath, probe, sha256 };
  }

  const title = options.title || humanizeFilename(filePath);
  const baseSlug = slugify(title);
  let id = uniqueSlug(baseSlug, [...entries, ...[...usedSlugs].map((slug) => ({ id: slug }))]);
  usedSlugs.add(id);

  const posterTimeCandidate = options['poster-time'] === undefined
    ? Math.min(Math.max(probe.durationSeconds * 0.12, 0.25), Math.max(probe.durationSeconds - 0.1, 0.25))
    : Number(options['poster-time']);

  if (!Number.isFinite(posterTimeCandidate) || posterTimeCandidate < 0 || posterTimeCandidate >= probe.durationSeconds) {
    throw new Error(`Invalid --poster-time for ${filePath}; expected 0 <= time < ${probe.durationSeconds}`);
  }

  return {
    id,
    title,
    description: options.description,
    alt: options.alt,
    collection: options.collection,
    location: options.location,
    capturedWith: options['captured-with'],
    date: options.date,
    featured: Boolean(options.featured),
    published: Boolean(options.publish),
    width: probe.width,
    height: probe.height,
    durationSeconds: probe.durationSeconds,
    fps: probe.fps,
    posterTimeSeconds: Number(posterTimeCandidate.toFixed(3)),
    videoQuality: options.quality || 'basic',
    source: {
      name: path.basename(filePath),
      bytes: stat.size,
      sha256,
    },
    technical: {
      ...(probe.codec ? { codec: probe.codec } : {}),
      ...(probe.pixelFormat ? { pixelFormat: probe.pixelFormat } : {}),
      ...(probe.colorSpace ? { colorSpace: probe.colorSpace } : {}),
      ...(probe.colorTransfer ? { colorTransfer: probe.colorTransfer } : {}),
      ...(probe.colorPrimaries ? { colorPrimaries: probe.colorPrimaries } : {}),
    },
    filePath,
  };
}

async function uploadCommand(argv) {
  const { options, positional } = parseArgs(argv);
  if (!positional.length) usage(1);

  const quality = options.quality || 'basic';
  if (!['basic', 'plus', 'premium'].includes(quality)) {
    throw new Error('--quality must be basic, plus, or premium');
  }
  if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error('--date must use YYYY-MM-DD');
  }

  const files = collectFiles(positional, Boolean(options.recursive));
  if (!files.length) throw new Error('No supported video files found.');
  if (files.length > 1 && options.title) throw new Error('--title can only be used with a single video.');

  console.log(`Found ${files.length} video${files.length === 1 ? '' : 's'}.`);
  const entries = readManifest();
  const usedSlugs = new Set();
  const prepared = [];

  for (const filePath of files) {
    const meta = await buildMeta(filePath, options, entries, usedSlugs);
    if (meta.duplicate) {
      console.log(`SKIP ${path.basename(filePath)}: identical source is already ${meta.duplicate.id}`);
      continue;
    }
    prepared.push(meta);
    const gb = (meta.source.bytes / 1024 ** 3).toFixed(2);
    console.log(`READY ${meta.id}: ${meta.width}x${meta.height}, ${meta.durationSeconds}s, ${gb} GiB -> Mux ${resolutionTier(meta.height)}`);
  }

  if (options['dry-run']) {
    console.log('\nDry run complete; no files were uploaded.');
    return;
  }
  if (!prepared.length) {
    console.log('Nothing new to upload.');
    return;
  }

  requireMuxCredentials();
  requireBinary('curl');

  for (const meta of prepared) {
    console.log(`\nCreating Mux direct upload for ${meta.id}...`);
    const directUpload = await createDirectUpload(meta, quality);
    saveCheckpoint(directUpload.id, { meta });

    console.log(`Uploading ${meta.source.name} directly to Mux...`);
    uploadFileWithCurl(meta.filePath, directUpload.url);

    console.log('Upload complete. Waiting for Mux ingest...');
    try {
      const assetId = await waitForUpload(directUpload.id);
      const asset = await waitForAsset(assetId);
      finalizeManifestEntry(meta, directUpload.id, asset);
    } catch (error) {
      console.error(`\nMux is still processing or the poll failed. Checkpoint kept at ${path.relative(ROOT, checkpointPath(directUpload.id))}`);
      console.error(`Resume with: npm run motion:resume -- ${directUpload.id}`);
      throw error;
    }
  }
}

function setPublished(slug, published) {
  const entries = readManifest();
  const entry = entries.find((item) => item.id === slug);
  if (!entry) throw new Error(`Unknown visual motion slug: ${slug}`);
  if (published && !entry.mux?.playbackId) throw new Error(`${slug} has no Mux playback ID and cannot be published`);
  entry.published = published;
  writeManifest(entries);
  console.log(`${slug}: published=${published}`);
}

function validateManifest() {
  const entries = readManifest();
  const errors = [];
  const ids = new Set();
  const hashes = new Set();

  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  if (/MUX_TOKEN_(ID|SECRET)/.test(raw)) errors.push('manifest contains a Mux credential variable name');
  if (/video-storage[^"\s]*upload/i.test(raw)) errors.push('manifest appears to contain a signed upload URL');

  for (const [index, entry] of entries.entries()) {
    const prefix = entry.id || `entry[${index}]`;
    if (!entry.id) errors.push(`${prefix}: missing id`);
    else if (ids.has(entry.id)) errors.push(`${prefix}: duplicate id`);
    else ids.add(entry.id);

    if (!entry.title) errors.push(`${prefix}: missing title`);
    if (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds <= 0) errors.push(`${prefix}: invalid durationSeconds`);
    if (!Number.isInteger(entry.width) || entry.width <= 0) errors.push(`${prefix}: invalid width`);
    if (!Number.isInteger(entry.height) || entry.height <= 0) errors.push(`${prefix}: invalid height`);
    if (typeof entry.published !== 'boolean') errors.push(`${prefix}: published must be boolean`);

    const hash = entry.source?.sha256;
    if (!hash || !/^[a-f0-9]{64}$/.test(hash)) errors.push(`${prefix}: invalid source SHA-256`);
    else if (hashes.has(hash)) errors.push(`${prefix}: duplicate source SHA-256`);
    else hashes.add(hash);

    if (entry.published && !entry.mux?.playbackId) errors.push(`${prefix}: published entry is missing mux.playbackId`);
  }

  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Visual motion manifest OK: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`);
}

async function resumeCommand(uploadId) {
  if (!uploadId) throw new Error('Provide the Mux upload ID to resume.');
  const filePath = checkpointPath(uploadId);
  if (!fs.existsSync(filePath)) throw new Error(`No checkpoint found for upload ${uploadId}`);
  const checkpoint = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  requireMuxCredentials();
  const assetId = await waitForUpload(uploadId);
  const asset = await waitForAsset(assetId);
  finalizeManifestEntry(checkpoint.meta, uploadId, asset);
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') usage(0);

  if (command === 'upload') return await uploadCommand(argv);
  if (command === 'publish') {
    if (argv.length !== 1) usage(1);
    return setPublished(argv[0], true);
  }
  if (command === 'unpublish') {
    if (argv.length !== 1) usage(1);
    return setPublished(argv[0], false);
  }
  if (command === 'resume') {
    if (argv.length !== 1) usage(1);
    return await resumeCommand(argv[0]);
  }
  if (command === 'check') return validateManifest();

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
