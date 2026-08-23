import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const root='public/game-runtimes/sylvaria-v3';
const html=read(`${root}/index.html`);
const config=read(`${root}/config-v3.js`);
const input=read(`${root}/input-v3.js`);
const world=read(`${root}/world-v3.js`);
const routes=read(`${root}/routes-v3.js`);
const engine=read(`${root}/engine-v3.js`);
const feel=read(`${root}/engine-feel-v3.js`);
const sapline=read(`${root}/engine-sapline-v3.js`);
const routeEngine=read(`${root}/engine-routes-v3.js`);
const render=read(`${root}/render-v3.js`);
const motion=read(`${root}/render-motion-v3.js`);
const routeRender=read(`${root}/render-routes-v3.js`);
const boot=read(`${root}/game-v3.js`);

test('Sylvaria v3.2 is a clean modular ancient-tree ecosystem runtime',()=>{
  for(const moduleName of ['config-v3.js','input-v3.js','world-v3.js','routes-v3.js','engine-v3.js','engine-feel-v3.js','engine-sapline-v3.js','engine-routes-v3.js','render-v3.js','render-motion-v3.js','render-routes-v3.js','game-v3.js'])assert.ok(read(`${root}/${moduleName}`).length>100,`missing ${moduleName}`);
  assert.match(html,/ANCIENT TREE ASCENT/);
  assert.match(html,/game-v3\.js/);
  assert.match(boot,/engine-routes-v3\.js/);
  assert.match(boot,/render-routes-v3\.js/);
  assert.match(config,/VERSION='3\.2\.0-alpha\.1'/);
  for(const source of [config,input,world,routes,engine,feel,sapline,routeEngine,render,motion,routeRender,boot])assert.doesNotMatch(source,/mosslight|v015-entry|sylvaria-v2\/|Cutstep/);
});

test('movement is fast, deterministic, buffered, and built for upward flow',()=>{
  assert.match(config,/FIXED_DT=1\/120/);
  assert.match(config,/runSpeed:355/);
  assert.match(config,/groundAccel:3300/);
  assert.match(config,/airAccel:2250/);
  assert.match(config,/jumpSpeed:690/);
  assert.match(config,/coyote:0\.11/);
  assert.match(config,/jumpBuffer:0\.13/);
  assert.match(config,/wallLaunchX:500/);
  assert.match(config,/wallLaunchY:660/);
  assert.match(config,/airDashSpeed:825/);
  assert.match(engine,/p\.airDash=true/);
  assert.match(engine,/this\.zone\(\)\.wind\*130\*dt/);
  for(const source of [config,world,routes,engine,feel,sapline,routeEngine]){assert.doesNotMatch(source,/Math\.random/);assert.doesNotMatch(source,/Date\.now|performance\.now/)}
});

test('neutral air preserves earned momentum instead of auto-braking traversal chains',()=>{
  assert.match(feel,/preserveMomentum=!p\.onGround&&!p\.vineId&&p\.dashTime<=0&&this\.input\.axisX\(\)===0/);
  assert.match(feel,/const retained=Math\.abs\(incomingVx\)\*0\.995/);
  assert.match(feel,/if\(Math\.abs\(p\.vx\)<retained\)p\.vx=Math\.sign\(incomingVx\)\*retained/);
});

test('default controls use arrows for movement, D for machete, W for Sapline, and remain rebindable',()=>{
  assert.match(config,/left:'ArrowLeft'/);
  assert.match(config,/right:'ArrowRight'/);
  assert.match(config,/up:'ArrowUp'/);
  assert.match(config,/down:'ArrowDown'/);
  assert.match(config,/attack:'KeyD'/);
  assert.match(config,/tether:'KeyW'/);
  assert.match(config,/jump:'Space'/);
  assert.match(input,/localStorage\.setItem\(STORAGE_KEY/);
  assert.match(input,/beginCapture\(action\)/);
  assert.match(input,/this\.bindings\[action\]=code/);
  assert.match(input,/this\.bindings=\{\.\.\.DEFAULT_BINDINGS\}/);
  assert.match(boot,/tether:'Sapline'/);
  assert.match(html,/CUSTOMIZE CONTROLS/);
  assert.match(html,/Bindings are saved on this device/);
});

test('the ancient tree contains five named vertical regions and precision-scale branches',()=>{
  for(const name of ['ROOTREACH','SAPWOOD SPLIT','HOLLOW SCAR','STORM CANOPY','HEARTWOOD CROWN'])assert.match(world,new RegExp(name));
  assert.doesNotMatch(world,/ROOTWARD BASE|CANOPY GAUNTLET/);
  assert.match(config,/WORLD=\{w:1760,h:6400\}/);
  const widths=[...world.matchAll(/w:(\d+),h:(?:1[678]|20|22|24),type:/g)].map(match=>Number(match[1]));
  assert.ok(widths.length>=25,`expected authored narrow platforms, got ${widths.length}`);
  assert.ok(widths.filter(width=>width<=150).length>=20,'most fallback platforms must stay precision-scale');
  assert.match(world,/type:'spring'/);
  assert.match(world,/type:'dead'/);
  assert.match(world,/type:'sap'/);
  assert.match(world,/type:'industrial'/);
  assert.match(engine,/platform\.standTime>\.52/);
  assert.match(engine,/platform\.sapCharged=false/);
});

test('BarkRails replace shelf-only routing with authoritative safe speed and mastery surfaces',()=>{
  assert.ok((routes.match(/id:'rail-/g)||[]).length>=17,'expected a dense authored BarkRail network');
  for(const route of ['safe','speed','mastery'])assert.match(routes,new RegExp(`route:'${route}'`));
  assert.match(routes,/rail-canopy-master-a/);
  assert.match(routes,/rail-crown-master-b/);
  assert.match(routeEngine,/collideVertical\(dy\)/);
  assert.match(routeEngine,/prevBottom=oldY\+p\.h\/2/);
  assert.match(routeEngine,/intendedBottom=oldY\+dy\+p\.h\/2/);
  assert.match(routeEngine,/surface<bestY/);
  assert.match(routeEngine,/p\.groundId=best\.id/);
  assert.match(routeEngine,/masteryRailLandings\+\+/);
  assert.match(routeRender,/drawBarkRail/);
});

test('Sapline uses explicit Resin Knots including knots mounted on BarkRails',()=>{
  assert.match(world,/SAPLINE_ANCHORS/);
  assert.ok((world.match(/id:'knot-/g)||[]).length>=30,'expected the base Resin Knot network');
  assert.ok((routes.match(/id:'knot-route-/g)||[]).length>=12,'expected route-mounted Resin Knots');
  assert.match(routes,/rail:'rail-canopy-master-a'/);
  assert.match(routeEngine,/if\(anchor\?\.rail\)/);
  assert.match(routeEngine,/this\.railPoint\(rail/);
  assert.match(sapline,/for\(const anchor of this\.world\.anchors\|\|\[\]\)/);
  assert.match(sapline,/dist<SAPLINE\.minAttachDistance\|\|dist>SAPLINE\.maxRange/);
  assert.match(sapline,/dot<SAPLINE\.acquireDot/);
});

test('Sapline damping is adaptive and radial while tangential velocity stays skill-driven',()=>{
  for(const token of ['maxRange:410','attachRestRatio:0.78','minLength:72','reelSpeed:245','spring:23.5','dampingFree:5.8','dampingSettle:9.1','settleExtension:42','settleRadialSpeed:310','tangentAccel:1120','maxAccel:5200','maxReleaseSpeed:1120'])assert.ok(config.includes(token),`missing Sapline tuning ${token}`);
  assert.match(sapline,/settleByExtension=1-clamp\(extension\/SAPLINE\.settleExtension,0,1\)/);
  assert.match(sapline,/settleBySpeed=clamp\(Math\.abs\(radialVelocity\)\/SAPLINE\.settleRadialSpeed,0,1\)/);
  assert.match(sapline,/lerp\(SAPLINE\.dampingFree,SAPLINE\.dampingSettle/);
  assert.match(sapline,/extension\*SAPLINE\.spring-radialVelocity\*damping/);
  assert.match(sapline,/tx\*pump\*SAPLINE\.tangentAccel/);
  assert.match(sapline,/energy=\.5\*SAPLINE\.spring\*extension\*extension/);
  assert.match(sapline,/if\(speed>SAPLINE\.maxReleaseSpeed\)/);
});

test('Sapline release preserves generated velocity and cannot skim-refill Canopy Step',()=>{
  assert.match(sapline,/p\.vx\+=ux\*boost;p\.vy\+=uy\*boost/);
  assert.match(sapline,/this\.state\.stats\.saplineLaunches\+\+/);
  const start=sapline.indexOf('startSapline(){'),end=sapline.indexOf('releaseSapline(',start);
  assert.ok(start>=0&&end>start,'Sapline attach method missing');
  assert.doesNotMatch(sapline.slice(start,end),/airDash\s*=\s*true/);
  assert.match(sapline,/tetheredBefore=!!p\.sapline,canopyStepBefore=p\.airDash/);
  assert.match(sapline,/if\(tetheredBefore&&p\.sapline&&!canopyStepBefore\)p\.airDash=false/);
  assert.match(sapline,/startAirDash\(\)\{if\(this\.state\.player\.sapline\)this\.releaseSapline\(false\)/);
});

test('Resin Knots communicate predicted release tangent and stored energy without route colors',()=>{
  assert.match(sapline,/releaseTangentFor\(pos\)/);
  assert.match(sapline,/saplineCandidateTangent/);
  assert.match(routeRender,/tangentForAnchor/);
  assert.match(routeRender,/tangent/i);
  assert.match(routeRender,/energy\/120000/);
  assert.match(routeRender,/length=candidate\?23:25\+load\*24/);
  assert.doesNotMatch(routeRender,/route==='safe'|route==='speed'|route==='mastery'/);
});

test('tree traversal multiplies mechanics instead of adding a separate button for every verb',()=>{
  assert.match(engine,/detectWall\(\)/);
  assert.match(engine,/p\.vx=-p\.wallDir\*MOVE\.wallLaunchX/);
  assert.match(engine,/tryGrabVine\(\)/);
  assert.match(engine,/const tangent=v\.angVel\*v\.len/);
  assert.match(engine,/ground&&ground\.type==='spring'/);
  assert.match(engine,/this\.bounce\(COMBAT\.plungeBounce\)/);
  assert.match(engine,/p\.airDash=true/);
  assert.match(engine,/dropTimer=\.18/);
  assert.match(sapline,/this\.input\.take\('tether'\)/);
  assert.match(routeEngine,/BarkRail/);
});

test('one D attack button supports grounded aerial wall plunge and dash combat contexts',()=>{
  for(const profile of ['side','up','down','wall','dash','plunge'])assert.match(config,new RegExp(`${profile}:\\{startup:`));
  assert.match(engine,/if\(p\.dashTime>0\|\|p\.dashRecover>0\)type='dash'/);
  assert.match(engine,/else if\(p\.wallDir&&!p\.onGround\)type='wall'/);
  assert.match(feel,/type=p\.vy>480\?'plunge':'down'/);
  assert.match(feel,/else if\(this\.input\.is\('up'\)\)type='up'/);
  assert.match(engine,/projectileDeflectWindow/);
  assert.match(engine,/reflectProjectile/);
  assert.match(engine,/a\.type==='down'\|\|a\.type==='plunge'/);
  assert.match(engine,/a\.type==='side'&&p\.combo===3/);
});

test('pressing D creates defensive blade coverage immediately before projectile travel advances',()=>{
  assert.match(feel,/this\.deflectNearbyProjectiles\(\)/);
  assert.match(feel,/deflectNearbyProjectiles\(\)/);
  assert.match(feel,/const p=this\.state\.player,box=this\.attackBox\(true\)/);
  assert.match(feel,/this\.reflectProjectile\(shot\)/);
});

test('the guardian is movement-first and the short machete only appears during an attack',()=>{
  assert.match(config,/side:\{startup:0\.028,activeEnd:0\.145,duration:0\.19,damage:1\.0,reach:66/);
  assert.match(routeRender,/ctx\.scale\(p\.facing\*1\.18,1\.18\)/);
  assert.match(routeRender,/rawSpeed=Math\.hypot\(p\.vx,p\.vy\)/);
  assert.match(routeRender,/tailX=-vel\.x/);
  assert.match(routeRender,/if\(!attack\)/);
  assert.match(routeRender,/if\(attack\)\{/);
  assert.match(routeRender,/ctx\.lineTo\(39,-4\)/);
  assert.match(routeRender,/ctx\.lineTo\(46,-\.8\)/);
  assert.match(routeRender,/attack\.time<=1\/120\*1\.6/);
  const attackBlock=routeRender.slice(routeRender.indexOf('if(attack){'),routeRender.indexOf('drawBoss'));
  assert.match(attackBlock,/COLORS\.blade/);
});

test('aerial combat turns downward hits into traversal rather than stopping the player',()=>{
  assert.match(config,/downBounce:610/);
  assert.match(config,/plungeBounce:735/);
  assert.match(engine,/this\.bounce\(a\.type==='plunge'\?COMBAT\.plungeBounce:COMBAT\.downBounce\)/);
  assert.match(engine,/p\.vy=-power;p\.airDash=true/);
  assert.match(engine,/this\.state\.stats\.sapBounces\+\+/);
  assert.match(engine,/platform\.type==='dead'/);
});

test('enemy pressure escalates from standard combat into spatial interference',()=>{
  for(const kind of ['logger','ranger','climber','drone','trapper'])assert.match(world,new RegExp(`kind:'${kind}'`));
  assert.match(engine,/updateLogger/);
  assert.match(engine,/updateRanger/);
  assert.match(engine,/updateClimber/);
  assert.match(engine,/updateDrone/);
  assert.match(engine,/updateTrapper/);
  assert.match(engine,/this\.state\.traps\.push/);
  assert.match(world,/kind:'saw'/);
  assert.ok((world.match(/kind:'saw'/g)||[]).length>=4);
  for(const draw of ['drawLogger','drawRanger','drawClimber','drawDrone','drawTrapper'])assert.match(motion,new RegExp(draw));
});

test('the Crown Girdler is a tree-mounted three-phase mastery boss with phase-accurate physical clamps',()=>{
  assert.match(routeEngine,/boss\.name='CROWN GIRDLER'/);
  assert.match(routeEngine,/boss\.machineMounted=true/);
  assert.match(world,/hp:24,maxHp:24/);
  assert.match(engine,/bossPhase\(hp\)\{return hp>16\?1:hp>8\?2:3\}/);
  assert.match(engine,/b\.maxGuard=2\+phase/);
  assert.match(engine,/\['down','plunge','dash'\]\.includes\(a\.type\)/);
  assert.match(engine,/axeWindup/);
  assert.match(engine,/volleyWindup/);
  assert.match(engine,/sawWindup/);
  assert.match(feel,/beforeGuard>0&&boss\.guard===0/);
  assert.match(routeRender,/Crown Girdler/);
  assert.match(routeRender,/clampCount=Math\.max\(3,b\.maxGuard\|\|3\)/);
  assert.match(routeRender,/i<clampCount/);
  assert.match(routeRender,/intact=i<b\.guard/);
  assert.match(html,/CROWN GIRDLER/);
});

test('presentation follows the old-growth target while preserving mechanic readability',()=>{
  assert.match(render,/approved-old-growth-art-direction/);
  assert.match(render,/distantTrees/);
  assert.match(routeRender,/drawBarkRail/);
  assert.match(routeRender,/drawSapAnchor/);
  assert.match(routeRender,/drawSapline/);
  assert.match(routeRender,/drawGuardian/);
  assert.match(routeRender,/drawBoss/);
  assert.match(routeRender,/COLORS\.blade/);
  assert.match(routeRender,/COLORS\.sapline/);
  assert.match(html,/SYLVARIA/);
  assert.match(html,/Sapline/);
  assert.match(html,/BarkRails/);
  assert.doesNotMatch(html,/Hollow Knight|Silksong|Spider-Man/);
});
