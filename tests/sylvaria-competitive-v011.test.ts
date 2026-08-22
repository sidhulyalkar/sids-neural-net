import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),'utf8');

test('v0.11.1 exposes restrained competitive targets and optional post-run score publishing',()=>{
  const html=read('public/game-runtimes/mosslight-v2/index.html');
  const client=read('public/game-runtimes/mosslight-v2/v011/competitive-v011.js');
  assert.match(html,/id="rankPanel"/);
  assert.match(html,/top verified runs/);
  assert.match(html,/id="rankedSubmit"/);
  assert.match(html,/name for leaderboard/);
  assert.match(client,/\/api\/sylvaria\/leaderboard/);
  assert.match(client,/\/api\/sylvaria\/run-ticket/);
  assert.match(client,/\/api\/sylvaria\/leaderboard\/submit/);
  assert.match(client,/ranked replay ready/);
  assert.match(client,/new best/);
  assert.match(client,/runDelta/);
  assert.match(client,/verificationProof/);
});

test('ranked network acquisition is parallel to gameplay and Learn Controls never requests a ticket',()=>{
  const client=read('public/game-runtimes/mosslight-v2/v011/competitive-v011.js');
  assert.match(client,/function beginRun\(practice=false\)/);
  assert.match(client,/if\(!practice\)run\.ticketPromise=issueTicket\(run\)/);
  assert.match(client,/\$\('explore'\)\?\.addEventListener\('click',\(\)=>beginRun\(true\)\)/);
  assert.doesNotMatch(client,/await issueTicket\(run\)/);
});

test('first-run coaching is action driven and pause/mute repeats are intercepted before game handlers',()=>{
  const coach=read('public/game-runtimes/mosslight-v2/v011/coach-v011.js');
  const guard=read('public/game-runtimes/mosslight-v2/v011/input-guard-v011.js');
  assert.match(coach,/stats\.dashes>0/);
  assert.match(coach,/stats\.cuts>0/);
  assert.match(coach,/stats\.counters>0/);
  assert.match(coach,/WASD · move/);
  assert.match(coach,/cut toward incoming shots · reflect/);
  assert.match(guard,/event\.repeat/);
  assert.match(guard,/key==='p'\|\|key==='m'/);
  assert.match(guard,/stopImmediatePropagation/);
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
