import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  AssetRightsSchema,
  StoryManifestSchema,
  type StoryManifest,
  type EvidenceRecord,
} from './schema';
import { parseQualifiedStoryManifest } from './eligibility';

/**
 * Pure offline adapter. This module never fetches HTML or media.
 * The Python parser only discovers publisher-HTML candidates; rights-reviewed
 * bytes must be explicitly supplied before an image can become evidence.
 */

const paperIdPattern = /^\d{4}\.\d{4,5}v[1-9]\d*$/;
const sectionIdPattern = /^[A-Za-z0-9:_.-]{1,120}$/;
const sourceUrl = z.url().max(2048);
const candidateFigure = z.strictObject({
  id: z.string().regex(sectionIdPattern).nullable(),
  sourceUrl,
  sectionId: z.string().regex(sectionIdPattern).nullable(),
  imageUrl: sourceUrl,
  caption: z.string().trim().min(20).max(1200),
  alt: z.string().trim().min(1).max(360),
});
const candidateSection = z.strictObject({
  id: z.string().regex(sectionIdPattern),
  title: z.string().trim().min(1).max(200),
  sourceUrl,
});
export const ArxivHtmlCandidateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  adapter: z.literal('arxiv-html-candidates'),
  paperId: z.string().regex(paperIdPattern),
  htmlUrl: sourceUrl,
  rightsStatus: z.literal('unverified'),
  sections: z.array(candidateSection).max(40),
  figures: z.array(candidateFigure).max(12),
  diagnostics: z.strictObject({
    figureElementsSeen: z.number().int().nonnegative(),
    candidatesWithImageAndCaption: z.number().int().nonnegative().max(12),
    rejectedImageReferences: z.number().int().nonnegative(),
    sectionHeadings: z.number().int().nonnegative().max(40),
  }),
}).superRefine((parsed, ctx) => {
  const htmlUrl = 'https://arxiv.org/html/' + parsed.paperId;
  if (parsed.htmlUrl !== htmlUrl) {
    ctx.addIssue({ code: 'custom', path: ['htmlUrl'], message: 'Incorrect canonical paper HTML URL' });
  }
  const sectionIds = new Set<string>();
  for (const [index, section] of parsed.sections.entries()) {
    if (sectionIds.has(section.id)) {
      ctx.addIssue({ code: 'custom', path: ['sections', index], message: 'Duplicate source section' });
    }
    sectionIds.add(section.id);
    if (section.sourceUrl !== htmlUrl + '#' + encodeURIComponent(section.id)) {
      ctx.addIssue({ code: 'custom', path: ['sections', index, 'sourceUrl'], message: 'Noncanonical section anchor' });
    }
  }
  const figureUrls = new Set<string>();
  for (const [index, figure] of parsed.figures.entries()) {
    const anchor = figure.id ? '#' + encodeURIComponent(figure.id) : '';
    if (figure.sourceUrl !== htmlUrl + anchor) {
      ctx.addIssue({ code: 'custom', path: ['figures', index, 'sourceUrl'], message: 'Noncanonical figure anchor' });
    }
    if (figureUrls.has(figure.imageUrl)) {
      ctx.addIssue({ code: 'custom', path: ['figures', index, 'imageUrl'], message: 'Duplicate source image' });
    }
    figureUrls.add(figure.imageUrl);
    try {
      const image = new URL(figure.imageUrl);
      if (image.protocol !== 'https:' || image.hostname !== 'arxiv.org'
        || image.username || image.password || image.port || image.search || image.hash
        || !image.pathname.startsWith('/html/' + parsed.paperId + '/')
        || !/\.(?:png|jpe?g|webp)$/i.test(image.pathname)) {
        ctx.addIssue({ code: 'custom', path: ['figures', index, 'imageUrl'], message: 'Image must belong to the exact paper' });
      }
    } catch {
      ctx.addIssue({ code: 'custom', path: ['figures', index, 'imageUrl'], message: 'Invalid image URL' });
    }
    if (figure.sectionId && !sectionIds.has(figure.sectionId)) {
      ctx.addIssue({ code: 'custom', path: ['figures', index, 'sectionId'], message: 'Figure refers to a missing section' });
    }
  }
  if (parsed.diagnostics.candidatesWithImageAndCaption !== parsed.figures.length
    || parsed.diagnostics.sectionHeadings !== parsed.sections.length
    || parsed.diagnostics.figureElementsSeen < parsed.figures.length) {
    ctx.addIssue({ code: 'custom', path: ['diagnostics'], message: 'Source counts disagree with parsed records' });
  }
});
export type ArxivHtmlCandidates = z.infer<typeof ArxivHtmlCandidateSchema>;

export type ApprovedFigure = {
  sourceUrl: string;
  imageUrl: string;
  captionSha256: string;
  bytes: Uint8Array;
  rights: z.infer<typeof AssetRightsSchema>;
};

export type VerifiedFigureAsset = {
  key: string;
  sourceUrl: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  bytes: Uint8Array;
};

/** An extension is not enough to verify raster media bytes. */
function inspectImage(bytes: Uint8Array): VerifiedFigureAsset['mimeType'] {
  if (bytes.byteLength < 16 || bytes.byteLength > 4 * 1024 * 1024) {
    throw new Error('Image exceeds the bounded asset envelope');
  }
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10]
    .every((part, index) => bytes[index] === part)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  const ascii = (start: number, end: number) =>
    Array.from(bytes.slice(start, end), (byte) => String.fromCharCode(byte)).join('');
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  throw new Error('Asset lacks a supported raster file signature');
}
function digest(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function compileArxivEvidence(input: {
  candidates: unknown;
  itemId: string;
  observedAt: string;
  builtAt: string;
  approvals?: ApprovedFigure[];
}): { manifest: StoryManifest; assets: VerifiedFigureAsset[] } {
  const parsed = ArxivHtmlCandidateSchema.parse(input.candidates);
  const paperId = parsed.paperId;
  const revision = paperId.match(/v[1-9]\d*$/)?.[0];
  if (!revision) throw new Error('Expected versioned arXiv paper identity');

  const source = {
    id: 'arxiv:' + paperId,
    url: 'https://arxiv.org/abs/' + paperId,
    publisher: 'arXiv',
    kind: 'paper' as const,
    revision,
    observedAt: input.observedAt,
  };
  const locator = (url: string, section?: string) => ({
    sourceId: source.id, sourceUrl: url, revision,
    ...(section ? { section } : {}),
  });
  const evidence: EvidenceRecord[] = parsed.sections.map((section, index) => ({
    id: 'section-' + String(index + 1).padStart(3, '0'),
    type: 'quotation',
    status: 'publisher-reported',
    locator: locator(section.sourceUrl, section.id),
    text: section.title,
  }));
  const assets: VerifiedFigureAsset[] = [];
  const consumedApprovals = new Set<string>();

  const approved = new Map<string, ApprovedFigure>();
  for (const figure of input.approvals ?? []) {
    if (approved.has(figure.sourceUrl)) throw new Error('Duplicate figure approval');
    approved.set(figure.sourceUrl, figure);
  }
  for (const [index, figure] of parsed.figures.entries()) {
    const approval = approved.get(figure.sourceUrl);
    if (!approval) continue;
    consumedApprovals.add(figure.sourceUrl);
    if (approval.imageUrl !== figure.imageUrl) {
      throw new Error('Figure image changed since rights/asset review');
    }
    if (approval.captionSha256 !== digest(figure.caption)) {
      throw new Error('Figure caption changed since rights/asset review');
    }
    const rights = AssetRightsSchema.parse(approval.rights);
    if (rights.display !== 'permitted') {
      throw new Error('Asset approval must explicitly permit image display');
    }
    const mimeType = inspectImage(approval.bytes);
    const extension = new URL(figure.imageUrl).pathname.split('.').pop()?.toLowerCase();
    const validMime = (extension === 'png' && mimeType === 'image/png')
      || (['jpg', 'jpeg'].includes(extension ?? '') && mimeType === 'image/jpeg')
      || (extension === 'webp' && mimeType === 'image/webp');
    if (!validMime) throw new Error('Image MIME does not match the verified source extension');
    const key = 'sha256:' + digest(approval.bytes);
    evidence.push({
      id: 'figure-' + String(index + 1).padStart(3, '0'),
      type: 'figure',
      status: 'publisher-reported',
      assetKey: key,
      caption: figure.caption,
      alt: figure.alt.length >= 8 ? figure.alt : figure.caption.slice(0, 240),
      locator: locator(figure.sourceUrl, figure.sectionId ?? undefined),
      rights,
    });
    assets.push({ key, sourceUrl: figure.imageUrl, mimeType, bytes: approval.bytes });
  }

  for (const key of approved.keys()) {
    if (!consumedApprovals.has(key)) throw new Error('Asset approval references no candidate from this paper');
  }

  const candidate: StoryManifest = {
    schemaVersion: 1,
    itemId: input.itemId,
    source,
    extractorVersion: 'arxiv-html-structure-v1',
    compilerVersion: 'frontier-evidence-scenes-v1',
    builtAt: input.builtAt,
    state: assets.length ? 'partial' : 'basic',
    evidence,
    scenes: assets.length ? [{
      id: 'inspect-original-figures',
      type: 'original-figure',
      title: 'Inspect original research figures',
      question: 'What does the publisher show in the original figures?',
      evidenceIds: evidence.filter((record) => record.type === 'figure').map((record) => record.id),
      operations: assets.length > 1 ? ['inspect', 'switch'] : ['inspect'],
      accessibleSummary: 'Source figures with original captions, attribution and primary-document anchors.',
      annotation: 'publisher-original',
    }] : [],
  };
  return { manifest: parseQualifiedStoryManifest(StoryManifestSchema.parse(candidate)), assets };
}

export function sha256Caption(caption: string): string {
  return digest(caption);
}
