import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const rooms = fs.readFileSync(`${root}/rooms.js`, 'utf8');
const expedition = fs.readFileSync(`${root}/expedition.js`, 'utf8');
const director = fs.readFileSync(`${root}/director.js`, 'utf8');
const preflight = fs.readFileSync(`${root}/arena-preflight.js`, 'utf8');
const game = fs.readFileSync(`${root}/game-v5.js`, 'utf8');
const portalStyles = fs.readFileSync(`${root}/portal-v4.css`, 'utf8');
const sylvariaStyles = fs.readFileSync(`${root}/sylvaria-v5.css`, 'utf8');
const atlasRoute = fs.readFileSync('app/game-runtimes/mosslight-atlas/route.ts', 'utf8');
const arcadeGames = fs.readFileSync('src/data/arcadeGames.ts', 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(html.includes('<canvas id="c"'), 'runtime must expose the game canvas');
expect(html.includes('Sylvaria: Mossglint Run'), 'Sylvaria title is missing');
expect(html.includes('./game-v5.js') && !html.includes('./game-v4.js'), 'production shell must run Sylvaria v0.5 only');
expect(html.includes('./sylvaria-v5.css') && html.includes('./arena-preflight.js'), 'Sylvaria visual/preflight layers are missing');
expect(html.indexOf('./director.js') < html.indexOf('./arena-preflight.js') && html.indexOf('./arena-preflight.js') < html.indexOf('./game-v5.js'), 'arena preflight must run after Director and before gameplay');
expect(html.includes('fire gate') && html.includes('extract') && html.includes('never look back'), 'new one-way extraction story rule is missing');
expect(html.includes('start scored run') && html.includes('explorer run'), 'proper run menu modes are missing');
expect(html.includes('how to play') && html.includes('controls') && html.includes('options'), 'menu navigation is incomplete');
expect(html.includes('data-bind="portalFire"') && html.includes('data-bind="portalEnter"'), 'portal fire/entry controls must be separately remappable');
expect(html.includes('id="portalFireBtn"'), 'dedicated portal fire HUD button is missing');
expect(html.includes('musicToggle') && html.includes('sfxToggle') && html.includes('volume'), 'audio options are incomplete');
expect(html.includes('mossglint') && html.includes('portalState') && html.includes('integrity') && html.includes('bossState'), 'run HUD is missing portal-run state');
expect(arcadeGames.includes("title: 'Sylvaria'") && arcadeGames.includes("version: 'v0.5.0'"), 'Game Network must publish Sylvaria v0.5');

const roomTitles = ['Dew Garden','Orchard House','Rescue Hollow','River Workshop','Cloud Meadow','Emberstep','Pollinator Conservatory','Alpine Thaw','Tide Nursery','Earthheart'];
for (const title of roomTitles) expect(rooms.includes(`title: '${title}'`), `missing mechanic template: ${title}`);
for (const ability of ['rain','sun','seed','wind','mend','gather']) expect(game.includes(`${ability}:`) && game.includes(`name: '${ability[0].toUpperCase()}${ability.slice(1)}'`), `missing portal-gun resonance: ${ability}`);

expect(atlasRoute.includes('NATURE_WORLDS') && atlasRoute.includes('NATURE_WORLD_PALETTES'), 'Sylvaria atlas feed must derive from canonical Nature Atlas');
expect(atlasRoute.includes('scenes.length !== 1000'), 'Sylvaria atlas feed must enforce 1,000 scenes');
expect(expedition.includes("sid.mosslight.atlas-deck.v1") && expedition.includes('takeScenes'), 'persistent without-replacement Atlas deck is missing');
expect(expedition.includes('deck.cursor >= deck.order.length'), 'Atlas deck must cycle only after exhaustion');
expect(expedition.includes('adaptRoom') && expedition.includes('content.rooms.splice'), 'Atlas scenes must adapt the live room templates');

for (const powerup of ['rapid-bloom','giant-dew','prism-spores','river-echo','sunstep','moss-ward']) expect(director.includes(`id: '${powerup}'`), `missing world gift: ${powerup}`);
for (const pattern of ['patrol','weave','orbit','swoop','stalk','dash','spiral']) expect(director.includes(`'${pattern}'`), `missing encounter movement grammar: ${pattern}`);
expect(director.includes('NOVELTY_ROTATION') && director.includes('variedSituationFor'), 'run-level situation novelty budget is missing');
expect(director.includes('usedPatterns') && director.includes('encounterPatternFor'), 'within-room encounter novelty budget is missing');

expect(preflight.includes('SPAWN') && preflight.includes('PORTAL'), 'arena preflight must reserve spawn and exit pockets');
expect(preflight.includes('repairObstacle') && preflight.includes('repairPowerup') && preflight.includes('repairEncounter'), 'arena preflight must repair blocked geometry, gifts, and encounter starts');
expect(preflight.includes('MosslightArenaPreflight') && preflight.includes('expedition.newRun'), 'arena safety diagnostics must rerun for new Atlas sectors');

expect(game.includes('ATLAS_LENGTH = 1000'), '1,000-world run milestone is missing');
expect(game.includes('state.worldDepth % 10 === 0'), 'guardian cadence must be every tenth world');
expect(game.includes('window.MosslightExpedition?.newRun?.()'), 'run must request new unseen Atlas batches after each ten-world sector');
expect(game.includes('state.worldsCleared % ATLAS_LENGTH === 0'), 'world 1000 milestone is missing');
expect(game.includes('deep loop'), 'run must continue after the first complete Atlas');
expect(game.includes('deriveStoneQuota') && game.includes('awardStone') && game.includes('canChargePortal'), 'Mossglint charge economy is incomplete');
expect(game.includes("state.portal.phase = 'ready'") && game.includes('firePortalCharge') && game.includes("state.portal.phase = 'charging'"), 'portal must have an explicit ready-to-charge action');
expect(game.includes("state.portal.phase = 'firing'") && game.includes('portal.bolt') && game.includes('openExtractionPortal'), 'charged portal projectile and anchor impact are incomplete');
expect(game.includes("state.portal.phase = 'open'") && game.includes('state.portal.extractionAge'), 'extraction phase is incomplete');
expect(game.includes('attemptPortalEnter') && game.includes('reach the portal to commit'), 'portal traversal must require reaching the live gate');
expect(game.includes('spawnBoss') && game.includes('defeatBoss') && game.includes('awardBossStones'), 'guardian boss/reward loop is incomplete');
expect(game.includes('spawnEnemies') && game.includes('updateEnemies') && game.includes("enemy.pattern === 'dash'") && game.includes("enemy.pattern === 'stalk'"), 'hostile encounter combat is incomplete');
expect(game.includes('updateSituation') && game.includes('spawnSituationSweep') && game.includes('updateObstacles'), 'arena choreography is incomplete');
expect(game.includes('globalPressure') && game.includes('Math.log2'), 'difficulty must continue scaling globally rather than reset every ten rooms');
expect(game.includes('score') && game.includes('speedBonus') && game.includes('BEST_KEY'), 'speed/skill scoring and local best tracking are incomplete');
expect(game.includes('DEFAULT_BINDINGS') && game.includes('beginCapture') && game.includes('saveSettings'), 'control remapping persistence is incomplete');
expect(game.includes('class SylvariaMusic') && game.includes('this.bpm()') && game.includes('setWorld'), 'custom reactive procedural music engine is missing');
expect(game.includes("version: '0.5.0'") && game.includes("title: 'Sylvaria'"), 'playtest API must identify Sylvaria v0.5.0');
expect(game.includes('function aimVector') && game.includes("aimSource = 'keyboard'") && game.includes("aimSource = 'mouse'"), 'mouse + keyboard aim arbitration is missing');
expect(game.includes('spec.cooldown / state.relics.fireRate') && game.includes('spec.radius * state.relics.projectileScale'), 'firing powerups must affect gameplay');
expect(game.includes('state.relics.spread') && game.includes('state.relics.pierce'), 'spread/piercing builds are missing');
expect(game.includes('drawBiomeBackground') && game.includes('drawSprid') && game.includes('drawCreatureGlyph'), 'reference-driven visual rewrite is incomplete');
expect(game.includes("const colors = ['#9b5cff', '#52d9ff', '#79ff9a', '#6f73ff']"), 'neon purple/blue/green portal palette is missing');
expect(portalStyles.includes('.bindingGrid') && portalStyles.includes('.storyRule') && portalStyles.includes('.milestone'), 'base menu/control styling is incomplete');
expect(sylvariaStyles.includes('#portalFireBtn.ready') && sylvariaStyles.includes('@keyframes portalButtonPulse'), 'portal charge button animation is missing');

for (const [name, source] of [['rooms.js', rooms], ['expedition.js', expedition], ['director.js', director], ['arena-preflight.js', preflight], ['game-v5.js', game]]) {
  try { new Function(source); } catch (error) { errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`); }
}

if (errors.length) {
  console.error(`Sylvaria validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Sylvaria PASS: v0.5 explicit Mossglint gate shot, extraction phase, ${roomTitles.length} mechanic templates, 1,000-world milestone, every-10th-world guardians, procedural arena preflight, remappable controls, reactive music, visual biome renderer, global difficulty, and Atlas continuation.`);
