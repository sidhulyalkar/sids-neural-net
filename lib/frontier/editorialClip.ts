import type { FrontierItem, FrontierLaneId } from './types';

export type EditorialClipVariant =
  | 'research'
  | 'builder'
  | 'sport'
  | 'games'
  | 'music'
  | 'culture'
  | 'dispatch';

export type EditorialClipKind = 'quote' | 'excerpt' | 'headline';

export type EditorialClip = {
  variant: EditorialClipVariant;
  label: string;
  highlight: string;
  kind: EditorialClipKind;
  byline?: string;
};

const RESEARCH_LANES = new Set<FrontierLaneId>([
  'ml_data',
  'ai_frontier',
  'neuro_frontier',
  'methods',
  'broad_science',
]);
const BUILDER_LANES = new Set<FrontierLaneId>(['builder_signal', 'competitions', 'creative_tech']);
const SPORT_LANES = new Set<FrontierLaneId>(['premier_league', 'world_soccer', 'team_pulse', 'sports']);

const BOILERPLATE = [
  /^\d[\d,.]*\s+(?:points?|upvotes?)\b/i,
  /^fresh (?:web )?discovery\b/i,
  /^fresh item from\b/i,
  /^fresh update from\b/i,
  /^recent scholarly work indexed by\b/i,
  /^community momentum is a discovery signal\b/i,
  /^direct community pulse\b/i,
  /^structured matchday context\b/i,
];

function normalize(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function smartExcerpt(value: string, max = 186): string {
  const text = normalize(value);
  if (text.length <= max) return text;
  const slice = text.slice(0, max + 1);
  const sentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '));
  const word = slice.lastIndexOf(' ');
  const boundary = sentence >= Math.floor(max * 0.55) ? sentence + 1 : word >= Math.floor(max * 0.6) ? word : max;
  return `${slice.slice(0, boundary).trim()}…`;
}

function quotedPhrase(text: string): string | undefined {
  const normalized = normalize(text);
  const curly = normalized.match(/“([^”]{24,220})”/);
  if (curly?.[1]) return smartExcerpt(curly[1], 176);
  const straight = normalized.match(/"([^"\n]{24,220})"/);
  return straight?.[1] ? smartExcerpt(straight[1], 176) : undefined;
}

function isBoilerplate(summary: string): boolean {
  return !summary || BOILERPLATE.some((pattern) => pattern.test(summary));
}

function sentenceCandidates(summary: string): string[] {
  return normalize(summary)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30);
}

function usefulSentence(summary: string): string | undefined {
  const candidates = sentenceCandidates(summary);
  if (!candidates.length) return undefined;
  const scored = candidates.map((sentence, index) => {
    const numberSignal = /\b\d+(?:\.\d+)?%?\b/.test(sentence) ? 2 : 0;
    const contrastSignal = /\b(?:but|however|while|instead|versus|vs\.?|yet|because|therefore|suggests?|shows?|found|wins?|loses?|beats?|raises?|drops?)\b/i.test(sentence) ? 1.4 : 0;
    const lengthSignal = sentence.length >= 55 && sentence.length <= 175 ? 1.2 : 0;
    const positionPenalty = index * 0.08;
    return { sentence, score: numberSignal + contrastSignal + lengthSignal - positionPenalty };
  });
  return scored.sort((a, b) => b.score - a.score)[0]?.sentence;
}

function titleClause(title: string): string {
  const normalized = normalize(title);
  const clauses = normalized
    .split(/\s(?:-|–|—)\s|:\s/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 24);
  return smartExcerpt(clauses.at(-1) ?? normalized, 170);
}

export function editorialClipVariant(item: FrontierItem): EditorialClipVariant {
  if (item.sourceKind === 'openalex' || RESEARCH_LANES.has(item.lane)) return 'research';
  if (item.sourceKind === 'github' || BUILDER_LANES.has(item.lane)) return 'builder';
  if (SPORT_LANES.has(item.lane)) return 'sport';
  if (item.lane === 'gaming' || item.sourceKind === 'steam') return 'games';
  if (item.lane === 'music') return 'music';
  if (item.lane === 'internet_culture' || item.lane === 'life' || item.sourceKind === 'reddit' || item.sourceKind === 'social') return 'culture';
  return 'dispatch';
}

function labelForVariant(variant: EditorialClipVariant, kind: EditorialClipKind): string {
  if (kind === 'quote') return 'Quoted line';
  switch (variant) {
    case 'research': return 'Evidence cut';
    case 'builder': return 'Build note';
    case 'sport': return 'Field note';
    case 'games': return 'Play note';
    case 'music': return 'Listen note';
    case 'culture': return 'Thread cut';
    default: return 'Dispatch';
  }
}

export function deriveEditorialClip(item: FrontierItem): EditorialClip {
  const title = normalize(item.title);
  const summary = normalize(item.summary);
  const variant = editorialClipVariant(item);
  const quote = quotedPhrase(summary);

  if (quote) {
    return {
      variant,
      label: labelForVariant(variant, 'quote'),
      highlight: quote,
      kind: 'quote',
      byline: item.authors?.filter(Boolean).slice(0, 2).join(', ') || undefined,
    };
  }

  if (!isBoilerplate(summary)) {
    const excerpt = usefulSentence(summary) ?? summary;
    return {
      variant,
      label: labelForVariant(variant, 'excerpt'),
      highlight: smartExcerpt(excerpt),
      kind: 'excerpt',
      byline: item.authors?.filter(Boolean).slice(0, 2).join(', ') || undefined,
    };
  }

  return {
    variant,
    label: labelForVariant(variant, 'headline'),
    highlight: titleClause(title),
    kind: 'headline',
    byline: item.authors?.filter(Boolean).slice(0, 2).join(', ') || undefined,
  };
}
