import fs from'node:fs';
import crypto from'node:crypto';

const runtime='public/game-runtimes/sylvaria-v3';
const archive='public/game-runtimes/mosslight-v2';
const read=path=>fs.readFileSync(path,'utf8');
const errors=[];
const expect=(ok,message)=>{if(!ok)errors.push(message)};
const requireTokens=(source,label,tokens)=>{for(const token of tokens)expect(source.includes(token),`${label}: missing ${token}`)};
const rejectPattern=(source,label,pattern)=>expect(!pattern.test(source),`${label}: forbidden ${pattern}`);

const html=read(`${runtime}/index.html`);
const config=read(`${runtime}/config-v3.js`);
const input=read(`${runtime}/input-v3.js`);
const world=read(`${runtime}/world-v3.js`);
const routes=read(`${runtime}/routes-v3.js`);
const engine=read(`${runtime}/engine-v3.js`);
const feel=read(`${runtime}/engine-feel-v3.js`);
const sapline=read(`${runtime}/engine-sapline-v3.js`);
const routeEngine=read(`${runtime}/engine-routes-v3.js`);
const render=read(`${runtime}/render-v3.js`);
const motion=read(`${runtime}/render-motion-v3.js`);
const routeRender=read(`${runtime}/render-routes-v3.js`);
const game=read(`${runtime}/game-v3.js`);
const arcade=read('src/data/arcadeGames.ts');

requireTokens(html,'public v3.2 shell',['ANCIENT TREE ASCENT','ROOTREACH','BarkRails','Sapline','Resin Knots','Downstrike','Plunge','CROWN GIRDLER','game-v3.js']);
rejectPattern(html,'public v3.2 shell',/Cutstep|Kinetic Pond|Reactive Blade|tongue/i);
requireTokens(config,'fixed-step movement',["VERSION='3.2.0-alpha.1'",'FIXED_DT=1/120','runSpeed:355','jumpSpeed:690','coyote:0.11','jumpBuffer:0.13','airDashSpeed:825',"tether:'KeyW'",'dampingFree:5.8','dampingSettle:9.1','settleExtension:42','settleRadialSpeed:310']);
requireTokens(input,'rebindable controls',['localStorage.setItem(STORAGE_KEY','beginCapture(action)','this.bindings[action]=code','this.bindings={...DEFAULT_BINDINGS}']);

for(const zone of['ROOTREACH','SAPWOOD SPLIT','HOLLOW SCAR','STORM CANOPY','HEARTWOOD CROWN'])expect(world.includes(zone),`missing current tree region ${zone}`);
expect((world.match(/id:'knot-/g)||[]).length>=30,'base Resin Knot network is incomplete');
expect((world.match(/kind:'saw'/g)||[]).length>=4,'moving saw pressure is incomplete');
for(const kind of['logger','ranger','climber','drone','trapper'])expect(world.includes(`kind:'${kind}'`),`missing Fellworks role ${kind}`);

expect((routes.match(/id:'rail-/g)||[]).length>=17,'BarkRail route network is incomplete');
expect((routes.match(/id:'knot-route-/g)||[]).length>=12,'route-mounted Resin Knot network is incomplete');
for(const route of['safe','speed','mastery'])expect(routes.includes(`route:'${route}'`),`missing ${route} route topology`);
requireTokens(routes,'route topology',['rail-root-safe-a','rail-canopy-master-a','rail-crown-master-b','knot-route-canopy-master-a']);

requireTokens(engine,'movement and combat',['detectWall()','tryGrabVine()','const tangent=v.angVel*v.len','reflectProjectile','projectileDeflectWindow',"['down','plunge','dash'].includes(a.type)",'bossPhase(hp){return hp>16?1:hp>8?2:3}','b.maxGuard=2+phase']);
requireTokens(feel,'high-speed feel',['preserveMomentum=!p.onGround&&!p.vineId&&p.dashTime<=0&&this.input.axisX()===0','const retained=Math.abs(incomingVx)*0.995','deflectNearbyProjectiles()','type=p.vy>480?\'plunge\':\'down\'']);
requireTokens(sapline,'adaptive Sapline',['releaseTangentFor(pos)','saplineCandidateTangent','settleByExtension=1-clamp(extension/SAPLINE.settleExtension,0,1)','settleBySpeed=clamp(Math.abs(radialVelocity)/SAPLINE.settleRadialSpeed,0,1)','lerp(SAPLINE.dampingFree,SAPLINE.dampingSettle','energy=.5*SAPLINE.spring*extension*extension','tetheredBefore=!!p.sapline,canopyStepBefore=p.airDash','if(tetheredBefore&&p.sapline&&!canopyStepBefore)p.airDash=false']);
rejectPattern(sapline,'authoritative Sapline',/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);

requireTokens(routeEngine,'authoritative BarkRail collision',['BARK_RAILS','ROUTE_ANCHORS','railYAtX','prevBottom=oldY+p.h/2','intendedBottom=oldY+dy+p.h/2','p.groundId=best.id','masteryRailLandings++',"boss.name='CROWN GIRDLER'",'boss.machineMounted=true']);
rejectPattern(routeEngine,'authoritative BarkRail collision',/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);

requireTokens(routeRender,'v3.2 presentation',['drawBarkRail','drawSapAnchor','tangentForAnchor','drawSapline','ctx.scale(p.facing*1.18,1.18)','rawSpeed=Math.hypot(p.vx,p.vy)','tailX=-vel.x','if(!attack)','if(attack){','attack.time<=1/120*1.6','drawBoss','clampCount=Math.max(3,b.maxGuard||3)','intact=i<b.guard']);
expect(!/route==='safe'|route==='speed'|route==='mastery'/.test(routeRender),'Resin Knot presentation encodes hidden route colors');
requireTokens(game,'production v3.2 boot',["from'./engine-routes-v3.js'","from'./render-routes-v3.js'",'CROWN GIRDLER CLAMPS','masteryRailLandings']);
requireTokens(arcade,'Game Network v3.2 metadata',["version: 'v3.2.0-alpha.1'",'BarkRails','adaptive radial damping','Crown Girdler','TURN PRESSURE INTO HEIGHT']);

for(const source of[config,world,routes,engine,feel,sapline,routeEngine])rejectPattern(source,'deterministic current simulation',/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);

// Preserve the qualified historical verifier separately from the current public game.
const model13=read(`${archive}/v091/model.js`);
const rooms13=read(`${archive}/v011/rooms-v011.js`);
const replay13=read(`${archive}/v013/replay-v013.js`);
const serverReplay=read('src/lib/sylvaria/replay.ts');
requireTokens(model13,'historical 120 Hz verifier substrate',["VERSION='0.9.1'",'FIXED_DT=1/120','MAX_SHOTS=128','MAX_PENDING=72']);
expect((rooms13.match(/\bR\(/g)||[]).length>=30,'historical authored-room verifier substrate missing');
requireTokens(replay13,'historical replay format',["VERSION='0.13.0'",'SCHEMA=2']);
requireTokens(serverReplay,'historical server verifier',['SYLVARIA_REPLAY_SCHEMA = 2',"SYLVARIA_ENGINE_VERSION = '0.13.0'"]);

const currentHash=crypto.createHash('sha256').update([config,world,routes,engine,feel,sapline,routeEngine].join('\n')).digest('hex');
if(errors.length){console.error(`Sylvaria v3.2 validation failed (${errors.length})`);for(const error of errors)console.error(` - ${error}`);process.exit(1)}
console.log(`Sylvaria v3.2 validator PASS · 120 Hz ascent · BarkRails · adaptive Sapline · movement-first machete · Crown Girdler · preserved v0.13 verifier · sha256 ${currentHash}`);
