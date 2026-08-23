const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const ui={
  intro:document.getElementById('intro'),complete:document.getElementById('complete'),dead:document.getElementById('dead'),
  health:document.getElementById('health'),objective:document.getElementById('objective'),moveState:document.getElementById('moveState'),
  airStep:document.getElementById('airStep'),stats:document.getElementById('completeStats')
};

const VW=1280,VH=720,WORLD_W=3600,WORLD_H=1000,FIXED_DT=1/120,TAU=Math.PI*2;
const MOVE=Object.freeze({runSpeed:285,groundAccel:2350,airAccel:1550,groundBrake:2850,gravity:1850,maxFall:900,jumpSpeed:590,coyote:.105,jumpBuffer:.12,wallFall:125,wallLaunchX:430,wallLaunchY:545,canopySpeed:720,canopyTime:.115});
const COMBAT=Object.freeze({meleeStartup:.035,sideActiveEnd:.145,verticalActiveEnd:.165,deflectWindow:.12,sideReach:70,verticalReach:66,nailSpeed:565,returnSpeed:680});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const approach=(v,t,d)=>v<t?Math.min(t,v+d):Math.max(t,v-d);
const rect=(x,y,w,h)=>({l:x-w/2,r:x+w/2,t:y-h/2,b:y+h/2});
const overlap=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const rngFrom=seed=>{let v=seed>>>0;return()=>{v+=0x6d2b79f5;let t=v;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}};

const roots=[
  {id:'g0',x:0,y:860,w:910,h:160},{id:'g1',x:1160,y:900,w:760,h:120},{id:'g2',x:2040,y:880,w:700,h:140},{id:'g3',x:2920,y:900,w:680,h:120},
  {id:'r0',x:820,y:795,w:180,h:42},{id:'r1',x:1780,y:805,w:220,h:40},{id:'r2',x:2650,y:790,w:170,h:38}
];
const trunks=[
  {id:'t0',x:500,y:220,w:92,h:640},{id:'t1',x:1390,y:250,w:104,h:650},{id:'t2',x:2300,y:170,w:112,h:710},{id:'t3',x:3070,y:255,w:96,h:645}
];
const branches=[
  {id:'b0',x:360,baseY:680,w:360,h:24,spring:.72,flex:0},{id:'b1',x:500,baseY:510,w:390,h:22,spring:1,flex:0},
  {id:'b2',x:1210,baseY:705,w:390,h:24,spring:.76,flex:0},{id:'b3',x:1390,baseY:535,w:390,h:22,spring:1.08,flex:0},
  {id:'b4',x:2070,baseY:675,w:450,h:24,spring:.82,flex:0},{id:'b5',x:2290,baseY:485,w:430,h:22,spring:1.12,flex:0},
  {id:'b6',x:2860,baseY:690,w:360,h:24,spring:.82,flex:0},{id:'b7',x:3050,baseY:520,w:390,h:22,spring:1.16,flex:0}
];
const vines=[
  {id:'v0',ax:1010,ay:335,len:285,angle:-.42,angVel:0},{id:'v1',ax:1930,ay:310,len:265,angle:.30,angVel:0},{id:'v2',ax:2775,ay:300,len:300,angle:-.26,angVel:0}
];
const checkpoints=[{x:150,y:839},{x:1260,y:819},{x:2090,y:789},{x:2970,y:819}];
const enemyBlueprints=[
  {id:'logger',kind:'logger',x:760,y:831,w:36,h:58,hp:5,maxHp:5,platform:'g0',minX:625,maxX:845},
  {id:'nailgun',kind:'nailgun',x:2425,y:648,w:38,h:54,hp:5,maxHp:5,platform:'b4',minX:2200,maxX:2520}
];

const branchTop=b=>b.baseY+b.flex*17;
const platformById=id=>roots.find(r=>r.id===id)||branches.find(b=>b.id===id)||trunks.find(t=>t.id===id)||null;
function platformRect(p){return 'baseY' in p?{l:p.x,r:p.x+p.w,t:branchTop(p),b:branchTop(p)+p.h}:{l:p.x,r:p.x+p.w,t:p.y,b:p.y+p.h}}
const playerRect=p=>rect(p.x,p.y,p.w,p.h);
const vineTip=v=>({x:v.ax+Math.sin(v.angle)*v.len,y:v.ay+Math.cos(v.angle)*v.len});

const sceneryRng=rngFrom(hash('sylvaria-sideview-old-growth-v2'));
const distantTrees=Array.from({length:58},(_,i)=>({x:i*86+sceneryRng()*110,y:170+sceneryRng()*170,h:320+sceneryRng()*380,w:25+sceneryRng()*55,a:.12+sceneryRng()*.13}));
const motes=Array.from({length:84},()=>({x:sceneryRng()*WORLD_W,y:100+sceneryRng()*760,p:sceneryRng()*TAU,s:.55+sceneryRng()*1.35}));
const keys=new Set(),pressed=new Set();
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!keys.has(e.code))pressed.add(e.code);keys.add(e.code);if(e.code==='KeyR'&&(state.mode==='dead'||state.mode==='complete'))reset(true)});
addEventListener('keyup',e=>keys.delete(e.code));
const take=code=>{const value=pressed.has(code);pressed.delete(code);return value};
let audioCtx=null;
function tone(freq=300,d=.05,g=.025,type='triangle'){try{audioCtx??=new AudioContext();const o=audioCtx.createOscillator(),a=audioCtx.createGain();o.type=type;o.frequency.value=freq;a.gain.setValueAtTime(g,audioCtx.currentTime);a.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.connect(a).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}catch{}}

const state={mode:'menu',time:0,roomTime:0,player:null,enemies:[],nails:[],fx:[],fxSerial:0,camera:{x:VW/2,y:VH/2},checkpoint:0,shake:0,flash:0,stats:null};
const freshStats=()=>({slashes:0,reflects:0,branchLaunches:0,wallLaunches:0,vineSwings:0,canopySteps:0,damageTaken:0,kills:0});
function newPlayer(){return{x:150,y:839,w:26,h:42,vx:0,vy:0,facing:1,onGround:true,groundId:'g0',coyote:MOVE.coyote,jumpBuffer:0,wallDir:0,wallTime:0,airStep:true,dashTime:0,dashDir:{x:0,y:0},vineId:null,attack:null,attackCooldown:0,combo:0,comboWindow:0,hp:5,maxHp:5,invuln:0,landSpeed:0}}
function reset(play=false){
  state.time=0;state.roomTime=0;state.player=newPlayer();state.enemies=enemyBlueprints.map(e=>({...e,state:'idle',clock:.35,windup:0,recover:0,dead:false,hitFlash:0,attackSerial:0,facing:-1}));state.nails=[];state.fx=[];state.fxSerial=0;state.camera={x:VW/2,y:VH/2};state.checkpoint=0;state.shake=0;state.flash=0;state.stats=freshStats();
  for(const b of branches)b.flex=0;for(const [i,v] of vines.entries()){v.angle=[-.42,.30,-.26][i];v.angVel=0}
  state.mode=play?'playing':'menu';ui.intro.classList.toggle('hidden',play);ui.complete.classList.add('hidden');ui.dead.classList.add('hidden');updateHud();
}
function spawnFx(x,y,color='#d9f5c5',count=8,speed=120){for(let i=0;i<count;i++){const a=(state.fxSerial*1.71+i*2.399)%TAU,r=.35+((state.fxSerial+i*7)%13)/13;state.fx.push({x,y,vx:Math.cos(a)*speed*r,vy:Math.sin(a)*speed*r-20,life:.28+((i*3)%7)*.022,max:.45,size:1.5+(i%3),color});state.fxSerial++}if(state.fx.length>190)state.fx.splice(0,state.fx.length-190)}
function hurtPlayer(sourceX,amount=1){const p=state.player;if(p.invuln>0||state.mode!=='playing')return;p.hp-=amount;p.invuln=.85;p.vx=(p.x<sourceX?-1:1)*330;p.vy=-350;p.vineId=null;state.stats.damageTaken+=amount;state.shake=8;state.flash=.22;spawnFx(p.x,p.y,'#f0a978',14,170);tone(90,.13,.055,'sawtooth');if(p.hp<=0){state.mode='dead';ui.dead.classList.remove('hidden')}}
function killEnemy(e){if(e.dead)return;e.dead=true;state.stats.kills++;spawnFx(e.x,e.y,'#e4d0a0',20,180);tone(110,.08,.035,'square')}
function damageEnemy(e,dmg,knock=0){if(e.dead)return;e.hp-=dmg;e.hitFlash=.12;e.x+=knock;state.shake=Math.max(state.shake,3);spawnFx(e.x,e.y-8,e.kind==='logger'?'#d8c08f':'#efb46c',8,110);tone(210,.045,.025);if(e.hp<=0)killEnemy(e)}

function detectWall(p){const pr=playerRect(p);for(const t of trunks){const tr=platformRect(t);if(pr.b<=tr.t+5||pr.t>=tr.b-5)continue;if(Math.abs(pr.r-tr.l)<=7)return 1;if(Math.abs(pr.l-tr.r)<=7)return-1}return 0}
function collideHorizontal(p,dx){p.x+=dx;let hit=0;const pr=playerRect(p);for(const s of [...trunks,...roots]){const r=platformRect(s);if(!overlap(pr,r))continue;if(dx>0){p.x=r.l-p.w/2;hit=1}else if(dx<0){p.x=r.r+p.w/2;hit=-1}}p.x=clamp(p.x,p.w/2,WORLD_W-p.w/2);return hit}
function collideVertical(p,dy){
  const prevBottom=p.y+p.h/2,prevTop=p.y-p.h/2;p.y+=dy;p.onGround=false;p.groundId=null;let landed=null;
  if(dy>=0){let best=Infinity;for(const s of [...roots,...trunks,...branches]){const r=platformRect(s),pr=playerRect(p);if(pr.r<=r.l+3||pr.l>=r.r-3)continue;if(prevBottom<=r.t+6&&pr.b>=r.t&&r.t<best){best=r.t;landed=s}}if(landed){const speed=p.vy;p.y=platformRect(landed).t-p.h/2;p.vy=0;p.onGround=true;p.groundId=landed.id;p.coyote=MOVE.coyote;p.airStep=true;p.landSpeed=speed;if('flex' in landed)landed.flex=clamp(landed.flex+Math.max(0,speed-140)/900,0,1)}}
  else{for(const s of trunks){const r=platformRect(s),pr=playerRect(p);if(pr.r<=r.l||pr.l>=r.r)continue;if(prevTop>=r.b-4&&pr.t<=r.b){p.y=r.b+p.h/2;p.vy=0;break}}}
  p.y=clamp(p.y,p.h/2,WORLD_H+120);return landed;
}

function updateBranches(dt){
  const p=state.player;
  for(const b of branches){
    const supported=p.onGround&&p.groundId===b.id;
    const oldY=branchTop(b);
    if(supported)b.flex=clamp(b.flex+dt*(.65+b.spring*.7),0,1);else b.flex=Math.max(0,b.flex-dt*(1.8+b.spring*.45));
    const delta=branchTop(b)-oldY;
    if(supported&&delta!==0)p.y+=delta;
  }
}
function updateVines(dt){
  for(const v of vines){const torque=-Math.sin(v.angle)*2.15;v.angVel+=(torque-v.angVel*.32)*dt;v.angle=clamp(v.angle+v.angVel*dt,-1.15,1.15)}
  const p=state.player;if(!p.vineId)return;const v=vines.find(item=>item.id===p.vineId);if(!v){p.vineId=null;return}v.angVel+=((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0))*1.8*dt;const t=vineTip(v);p.x=t.x;p.y=t.y;p.vx=0;p.vy=0;p.onGround=false;p.groundId=null;p.wallDir=0;
}
function tryGrabVine(){const p=state.player;let best=null,bestD=78;for(const v of vines){const t=vineTip(v),d=Math.hypot(t.x-p.x,t.y-p.y);if(d<bestD){best=v;bestD=d}}if(!best)return false;p.vineId=best.id;p.vx=0;p.vy=0;tone(270,.04,.018);return true}
function releaseVine(jump=false){const p=state.player,v=vines.find(item=>item.id===p.vineId);if(!v)return;if(jump){const tangent=v.angVel*v.len;p.vx=Math.cos(v.angle)*tangent+(keys.has('KeyD')?110:keys.has('KeyA')?-110:0);p.vy=-Math.sin(v.angle)*tangent-190;p.airStep=true;state.stats.vineSwings++;tone(390,.05,.02)}p.vineId=null}
function startCanopyStep(){const p=state.player;if(!p.airStep||p.dashTime>0)return;let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),y=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);if(!x&&!y)x=p.facing;const m=Math.hypot(x,y)||1;p.dashDir={x:x/m,y:y/m};p.dashTime=MOVE.canopyTime;p.airStep=false;p.vineId=null;state.stats.canopySteps++;spawnFx(p.x,p.y,'#bdeca7',8,95);tone(500,.045,.025)}

function startAttack(){
  const p=state.player;if(p.attackCooldown>0)return;let type='side';if(keys.has('KeyW'))type='up';else if(keys.has('KeyS')&&!p.onGround)type='down';
  if(type==='side'){p.combo=p.comboWindow>0?(p.combo%3)+1:1;p.comboWindow=.34}else p.combo=1;
  p.attack={type,time:0,duration:type==='side'?.20:.23,hit:new Set(),deflected:new Set()};p.attackCooldown=.11;state.stats.slashes++;tone(type==='down'?260:type==='up'?340:300+p.combo*40,.055,.023);
}
function directionalBox(p,type,forDeflect=false){
  const sideW=forDeflect?78:58+(p.combo===3?16:0),sideH=forDeflect?48:38;
  if(type==='up')return rect(p.x,p.y-35,forDeflect?48:40,forDeflect?72:58);
  if(type==='down')return rect(p.x,p.y+38,forDeflect?46:38,forDeflect?74:64);
  return rect(p.x+p.facing*(forDeflect?30:32+(p.combo===3?8:0)),p.y-2,sideW,sideH);
}
function attackBox(p){if(!p.attack)return null;const t=p.attack.time,end=p.attack.type==='side'?COMBAT.sideActiveEnd:COMBAT.verticalActiveEnd;if(t<COMBAT.meleeStartup||t>end)return null;return directionalBox(p,p.attack.type,false)}
function deflectBox(p){if(!p.attack||p.attack.time>COMBAT.deflectWindow)return null;return directionalBox(p,p.attack.type,true)}
function reflectNail(n,p,a){if(n.friendly)return;n.friendly=true;n.owner='player';state.stats.reflects++;const speed=COMBAT.returnSpeed;if(a.type==='up'){n.vx=p.facing*speed*.35;n.vy=-speed*.94}else if(a.type==='down'){n.vx=p.facing*speed*.25;n.vy=speed*.97}else{n.vx=p.facing*speed;n.vy=-55}n.life=3;spawnFx(n.x,n.y,'#e9f5b5',12,170);state.shake=Math.max(state.shake,2.5);tone(720,.055,.032,'square')}
function updateAttack(dt){
  const p=state.player;if(p.attackCooldown>0)p.attackCooldown-=dt;if(p.comboWindow>0)p.comboWindow-=dt;if(!p.attack)return;p.attack.time+=dt;
  const guard=deflectBox(p);if(guard){for(const n of state.nails){if(n.dead||n.friendly||p.attack.deflected.has(n))continue;if(overlap(guard,rect(n.x,n.y,n.r*2,n.r*2))){p.attack.deflected.add(n);reflectNail(n,p,p.attack)}}}
  const box=attackBox(p);if(box){for(const e of state.enemies){if(e.dead||p.attack.hit.has(e.id))continue;if(overlap(box,rect(e.x,e.y,e.w,e.h))){p.attack.hit.add(e.id);const dmg=p.attack.type==='side'?(p.combo===3?1.7:1):1.15;damageEnemy(e,dmg,p.facing*12);if(p.attack.type==='down'){p.vy=-520;p.airStep=true;state.stats.branchLaunches++;spawnFx(p.x,p.y+20,'#bce79f',10,130)}}}if(p.attack.type==='down'){for(const b of branches){if(p.attack.hit.has(b.id))continue;const br=platformRect(b);if(overlap(box,br)){p.attack.hit.add(b.id);b.flex=1;p.vy=-560;p.airStep=true;state.stats.branchLaunches++;spawnFx(p.x,br.t,'#88b66e',12,125);tone(430,.07,.026)}}}}
  if(p.attack.time>=p.attack.duration)p.attack=null;
}

function updatePlayer(dt){
  const p=state.player;if(p.invuln>0)p.invuln-=dt;if(p.jumpBuffer>0)p.jumpBuffer-=dt;if(p.coyote>0&&!p.onGround)p.coyote-=dt;
  updateAttack(dt);if(take('KeyJ'))startAttack();if(take('KeyE')){if(p.vineId)releaseVine(false);else tryGrabVine()}if(take('ShiftLeft')||take('ShiftRight'))startCanopyStep();const jumpPressed=take('Space');
  if(p.vineId){if(jumpPressed)releaseVine(true);return}if(jumpPressed)p.jumpBuffer=MOVE.jumpBuffer;
  p.wallDir=detectWall(p);const move=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);if(move)p.facing=move;
  if(p.jumpBuffer>0&&(p.onGround||p.coyote>0||p.wallDir)){
    if(p.wallDir&&!p.onGround){p.vx=-p.wallDir*MOVE.wallLaunchX;p.vy=-MOVE.wallLaunchY;p.onGround=false;p.groundId=null;p.coyote=0;state.stats.wallLaunches++;spawnFx(p.x,p.y,'#9ab982',9,120);tone(360,.045,.02)}
    else{let boost=0;const ground=platformById(p.groundId);if(ground&&'flex' in ground){boost=ground.flex*250*ground.spring;ground.flex*=.25;if(boost>45)state.stats.branchLaunches++}p.vy=-MOVE.jumpSpeed-boost;p.onGround=false;p.groundId=null;p.coyote=0;tone(330+Math.min(180,boost),.045,.018)}p.jumpBuffer=0;
  }
  if(p.dashTime>0){p.dashTime=Math.max(0,p.dashTime-dt);p.vx=p.dashDir.x*MOVE.canopySpeed;p.vy=p.dashDir.y*MOVE.canopySpeed;const hit=collideHorizontal(p,p.vx*dt);if(hit){p.dashTime=0;p.wallDir=hit}collideVertical(p,p.vy*dt);if(p.dashTime<=0){p.vx*=.68;p.vy*=.5}return}
  const target=move*MOVE.runSpeed,acc=p.onGround?MOVE.groundAccel:MOVE.airAccel;p.vx=approach(p.vx,target,acc*dt);if(!move&&p.onGround)p.vx=approach(p.vx,0,MOVE.groundBrake*dt);
  const gripping=p.wallDir&&((p.wallDir===1&&keys.has('KeyD'))||(p.wallDir===-1&&keys.has('KeyA')))&&!p.onGround&&p.vy>0;if(gripping){p.vy=Math.min(p.vy,MOVE.wallFall);p.wallTime=Math.min(1,p.wallTime+dt)}else{p.vy=Math.min(MOVE.maxFall,p.vy+MOVE.gravity*dt);p.wallTime=Math.max(0,p.wallTime-dt*2)}
  collideHorizontal(p,p.vx*dt);collideVertical(p,p.vy*dt);if(!keys.has('Space')&&p.vy<-180)p.vy+=MOVE.gravity*dt*1.15;
  if(p.y>WORLD_H+60){const cp=checkpoints[state.checkpoint];Object.assign(p,{x:cp.x,y:cp.y,vx:0,vy:0,onGround:false,groundId:null});hurtPlayer(p.x+50)}
}

function enemyGroundY(e){const p=platformById(e.platform);return p?platformRect(p).t-e.h/2:e.y}
function updateLogger(e,dt){
  e.y=enemyGroundY(e);const p=state.player,dx=p.x-e.x,dy=Math.abs(p.y-e.y);e.facing=dx<0?-1:1;e.hitFlash=Math.max(0,e.hitFlash-dt);
  if(e.state==='windup'){e.windup-=dt;if(e.windup<=0){e.state='strike';e.clock=.12;e.attackSerial++;tone(120,.055,.028,'square')}return}
  if(e.state==='strike'){e.clock-=dt;if(e.clock>.035&&overlap(rect(e.x+e.facing*38,e.y,58,48),playerRect(p)))hurtPlayer(e.x);if(e.clock<=0){e.state='recover';e.recover=.42}return}
  if(e.state==='recover'){e.recover-=dt;if(e.recover<=0)e.state='idle';return}
  if(dy<80&&Math.abs(dx)<105){e.state='windup';e.windup=.34;return}const dir=Math.abs(dx)<280?Math.sign(dx):e.facing;e.x=clamp(e.x+dir*68*dt,e.minX,e.maxX);
}
function fireNail(e){const p=state.player,dx=p.x-e.x,dy=p.y-e.y,m=Math.hypot(dx,dy)||1,s=COMBAT.nailSpeed;state.nails.push({x:e.x+e.facing*28,y:e.y-8,vx:dx/m*s,vy:dy/m*s,r:7,life:4,friendly:false,owner:e.id,dead:false});tone(180,.04,.03,'square')}
function updateNailgun(e,dt){
  const platform=platformById(e.platform);if(platform)e.y=platformRect(platform).t-e.h/2;const p=state.player,dx=p.x-e.x,dy=p.y-e.y;e.facing=dx<0?-1:1;e.hitFlash=Math.max(0,e.hitFlash-dt);
  if(e.state==='aim'){e.windup-=dt;if(e.windup<=0){fireNail(e);e.state='recover';e.recover=1.05}return}if(e.state==='recover'){e.recover-=dt;if(e.recover<=0)e.state='idle';return}if(Math.abs(dx)<900&&Math.abs(dy)<420){e.state='aim';e.windup=.48;return}e.x=clamp(e.x+Math.sign(dx)*24*dt,e.minX,e.maxX);
}
function updateEnemies(dt){
  for(const e of state.enemies){if(e.dead)continue;e.kind==='logger'?updateLogger(e,dt):updateNailgun(e,dt)}
  for(const n of state.nails){if(n.dead)continue;n.life-=dt;if(n.life<=0){n.dead=true;continue}n.x+=n.vx*dt;n.y+=n.vy*dt;if(n.friendly){for(const e of state.enemies){if(e.dead||!overlap(rect(n.x,n.y,n.r*2,n.r*2),rect(e.x,e.y,e.w,e.h)))continue;damageEnemy(e,2,n.vx>0?10:-10);n.dead=true;break}}else if(overlap(rect(n.x,n.y,n.r*2,n.r*2),playerRect(state.player))){hurtPlayer(n.x);n.dead=true}for(const t of trunks){if(overlap(rect(n.x,n.y,n.r*2,n.r*2),platformRect(t))){n.dead=true;spawnFx(n.x,n.y,'#a8895d',5,70);break}}}
  state.nails=state.nails.filter(n=>!n.dead);
}
function updateCheckpoints(){const p=state.player;for(let i=state.checkpoint+1;i<checkpoints.length;i++)if(p.x>checkpoints[i].x){state.checkpoint=i;spawnFx(checkpoints[i].x,checkpoints[i].y,'#c4efad',16,95);tone(620,.08,.022);break}}
function updateFx(dt){for(const f of state.fx){f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=260*dt;f.vx*=.986}state.fx=state.fx.filter(f=>f.life>0)}
function updateCamera(dt){const p=state.player,look=p.facing*150+clamp(p.vx*.18,-100,100),tx=clamp(p.x+look,VW/2,WORLD_W-VW/2),ty=clamp(p.y-55,VH/2,WORLD_H-VH/2);state.camera.x=lerp(state.camera.x,tx,1-Math.exp(-5.8*dt));state.camera.y=lerp(state.camera.y,ty,1-Math.exp(-4.8*dt))}
function update(dt){
  if(state.mode!=='playing')return;state.time+=dt;state.roomTime+=dt;state.flash=Math.max(0,state.flash-dt);state.shake=Math.max(0,state.shake-dt*18);updateVines(dt);updateBranches(dt);updatePlayer(dt);updateEnemies(dt);updateCheckpoints();updateFx(dt);updateCamera(dt);
  if(state.enemies.every(e=>e.dead)&&state.player.x>3380){state.mode='complete';ui.complete.classList.remove('hidden');ui.stats.textContent=`${state.stats.reflects} reflected nails · ${state.stats.branchLaunches} branch rebounds · ${state.stats.wallLaunches} wall launches · ${state.stats.vineSwings} vine releases`;tone(660,.12,.03)}updateHud();
}

function updateHud(){const p=state.player;ui.health.textContent=`BARK ${'●'.repeat(Math.max(0,p.hp))}${'○'.repeat(Math.max(0,p.maxHp-p.hp))}`;const live=state.enemies.filter(e=>!e.dead);ui.objective.textContent=live.length?`${live.length} clearcut threat${live.length===1?'':'s'} remain · reach the heartwood gate`:'forest route open · reach the heartwood gate';let motion='airborne';if(p.vineId)motion='vine swing';else if(p.wallDir&&!p.onGround)motion='bark grip';else if(p.onGround){const g=platformById(p.groundId);motion=g&&'flex' in g?'branch flex':'rooted'}else if(p.dashTime>0)motion='canopy step';ui.moveState.textContent=motion;ui.airStep.textContent=`CANOPY STEP ${p.airStep?'●':'○'}`}

function drawSky(){const g=ctx.createLinearGradient(0,0,0,VH);g.addColorStop(0,'#06120f');g.addColorStop(.48,'#10241b');g.addColorStop(1,'#1b2c1d');ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH);const moonX=970-state.camera.x*.025;ctx.fillStyle='#dce9cf12';ctx.beginPath();ctx.arc(moonX,120,118,0,TAU);ctx.fill();for(const t of distantTrees){const x=t.x-state.camera.x*.18,y=VH-(WORLD_H-t.y)*.08;ctx.globalAlpha=t.a;ctx.fillStyle='#07100c';ctx.fillRect(x-t.w/2,y-t.h,t.w,t.h);ctx.beginPath();ctx.moveTo(x,y-t.h-120);ctx.lineTo(x-t.w*2.4,y-t.h*.45);ctx.lineTo(x+t.w*2.4,y-t.h*.45);ctx.closePath();ctx.fill()}ctx.globalAlpha=1;for(let i=0;i<5;i++){const x=((i*330-state.camera.x*.07)%1800+1800)%1800-200;const fog=ctx.createRadialGradient(x,360,20,x,360,260);fog.addColorStop(0,'#bcd6bf0b');fog.addColorStop(1,'#bcd6bf00');ctx.fillStyle=fog;ctx.fillRect(x-280,100,560,520)}}
function worldTransform(){const sx=VW/2-state.camera.x+(state.shake?Math.sin(state.time*67)*state.shake:0),sy=VH/2-state.camera.y+(state.shake?Math.cos(state.time*59)*state.shake*.55:0);ctx.translate(sx,sy)}
function drawRoot(r){const rr=platformRect(r);ctx.fillStyle='#192618';ctx.fillRect(rr.l,rr.t,rr.r-rr.l,rr.b-rr.t);ctx.fillStyle='#314127';ctx.fillRect(rr.l,rr.t,rr.r-rr.l,9);ctx.strokeStyle='#6d794933';ctx.lineWidth=3;for(let x=rr.l+24;x<rr.r;x+=54){ctx.beginPath();ctx.moveTo(x,rr.t+4);ctx.quadraticCurveTo(x+16,rr.t+22,x-4,rr.t+54);ctx.stroke()}}
function drawTrunk(t){const r=platformRect(t),g=ctx.createLinearGradient(r.l,0,r.r,0);g.addColorStop(0,'#161b12');g.addColorStop(.45,'#3a432b');g.addColorStop(.72,'#26311e');g.addColorStop(1,'#111710');ctx.fillStyle=g;ctx.fillRect(r.l,r.t,r.r-r.l,r.b-r.t);ctx.strokeStyle='#87906c29';ctx.lineWidth=4;for(let y=r.t+22;y<r.b;y+=48){ctx.beginPath();ctx.moveTo(r.l+12,y);ctx.bezierCurveTo(r.l+34,y-13,r.r-27,y+17,r.r-10,y+2);ctx.stroke()}}
function drawBranch(b){const y=branchTop(b),bend=b.flex*18;ctx.lineCap='round';ctx.strokeStyle='#11180f';ctx.lineWidth=b.h+8;ctx.beginPath();ctx.moveTo(b.x,y);ctx.quadraticCurveTo(b.x+b.w*.55,y+bend,b.x+b.w,y-2);ctx.stroke();ctx.strokeStyle='#3c4b2d';ctx.lineWidth=b.h;ctx.beginPath();ctx.moveTo(b.x,y);ctx.quadraticCurveTo(b.x+b.w*.55,y+bend,b.x+b.w,y-2);ctx.stroke();ctx.strokeStyle='#a0b87955';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x+10,y-5);ctx.quadraticCurveTo(b.x+b.w*.55,y+bend-5,b.x+b.w-10,y-7);ctx.stroke()}
function drawVine(v){const t=vineTip(v);ctx.strokeStyle='#456d3f';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(v.ax,v.ay);ctx.quadraticCurveTo((v.ax+t.x)/2+Math.sin(state.time+v.angle)*9,(v.ay+t.y)/2,t.x,t.y);ctx.stroke();ctx.fillStyle='#9dc181';ctx.beginPath();ctx.arc(t.x,t.y,11,0,TAU);ctx.fill()}
function drawCheckpoint(c,i){ctx.globalAlpha=i<=state.checkpoint?.85:.2;ctx.strokeStyle='#9fd086';ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.x,c.y-22,15+Math.sin(state.time*2+i)*2,0,TAU);ctx.stroke();ctx.globalAlpha=1}
function drawLogger(e){ctx.save();ctx.translate(e.x,e.y);ctx.scale(e.facing,1);ctx.globalAlpha=e.hitFlash>0?.55:1;ctx.fillStyle='#594432';ctx.fillRect(-13,-11,26,32);ctx.fillStyle='#b67f48';ctx.beginPath();ctx.arc(0,-24,11,0,TAU);ctx.fill();ctx.fillStyle='#d08d42';ctx.fillRect(-12,-32,24,6);ctx.fillStyle='#76846e';ctx.fillRect(-15,18,10,18);ctx.fillRect(5,18,10,18);ctx.strokeStyle=e.state==='windup'?'#ffc46b':'#beb5a0';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(13,-4);ctx.lineTo(30,-20);ctx.lineTo(42,-7);ctx.stroke();if(e.state==='windup'){ctx.globalAlpha=.45;ctx.strokeStyle='#ffb55b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(20,-2,54,-1.05,.8);ctx.stroke()}ctx.restore()}
function drawNailgun(e){ctx.save();ctx.translate(e.x,e.y);ctx.scale(e.facing,1);ctx.globalAlpha=e.hitFlash>0?.55:1;ctx.fillStyle='#334039';ctx.fillRect(-14,-12,28,36);ctx.fillStyle='#bd8a58';ctx.beginPath();ctx.arc(0,-25,10,0,TAU);ctx.fill();ctx.fillStyle='#d49a44';ctx.fillRect(-13,-34,26,5);ctx.fillStyle='#5a6260';ctx.fillRect(8,-10,35,10);ctx.fillStyle='#f6b44b';ctx.fillRect(31,-8,12,6);ctx.restore();if(e.state==='aim'){const p=state.player;ctx.globalAlpha=.35;ctx.strokeStyle='#ffb252';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e.x,e.y-8);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.globalAlpha=1}}
function drawNail(n){ctx.save();ctx.translate(n.x,n.y);ctx.rotate(Math.atan2(n.vy,n.vx));ctx.fillStyle=n.friendly?'#dfffa9':'#ffb760';ctx.shadowColor=n.friendly?'#baff8d':'#ff8b42';ctx.shadowBlur=10;ctx.fillRect(-10,-3,20,6);ctx.restore()}
function drawPlayer(p){ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.facing,1);ctx.globalAlpha=p.invuln>0&&Math.floor(state.time*24)%2===0?.35:1;ctx.fillStyle='#0f1e15';ctx.beginPath();ctx.ellipse(0,2,14,20,0,0,TAU);ctx.fill();ctx.fillStyle='#345334';ctx.beginPath();ctx.moveTo(-13,-4);ctx.lineTo(0,-24);ctx.lineTo(14,-4);ctx.lineTo(10,17);ctx.lineTo(-10,17);ctx.closePath();ctx.fill();ctx.fillStyle='#e1f1c7';ctx.fillRect(5,-12,3,3);ctx.fillRect(10,-11,3,3);ctx.fillStyle='#607d59';ctx.fillRect(-10,16,7,12);ctx.fillRect(5,16,7,12);ctx.strokeStyle='#d8efaa';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(8,-2);ctx.lineTo(24,-11);ctx.stroke();if(p.attack){const box=attackBox(p)||deflectBox(p);if(box){ctx.globalAlpha=.36;ctx.strokeStyle='#e1ffad';ctx.lineWidth=8;ctx.beginPath();if(p.attack.type==='up')ctx.arc(0,-18,39,Math.PI,TAU);else if(p.attack.type==='down')ctx.arc(0,18,39,0,Math.PI);else ctx.arc(8,-2,42,-.9,.9);ctx.stroke()}}ctx.restore();if(p.wallDir&&!p.onGround){ctx.fillStyle='#b9d29a66';ctx.fillRect(p.x+p.wallDir*16,p.y-16,3,32)}}
function drawGate(){const open=state.enemies.every(e=>e.dead);ctx.save();ctx.translate(3440,820);ctx.fillStyle='#21351f';ctx.fillRect(-42,-110,84,110);ctx.strokeStyle=open?'#c9eda4':'#765f45';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-66,30,0,TAU);ctx.stroke();ctx.fillStyle=open?'#d9f6b033':'#b58a5320';ctx.beginPath();ctx.arc(0,-66,24,0,TAU);ctx.fill();ctx.fillStyle='#9db687';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(open?'HEARTWOOD OPEN':'CLEAR THE CREW',0,18);ctx.restore()}
function drawWorld(){ctx.save();worldTransform();for(const r of roots)drawRoot(r);for(const t of trunks)drawTrunk(t);for(const b of branches)drawBranch(b);for(const v of vines)drawVine(v);for(let i=0;i<checkpoints.length;i++)drawCheckpoint(checkpoints[i],i);drawGate();for(const e of state.enemies){if(!e.dead)(e.kind==='logger'?drawLogger:drawNailgun)(e)}for(const n of state.nails)drawNail(n);drawPlayer(state.player);for(const f of state.fx){ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(f.x,f.y,f.size,0,TAU);ctx.fill()}ctx.globalAlpha=1;for(const m of motes){const x=m.x,y=m.y+Math.sin(state.time*m.s+m.p)*8;if(x<state.camera.x-VW/2-40||x>state.camera.x+VW/2+40)continue;ctx.fillStyle='#cde7b233';ctx.beginPath();ctx.arc(x,y,1.5,0,TAU);ctx.fill()}ctx.restore()}
function drawForeground(){const g=ctx.createLinearGradient(0,VH-130,0,VH);g.addColorStop(0,'#02060400');g.addColorStop(1,'#010302c9');ctx.fillStyle=g;ctx.fillRect(0,VH-150,VW,150);if(state.flash>0){ctx.fillStyle=`rgba(255,210,150,${state.flash*.35})`;ctx.fillRect(0,0,VW,VH)}}
let cssW=VW,cssH=VH,scale=1,ox=0,oy=0,dpr=1;
function resize(){const r=canvas.getBoundingClientRect();cssW=r.width;cssH=r.height;dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);scale=Math.min(cssW/VW,cssH/VH);ox=(cssW-VW*scale)/2;oy=(cssH-VH*scale)/2}
addEventListener('resize',resize);resize();
function render(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*ox,dpr*oy);drawSky();drawWorld();drawForeground()}
let last=performance.now(),acc=0;
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;acc+=dt;let steps=0;while(acc>=FIXED_DT&&steps<8){update(FIXED_DT);acc-=FIXED_DT;steps++}render();requestAnimationFrame(frame)}
requestAnimationFrame(frame);

document.getElementById('start').addEventListener('click',()=>{audioCtx??=new AudioContext();reset(true)});
document.getElementById('restart').addEventListener('click',()=>reset(true));
document.getElementById('retry').addEventListener('click',()=>reset(true));
reset(false);
window.__SYLVARIA_V2__={
  version:'2.0.0-alpha.2',fixedDt:FIXED_DT,state,config:{move:MOVE,combat:COMBAT},reset:()=>reset(true),step:(ticks=1)=>{for(let i=0;i<ticks;i++)update(FIXED_DT);return window.__SYLVARIA_V2__.snapshot()},
  snapshot:()=>({mode:state.mode,time:state.time,player:{x:state.player.x,y:state.player.y,vx:state.player.vx,vy:state.player.vy,hp:state.player.hp,onGround:state.player.onGround,groundId:state.player.groundId,wallDir:state.player.wallDir,vineId:state.player.vineId,airStep:state.player.airStep,attack:state.player.attack?.type||null},enemies:state.enemies.filter(e=>!e.dead).map(e=>({id:e.id,kind:e.kind,hp:e.hp,state:e.state,x:e.x,y:e.y})),nails:state.nails.length,checkpoint:state.checkpoint,stats:{...state.stats},branches:branches.map(b=>({id:b.id,flex:b.flex,y:branchTop(b)})),vines:vines.map(v=>({id:v.id,angle:v.angle,tip:vineTip(v)})),camera:{...state.camera}})
};
