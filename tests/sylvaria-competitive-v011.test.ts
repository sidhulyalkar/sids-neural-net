import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),'utf8');

test('v0.13 keeps restrained competitive targets and optional post-run score publishing',()=>{
  const html=read('public/game-runtimes/mosslight-v2/index.html');
  const client=read('public/game-runtimes/mosslight-v2/v011/competitive-v011.js');
  const entry=read('public/game-runtimes/mosslight-v2/v013-entry.js');
  assert.match(html,/id="rankPanel"/);
  assert.match(html,/top verified runs/);
  assert.match(html,/id="rankedSubmit"/);
  assert.match(html,/name for leaderboard/);
  assert.match(entry,/v013\/replay-v013\.js/);
  assert.match(entry,/v011\/competitive-v011\.js/);
  assert.ok(entry.indexOf('v013/replay-v013.js')<entry.indexOf('v011/competitive-v011.js'),'competitive client must capture the v0.13 replay implementation');
  assert.match(client,/\/api\/sylvaria\/leaderboard/);
  assert.match(client,/\/api\/sylvaria\/run-ticket/);
  assert.match(client,/\/api\/sylvaria\/leaderboard\/submit/);
  assert.match(client,/ranked replay ready/);
  assert.match(client,/new best/);
  assert.match(client,/runDelta/);
  assert.match(client,/verificationProof/);
});

test('ranked network acquisition remains parallel to gameplay and Learn Controls never requests a ticket',()=>{
  const client=read('public/game-runtimes/mosslight-v2/v011/competitive-v011.js');
  assert.match(client,/function beginRun\(practice=false\)/);
  assert.match(client,/if\(!practice\)run\.ticketPromise=issueTicket\(run\)/);
  assert.match(client,/\$\('explore'\)\?\.addEventListener\('click',\(\)=>beginRun\(true\)\)/);
  assert.doesNotMatch(client,/await issueTicket\(run\)/);
});

test('v0.13 first-run coaching teaches glide charge sweep reflect and keeps keyboard guards',()=>{
  const coach=read('public/game-runtimes/mosslight-v2/v013/coach-v013.js');
  const guard=read('public/game-runtimes/mosslight-v2/v011/input-guard-v011.js');
  assert.match(coach,/WASD · glide freely/);
  assert.match(coach,/hold SPACE · charge · release to dash/);
  assert.match(coach,/arrow key · sweep the tongue/);
  assert.match(coach,/mid-swing · reflect/);
  assert.match(coach,/stats\.dashes>0/);
  assert.match(coach,/stats\.cuts>0/);
  assert.match(coach,/stats\.counters>0/);
  assert.match(guard,/event\.repeat/);
  assert.match(guard,/key==='p'\|\|key==='m'/);
  assert.match(guard,/key==='enter'/);
  assert.match(guard,/state\.mode==='menu'/);
  assert.match(guard,/event\.target\?\.tagName==='BUTTON'/);
  assert.match(guard,/stopImmediatePropagation/);
  assert.match(guard,/focusedMenuEnter:true/);
});

test('ranked storage prevents exact replay reuse and submit timing prevents fresh-ticket replay laundering',()=>{
  const migration=read('supabase/migrations/20260822051100_sylvaria_resonance_record.sql');
  const leaderboard=read('src/lib/sylvaria/leaderboard.ts');
  const submit=read('app/api/sylvaria/leaderboard/submit/route.ts');
  assert.match(migration,/unique \(engine_version, engine_hash, seed, replay_sha256\)/);
  assert.match(leaderboard,/assertSylvariaReplayFitsTicketWindow/);
  assert.match(leaderboard,/replay predates its run ticket/);
  assert.match(submit,/assertSylvariaReplayFitsTicketWindow\(ticket, envelope\.durationTicks\)/);
});
