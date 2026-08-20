import { NATURE_COLLECTIONS, NATURE_WORLDS } from '../lib/physiology/natureWorldsExpanded';
import { NATURE_VISUAL_CORPUS, facetsForNatureWorld, type NatureVisualFacet } from '../lib/physiology/natureVisualCorpus';

const errors: string[] = [];
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

function assert(condition: unknown, message: string) {
  if (!condition) errors.push(message);
}

assert(NATURE_WORLDS.length === 1000, `expected 1000 worlds, found ${NATURE_WORLDS.length}`);
assert(new Set(NATURE_WORLDS.map((world) => world.id)).size === 1000, 'world ids must be unique');
assert(new Set(NATURE_WORLDS.map((world) => world.seed)).size === 1000, 'world seeds must be unique');

const collections = NATURE_COLLECTIONS.filter((entry) => entry.id !== 'all');
for (const collection of collections) {
  const count = NATURE_WORLDS.filter((world) => world.collection === collection.id).length;
  assert(count > 0, `collection ${collection.id} has no worlds`);
  const fixtureCount = NATURE_VISUAL_CORPUS.filter((fixture) => fixture.collection === collection.id).length;
  assert(fixtureCount >= 4, `collection ${collection.id} has only ${fixtureCount} canonical fixtures; expected at least 4`);
}

const fallbackOnlyWorlds = NATURE_WORLDS.filter((world) => world.scene.renderCues.length === 0);
const fallbackRatio = fallbackOnlyWorlds.length / NATURE_WORLDS.length;
assert(
  fallbackRatio <= 0.08,
  `generic focal-subject fallback expanded to ${(fallbackRatio * 100).toFixed(1)}% of the atlas; keep it at or below 8%`,
);

for (const world of NATURE_WORLDS) {
  assert(Number.isFinite(world.seed), `world ${world.id} has a non-finite seed`);
  assert(world.scene.visualThesis.trim().length > 24, `world ${world.id} has an underspecified visual thesis`);
  assert(world.scene.focalSubject.trim().length > 0, `world ${world.id} has no focal subject`);
  assert(world.icon.trim().length > 0, `world ${world.id} has neither explicit render cues nor an icon fallback`);
  assert(world.scene.renderCues.length <= 12, `world ${world.id} exceeds the render-cue cap`);
  assert(world.scene.density >= 0 && world.scene.density <= 1, `world ${world.id} density is outside [0,1]`);
  assert(world.scene.sparkle >= 0 && world.scene.sparkle <= 1, `world ${world.id} sparkle is outside [0,1]`);
  assert(world.activities.length > 0, `world ${world.id} has no activities`);
}

for (const facet of requiredFacets) {
  const matches = NATURE_VISUAL_CORPUS.filter((fixture) => fixture.facets.includes(facet));
  assert(matches.length > 0, `visual corpus is missing required facet: ${facet}`);
}

for (const fixture of NATURE_VISUAL_CORPUS) {
  const world = NATURE_WORLDS.find((entry) => entry.id === fixture.worldId);
  assert(Boolean(world), `fixture ${fixture.key} references missing world ${fixture.worldId}`);
  if (world) {
    const recomputed = facetsForNatureWorld(world).sort().join(',');
    const recorded = [...fixture.facets].sort().join(',');
    assert(recomputed === recorded, `fixture ${fixture.key} facet drift: ${recorded} != ${recomputed}`);
  }
}

if (errors.length > 0) {
  console.error(`Nature Atlas visual corpus failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

const facetCounts = Object.fromEntries(requiredFacets.map((facet) => [facet, NATURE_VISUAL_CORPUS.filter((fixture) => fixture.facets.includes(facet)).length]));
console.log(`Nature Atlas corpus PASS: ${NATURE_WORLDS.length} worlds, ${collections.length} collections, ${NATURE_VISUAL_CORPUS.length} canonical fixtures.`);
console.log(`Fallback-subject renderer: ${fallbackOnlyWorlds.length}/${NATURE_WORLDS.length} worlds (${(fallbackRatio * 100).toFixed(1)}%).`);
console.log(JSON.stringify(facetCounts, null, 2));
