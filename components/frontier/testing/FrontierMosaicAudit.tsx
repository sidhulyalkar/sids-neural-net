'use client';

import type { FrontierItem, FrontierReaction } from '@/lib/frontier/types';
import { SignalBoard } from '../SignalBoard';
import { SignalCard } from '../SignalCard';
import styles from './frontier-mosaic-audit.module.css';

const PUBLISHED = '2026-08-22T12:00:00.000Z';

function auditItem(
  id: string,
  lane: FrontierItem['lane'],
  title: string,
  summary: string,
  overrides: Partial<FrontierItem> = {},
): FrontierItem {
  return {
    id,
    title,
    summary,
    url: `https://example.com/frontier-audit/${id}`,
    source: 'FRONTIER Mosaic Audit',
    sourceLabel: 'Audit source',
    sourceKind: 'local',
    publishedAt: PUBLISHED,
    lane,
    tags: ['phase-8.1', 'media-mosaic'],
    baseScore: 0.82,
    importance: 0.68,
    novelty: 0.7,
    quality: 0.86,
    momentum: 0.58,
    why: 'Deterministic presentation fixture.',
    ...overrides,
  };
}

const ITEMS: FrontierItem[] = [
  auditItem(
    'mosaic-world-football',
    'world_soccer',
    'A decisive counterattack changes the shape of a European final',
    'Match movement, spacing, and the finishing sequence distilled into a visual-first card.',
    {
      media: { type: 'image', url: '/visual-archive/thumbs/photo-001-thumb.webp', alt: 'Deterministic local visual fixture', aspectRatio: 'landscape' },
      importance: 0.91,
      highPriority: true,
      watchSignal: { intentId: 'audit-football', label: 'World soccer', score: 0.91, triggeredAt: 1_777_000_000_000 },
    },
  ),
  auditItem(
    'mosaic-ai-map',
    'ai_frontier',
    'Mapping representation drift across a family of reasoning models',
    'A concise evidence cut sits below the visual instead of becoming a wall of text.',
    { media: { type: 'image', url: '/visual-archive/thumbs/photo-002-thumb.webp', alt: 'Deterministic local visual fixture', aspectRatio: 'landscape' }, importance: 0.86 },
  ),
  auditItem(
    'mosaic-game-world',
    'gaming',
    'A procedural world that remembers where the player has already been',
    'Environment design and simulation behavior become the focal surface.',
    { media: { type: 'image', url: '/visual-archive/thumbs/photo-003-thumb.webp', alt: 'Deterministic local visual fixture', aspectRatio: 'wide' } },
  ),
  auditItem(
    'mosaic-agent-note',
    'builder_signal',
    'Local agent workspaces are becoming composable instead of monolithic',
    'A compact text card should connect richer visual stories without claiming the same amount of canvas.',
  ),
  auditItem(
    'mosaic-outdoors',
    'life',
    'Alpine light, a thin trail, and one useful reason to go outside',
    'Visual rabbit holes should feel welcome beside papers, code, sports, and games.',
    { media: { type: 'image', url: '/visual-archive/thumbs/photo-004-thumb.webp', alt: 'Deterministic local visual fixture', aspectRatio: 'landscape' } },
  ),
  auditItem(
    'mosaic-benchmark',
    'ml_data',
    'Benchmark gains shrink after the evaluation protocol is corrected',
    'Structured evidence earns a little more room than ordinary text, without becoming a full magazine spread.',
    { metrics: [{ label: 'corrected delta', value: '+1.8%' }], artifacts: [{ kind: 'benchmark', label: 'evaluation delta', value: '+1.8%' }] },
  ),
  auditItem(
    'mosaic-music',
    'music',
    'A bass set built around one unusually elastic transition',
    'The discovery surface should make audiovisual material easy to spot at a glance.',
    { media: { type: 'image', url: '/visual-archive/thumbs/photo-005-thumb.webp', alt: 'Deterministic local visual fixture', aspectRatio: 'wide' } },
  ),
  auditItem(
    'mosaic-neuro',
    'neuro_frontier',
    'Population activity separates task state before overt behavior changes',
    'The image leads; the scan summary stays deliberately short.',
    { media: { type: 'image', url: '/visual-archive/thumbs/photo-006-thumb.webp', alt: 'Deterministic local visual fixture', aspectRatio: 'landscape' } },
  ),
  auditItem(
    'mosaic-method',
    'methods',
    'A retrieval trick worth stealing for small context windows',
    'Text-only methods remain scannable and compact until the reader asks for depth.',
  ),
  auditItem(
    'mosaic-creative-tech',
    'creative_tech',
    'Spatial browser interfaces work better when motion explains hierarchy',
    'A visual prototype receives a larger footprint while retaining the same ranked position.',
    { media: { type: 'image', url: '/visual-archive/thumbs/photo-007-thumb.webp', alt: 'Deterministic local visual fixture', aspectRatio: 'landscape' }, importance: 0.88 },
  ),
  auditItem(
    'mosaic-science',
    'broad_science',
    'A small observation changes how a larger physical system is modeled',
    'Source-backed imagery can carry more of the scan burden than repeated explanatory prose.',
    { media: { type: 'image', url: '/visual-archive/thumbs/photo-008-thumb.webp', alt: 'Deterministic local visual fixture', aspectRatio: 'landscape' } },
  ),
  auditItem(
    'mosaic-wildcard',
    'wildcards',
    'A strange little interface pattern with unusually high transfer value',
    'Compact wildcard cards should be easy to sample without carving a large hole in the feed.',
  ),
];

const NOOP_ITEM = (_item: FrontierItem) => undefined;
const NOOP_DWELL = (_item: FrontierItem, _dwellMs: number) => undefined;
const NOOP_REACTION = (_item: FrontierItem, _reaction: FrontierReaction) => undefined;

export function FrontierMosaicAudit() {
  return (
    <div className={styles.shell} data-frontier-mosaic-audit="true">
      <header className={styles.header}>
        <span>FRONTIER</span>
        <span>Phase 8.1 · populated media mosaic</span>
      </header>
      <section className={styles.surface} aria-label="Deterministic media-forward mosaic">
        <SignalBoard
          items={ITEMS}
          mode="desk"
          semanticEnabled={false}
          synthesis={false}
          renderCard={(item, presentation) => (
            <SignalCard
              item={item}
              presentation={presentation}
              explanation="Deterministic browser audit item."
              onSeen={NOOP_ITEM}
              onDwell={NOOP_DWELL}
              onExpand={NOOP_ITEM}
              onOpen={NOOP_ITEM}
              onSave={NOOP_ITEM}
              onReact={NOOP_REACTION}
            />
          )}
        />
      </section>
    </div>
  );
}
