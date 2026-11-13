import type { FrontierItem, FrontierSourceKind } from './types';
import { journalSourceActivity } from './journalPresentation';

/** Source-native metadata. This is a visual presentation contract, not a
 * second interpretation or ranking system. Never infer scientific findings. */
export type JournalSourceKind =
  | 'paper' | 'repository' | 'discussion' | 'watch' | 'match'
  | 'game' | 'music' | 'field' | 'report';

export type JournalSourceFact = { label: string; value: string };

export type JournalSourceLens = {
  kind: JournalSourceKind;
  kicker: string;
  identity: string;
  provenance: string;
  facts: JournalSourceFact[];
};

const PAPER_SOURCES: ReadonlySet<FrontierSourceKind> = new Set([
  'arxiv', 'biorxiv', 'medrxiv', 'openreview', 'openalex', 'paperswithcode', 'huggingface',
]);
const DISCUSSION_SOURCES: ReadonlySet<FrontierSourceKind> = new Set([
  'hackernews', 'lobsters', 'reddit',
]);

function parsedUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function identityFromUrl(item: FrontierItem): string | null {
  const url = parsedUrl(item.url);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const paths = url.pathname.split('/').filter(Boolean);
  if (item.sourceKind === 'github' && host === 'github.com' && paths.length >= 2
    && paths.slice(0, 2).every((segment) => /^[a-z\d_.-]+$/i.test(segment))) {
    return paths.slice(0, 2).join(' / ');
  }
  if (item.sourceKind === 'arxiv' && host === 'arxiv.org') {
    const id = paths.length >= 2 && ['abs', 'pdf'].includes(paths[0]) ? paths[1].replace(/\.pdf$/, '') : '';
    return /^\d{4}\.\d{4,5}(v\d+)?$/.test(id) ? 'arXiv · ' + id : null;
  }
  if (item.sourceKind === 'huggingface' && host === 'huggingface.co') {
    const id = paths[0] === 'papers' ? paths[1] : '';
    return id && /^\d{4}\.\d{4,5}(v\d+)?$/.test(id) ? 'HF Papers · ' + id : null;
  }
  if (item.sourceKind === 'openalex' && (host === 'openalex.org' || host === 'api.openalex.org')) {
    const id = paths.at(-1) || '';
    return /^W\d{5,}$/i.test(id) ? 'OpenAlex · ' + id : null;
  }
  return null;
}

function durationLabel(seconds?: number): string | null {
  if (!Number.isFinite(seconds) || seconds === undefined || seconds <= 0 || seconds > 86_400) return null;
  const rounded = Math.round(seconds);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = Math.floor(rounded % 60);
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
    : m + ':' + String(s).padStart(2, '0');
}

export function journalSourceKind(item: FrontierItem): JournalSourceKind {
  if (item.sportsState) return 'match';
  if (item.sourceKind === 'github') return 'repository';
  if (PAPER_SOURCES.has(item.sourceKind)) return 'paper';
  if (DISCUSSION_SOURCES.has(item.sourceKind)) return 'discussion';
  if (item.media?.type === 'video' || item.media?.type === 'youtube'
    || item.sourceKind === 'youtube' || item.sourceKind === 'vimeo') return 'watch';
  if (item.sourceKind === 'steam') return 'game';
  if (item.lane === 'music') return 'music';
  if (item.sourceKind === 'nasa' || item.lane === 'life') return 'field';
  return 'report';
}

const SOURCE_KICKERS: Record<JournalSourceKind, string> = {
  paper: 'RESEARCH RECORD',
  repository: 'OPEN-SOURCE SYSTEM',
  discussion: 'COMMUNITY DISCUSSION',
  watch: 'WATCHABLE SOURCE',
  match: 'EVENT SNAPSHOT',
  game: 'GAME RELEASE & COMMUNITY',
  music: 'MUSIC DISCOVERY',
  field: 'FIELD OBSERVATION',
  report: 'PUBLISHER REPORT',
};

/** Display only verifiable, bounded metadata. Source engagement is context,
 * never a proxy for correctness, study performance, or impact. */
export function journalSourceLens(item: FrontierItem, availableFigureCount: number): JournalSourceLens {
  const kind = journalSourceKind(item);
  const facts: JournalSourceFact[] = [];
  const activity = journalSourceActivity(item).slice(0, 3);
  if (kind === 'repository' || kind === 'discussion' || kind === 'paper') {
    for (const metric of activity) facts.push({ label: metric.label, value: metric.value });
  }
  if (kind === 'watch') {
    const duration = durationLabel(item.media?.duration);
    if (duration) facts.push({ label: 'Duration', value: duration });
  }
  if (kind === 'match' && item.sportsState) {
    const count = item.sportsState.kind === 'scoreboard'
      ? item.sportsState.games.length : item.sportsState.standings.length;
    facts.push({ label: item.sportsState.kind === 'scoreboard' ? 'Matches reported' : 'Teams listed', value: String(count) });
  }
  if (kind === 'paper' && item.authors?.length) {
    facts.push({ label: 'Authors listed', value: String(item.authors.length) });
  }
  if (availableFigureCount > 0) {
    facts.push({ label: 'Source figures', value: String(availableFigureCount) });
  }
  return {
    kind,
    kicker: SOURCE_KICKERS[kind],
    identity: kind === 'match' && item.sportsState ? item.sportsState.leagueLabel
      : (kind === 'paper' || kind === 'repository' ? identityFromUrl(item) : null) ?? item.sourceLabel,
    provenance: item.sourceLabel,
    facts: facts.slice(0, 5),
  };
}
