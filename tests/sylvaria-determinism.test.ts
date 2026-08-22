import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const authoritative = [
  'public/game-runtimes/mosslight-v2/v091/model.js',
  'public/game-runtimes/mosslight-v2/v091/world.js',
  'public/game-runtimes/mosslight-v2/v091/movement.js',
  'public/game-runtimes/mosslight-v2/v091/battle-core.js',
  'public/game-runtimes/mosslight-v2/v091/synergy-v010.js',
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

test('authoritative Sylvaria sources contain no obvious nondeterministic browser APIs', () => {
  for (const path of authoritative) {
    const source = readFileSync(join(process.cwd(), path), 'utf8');
    for (const [pattern, label] of forbidden) {
      assert.doesNotMatch(source, pattern, `${path} contains ${label}`);
    }
  }
});

test('authoritative Sylvaria RNG state is explicit and simulation-owned', () => {
  const source = authoritative.map((path) => readFileSync(join(process.cwd(), path), 'utf8')).join('\n');
  assert.match(source, /rngState/, 'authoritative state should carry explicit RNG state');
  assert.match(source, /seed/i, 'authoritative source should expose seeded generation');
});

test('determinism audit remains scoped to simulation sources, not presentation', () => {
  assert.equal(authoritative.some((path) => path.endsWith('/render.js')), false);
  assert.equal(authoritative.some((path) => path.endsWith('/boot.js')), false);
  assert.equal(authoritative.some((path) => path.includes('/v011/replay-v011.js')), false);
});
