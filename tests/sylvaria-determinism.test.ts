import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const authoritative = [
  'public/game-runtimes/mosslight-v2/v091/model.js',
  'public/game-runtimes/mosslight-v2/v011/rooms-v011.js',
  'public/game-runtimes/mosslight-v2/v091/world.js',
  'public/game-runtimes/mosslight-v2/v091/movement.js',
  'public/game-runtimes/mosslight-v2/v091/battle-core.js',
  'public/game-runtimes/mosslight-v2/v091/synergy-v010.js',
  'public/game-runtimes/mosslight-v2/v013/kinetic-combat-v013.js',
  'public/game-runtimes/mosslight-v2/v013/enemy-ai-v013.js',
] as const;

const forbidden: Array<[RegExp, string]> = [
  [/\bMath\.random\s*\(/, 'unseeded Math.random'],
  [/\bDate\.now\s*\(/, 'wall-clock Date.now'],
  [/\bnew\s+Date\s*\(/, 'wall-clock Date construction'],
  [/\bperformance\.now\s*\(/, 'render/runtime clock performance.now'],
  [/\.localeCompare\s*\(/, 'locale-sensitive ordering'],
  [/\bIntl\s*\./, 'locale-sensitive Intl API'],
  [/\.sort\s*\(\s*\)/, 'comparator-free Array.sort'],
];

test('authoritative Sylvaria v0.13 sources contain no obvious nondeterministic browser APIs', () => {
  for (const path of authoritative) {
    const source = readFileSync(join(process.cwd(), path), 'utf8');
    for (const [pattern, label] of forbidden) {
      assert.doesNotMatch(source, pattern, `${path} contains ${label}`);
    }
  }
});

test('authoritative Sylvaria RNG state is explicit and simulation-owned across kinetic AI', () => {
  const source = authoritative.map((path) => readFileSync(join(process.cwd(), path), 'utf8')).join('\n');
  assert.match(source, /rngState/, 'authoritative state should carry explicit RNG state');
  assert.match(source, /seed/i, 'authoritative source should expose seeded generation');
  assert.match(source, /entityRand/);
  assert.match(source, /sylvaria-v013-roster/);
  assert.doesNotMatch(source, /Math\.random/);
});

test('v0.13 deterministic rounding is owned by the simulation rather than renderer interpolation', () => {
  const kinetics = readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v013/kinetic-combat-v013.js'), 'utf8');
  assert.match(kinetics, /Math\.round\(v\*100000\)\/100000/);
  assert.match(kinetics, /p\.x=q\(p\.x\);p\.y=q\(p\.y\);p\.vx=q\(p\.vx\);p\.vy=q\(p\.vy\)/);
});

test('determinism audit includes kinetics and AI but remains scoped away from presentation and browser replay', () => {
  assert.ok(authoritative.some((path) => path.endsWith('/kinetic-combat-v013.js')));
  assert.ok(authoritative.some((path) => path.endsWith('/enemy-ai-v013.js')));
  assert.equal(authoritative.some((path) => path.endsWith('/render.js')), false);
  assert.equal(authoritative.some((path) => path.endsWith('/boot.js')), false);
  assert.equal(authoritative.some((path) => path.includes('/v013/replay-v013.js')), false);
  assert.equal(authoritative.some((path) => path.includes('/kinetic-presentation-v013.js')), false);
});
