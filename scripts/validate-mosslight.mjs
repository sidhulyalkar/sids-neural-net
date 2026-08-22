import fs from'node:fs';
import crypto from'node:crypto';
const root='public/game-runtimes/mosslight-v2',read=p=>fs.readFileSync(p,'utf8'),errors=[],expect=(ok,msg)=>{if(!ok)errors.push(msg)},has=(s,...xs)=>xs.every(x=>s.includes(x));
const html=read(`${root}/index.html`),model=read(`${root}/v091/model.js`),world=read(`${root}/v091/world.js`),movement=read(`${root}/v091/movement.js`),battle=read(`${root}/v091/battle-core.js`),render=read(`${root}/v091/render.js`),boot=read(`${root}/v091/boot.js`),synergy=read(`${root}/v091/synergy-v010.js`),rooms=read(`${root}/v011/rooms-v011.js`),presentation=read(`${root}/v011/presentation-v011.js`),replay=read(`${root}/v011/replay-v011.js`),competitive=read(`${root}/v011/competitive-v011.js`),coach=read(`${root}/v011/coach-v011.js`),inputGuard=read(`${root}/v011/input-guard-v011.js`),entry11=read(`${root}/v011-entry.js`),entry12=read(`${root}/v012-entry.js`),pond=read(`${root}/v012/webgl-pond-v012.js`),atlasEntry=read(`${root}/v012/art-atlas-v012.js`),atlas=read(`${root}/v012/art-atlas-pro-v012.js`),pondCss=read(`${root}/sylvaria-pond-v012.css`),arcade=read('src/data/arcadeGames.ts'),serverReplay=read('src/lib/sylvaria/replay.ts'),headless=read('src/lib/sylvaria/headless.ts'),leaderboard=read('src/lib/sylvaria/leaderboard.ts'),submit=read('app/api/sylvaria/leaderboard/submit/route.ts'),profiler=read('scripts/profile-sylvaria-size.mjs'),doc12=read('docs/SYLVARIA_V012_FROG_POND_GRAPHICS.md');

expect(has(html,'<title>Sylvaria · Frog Pond</title>','sylvaria-pond-v012.css','v0.12 · frog pond presentation','Lily Clearing','tongue up','tongue down','tongue left','tongue right','id="rankPanel"','id="rankedSubmit"'),'v0.12 frog pond shell incomplete');
expect(html.includes('<script type="module" src="./v012-entry.js"></script>'),'production shell must load v012 entry');
expect(!html.includes('<script type="module" src="./v091/boot.js"></script>'),'shell must not bypass versioned entries');
expect(has(entry12,"import'./v011-entry.js'","PRESENTATION='0.12.0',ENGINE='0.11.1'",'createPondRenderer','F.render=','F.updateHud=','presentationVersion:PRESENTATION','frogPond:true','tongueAttack:true','insectEnemies:true','pondEnvironment:true','tonguePulses'),'v0.12 adapter incomplete');
expect(!/F\.(?:update|updateMovement|updateEnemies|updateShots|cut|dashStep|counterShot)\s*=/.test(entry12),'v0.12 adapter must not replace authoritative mechanics');

expect(has(model,"VERSION='0.9.1'",'FIXED_DT=1/120','MAX_SHOTS=128','MAX_PENDING=72'),'protected fixed-step/caps changed');
for(const t of['ice','mud','sand','water','bramble','grass','shards'])expect(model.includes(`${t}:`),`missing terrain ${t}`);
for(const e of['feller','foreman','lobbyist','skidder','drone','chair','broker','surveyor','mech','mulcher'])expect(model.includes(`${e}:`),`missing enemy ${e}`);
expect(has(movement,'function queueMove','function consumeMoveQueue','state.moveQueue={key,serial:++state.inputSerial}','speed=perfect?1040:840','function shotApproachDirection','function chooseReturnTarget','s.pierces=perfect?1:0','p.dashEcho=.085'),'protected movement/counter contract changed');
expect(!movement.includes('moveQueue.life')&&!movement.includes('moveBuffer'),'movement queue must remain persistent rather than timer-expiring');
expect(has(world,'function terrainAt','function mobilityAt','function resolveEnemyDeath','function updateBossPhases','function damageEnemy','function damageBoss','function spawnGasCloud','function updateGas','function rewardExploration'),'shared world/hazard bookkeeping incomplete');
expect(has(battle,'function moveToward','F.mobilityAt(e.x,e.y)','speed=420*global*mob.move','function maybeBeginEvade','function ventBoss','MAX_SHOTS','MAX_PENDING'),'enemy/boss/cap substrate incomplete');
expect(has(boot,'while(accumulator>=FIXED_DT)','F.render()','requestAnimationFrame(frame)','function labEnemyTravel'),'fixed simulation loop or render seam changed');
expect(has(render,'Object.assign(F,{drawTerrainPatch,rebuildTerrainCache,render,updateHud})','function drawMushrooms','function drawGas'),'qualified Canvas fallback missing');

expect(has(synergy,'function triggerReturnEcology','function shearGas','function hazardScoreAt','function steerCautious','function bulldozeBoss','state.verdantTimer=3.6'),'ecology interaction layer incomplete');
expect(!synergy.includes('1040')&&!synergy.includes('840'),'ecology layer must not redefine protected return speeds');
expect((rooms.match(/\bR\('/g)||[]).length>=30,'30 authored arenas missing');
expect(has(entry11,"VERSION='0.11.1'",'expandedArenas:true','deterministicReplay:true','competitiveRuns:true','actionCoach:true'),'v0.11.1 adapter incomplete');
expect(has(presentation,"version:'0.11.1'",'const baseRender=F.render','p.flow/100'),'v0.11.1 presentation compatibility missing');
expect(has(inputGuard,'event.repeat','stopImmediatePropagation'),'repeat-safe controls missing');
expect(has(coach,"version:'0.11.1'",'stats.counters>0','remember()'),'control coach incomplete');
expect(has(competitive,"version:'0.11.1'",'/api/sylvaria/run-ticket','/api/sylvaria/leaderboard/submit','Replay.envelope'),'competitive client incomplete');

expect(has(replay,"VERSION='0.11.1'",'MAX_EVENTS=20000','MAX_TICKS=144000','MAX_BYTES=120*1024',"invalidate('visibility changed')"),'browser replay contract changed');
expect(has(serverReplay,"SYLVARIA_ENGINE_VERSION = '0.11.1'",'SYLVARIA_MAX_REPLAY_TICKS = 120 * 60 * 20','SYLVARIA_MAX_REPLAY_EVENTS = 20_000','SYLVARIA_MAX_REPLAY_BYTES = 120 * 1024'),'server replay season/caps changed');
expect(has(headless,"'v011', 'rooms-v011.js'",'SYLVARIA_RANKED_VERIFY_MAX_WALL_MS = 8_000','exceeded CPU budget'),'Node exact-source verifier contract incomplete');
expect(has(leaderboard,'SYLVARIA_TICKET_START_GRACE_MS = 5_000','assertSylvariaReplayFitsTicketWindow'),'ticket-age binding missing');
expect(submit.includes('assertSylvariaReplayFitsTicketWindow(ticket, envelope.durationTicks)'),'submit route does not enforce ticket window');

expect(atlasEntry.includes('art-atlas-pro-v012.js'),'stable atlas entrypoint must re-export professional atlas');
for(const sprite of['frog','fly','bee','mosquito','beetle','dragonfly','hornet','moth','crane','divingBeetle','wasp','lilyBed','reeds','driftwood','rock','shrub','mushroom','pickup','lilyPad','tongue','stinger','reflected','water','mud','bank','algae','tangle','shells'])expect(atlas.includes(`'${sprite}'`),`v0.12 atlas missing ${sprite}`);
expect(has(atlas,'function frog','function fastHeight','g.drawImage(diffuse,0,0)'),'professional height-atlas generation incomplete');
expect(!/getImageData|putImageData|willReadFrequently|\.filter\s*=|\.roundRect\(/.test(atlas),'shipping atlas must avoid synchronous pixel readback filtered preprocessing and optional Canvas roundRect');
expect(!atlas.includes('Math.random'),'visual asset generation must be deterministic within a room/load');
expect(has(pond,'MAX_SPRITES=900,MAX_LIGHTS=6',"getContext('webgl2'",'uHeight','float hL=texture','vec3 normal=normalize','max(dot(normal,lightDir),0.0)','gl.bufferSubData','active.sort((a,b)=>a.layer-b.layer||a.foot-b.foot)','webglcontextlost','canvas-fallback'),'WebGL2 normal-lighting/batch/fallback contract incomplete');
for(const pair of["feller:'fly'","foreman:'bee'","lobbyist:'mosquito'","skidder:'beetle'","drone:'dragonfly'","chair:'hornet'","surveyor:'crane'","mech:'divingBeetle'"])expect(pond.includes(pair),`missing insect mapping ${pair}`);
expect(has(pond,'for(const s of state.slashes)',"emit('tongue'",'for(const s of state.shots)',"sprite=s.friendly?'reflected':'stinger'"),'tongue/projectile visual translation incomplete');
expect(!/F\.(?:update|cut|dashStep|counterShot)\s*=/.test(pond),'WebGL renderer must not define authoritative mechanics');
expect(has(pondCss,'#pondCanvas','html.pond-webgl #c{opacity:0!important;visibility:hidden}','pointer-events:none'),'WebGL overlay/fallback CSS incomplete');

expect(has(arcade,"version: 'v0.12.0'",'HOP · SLAP · REFLECT.','frog-and-pond','WebGL2','normal mapping','verified leaderboard'),'Game Network metadata is not on frog pond v0.12');
expect(has(profiler,"presentationVersion: '0.12.0'","engineVersion: '0.11.1'",'v012/art-atlas-v012.js','v012/art-atlas-pro-v012.js','v012/webgl-pond-v012.js'),'size profiler does not measure the shipping v0.12 renderer');
expect(has(doc12,'120 Hz fixed simulation tick','840 / 1040 px/s','ranked engine version therefore remains **0.11.1**','Only `F.render` is replaced','≤ 6 dynamic lights','≤ 900 sprite quads hard render cap'),'v0.12 graphics contract incomplete');

const presentationHash=crypto.createHash('sha256').update([entry12,pond,atlasEntry,atlas,pondCss,html].join('\n')).digest('hex');
if(errors.length){console.error(`Sylvaria v0.12 validation failed (${errors.length})`);for(const e of errors)console.error(` - ${e}`);process.exit(1)}
console.log(`Sylvaria v0.12 presentation validator PASS · engine 0.11.1 protected · presentation sha256 ${presentationHash}`);
