import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const game = fs.readFileSync(`${root}/game-v8.js`, 'utf8');
const visuals = fs.readFileSync(`${root}/visual-system-v8.js`, 'utf8');
const styles = fs.readFileSync(`${root}/sylvaria-v8.css`, 'utf8');
const arcade = fs.readFileSync('src/data/arcadeGames.ts', 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(html.includes('Sylvaria: Countercut'), 'Countercut title missing');
expect(html.includes('./game-v8.js') && !html.includes('./game-v5.js'), 'production shell must load only Countercut gameplay');
expect(html.includes('./visual-system-v8.js') && html.includes('./sylvaria-v8.css'), 'Countercut visual stack missing');
expect(html.includes('cardinal step-dashes') && html.includes('projectile'), 'movement/counter tutorial missing');
expect(game.includes("const VERSION = '0.8.0'"), 'runtime version must be 0.8.0');
expect(game.includes('while(accumulator>=1/120)'), 'fixed 120 Hz combat simulation missing');
expect(game.includes('heldMoves') && game.includes('moveRepeat') && game.includes('dashStep'), 'held WASD discrete step-dash cadence missing');
expect(game.includes('dashDistance: blueprint.dash') && game.includes('Math.floor((depth - 10) / 4) * 3'), 'progressive dash-length risk/reward scaling missing');
expect(game.includes("arrowup: 'up'") && game.includes("arrowdown: 'down'") && game.includes("arrowleft: 'left'") && game.includes("arrowright: 'right'"), 'four cardinal machete cuts missing');
expect(game.includes('counterShot') && game.includes('shotApproachDirection') && game.includes('perfectCounters'), 'directional projectile counter system missing');
expect(game.includes('slashContains') && game.includes('state.debris') && game.includes('deadwood'), 'machete environmental chopping missing');
expect(game.includes('nearestLivingTree') && game.includes("endRun('The grove was clear-cut')"), 'living-tree defense pressure missing');
expect(game.includes('proceduralBlueprint') && game.includes('rngFrom(hash(`sylvaria-room-${depth}`))'), 'seeded post-room-10 generation missing');
for (const enemy of ['feller','foreman','lobbyist','skidder','drone','chair','broker','mech']) expect(game.includes(`${enemy}: {`), `missing enemy archetype ${enemy}`);
for (const title of ['Trailhead Trespass','Nailgun Nursery','Red Tape Ravine','Skidder Switchback','Sawdisc Wetland','Committee Canopy','Subsidy Grove','Clearcut Conveyor','Four-Way Firebreak','PAC-a-Saw Summit']) expect(game.includes(`title: '${title}'`), `missing authored room ${title}`);
expect(game.includes("name: 'PAC-a-Saw'") && game.includes('boss.phase = 2') && game.includes('boss.phase = 3'), 'three-phase PAC-a-Saw boss missing');
expect(game.includes("state.mode='paused'") && game.includes("state.mode='playing'"), 'pause/resume loop missing');
expect(game.includes('window.__MOSSLIGHT_PLAYTEST__') && game.includes('spawnCounterShot'), 'playtest instrumentation missing');
expect(visuals.includes("version: '0.8.0'") && visuals.includes('requestFullscreen'), 'v0.8 immersive visual shell missing');
expect(styles.includes('aspect-ratio:3/2') && styles.includes('#runRail'), 'aspect-safe combat HUD styling missing');
expect(arcade.includes("version: 'v0.8.0'") && arcade.includes('COUNTERCUT') && arcade.includes('step-dashes'), 'Game Network metadata is not on Countercut v0.8');
for (const [name, source] of [['game-v8.js', game], ['visual-system-v8.js', visuals]]) {
  try { new Function(source); } catch (error) { errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`); }
}
if (errors.length) {
  console.error(`Sylvaria Countercut validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log('Sylvaria Countercut PASS: step-dash movement, four-direction machete counters, tree defense, deadwood chopping, eight enemy archetypes, ten authored rooms, PAC-a-Saw boss, seeded deep rooms, fixed-step simulation, and v0.8 Game Network metadata.');
