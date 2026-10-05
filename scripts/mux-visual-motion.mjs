#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'src/data/visualMotionManifest.json');
const CURATION_PATH = path.join(ROOT, 'src/data/visualMotionCuration.json');
const CURATION = JSON.parse(fs.readFileSync(CURATION_PATH, 'utf8'));
const CACHE_DIR = path.join(ROOT, '.cache/mux-video');
const PREPARED_DIR = path.join(CACHE_DIR, 'prepared');
const CHUNK_SIZE = 20 * 1024 * 1024;
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
  --keep-mezzanine              Keep temporary Mux-ready files after success
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
  npm run motion:publish -- <slug>        Show an uploaded asset on the site
  npm run motion:unpublish -- <slug>      Hide it without freeing a Mux slot
  npm run motion:retire -- <slug>         Preview removal from Mux
  npm run motion:retire -- <slug> --confirm-delete
  npm run motion:slots                     Show current Mux asset count

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
  const booleanFlags = new Set(['publish', 'featured', 'recursive', 'dry-run', 'keep-mezzanine', 'confirm-delete']);
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
      'stream=width,height,codec_name,r_frame_rate,color_space,color_transfer,color_primaries,pix_fmt:format=duration,bit_rate',
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

  const bitRate = Number(payload.format?.bit_rate);

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
    bitRateMbps: Number.isFinite(bitRate) && bitRate > 0 ? Number((bitRate / 1_000_000).toFixed(3)) : undefined,
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

function resolutionTier(width, height) {
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  if (longEdge >= 3840 || shortEdge >= 2160) return '2160p';
  if (longEdge >= 2560 || shortEdge >= 1440) return '1440p';
  return '1080p';
}

function isHdr(meta) {
  return ['smpte2084', 'arib-std-b67'].includes(String(meta.technical?.colorTransfer || '').toLowerCase());
}

function requireMuxCredentials() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error('Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET. Add them to .env.local.');
  }
  return { tokenId, tokenSecret };
}

async function muxRequest(endpoint, init = {}, maxAttempts = 5) {
  const { tokenId, tokenSecret } = requireMuxCredentials();
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`https://api.mux.com/video/v1${endpoint}`, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (response.ok) return payload.data;

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        const error = new Error(`Mux API ${response.status}: ${payload?.error?.messages?.join?.('; ') || payload?.error?.message || text || response.statusText}`);
        error.nonRetryable = !retryable;
        throw error;
      }

      const retryAfter = Number(response.headers.get('retry-after'));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(1000 * 2 ** (attempt - 1), 12_000);
      console.warn(`Mux API ${response.status}; retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt}/${maxAttempts})...`);
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (error?.nonRetryable) throw error;
      if (attempt === maxAttempts) break;
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 12_000);
      console.warn(`Mux request interrupted; retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt}/${maxAttempts})...`);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Mux request failed after retries');
}

async function createDirectUpload(meta, quality) {
  return await muxRequest('/uploads', {
    method: 'POST',
    body: JSON.stringify({
      timeout: 86400,
      new_asset_settings: {
        playback_policies: ['public'],
        video_quality: quality,
        max_resolution_tier: resolutionTier(meta.width, meta.height),
        passthrough: meta.id,
        meta: {
          title: meta.title,
          external_id: meta.id,
        },
      },
    }),
  });
}

function preparedPathFor(meta) {
  return path.join(PREPARED_DIR, meta.source.sha256.slice(0, 20) + '-mux.mp4');
}

function prepareMuxInput(meta) {
  const tier = resolutionTier(meta.width, meta.height);
  if (tier === '1080p') {
    meta.ingest = { standardizedLocally: false, uploadResolutionTier: tier };
    return meta.filePath;
  }

  if (isHdr(meta)) {
    throw new Error(meta.source.name + ' appears to be HDR (' + meta.technical.colorTransfer + '). Automatic HDR tone-mapping is intentionally disabled. Export an SDR master first so the site does not silently alter the image.');
  }

  requireBinary('ffmpeg');
  fs.mkdirSync(PREPARED_DIR, { recursive: true });
  const target = preparedPathFor(meta);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    console.log('Reusing cached Mux-ready mezzanine: ' + path.relative(ROOT, target));
    meta.ingest = { standardizedLocally: true, uploadResolutionTier: tier, codec: 'h264', maxBitrateMbps: 18, keyframeIntervalSeconds: 2 };
    return target;
  }

  const partial = target.replace(/\.mp4$/i, '.partial.mp4');
  const fps = Math.min(Math.max(meta.fps || 30, 5), 60);
  const gop = Math.max(10, Math.round(fps * 2));
  const filters = [];
  if (Math.max(meta.width, meta.height) > 4096) {
    filters.push("scale='min(4096,iw)':'min(4096,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2");
  }
  if ((meta.fps || 0) > 60) filters.push('fps=60');

  console.log('Preparing Mux-standard ' + tier + ' mezzanine for ' + meta.source.name + ' (H.264, <=18 Mbps, closed 2s GOP). Original remains untouched.');
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'warning', '-y',
    '-i', meta.filePath,
    '-map_metadata', '-1',
    '-map', '0:v:0',
    '-map', '0:a?',
    ...(filters.length ? ['-vf', filters.join(',')] : []),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-crf', '18',
    '-maxrate', '18M',
    '-bufsize', '36M',
    '-g', String(gop),
    '-keyint_min', String(gop),
    '-sc_threshold', '0',
    '-flags', '+cgop',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-f', 'mp4',
    partial,
  ], { stdio: 'inherit' });

  if (result.status !== 0) {
    if (fs.existsSync(partial)) fs.unlinkSync(partial);
    throw new Error('ffmpeg failed while preparing ' + meta.source.name);
  }
  fs.renameSync(partial, target);
  meta.ingest = { standardizedLocally: true, uploadResolutionTier: tier, codec: 'h264', maxBitrateMbps: 18, keyframeIntervalSeconds: 2 };
  return target;
}

function parseServerRange(rangeHeader) {
  if (!rangeHeader) return undefined;
  const match = rangeHeader.match(/(?:bytes=)?\\d+-(\\d+)/i);
  return match ? Number(match[1]) + 1 : undefined;
}

async function uploadFileInChunks(filePath, uploadUrl, uploadId, checkpoint) {
  const totalBytes = fs.statSync(filePath).size;
  let nextByte = Math.min(Number(checkpoint.nextByte || 0), totalBytes);
  const file = fs.openSync(filePath, 'r');
  let lastPrintedBucket = -1;
  try {
    while (nextByte < totalBytes) {
      const size = Math.min(CHUNK_SIZE, totalBytes - nextByte);
      const endByte = nextByte + size - 1;
      const buffer = Buffer.allocUnsafe(size);
      const bytesRead = fs.readSync(file, buffer, 0, size, nextByte);
      if (bytesRead !== size) throw new Error('Could not read expected upload chunk from ' + filePath);

      let accepted = false;
      let lastError;
      for (let attempt = 1; attempt <= 5 && !accepted; attempt += 1) {
        try {
          const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Length': String(size),
              'Content-Range': 'bytes ' + nextByte + '-' + endByte + '/' + totalBytes,
            },
            body: buffer,
          });
          if (response.ok || response.status === 308) {
            const serverNext = parseServerRange(response.headers.get('range'));
            nextByte = Math.max(endByte + 1, serverNext || 0);
            checkpoint.nextByte = nextByte;
            checkpoint.totalBytes = totalBytes;
            saveCheckpoint(uploadId, checkpoint);
            accepted = true;
          } else {
            const body = await response.text();
            throw new Error('chunk returned HTTP ' + response.status + (body ? ': ' + body.slice(0, 300) : ''));
          }
        } catch (error) {
          lastError = error;
          if (attempt < 5) await sleep(1000 * 2 ** (attempt - 1));
        }
      }
      if (!accepted) throw lastError || new Error('chunk upload failed');

      const percent = totalBytes ? (nextByte / totalBytes) * 100 : 100;
      const bucket = Math.floor(percent / 2);
      if (bucket !== lastPrintedBucket || nextByte >= totalBytes) {
        process.stdout.write('\\rUploading ' + path.basename(filePath) + ': ' + percent.toFixed(1) + '%');
        lastPrintedBucket = bucket;
      }
    }
  } finally {
    fs.closeSync(file);
  }
  process.stdout.write('\\n');
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

function finalizeManifestEntry(meta, uploadId, asset, uploadPath) {
  const playbackId = asset.playback_ids?.find((item) => item.policy === 'public')?.id || asset.playback_ids?.[0]?.id;
  if (!playbackId) throw new Error(`Mux asset ${asset.id} is ready but has no playback ID`);

  const entries = readManifest();
  const existing = entries.find((entry) => entry.source?.sha256 === meta.source.sha256);
  if (existing?.mux?.assetId) {
    console.log(`Skipping duplicate source already active in Mux: ${meta.source.name}`);
    removeCheckpoint(uploadId);
    return;
  }

  const nextEntry = {
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
      resolutionTier: asset.resolution_tier || resolutionTier(meta.width, meta.height),
      videoQuality: asset.video_quality || meta.videoQuality,
    },
    source: meta.source,
    technical: meta.technical,
    ingest: { ...(meta.ingest || {}), uploadedBytes: uploadPath && fs.existsSync(uploadPath) ? fs.statSync(uploadPath).size : undefined },
    retired: false,
  };

  if (existing) {
    Object.assign(existing, nextEntry);
  } else {
    entries.push(nextEntry);
  }

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

  const existing = entries.find((entry) => entry.source?.sha256 === sha256);
  if (existing?.mux?.assetId) {
    return { duplicate: existing, filePath, probe, sha256 };
  }

  const fallbackTitle = humanizeFilename(filePath);
  const requestedTitle = options.title || fallbackTitle;
  const baseSlug = slugify(requestedTitle);
  const id = existing?.id || uniqueSlug(baseSlug, [...entries, ...[...usedSlugs].map((slug) => ({ id: slug }))]);
  usedSlugs.add(id);
  const curation = CURATION[id] || {};
  const title = options.title || curation.title || existing?.title || fallbackTitle;

  const posterTimeCandidate = options['poster-time'] === undefined
    ? Math.min(Math.max(probe.durationSeconds * 0.12, 0.25), Math.max(probe.durationSeconds - 0.1, 0.25))
    : Number(options['poster-time']);

  if (!Number.isFinite(posterTimeCandidate) || posterTimeCandidate < 0 || posterTimeCandidate >= probe.durationSeconds) {
    throw new Error(`Invalid --poster-time for ${filePath}; expected 0 <= time < ${probe.durationSeconds}`);
  }

  return {
    id,
    title,
    description: options.description || curation.description || existing?.description,
    alt: options.alt || curation.alt || existing?.alt,
    collection: options.collection || existing?.collection,
    location: options.location || existing?.location,
    capturedWith: options['captured-with'],
    date: options.date,
    featured: Boolean(options.featured),
    published: Boolean(options.publish),
    tags: Array.isArray(curation.tags) ? curation.tags : [],
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
      ...(probe.bitRateMbps ? { bitRateMbps: probe.bitRateMbps } : {}),
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
    console.log(`READY ${meta.id}: ${meta.width}x${meta.height}, ${meta.durationSeconds}s, ${gb} GiB -> Mux ${resolutionTier(meta.width, meta.height)}${resolutionTier(meta.width, meta.height) === '1080p' ? '' : ' via local standards-safe mezzanine'}`);
  }

  if (options['dry-run']) {
    console.log('\nDry run complete; no files were encoded or uploaded.');
    return;
  }
  if (!prepared.length) {
    console.log('Nothing new to upload.');
    return;
  }

  requireMuxCredentials();

  for (const meta of prepared) {
    const uploadPath = prepareMuxInput(meta);
    console.log(`\nCreating Mux direct upload for ${meta.id}...`);
    const directUpload = await createDirectUpload(meta, quality);
    const checkpoint = { meta, uploadPath, uploadUrl: directUpload.url, nextByte: 0, keepMezzanine: Boolean(options['keep-mezzanine']) };
    saveCheckpoint(directUpload.id, checkpoint);

    console.log(`Uploading ${path.basename(uploadPath)} to Mux in 20 MiB resumable chunks...`);
    await uploadFileInChunks(uploadPath, directUpload.url, directUpload.id, checkpoint);

    console.log('Upload complete. Waiting for Mux ingest...');
    try {
      const assetId = await waitForUpload(directUpload.id);
      const asset = await waitForAsset(assetId);
      finalizeManifestEntry(meta, directUpload.id, asset, uploadPath);
      if (!checkpoint.keepMezzanine && uploadPath !== meta.filePath && uploadPath.startsWith(PREPARED_DIR) && fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
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

async function showMuxSlots() {
  requireMuxCredentials();
  const assets = await muxRequest('/assets?limit=100');
  const count = Array.isArray(assets) ? assets.length : 0;
  console.log(`Mux currently stores ${count} asset${count === 1 ? '' : 's'}.`);
  if (count >= 10) {
    console.log('Your current Free plan shelf is full at 10 assets. Retire one asset before uploading another.');
  }
}

async function retireCommand(argv) {
  const { options, positional } = parseArgs(argv);
  if (positional.length !== 1) usage(1);

  const slug = positional[0];
  const entries = readManifest();
  const entry = entries.find((item) => item.id === slug);
  if (!entry) throw new Error(`Unknown visual motion slug: ${slug}`);
  if (!entry.mux?.assetId) {
    console.log(`${slug} is already retired from Mux; no slot is in use.`);
    return;
  }

  const assetId = entry.mux.assetId;
  if (!options['confirm-delete']) {
    console.log(`Retire preview: ${slug}`);
    console.log(`Mux asset: ${assetId}`);
    console.log('This will hide the video, delete its Mux asset, and free one storage slot.');
    console.log('The local source remains your archive and can be re-uploaded later with the same slug.');
    console.log(`To proceed: npm run motion:retire -- ${slug} --confirm-delete`);
    return;
  }

  requireMuxCredentials();
  await muxRequest(`/assets/${assetId}`, { method: 'DELETE' });

  entry.published = false;
  entry.retired = true;
  entry.muxHistory = [
    ...(Array.isArray(entry.muxHistory) ? entry.muxHistory : []),
    { ...entry.mux, retiredAt: new Date().toISOString() },
  ];
  delete entry.mux;
  writeManifest(entries);

  console.log(`Retired ${slug} from Mux and freed one asset slot.`);
  console.log('Its manifest record and source SHA remain intact for future restoration.');
  console.log('Re-upload the original source later with motion:upload to restore this same gallery item.');
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
  if (!fs.existsSync(filePath)) throw new Error('No checkpoint found for upload ' + uploadId);
  const checkpoint = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  requireMuxCredentials();

  let activeUploadId = uploadId;
  let upload = await muxRequest('/uploads/' + activeUploadId);
  if (!upload.asset_id && ['errored', 'timed_out', 'cancelled'].includes(upload.status)) {
    console.log('Previous upload is ' + upload.status + '; creating a fresh resumable URL.');
    const replacement = await createDirectUpload(checkpoint.meta, checkpoint.meta.videoQuality || 'basic');
    removeCheckpoint(activeUploadId);
    activeUploadId = replacement.id;
    checkpoint.uploadUrl = replacement.url;
    checkpoint.nextByte = 0;
    saveCheckpoint(activeUploadId, checkpoint);
    upload = replacement;
  }

  if (!upload.asset_id) {
    if (!checkpoint.uploadPath || !fs.existsSync(checkpoint.uploadPath)) throw new Error('Checkpoint upload file is missing. Re-run motion:upload for the original source.');
    if (!checkpoint.uploadUrl) throw new Error('Checkpoint is missing the resumable upload URL.');
    console.log('Resuming upload ' + activeUploadId + ' from byte ' + (checkpoint.nextByte || 0) + '...');
    await uploadFileInChunks(checkpoint.uploadPath, checkpoint.uploadUrl, activeUploadId, checkpoint);
  }

  const assetId = upload.asset_id || await waitForUpload(activeUploadId);
  const asset = await waitForAsset(assetId);
  finalizeManifestEntry(checkpoint.meta, activeUploadId, asset, checkpoint.uploadPath);
  if (!checkpoint.keepMezzanine && checkpoint.uploadPath !== checkpoint.meta.filePath && checkpoint.uploadPath.startsWith(PREPARED_DIR) && fs.existsSync(checkpoint.uploadPath)) fs.unlinkSync(checkpoint.uploadPath);
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
  if (command === 'retire') return await retireCommand(argv);
  if (command === 'slots') return await showMuxSlots();
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
