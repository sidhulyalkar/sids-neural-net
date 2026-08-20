import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const rooms = fs.readFileSync(`${root}/rooms.js`, 'utf8');
const game = fs.readFileSync(`${root}/game.js`, 'utf8');
const styles = fs.readFileSync(`${root}/styles.css`, 'utf8');
const errors = [];

const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(html.includes('<canvas id="c"'), 'runtime must expose the game canvas');
expect(html.includes('Mosslight v0.2: Rooms of Renewal'), 'v0.2 runtime title is missing');
expect(html.includes('./rooms.js') && html.includes('./game.js') && html.includes('./styles.css'), 'runtime shell must load split v0.2 assets');
expect(html.includes('W A S D') && html.includes('Mouse') && html.includes('Click'), 'simple three-control onboarding is missing');
expect(html.includes('gentle mode') && html.includes('flow mode'), 'gentle/default and optional flow modes must both be exposed');
expect(styles.includes('#abilityBar') && styles.includes('#hintCard'), 'HUD visual system is incomplete');

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
for (const title of roomTitles) expect(rooms.includes(`title: '${title}'`), `missing room: ${title}`);

const abilities = ['rain', 'sun', 'seed', 'wind', 'mend', 'gather'];
for (const ability of abilities) expect(game.includes(`${ability}: { name:`), `missing ability definition: ${ability}`);

expect((rooms.match(/T\('/g) ?? []).length >= 30, 'expected at least 30 authored restoration targets');
expect((rooms.match(/H\('/g) ?? []).length >= 10, 'expected authored environmental stress fronts');
expect((rooms.match(/kind', 'cloud'|, 'cloud',/g) ?? []).length >= 3, 'expected moveable storm-cloud encounters');
expect((rooms.match(/'sluice'/g) ?? []).length >= 4, 'expected river-sluice encounters');
expect(rooms.includes("species: 'fox'") && rooms.includes("species: 'owl'") && rooms.includes("species: 'deer'") && rooms.includes("species: 'marmot'"), 'species-specific animal campaign is incomplete');

expect(game.includes('function assistedAim('), 'gentle aim assistance is missing');
expect(game.includes("state.difficulty === 'gentle'"), 'gentle-mode tuning is missing');
expect(game.includes('function drawPlayer(') && game.includes('drawFox(') && game.includes('drawOwl(') && game.includes('drawDeer('), 'character-specific renderers are missing');
expect(game.includes('function smartSelect('), 'guided tool selection is missing');
expect(game.includes('window.__MOSSLIGHT_PLAYTEST__'), 'browser playtest API is missing');
expect(game.includes("version: '0.2.0'"), 'playtest API version is not v0.2.0');
expect(game.includes('function drawAimReticle('), 'directional aim feedback is missing');
expect(game.includes('drawGardenDecor') && game.includes('drawTideDecor') && game.includes('drawHeartDecor'), 'room-specific visual transformations are incomplete');

for (const [name, source] of [['rooms.js', rooms], ['game.js', game]]) {
  try {
    new Function(source);
  } catch (error) {
    errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length) {
  console.error(`Mosslight v0.2 validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Mosslight v0.2 PASS: ${roomTitles.length} rooms, ${abilities.length} tools, gentle + flow modes, split JavaScript compiles.`);
