import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const director = read('public/game-runtimes/sylvaria-sequoia/02-canopy-director.js');
const progression = read('public/game-runtimes/sylvaria-sequoia/02-canopy-progression.js');
const authority = read('public/game-runtimes/sylvaria-sequoia/02-sap-authority-v2.js');
const recap = read('public/game-runtimes/sylvaria-sequoia/03-run-recap-hud.js');
const index = read('public/game-runtimes/sylvaria-sequoia/index.html');
const heartwoodBrowser = read('scripts/playtest-sylvaria-heartwood.mjs');

test('Sylvaria v0.6.1 pacing director creates deterministic mastery arcs without adaptive geometry', () => {
  assert.match(director, /canopy-director-v1/);
  assert.match(director, /const CROWN_CYCLE = 25/);
  assert.match(director, /BREATHE[\s\S]*BUILD[\s\S]*TEST[\s\S]*CROWN/);
  assert.match(director, /STORM CANOPY[\s\S]*floor: 132/);
  assert.match(director, /REDWOOD RUN[\s\S]*FLOW[\s\S]*GROVE[\s\S]*WINDLINE[\s\S]*RECOVERY/);
  assert.match(director, /SAPWORK[\s\S]*SAPRUN[\s\S]*BREAKAWAY/);
  assert.match(director, /HIGH CANOPY[\s\S]*PENDULUM/);
  assert.match(director, /STORM CANOPY[\s\S]*CONEFALL/);
  assert.match(director, /CROWNLINE[\s\S]*THUNDERCROWN/);
  assert.match(director, /CATCH_GRACE_SECONDS = 2\.35/);
  assert.match(director, /sapCatches/);
  assert.match(director, /ownsRouteChoreography: true/);
  assert.doesNotMatch(director, /routeRng\.next|Math\.random/, 'director must not perturb seeded route generation');
});

test('Crown cadence now records skill splits and the death screen points directly at the next mastery target', () => {
  assert.match(progression, /const CROWN_INTERVAL = 25/);
  assert.match(progression, /crown-splits-v2/);
  assert.match(progression, /sylvaria\.sequoia\.crownSplits\.v1/);
  assert.match(progression, /crown-split/);
  assert.match(progression, /runFloorGain/);
  assert.match(progression, /nextSplitBestSeconds/);
  assert.match(recap, /run-recap-v1/);
  assert.match(recap, /NEW HEIGHT/);
  assert.match(recap, /NEXT CONTRACT/);
  assert.match(recap, /SPACE NEW RUN · 0 SAME SEED · B SHOP/);
});

test('Sap recharge requires a held physical landing and no branch graze can advance anchor authority', () => {
  assert.match(authority, /MIN_GROUNDED_REARM_SECONDS = 0\.035/);
  assert.match(authority, /if \(player\.groundedTime < MIN_GROUNDED_REARM_SECONDS\) return;/);
  const holdGate = authority.indexOf('if (player.groundedTime < MIN_GROUNDED_REARM_SECONDS) return;');
  const floorAdvance = authority.indexOf('if (floor > highestPhysicalFloor) highestPhysicalFloor = floor;');
  assert.ok(holdGate >= 0 && floorAdvance > holdGate, 'physical-floor authority advanced before the held-landing gate');
  assert.match(authority, /minimumGroundedRearmSeconds: MIN_GROUNDED_REARM_SECONDS/);
});

test('runtime load order gives the director final pacing authority and keeps the recap outside gameplay input', () => {
  assert.match(index, /02-canopy-economy\.js[\s\S]*02-canopy-director\.js[\s\S]*02-sap-authority-v2\.js/);
  assert.match(index, /03-economy-input-guard\.js[\s\S]*03-run-recap-hud\.js[\s\S]*04-input\.js/);
});

test('Heartwood browser qualification waits for behavior rather than fixed browser timing', () => {
  assert.match(heartwoodBrowser, /async function runtimeFrame/);
  assert.match(heartwoodBrowser, /async function waitUntil/);
  assert.match(heartwoodBrowser, /Heartseed pickup/);
  assert.match(heartwoodBrowser, /Conefall spawn/);
  assert.match(heartwoodBrowser, /counters\.conesSpawned/);
  assert.match(heartwoodBrowser, /Pendulum motion/);
  assert.match(heartwoodBrowser, /Breakaway removal/);
  assert.match(heartwoodBrowser, /Living Crown awakening/);
  assert.doesNotMatch(heartwoodBrowser, /setTimeout\(resolve,\s*55\)|setTimeout\(resolve,\s*40\)|setTimeout\(resolve,\s*45\)/);
});
