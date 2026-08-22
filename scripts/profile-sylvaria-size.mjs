import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, brotliCompressSync, constants as z } from 'node:zlib';

const root = process.cwd();
const artifactDir = path.join(root, 'artifacts', 'sylvaria-size');
fs.mkdirSync(artifactDir, { recursive: true });

const competitionLimitBytes = 13 * 1024;
const runtimeRoot = 'public/game-runtimes/mosslight-v2';
const competitionFiles = [
  `${runtimeRoot}/index.html`,
  `${runtimeRoot}/sylvaria-v8.css`,
  `${runtimeRoot}/render-scale-v7.js`,
  `${runtimeRoot}/render-optimizer-v6.js`,
  `${runtimeRoot}/v010-entry.js`,
  `${runtimeRoot}/v091/model.js`,
  `${runtimeRoot}/v091/world.js`,
  `${runtimeRoot}/v091/movement.js`,
  `${runtimeRoot}/v091/battle-core.js`,
  `${runtimeRoot}/v091/render.js`,
  `${runtimeRoot}/v091/boot.js`,
  `${runtimeRoot}/v091/fullscreen.js`,
  `${runtimeRoot}/v091/synergy-v010.js`,
];
const portfolioOnlyFiles = ['public/game-runtimes/game-network-bridge.js'];

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
  const aggregate = {
    raw: joined.length,
    gzip: gzipSync(joined, { level: 9 }).length,
    brotli: brotliCompressSync(joined, { params: { [z.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
  return { rows, aggregate };
}

const readableRuntime = profile(competitionFiles);
const portfolioPayload = profile([...competitionFiles, ...portfolioOnlyFiles]);
const report = {
  version: '0.10.0',
  generatedAt: new Date().toISOString(),
  competitionLimitBytes,
  note: 'This report measures the readable portfolio runtime. It is not a JS13k submission artifact. A future competition pack must flatten/minify/pack only the required game files and satisfy the official ZIP cap independently.',
  readableRuntime,
  portfolioPayload,
  competitionGap: {
    rawBytesOver: Math.max(0, readableRuntime.aggregate.raw - competitionLimitBytes),
    gzipBytesOver: Math.max(0, readableRuntime.aggregate.gzip - competitionLimitBytes),
    brotliBytesOver: Math.max(0, readableRuntime.aggregate.brotli - competitionLimitBytes),
  },
};

fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('Sylvaria v0.10 runtime size profile');
console.table(readableRuntime.rows.map((row) => ({ file: row.file.replace(`${runtimeRoot}/`, ''), raw: row.raw, gzip: row.gzip, brotli: row.brotli })));
console.log(`Readable runtime aggregate: raw ${readableRuntime.aggregate.raw} B · gzip ${readableRuntime.aggregate.gzip} B · brotli ${readableRuntime.aggregate.brotli} B`);
console.log(`Reference 13 KiB cap: ${competitionLimitBytes} B. Current readable runtime is intentionally NOT treated as a competition-ready package.`);
