import {
  NATURE_COLLECTIONS,
  NATURE_WORLDS,
  type NatureCollectionId,
  type RichNatureWorldDefinition,
} from './natureWorldsExpanded';

export type NatureVisualFacet =
  | 'light-atmosphere'
  | 'dark-atmosphere'
  | 'dense'
  | 'sparse'
  | 'water'
  | 'mountain'
  | 'macro'
  | 'flowers'
  | 'celestial'
  | 'rain'
  | 'snow'
  | 'unusual-focal';

export type NatureVisualFixture = {
  key: string;
  worldId: string;
  worldIndex: number;
  collection: NatureCollectionId;
  facets: NatureVisualFacet[];
};

const LIGHT = new Set(['clear', 'sunrise', 'sunset', 'frost']);
const DARK = new Set(['night', 'twilight', 'storm', 'glow']);
const WATER_CUES = new Set(['water', 'river', 'lake', 'pond', 'ocean', 'waterfall']);
const UNUSUAL_CUES = new Set(['crystal', 'ruin', 'web', 'aurora', 'meteor', 'rainbow', 'cave']);

function hasAny(world: RichNatureWorldDefinition, cues: ReadonlySet<string>): boolean {
  return world.scene.renderCues.some((cue) => cues.has(cue));
}

export function facetsForNatureWorld(world: RichNatureWorldDefinition): NatureVisualFacet[] {
  const facets: NatureVisualFacet[] = [];
  if (LIGHT.has(world.scene.atmosphere)) facets.push('light-atmosphere');
  if (DARK.has(world.scene.atmosphere)) facets.push('dark-atmosphere');
  if (world.scene.density >= 0.75) facets.push('dense');
  if (world.scene.density <= 0.56) facets.push('sparse');
  if (hasAny(world, WATER_CUES) || ['shore', 'reef', 'river', 'lake', 'wetland'].includes(world.terrain)) facets.push('water');
  if (world.scene.renderCues.includes('mountain') || world.scene.renderCues.includes('canyon') || world.terrain === 'mountain') facets.push('mountain');
  if (world.scene.depth === 'macro') facets.push('macro');
  if (world.scene.renderCues.includes('flower') || world.scene.renderCues.includes('sunflower')) facets.push('flowers');
  if (world.collection === 'celestial' || hasAny(world, new Set(['stars', 'moon', 'meteor', 'aurora']))) facets.push('celestial');
  if (world.scene.atmosphere === 'rain' || world.scene.renderCues.includes('rain')) facets.push('rain');
  if (world.scene.atmosphere === 'snow' || world.scene.renderCues.includes('snow')) facets.push('snow');
  if (hasAny(world, UNUSUAL_CUES)) facets.push('unusual-focal');
  return facets;
}

function collectionSamples(collection: NatureCollectionId, count = 4): RichNatureWorldDefinition[] {
  const worlds = NATURE_WORLDS.filter((world) => world.collection === collection);
  if (worlds.length <= count) return worlds;
  const positions = Array.from({ length: count }, (_, index) => Math.round((index * (worlds.length - 1)) / (count - 1)));
  return positions.map((position) => worlds[position]);
}

export function buildNatureVisualCorpus(): NatureVisualFixture[] {
  const selected = new Map<string, RichNatureWorldDefinition>();
  const collections = NATURE_COLLECTIONS.filter((entry): entry is typeof entry & { id: NatureCollectionId } => entry.id !== 'all');

  for (const collection of collections) {
    for (const world of collectionSamples(collection.id)) selected.set(world.id, world);
  }

  const requiredFacets: NatureVisualFacet[] = [
    'light-atmosphere',
    'dark-atmosphere',
    'dense',
    'sparse',
    'water',
    'mountain',
    'macro',
    'flowers',
    'celestial',
    'rain',
    'snow',
    'unusual-focal',
  ];

  for (const facet of requiredFacets) {
    const candidate = NATURE_WORLDS.find((world) => facetsForNatureWorld(world).includes(facet));
    if (candidate) selected.set(candidate.id, candidate);
  }

  return [...selected.values()]
    .sort((a, b) => a.index - b.index)
    .map((world) => ({
      key: `world-${String(world.index).padStart(3, '0')}`,
      worldId: world.id,
      worldIndex: world.index,
      collection: world.collection,
      facets: facetsForNatureWorld(world),
    }));
}

export const NATURE_VISUAL_CORPUS = buildNatureVisualCorpus();
