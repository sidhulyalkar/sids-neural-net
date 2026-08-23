import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { arcadeGames, getArcadeGame } from '../src/data/arcadeGames';

const root = process.cwd();
const stretchRoute = readFileSync(
  join(root, 'app/game-runtimes/stretchicorn/[...asset]/route.ts'),
  'utf8'
);
const uniricoRoute = readFileSync(
  join(root, 'app/game-runtimes/unirico/[...asset]/route.ts'),
  'utf8'
);
const runtimeGateway = readFileSync(
  join(root, 'lib/arcade/pinnedGithubRuntime.ts'),
  'utf8'
);
const arcadePage = readFileSync(join(root, 'app/arcade/page.tsx'), 'utf8');
const gamePage = readFileSync(join(root, 'app/arcade/[slug]/page.tsx'), 'utf8');
const playSpace = readFileSync(join(root, 'components/arcade/ArcadePlaySpace.tsx'), 'utf8');

test('production arcade publishes exactly Stretchicorn and uniRico', () => {
  assert.deepEqual(
    arcadeGames.map(({ slug, version }) => ({ slug, version })),
    [
      { slug: 'stretchicorn', version: 'v0.21.1' },
      { slug: 'unirico', version: 'v0.18.0' },
    ]
  );

  assert.equal(getArcadeGame('sylvaria'), undefined);
  assert.equal(getArcadeGame('mosslight'), undefined);
  assert.doesNotMatch(arcadePage, /Sylvaria/);
  assert.doesNotMatch(gamePage, /mosslight|sylvaria/i);
  assert.match(gamePage, /export const dynamicParams = false/);
});

test('arcade content respects the global single-main landmark contract', () => {
  assert.match(arcadePage, /data-arcade-catalog/);
  assert.match(playSpace, /data-arcade-shell/);
  assert.doesNotMatch(arcadePage, /<main\b/);
  assert.doesNotMatch(playSpace, /<main\b/);
});

test('game metadata pins the current qualified upstream GitHub commits', () => {
  const stretchicorn = getArcadeGame('stretchicorn');
  const unirico = getArcadeGame('unirico');

  assert.equal(stretchicorn?.repoUrl, 'https://github.com/sidhulyalkar/stretchicorn');
  assert.equal(stretchicorn?.sourceCommit, '5635de71cae80a7728a45b11fd660fd87112c351');
  assert.equal(stretchicorn?.launchUrl, '/game-runtimes/stretchicorn/index.html');

  assert.equal(unirico?.repoUrl, 'https://github.com/sidhulyalkar/uniRico');
  assert.equal(unirico?.sourceCommit, '8dfe88461dd3644d234300ba2e586f46491548a5');
  assert.equal(unirico?.launchUrl, '/game-runtimes/unirico/index.html');

  assert.match(stretchRoute, /5635de71cae80a7728a45b11fd660fd87112c351/);
  assert.match(uniricoRoute, /8dfe88461dd3644d234300ba2e586f46491548a5/);
});

test('pinned runtime gateway is allowlisted, immutable and provenance-bearing', () => {
  assert.match(runtimeGateway, /runtime\.allowedAssets\.has\(path\)/);
  assert.match(runtimeGateway, /!path\.includes\('\.\.'\)/);
  assert.match(runtimeGateway, /max-age=31536000, immutable/);
  assert.match(runtimeGateway, /X-Arcade-Upstream-Repo/);
  assert.match(runtimeGateway, /X-Arcade-Upstream-Commit/);
  assert.match(runtimeGateway, /frame-ancestors 'self'/);
  assert.match(runtimeGateway, /AbortSignal\.timeout\(8_000\)/);
});

test('production branch does not vendor public game engines or Sylvaria development runtime', () => {
  assert.equal(existsSync(join(root, 'public/game-runtimes/stretchicorn')), false);
  assert.equal(existsSync(join(root, 'public/game-runtimes/mosslight-v2')), false);
});
