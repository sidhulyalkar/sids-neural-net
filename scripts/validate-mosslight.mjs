import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const rooms = fs.readFileSync(`${root}/rooms.js`, 'utf8');
const expedition = fs.readFileSync(`${root}/expedition.js`, 'utf8');
const game = fs.readFileSync(`${root}/game.js`, 'utf8');
const styles = fs.readFileSync(`${root}/styles.css`, 'utf8');
const atlasRoute = fs.readFileSync('app/game-runtimes/mosslight-atlas/route.ts', 'utf8');
const errors = [];

const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(html.includes('<canvas id="c"'), 'runtime must expose the game canvas');
expect(html.includes('Mosslight: Atlas Expeditions'), 'Atlas Expeditions runtime title is missing');
expect(
  html.includes('./rooms.js') && html.includes('/game-runtimes/mosslight-atlas') && html.includes('./expedition.js') && html.includes('./game.js') && html.includes('./styles.css'),
  'runtime shell must load authored rooms, canonical atlas feed, expedition adapter, game, and styles'
);
expect(html.includes('W A S D') && html.includes('Mouse / Arrows') && html.includes('Click / Space'), 'mouse + keyboard aim/cast onboarding is incomplete');
expect(html.includes('1,000-scene Nature Atlas') && html.includes('unseen worlds'), 'replayable 1,000-world promise is missing from onboarding');
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
for (const ability of abilities) expect(game.includes(`${ability}: { name:`), `missing ability definition: ${ability}`);

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

expect(game.includes('function assistedAim('), 'gentle aim assistance is missing');
expect(game.includes("keys.has('arrowright')") && game.includes("keys.has('arrowleft')") && game.includes("keys.has('arrowup')") && game.includes("keys.has('arrowdown')"), 'arrow-key aiming is not wired into the aim vector');
expect(game.includes("if (lower === ' ' && state.mode === 'playing') fire();"), 'Space casting is not wired for keyboard aiming');
expect(game.includes("state.difficulty === 'gentle'"), 'gentle-mode tuning is missing');
expect(game.includes('function drawPlayer(') && game.includes('drawFox(') && game.includes('drawOwl(') && game.includes('drawDeer('), 'character-specific renderers are missing');
expect(game.includes('function smartSelect('), 'guided tool selection is missing');
expect(game.includes('const nearest = nearestTarget(unfinished);') && !game.includes('currentStillUseful'), 'guided selection must follow the nearest unresolved relationship');
expect(game.includes("setTimeout(() => ui.intro.classList.remove('show'), 1350)"), 'room intro must clear quickly enough for immediate play');
expect(game.includes('window.__MOSSLIGHT_PLAYTEST__'), 'browser playtest API is missing');
expect(game.includes("version: '0.2.0'"), 'playtest API version is not v0.2.0');
expect(game.includes('function drawAimReticle('), 'directional aim feedback is missing');
expect(game.includes('drawGardenDecor') && game.includes('drawTideDecor') && game.includes('drawHeartDecor'), 'room-specific visual transformations are incomplete');

for (const [name, source] of [['rooms.js', rooms], ['expedition.js', expedition], ['game.js', game]]) {
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

console.log(`Mosslight PASS: ${roomTitles.length} stable mechanic templates + 1,000-scene replay deck, ${abilities.length} tools, mouse/arrow aim, gentle + flow modes, Atlas adapter compiles.`);
