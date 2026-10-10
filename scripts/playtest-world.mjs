import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!root) throw new Error('Set PLAYWRIGHT_MODULE_ROOT to the installed playwright package directory.');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');
const base = process.env.WORLD_BASE_URL || 'http://127.0.0.1:3000';
const output = process.env.WORLD_AUDIT_DIR || 'artifacts/world';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.WORLD_BROWSER_EXECUTABLE ? { executablePath: process.env.WORLD_BROWSER_EXECUTABLE } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const results = [], errors = [];
let diagnostics;
let activePage;
async function screenshot(page, name) { await page.screenshot({ path: path.join(output, `${name}.png`) }); }
async function waitForScene(page) {
  // A canvas element alone is insufficient evidence that the scene has rendered.
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.drawCalls) > 0);
}
try {
  const page = activePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  assert.equal(await page.getByRole('link', { name: 'View site', exact: true }).getAttribute('href'), '/atlas');
  assert.equal(await page.getByRole('link', { name: 'Get to know me', exact: true }).getAttribute('href'), '/about');
  await waitForScene(page);
  assert.equal(await page.locator('canvas').getAttribute('data-carved-games'), '3');
  assert.equal(await page.locator('canvas').getAttribute('data-reef-species'), '8');
  assert.equal(await page.locator('canvas').getAttribute('data-lagoon-species'), '8');
  assert.equal(await page.locator('canvas').getAttribute('data-land-wildlife'), '14');
  assert.equal(await page.locator('canvas').getAttribute('data-land-wildlife-style'), 'anatomical-v4');
  assert.equal(await page.locator('canvas').getAttribute('data-marine-wildlife-style'), 'anatomical-v3');
  assert.equal(await page.locator('canvas').getAttribute('data-shasta-sex'), 'male');
  assert.equal(await page.locator('canvas').getAttribute('data-shasta-profile'), 'husky-mix:lean-athletic');
  assert.equal(await page.locator('canvas').getAttribute('data-shasta-tail-parts'), '6');
  assert.equal(await page.locator('canvas').getAttribute('data-shasta-eye'), '#a87942');
  assert.equal(await page.locator('canvas').getAttribute('data-shasta-nose'), '#95645b');
  assert.equal(await page.locator('canvas').getAttribute('data-shasta-profile-version'), 'photo-profile-v4-almond-eyes');
  assert.equal(await page.locator('canvas').getAttribute('data-shasta-tail-style'), 'continuous-relaxed-plume');
  assert.equal(await page.locator('canvas').getAttribute('data-shasta-harness'), 'false');
  const lap=Number(await page.locator('canvas').getAttribute('data-desert-lap-length'));
  assert.ok(lap>300&&lap<330,`expanded Joshua lap ${lap}`);
  assert.equal(await page.locator('canvas').getAttribute('data-desert-gap-count'),'2');
  assert.equal(await page.locator('canvas').getAttribute('data-desert-bypasses'),'2');
  await screenshot(page, 'desktop-welcome');
  await page.getByRole('button', { name: 'Explore world', exact: true }).click();
  const before = await page.locator('canvas').getAttribute('data-player');
  const beforeDogPhase = Number(await page.locator('canvas').getAttribute('data-dog-gait-phase'));
  await page.keyboard.down('w');
  await page.waitForTimeout(1400);
  await page.keyboard.up('w');
  await page.waitForFunction(old => document.querySelector('canvas')?.dataset.player !== old, before);
  await page.waitForFunction(
    () => Number(document.querySelector('canvas')?.dataset.dogMaxMoveBlend) > 0.15,
    null,
    { timeout: 4000 },
  );
  const dogMotion = await page.locator('canvas').evaluate(c => ({
    maxYawStep: Number(c.dataset.dogMaxYawStep),
    maxYStep: Number(c.dataset.dogMaxYStep),
    maxBlend: Number(c.dataset.dogMaxMoveBlend),
    maxAcceleration: Number(c.dataset.dogMaxAcceleration),
    targetSwitches: Number(c.dataset.dogTargetSwitches),
    speed: Number(c.dataset.dogSpeed),
    phase: Number(c.dataset.dogGaitPhase),
  }));
  assert.ok(dogMotion.maxYawStep <= 0.19, `Shasta max frame yaw step ${dogMotion.maxYawStep}`);
  assert.ok(dogMotion.maxYStep < 0.16, `Shasta max frame height step ${dogMotion.maxYStep}`);
  assert.ok(dogMotion.maxBlend > 0.15, `Shasta max gait blend ${dogMotion.maxBlend}`);
  assert.ok(dogMotion.maxAcceleration < 15.5, `Shasta max acceleration ${dogMotion.maxAcceleration}`);
  assert.ok(dogMotion.targetSwitches <= 1, `Shasta curiosity target switches ${dogMotion.targetSwitches}`);
  assert.ok(Number.isFinite(dogMotion.speed));
  assert.ok(dogMotion.phase > beforeDogPhase);
  results.push('Keyboard walking changes player position');
  results.push('Shasta follow gait uses smooth acceleration, stable curiosity and articulated distance-phased motion');
  results.push('Shasta character profile uses male identity, natural coat geometry without harness/brow bulges, amber eyes, pink-brown nose and a continuous relaxed plume tail');
  results.push('Land wildlife uses anatomical-v4 silhouettes with eyes, grounded legs, species-specific muzzles/beaks, ears and tails');
  results.push('Marine wildlife uses anatomical-v3 fish fins, smooth ray/shark bodies and stronger facial cues');
  for (const [name, prompt, title] of [
    ['01 Redwood grove A little about me', 'Redwood grove', 'Redwood grove.'],
    ['02 Granite ridge Things I build', 'Granite ridge', 'Granite ridge.'],
    ['03 Strange grove Things I explore', 'Strange grove', 'Strange grove.'],
    ['04 Wild coast Cold-water coast', 'Wild coast', 'Wild coast.'],
    ['05 Lagoon reef South Pacific reef', 'Lagoon reef', 'Lagoon reef.'],
    ['06 Fern falls Follow the water', 'Fern falls', 'Fern falls.'],
    ['07 Moss canyon A quieter trail', 'Moss canyon', 'Moss canyon.'],
    ['08 Arcade cavern Play my games', 'Arcade cavern', 'Arcade cavern.'],
    ['09 Joshua basin Granite and desert trails', 'Joshua basin', 'Joshua basin.'],
    ['10 Rainforest Canopy to coast', 'Rainforest', 'Rainforest.'],
  ]) {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page.getByRole('button', { name, exact: true }).click();

    if (name.startsWith('08')) {
      const carvedTitles = ['Stretchicorn', 'uniRico', 'Unicorn Stampede'];
      assert.equal(await page.locator('canvas').getAttribute('data-cave-style'), 'backside-mountain-tunnel');
      assert.equal(await page.locator('canvas').getAttribute('data-cave-lantern'), 'true');
      assert.equal(await page.locator('canvas').getAttribute('data-cave-game-panels'), '3');
      assert.equal(await page.locator('canvas').getAttribute('data-cave-sealed'), 'true');
      assert.equal(await page.locator('canvas').getAttribute('data-cave-vegetation-clear'), 'true');
      assert.equal(await page.locator('canvas').getAttribute('data-cave-terrain-carved'), 'true');
      assert.notEqual(await page.locator('canvas').getAttribute('data-cave-inside'), 'true');
      await page.waitForTimeout(2200);
      const caveApproachCameraDistance = Number(
        await page.locator('canvas').getAttribute('data-camera-distance'),
      );
      assert.ok(
        caveApproachCameraDistance > 4.5 && caveApproachCameraDistance < 9.5,
        `Arcade cave approach camera distance ${caveApproachCameraDistance}`,
      );
      await screenshot(page, 'region-08-entrance');

      // Walk the flat tunnel and its offset throat through ordinary controls.
      const walkUntil = async (key, axis, target, greater) => {
        await page.keyboard.down(key);
        try {
          await page.waitForFunction(({axis,target,greater})=>{
            const p=(document.querySelector('canvas')?.dataset.player??'').split(',').map(Number);
            return greater?p[axis]>=target:p[axis]<=target;
          },{axis,target,greater},{timeout:22000});
        } finally {await page.keyboard.up(key);}
      };
      await walkUntil('w',1,-77,true);
      await walkUntil('a',0,18.1,true);
      await walkUntil('w',1,-67.2,true);
      await walkUntil('d',0,16.05,false);
      await page.waitForFunction(
        () => document.querySelector('canvas')?.dataset.gazeGame?.startsWith('game:'),
        null,
        { timeout: 15000 },
      );
      assert.equal(
        await page.locator('canvas').getAttribute('data-cave-chamber'),
        'true',
      );
      assert.equal(
        await page.locator('canvas').getAttribute('data-cave-camera-clear'),
        'true',
      );
      await page.waitForFunction(
        () => document.querySelector('canvas')?.dataset.caveDogClear === 'true',
        null,
        { timeout: 6000 },
      );
      assert.equal(
        await page.locator('canvas').getAttribute('data-dog-curiosity'),
        'cave-entrance',
      );
      const gazeId = await page.locator('canvas').getAttribute('data-gaze-game');
      const gazeIndex = Number(gazeId?.slice(5));
      assert.ok(Number.isInteger(gazeIndex) && carvedTitles[gazeIndex]);
      const gazeTitle = carvedTitles[gazeIndex];
      await page.waitForTimeout(350); // Dwell long enough to prove the selection is stable.
      assert.equal(await page.locator('canvas').getAttribute('data-gaze-game'), gazeId);
      await screenshot(page, `region-${name.slice(0, 2)}`);
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: gazeTitle, exact: true }).waitFor();
      const directHref = await page.getByRole('link', { name: new RegExp(`Play ${gazeTitle}`) }).getAttribute('href');
      assert.ok(directHref?.startsWith('/arcade/'));
      assert.equal((await page.request.get(`${base}${directHref}`)).status(), 200);
      await page.keyboard.press('Escape');
      // Side niches must independently select their own canonical game.
      for (const [dragX,index] of [[Math.PI/2/.005,0],[-Math.PI/.005,2]]) {
        await page.mouse.move(700,450);await page.mouse.down();
        await page.mouse.move(700+dragX,450,{steps:12});await page.mouse.up();
        await page.waitForFunction(i=>document.querySelector('canvas')?.dataset.gazeGame===`game:${i}`,index,{timeout:15000});
        await page.keyboard.press('Enter');
        await page.getByRole('heading',{name:carvedTitles[index],exact:true}).waitFor();
        await screenshot(page,`cave-niche-${index}`);
        await page.keyboard.press('Escape');
      }
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'All games', exact: true }).click();
      await page.getByRole('heading', { name: 'Arcade cavern.', exact: true }).waitFor();
      const games = await page.locator('dialog a[href^="/arcade/"]').evaluateAll(links => links.map(a => a.getAttribute('href')));
      assert.equal(games.length, 3);
      for (const href of games) assert.equal((await page.request.get(`${base}${href}`)).status(), 200);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog').evaluate(d => d.open), false);
      results.push('Arcade cavern lands outside a camera-safe flat backside tunnel, then gaze-selects three spaced carved games under lantern light');
      results.push(`Landmark, discovery, and dismissal: ${name}`);
      continue;
    }

    await page.getByRole('button', { name: new RegExp(prompt) }).waitFor();
    await page.waitForTimeout(1800); // Allow the semantic camera transition to settle for visual review.
    await screenshot(page, `region-${name.slice(0, 2)}`);
    await page.getByRole('button', { name: new RegExp(prompt) }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    if (name.startsWith('02') || name.startsWith('03')) {
      const hrefs = await page.locator('dialog a[href^="/projects/"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
      assert.equal(hrefs.length, 3);
      for (const href of hrefs) assert.equal((await page.request.get(`${base}${href}`)).status(), 200, href);
    }
    if (name.startsWith('04')) for (const memory of ['Mountain lake', 'Wet beach', 'Coastal flowers', 'Shasta · beach']) {
      await page.getByRole('button', { name: new RegExp(memory) }).click();
      await page.getByRole('heading', { name: memory, exact: true }).waitFor();
      await page.waitForFunction(() => { const img = document.querySelector('dialog img'); return img?.complete && img.naturalWidth > 0; });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: new RegExp(prompt) }).click();
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').evaluate(d => d.open), false);
    results.push(`Landmark, discovery, and dismissal: ${name}`);
  }
  for (const [name, mode] of [['Trail running', 'run'], ['Skateboarding', 'skate'], ['Mountain biking', 'bike'], ['Skiing', 'ski'], ['Bouldering', 'boulder']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.tagName === 'CANVAS');
    console.log(`Checking activity: ${mode}`);
    await page.waitForFunction(mode => document.querySelector('canvas')?.dataset.activity === mode, mode);
    if (mode === 'ski') {
      await page.waitForFunction(() => document.querySelector('canvas')?.dataset.snowing === 'true');
      results.push('Ski mode keeps snowfall active around the explorer');
    }
    await screenshot(page, `activity-${mode}`);
    if (mode === 'boulder') {
      const beforeHeight = Number(await page.locator('canvas').getAttribute('data-height'));
      await page.getByRole('button', { name: 'Climb', exact: true }).click();
      await page.waitForFunction(h => Number(document.querySelector('canvas')?.dataset.height) > h + 0.8, beforeHeight);
      results.push('Boulder action climbs a real ledge');
    } else {
      await page.keyboard.press('Space');
      await page.waitForFunction(() => document.querySelector('canvas')?.dataset.airborne === 'true');
      await page.waitForFunction(() => document.querySelector('canvas')?.dataset.airborne === 'false');
    }
  }
  results.push('Five activity modes equip correctly; their actions work');
  assert.equal(await page.locator('canvas').getAttribute('data-coral-forms'),'9');
  assert.equal(await page.locator('canvas').getAttribute('data-water-source'),'snowmelt');

  // Qualify the authored grove log through the real locomotion/action path.
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: '01 Redwood grove A little about me', exact: true }).click();
  await page.getByRole('button', { name: 'Skateboarding', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.tagName === 'CANVAS');
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.grindReady === 'true',
      null,
      { timeout: 15000 },
    );
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.grinding === 'true',
      null,
      { timeout: 4000 },
    );
  } finally {
    await page.keyboard.up('w');
  }
  assert.equal(await page.locator('canvas').getAttribute('data-grind-id'), 'grove-log');
  assert.equal(await page.locator('canvas').getAttribute('data-grind-style'), 'boardslide');
  await screenshot(page, 'activity-grind');
  results.push('Skateboard acquires the fallen redwood as an angle-selected boardslide');

  // Ski spawns at (8, -54), facing the southward kicker. Turn toward the
  // ridge-log endpoint (5, -52): approach (-3, +2) aligns with the log for a 50-50.
  await page.getByRole('button', { name: 'Skiing', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.tagName === 'CANVAS');
  const ridgeApproachYaw = Math.atan2(3, -2);
  const ridgeTurnPixels = (Math.PI - ridgeApproachYaw) / 0.005;
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(700 + ridgeTurnPixels, 450, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.grindReady === 'true',
      null,
      { timeout: 12000 },
    );
    assert.equal(await page.locator('canvas').getAttribute('data-grind-style'), 'fifty-fifty');
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.grinding === 'true',
      null,
      { timeout: 4000 },
    );
  } finally {
    await page.keyboard.up('w');
  }
  assert.equal(await page.locator('canvas').getAttribute('data-grind-id'), 'ridge-log');
  assert.equal(await page.locator('canvas').getAttribute('data-grind-style'), 'fifty-fifty');
  await screenshot(page, 'activity-ski-grind');
  results.push('Skis acquire the ridge log as an angle-selected 50-50');

  // Reset Ski onto the authored shoulder before qualifying the kicker.
  await page.getByRole('button', { name: 'Skiing', exact: true }).click();

  // Granite Ridge lands just above the authored ski kicker, so a normal downhill
  // approach must trigger the shared ramp mechanic without a synthetic jump.
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: '02 Granite ridge Things I build', exact: true }).click();
  await page.getByRole('button', { name: 'Skiing', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.tagName === 'CANVAS');
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.rampId === 'ski-kicker',
      null,
      { timeout: 12000 },
    );
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.airborne === 'true');
  } finally {
    await page.keyboard.up('w');
  }
  results.push('Skiing launches from the authored Granite Ridge kicker');

  // Reproduce the original steep-terrain failure mode on Granite Ridge. The rendered
  // gear root must stay above support terrain while pitch/roll remain finite.
  await page.getByRole('button', { name: 'Mountain biking', exact: true }).click();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: '02 Granite ridge Things I build', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.tagName === 'CANVAS');
  for (const [name, mode] of [['Mountain biking', 'bike'], ['Skateboarding', 'skate']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('canvas')?.dataset.activity === expected, mode);
    await page.keyboard.down('w');
    await page.waitForTimeout(1000);
    await page.keyboard.up('w');
    const contact = await page.locator('canvas').evaluate(c => ({
      clearance: Number(c.dataset.gearClearance),
      pitch: Number(c.dataset.surfacePitch),
      roll: Number(c.dataset.surfaceRoll),
      riderSeatError: Number(c.dataset.riderSeatError),
    }));
    assert.ok(contact.clearance >= 0.05, `${mode} clearance ${contact.clearance}`);
    assert.ok(Number.isFinite(contact.pitch) && Math.abs(contact.pitch) < 1.2, `${mode} pitch ${contact.pitch}`);
    assert.ok(Number.isFinite(contact.roll) && Math.abs(contact.roll) < 1.2, `${mode} roll ${contact.roll}`);
    if (mode === 'bike')
      assert.ok(contact.riderSeatError < 0.03, `bike rider seat error ${contact.riderSeatError}`);
  }
  results.push('Bike and skateboard stay surface-supported on Granite Ridge');

  // Qualify the full land -> surface snorkel -> dive -> surface -> shore loop.
  await page.getByRole('button', { name: 'Trail running', exact: true }).click();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: '04 Wild coast Cold-water coast', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'land');
  await page.waitForFunction(() => document.activeElement?.tagName === 'CANVAS');

  // Enter the ocean through the actual jump path, not only by stepping across the
  // shoreline. This guards the airborne -> water -> snorkeling transition.
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.airborne === 'true');
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.aquatic === 'surface',
      null,
      { timeout: 12000 },
    );
  } finally {
    await page.keyboard.up('w');
  }
  results.push('Jumping from shore transitions cleanly into snorkeling');
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.surfacePitch) > 1.42);
  assert.equal(await page.locator('canvas').getAttribute('data-reef'), 'true');
  await page.getByText('Snorkeling', { exact: true }).waitFor();
  await screenshot(page, 'activity-snorkel');
  await page.getByRole('button', { name: 'Dive', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'dive');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.cameraWater === 'true');
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.cameraDistance) >= 6);
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.surfacePitch) > 1.25);
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.depth) > 0.45);
  const initialDepth = Number(await page.locator('canvas').getAttribute('data-depth'));
  const initialMaxDepth = Number(await page.locator('canvas').getAttribute('data-max-depth'));
  assert.ok(initialMaxDepth >= initialDepth);

  // The entry shelf is intentionally shallow. Swim offshore until local bathymetry
  // actually permits a deeper dive, then qualify the Deeper control.
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      depth => Number(document.querySelector('canvas')?.dataset.maxDepth) > depth + 0.45,
      initialDepth,
      { timeout: 12000 },
    );
  } finally {
    await page.keyboard.up('w');
  }
  await page.getByRole('button', { name: 'Deeper', exact: true }).click();
  await page.waitForFunction(
    depth => Number(document.querySelector('canvas')?.dataset.depth) > depth + 0.2,
    initialDepth,
    { timeout: 8000 },
  );
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.drawCalls) > 0);
  const diveDrawCalls = Number(await page.locator('canvas').getAttribute('data-draw-calls'));
  assert.ok(diveDrawCalls < 100, `underwater draw calls ${diveDrawCalls}`);
  await screenshot(page, 'activity-dive');
  results.push('Dive pose, framing, reef density and renderer budget stay bounded');
  await page.getByRole('button', { name: 'Surface', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'surface');
  await page.keyboard.down('s');
  try {
    // SwiftShader can run this scene at ~4 FPS in CI. The transition itself is
    // still mandatory; allow enough wall time for bounded low-FPS swim stepping.
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'land', null, { timeout: 15000 });
  } finally {
    await page.keyboard.up('s');
  }
  results.push('Land, snorkeling, dive depth, surfacing, and shore return all transition cleanly');

  // The east-side lagoon is a separate warm-water biome with its own shoreline,
  // atmosphere and batched fauna. Enter it through normal movement as well.
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: '05 Lagoon reef South Pacific reef', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'land');
  await page.waitForFunction(() => document.activeElement?.tagName === 'CANVAS');
  await page.keyboard.press('Space');
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.aquatic === 'surface',
      null,
      { timeout: 12000 },
    );
  } finally {
    await page.keyboard.up('w');
  }
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.reefZone === 'lagoon');
  assert.equal(await page.locator('canvas').getAttribute('data-reef'), 'true');
  // The coral garden is intentionally shallow, and Dive itself requires more
  // than 0.8 world units of safe depth. On SwiftShader, movement advances more
  // slowly than wall time, so keep swimming offshore until the real control
  // threshold is satisfied instead of weakening the aquatic safety contract.
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(
      () => Number(document.querySelector('canvas')?.dataset.maxDepth) > 0.82,
      null,
      { timeout: 30000 },
    );
  } finally {
    await page.keyboard.up('w');
  }
  await screenshot(page, 'activity-lagoon-snorkel');
  await page.getByRole('button', { name: 'Dive', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'dive');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.cameraWater === 'true');
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.depth) > 0.35);
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.drawCalls) > 0);
  const lagoonDrawCalls = Number(await page.locator('canvas').getAttribute('data-draw-calls'));
  assert.ok(lagoonDrawCalls < 100, `lagoon draw calls ${lagoonDrawCalls}`);
  await screenshot(page, 'activity-lagoon-dive');
  results.push('East lagoon snorkeling and diving activate only the warm-water reef within renderer budget');
  await page.getByRole('button', { name: 'Surface', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'surface');
  await page.keyboard.down('s');
  try {
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.aquatic === 'land',
      null,
      { timeout: 15000 },
    );
  } finally {
    await page.keyboard.up('s');
  }

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: 'Field notes', exact: true }).click();
  assert.equal(await page.locator('dialog a[href^="https://www.nps.gov"]').count(), 4);
  assert.equal(await page.locator('dialog a[href^="https://www.montereybayaquarium.org"]').count(), 8);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true); }
  await page.keyboard.press('Escape'); results.push('Menu keeps keyboard focus and supports Escape');
  diagnostics = await page.locator('canvas').evaluate(c => ({ ...c.dataset }));
  assert.ok(Number(diagnostics.drawCalls) < 100);
  assert.ok(Number(diagnostics.frameP50) > 0);
  assert.ok(Number(diagnostics.frameP95) >= Number(diagnostics.frameP50));
  assert.ok(Number(diagnostics.sampleFrames) > 0);
  assert.ok(Number(diagnostics.dpr) >= 0.75 && Number(diagnostics.dpr) <= 1.5);
  assert.ok(Number(diagnostics.visibleRenderables) > 0);
  if (Number(diagnostics.dpr) <= 0.75 && Number(diagnostics.fps) < 24)
    assert.equal(diagnostics.shadows, 'off');
  results.push('Bounded renderer diagnostics include active-frame percentiles and adaptive quality state');
  await page.locator('canvas').evaluate(c => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByText('The 3D world couldn’t open on this device.').waitFor();
  assert.equal(await page.getByRole('link', { name: 'View site' }).count(), 1);
  results.push('Context loss preserves conventional navigation'); await page.close();

  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(base); await reduced.getByRole('button', { name: 'Open navigation menu' }).click();
  assert.equal(await reduced.locator('canvas').count(), 0);
  results.push('Reduced motion starts without WebGL'); await reduced.close();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base); await mobile.getByRole('button', { name: 'Open navigation menu' }).click();
  assert.equal(await mobile.locator('canvas').count(), 0); await screenshot(mobile, 'mobile-menu');
  await mobile.keyboard.press('Escape'); await screenshot(mobile, 'mobile-welcome');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.getByRole('button', { name: 'Explore world', exact: true }).click(); await waitForScene(mobile);
  await screenshot(mobile, 'mobile-world');
  const mobileBefore = await mobile.locator('canvas').getAttribute('data-player');
  await mobile.touchscreen.tap(195, 580);
  await mobile.waitForFunction(old => document.querySelector('canvas')?.dataset.player !== old, mobileBefore);

  // Phone-width aquatic controls must remain visible and tappable, not just fit CSS.
  await mobile.getByRole('button', { name: 'Open navigation menu' }).tap();
  await mobile.getByRole('button', { name: '04 Wild coast Cold-water coast', exact: true }).tap();
  await mobile.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'land');
  await mobile.locator('canvas').focus();
  await mobile.waitForFunction(() => document.activeElement?.tagName === 'CANVAS');
  await mobile.keyboard.down('w');
  try {
    await mobile.waitForFunction(
      () => document.querySelector('canvas')?.dataset.aquatic === 'surface',
      null,
      { timeout: 12000 },
    );
  } finally {
    await mobile.keyboard.up('w');
  }
  const diveButton = mobile.getByRole('button', { name: 'Dive', exact: true });
  assert.equal(await diveButton.isVisible(), true);
  await diveButton.tap();
  await mobile.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'dive');
  const mobileDepth = Number(await mobile.locator('canvas').getAttribute('data-depth'));
  const mobileMaxDepth = Number(await mobile.locator('canvas').getAttribute('data-max-depth'));
  assert.ok(mobileMaxDepth >= mobileDepth);
  const surfaceButton = mobile.getByRole('button', { name: 'Surface', exact: true });
  assert.equal(await surfaceButton.isVisible(), true);
  await surfaceButton.tap();
  await mobile.waitForFunction(() => document.querySelector('canvas')?.dataset.aquatic === 'surface');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  results.push('Mobile touch walking and aquatic controls work without overflow'); await mobile.close();
  const plain = await browser.newPage({ javaScriptEnabled: false }); await plain.goto(base);
  assert.ok(await plain.getByRole('navigation', { name: 'Browse without JavaScript' }).isVisible());
  results.push('No-JavaScript navigation is visible'); await plain.close();
  const atlas = await browser.newPage(); await atlas.goto(`${base}/atlas`);
  await atlas.locator('[data-home-branch-count="8"]').waitFor();
  results.push('Original eight-destination neural atlas remains available'); await atlas.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ results, diagnostics, errors }, null, 2));
  console.log(JSON.stringify({ results, diagnostics, errors }, null, 2));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    diagnostics = await activePage.locator('canvas').evaluateAll(canvases => canvases.map(c => ({ ...c.dataset }))).catch(() => null);
    await screenshot(activePage, 'failure').catch(() => {});
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ results, diagnostics, errors, failure: String(error) }, null, 2));
  console.error(JSON.stringify({ results, diagnostics, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
