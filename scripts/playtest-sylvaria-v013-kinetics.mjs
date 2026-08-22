import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_KINETICS_DIR||'artifacts/sylvaria-v013-kinetics';fs.mkdirSync(outputDir,{recursive:true});
const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message)};
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));

async function waitForValue(fn,arg=null,timeout=1000){const handle=await page.waitForFunction(fn,arg,{timeout});try{return await handle.jsonValue()}finally{await handle.dispose()}}
async function dispatchKey(type,key,code){return page.evaluate(({type,key,code})=>{const canvas=document.getElementById('c');canvas?.focus?.();const target=document.activeElement||canvas||document;target.dispatchEvent(new KeyboardEvent(type,{key,code,bubbles:true,cancelable:true}))},{type,key,code})}

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?kinetics-lab=1`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.13.0'&&window.SylvariaKinetics?.version==='0.13.0'&&window.SylvariaKineticAI?.version==='0.13.0'&&window.SylvariaKineticPresentation?.version==='0.13.0');
await page.click('#start');await page.locator('#c').focus();

// Clean, unobstructed lab floor so movement measurements test kinetics rather than room geometry.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(300,340)});
const movementSamples=[];
await page.keyboard.down('d');
for(let i=0;i<6;i++){await page.waitForTimeout(34);movementSamples.push(await page.evaluate(()=>({x:window.Sylvaria091.state.player.x,y:window.Sylvaria091.state.player.y,vx:window.Sylvaria091.state.player.vx,vy:window.Sylvaria091.state.player.vy,dashes:window.Sylvaria091.state.stats.dashes})))}
await page.keyboard.up('d');const released=await page.evaluate(()=>Math.hypot(window.Sylvaria091.state.player.vx,window.Sylvaria091.state.player.vy));await page.waitForTimeout(150);const coasted=await page.evaluate(()=>Math.hypot(window.Sylvaria091.state.player.vx,window.Sylvaria091.state.player.vy));
check(movementSamples.every((sample,index)=>index===0||sample.x>movementSamples[index-1].x),`continuous D glide did not advance monotonically: ${JSON.stringify(movementSamples)}`);
check(movementSamples.at(-1).x-movementSamples[0].x>20,`continuous glide covered too little ground: ${JSON.stringify(movementSamples)}`);
check(movementSamples.every(sample=>sample.dashes===0),'ordinary held movement incremented dash count');
check(released>80&&coasted<released,`release drag did not produce a smooth coast: ${released} -> ${coasted}`);

// Diagonal charged dash uses one exponentially decaying velocity burst rather than a scripted locomotion mode.
await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.setPlayerPosition(320,390));
await page.keyboard.down('d');await page.keyboard.down('w');await page.waitForTimeout(85);await page.keyboard.down('Space');await page.waitForTimeout(405);
const charge=await page.evaluate(()=>window.SylvariaKinetics.snapshot());await page.keyboard.up('Space');await page.waitForTimeout(8);
const dashDecaySamples=[];
for(let i=0;i<5;i++){dashDecaySamples.push(await page.evaluate(()=>{const k=window.SylvariaKinetics.snapshot(),p=window.Sylvaria091.state.player;return{speed:k.dash?.speed??null,ticksLeft:k.dash?.ticksLeft??0,vx:p.vx,vy:p.vy,dashes:window.Sylvaria091.state.stats.dashes}}));await page.waitForTimeout(17)}
const burst=await page.evaluate(()=>({kinetics:window.SylvariaKinetics.snapshot(),player:{...window.Sylvaria091.state.player},dashes:window.Sylvaria091.state.stats.dashes}));await page.keyboard.up('d');await page.keyboard.up('w');
const liveDecay=dashDecaySamples.filter(sample=>Number.isFinite(sample.speed));
check(charge.dashCharging&&charge.dashCharge>.48,`dash charge did not accumulate under held steering: ${JSON.stringify(charge)}`);
check(liveDecay.length>=3,`dash ended before exponential decay could be measured: ${JSON.stringify(dashDecaySamples)}`);
check(liveDecay.every((sample,index)=>index===0||sample.speed<liveDecay[index-1].speed),`dash speed did not decay monotonically: ${JSON.stringify(liveDecay)}`);
check((liveDecay[0]?.speed||0)>520,`charged burst failed to create a high-speed opening impulse: ${JSON.stringify(liveDecay)}`);
check(liveDecay[0]?.vx>200&&liveDecay[0]?.vy<-200,`charged diagonal burst lost steering vector: ${JSON.stringify(liveDecay[0])}`);
check(burst.dashes===1,`charge/release should create exactly one dash, saw ${burst.dashes}`);

// Buffer semantics are a fixed-step contract. Put the player exactly six ticks from cooldown completion,
// dispatch real Space down/up events synchronously, then capture the state that executes the queued dash.
const dashesBeforeBuffer=await page.evaluate(()=>{const G=window.Sylvaria091,p=G.state.player;p.dash=null;p.dashCharging=false;p.dashCharge=0;p.dashBuffer=0;p.dashBufferHeld=false;p.dashBufferReleased=false;p.dashCooldown=6/120;p.vx=0;p.vy=0;return G.state.stats.dashes});
const buffered=await page.evaluate(()=>{const canvas=document.getElementById('c');canvas?.focus?.();const target=document.activeElement||canvas||document;for(const type of['keydown','keyup'])target.dispatchEvent(new KeyboardEvent(type,{key:' ',code:'Space',bubbles:true,cancelable:true}));return window.SylvariaKinetics.snapshot()});
check(buffered.dashBuffered===true||buffered.dashBuffer>0,`Space intent did not buffer during recovery: ${JSON.stringify(buffered)}`);
const bufferedExecuted=await waitForValue(base=>{const G=window.Sylvaria091,k=window.SylvariaKinetics.snapshot(),p=G.state.player;if(G.state.stats.dashes!==base+1)return false;return{...k,liveSpeed:Math.hypot(p.vx,p.vy)}},dashesBeforeBuffer,700);
check(bufferedExecuted.dashing===true||bufferedExecuted.liveSpeed>238,`buffered dash did not execute when cooldown cleared: ${JSON.stringify(bufferedExecuted)}`);

// A committed dash can cancel into a faster tongue wind-up after four simulation ticks.
// Synchronize the input to the authoritative dash elapsed-tick state rather than a wall-clock sleep.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;p.setPlayerPosition(300,330);const player=G.state.player;player.dash=null;player.dashCooldown=0;player.dashCharging=false;player.dashCharge=0;player.cutCooldown=0;player.vx=0;player.vy=0});
await page.keyboard.down('d');await page.keyboard.down('Space');
await page.waitForFunction(()=>{const k=window.SylvariaKinetics.snapshot();return k.dashCharging&&k.dashCharge>=.32},{timeout:700});
await page.keyboard.up('Space');
const dashCancel=await page.evaluate(()=>new Promise((resolve,reject)=>{let frames=0;const poll=()=>{const k=window.SylvariaKinetics.snapshot();if(k.dashing&&(k.dash?.elapsedTicks??0)>=4){const canvas=document.getElementById('c');canvas?.focus?.();const target=document.activeElement||canvas||document;for(const type of['keydown','keyup'])target.dispatchEvent(new KeyboardEvent(type,{key:'ArrowRight',code:'ArrowRight',bubbles:true,cancelable:true}));queueMicrotask(()=>{const now=window.SylvariaKinetics.snapshot(),p=window.Sylvaria091.state.player;resolve({kinetics:now,player:{dash:Boolean(p.dash),dashEcho:p.dashEcho,vx:p.vx,vy:p.vy}})});return}if(++frames>120){reject(new Error(`dash never reached four committed ticks: ${JSON.stringify(k)}`));return}requestAnimationFrame(poll)};requestAnimationFrame(poll)}));
await page.keyboard.up('d');
check(dashCancel.kinetics.arc?.dashCancelled===true,`dash did not cancel into blade: ${JSON.stringify(dashCancel)}`);
check(dashCancel.player.dash===false&&dashCancel.player.dashEcho>0,`dash cancel did not transition through blade-cancel echo state: ${JSON.stringify(dashCancel.player)}`);

// A real projectile meets the opening five active ticks of a rightward sweep and returns at 1160 px/s.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(0,1);p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(300,330);window.Sylvaria091.state.player.cutCooldown=0;p.spawnCounterShot('right',70,{speed:180,pattern:'straight'})});
const parriesBefore=await page.evaluate(()=>window.Sylvaria091.state.stats.perfectCounters||0),visualStopsBefore=await page.evaluate(()=>window.SylvariaKineticPresentation.snapshot().hitStopsRendered||0);await page.keyboard.press('ArrowRight');
await page.waitForFunction(base=>(window.Sylvaria091.state.stats.perfectCounters||0)>base,parriesBefore,{timeout:450});
await page.waitForFunction(base=>(window.SylvariaKineticPresentation.snapshot().hitStopsRendered||0)>base,visualStopsBefore,{timeout:900});
const reflect=await page.evaluate(()=>({shots:window.__MOSSLIGHT_PLAYTEST__.snapshot().shots,stats:{...window.Sylvaria091.state.stats},arc:window.SylvariaKinetics.snapshot().arc,presentation:window.SylvariaKineticPresentation.snapshot(),hitStop:window.SylvariaKinetics.snapshot().hitStop}));
const returned=reflect.shots.find(shot=>shot.friendly);
check(Boolean(returned),`opening tongue parry did not reflect projectile: ${JSON.stringify(reflect.shots)}`);
check(returned&&Math.abs(returned.speed-1160)<1,`opening parry return speed expected 1160, got ${returned?.speed}`);
check(returned?.counterQuality==='perfect',`opening parry return was not classified perfect: ${returned?.counterQuality}`);
check(reflect.stats.perfectCounters>parriesBefore,'perfect counter stat did not increment');
check(reflect.presentation.overlay===true,'kinetic presentation overlay missing during Reactive Blade qualification');
check(reflect.hitStop?.kind==='parry'&&reflect.hitStop?.ticks===4,`parry did not emit heavy hit-stop signal: ${JSON.stringify(reflect.hitStop)}`);
check((reflect.presentation.hitStopsRendered||0)>visualStopsBefore,'presentation did not consume the parry hit-stop signal');
check(reflect.presentation.lastHitStopKind==='parry'&&reflect.presentation.lastHoldFramesApplied===3,`parry presentation did not apply the three-frame visual hold: ${JSON.stringify(reflect.presentation)}`);

// A projectile placed on the later active sweep must stay hostile: later tongue frames are offense, not a giant parry cone.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(0,1);p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(300,330);window.Sylvaria091.state.player.cutCooldown=0});
await page.keyboard.press('ArrowRight');
await page.waitForFunction(()=>{const a=window.SylvariaKinetics.snapshot().arc;return a?.phase==='active'&&a.phaseTime>(a.parryWindow+.018)},{timeout:300});
const lateShotIndex=await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,a=window.SylvariaKinetics.snapshot().arc,pl=G.state.player,angle=a.angle;p.spawnCounterShot('right',62,{speed:150,pattern:'straight'});const s=G.state.shots.at(-1);s.x=pl.x+Math.cos(angle)*62;s.y=pl.y+Math.sin(angle)*62;s.vx=-Math.cos(angle)*150;s.vy=-Math.sin(angle)*150;s.baseSpeed=150;return G.state.shots.length-1});
await page.waitForTimeout(25);
const lateShot=await page.evaluate(index=>{const s=window.Sylvaria091.state.shots[index];return s?{friendly:s.friendly,dead:s.dead,x:s.x,y:s.y,counterQuality:s.counterQuality}:null},lateShotIndex);
check(lateShot&&!lateShot.friendly,`late active-sweep projectile incorrectly parried: ${JSON.stringify(lateShot)}`);

// The later moving arc still damages enemies spatially after the five-tick parry window has closed.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;p.setRoom(0,1);p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(300,330);G.state.player.cutCooldown=0;const angle=1.2,r=70,id=p.spawnTestEnemy('foreman',300+Math.cos(angle)*r,330+Math.sin(angle)*r,'arc-hit-target');const e=G.state.enemies.find(x=>x.id===id);e.state='recover';e.counterStagger=9});
const hpBefore=await page.evaluate(()=>window.Sylvaria091.state.enemies.find(e=>e.id==='arc-hit-target').hp);await page.keyboard.press('ArrowRight');await page.waitForTimeout(190);const directHit=await page.evaluate(()=>({hp:window.Sylvaria091.state.enemies.find(e=>e.id==='arc-hit-target').hp,hitStop:window.SylvariaKinetics.snapshot().hitStop}));
check(directHit.hp<hpBefore,`later arc sweep did not damage nearby target: ${hpBefore} -> ${directHit.hp}`);
check(directHit.hitStop?.kind==='enemy'&&directHit.hitStop?.ticks===1,`direct blade hit did not emit light hit-stop signal: ${JSON.stringify(directHit.hitStop)}`);

// Strider sees the authored sweep during wind-up and commits a terrain-safe dodge.
const striderSetup=await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(1,2);p.labClearGeometry();p.setPlayerPosition(300,330);const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.kineticType==='strider');for(const other of G.state.enemies)if(other!==e)other.dead=true;e.x=366;e.y=330;e.state='move';e.arcDodgeCooldown=0;e.kineticEvade=null;for(let seed=1;seed<500;seed++){const probe={rngState:seed};if(G.entityRand(probe)<.5){e.rngState=seed;break}}return{id:e.id,x:e.x,y:e.y,dodges:G.state.stats.enemyArcDodges||0}});await page.keyboard.press('ArrowRight');await page.waitForTimeout(310);const striderAfter=await page.evaluate(id=>{const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.id===id);return{x:e.x,y:e.y,state:e.state,dodges:G.state.stats.enemyArcDodges||0}},striderSetup.id);
check(striderAfter.dodges>striderSetup.dodges,`Strider did not commit predictive arc dodge: ${JSON.stringify({striderSetup,striderAfter})}`);
check(Math.hypot(striderAfter.x-striderSetup.x,striderAfter.y-striderSetup.y)>28,`Strider dodge displacement too small: ${JSON.stringify({striderSetup,striderAfter})}`);

// Shellback is a relative armor puzzle: front armor must heavily suppress a normal flank hit,
// while reflected fire remains the strongest answer. Absolute damage is owned by shared enemy scaling.
const shell=await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(4,5);p.labClearGeometry();const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.kineticType==='shellback');for(const other of G.state.enemies)if(other!==e)other.dead=true;e.x=520;e.y=330;e.facingAngle=0;e.hp=e.maxHp;G.state.player.x=570;G.state.player.y=330;const hp=e.hp;G.fn.damageEnemy(e,1,{x:1,y:0},{melee:true,arc:true});const frontLoss=hp-e.hp;e.hp=hp;G.state.player.x=470;G.fn.damageEnemy(e,1,{x:-1,y:0},{melee:true,arc:true});const flankLoss=hp-e.hp;e.hp=hp;G.state.player.x=570;G.fn.damageEnemy(e,1,{x:1,y:0},{counterShot:true});const reflectedLoss=hp-e.hp;return{frontLoss,flankLoss,reflectedLoss,shellBlocks:G.state.stats.shellBlocks||0}});
check(shell.frontLoss<shell.flankLoss*.35,`Shellback front armor ineffective: ${JSON.stringify(shell)}`);
check(shell.flankLoss>shell.frontLoss*3,`Shellback flank did not meaningfully outperform frontal armor contact: ${JSON.stringify(shell)}`);
check(shell.reflectedLoss>shell.flankLoss,`reflected fire should punish Shellback harder than a flank swipe: ${JSON.stringify(shell)}`);
check(shell.shellBlocks>=1,'Shellback block stat/cue did not register');

// Sniper creates genuinely faster precision lanes, increasing parry timing pressure.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(3,4);p.labClearGeometry();const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.kineticType==='sniper');for(const other of G.state.enemies)if(other!==e)other.dead=true;e.x=700;e.y=330;e.state='move';e.clock=.001;G.state.player.x=300;G.state.player.y=330});await page.waitForTimeout(470);const sniper=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot().shots.map(s=>({speed:s.speed,pattern:s.pattern,kind:s.kind})));
check(sniper.some(shot=>shot.speed>=530),`Dragonfly sniper did not create high-velocity precision fire: ${JSON.stringify(sniper)}`);

// Water currents move an idle frog gradually and remain deterministic world pressure rather than teleportation.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(0,1);p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(360,330);p.placeTerrain('water',360,330,100)});const currentBefore=await page.evaluate(()=>({x:window.Sylvaria091.state.player.x,y:window.Sylvaria091.state.player.y}));await page.waitForTimeout(260);const currentAfter=await page.evaluate(()=>({x:window.Sylvaria091.state.player.x,y:window.Sylvaria091.state.player.y,v:window.SylvariaKinetics.snapshot().velocity,current:window.SylvariaKinetics.snapshot().current}));
check(Math.hypot(currentAfter.x-currentBefore.x,currentAfter.y-currentBefore.y)>.3,`water current did not alter idle positioning: ${JSON.stringify({currentBefore,currentAfter})}`);
check(Math.hypot(currentAfter.x-currentBefore.x,currentAfter.y-currentBefore.y)<25,`water current displaced frog too violently: ${JSON.stringify({currentBefore,currentAfter})}`);

// Software-rendered CI FPS is diagnostic, not an authoritative gameplay-performance gate.
// The cross-browser renderer matrix owns startup/render qualification; this lab owns 120 Hz combat semantics.
await page.waitForTimeout(220);const final=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot());check(Number.isFinite(final.fps)&&final.fps>0,`runtime stopped reporting presentation FPS: ${final.fps}`);check(final.shots.length<=128&&final.pendingShots<=72,`projectile caps exceeded: ${final.shots.length}/${final.pendingShots}`);for(const error of pageErrors)failures.push(`pageerror: ${error}`);
await page.screenshot({path:path.join(outputDir,'reactive-blade-combat-lab-v013.png'),fullPage:true});
const report={movementSamples,released,coasted,charge,dashDecaySamples,burst:{speed:burst.kinetics.velocity?.speed,vx:burst.player.vx,vy:burst.player.vy},buffered,bufferedExecuted,dashCancel,parry:{speed:returned?.speed,quality:returned?.counterQuality,perfectCounters:reflect.stats.perfectCounters,hitStop:reflect.hitStop,visualHitStops:reflect.presentation.hitStopsRendered},lateShot,directHit:{hpBefore,hpAfter:directHit.hp,hitStop:directHit.hitStop},strider:{before:striderSetup,after:striderAfter},shellback:shell,sniperShots:sniper,current:{before:currentBefore,after:currentAfter},fpsDiagnostic:final.fps,caps:{shots:final.shots.length,pending:final.pendingShots},failures};fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.13 Reactive Blade kinetics lab failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.13 Reactive Blade lab PASS · glide coast ${released.toFixed(1)}→${coasted.toFixed(1)} px/s · opening dash ${liveDecay[0].speed.toFixed(1)} px/s with monotonic exponential decay · buffered dash executed · dash→blade cancel verified · opening parry ${returned.speed.toFixed(0)} px/s · late projectile stayed hostile · Strider dodge ${Math.hypot(striderAfter.x-striderSetup.x,striderAfter.y-striderSetup.y).toFixed(1)} px · Shellback front/flank/return ${shell.frontLoss.toFixed(2)}/${shell.flankLoss.toFixed(2)}/${shell.reflectedLoss.toFixed(2)} · headless FPS diagnostic ${final.fps.toFixed(1)}.`);