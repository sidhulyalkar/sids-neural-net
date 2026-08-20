import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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

const keyConfigured = Boolean(process.env.SPOTIFY_SOLOIST_API_KEY?.trim());
const deviceName = process.env.SOLOIST_DEVICE_NAME?.trim() || 'Sid Neural Net';
const wsAddress = process.env.SOLOIST_WS_ADDRESS?.trim() || '127.0.0.1:9090';
const isLinux = process.platform === 'linux';
const binary = spawnSync('soloist', ['--help'], { stdio: 'ignore' });
const binaryAvailable = !binary.error;

console.log('Spotify Soloist local integration');
console.log(`  API key:      ${keyConfigured ? 'configured ✓' : 'missing ✗'}`);
console.log(`  platform:     ${process.platform}${isLinux ? ' ✓' : ' (Soloist requires Linux)'}`);
console.log(`  soloist bin:  ${binaryAvailable ? 'available ✓' : 'not found'}`);
console.log(`  device name:  ${deviceName}`);
console.log(`  websocket:    ${wsAddress}`);
console.log('');

if (!keyConfigured) {
  console.log('Add SPOTIFY_SOLOIST_API_KEY to .env.local. Never commit or print the key.');
}
if (!isLinux) {
  console.log('Run Soloist on a Linux host such as a Raspberry Pi or Linux server. The public /rotation page does not require Soloist.');
}
if (isLinux && !binaryAvailable) {
  console.log('Install the current Spotify Soloist Linux build from Spotify for Developers, then rerun this check.');
}

if (keyConfigured && isLinux && binaryAvailable) {
  console.log('Ready. Start the local daemon with: npm run music:soloist:start');
}

process.exitCode = keyConfigured && isLinux && binaryAvailable ? 0 : 1;
