import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const rooms = fs.readFileSync(`${root}/rooms.js`, 'utf8');
const expedition = fs.readFileSync(`${root}/expedition.js`, 'utf8');
const director = fs.readFileSync(`${root}/director.js`, 'utf8');
const game = fs.readFileSync(`${root}/game-v4.js`, 'utf8');
const portalStyles = fs.readFileSync(`${root}/portal-v4.css`, 'utf8');
const atlasRoute = fs.readFileSync('app/game-runtimes/mosslight-atlas/route.ts', 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(html.includes('<canvas id="c"'), 'runtime must expose the game canvas');
expect(html.includes('Mosslight: Mossglint Run'), 'Mossglint Run title is missing');
expect(html.includes('./game-v4.js') && !html.includes('./game-v3.js'), 'production shell must run v0.4 portal runtime only');
expect(html.includes('./portal-v4.css'), 'portal-run visual layer is missing');
expect(html.includes('one-way atlas gauntlet') && html.includes('never look back'), 'one-way story rule is missing from onboarding');
expect(html.includes('start scored run') && html.includes('explorer run'), 'proper run menu modes are missing');
expect(html.includes('how to play') && html.includes('controls') && html.includes('options'), 'menu navigation is incomplete');
expect(html.includes('data-bind="moveUp"') && html.includes('data-bind="aimUp"') && html.includes('data-bind="cast"') && html.includes('data-bind="portal"'), 'remappable control surface is incomplete');
expect(html.includes('musicToggle') && html.includes('sfxToggle') && html.includes('volume'), 'audio options are incomplete');
expect(html.includes('mossglint') && html.includes('portalState') && html.includes('integrity') && html.includes('bossState'), 'run HUD is missing portal-run state');

const roomTitles = ['Dew Garden','Orchard House','Rescue Hollow','River Workshop','Cloud Meadow','Emberstep','Pollinator Conservatory','Alpine Thaw','Tide Nursery','Earthheart'];
for (const title of roomTitles) expect(rooms.includes(`title: '${title}'`), `missing mechanic template: ${title}`);
for (const ability of ['rain','sun','seed','wind','mend','gather']) expect(game.includes(`${ability}:`) && game.includes(`name: '${ability[0].toUpperCase()}${ability.slice(1)}'`), `missing portal-gun resonance: ${ability}`);

expect(atlasRoute.includes('NATURE_WORLDS') && atlasRoute.includes('NATURE_WORLD_PALETTES'), 'Mosslight atlas feed must derive from canonical Nature Atlas');
expect(atlasRoute.includes('scenes.length !== 1000'), 'Mosslight atlas feed must enforce 1,000 scenes');
expect(expedition.includes("sid.mosslight.atlas-deck.v1") && expedition.includes('takeScenes'), 'persistent without-replacement Atlas deck is missing');
expect(expedition.includes('deck.cursor >= deck.order.length'), 'Atlas deck must cycle only after exhaustion');
expect(expedition.includes('adaptRoom') && expedition.includes('content.rooms.splice'), 'Atlas scenes must adapt the live room templates');

for (const powerup of ['rapid-bloom','giant-dew','prism-spores','river-echo','sunstep','moss-ward']) expect(director.includes(`id: '${powerup}'`), `missing world gift: ${powerup}`);
for (const pattern of ['patrol','weave','orbit','swoop','stalk','dash','spiral']) expect(director.includes(`'${pattern}'`), `missing encounter movement grammar: ${pattern}`);
expect(director.includes('NOVELTY_ROTATION') && director.includes('variedSituationFor'), 'run-level situation novelty budget is missing');
expect(director.includes('usedPatterns') && director.includes('encounterPatternFor'), 'within-room encounter novelty budget is missing');

expect(game.includes('ATLAS_LENGTH = 1000'), '1,000-world run milestone is missing');
expect(game.includes('state.worldDepth % 10 === 0'), 'guardian cadence must be every tenth world');
expect(game.includes('window.MosslightExpedition?.newRun?.()'), 'run must request new unseen Atlas batches after each ten-world sector');
expect(game.includes('state.worldsCleared % ATLAS_LENGTH === 0'), 'world 1000 milestone is missing');
expect(game.includes('deep loop'), 'run must continue after the first complete Atlas');
expect(game.includes('deriveStoneQuota') && game.includes('awardStone') && game.includes('canOpenPortal'), 'Mossglint charge economy is incomplete');
expect(game.includes('roomSolved() && bossDefeated()') && game.includes('state.stones >= state.stoneQuota'), 'portal must require solved puzzles, guardian clearance, and Mossglint quota');
expect(game.includes('advanceWorld') && game.includes('state.portal.open'), 'one-way portal transition is incomplete');
expect(game.includes('spawnBoss') && game.includes('defeatBoss') && game.includes('awardBossStones'), 'guardian boss/reward loop is incomplete');
expect(game.includes('spawnEnemies') && game.includes('updateEnemies') && game.includes("enemy.pattern === 'dash'") && game.includes("enemy.pattern === 'stalk'"), 'hostile encounter combat is incomplete');
expect(game.includes('updateSituation') && game.includes('spawnSituationSweep') && game.includes('updateObstacles'), 'arena choreography is incomplete');
expect(game.includes('globalPressure') && game.includes('Math.log2'), 'difficulty must continue scaling globally rather than reset every ten rooms');
expect(game.includes('score') && game.includes('speedBonus') && game.includes('BEST_KEY'), 'speed/skill scoring and local best tracking are incomplete');
expect(game.includes('DEFAULT_BINDINGS') && game.includes('beginCapture') && game.includes('saveSettings'), 'control remapping persistence is incomplete');
expect(game.includes('class MosslightMusic') && game.includes('this.bpm()') && game.includes('setWorld'), 'custom reactive procedural music engine is missing');
expect(game.includes("version: '0.4.0'"), 'playtest API version must be v0.4.0');
expect(game.includes('function aimVector') && game.includes('aimSource = \'keyboard\'') && game.includes('aimSource = \'mouse\''), 'mouse + keyboard aim arbitration is missing');
expect(game.includes('spec.cooldown / state.relics.fireRate') && game.includes('spec.radius * state.relics.projectileScale'), 'firing powerups must affect gameplay');
expect(game.includes('state.relics.spread') && game.includes('state.relics.pierce'), 'spread/piercing builds are missing');
expect(portalStyles.includes('.bindingGrid') && portalStyles.includes('.storyRule') && portalStyles.includes('.milestone'), 'v0.4 menu/control/milestone styling is incomplete');

for (const [name, source] of [['rooms.js', rooms], ['expedition.js', expedition], ['director.js', director], ['game-v4.js', game]]) {
  try { new Function(source); } catch (error) { errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`); }
}

if (errors.length) {
  console.error(`Mosslight validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Mosslight PASS: v0.4 one-way Mossglint portal run, ${roomTitles.length} mechanic templates, 1,000-world milestone, every-10th-world guardians, remappable controls, reactive procedural music, global difficulty, and Atlas continuation.`);
