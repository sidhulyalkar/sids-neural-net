import fs from'node:fs';
import crypto from'node:crypto';
const root='public/game-runtimes/mosslight-v2',read=p=>fs.readFileSync(p,'utf8'),errors=[],expect=(ok,msg)=>{if(!ok)errors.push(msg)},has=(s,...xs)=>xs.every(x=>s.includes(x));
const html=read(`${root}/index.html`),model=read(`${root}/v091/model.js`),world=read(`${root}/v091/world.js`),movement=read(`${root}/v091/movement.js`),battle=read(`${root}/v091/battle-core.js`),boot=read(`${root}/v091/boot.js`),synergy=read(`${root}/v091/synergy-v010.js`),rooms=read(`${root}/v011/rooms-v011.js`),competitive=read(`${root}/v011/competitive-v011.js`),entry12=read(`${root}/v012-entry.js`),entry13=read(`${root}/v013-entry.js`),entry14=read(`${root}/v014-entry.js`),pond=read(`${root}/v012/webgl-pond-v012.js`),atlas=read(`${root}/v012/art-atlas-pro-v012.js`),kinetics=read(`${root}/v013/kinetic-combat-v013.js`),kineticAI=read(`${root}/v013/enemy-ai-v013.js`),replay13=read(`${root}/v013/replay-v013.js`),kineticPresentation=read(`${root}/v013/kinetic-presentation-v013.js`),rig14=read(`${root}/v014/character-rig-v014.js`),flow14=read(`${root}/v014/combat-flow-v014.js`),chargeIntent14=read(`${root}/v014/charge-intent-v014.js`),enemyFlow14=read(`${root}/v014/enemy-flow-v014.js`),enemyMastery14=read(`${root}/v014/enemy-mastery-v014.js`),bossFlow14=read(`${root}/v014/boss-flow-v014.js`),threat14=read(`${root}/v014/threat-manager-v014.js`),flowPresentation14=read(`${root}/v014/flow-presentation-v014.js`),presentationSpace14=read(`${root}/v014/presentation-space-v014.js`),readability14=read(`${root}/v014/combat-readability-v014.js`),arcade=read('src/data/arcadeGames.ts'),serverReplay=read('src/lib/sylvaria/replay.ts'),headless=read('src/lib/sylvaria/headless.ts');

expect(has(html,'<title>Sylvaria · Kinetic Pond</title>','v0.14 · unified kinetic combat','Reactive Blade','first five active simulation ticks','break boss guard','id="rankPanel"','id="rankedSubmit"'),'v0.14 playable shell incomplete');
expect(html.includes('<script type="module" src="./v014-entry.js"></script>'),'production shell must boot v014 entry');
expect(!/mid-swing|middle of the active sweep is the sweet spot/i.test(html),'player-facing shell still teaches retired midpoint parry timing');
expect(!html.includes('<script type="module" src="./v013-entry.js"></script>'),'production shell still boots the v0.13 entry directly');

expect(has(model,"VERSION='0.9.1'",'FIXED_DT=1/120','MAX_SHOTS=128','MAX_PENDING=72'),'fixed 120 Hz substrate or projectile caps changed');
expect((rooms.match(/\bR\('/g)||[]).length>=30,'30 authored arenas missing');
expect(has(world,'function terrainAt','function mobilityAt','function damageEnemy','function damageBoss','function spawnGasCloud','function updateGas'),'shared ecology/hazard substrate incomplete');
expect(has(boot,'while(accumulator>=FIXED_DT)','F.render()','requestAnimationFrame(frame)'),'fixed-step loop changed');

expect(has(entry13,"import'./v012-entry.js'","v013/kinetic-combat-v013.js","v013/enemy-ai-v013.js","v013/replay-v013.js","v013/kinetic-presentation-v013.js"),'v0.13 compatibility parent incomplete');
for(const module of['character-rig-v014.js','combat-flow-v014.js','charge-intent-v014.js','enemy-flow-v014.js','enemy-mastery-v014.js','boss-flow-v014.js','threat-manager-v014.js','flow-presentation-v014.js','presentation-space-v014.js','combat-readability-v014.js'])expect(entry14.includes(module),`v0.14 entry missing ${module}`);
expect(has(entry14,"window.SylvariaRankedDisabledReason='v0.14 replay verifier migration'",'version:VERSION,presentationVersion:PRESENTATION,ranked:false','unifiedCharacterRig:true','attachedReactiveBlade:true','logicalOverlayAlignment:true','largerProjectileReadability:true','advancedEnemyMastery:true','deterministicThreatOrchestration:true','bossGuardBreak:true'),'v0.14 identity or safe ranking boundary incomplete');
expect(entry14.indexOf('boss-flow-v014.js')<entry14.indexOf('threat-manager-v014.js'),'threat manager must wrap final boss flow');
expect(entry14.indexOf('flow-presentation-v014.js')<entry14.indexOf('presentation-space-v014.js')&&entry14.indexOf('presentation-space-v014.js')<entry14.indexOf('combat-readability-v014.js'),'screen-space normalization must wrap the complete tactical presentation before readability accents');
expect(has(competitive,'window.SylvariaRankedDisabledReason','if(unrankedReason())return null','current.unrankedReason','rankedDisabledReason:unrankedReason()||null'),'competitive client does not respect changed-engine ranking boundary');

expect(has(kinetics,'moveSpeed:238','acceleration:1880','braking:12.5','turnGrip:15.5','dashDecay:.90483742','dashTicksMin:12','dashTicksMax:22','dashDistanceMin:78','dashDistanceMax:154','arcDegrees:156','arcWindup:3/120','arcActive:15/120','parryWindow:5/120','perfectReflectSpeed:1160','function arcSweepContains','function counterShotArc'), 'v0.13 Reactive Blade substrate changed unexpectedly');
expect(has(flow14,"FLOW_VERSION='0.14.0'",'bladeBuffer:7/120','dashCommitTicks:4','dashSteerBlend:.055','dashSteerMaxRadians:.38','parryDashRefund:12/120','recoveryTicksAtFullFlow:7','minimumReleaseCharge:.12','lastParryDashRefund','maxVelocityAlignmentError','maxScalarSpeedError'),'v0.14 player combat flow incomplete');
expect(has(chargeIntent14,"CHARGE_INTENT_VERSION='0.14.0'",'retargetTicks:24','v014ChargeCommittedVector','v014ChargeCandidateVector','v014ChargeCandidateTicks','state.heldMoves=heldSetForVector(committed)','state.heldMoves=realHeld'),'v0.14 charged dash intent ownership incomplete');
expect(!/requestAnimationFrame|performance\.now|Date\.now|Math\.random|setTimeout/.test(chargeIntent14),'charged dash intent contains browser-clock/random gameplay APIs');
expect(!/requestAnimationFrame|performance\.now|Date\.now|Math\.random/.test(flow14),'v0.14 player mechanics contain non-deterministic clock/random APIs');

expect(has(rig14,"CHARACTER_RIG_VERSION='0.14.0'",'SPRITE_FORWARD_OFFSET=Math.PI/2','function poseFor','function mouthForAttack','function attachmentError','mouth:Object.freeze(mouth)','root:Object.freeze({x:q(p.x),y:q(p.y)})'),'shared frog rig incomplete');
expect(has(pond,'window.SylvariaCharacterRig?.pose?.(p)',"emit('frog',body.x,body.y,body.w,body.h",'rot:body.rotation','foot:body.foot'),'WebGL frog does not consume shared rig');
expect(has(kineticPresentation,'rig?.mouthForAttack','tip=anglePoint(root,a,length)','tongueAttachmentError:lastTongueAttachmentError','function resetRoomPresentation','holdFrames=0;lastHitStopSerial=state.hitStopSerial||0'),'Reactive Blade presentation is not attached to shared mouth/root or does not reset per room');
expect(has(flowPresentation14,'function resetRoomPresentation','holdFrames=0;lastHitStopSerial=state.hitStopSerial||0'),'v0.14 tactical overlay carries stale hit-stop across rooms');
expect(has(presentationSpace14,"PRESENTATION_SPACE_VERSION='0.14.0'","OVERLAY_IDS=Object.freeze(['kineticCanvas','flowCanvas'])",'window.SylvariaDisplayScale?.scale','ctx?.setTransform(scale,0,0,scale,0,0)','function logicalToClient','function clientToLogical'),'DPR-safe logical presentation space is missing');
expect(!/requestAnimationFrame|performance\.now|Date\.now|Math\.random/.test(rig14),'character rig must remain simulation-derived');

expect(has(enemyFlow14,'reactionTicks:12','reactionTicks:9','reactionTicks:14','punishMultiplier:1.35','spec.dodge=100','v014PunishTimer'),'fixed enemy evade/punish grammar incomplete');
expect(has(enemyMastery14,"ENEMY_MASTERY_VERSION='0.14.0'",'striderWhiffPunishTicks:28','sniperCounterPunishTicks:32','shellbackRearMultiplier:1.35','WHIFF OPEN','LINE BROKEN','FLANK'),'advanced elite mastery grammar incomplete');
expect(!/requestAnimationFrame|performance\.now|Date\.now|setTimeout|Math\.random/.test(enemyMastery14),'elite mastery must remain fixed-step deterministic');
expect(has(threat14,"THREAT_MANAGER_VERSION='0.14.0'",'coverage:2,engage:1,precision:2,heavy:3,support:1,light:0','ROOM_PROFILE_TITLES','ROOM_THREAT_PROFILES','gapMin','gapMax','candidateSort','chooseBeat','holdWaitingThreats','punishGraceUntil','actor===state.boss'),'30-room threat orchestration incomplete');
const explicitThreatProfiles=(threat14.match(/\bP\(/g)||[]).length;
expect(explicitThreatProfiles===30,`threat manager must contain exactly 30 explicit room profiles, found ${explicitThreatProfiles}`);
expect(!/requestAnimationFrame|performance\.now|Date\.now|setTimeout|Math\.random/.test(threat14),'threat scheduling must be fixed-step deterministic');

expect(has(readability14,"COMBAT_READABILITY_VERSION='0.14.0'",'saw:Object.freeze({radius:11.5,halo:19','reflected:Object.freeze({radius:12.5,halo:21','function drawProjectiles','function drawKineticThreats',"field.textContent='clear'",'alive.length'),'combat readability layer incomplete');
expect(!/\b(?:s|shot)\.r\s*=/.test(readability14),'combat readability must never mutate authoritative projectile radii');
expect(has(kineticAI,"r:kind==='saw'?8:6"),'authoritative kinetic projectile hitboxes changed while enlarging visuals');

expect(has(bossFlow14,'guardByPhase:Object.freeze({1:3,2:4,3:5})','punishTicksByPhase:Object.freeze({1:36,2:30,3:24})','bladePunishMultiplier:1.35','guardedHpMultiplier:0','perfectReturnGuardDamage:2','hazardGuardDamage:1','telegraphDashCutGuardDamage:1',"'CORE OPEN'",'b.v014PunishTimer','b.telegraph=0','function rejectGuardedDamage'),'boss guard-break loop incomplete');
expect(!/state\.shots\s*=|\.shots\.splice|shot\.dead/.test(bossFlow14),'boss opening must not manufacture safety by deleting bullets');
expect(has(flowPresentation14,'function drawBossIntent','function drawBossFlow','b.v014GuardMax','b.v014PunishTimer','bossCues'),'boss guard/intent lacks entity-local presentation');
expect(!/requestAnimationFrame|performance\.now|Date\.now|setTimeout|Math\.random/.test(bossFlow14),'boss flow must remain fixed-step deterministic');

expect(has(replay13,"VERSION='0.13.0'",'SCHEMA=2','space:[12,13]'),'v0.13 replay compatibility contract damaged');
expect(has(serverReplay,'SYLVARIA_REPLAY_SCHEMA = 2','SYLVARIA_ENGINE_VERSION = \'0.13.0\''),'server verifier identity changed without migration');
expect(has(headless,'v013/kinetic-combat-v013.js','v013/enemy-ai-v013.js','SylvariaHeadlessVerifier/0.13.0'),'legacy exact-source verifier no longer clearly v0.13');

expect(has(entry12,"PRESENTATION='0.12.0',ENGINE='0.11.1'",'createPondRenderer'),'v0.12 graphics parent incomplete');
expect(has(pond,'MAX_SPRITES=900,MAX_LIGHTS=6',"getContext('webgl2'",'uHeight','gl.bufferSubData','canvas-fallback'),'WebGL2 pond renderer incomplete');
expect(!/F\.(?:update|cut|dashStep|counterShot)\s*=/.test(pond),'WebGL renderer must not own authoritative mechanics');
expect(!atlas.includes('Math.random'),'visual asset generation must be deterministic');
expect(has(synergy,'function triggerReturnEcology','function hazardScoreAt','function bulldozeBoss'),'ecology interaction layer incomplete');

expect(has(arcade,"version: 'v0.14.0'",'CARVE · COUNTER · CREATE THE OPENING.','one character rig','threat phrases','boss guard breaks','ranked submission is temporarily paused'),'Game Network metadata does not describe v0.14 truthfully');
expect(!/verified leaderboard/.test(arcade.slice(arcade.indexOf("slug: 'sylvaria'"))),'v0.14 arcade metadata still claims the old verified leaderboard');

const authoritativeHash=crypto.createHash('sha256').update([model,rooms,world,movement,battle,synergy,kinetics,kineticAI,flow14,chargeIntent14,enemyFlow14,enemyMastery14,bossFlow14,threat14].join('\n')).digest('hex');
if(errors.length){console.error(`Sylvaria v0.14 validation failed (${errors.length})`);for(const e of errors)console.error(` - ${e}`);process.exit(1)}
console.log(`Sylvaria v0.14 production validator PASS · unified DPR-safe rig · larger collision-neutral projectile cues · elite mastery · 120 Hz combat · 30 authored threat profiles · deterministic boss guard · authoritative sha256 ${authoritativeHash}`);
