import { mkdir, readFile, writeFile } from 'node:fs/promises';

const ANALYZE_DATA = 'artifacts/bundle-analyzer/data/analyze.data';
const REPORT_PATH = 'artifacts/bundle-budget/report.json';

const MAX_CLIENT_CHUNK_RAW_BYTES = 500_000;
const MAX_CLIENT_CHUNK_COMPRESSED_BYTES = 180_000;
const MAX_CLIENT_TOTAL_RAW_BYTES = 2_000_000;
const MAX_CLIENT_TOTAL_COMPRESSED_BYTES = 800_000;

type AnalyzerChunkPart = {
  output_file_index: number;
  size: number;
  compressed_size: number;
};

type AnalyzerFile = { filename: string };
type AnalyzerFrame = {
  output_files: AnalyzerFile[];
  chunk_parts: AnalyzerChunkPart[];
};

type ClientChunk = {
  filename: string;
  rawBytes: number;
  compressedBytes: number;
  parts: number;
};

function readAnalyzerFrame(buffer: Buffer): AnalyzerFrame {
  if (buffer.length < 5) throw new Error('Turbopack analyzer data is unexpectedly empty');
  const jsonLength = buffer.readUInt32BE(0);
  if (jsonLength <= 0 || jsonLength + 4 > buffer.length) {
    throw new Error(`Invalid Turbopack analyzer frame length: ${jsonLength}`);
  }
  return JSON.parse(buffer.subarray(4, 4 + jsonLength).toString('utf8')) as AnalyzerFrame;
}

async function main() {
  const frame = readAnalyzerFrame(await readFile(ANALYZE_DATA));
  const aggregate = new Map<number, { rawBytes: number; compressedBytes: number; parts: number }>();
  for (const part of frame.chunk_parts) {
    const current = aggregate.get(part.output_file_index) ?? { rawBytes: 0, compressedBytes: 0, parts: 0 };
    current.rawBytes += part.size ?? 0;
    current.compressedBytes += part.compressed_size ?? 0;
    current.parts += 1;
    aggregate.set(part.output_file_index, current);
  }

  const clientChunks: ClientChunk[] = frame.output_files
    .map((file, index) => ({ file, index, sizes: aggregate.get(index) ?? { rawBytes: 0, compressedBytes: 0, parts: 0 } }))
    .filter(({ file }) => file.filename.startsWith('[client-fs]/_next/static/chunks/') && file.filename.endsWith('.js'))
    .map(({ file, sizes }) => ({ filename: file.filename, ...sizes }))
    .sort((a, b) => b.rawBytes - a.rawBytes);

  const totalRawBytes = clientChunks.reduce((sum, chunk) => sum + chunk.rawBytes, 0);
  const totalCompressedBytes = clientChunks.reduce((sum, chunk) => sum + chunk.compressedBytes, 0);
  const largestRaw = clientChunks[0];
  const largestCompressed = [...clientChunks].sort((a, b) => b.compressedBytes - a.compressedBytes)[0];

  const failures: string[] = [];
  if (clientChunks.length === 0) failures.push('Turbopack analyzer reported no client JavaScript chunks');
  if (largestRaw && largestRaw.rawBytes > MAX_CLIENT_CHUNK_RAW_BYTES) {
    failures.push(`largest raw client chunk ${(largestRaw.rawBytes / 1000).toFixed(1)} kB exceeds ${(MAX_CLIENT_CHUNK_RAW_BYTES / 1000).toFixed(0)} kB`);
  }
  if (largestCompressed && largestCompressed.compressedBytes > MAX_CLIENT_CHUNK_COMPRESSED_BYTES) {
    failures.push(`largest compressed client chunk ${(largestCompressed.compressedBytes / 1000).toFixed(1)} kB exceeds ${(MAX_CLIENT_CHUNK_COMPRESSED_BYTES / 1000).toFixed(0)} kB`);
  }
  if (totalRawBytes > MAX_CLIENT_TOTAL_RAW_BYTES) {
    failures.push(`analyzed client JS total ${(totalRawBytes / 1_000_000).toFixed(2)} MB exceeds ${(MAX_CLIENT_TOTAL_RAW_BYTES / 1_000_000).toFixed(2)} MB`);
  }
  if (totalCompressedBytes > MAX_CLIENT_TOTAL_COMPRESSED_BYTES) {
    failures.push(`analyzed compressed client JS total ${(totalCompressedBytes / 1_000_000).toFixed(2)} MB exceeds ${(MAX_CLIENT_TOTAL_COMPRESSED_BYTES / 1_000_000).toFixed(2)} MB`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'Next.js 16 Turbopack experimental-analyze',
    thresholds: {
      maxClientChunkRawBytes: MAX_CLIENT_CHUNK_RAW_BYTES,
      maxClientChunkCompressedBytes: MAX_CLIENT_CHUNK_COMPRESSED_BYTES,
      maxClientTotalRawBytes: MAX_CLIENT_TOTAL_RAW_BYTES,
      maxClientTotalCompressedBytes: MAX_CLIENT_TOTAL_COMPRESSED_BYTES,
    },
    client: {
      chunks: clientChunks.length,
      totalRawBytes,
      totalCompressedBytes,
      largestChunks: clientChunks.slice(0, 30),
    },
    failures,
  };

  await mkdir('artifacts/bundle-budget', { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Turbopack client budget: ${clientChunks.length} JS chunks, ${(totalRawBytes / 1_000_000).toFixed(2)} MB raw, ${(totalCompressedBytes / 1_000_000).toFixed(2)} MB compressed.`);
  for (const chunk of clientChunks.slice(0, 12)) {
    console.log(`  ${(chunk.rawBytes / 1000).toFixed(1)} kB raw · ${(chunk.compressedBytes / 1000).toFixed(1)} kB compressed · ${chunk.filename}`);
  }
  console.log(`Wrote bundle report to ${REPORT_PATH}.`);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`Bundle budget FAIL: ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('Bundle budget PASS.');
}

main().catch((error) => {
  console.error('Bundle budget check crashed:', error);
  process.exitCode = 1;
});
