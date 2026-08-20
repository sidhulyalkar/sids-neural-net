import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadEnvLocal();

const apiKey = process.env.SPOTIFY_SOLOIST_API_KEY?.trim();
const deviceName = process.env.SOLOIST_DEVICE_NAME?.trim() || 'Sid Neural Net';
const wsAddress = process.env.SOLOIST_WS_ADDRESS?.trim() || '127.0.0.1:9090';

if (!apiKey) {
  console.error('Missing SPOTIFY_SOLOIST_API_KEY. Add it to .env.local; never commit it.');
  process.exit(1);
}

if (process.platform !== 'linux') {
  console.error(`Spotify Soloist requires Linux; current platform is ${process.platform}. Run this command on your Pi/Linux host.`);
  process.exit(1);
}

console.log(`Starting Spotify Soloist as "${deviceName}" with WebSocket bound to ${wsAddress}.`);
console.log('The API key is loaded from .env.local and is never printed.');

const child = spawn(
  'soloist',
  ['--device-name', deviceName, '--api-key', apiKey, '--ws', wsAddress],
  { stdio: 'inherit' },
);

child.on('error', (error) => {
  console.error('Could not start the soloist executable:', error.message);
  console.error('Install the current Linux build from Spotify for Developers and ensure `soloist` is on PATH.');
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) console.log(`Spotify Soloist exited from signal ${signal}.`);
  process.exitCode = code ?? 0;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}
