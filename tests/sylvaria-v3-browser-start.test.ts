import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

const boot=readFileSync(join(process.cwd(),'public/game-runtimes/sylvaria-v3/game-v3.js'),'utf8');
const matrix=readFileSync(join(process.cwd(),'scripts/playtest-sylvaria-v3-browsers.mjs'),'utf8');

test('Sylvaria start cannot be blocked by unavailable browser audio',()=>{
  assert.match(boot,/function ensureAudio\(\)/);
  assert.match(boot,/window\.AudioContext\|\|window\.webkitAudioContext/);
  assert.match(boot,/if\(!AudioCtor\)return null/);
  assert.match(boot,/catch\{return null\}/);
  assert.match(boot,/function startGame\(\)\{ensureAudio\(\);engine\.reset\(true\)/);
  assert.doesNotMatch(boot,/function startGame\(\)\{audioCtx\?\?=new AudioContext/);
});

test('cross-browser qualification proves the real start control reached playing mode',()=>{
  assert.match(matrix,/page\.locator\('#start'\)\.click\(\)/);
  assert.match(matrix,/snapshot\(\)\.mode==='playing'/);
  for(const browser of ["'chrome-stable'","'chromium'","'firefox'","'webkit'"])assert.ok(matrix.includes(browser),`browser matrix missing ${browser}`);
});
