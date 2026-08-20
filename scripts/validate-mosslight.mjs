import fs from 'node:fs';

const path = 'public/game-runtimes/mosslight/index.html';
const html = fs.readFileSync(path, 'utf8');
const errors = [];

const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(html.includes('<canvas id="c"'), 'runtime must expose the game canvas');
expect(html.includes('Mosslight: Rooms of Renewal'), 'runtime title is missing');
expect(html.includes("title:'Earthheart'"), 'final Earthheart room is missing');
expect(html.includes("launchUrl: '/game-runtimes/mosslight/index.html'") === false, 'runtime must stay self-contained and not contain website registry code');

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
for (const title of roomTitles) expect(html.includes(`title:'${title}'`), `missing room: ${title}`);

const abilities = ['rain', 'sun', 'seed', 'wind', 'mend', 'gather'];
for (const ability of abilities) expect(html.includes(`${ability}:{name:`), `missing ability definition: ${ability}`);

expect((html.match(/T\('/g) ?? []).length >= 20, 'expected at least 20 authored restoration targets');
expect((html.match(/HZ\(/g) ?? []).length >= 12, 'expected at least 12 authored stress fronts');
expect((html.match(/C\('/g) ?? []).length >= 3, 'expected authored moveable storm-cloud encounters');
expect((html.match(/S\('/g) ?? []).length >= 4, 'expected authored river-sluice encounters');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
expect(scripts.length === 1, `expected exactly one embedded game script, found ${scripts.length}`);
if (scripts.length === 1) {
  try {
    new Function(scripts[0][1]);
  } catch (error) {
    errors.push(`embedded JavaScript does not compile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length) {
  console.error(`Mosslight runtime validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Mosslight runtime PASS: ${roomTitles.length} rooms, ${abilities.length} abilities, embedded JavaScript compiles.`);
