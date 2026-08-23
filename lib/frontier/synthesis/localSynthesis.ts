import type { FrontierItem } from '../types';
import type { FrontierSynthesisEvidence } from './synthesisWorker';

export type FrontierLocalSynthesis = {
  bullets: [string, string, string];
};

const MAX_SOURCES = 6;
const MAX_EXCERPT_CHARS = 1_200;
const MAX_TOTAL_CHARS = 8_000;
const MAX_BULLET_CHARS = 240;

function compactEvidence(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_EXCERPT_CHARS);
}

export function frontierLocalSynthesisSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const gpuNavigator = navigator as Navigator & { gpu?: unknown };
  return Boolean(gpuNavigator.gpu && typeof Worker !== 'undefined' && typeof Blob !== 'undefined');
}

export function frontierSynthesisEvidence(item: FrontierItem): FrontierSynthesisEvidence[] {
  const members = item.convergence?.members ?? [];
  const evidence: FrontierSynthesisEvidence[] = [];
  let usedChars = 0;

  for (const member of members.slice(0, MAX_SOURCES)) {
    const excerpt = compactEvidence(member.excerpt ?? '');
    if (!excerpt) continue;
    const fixedChars = member.title.length + member.sourceLabel.length + 16;
    const remaining = MAX_TOTAL_CHARS - usedChars - fixedChars;
    if (remaining < 180) break;
    const boundedExcerpt = excerpt.slice(0, Math.min(MAX_EXCERPT_CHARS, remaining));
    evidence.push({
      sourceId: member.id,
      sourceLabel: member.sourceLabel.slice(0, 120),
      title: member.title.slice(0, 260),
      excerpt: boundedExcerpt,
    });
    usedChars += fixedChars + boundedExcerpt.length;
  }
  return evidence;
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseFrontierLocalSynthesis(raw: string, sourceCount = MAX_SOURCES): FrontierLocalSynthesis | undefined {
  if (!raw.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const bullets = (parsed as { bullets?: unknown }).bullets;
  if (!Array.isArray(bullets) || bullets.length !== 3) return undefined;

  const cleaned = bullets.map((value) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
  if (cleaned.some((value) => !value || value.length > MAX_BULLET_CHARS)) return undefined;
  const citation = /\[S(\d+)\]/g;
  for (const bullet of cleaned) {
    const matches = Array.from(bullet.matchAll(citation));
    if (!matches.length) return undefined;
    if (matches.some((match) => Number(match[1]) < 1 || Number(match[1]) > sourceCount)) return undefined;
  }
  return { bullets: cleaned as [string, string, string] };
}

export function frontierSynthesisEvidenceChars(evidence: FrontierSynthesisEvidence[]): number {
  return evidence.reduce(
    (sum, entry) => sum + entry.sourceLabel.length + entry.title.length + entry.excerpt.length,
    0,
  );
}
