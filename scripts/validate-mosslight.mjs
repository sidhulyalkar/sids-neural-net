import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const rooms = fs.readFileSync(`${root}/rooms.js`, 'utf8');
const expedition = fs.readFileSync(`${root}/expedition.js`, 'utf8');
const director = fs.readFileSync(`${root}/director.js`, 'utf8');
const game = fs.readFileSync(`${root}/game-v3.js`, 'utf8');
const styles = fs.readFileSync(`${root}/styles.css`, 'utf8');
const atlasRoute = fs.readFileSync('app/game-runtimes/mosslight-atlas/route.ts', 'utf8');
const errors = [];

const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(html.includes('<canvas id="c"'), 'runtime must expose the game canvas');
expect(html.includes('Mosslight: Atlas Expeditions'), 'Atlas Expeditions runtime title is missing');
expect(
  html.includes('./rooms.js') && html.includes('/game-runtimes/mosslight-atlas') && html.includes('./expedition.js') && html.includes('./director.js') && html.includes('./game-v3.js') && html.includes('./styles.css'),
  'runtime shell must load authored rooms, canonical atlas feed, expedition adapter, progression director, v0.3 game, and styles'
);
expect(html.includes('W A S D') && html.includes('Mouse / Arrows') && html.includes('Click / Space'), 'mouse + keyboard aim/cast onboarding is incomplete');
expect(html.includes('1,000-scene Nature Atlas') && html.includes('world gifts'), 'replayable 1,000-world progression promise is missing from onboarding');
expect(html.includes('gentle mode') && html.includes('flow mode'), 'gentle/default and optional flow modes must both be exposed');
expect(styles.includes('#abilityBar') && styles.includes('#hintCard'), 'HUD visual system is incomplete');
expect(/\.ability:disabled\s*\{\s*display:none\s*\}/.test(styles), 'locked tools must stay hidden until introduced');

const roomTitles = [
  'Dew Garden',
  'Orchard House',
  'Rescue Hollow',
  'River Workshop',
  'Cloud Meadow',
  'Emberstep',
  'Pollinator Conservatory',
  'Alpine Thaw',
  'Tide Nursery',
  'Earthheart',
];
for (const title of roomTitles) expect(rooms.includes(`title: '${title}'`), `missing mechanic template: ${title}`);

const abilities = ['rain', 'sun', 'seed', 'wind', 'mend', 'gather'];
for (const ability of abilities) expect(game.includes(`${ability}:`) && game.includes(`name: '${ability[0].toUpperCase()}${ability.slice(1)}'`), `missing ability definition: ${ability}`);

expect((rooms.match(/T\('/g) ?? []).length >= 30, 'expected at least 30 authored restoration targets');
expect((rooms.match(/H\('/g) ?? []).length >= 10, 'expected authored environmental stress fronts');
expect((rooms.match(/kind', 'cloud'|, 'cloud',/g) ?? []).length >= 3, 'expected moveable storm-cloud encounters');
expect((rooms.match(/'sluice'/g) ?? []).length >= 4, 'expected river-sluice encounters');
expect(rooms.includes("species: 'fox'") && rooms.includes("species: 'owl'") && rooms.includes("species: 'deer'") && rooms.includes("species: 'marmot'"), 'species-specific animal campaign is incomplete');

expect(atlasRoute.includes('NATURE_WORLDS') && atlasRoute.includes('NATURE_WORLD_PALETTES'), 'Mosslight atlas feed must derive from the canonical Nature Atlas');
expect(atlasRoute.includes('scenes.length !== 1000'), 'Mosslight atlas feed must enforce the 1,000-scene invariant');
expect(atlasRoute.includes('renderCues') && atlasRoute.includes('atmosphere') && atlasRoute.includes('density') && atlasRoute.includes('sparkle'), 'atlas feed is missing scene-specific visual metadata');

expect(expedition.includes("sid.mosslight.atlas-deck.v1"), 'persistent Atlas deck is missing');
expect(expedition.includes('shuffledIndices') && expedition.includes('takeScenes'), 'without-replacement Atlas scene scheduling is missing');
expect(expedition.includes('deck.cursor >= deck.order.length'), 'Atlas deck does not cycle only after exhausting its current order');
expect(expedition.includes('content.rooms.splice'), 'new expeditions must mutate the live mechanic-template array before replay');
expect(expedition.includes('adaptRoom') && expedition.includes('decorFor') && expedition.includes('paletteFor'), 'Atlas worlds are not being translated into gameplay rooms');
expect(expedition.includes('hazardType') && expedition.includes('targetLabel') && expedition.includes('obstacleKind'), 'scene metadata must affect hazards, relationships, and geometry');
expect(expedition.includes('installAtlasOverlay') && expedition.includes('renderCues'), 'scene render cues must produce visible Atlas-specific dressing');
expect(expedition.includes("['again', 'flowAgain']"), 'replay buttons must advance to a new expedition');
expect(expedition.includes('atlasCount: atlas.count') && expedition.includes('runSize: RUN_SIZE'), 'Atlas expedition diagnostics are missing');

const powerups = ['rapid-bloom', 'giant-dew', 'prism-spores', 'river-echo', 'sunstep', 'moss-ward'];
for (const powerup of powerups) expect(director.includes(`id: '${powerup}'`), `missing expedition powerup: ${powerup}`);
const encounterPatterns = ['patrol', 'weave', 'orbit', 'swoop', 'stalk', 'dash', 'spiral'];
for (const pattern of encounterPatterns) expect(director.includes(`'${pattern}'`), `missing wildlife encounter movement pattern: ${pattern}`);
const situations = ['tidal-lanes', 'living-corridor', 'heat-crossing', 'alpine-switchback', 'orbital-dance', 'weather-window', 'earthheart-convergence'];
for (const situation of situations) expect(director.includes(`'${situation}'`), `missing terrain situation: ${situation}`);
expect(director.includes('const level = slot + 1') && director.includes('speedScale') && director.includes('encounterCount'), 'room-by-room difficulty progression is missing');
expect(director.includes('motionForObstacle') && director.includes("type: 'slide-x'") && director.includes("type: 'orbit'"), 'moving obstacle choreography is missing');
expect(director.includes('movementPattern = animalPatternFor'), 'restoration animals need species-aware movement');
expect(director.includes('window.MosslightDirector'), 'progression director diagnostics are missing');

expect(game.includes('function assistedAim('), 'gentle aim assistance is missing');
expect(game.includes("keys.has('arrowright')") && game.includes("keys.has('arrowleft')") && game.includes("keys.has('arrowup')") && game.includes("keys.has('arrowdown')"), 'arrow-key aiming is not wired into the aim vector');
expect(game.includes("if (lower === ' ' && state.mode === 'playing') fire();"), 'Space casting is not wired for keyboard aiming');
expect(game.includes("aimSource = 'keyboard'") && game.includes("aimSource = 'mouse'"), 'mouse/keyboard aim arbitration is missing');
expect(game.includes('spec.cooldown / state.relics.fireRate'), 'Rapid Bloom must modify fire cadence');
expect(game.includes('spec.radius * state.relics.projectileScale'), 'Giant Dew must modify projectile size');
expect(game.includes('state.relics.spread') && game.includes("[-.14, 0, .14]"), 'Prism Spores three-shot spread is missing');
expect(game.includes('state.relics.pierce'), 'River Echo piercing is missing');
expect(game.includes('state.relics.moveSpeed') && game.includes('state.relics.dashRecharge'), 'Sunstep mobility modifiers are missing');
expect(game.includes('state.relics.shieldCharges'), 'Moss Ward shield charges are missing');
expect(game.includes('function updateEncounter(') && game.includes("pattern === 'dash'") && game.includes("pattern === 'stalk'") && game.includes("pattern === 'orbit'"), 'custom encounter movement engine is incomplete');
expect(game.includes('function updateAnimalTarget(') && game.includes("pattern === 'swoop'") && game.includes("pattern === 'flee'") && game.includes("pattern === 'hop'"), 'animal target movement grammar is incomplete');
expect(game.includes('function updateSituation(') && game.includes('spawnSituationWave'), 'telegraphed room situations are missing');
expect(game.includes('function updateObstacles('), 'moving obstacles are not integrated into gameplay');
expect(game.includes('function collectPowerup('), 'world gift collection is missing');
expect(game.includes('window.__MOSSLIGHT_PLAYTEST__'), 'browser playtest API is missing');
expect(game.includes("version: '0.3.0'"), 'playtest API version is not v0.3.0');
expect(game.includes('function drawAimReticle(') && game.includes('function drawEncounter(') && game.includes('function drawPowerup(') && game.includes('function drawWave('), 'v0.3 gameplay feedback renderers are incomplete');

for (const [name, source] of [['rooms.js', rooms], ['expedition.js', expedition], ['director.js', director], ['game-v3.js', game]]) {
  try {
    new Function(source);
  } catch (error) {
    errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length) {
  console.error(`Mosslight validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Mosslight PASS: ${roomTitles.length} escalating Atlas rooms, ${abilities.length} restoration tools, ${powerups.length} expedition powerups, ${encounterPatterns.length} wildlife movement grammars, ${situations.length} terrain situations, mouse/arrow aim, gentle + flow modes.`);
