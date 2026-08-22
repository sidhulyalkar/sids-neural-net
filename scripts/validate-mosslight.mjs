import fs from'node:fs';
import crypto from'node:crypto';
const root='public/game-runtimes/mosslight-v2',read=p=>fs.readFileSync(p,'utf8'),errors=[],expect=(ok,msg)=>{if(!ok)errors.push(msg)},has=(s,...xs)=>xs.every(x=>s.includes(x));
const html=read(`${root}/index.html`),model=read(`${root}/v091/model.js`),world=read(`${root}/v091/world.js`),movement=read(`${root}/v091/movement.js`),battle=read(`${root}/v091/battle-core.js`),render=read(`${root}/v091/render.js`),boot=read(`${root}/v091/boot.js`),synergy=read(`${root}/v091/synergy-v010.js`),rooms=read(`${root}/v011/rooms-v011.js`),presentation=read(`${root}/v011/presentation-v011.js`),competitive=read(`${root}/v011/competitive-v011.js`),inputGuard=read(`${root}/v011/input-guard-v011.js`),entry11=read(`${root}/v011-entry.js`),entry12=read(`${root}/v012-entry.js`),entry13=read(`${root}/v013-entry.js`),pond=read(`${root}/v012/webgl-pond-v012.js`),atlasEntry=read(`${root}/v012/art-atlas-v012.js`),atlas=read(`${root}/v012/art-atlas-pro-v012.js`),pondCss=read(`${root}/sylvaria-pond-v012.css`),kinetics=read(`${root}/v013/kinetic-combat-v013.js`),kineticAI=read(`${root}/v013/enemy-ai-v013.js`),replay13=read(`${root}/v013/replay-v013.js`),coach13=read(`${root}/v013/coach-v013.js`),kineticPresentation=read(`${root}/v013/kinetic-presentation-v013.js`),arcade=read('src/data/arcadeGames.ts'),serverReplay=read('src/lib/sylvaria/replay.ts'),headless=read('src/lib/sylvaria/headless.ts'),leaderboard=read('src/lib/sylvaria/leaderboard.ts'),submit=read('app/api/sylvaria/leaderboard/submit/route.ts'),profiler=read('scripts/profile-sylvaria-size.mjs');

expect(has(html,'<title>Sylvaria · Kinetic Pond</title>','v0.13 · kinetic arc combat','Glide. Charge. Sweep. Return fire.','glide north','tongue arc up','hold / release dash','first five active simulation ticks','id="rankPanel"','id="rankedSubmit"'),'v0.13 kinetic pond shell incomplete');
expect(!/mid-swing|middle of the active sweep is the sweet spot/i.test(html),'player-facing shell still teaches retired midpoint parry timing');
expect(html.includes('<script type="module" src="./v013-entry.js"></script>'),'production shell must load v013 entry');
expect(!html.includes('<script type="module" src="./v012-entry.js"></script>')&&!html.includes('<script type="module" src="./v091/boot.js"></script>'),'shell must not bypass the v0.13 entry');

expect(has(model,"VERSION='0.9.1'",'FIXED_DT=1/120','MAX_SHOTS=128','MAX_PENDING=72'),'fixed 120 Hz substrate or projectile caps changed');
for(const t of['ice','mud','sand','water','bramble','grass','shards'])expect(model.includes(`${t}:`),`missing terrain ${t}`);
for(const e of['feller','foreman','lobbyist','skidder','drone','chair','broker','surveyor','mech','mulcher'])expect(model.includes(`${e}:`),`missing legacy enemy ${e}`);
expect(has(world,'function terrainAt','function mobilityAt','function resolveEnemyDeath','function damageEnemy','function damageBoss','function spawnGasCloud','function updateGas','function rewardExploration'),'shared world/hazard bookkeeping incomplete');
expect(has(battle,'function moveToward','function maybeBeginEvade','function ventBoss','MAX_SHOTS','MAX_PENDING'),'legacy enemy/boss substrate incomplete');
expect(has(boot,'while(accumulator>=FIXED_DT)','F.render()','requestAnimationFrame(frame)'),'fixed simulation loop or render seam changed');
expect(has(render,'Object.assign(F,{drawTerrainPatch,rebuildTerrainCache,render,updateHud})','function drawMushrooms','function drawGas'),'Canvas fallback missing');
expect((rooms.match(/\bR\('/g)||[]).length>=30,'30 authored arenas missing');

// v0.12 remains a presentation-only parent. v0.13 is the intentional mechanics break.
expect(has(entry12,"import'./v011-entry.js'","PRESENTATION='0.12.0',ENGINE='0.11.1'",'createPondRenderer','F.render=','F.updateHud='),'v0.12 graphics parent incomplete');
expect(!/F\.(?:update|updateMovement|updateEnemies|updateShots|cut|dashStep|counterShot)\s*=/.test(entry12),'v0.12 graphics parent must remain presentation-only');
expect(!/replay-v011|coach-v011|competitive-v011/.test(entry11),'v0.13 branch must defer ranked replay coaching and competitive wiring until the new engine loads');
expect(has(entry13,"import'./v012-entry.js'","v013/kinetic-combat-v013.js","v013/enemy-ai-v013.js","v013/replay-v013.js","v013/coach-v013.js","v013/kinetic-presentation-v013.js",'continuousGlide:true','chargedOmniDash:true','exponentialDash:true','bufferedDash:true','dashBladeCancel:true','kineticTongueArc:true','reactiveBladeParry:true','proceduralBladeTrail:true','selectiveHitStop:true','predictiveArcEvasion:true','expandedEnemyRoster:true'),'v0.13 entry wiring incomplete');
expect(entry13.indexOf('v013/replay-v013.js')<entry13.indexOf('v011/competitive-v011.js'),'competitive client must capture the v0.13 replay implementation');

// Continuous deterministic locomotion and a solved exponential velocity burst replace scripted dash-step travel.
expect(has(kinetics,"KINETIC_VERSION='0.13.0'",'moveSpeed:238','acceleration:1880','braking:12.5','turnGrip:15.5','dashChargeTime:.68','dashBuffer:.10','dashDecay:.90483742','dashTicksMin:12','dashTicksMax:22','dashDistanceMin:78','dashDistanceMax:154','function heldVector','function beginDashCharge','function releaseDashCharge','function launchDash','distance*(1-decay)/(FIXED_DT*(1-Math.pow(decay,ticks)))','p.dash.speed=q(p.dash.speed*p.dash.decay)','function updateMovement(dt)','p.vx=q(','p.vy=q(','function currentAt'),'v0.13 continuous locomotion, buffered charge, or exponential dash incomplete');
expect(has(kinetics,'function queueMove(){state.moveQueue=null;return false}','function consumeMoveQueue(){state.moveQueue=null;return false}','function repeatCadence(){return 0}'),'retired movement queue can still drive production');
expect(!kinetics.includes('state.moveQueue={key,serial'),'v0.13 must not reintroduce queued dash-step locomotion');

// The tongue is a reactive blade: opening five active ticks parry; the remainder is melee/world offense.
expect(has(kinetics,'arcDegrees:156','arcWindup:3/120','arcActive:15/120','arcRecovery:10/120','arcReach:94','parryWindow:5/120','perfectReflectSpeed:1160',"phase:'windup'","s.phase='active'","s.phase='recovery'",'function arcSweepContains','function fullArcContains','function counterShotArc',"F.addCallout?.(shot.x,shot.y-14,'PARRY'",'function cancelDashIntoBlade','dashCancelTicks:4'),'reactive blade arc or opening parry timing incomplete');
expect(has(kinetics,'tangent=s.sweepDir>0','s.phaseTime>s.parryWindow','signalHitStop(\'parry\',4)','state.bladeTrails.push'),'reflection is not based on moving-arc contact inside the opening parry window');
expect(!/Math\.abs\(s\.activeProgress-\.5\)|perfectWindow:\.12|SWEET SPOT/.test(kinetics),'retired midpoint Countercut timing leaked into v0.13 blade logic');
expect(has(kinetics,"document.addEventListener('keydown',onSpaceDown,true)","document.addEventListener('keyup',onSpaceUp,true)"),'Space charge/release input missing');
expect(has(kinetics,'Math.round(v*100000)/100000','p.x=q(p.x);p.y=q(p.y);p.vx=q(p.vx);p.vy=q(p.vy)'),'deterministic kinetic rounding missing');

// Rich enemy roles have distinct motion, attacks, and actual predictive responses to the sweep.
for(const kind of['skimmer','strider','sniper','shellback'])expect(kineticAI.includes(`${kind}:`),`missing kinetic enemy ${kind}`);
expect(has(kineticAI,'function rosterForDepth','function maybeReadArc','F.fullArcContains','function chooseEvadeDestination','kinetic-evade-cue','enemyArcDodges','function spawnShot','SHELL BLOCK','front>.18','source.counterShot'),'v0.13 reactive enemy behavior incomplete');
expect(has(kineticAI,'sylvaria-v013-roster','entityRand','rngFrom(hash('),'kinetic roster is not seeded/deterministic');
expect(!kineticAI.includes('Math.random'),'kinetic AI contains unseeded randomness');

// Existing ecology remains underneath the faster mechanics rather than being silently removed.
expect(has(synergy,'function triggerReturnEcology','function hazardScoreAt','function bulldozeBoss','state.verdantTimer=3.6'),'ecology interaction layer incomplete');
expect(has(kinetics,'window.SylvariaSynergy?.awardSynergy','function shearGasArc','F.cutMushroom','F.applyTerrainHazard'),'kinetic layer does not preserve ecology/hazard consequences');

// Browser and server replay agree on the new input grammar and authoritative modules.
expect(has(replay13,"VERSION='0.13.0'",'SCHEMA=2','MAX_EVENTS=24000','MAX_TICKS=144000','MAX_BYTES=128*1024','space:[12,13]',"invalidate('visibility changed')"),'v0.13 browser replay contract incomplete');
expect(has(serverReplay,'SYLVARIA_REPLAY_SCHEMA = 2','SYLVARIA_ENGINE_VERSION = \'0.13.0\'','SYLVARIA_MAX_REPLAY_EVENTS = 24_000','SYLVARIA_MAX_REPLAY_BYTES = 128 * 1024',"'dash-down'","'dash-up'"),'server replay schema is not v0.13');
expect(has(headless,'v013/kinetic-combat-v013.js','v013/enemy-ai-v013.js','case 12: applyDashDown(engine)','case 13: applyDashUp(engine)','SylvariaHeadlessVerifier/0.13.0','SYLVARIA_RANKED_VERIFY_MAX_WALL_MS = 8_000'),'Node verifier does not execute the v0.13 engine');
expect(has(headless,'vx: player.vx','dashCharge: player.dashCharge','slashes: state.slashes.map','kineticType: enemy.kineticType'),'v0.13 authoritative state digest is incomplete');
expect(has(leaderboard,'SYLVARIA_TICKET_START_GRACE_MS = 5_000','assertSylvariaReplayFitsTicketWindow'),'ticket-age binding missing');
expect(submit.includes('assertSylvariaReplayFitsTicketWindow(ticket, envelope.durationTicks)'),'submit route does not enforce ticket window');

// Graphics foundation and new sweep presentation remain deterministic and bounded.
expect(atlasEntry.includes('art-atlas-pro-v012.js'),'stable atlas entrypoint must re-export professional atlas');
for(const sprite of['frog','fly','bee','mosquito','beetle','dragonfly','hornet','moth','crane','divingBeetle','wasp','lilyBed','reeds','driftwood','rock','shrub','mushroom','pickup','lilyPad','tongue','stinger','reflected','water','mud','bank','algae','tangle','shells'])expect(atlas.includes(`'${sprite}'`),`v0.12 atlas missing ${sprite}`);
expect(!/getImageData|putImageData|willReadFrequently|\.filter\s*=|\.roundRect\(/.test(atlas),'shipping atlas must avoid synchronous pixel readback filtered preprocessing and optional Canvas roundRect');
expect(!atlas.includes('Math.random'),'visual asset generation must be deterministic within a room/load');
expect(has(pond,'MAX_SPRITES=900,MAX_LIGHTS=6',"getContext('webgl2'",'uHeight','vec3 normal=normalize','gl.bufferSubData','active.sort((a,b)=>a.layer-b.layer||a.foot-b.foot)','webglcontextlost','canvas-fallback'),'WebGL2 normal-lighting/batch/fallback contract incomplete');
expect(!/F\.(?:update|cut|dashStep|counterShot)\s*=/.test(pond),'WebGL renderer must not define authoritative mechanics');
expect(has(pondCss,'#pondCanvas','html.pond-webgl #c{opacity:0!important;visibility:hidden}','pointer-events:none'),'WebGL overlay/fallback CSS incomplete');
expect(has(kineticPresentation,"id='kineticCanvas'",'function drawArcAttack','function drawBladeTrails',"s.phase==='windup'", "s.phase==='active'",'quadraticCurveTo','ctx.arc(t.x,t.y,t.reach*.96','function drawDash','function drawKineticEnemies',"original.filter(s=>s.kind!=='arc')",'if(holdFrames>0){holdFrames--;return}'),'v0.13 arc/dash/trail/hit-stop presentation incomplete');
expect(!/F\.(?:updateMovement|updateEnemies|updateShots|cut)\s*=/.test(kineticPresentation),'kinetic presentation must not own authoritative mechanics');

expect(has(coach13,"VERSION='0.13.0'",'WASD · glide freely','hold SPACE · charge · release to dash','arrow key · sweep the tongue','opening blade frames · parry incoming fire'),'v0.13 onboarding does not teach the new grammar');
expect(!/mid-swing/i.test(coach13),'v0.13 coach still teaches retired midpoint parry timing');
expect(has(inputGuard,'event.repeat','stopImmediatePropagation'),'repeat-safe menu controls missing');
expect(has(competitive,'/api/sylvaria/run-ticket','/api/sylvaria/leaderboard/submit','Replay.envelope'),'competitive client incomplete');
expect(has(presentation,"version:'0.11.1'",'const baseRender=F.render'),'inherited restrained presentation compatibility missing');
expect(has(arcade,"version: 'v0.13.0'",'GLIDE · SWEEP · RETURN FIRE.','continuous pond movement','opening five active ticks','1160 px/s','reactive ai'),'Game Network metadata is not on reactive-blade v0.13');
expect(!/mid-swing/i.test(arcade),'Game Network metadata still teaches retired midpoint parry timing');
expect(has(profiler,'art-atlas-pro-v012.js'),'size profiler lost the professional pond atlas');

const authoritativeHash=crypto.createHash('sha256').update([model,rooms,world,movement,battle,synergy,kinetics,kineticAI].join('\n')).digest('hex');
if(errors.length){console.error(`Sylvaria v0.13 validation failed (${errors.length})`);for(const e of errors)console.error(` - ${e}`);process.exit(1)}
console.log(`Sylvaria v0.13 reactive blade validator PASS · 120 Hz deterministic engine · authoritative sha256 ${authoritativeHash}`);
