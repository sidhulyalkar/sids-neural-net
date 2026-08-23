import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),'utf8');

test('v0.14 keeps the verified v0.13 competitive substrate available but explicitly quarantines it from changed physics',()=>{
  const html=read('public/game-runtimes/mosslight-v2/index.html');
  const client=read('public/game-runtimes/mosslight-v2/v011/competitive-v011.js');
  const entry13=read('public/game-runtimes/mosslight-v2/v013-entry.js');
  const entry14=read('public/game-runtimes/mosslight-v2/v014-entry.js');
  assert.match(html,/id="rankPanel"/);
  assert.match(html,/id="rankedSubmit"/);
  assert.match(html,/ranked submission is intentionally paused/i);
  assert.match(entry13,/v013\/replay-v013\.js/);
  assert.match(entry13,/v011\/competitive-v011\.js/);
  assert.ok(entry13.indexOf('v013/replay-v013.js')<entry13.indexOf('v011/competitive-v011.js'),'legacy competitive client must still capture the v0.13 replay implementation');
  assert.match(entry14,/SylvariaRankedDisabledReason='v0\.14 replay verifier migration'/);
  assert.match(client,/function unrankedReason/);
  assert.match(client,/if\(unrankedReason\(\)\)return null/);
  assert.match(client,/development build/);
  assert.match(client,/rankedDisabledReason:unrankedReason\(\)\|\|null/);
  assert.match(client,/\/api\/sylvaria\/leaderboard/);
  assert.match(client,/\/api\/sylvaria\/run-ticket/);
  assert.match(client,/\/api\/sylvaria\/leaderboard\/submit/);
});

test('ranked network acquisition remains parallel to gameplay and neither practice nor unverified v0.14 physics requests a ticket',()=>{
  const client=read('public/game-runtimes/mosslight-v2/v011/competitive-v011.js');
  assert.match(client,/function beginRun\(practice=false\)/);
  assert.match(client,/if\(!practice&&!reason\)run\.ticketPromise=issueTicket\(run\)/);
  assert.match(client,/if\(unrankedReason\(\)\)return null/);
  assert.match(client,/\$\('explore'\)\?\.addEventListener\('click',\(\)=>beginRun\(true\)\)/);
  assert.doesNotMatch(client,/await issueTicket\(run\)/);
});

test('inherited first-run coaching still teaches glide charge sweep and opening parry under v0.14 production',()=>{
  const coach=read('public/game-runtimes/mosslight-v2/v013/coach-v013.js');
  const guard=read('public/game-runtimes/mosslight-v2/v011/input-guard-v011.js');
  const entry14=read('public/game-runtimes/mosslight-v2/v014-entry.js');
  assert.match(entry14,/await import\('\.\/v013-entry\.js'\)/);
  assert.match(coach,/WASD · glide freely/);
  assert.match(coach,/hold SPACE · charge · release to dash/);
  assert.match(coach,/arrow key · sweep the tongue/);
  assert.match(coach,/opening blade frames · parry incoming fire/);
  assert.doesNotMatch(coach,/mid-swing/i);
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
