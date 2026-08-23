import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

test('v0.15 preserves the verified v0.13 competitive substrate but quarantines Cutstep physics',()=>{
  const html=read('public/game-runtimes/mosslight-v2/index.html'),client=read('public/game-runtimes/mosslight-v2/v011/competitive-v011.js'),entry13=read('public/game-runtimes/mosslight-v2/v013-entry.js'),entry15=read('public/game-runtimes/mosslight-v2/v015-entry.js');
  assert.match(html,/id="rankPanel"/);assert.match(html,/id="rankedSubmit"/);assert.match(html,/ranking remains paused/i);assert.match(entry13,/v013\/replay-v013\.js/);assert.match(entry13,/v011\/competitive-v011\.js/);assert.ok(entry13.indexOf('v013/replay-v013.js')<entry13.indexOf('v011/competitive-v011.js'));assert.match(entry15,/SylvariaRankedDisabledReason='v0\.15 Cutstep prototype · verifier migration required'/);assert.match(client,/const unrankedReason=\(\)=>String\(window\.SylvariaRankedDisabledReason\|\|''\)\.trim\(\)/);assert.match(client,/if\(unrankedReason\(\)\)return null/);assert.match(client,/rankedDisabledReason:unrankedReason\(\)\|\|null/);
});

test('practice and unverified v0.15 runs never acquire ranked tickets',()=>{
  const client=read('public/game-runtimes/mosslight-v2/v011/competitive-v011.js');assert.match(client,/function beginRun\(practice=false\)/);assert.match(client,/if\(!practice&&!reason\)run\.ticketPromise=issueTicket\(run\)/);assert.match(client,/if\(unrankedReason\(\)\)return null/);assert.doesNotMatch(client,/await issueTicket\(run\)/);
});

test('v0.15 public coaching overrides the inherited charge-and-tongue vocabulary',()=>{
  const coach=read('public/game-runtimes/mosslight-v2/v013/coach-v013.js'),entry15=read('public/game-runtimes/mosslight-v2/v015-entry.js'),html=read('public/game-runtimes/mosslight-v2/index.html'),guard=read('public/game-runtimes/mosslight-v2/v011/input-guard-v011.js');assert.match(coach,/hold SPACE · charge · release to dash/);assert.match(entry15,/WASD move · arrows\/mouse aim · SPACE\/click CUTSTEP/);assert.match(html,/There is no charge delay/);assert.doesNotMatch(html,/hold SPACE · charge|sweep the tongue|opening blade frames/i);assert.match(guard,/event\.repeat/);assert.match(guard,/stopImmediatePropagation/);
});

test('ranked storage still prevents replay reuse and fresh-ticket replay laundering',()=>{
  const migration=read('supabase/migrations/20260822051100_sylvaria_resonance_record.sql'),leaderboard=read('src/lib/sylvaria/leaderboard.ts'),submit=read('app/api/sylvaria/leaderboard/submit/route.ts');assert.match(migration,/unique \(engine_version, engine_hash, seed, replay_sha256\)/);assert.match(leaderboard,/assertSylvariaReplayFitsTicketWindow/);assert.match(leaderboard,/replay predates its run ticket/);assert.match(submit,/assertSylvariaReplayFitsTicketWindow\(ticket, envelope\.durationTicks\)/);
});
