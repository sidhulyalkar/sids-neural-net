import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const rooms = fs.readFileSync(`${root}/rooms.js`, 'utf8');
const expedition = fs.readFileSync(`${root}/expedition.js`, 'utf8');
const director = fs.readFileSync(`${root}/director.js`, 'utf8');
const preflight = fs.readFileSync(`${root}/arena-preflight.js`, 'utf8');
const game = fs.readFileSync(`${root}/game-v5.js`, 'utf8');
const renderScale = fs.readFileSync(`${root}/render-scale-v7.js`, 'utf8');
const renderOptimizer = fs.readFileSync(`${root}/render-optimizer-v6.js`, 'utf8');
const visualSystem = fs.readFileSync(`${root}/visual-system-v7.js`, 'utf8');
const portalStyles = fs.readFileSync(`${root}/portal-v4.css`, 'utf8');
const sylvariaStyles = fs.readFileSync(`${root}/sylvaria-v5.css`, 'utf8');
const adaptiveStyles = fs.readFileSync(`${root}/sylvaria-v6.css`, 'utf8');
const immersiveStyles = fs.readFileSync(`${root}/sylvaria-v7.css`, 'utf8');
const atlasRoute = fs.readFileSync('app/game-runtimes/mosslight-atlas/route.ts', 'utf8');
const arcadeGames = fs.readFileSync('src/data/arcadeGames.ts', 'utf8');
const visualDoc = fs.readFileSync('docs/SYLVARIA_V07_IMMERSION_SYSTEM.md', 'utf8');
const playSpace = fs.readFileSync('components/arcade/ArcadePlaySpace.tsx', 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(html.includes('<canvas id="c"'), 'runtime must expose the game canvas');
expect(html.includes('viewport-fit=cover'), 'runtime must opt into safe-area aware full-device rendering');
expect(html.includes('Sylvaria: Mossglint Run'), 'Sylvaria title is missing');
expect(html.includes('./game-v5.js') && !html.includes('./game-v4.js'), 'production shell must keep the validated gameplay core');
expect(html.includes('./sylvaria-v5.css') && html.includes('./sylvaria-v6.css') && html.includes('./sylvaria-v7.css'), 'Sylvaria style stack is incomplete');
expect(html.includes('./render-scale-v7.js') && html.includes('./render-optimizer-v6.js') && html.includes('./visual-system-v7.js'), 'v0.7 render layers are missing');
expect(!html.includes('./visual-system-v6.js'), 'v0.6 and v0.7 visual loops must not run simultaneously');
expect(html.indexOf('./director.js') < html.indexOf('./arena-preflight.js'), 'arena preflight must run after Director');
expect(html.indexOf('./arena-preflight.js') < html.indexOf('./render-scale-v7.js'), 'display scaling must run after arena content preparation');
expect(html.indexOf('./render-scale-v7.js') < html.indexOf('./render-optimizer-v6.js'), 'high-DPI Canvas scaling must initialize before optimizer patches');
expect(html.indexOf('./render-optimizer-v6.js') < html.indexOf('./game-v5.js'), 'render optimizer must initialize before gameplay');
expect(html.indexOf('./game-v5.js') < html.indexOf('./visual-system-v7.js'), 'immersive visuals must observe the initialized gameplay snapshot');
expect(html.includes('fire gate') && html.includes('extract') && html.includes('never look back'), 'one-way extraction story rule is missing');
expect(html.includes('start scored run') && html.includes('explorer run'), 'proper run menu modes are missing');
expect(html.includes('how to play') && html.includes('controls') && html.includes('options'), 'menu navigation is incomplete');
expect(html.includes('data-bind="portalFire"') && html.includes('data-bind="portalEnter"'), 'portal fire/entry controls must be separately remappable');
expect(html.includes('id="portalFireBtn"'), 'dedicated portal fire HUD button is missing');
expect(html.includes('musicToggle') && html.includes('sfxToggle') && html.includes('volume'), 'audio options are incomplete');
expect(html.includes('id="visualQuality"') && html.includes('id="qualityState"'), 'visual quality controls are missing');
expect(html.includes('id="biomeBadge"'), 'biome identity badge is missing from the HUD');
expect(arcadeGames.includes("title: 'Sylvaria'") && arcadeGames.includes("version: 'v0.7.0'"), 'Game Network must publish Sylvaria v0.7');
expect(arcadeGames.includes('immersive full-device living worlds'), 'Game Network description must reflect the immersion pass');

const roomTitles = ['Dew Garden','Orchard House','Rescue Hollow','River Workshop','Cloud Meadow','Emberstep','Pollinator Conservatory','Alpine Thaw','Tide Nursery','Earthheart'];
for (const title of roomTitles) expect(rooms.includes(`title: '${title}'`), `missing mechanic template: ${title}`);
for (const ability of ['rain','sun','seed','wind','mend','gather']) expect(game.includes(`${ability}:`) && game.includes(`name: '${ability[0].toUpperCase()}${ability.slice(1)}'`), `missing portal-gun resonance: ${ability}`);

expect(atlasRoute.includes('NATURE_WORLDS') && atlasRoute.includes('NATURE_WORLD_PALETTES'), 'Sylvaria atlas feed must derive from canonical Nature Atlas');
expect(atlasRoute.includes('scenes.length !== 1000'), 'Sylvaria atlas feed must enforce 1,000 scenes');
expect(atlasRoute.includes('collection: world.collection'), 'Atlas feed must expose canonical collection identity');
expect(atlasRoute.includes('atmosphere: world.scene.atmosphere') && atlasRoute.includes('renderCues: world.scene.renderCues'), 'Atlas feed must expose nested scene language');
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
expect(game.includes("portal.phase = 'firing'") && game.includes('portal.bolt') && game.includes('openExtractionPortal'), 'charged portal projectile and anchor impact are incomplete');
expect(game.includes("state.portal.phase = 'open'") && game.includes('state.portal.extractionAge'), 'extraction phase is incomplete');
expect(game.includes('attemptPortalEnter') && game.includes('reach the portal to commit'), 'portal traversal must require reaching the live gate');
expect(game.includes('spawnBoss') && game.includes('defeatBoss') && game.includes('awardBossStones'), 'guardian boss/reward loop is incomplete');
expect(game.includes('spawnEnemies') && game.includes('updateEnemies') && game.includes("enemy.pattern === 'dash'") && game.includes("enemy.pattern === 'stalk'"), 'hostile encounter combat is incomplete');
expect(game.includes('updateSituation') && game.includes('spawnSituationSweep') && game.includes('updateObstacles'), 'arena choreography is incomplete');
expect(game.includes('globalPressure') && game.includes('Math.log2'), 'difficulty must continue scaling globally rather than reset every ten rooms');
expect(game.includes('DEFAULT_BINDINGS') && game.includes('beginCapture') && game.includes('saveSettings'), 'control remapping persistence is incomplete');
expect(game.includes('class SylvariaMusic') && game.includes('this.bpm()') && game.includes('setWorld'), 'custom reactive procedural music engine is missing');
expect(game.includes("title: 'Sylvaria'"), 'gameplay core must identify Sylvaria');
expect(game.includes('function aimVector') && game.includes("aimSource = 'keyboard'") && game.includes("aimSource = 'mouse'"), 'mouse + keyboard aim arbitration is missing');
expect(game.includes('drawBiomeBackground') && game.includes('drawSprid') && game.includes('drawCreatureGlyph'), 'authoritative gameplay renderer is incomplete');
expect(portalStyles.includes('.bindingGrid') && portalStyles.includes('.storyRule') && portalStyles.includes('.milestone'), 'base menu/control styling is incomplete');
expect(sylvariaStyles.includes('#portalFireBtn.ready') && sylvariaStyles.includes('@keyframes portalButtonPulse'), 'portal charge button animation is missing');

expect(renderScale.includes('devicePixelRatio') && renderScale.includes('SylvariaDisplayScale'), 'high-DPI display scaler is missing');
expect(renderScale.includes('ctx.setTransform(scale'), 'high-DPI scaler must preserve logical gameplay coordinates');
expect(renderScale.includes('constrained') && renderScale.includes('deviceMemory') && renderScale.includes('hardwareConcurrency'), 'display scaling needs a constrained-device guard');

for (const theme of ['forest','volcanic','reef','ice','celestial']) expect(visualSystem.includes(`${theme}: {`), `missing v0.7 visual theme: ${theme}`);
for (const renderer of ['drawForestBackdrop','drawVolcanicBackdrop','drawReefBackdrop','drawIceBackdrop','drawCelestialBackdrop']) expect(visualSystem.includes(renderer), `missing immersive world renderer: ${renderer}`);
expect(visualSystem.includes("collection === 'celestial'") && visualSystem.includes('scene.renderCues'), 'celestial classification must use canonical nested Atlas metadata');
expect(visualSystem.includes('SPRID_RULES') && visualSystem.includes('WORLD_RULES'), 'v0.7 visual rules must be executable metadata');
expect(visualSystem.includes('sylWorldBackdrop') && visualSystem.includes('sylVisualOverlay'), 'full-device and playfield visual planes are missing');
expect(visualSystem.includes('drawAtmosphere') && visualSystem.includes('drawForeground'), 'dynamic atmosphere/parallax layers are missing');
expect(visualSystem.includes('detectReactions') && visualSystem.includes("'mossglint'") && visualSystem.includes("'portal'"), 'interactive environmental reaction grammar is missing');
expect(visualSystem.includes('drawEnemyFace') && visualSystem.includes('drawSpridHighlights'), 'character readability polish is missing');
expect(visualSystem.includes('installFullscreenControl') && visualSystem.includes('requestFullscreen'), 'runtime immersive fullscreen control is missing');
expect(visualSystem.includes("playtest.version = '0.7.0'") && visualSystem.includes('SylvariaVisualSystem'), 'runtime must expose the v0.7 visual system contract');
expect(renderOptimizer.includes('GradientRequest') && renderOptimizer.includes('gradientCache'), 'gradient reuse cache is missing');
expect(renderOptimizer.includes('shadowBlur') && renderOptimizer.includes('blurCap'), 'bounded glow budget is missing');
expect(renderOptimizer.includes('fps-downshift') && renderOptimizer.includes('fps-upshift'), 'Auto visual-quality governor is missing');
expect(adaptiveStyles.includes('--biome-accent') && adaptiveStyles.includes('prefers-contrast:more'), 'adaptive visual CSS is incomplete');
expect(immersiveStyles.includes('--syl-playfield-w') && immersiveStyles.includes('--syl-playfield-h'), 'aspect-safe playfield sizing is missing');
expect(immersiveStyles.includes('safe-area-inset-top') && immersiveStyles.includes('100svh'), 'mobile safe-area/full-device styling is missing');
expect(immersiveStyles.includes('#sylWorldBackdrop') && immersiveStyles.includes('data-syl-pseudo-fullscreen'), 'full-device world/pseudo-fullscreen CSS is incomplete');
expect(playSpace.includes('data-arcade-fullscreen') && playSpace.includes("requestFullscreen({ navigationUI: 'hide' })"), 'Game Network host fullscreen contract is incomplete');
expect(playSpace.includes("fullscreen ? 'hidden'"), 'Game Network fullscreen must remove portfolio chrome');
expect(visualDoc.includes('logical 960×640') && visualDoc.includes('High-DPI') && visualDoc.includes('Full-device'), 'v0.7 immersion document is incomplete');
expect(visualDoc.includes('Visual QA matrix') && visualDoc.includes('Performance budget'), 'v0.7 performance/QA contract is missing');

for (const [name, source] of [
  ['rooms.js', rooms], ['expedition.js', expedition], ['director.js', director], ['arena-preflight.js', preflight],
  ['render-scale-v7.js', renderScale], ['game-v5.js', game], ['render-optimizer-v6.js', renderOptimizer], ['visual-system-v7.js', visualSystem],
]) {
  try { new Function(source); } catch (error) { errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`); }
}

if (errors.length) {
  console.error(`Sylvaria validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Sylvaria PASS: v0.7 high-DPI aspect-safe immersion, five full-device world families, dynamic atmosphere/reactions, adaptive rendering, fullscreen chamber, explicit Mossglint gate shot, ${roomTitles.length} mechanic templates, 1,000-world milestone, guardians, remappable controls, reactive music, and global difficulty.`);
