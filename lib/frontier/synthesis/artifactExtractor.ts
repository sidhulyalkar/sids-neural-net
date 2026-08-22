import type { FrontierArtifact, FrontierItem } from '../types';

const FORMULA_PATTERNS = [
  /(?:\$|\\\()([^$\n]{3,90}?[=≈≃≤≥][^$\n]{2,90}?)(?:\$|\\\))/g,
  /\b([A-Za-z][A-Za-z0-9_]*(?:\[[^\]]+\])?\s*(?:=|≈|≃|≤|≥)\s*[^.;\n]{2,78})/g,
];

function compact(value: string, max = 90): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function pushUnique(output: FrontierArtifact[], artifact: FrontierArtifact): void {
  const key = `${artifact.kind}:${artifact.label.toLowerCase()}:${artifact.value?.toLowerCase() ?? ''}`;
  if (!output.some((entry) => `${entry.kind}:${entry.label.toLowerCase()}:${entry.value?.toLowerCase() ?? ''}` === key)) {
    output.push(artifact);
  }
}

function formulaArtifacts(text: string): FrontierArtifact[] {
  const output: FrontierArtifact[] = [];
  for (const pattern of FORMULA_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = compact(match[1] ?? '');
      if (value.length < 5 || value.includes('http')) continue;
      pushUnique(output, { kind: 'formula', label: 'formula', value });
      if (output.length >= 2) return output;
    }
  }
  return output;
}

function benchmarkClaims(text: string): FrontierArtifact[] {
  const output: FrontierArtifact[] = [];
  const pattern = /\b([A-Za-z][A-Za-z0-9+_.\-/ ]{1,36})\s+(?:reaches?|achieves?|scores?|improves?\s+to|at)\s+([0-9]+(?:\.[0-9]+)?\s*(?:%|x|ms|s|fps|GB|MB|AUC|F1))\b/gi;
  for (const match of text.matchAll(pattern)) {
    pushUnique(output, {
      kind: 'benchmark',
      label: compact(match[1] ?? 'benchmark', 40),
      value: compact(match[2] ?? '', 24),
    });
    if (output.length >= 2) break;
  }
  return output;
}

function repositoryArtifact(item: FrontierItem): FrontierArtifact | undefined {
  try {
    const url = new URL(item.url);
    if (url.hostname.toLowerCase().replace(/^www\./, '') !== 'github.com') return undefined;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return undefined;
    const repo = `${segments[0]}/${segments[1]}`;
    if (segments.includes('releases') || segments.includes('tag')) {
      return { kind: 'release', label: 'release', value: repo, url: item.url };
    }
    return { kind: 'repository', label: 'repo', value: repo, url: item.url };
  } catch {
    return undefined;
  }
}

function tracklistArtifact(item: FrontierItem): FrontierArtifact | undefined {
  if (item.lane !== 'music') return undefined;
  const match = item.summary.match(/\b(?:tracklist|setlist)\s*[:\-]\s*([^\n]{4,120})/i);
  if (!match?.[1]) return undefined;
  return { kind: 'tracklist', label: 'tracklist', value: compact(match[1], 96) };
}

export function extractFrontierArtifacts(item: FrontierItem, limit = 4): FrontierArtifact[] {
  const output: FrontierArtifact[] = [];
  for (const metric of item.metrics?.slice(0, 3) ?? []) {
    pushUnique(output, {
      kind: 'benchmark',
      label: compact(metric.label, 42),
      value: compact(metric.value, 32),
    });
  }
  const repo = repositoryArtifact(item);
  if (repo) pushUnique(output, repo);
  for (const artifact of formulaArtifacts(`${item.title}\n${item.summary}`)) pushUnique(output, artifact);
  for (const artifact of benchmarkClaims(item.summary)) pushUnique(output, artifact);
  const tracklist = tracklistArtifact(item);
  if (tracklist) pushUnique(output, tracklist);
  return output.slice(0, Math.max(0, Math.min(6, limit)));
}

export function frontierFocalTakeaways(item: FrontierItem, limit = 3): string[] {
  const sentences = item.summary
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24)
    .sort((left, right) => {
      const score = (value: string) => {
        const numbers = (value.match(/\d/g) ?? []).length;
        const terms = (value.match(/\b(?:benchmark|release|open.source|method|result|improv|dataset|model|finding|new|first|record)\w*/gi) ?? []).length;
        return numbers * 0.2 + terms * 0.9 + Math.min(1, value.length / 160);
      };
      return score(right) - score(left);
    });
  return Array.from(new Set(sentences)).slice(0, Math.max(1, Math.min(5, limit)));
}
