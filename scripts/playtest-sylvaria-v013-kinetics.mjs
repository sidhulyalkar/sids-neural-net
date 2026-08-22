import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_KINETICS_DIR||'artifacts/sylvaria-v013-kinetics';fs.mkdirSync(outputDir,{recursive:true});
const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message)};
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
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

// Diagonal charged dash remains one continuous velocity system rather than a scripted second locomotion mode.
await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.setPlayerPosition(320,390));
await page.keyboard.down('d');await page.keyboard.down('w');await page.waitForTimeout(85);await page.keyboard.down('Space');await page.waitForTimeout(405);
const charge=await page.evaluate(()=>window.SylvariaKinetics.snapshot());await page.keyboard.up('Space');await page.waitForTimeout(28);const burst=await page.evaluate(()=>({kinetics:window.SylvariaKinetics.snapshot(),player:{...window.Sylvaria091.state.player},dashes:window.Sylvaria091.state.stats.dashes}));await page.keyboard.up('d');await page.keyboard.up('w');
check(charge.dashCharging&&charge.dashCharge>.48,`dash charge did not accumulate under held steering: ${JSON.stringify(charge)}`);
check((burst.kinetics.velocity?.speed||0)>520,`charged burst failed to exceed minimum dash velocity: ${JSON.stringify(burst.kinetics)}`);
check(burst.player.vx>200&&burst.player.vy<-200,`charged diagonal burst lost steering vector: vx=${burst.player.vx}, vy=${burst.player.vy}`);
check(burst.dashes===1,`charge/release should create exactly one dash, saw ${burst.dashes}`);

// A real projectile meets the middle of a rightward sweep and returns at the v0.13 perfect speed.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(0,1);p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(300,330);p.spawnCounterShot('right',70,{speed:180,pattern:'straight'})});
await page.keyboard.press('ArrowRight');await page.waitForTimeout(132);
const reflect=await page.evaluate(()=>({shots:window.__MOSSLIGHT_PLAYTEST__.snapshot().shots,stats:{...window.Sylvaria091.state.stats},arc:window.SylvariaKinetics.snapshot().arc,presentation:window.SylvariaKineticPresentation.snapshot()}));
const returned=reflect.shots.find(shot=>shot.friendly);
check(Boolean(returned),`timed tongue sweep did not reflect projectile: ${JSON.stringify(reflect.shots)}`);
check(returned&&Math.abs(returned.speed-1120)<1,`mid-swing return speed expected 1120, got ${returned?.speed}`);
check(returned?.counterQuality==='perfect',`mid-swing return was not classified perfect: ${returned?.counterQuality}`);
check(reflect.stats.perfectCounters>=1,'perfect counter stat did not increment');
check(reflect.presentation.renderedArcs>0,'kinetic presentation did not observe the active sweep');

// The moving arc damages enemies spatially, not by a piston-line proxy.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(0,1);p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(300,330);const id=p.spawnTestEnemy('foreman',366,330,'arc-hit-target');const e=window.Sylvaria091.state.enemies.find(x=>x.id===id);e.state='recover';e.counterStagger=9});
const hpBefore=await page.evaluate(()=>window.Sylvaria091.state.enemies.find(e=>e.id==='arc-hit-target').hp);await page.keyboard.press('ArrowRight');await page.waitForTimeout(190);const hpAfter=await page.evaluate(()=>window.Sylvaria091.state.enemies.find(e=>e.id==='arc-hit-target').hp);
check(hpAfter<hpBefore,`arc sweep did not damage nearby target: ${hpBefore} -> ${hpAfter}`);

// Strider sees the authored sweep during wind-up and commits a terrain-safe dodge.
const striderSetup=await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(1,2);p.labClearGeometry();p.setPlayerPosition(300,330);const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.kineticType==='strider');for(const other of G.state.enemies)if(other!==e)other.dead=true;e.x=366;e.y=330;e.state='move';e.arcDodgeCooldown=0;e.kineticEvade=null;for(let seed=1;seed<500;seed++){const probe={rngState:seed};if(G.entityRand(probe)<.5){e.rngState=seed;break}}return{id:e.id,x:e.x,y:e.y,dodges:G.state.stats.enemyArcDodges||0}});await page.keyboard.press('ArrowRight');await page.waitForTimeout(310);const striderAfter=await page.evaluate(id=>{const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.id===id);return{x:e.x,y:e.y,state:e.state,dodges:G.state.stats.enemyArcDodges||0}},striderSetup.id);
check(striderAfter.dodges>striderSetup.dodges,`Strider did not commit predictive arc dodge: ${JSON.stringify({striderSetup,striderAfter})}`);
check(Math.hypot(striderAfter.x-striderSetup.x,striderAfter.y-striderSetup.y)>28,`Strider dodge displacement too small: ${JSON.stringify({striderSetup,striderAfter})}`);

// Shellback frontal armor matters while flank and reflected fire remain valid answers.
const shell=await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(4,5);p.labClearGeometry();const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.kineticType==='shellback');for(const other of G.state.enemies)if(other!==e)other.dead=true;e.x=520;e.y=330;e.facingAngle=0;e.hp=e.maxHp;G.state.player.x=570;G.state.player.y=330;const hp=e.hp;G.fn.damageEnemy(e,1,{x:1,y:0},{melee:true,arc:true});const frontLoss=hp-e.hp;e.hp=hp;G.state.player.x=470;G.fn.damageEnemy(e,1,{x:-1,y:0},{melee:true,arc:true});const flankLoss=hp-e.hp;e.hp=hp;G.state.player.x=570;G.fn.damageEnemy(e,1,{x:1,y:0},{counterShot:true});const reflectedLoss=hp-e.hp;return{frontLoss,flankLoss,reflectedLoss,shellBlocks:G.state.stats.shellBlocks||0}});
check(shell.frontLoss<shell.flankLoss*.35,`Shellback front armor ineffective: ${JSON.stringify(shell)}`);
check(shell.flankLoss>.9,`Shellback flank hit unexpectedly reduced: ${JSON.stringify(shell)}`);
check(shell.reflectedLoss>shell.flankLoss,`reflected fire should punish Shellback harder than a flank swipe: ${JSON.stringify(shell)}`);
check(shell.shellBlocks>=1,'Shellback block stat/cue did not register');

// Sniper creates genuinely faster precision lanes, increasing counter timing pressure.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(3,4);p.labClearGeometry();const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.kineticType==='sniper');for(const other of G.state.enemies)if(other!==e)other.dead=true;e.x=700;e.y=330;e.state='move';e.clock=.001;G.state.player.x=300;G.state.player.y=330});await page.waitForTimeout(470);const sniper=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot().shots.map(s=>({speed:s.speed,pattern:s.pattern,kind:s.kind})));
check(sniper.some(shot=>shot.speed>=530),`Dragonfly sniper did not create high-velocity precision fire: ${JSON.stringify(sniper)}`);

// Water currents move an idle frog gradually and remain deterministic world pressure rather than teleportation.
await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(0,1);p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(360,330);p.placeTerrain('water',360,330,100)});const currentBefore=await page.evaluate(()=>({x:window.Sylvaria091.state.player.x,y:window.Sylvaria091.state.player.y}));await page.waitForTimeout(260);const currentAfter=await page.evaluate(()=>({x:window.Sylvaria091.state.player.x,y:window.Sylvaria091.state.player.y,v:window.SylvariaKinetics.snapshot().velocity,current:window.SylvariaKinetics.snapshot().current}));
check(Math.hypot(currentAfter.x-currentBefore.x,currentAfter.y-currentBefore.y)>.3,`water current did not alter idle positioning: ${JSON.stringify({currentBefore,currentAfter})}`);
check(Math.hypot(currentAfter.x-currentBefore.x,currentAfter.y-currentBefore.y)<25,`water current displaced frog too violently: ${JSON.stringify({currentBefore,currentAfter})}`);

await page.waitForTimeout(220);const final=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot());check(final.fps>=42,`kinetic combat lab FPS fell below 42: ${final.fps}`);check(final.shots.length<=128&&final.pendingShots<=72,`projectile caps exceeded: ${final.shots.length}/${final.pendingShots}`);for(const error of pageErrors)failures.push(`pageerror: ${error}`);
await page.screenshot({path:path.join(outputDir,'kinetic-combat-lab-v013.png'),fullPage:true});
const report={movementSamples,released,coasted,charge,burst:{speed:burst.kinetics.velocity?.speed,vx:burst.player.vx,vy:burst.player.vy},reflect:{speed:returned?.speed,quality:returned?.counterQuality,perfectCounters:reflect.stats.perfectCounters},enemyArcHit:{hpBefore,hpAfter},strider:{before:striderSetup,after:striderAfter},shellback:shell,sniperShots:sniper,current:{before:currentBefore,after:currentAfter},fps:final.fps,caps:{shots:final.shots.length,pending:final.pendingShots},failures};fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.13 kinetics lab failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.13 kinetics lab PASS · glide coast ${released.toFixed(1)}→${coasted.toFixed(1)} px/s · diagonal burst ${burst.kinetics.velocity.speed.toFixed(1)} px/s · perfect arc return ${returned.speed.toFixed(0)} px/s · Strider dodge ${Math.hypot(striderAfter.x-striderSetup.x,striderAfter.y-striderSetup.y).toFixed(1)} px · Shellback front/flank/return ${shell.frontLoss.toFixed(2)}/${shell.flankLoss.toFixed(2)}/${shell.reflectedLoss.toFixed(2)} · FPS ${final.fps.toFixed(1)}.`);