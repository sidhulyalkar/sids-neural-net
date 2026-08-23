const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const baseUrl = process.env.ARCADE_AUDIT_URL || 'http://127.0.0.1:3000';
const outputDir = join(process.cwd(), 'artifacts', 'browser-smoke');

const GAMES = [
  {
    slug: 'stretchicorn',
    repo: 'sidhulyalkar/stretchicorn',
    commit: '5635de71cae80a7728a45b11fd660fd87112c351',
    versionText: 'Stretchicorn v0.21.1',
    indexPath: '/game-runtimes/stretchicorn/index.html',
    assetPath: '/game-runtimes/stretchicorn/src/00-core.js',
  },
  {
    slug: 'unirico',
    repo: 'sidhulyalkar/uniRico',
    commit: '8dfe88461dd3644d234300ba2e586f46491548a5',
    versionText: 'uniRico v0.18.0',
    indexPath: '/game-runtimes/unirico/index.html',
    assetPath: '/game-runtimes/unirico/src/runtime/core.js',
  },
];

async function checkGame(game) {
  const indexResponse = await fetch(`${baseUrl}${game.indexPath}`, { redirect: 'manual' });
  const body = await indexResponse.text();
  const repoHeader = indexResponse.headers.get('x-arcade-upstream-repo');
  const commitHeader = indexResponse.headers.get('x-arcade-upstream-commit');
  const cacheControl = indexResponse.headers.get('cache-control');
  const csp = indexResponse.headers.get('content-security-policy');
  const assetResponse = await fetch(`${baseUrl}${game.assetPath}`, { redirect: 'manual' });

  const assertions = {
    indexStatus: indexResponse.status === 200,
    repoHeader: repoHeader === game.repo,
    commitHeader: commitHeader === game.commit,
    versionText: body.includes(game.versionText),
    bridgeInjected: body.includes('/game-runtimes/game-network-bridge.js'),
    immutableCache: cacheControl?.includes('max-age=31536000') === true && cacheControl.includes('immutable'),
    selfFramed: csp?.includes("frame-ancestors 'self'") === true,
    assetStatus: assetResponse.status === 200,
  };

  return {
    ...game,
    passed: Object.values(assertions).every(Boolean),
    assertions,
    observed: {
      indexStatus: indexResponse.status,
      repoHeader,
      commitHeader,
      cacheControl,
      csp,
      assetStatus: assetResponse.status,
      contentType: indexResponse.headers.get('content-type'),
    },
  };
}

(async () => {
  mkdirSync(outputDir, { recursive: true });
  const report = { baseUrl, passed: true, games: [], hiddenRoutes: [] };

  for (const game of GAMES) {
    const result = await checkGame(game);
    report.games.push(result);
    report.passed = report.passed && result.passed;
  }

  for (const path of ['/arcade/sylvaria', '/arcade/mosslight']) {
    const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
    const passed = response.status === 404;
    report.hiddenRoutes.push({ path, status: response.status, passed });
    report.passed = report.passed && passed;
  }

  const outputPath = join(outputDir, 'arcade-provenance-audit.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  if (!report.passed) {
    console.error('Arcade provenance audit failed:');
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log('Pinned arcade provenance verified for Stretchicorn v0.21.1 and uniRico v0.18.0.');
})();
