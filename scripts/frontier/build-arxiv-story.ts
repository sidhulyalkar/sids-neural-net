/**
 * Offline source-verified story builder.
 * No network requests, no source HTML served to browsers, and no image is
 * published solely because the HTML referenced it.
 *
 * Example:
 *   npx tsx scripts/frontier/build-arxiv-story.ts \
 *     --paper-id 2611.17323v1 \
 *     --item-id ingest-arxiv-l2kgb2 \
 *     --html /tmp/agent-ssl.html \
 *     --observed-at 2026-11-14T19:13:13.373Z \
 *     --built-at 2026-11-14T19:13:13.373Z \
 *     --out /tmp/frontier-agentssl-story
 *
 * An optional --approvals JSON file and --asset-root can be used after
 * rights/document review to promote content-hashed local image bytes.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  lstat, mkdir, readFile, realpath, rename, rm, writeFile, access,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  ArxivHtmlCandidateSchema,
  compileArxivEvidence,
  type ApprovedFigure,
} from '../../lib/frontier/evidence/arxivAdapter';

const MAX_HTML_BYTES = 1_400_000;
const MAX_APPROVAL_BYTES = 80_000;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const PYTHON_SCRIPT = resolve(process.cwd(), 'scripts/frontier/extract_arxiv_html.py');

function argumentsMap(args: string[]): Map<string, string> {
  const allowed = new Set([
    '--paper-id', '--item-id', '--html', '--observed-at', '--built-at',
    '--out', '--approvals', '--asset-root',
  ]);
  if (args.length % 2 !== 0) throw new Error('Expected flag/value pairs');
  const parsed = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!allowed.has(flag) || parsed.has(flag) || !args[index + 1]) {
      throw new Error('Unknown, duplicate or empty argument: ' + flag);
    }
    parsed.set(flag, args[index + 1]);
  }
  for (const required of [
    '--paper-id', '--item-id', '--html', '--observed-at', '--built-at', '--out',
  ]) {
    if (!parsed.has(required)) throw new Error('Missing required flag ' + required);
  }
  if (parsed.has('--approvals') !== parsed.has('--asset-root')) {
    throw new Error('Reviewed approvals require an explicit asset-root directory');
  }
  return parsed;
}

function requireArgument(values: Map<string, string>, name: string): string {
  const value = values.get(name);
  if (!value) throw new Error('Missing ' + name);
  return value;
}

async function readBounded(path: string, maxBytes: number): Promise<Buffer> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
    throw new Error('Input must be a bounded, regular, non-symlink file');
  }
  return readFile(path);
}

async function reviewedApprovals(
  path: string | undefined,
  root: string | undefined,
): Promise<ApprovedFigure[]> {
  if (!path || !root) return [];
  const parsed = JSON.parse((await readBounded(resolve(path), MAX_APPROVAL_BYTES)).toString('utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length > 12) {
    throw new Error('Reviewed assets must be a bounded array');
  }
  const realRoot = await realpath(resolve(root));
  const approvals: ApprovedFigure[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid review entry');
    const obj = raw as Record<string, unknown>;
    if (typeof obj.file !== 'string' || isAbsolute(obj.file) || obj.file.includes('\0')) {
      throw new Error('Asset file must be a relative reviewed path');
    }
    const candidate = resolve(realRoot, obj.file);
    const rel = relative(realRoot, candidate);
    if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
      throw new Error('Approved asset path escapes the review directory');
    }
    const realCandidate = await realpath(candidate);
    const safeRel = relative(realRoot, realCandidate);
    if (!safeRel || safeRel === '..' || safeRel.startsWith('..' + sep) || isAbsolute(safeRel)) {
      throw new Error('Approved asset resolves outside review directory');
    }
    const bytes = await readBounded(realCandidate, MAX_ASSET_BYTES);
    if (typeof obj.sourceUrl !== 'string' || typeof obj.imageUrl !== 'string'
      || typeof obj.captionSha256 !== 'string' || typeof obj.rights !== 'object') {
      throw new Error('Invalid review entry metadata');
    }
    approvals.push({
      sourceUrl: obj.sourceUrl,
      imageUrl: obj.imageUrl,
      captionSha256: obj.captionSha256,
      rights: obj.rights as ApprovedFigure['rights'],
      bytes,
    });
  }
  return approvals;
}

async function build() {
  const options = argumentsMap(process.argv.slice(2));
  const paperId = requireArgument(options, '--paper-id');
  const html = resolve(requireArgument(options, '--html'));
  const output = resolve(requireArgument(options, '--out'));
  const publicDirectory = resolve(process.cwd(), 'public');
  const underPublic = relative(publicDirectory, output);
  if (!underPublic || (underPublic !== '..' && !underPublic.startsWith('..' + sep) && !isAbsolute(underPublic))) {
    throw new Error('Builder output is a private artifact, not a public/ asset directory');
  }
  const sourceHtml = await readBounded(html, MAX_HTML_BYTES);
  const processResult = spawnSync('python3', [
    PYTHON_SCRIPT, '--paper-id', paperId, '--input', html,
  ], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 2 * 1024 * 1024,
  });
  if (processResult.error || processResult.status !== 0) {
    throw new Error('Offline arXiv extraction failed: ' +
      String(processResult.error?.message ?? processResult.stderr).slice(0, 500));
  }
  const candidates = ArxivHtmlCandidateSchema.parse(JSON.parse(processResult.stdout) as unknown);
  const approvals = await reviewedApprovals(options.get('--approvals'), options.get('--asset-root'));
  const { manifest, assets } = compileArxivEvidence({
    candidates,
    itemId: requireArgument(options, '--item-id'),
    observedAt: requireArgument(options, '--observed-at'),
    builtAt: requireArgument(options, '--built-at'),
    approvals,
  });

  try {
    await access(output);
    throw new Error('Refusing to overwrite an existing story artifact directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(output), { recursive: true });
  const staging = output + '.pending-' + process.pid;
  await mkdir(staging, { recursive: false });
  try {
    await mkdir(resolve(staging, 'assets'));
    const written = new Set<string>();
    const assetIndex: Array<{
      key: string; sourceUrl: string; mimeType: string; path: string; size: number;
    }> = [];
    for (const asset of assets) {
      const hex = asset.key.replace(/^sha256:/, '');
      const extension = asset.mimeType === 'image/png' ? '.png'
        : asset.mimeType === 'image/jpeg' ? '.jpg' : '.webp';
      const fileName = hex + extension;
      if (!written.has(fileName)) {
        await writeFile(resolve(staging, 'assets', fileName), asset.bytes, { flag: 'wx' });
        written.add(fileName);
      }
      assetIndex.push({
        key: asset.key, sourceUrl: asset.sourceUrl,
        mimeType: asset.mimeType, path: 'assets/' + fileName, size: asset.bytes.byteLength,
      });
    }
    await writeFile(resolve(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(resolve(staging, 'candidates.json'), JSON.stringify(candidates, null, 2) + '\n');
    await writeFile(resolve(staging, 'assets.json'), JSON.stringify(assetIndex, null, 2) + '\n');
    await writeFile(resolve(staging, 'provenance.json'), JSON.stringify({
      sourceId: manifest.source.id,
      sourceRevision: manifest.source.revision,
      htmlSha256: createHash('sha256').update(sourceHtml).digest('hex'),
      extractedSections: candidates.sections.length,
      extractedFigureCandidates: candidates.figures.length,
      approvedDisplayAssets: assetIndex.length,
      rightsStatus: 'reviewed-individually',
      extractorVersion: manifest.extractorVersion,
    }, null, 2) + '\n');
    await rename(staging, output);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  console.log(JSON.stringify({
    artifact: basename(output),
    sourceId: manifest.source.id,
    sections: candidates.sections.length,
    candidateFigures: candidates.figures.length,
    approvedFigures: assets.length,
    qualifiedScenes: manifest.scenes.map((scene) => scene.type),
  }));
}
build().catch((error) => {
  console.error('FRONTIER offline arXiv story build refused:', error);
  process.exitCode = 1;
});
