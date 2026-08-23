import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, brotliCompressSync, constants as z } from 'node:zlib';

const root = process.cwd();
const artifactDir = path.join(root, 'artifacts', 'sylvaria-size');
fs.mkdirSync(artifactDir, { recursive: true });

const runtimeRoot = 'public/game-runtimes/mosslight-v2';
const runtimeFiles = [
  `${runtimeRoot}/index.html`,
  `${runtimeRoot}/sylvaria-v8.css`,
  `${runtimeRoot}/sylvaria-minimal-v011.css`,
  `${runtimeRoot}/sylvaria-pond-v012.css`,
  `${runtimeRoot}/render-scale-v7.js`,
  `${runtimeRoot}/render-optimizer-v6.js`,
  `${runtimeRoot}/v014-entry.js`,
  `${runtimeRoot}/v014/character-rig-v014.js`,
  `${runtimeRoot}/v014/combat-flow-v014.js`,
  `${runtimeRoot}/v014/charge-intent-v014.js`,
  `${runtimeRoot}/v014/enemy-flow-v014.js`,
  `${runtimeRoot}/v014/enemy-mastery-v014.js`,
  `${runtimeRoot}/v014/boss-flow-v014.js`,
  `${runtimeRoot}/v014/threat-manager-v014.js`,
  `${runtimeRoot}/v014/flow-presentation-v014.js`,
  `${runtimeRoot}/v014/presentation-space-v014.js`,
  `${runtimeRoot}/v014/combat-readability-v014.js`,
  `${runtimeRoot}/v013-entry.js`,
  `${runtimeRoot}/v013/kinetic-combat-v013.js`,
  `${runtimeRoot}/v013/enemy-ai-v013.js`,
  `${runtimeRoot}/v013/replay-v013.js`,
  `${runtimeRoot}/v013/coach-v013.js`,
  `${runtimeRoot}/v013/kinetic-presentation-v013.js`,
  `${runtimeRoot}/v012-entry.js`,
  `${runtimeRoot}/v012/art-atlas-v012.js`,
  `${runtimeRoot}/v012/art-atlas-pro-v012.js`,
  `${runtimeRoot}/v012/webgl-pond-v012.js`,
  `${runtimeRoot}/v011-entry.js`,
  `${runtimeRoot}/v091/model.js`,
  `${runtimeRoot}/v091/world.js`,
  `${runtimeRoot}/v091/movement.js`,
  `${runtimeRoot}/v091/battle-core.js`,
  `${runtimeRoot}/v091/render.js`,
  `${runtimeRoot}/v091/boot.js`,
  `${runtimeRoot}/v091/fullscreen.js`,
  `${runtimeRoot}/v091/synergy-v010.js`,
  `${runtimeRoot}/v011/rooms-v011.js`,
  `${runtimeRoot}/v011/presentation-v011.js`,
  `${runtimeRoot}/v011/input-guard-v011.js`,
  `${runtimeRoot}/v011/competitive-v011.js`,
  'public/game-runtimes/game-network-bridge.js',
];

function profile(files) {
  const rows = files.map((file) => {
    const data = fs.readFileSync(path.join(root, file));
    return {
      file,
      raw: data.length,
      gzip: gzipSync(data, { level: 9 }).length,
      brotli: brotliCompressSync(data, { params: { [z.BROTLI_PARAM_QUALITY]: 11 } }).length,
    };
  });
  const joined = Buffer.concat(files.map((file) => fs.readFileSync(path.join(root, file))));
  return {
    rows,
    aggregate: {
      raw: joined.length,
      gzip: gzipSync(joined, { level: 9 }).length,
      brotli: brotliCompressSync(joined, { params: { [z.BROTLI_PARAM_QUALITY]: 11 } }).length,
    },
  };
}

const runtime = profile(runtimeFiles);
const report = {
  presentationVersion: '0.14.0',
  engineVersion: '0.14.0-development',
  rankedVerifierVersion: '0.13.0',
  rankedEnabled: false,
  generatedAt: new Date().toISOString(),
  note:
    'This report measures the actual playable portfolio runtime loaded by v014-entry.js, including the shared frog/tongue rig, DPR-safe logical presentation space, collision-neutral projectile readability, charged dash intent controller, deterministic elite mastery, boss guard-break loop, 30-room threat manager, WebGL2 pond renderer, and compatibility substrate. Sylvaria is not being optimized against a game-jam byte limit. Payload measurements track regressions and loading cost while preserving visual and mechanical quality.',
  runtime,
};

fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('Sylvaria v0.14 playable portfolio runtime size profile');
console.table(
  runtime.rows.map((row) => ({
    file: row.file.replace(`${runtimeRoot}/`, ''),
    raw: row.raw,
    gzip: row.gzip,
    brotli: row.brotli,
  })),
);
console.log(
  `Playable runtime aggregate: raw ${runtime.aggregate.raw} B · gzip ${runtime.aggregate.gzip} B · brotli ${runtime.aggregate.brotli} B`,
);
