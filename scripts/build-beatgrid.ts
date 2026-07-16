import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MusicTimeline } from '../components/perceptual-cortex/musicTimeline';

async function main() {
  const [spotifyId, bpmArg, downbeatArg, durationArg] = process.argv.slice(2);

  if (!spotifyId || !bpmArg || !downbeatArg) {
    console.error('Usage: npm run music:grid -- <spotifyId> <bpm> <downbeatMs> [durationMs]');
    process.exit(1);
  }

  const bpm = Number(bpmArg);
  const downbeatMs = Number(downbeatArg);
  const durationMs = Number(durationArg ?? 210000);

  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(downbeatMs) || !Number.isFinite(durationMs) || durationMs <= 0) {
    console.error('bpm must be > 0, downbeatMs must be a number, and durationMs must be a positive number.');
    process.exit(1);
  }

  const timeline: MusicTimeline = {
    version: 1,
    durationMs,
    bpm,
    downbeatMs,
    sections: [
      { startMs: 0, kind: 'intro', intensity: 0.4 },
      { startMs: Math.round(durationMs * 0.25), kind: 'build', intensity: 0.7 },
      { startMs: Math.round(durationMs * 0.4), kind: 'drop', intensity: 1 },
      { startMs: Math.round(durationMs * 0.75), kind: 'break', intensity: 0.55 },
      { startMs: Math.round(durationMs * 0.85), kind: 'outro', intensity: 0.5 },
    ],
  };

  const dir = join(process.cwd(), 'public', 'music', 'timelines');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${spotifyId}.json`), JSON.stringify(timeline, null, 2));
  console.log(`Wrote public/music/timelines/${spotifyId}.json (bpm ${bpm}, downbeat ${downbeatMs}ms).`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
