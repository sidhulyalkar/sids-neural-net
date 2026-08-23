import{VERSION,VIEW,WORLD,FIXED_DT,TAU,MOVE,COMBAT,CAMERA,COLORS}from'./config-v3.js';
import{InputController,prettyKey}from'./input-v3.js';
import{cloneWorld,zoneForY,ZONES}from'./world-v3.js';

const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const input=new InputController();
const ui={
  intro:document.getElementById('intro'),complete:document.getElementById('complete'),dead:document.getElementById('dead'),pause:document.getElementById('pausePanel'),
  health:document.getElementById('health'),objective:document.getElementById('objective'),zone:document.getElementById('zone'),altitude:document.getElementById('altitude'),
  airStep:document.getElementById('airStep'),settings:document.getElementById('settingsPanel'),settingsButton:document.getElementById('settingsButton'),closeSettings:document.getElementById('closeSettings'),
  bindList:document.getElementById('bindList'),resetBindings:document.getElementById('resetBindings'),start:document.getElementById('start'),restart:document.getElementById('restart'),retry:document.getElementById('retry'),
  stats:document.getElementById('completeStats'),boss:document.getElementById('bossHud'),bossName:document.getElementById('bossName'),bossBar:document.getElementById('bossBar'),bossGuard:document.getElementById('bossGuard'),
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const approach=(v,t,d)=>v<t?Math.min(t,v+d):Math.max(t,v-d);
const rect=(x,y,w,h)=>({l:x-w/2,r:x+w/2,t:y-h/2,b:y+h/2});
const overlap=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);

let world=cloneWorld();
const state={
  mode:'menu',time:0,player:null,projectiles:[],traps:[],fx:[],fxSerial:0,checkpoint:0,zone:'roots',camera:{x:VIEW.w/2,y:WORLD.h-VIEW.h/2},shake:0,flash:0,visualHold:0,
  bossActive:false,bossOpenTimer:0,bossPhase:1,stats:null,
};
const freshStats=()=>({slashes:0,upslashes:0,downslashes:0,plunges:0,dashSlashes:0,reflects:0,wallLaunches:0,vineReleases:0,branchLaunches:0,sapBounces:0,airDashes:0,kills:0,damageTaken:0,maxHeight:0});

function platformRect(platform){const flex=(platform.flex||0)*16;return rect(platform.x,platform.y+flex,platform.w,platform.h)}
function wallRect(wall){return rect(wall.x,wall.y,wall.w,wall.h)}
function playerRect(player=state.player){return rect(player.x,player.y,player.w,player.h)}
function enemyRect(enemy){return rect(enemy.x,enemy.y,enemy.w||34,enemy.h||50)}
function vineTip(vine){return{x:vine.ax+Math.sin(vine.angle)*vine.len,y:vine.ay+Math.cos(vine.angle)*vine.len}}
function currentZone(){return zoneForY(state.player?.y??WORLD.h-200)}
function findPlatform(id){return world.platforms.find(item=>item.id===id)||null}
function findWall(id){return world.walls.find(item=>item.id===id)||null}
function topOf(platform){return platformRect(platform).t}

function makePlayer(){
  const floor=findPlatform('root-floor');
  return{x:420,y:topOf(floor)-23,w:30,h:46,vx:0,vy:0,facing:1,onGround:true,groundId:'root-floor',coyote:MOVE.coyote,jumpBuffer:0,dropTimer:0,wallDir:0,wallId:null,wallTime:0,airDash:true,dashTime:0,dashRecover:0,dashDir:{x:0,y:0},vineId:null,attack:null,attackCooldown:0,combo:0,comboWindow:0,hp:5,maxHp:5,invuln:0};
}

function normalizeEnemy(enemy){
  const sizes={logger:[38,58],ranger:[40,54],climber:[36,48],drone:[48,34],trapper:[42,56]};
  const [w,h]=sizes[enemy.kind]||[38,52];
  enemy.w=w;enemy.h=h;enemy.vx=0;enemy.vy=0;enemy.baseX=enemy.x;enemy.baseY=enemy.y;enemy.dir=1;enemy.cooldown=0.25;enemy.snareCooldown=0.6;
  const platform=enemy.platform?findPlatform(enemy.platform):null;
  if(platform)enemy.y=topOf(platform)-enemy.h/2;
  const wall=enemy.wall?findWall(enemy.wall):null;
  if(wall){const r=wallRect(wall);enemy.x=enemy.side<0?r.l-enemy.w/2:r.r+enemy.w/2;enemy.y=clamp(enemy.y,r.t+enemy.h/2+30,r.b-enemy.h/2-30)}
  return enemy;
}

function reset(play=false){
  world=cloneWorld();
  state.time=0;state.player=makePlayer();state.projectiles=[];state.traps=[];state.fx=[];state.fxSerial=0;state.checkpoint=0;state.zone='roots';state.camera={x:VIEW.w/2,y:WORLD.h-VIEW.h/2};state.shake=0;state.flash=0;state.visualHold=0;state.bossActive=false;state.bossOpenTimer=0;state.bossPhase=1;state.stats=freshStats();
  world.enemies.forEach(normalizeEnemy);
  world.boss.w=92;world.boss.h=118;
  state.mode=play?'playing':'menu';
  ui.intro?.classList.toggle('hidden',play);ui.complete?.classList.add('hidden');ui.dead?.classList.add('hidden');ui.pause?.classList.add('hidden');ui.boss?.classList.add('hidden');
  input.clear();updateHud();
}

function spawnFx(x,y,color=COLORS.moon,count=8,speed=130){
  for(let i=0;i<count;i++){
    const a=(state.fxSerial*1.618+i*2.399)%TAU,r=.28+((state.fxSerial+i*5)%17)/17;
    state.fx.push({x,y,vx:Math.cos(a)*speed*r,vy:Math.sin(a)*speed*r-30,life:.28+(i%5)*.035,max:.45,size:1.5+(i%3),color});state.fxSerial++;
  }
  if(state.fx.length>220)state.fx.splice(0,state.fx.length-220);
}
let audioCtx=null;
function tone(freq=300,duration=.05,gain=.022,type='triangle'){
  try{audioCtx??=new AudioContext();const o=audioCtx.createOscillator(),a=audioCtx.createGain();o.type=type;o.frequency.value=freq;a.gain.setValueAtTime(gain,audioCtx.currentTime);a.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);o.connect(a).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch{}
}
function impact(kind='light'){state.visualHold=Math.max(state.visualHold,COMBAT.hitStopFrames[kind]||1);state.shake=Math.max(state.shake,kind==='heavy'?7:kind==='reflect'?4:3)}

function checkpointSpawn(){const cp=world.checkpoints[state.checkpoint]||world.checkpoints[0];return{x:cp.x,y:cp.y}}
function hurtPlayer(sourceX,amount=1){
  const p=state.player;if(!p||p.invuln>0||state.mode!=='playing')return;
  p.hp-=amount;p.invuln=.82;p.vineId=null;p.dashTime=0;p.vx=(p.x<sourceX?-1:1)*365;p.vy=-390;state.stats.damageTaken+=amount;state.flash=.2;impact('heavy');spawnFx(p.x,p.y,COLORS.danger,16,190);tone(92,.12,.05,'sawtooth');
  if(p.hp<=0){state.mode='dead';ui.dead?.classList.remove('hidden')}
}
function respawnFromFall(){const p=state.player,cp=checkpointSpawn();p.x=cp.x;p.y=cp.y-30;p.vx=0;p.vy=0;p.hp=Math.max(1,p.hp-1);p.invuln=1;p.vineId=null;p.airDash=true;state.stats.damageTaken++;state.camera.y=clamp(p.y,VIEW.h/2,WORLD.h-VIEW.h/2);spawnFx(p.x,p.y,COLORS.moon,18,130);if(p.hp<=0){state.mode='dead';ui.dead?.classList.remove('hidden')}}

function detectWall(player){
  const body=playerRect(player);
  for(const wall of world.walls){const r=wallRect(wall);if(body.b<=r.t+8||body.t>=r.b-8)continue;if(Math.abs(body.r-r.l)<=9)return{dir:1,id:wall.id};if(Math.abs(body.l-r.r)<=9)return{dir:-1,id:wall.id}}
  return{dir:0,id:null};
}
function collideHorizontal(player,dx){
  player.x+=dx;let hit=0;const body=()=>playerRect(player);
  for(const wall of world.walls){const r=wallRect(wall);if(!overlap(body(),r))continue;if(dx>0){player.x=r.l-player.w/2;hit=1}else if(dx<0){player.x=r.r+player.w/2;hit=-1}}
  player.x=clamp(player.x,player.w/2,WORLD.w-player.w/2);return hit;
}
function collideVertical(player,dy){
  const prevBottom=player.y+player.h/2,prevTop=player.y-player.h/2;player.y+=dy;player.onGround=false;player.groundId=null;let landed=null;
  if(dy>=0){
    let best=Infinity;
    if(player.dropTimer<=0){
      for(const platform of world.platforms){if(platform.broken)continue;const r=platformRect(platform),body=playerRect(player);if(body.r<=r.l+4||body.l>=r.r-4)continue;if(prevBottom<=r.t+7&&body.b>=r.t&&r.t<best){best=r.t;landed=platform}}
    }
    for(const wall of world.walls){const r=wallRect(wall),body=playerRect(player);if(body.r<=r.l+4||body.l>=r.r-4)continue;if(prevBottom<=r.t+6&&body.b>=r.t&&r.t<best){best=r.t;landed=wall}}
    if(landed){const r='type'in landed?platformRect(landed):wallRect(landed),speed=player.vy;player.y=r.t-player.h/2;player.vy=0;player.onGround=true;player.groundId=landed.id;player.coyote=MOVE.coyote;player.airDash=true;if('type'in landed&&landed.type==='spring')landed.flex=clamp((landed.flex||0)+Math.max(0,speed-180)/780,0,1)}
  }else{
    for(const wall of world.walls){const r=wallRect(wall),body=playerRect(player);if(body.r<=r.l||body.l>=r.r)continue;if(prevTop>=r.b-5&&body.t<=r.b){player.y=r.b+player.h/2;player.vy=0;break}}
  }
  return landed;
}

function updatePlatforms(dt){
  const p=state.player;
  for(const platform of world.platforms){
    if(platform.breakTimer>0){platform.breakTimer-=dt;if(platform.breakTimer<=0){platform.broken=false;platform.standTime=0}}
    if(platform.type==='sap'&&!platform.sapCharged){platform.sapTimer=(platform.sapTimer||0)-dt;if(platform.sapTimer<=0)platform.sapCharged=true}
    const supported=p.onGround&&p.groundId===platform.id&&!platform.broken;
    const oldTop=topOf(platform);
    if(platform.type==='spring'){
      if(supported)platform.flex=clamp((platform.flex||0)+dt*(1.2+(platform.spring||1)*.8),0,1);else platform.flex=Math.max(0,(platform.flex||0)-dt*(2.25+(platform.spring||1)*.45));
      const delta=topOf(platform)-oldTop;if(supported&&Math.abs(delta)>MOVE.branchCarryEpsilon)p.y+=delta;
    }
    if(platform.type==='dead'){
      platform.standTime=supported?(platform.standTime||0)+dt:Math.max(0,(platform.standTime||0)-dt*2.5);
      if(platform.standTime>.52&&!platform.broken){platform.broken=true;platform.breakTimer=3.4;if(supported){p.onGround=false;p.groundId=null;p.coyote=MOVE.coyote}spawnFx(platform.x,platform.y,'#aa8c61',12,120);tone(135,.08,.03,'square')}
    }
  }
}
function updateVines(dt){
  for(const vine of world.vines){const zone=zoneForY(vine.ay);const torque=-Math.sin(vine.angle)*2.2+zone.wind*.35;vine.angVel+=(torque-vine.angVel*.3)*dt;vine.angle=clamp(vine.angle+vine.angVel*dt,-1.22,1.22)}
  const p=state.player;if(!p.vineId)return;const vine=world.vines.find(item=>item.id===p.vineId);if(!vine){p.vineId=null;return}vine.angVel+=input.axisX()*MOVE.vinePump*dt;const tip=vineTip(vine);p.x=tip.x;p.y=tip.y;p.vx=0;p.vy=0;p.onGround=false;p.groundId=null;p.wallDir=0;p.wallId=null;
}
function tryGrabVine(){
  const p=state.player;if(p.onGround||p.vineId)return false;let best=null,bestD=MOVE.vineGrabRadius;
  for(const vine of world.vines){const t=vineTip(vine),d=dist(p.x,p.y,t.x,t.y);if(d<bestD){best=vine;bestD=d}}
  if(!best)return false;p.vineId=best.id;p.vx=0;p.vy=0;tone(285,.04,.018);return true;
}
function releaseVine(jump=true){
  const p=state.player,vine=world.vines.find(item=>item.id===p.vineId);if(!vine)return;
  if(jump){const tangent=vine.angVel*vine.len;p.vx=Math.cos(vine.angle)*tangent+input.axisX()*125;p.vy=-Math.sin(vine.angle)*tangent-MOVE.vineReleaseLift;p.airDash=true;state.stats.vineReleases++;tone(420,.05,.022)}p.vineId=null;
}

function attackProfile(type){return COMBAT[type]||COMBAT.side}
function startAttack(){
  const p=state.player;if(p.attackCooldown>0||state.mode!=='playing')return;
  let type='side';
  if(p.dashTime>0||p.dashRecover>0)type='dash';
  else if(p.wallDir&&!p.onGround)type='wall';
  else if(input.is('down')&&!p.onGround)type=p.vy>360?'plunge':'down';
  else if(input.is('up'))type='up';
  const profile=attackProfile(type);p.attack={type,time:0,duration:profile.duration,hit:new Set(),deflected:new Set()};p.attackCooldown=COMBAT.attackCooldown;
  if(type==='side'){p.combo=p.comboWindow>0?(p.combo%3)+1:1;p.comboWindow=COMBAT.comboWindow}else p.combo=1;
  state.stats.slashes++;if(type==='up')state.stats.upslashes++;if(type==='down')state.stats.downslashes++;if(type==='plunge')state.stats.plunges++;if(type==='dash')state.stats.dashSlashes++;
  tone(type==='plunge'?225:type==='down'?280:type==='up'?380:type==='dash'?510:330+p.combo*38,.045,.024);
}
function attackBox(player,deflect=false){
  const attack=player.attack;if(!attack)return null;const profile=attackProfile(attack.type),time=attack.time;
  if(deflect){if(time>COMBAT.projectileDeflectWindow)return null}else if(time<profile.startup||time>profile.activeEnd)return null;
  if(attack.type==='up')return rect(player.x,player.y-profile.reach/2-25,profile.width,profile.reach);
  if(attack.type==='down'||attack.type==='plunge')return rect(player.x,player.y+profile.reach/2+25,profile.width,profile.reach);
  const facing=attack.type==='wall'&&player.wallDir?-player.wallDir:player.facing;return rect(player.x+facing*(profile.reach/2+21),player.y-2,profile.reach,profile.height);
}
function reflectProjectile(projectile,player,attack){
  if(projectile.friendly)return;projectile.friendly=true;projectile.owner='player';state.stats.reflects++;const speed=COMBAT.reflectSpeed;
  if(attack.type==='up'){projectile.vx=player.facing*speed*.28;projectile.vy=-speed*.96}else if(attack.type==='down'||attack.type==='plunge'){projectile.vx=player.facing*speed*.22;projectile.vy=speed*.98}else{const facing=attack.type==='wall'&&player.wallDir?-player.wallDir:player.facing;projectile.vx=facing*speed;projectile.vy=-35}
  projectile.life=3.4;impact('reflect');spawnFx(projectile.x,projectile.y,COLORS.blade,12,185);tone(760,.052,.034,'square');
}
function bounceFromDownHit(power=COMBAT.downBounce){const p=state.player;p.vy=-power;p.airDash=true;p.onGround=false;p.groundId=null;state.stats.branchLaunches++;impact('heavy')}
function hitEnemy(enemy,attack){
  if(enemy.dead)return;const profile=attackProfile(attack.type);let damage=profile.damage;
  if(attack.type==='side'&&state.player.combo===3)damage*=1.35;
  enemy.hp-=damage;enemy.hitFlash=.12;enemy.recover=Math.max(enemy.recover||0,.16);enemy.state='recover';
  if(attack.type==='up')enemy.visualLift=(enemy.visualLift||0)-COMBAT.enemyLaunch*.035;
  if(attack.type==='down'||attack.type==='plunge')bounceFromDownHit(attack.type==='plunge'?COMBAT.plungeBounce:COMBAT.downBounce);
  impact(attack.type==='plunge'||attack.type==='dash'?'heavy':'light');spawnFx(enemy.x,enemy.y,COLORS.blade,10,145);tone(220,.04,.026);
  if(enemy.hp<=0){enemy.dead=true;state.stats.kills++;spawnFx(enemy.x,enemy.y,COLORS.industrial,20,190);tone(120,.075,.03,'square')}
}
function hitBoss(attack){
  const boss=world.boss;if(!state.bossActive||boss.dead)return;
  if(boss.guard>0){if(['down','plunge','dash'].includes(attack.type)){boss.guard=Math.max(0,boss.guard-1);impact('heavy');spawnFx(boss.x,boss.y,COLORS.blade,16,170);tone(180,.08,.035,'square');if(boss.guard===0){state.bossOpenTimer=2.6;boss.state='stagger';boss.recover=.55}}return}
  const damage=attackProfile(attack.type).damage*(attack.type==='plunge'?1.35:1);boss.hp-=damage;boss.hitFlash=.14;impact('heavy');spawnFx(boss.x,boss.y-18,COLORS.blade,18,180);if(attack.type==='down'||attack.type==='plunge')bounceFromDownHit(attack.type==='plunge'?COMBAT.plungeBounce:COMBAT.downBounce);
  if(boss.hp<=0){boss.hp=0;boss.dead=true;boss.state='dead';state.stats.kills++;state.bossOpenTimer=0;spawnFx(boss.x,boss.y,COLORS.spirit,42,240);tone(82,.28,.045,'sawtooth')}
}
function updateAttack(dt){
  const p=state.player;if(p.attackCooldown>0)p.attackCooldown=Math.max(0,p.attackCooldown-dt);if(p.comboWindow>0)p.comboWindow=Math.max(0,p.comboWindow-dt);if(!p.attack)return;p.attack.time+=dt;
  const damageBox=attackBox(p,false);
  if(damageBox){
    for(const enemy of world.enemies){if(enemy.dead||p.attack.hit.has(enemy.id))continue;if(overlap(damageBox,enemyRect(enemy))){p.attack.hit.add(enemy.id);hitEnemy(enemy,p.attack)}}
    if(state.bossActive&&!world.boss.dead&&!p.attack.hit.has(world.boss.id)&&overlap(damageBox,enemyRect(world.boss))){p.attack.hit.add(world.boss.id);hitBoss(p.attack)}
    if(p.attack.type==='down'||p.attack.type==='plunge'){
      for(const platform of world.platforms){if(platform.broken||p.attack.hit.has(platform.id))continue;if(overlap(damageBox,platformRect(platform))){p.attack.hit.add(platform.id);if(platform.type==='spring'){platform.flex=1;bounceFromDownHit(p.attack.type==='plunge'?COMBAT.plungeBounce:COMBAT.downBounce)}else if(platform.type==='sap'&&platform.sapCharged){platform.sapCharged=false;platform.sapTimer=4;state.stats.sapBounces++;bounceFromDownHit(COMBAT.plungeBounce);spawnFx(platform.x,topOf(platform),COLORS.spirit,18,160);tone(590,.08,.025)}else if(platform.type==='dead'){platform.broken=true;platform.breakTimer=3.4;bounceFromDownHit(COMBAT.downBounce*.86);spawnFx(platform.x,platform.y,'#a98a62',14,150)}}}
    }
  }
  if(p.attack.time>=p.attack.duration)p.attack=null;
}
function startAirDash(){
  const p=state.player;if(!p.airDash||p.dashTime>0||p.vineId)return;let dir=input.direction();if(!dir.x&&!dir.y)dir={x:p.facing,y:0};p.dashDir=dir;p.dashTime=MOVE.airDashTime;p.dashRecover=0;p.airDash=false;p.attack=null;p.attackCooldown=0;state.stats.airDashes++;spawnFx(p.x,p.y,COLORS.guardianEdge,10,120);tone(525,.045,.025);
}

function updatePlayer(dt){
  const p=state.player;if(!p)return;
  if(p.invuln>0)p.invuln=Math.max(0,p.invuln-dt);if(p.jumpBuffer>0)p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);if(p.coyote>0&&!p.onGround)p.coyote=Math.max(0,p.coyote-dt);if(p.dropTimer>0)p.dropTimer=Math.max(0,p.dropTimer-dt);if(p.dashRecover>0)p.dashRecover=Math.max(0,p.dashRecover-dt);
  updateAttack(dt);
  if(input.take('attack'))startAttack();
  const jumpPressed=input.take('jump');if(jumpPressed)p.jumpBuffer=MOVE.jumpBuffer;
  if(input.take('dash'))startAirDash();
  if(input.take('interact')){if(p.vineId)releaseVine(false);else tryGrabVine()}
  if(p.vineId){if(jumpPressed)releaseVine(true);return}
  if(input.is('up')&&!p.onGround&&!p.attack)tryGrabVine();
  if(input.is('down')&&jumpPressed&&p.onGround){p.dropTimer=.18;p.onGround=false;p.groundId=null;p.y+=6;p.jumpBuffer=0}
  const wall=detectWall(p);p.wallDir=wall.dir;p.wallId=wall.id;
  const move=input.axisX();if(move)p.facing=move;
  if(p.jumpBuffer>0&&(p.onGround||p.coyote>0||p.wallDir)){
    if(p.wallDir&&!p.onGround){p.vx=-p.wallDir*MOVE.wallLaunchX;p.vy=-MOVE.wallLaunchY;p.onGround=false;p.coyote=0;p.airDash=true;p.wallTime=0;state.stats.wallLaunches++;spawnFx(p.x,p.y,COLORS.guardianEdge,9,130);tone(385,.045,.02)}
    else{let extra=0;const ground=findPlatform(p.groundId);if(ground?.type==='spring'){extra=(ground.flex||0)*250*(ground.spring||1);ground.flex*=.2;if(extra>45)state.stats.branchLaunches++}p.vy=-MOVE.jumpSpeed-extra;p.onGround=false;p.groundId=null;p.coyote=0;tone(350+Math.min(180,extra),.04,.018)}p.jumpBuffer=0;
  }
  if(p.dashTime>0){p.dashTime=Math.max(0,p.dashTime-dt);p.vx=p.dashDir.x*MOVE.airDashSpeed;p.vy=p.dashDir.y*MOVE.airDashSpeed;const hx=collideHorizontal(p,p.vx*dt);if(hx)p.dashTime=0;collideVertical(p,p.vy*dt);if(p.dashTime<=0){p.vx*=.7;p.vy*=.55;p.dashRecover=MOVE.airDashRecover}return}
  const target=move*MOVE.runSpeed,accel=p.onGround?MOVE.groundAccel:MOVE.airAccel;p.vx=approach(p.vx,target,accel*dt);if(!move&&p.onGround)p.vx=approach(p.vx,0,MOVE.groundBrake*dt);
  const gripping=p.wallDir&&((p.wallDir===1&&input.is('right'))||(p.wallDir===-1&&input.is('left')))&&!p.onGround&&p.vy>0&&p.wallTime<MOVE.wallGripTime;
  if(gripping){p.vy=Math.min(p.vy,MOVE.wallFall);p.wallTime+=dt;p.airDash=true}else{const wind=currentZone().wind*(p.onGround?0:130);p.vx+=wind*dt;p.vy=Math.min(MOVE.maxFall,p.vy+MOVE.gravity*dt);p.wallTime=Math.max(0,p.wallTime-dt*1.8)}
  collideHorizontal(p,p.vx*dt);collideVertical(p,p.vy*dt);
  if(!input.is('jump')&&p.vy<-180)p.vy+=MOVE.gravity*MOVE.jumpCutGravity*dt;
  if(p.y>WORLD.h+80)respawnFromFall();
}

function enemyPlatformPose(enemy){const platform=findPlatform(enemy.platform);if(!platform||platform.broken)return null;enemy.y=topOf(platform)-enemy.h/2;return platform}
function updateLogger(enemy,dt){
  const platform=enemyPlatformPose(enemy);if(!platform){enemy.dead=true;return}const p=state.player,dx=p.x-enemy.x,dy=Math.abs(p.y-enemy.y);enemy.facing=dx<0?-1:1;
  if(enemy.state==='windup'){enemy.windup-=dt;if(enemy.windup<=0){enemy.state='strike';enemy.clock=.13;enemy.attackSerial++;tone(125,.05,.026,'square')}return}
  if(enemy.state==='strike'){enemy.clock-=dt;if(enemy.clock>.035&&overlap(rect(enemy.x+enemy.facing*42,enemy.y,66,50),playerRect()))hurtPlayer(enemy.x);if(enemy.clock<=0){enemy.state='recover';enemy.recover=.36}return}
  if(enemy.state==='recover'){enemy.recover-=dt;if(enemy.recover<=0)enemy.state='idle';return}
  if(dy<90&&Math.abs(dx)<118){enemy.state='windup';enemy.windup=.28;return}
  const half=platform.w/2-28,dir=Math.abs(dx)<300?Math.sign(dx):enemy.dir;enemy.dir=dir||enemy.dir;enemy.x=clamp(enemy.x+enemy.dir*88*dt,platform.x-half,platform.x+half);
}
function spawnProjectile(kind,x,y,vx,vy,extra={}){state.projectiles.push({kind,x,y,vx,vy,r:kind==='saw'?13:kind==='snare'?9:7,life:4,friendly:false,owner:'enemy',dead:false,...extra})}
function fireNail(enemy){const p=state.player,dx=p.x-enemy.x,dy=p.y-enemy.y,m=Math.hypot(dx,dy)||1,speed=610;spawnProjectile('nail',enemy.x+enemy.facing*28,enemy.y-8,dx/m*speed,dy/m*speed,{owner:enemy.id});tone(185,.04,.029,'square')}
function updateRanger(enemy,dt){
  const platform=enemyPlatformPose(enemy);if(!platform){enemy.dead=true;return}const p=state.player,dx=p.x-enemy.x,dy=p.y-enemy.y;enemy.facing=dx<0?-1:1;
  if(enemy.state==='aim'){enemy.windup-=dt;if(enemy.windup<=0){fireNail(enemy);enemy.state='recover';enemy.recover=.78}return}
  if(enemy.state==='recover'){enemy.recover-=dt;if(enemy.recover<=0)enemy.state='idle';return}
  if(Math.abs(dx)<900&&Math.abs(dy)<480){enemy.state='aim';enemy.windup=.42;return}
}
function updateClimber(enemy,dt){
  const wall=findWall(enemy.wall);if(!wall){enemy.dead=true;return}const r=wallRect(wall),p=state.player;
  if(enemy.state==='leap'){enemy.clock-=dt;enemy.x+=enemy.vx*dt;enemy.y+=enemy.vy*dt;if(overlap(enemyRect(enemy),playerRect()))hurtPlayer(enemy.x);if(enemy.clock<=0){enemy.state='recover';enemy.recover=.48;enemy.x=enemy.side<0?r.l-enemy.w/2:r.r+enemy.w/2;enemy.y=clamp(enemy.y,r.t+55,r.b-55)}return}
  if(enemy.state==='windup'){enemy.windup-=dt;if(enemy.windup<=0){const dx=p.x-enemy.x,dy=p.y-enemy.y,m=Math.hypot(dx,dy)||1;enemy.vx=dx/m*470;enemy.vy=dy/m*470;enemy.state='leap';enemy.clock=.42}return}
  if(enemy.state==='recover'){enemy.recover-=dt;if(enemy.recover<=0)enemy.state='idle';return}
  enemy.y+=enemy.dir*62*dt;if(enemy.y<r.t+65||enemy.y>r.b-65)enemy.dir*=-1;enemy.x=enemy.side<0?r.l-enemy.w/2:r.r+enemy.w/2;enemy.facing=p.x<enemy.x?-1:1;if(dist(enemy.x,enemy.y,p.x,p.y)<285){enemy.state='windup';enemy.windup=.3}
}
function updateDrone(enemy,dt){
  const p=state.player;enemy.x=enemy.baseX+Math.sin(state.time*1.15+enemy.baseY*.01)*(enemy.rangeX||150);enemy.y=enemy.baseY+Math.sin(state.time*.9+enemy.baseX*.02)*26;enemy.facing=p.x<enemy.x?-1:1;enemy.cooldown-=dt;
  if(enemy.cooldown<=0&&dist(enemy.x,enemy.y,p.x,p.y)<720){const dx=p.x-enemy.x,dy=p.y-enemy.y,m=Math.hypot(dx,dy)||1;spawnProjectile('saw',enemy.x,enemy.y,dx/m*360,dy/m*360,{owner:enemy.id,spin:0});enemy.cooldown=1.18;tone(145,.08,.022,'sawtooth')}
}
function updateTrapper(enemy,dt){
  const platform=enemyPlatformPose(enemy);if(!platform){enemy.dead=true;return}const p=state.player;enemy.facing=p.x<enemy.x?-1:1;enemy.snareCooldown-=dt;
  if(enemy.state==='aim'){enemy.windup-=dt;if(enemy.windup<=0){const dx=p.x-enemy.x,dy=p.y-enemy.y,m=Math.hypot(dx,dy)||1;spawnProjectile('snare',enemy.x,enemy.y-10,dx/m*330,dy/m*330,{owner:enemy.id});enemy.state='recover';enemy.recover=.65}return}
  if(enemy.state==='recover'){enemy.recover-=dt;if(enemy.recover<=0)enemy.state='idle';return}
  if(enemy.snareCooldown<=0&&dist(enemy.x,enemy.y,p.x,p.y)<620){enemy.state='aim';enemy.windup=.46;enemy.snareCooldown=2.1}
}
function updateEnemies(dt){
  for(const enemy of world.enemies){if(enemy.dead)continue;enemy.hitFlash=Math.max(0,(enemy.hitFlash||0)-dt);enemy.visualLift=approach(enemy.visualLift||0,0,80*dt);if(enemy.kind==='logger')updateLogger(enemy,dt);else if(enemy.kind==='ranger')updateRanger(enemy,dt);else if(enemy.kind==='climber')updateClimber(enemy,dt);else if(enemy.kind==='drone')updateDrone(enemy,dt);else updateTrapper(enemy,dt)}
}

function createTrap(x,y){state.traps.push({x,y,w:105,h:36,life:2.8,tick:0})}
function projectileBlocked(projectile){for(const wall of world.walls)if(overlap(rect(projectile.x,projectile.y,projectile.r*2,projectile.r*2),wallRect(wall)))return true;return false}
function updateProjectiles(dt){
  const p=state.player,deflect=attackBox(p,true);
  for(const projectile of state.projectiles){if(projectile.dead)continue;projectile.life-=dt;if(projectile.life<=0){if(projectile.kind==='snare'&&!projectile.friendly)createTrap(projectile.x,projectile.y);projectile.dead=true;continue}projectile.x+=projectile.vx*dt;projectile.y+=projectile.vy*dt;if(projectile.kind==='saw')projectile.spin=(projectile.spin||0)+dt*14;
    if(!projectile.friendly&&deflect&&p.attack&&!p.attack.deflected.has(projectile)&&overlap(deflect,rect(projectile.x,projectile.y,projectile.r*2,projectile.r*2))){p.attack.deflected.add(projectile);reflectProjectile(projectile,p,p.attack);continue}
    if(projectile.friendly){
      let hit=false;for(const enemy of world.enemies){if(enemy.dead||!overlap(rect(projectile.x,projectile.y,projectile.r*2,projectile.r*2),enemyRect(enemy)))continue;enemy.hp-=2;enemy.hitFlash=.14;projectile.dead=true;hit=true;impact('reflect');if(enemy.hp<=0){enemy.dead=true;state.stats.kills++}break}
      if(!hit&&state.bossActive&&!world.boss.dead&&overlap(rect(projectile.x,projectile.y,projectile.r*2,projectile.r*2),enemyRect(world.boss))){if(world.boss.guard>0)world.boss.guard=Math.max(0,world.boss.guard-1);else world.boss.hp=Math.max(0,world.boss.hp-2);projectile.dead=true;impact('reflect')}
    }else if(overlap(rect(projectile.x,projectile.y,projectile.r*2,projectile.r*2),playerRect())){hurtPlayer(projectile.x);projectile.dead=true}
    if(!projectile.dead&&projectileBlocked(projectile)){if(projectile.kind==='snare'&&!projectile.friendly)createTrap(projectile.x,projectile.y);projectile.dead=true;spawnFx(projectile.x,projectile.y,'#9b815d',5,70)}
  }
  state.projectiles=state.projectiles.filter(item=>!item.dead&&item.x>-100&&item.x<WORLD.w+100&&item.y>-100&&item.y<WORLD.h+100);
  for(const trap of state.traps){trap.life-=dt;trap.tick-=dt;if(overlap(rect(trap.x,trap.y,trap.w,trap.h),playerRect())&&trap.tick<=0){hurtPlayer(trap.x);trap.tick=.7;state.player.vx*=.45}}
  state.traps=state.traps.filter(item=>item.life>0);
}

function updateHazards(){
  for(const hazard of world.hazards){const wave=Math.sin(state.time*hazard.speed+hazard.phase)*hazard.range;hazard.x=hazard.x0+(hazard.axis==='x'?wave:0);hazard.y=hazard.y0+(hazard.axis==='y'?wave:0);if(overlap(rect(hazard.x,hazard.y,hazard.r*2,hazard.r*2),playerRect()))hurtPlayer(hazard.x)}
}

function activateBoss(){if(state.bossActive)return;state.bossActive=true;const boss=world.boss;boss.state='idle';boss.clock=.55;boss.guard=3;boss.maxGuard=3;state.bossPhase=1;ui.boss?.classList.remove('hidden');tone(72,.3,.035,'sawtooth')}
function bossPhaseForHp(hp){return hp>16?1:hp>8?2:3}
function startBossAttack(boss){const index=boss.attackSerial++%3;if(index===0){boss.state='axeWindup';boss.windup=.34-Math.min(.1,(boss.phase-1)*.045)}else if(index===1){boss.state='volleyWindup';boss.windup=.42-Math.min(.1,(boss.phase-1)*.04)}else{boss.state='sawWindup';boss.windup=.48-Math.min(.12,(boss.phase-1)*.05)}}
function updateBoss(dt){
  const boss=world.boss;if(!state.bossActive||boss.dead)return;boss.hitFlash=Math.max(0,(boss.hitFlash||0)-dt);const p=state.player;boss.facing=p.x<boss.x?-1:1;
  const phase=bossPhaseForHp(boss.hp);if(phase!==boss.phase){boss.phase=phase;state.bossPhase=phase;boss.maxGuard=2+phase;boss.guard=boss.maxGuard;state.bossOpenTimer=0;spawnFx(boss.x,boss.y,COLORS.danger,22,180);tone(105,.14,.035,'square')}
  if(boss.guard===0){state.bossOpenTimer=Math.max(0,state.bossOpenTimer-dt);if(state.bossOpenTimer<=0&&boss.state!=='stagger'){boss.guard=boss.maxGuard}}
  if(boss.state==='stagger'){boss.recover-=dt;if(boss.recover<=0)boss.state='idle';return}
  if(boss.state==='axeWindup'){boss.windup-=dt;if(boss.windup<=0){boss.state='axeStrike';boss.clock=.15;tone(88,.08,.035,'square')}return}
  if(boss.state==='axeStrike'){boss.clock-=dt;const hit=rect(boss.x+boss.facing*72,boss.y+18,115,78);if(boss.clock>.04&&overlap(hit,playerRect()))hurtPlayer(boss.x);if(boss.clock<=0){boss.state='recover';boss.recover=.42-.06*(boss.phase-1)}return}
  if(boss.state==='volleyWindup'){boss.windup-=dt;if(boss.windup<=0){for(const spread of[-.18,0,.18]){const dx=p.x-boss.x,dy=p.y-boss.y,a=Math.atan2(dy,dx)+spread,s=600+boss.phase*35;spawnProjectile('nail',boss.x+boss.facing*45,boss.y-30,Math.cos(a)*s,Math.sin(a)*s,{owner:boss.id})}boss.state='recover';boss.recover=.46-.05*(boss.phase-1)}return}
  if(boss.state==='sawWindup'){boss.windup-=dt;if(boss.windup<=0){const dx=p.x-boss.x,dy=p.y-boss.y,m=Math.hypot(dx,dy)||1,s=385+boss.phase*35;spawnProjectile('saw',boss.x,boss.y-24,dx/m*s,dy/m*s,{owner:boss.id,spin:0});if(boss.phase>=3)spawnProjectile('saw',boss.x,boss.y-24,-dx/m*s,dy/m*s,{owner:boss.id,spin:0});boss.state='recover';boss.recover=.48-.05*(boss.phase-1)}return}
  if(boss.state==='recover'){boss.recover-=dt;if(boss.recover<=0)boss.state='idle';return}
  const target=p.x<boss.x?boss.x-1:boss.x+1;boss.x=clamp(boss.x+Math.sign(target-boss.x)*65*dt,610,1150);boss.clock-=dt;if(boss.clock<=0){startBossAttack(boss);boss.clock=.58-.09*(boss.phase-1)}
}

function updateCheckpoints(){
  const p=state.player;for(let i=state.checkpoint+1;i<world.checkpoints.length;i++){const cp=world.checkpoints[i];if(p.y<=cp.y){state.checkpoint=i;cp.lit=true;p.hp=Math.min(p.maxHp,p.hp+1);spawnFx(cp.x,cp.y,COLORS.spirit,18,120);tone(650,.09,.024);break}}
}
function updateFx(dt){for(const f of state.fx){f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=280*dt;f.vx*=.986}state.fx=state.fx.filter(f=>f.life>0)}
function updateCamera(dt){
  const p=state.player,verticalLead=p.vy<0?-CAMERA.verticalLeadUp:CAMERA.verticalLeadDown,tx=clamp(p.x+p.facing*CAMERA.horizontalLead+clamp(p.vx*.16,-90,90),VIEW.w/2,WORLD.w-VIEW.w/2),ty=clamp(p.y+verticalLead,VIEW.h/2,WORLD.h-VIEW.h/2);state.camera.x=lerp(state.camera.x,tx,1-Math.exp(-CAMERA.stiffnessX*dt));state.camera.y=lerp(state.camera.y,ty,1-Math.exp(-CAMERA.stiffnessY*dt));
}
function update(dt){
  if(state.mode!=='playing')return;state.time+=dt;state.flash=Math.max(0,state.flash-dt);state.shake=Math.max(0,state.shake-dt*20);updatePlatforms(dt);updateVines(dt);updatePlayer(dt);updateEnemies(dt);updateBoss(dt);updateProjectiles(dt);updateHazards();updateCheckpoints();updateFx(dt);updateCamera(dt);
  const zone=currentZone();state.zone=zone.id;state.stats.maxHeight=Math.max(state.stats.maxHeight,WORLD.h-state.player.y);if(state.player.y<650)activateBoss();
  if(world.boss.dead&&state.player.y<300){state.mode='complete';ui.complete?.classList.remove('hidden');ui.stats.textContent=`${Math.round(state.stats.maxHeight)}m climbed · ${state.stats.kills} threats cleared · ${state.stats.reflects} redirects · ${state.stats.downslashes+state.stats.plunges} downward strikes`;tone(700,.12,.03);setTimeout(()=>tone(930,.16,.025),110)}updateHud();
}

// ---------------------------------------------------------------------------
// Presentation: art direction follows the generated Old Growth target while
// retaining honest collision geometry and high-contrast action silhouettes.
// ---------------------------------------------------------------------------
const hash=(text)=>{let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const rngFrom=(seed)=>{let v=seed>>>0;return()=>{v+=0x6d2b79f5;let t=v;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}};
const artRng=rngFrom(hash('sylvaria-ancient-tree-v3'));
const distantTrees=Array.from({length:72},(_,i)=>({x:(i*123+artRng()*180)%2400,y:artRng()*WORLD.h,h:420+artRng()*720,w:30+artRng()*65,a:.08+artRng()*.16}));
const fireflies=Array.from({length:110},()=>({x:artRng()*WORLD.w,y:artRng()*WORLD.h,p:artRng()*TAU,s:.5+artRng()*1.5}));
function toScreen(x,y,parallax=1){return{x:x-(state.camera.x-VIEW.w/2)*parallax,y:y-(state.camera.y-VIEW.h/2)*parallax}}
function drawBackground(){
  const zone=currentZone(),g=ctx.createLinearGradient(0,0,0,VIEW.h);g.addColorStop(0,'#06100d');g.addColorStop(.52,'#0a1c17');g.addColorStop(1,'#162318');ctx.fillStyle=g;ctx.fillRect(0,0,VIEW.w,VIEW.h);
  const moon=toScreen(1370,state.camera.y-410,.08);ctx.fillStyle='rgba(204,229,206,.08)';ctx.beginPath();ctx.arc(moon.x,moon.y,145,0,TAU);ctx.fill();
  for(const tree of distantTrees){const p=toScreen(tree.x,tree.y,.18);if(p.y<-900||p.y>VIEW.h+900)continue;ctx.globalAlpha=tree.a;ctx.fillStyle='#050c09';ctx.fillRect(p.x-tree.w/2,p.y-tree.h,tree.w,tree.h);ctx.beginPath();ctx.moveTo(p.x,p.y-tree.h-160);ctx.lineTo(p.x-tree.w*3,p.y-tree.h*.45);ctx.lineTo(p.x+tree.w*3,p.y-tree.h*.45);ctx.closePath();ctx.fill()}ctx.globalAlpha=1;
  for(let i=0;i<5;i++){const cx=((i*320-state.camera.x*.05)%1800+1800)%1800-220,cy=120+i*115;const fog=ctx.createRadialGradient(cx,cy,20,cx,cy,360);fog.addColorStop(0,`rgba(170,199,181,${zone.fog*.2})`);fog.addColorStop(1,'rgba(170,199,181,0)');ctx.fillStyle=fog;ctx.fillRect(cx-380,cy-260,760,520)}
}
function worldTransform(){const sx=VIEW.w/2-state.camera.x+(state.shake?Math.sin(state.time*73)*state.shake:0),sy=VIEW.h/2-state.camera.y+(state.shake?Math.cos(state.time*61)*state.shake*.55:0);ctx.translate(sx,sy)}
function drawBarkWall(wall){
  const r=wallRect(wall),grad=ctx.createLinearGradient(r.l,0,r.r,0);grad.addColorStop(0,'#14160f');grad.addColorStop(.16,'#2d291b');grad.addColorStop(.5,'#57452b');grad.addColorStop(.78,'#2b281a');grad.addColorStop(1,'#11140e');ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(r.l+8,r.t);ctx.bezierCurveTo(r.l-18,r.t+r.h*.24,r.l+14,r.t+r.h*.7,r.l-7,r.b);ctx.lineTo(r.r+4,r.b);ctx.bezierCurveTo(r.r-16,r.t+r.h*.74,r.r+18,r.t+r.h*.3,r.r-6,r.t);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(162,132,78,.18)';ctx.lineWidth=4;for(let y=r.t+34;y<r.b;y+=72){ctx.beginPath();ctx.moveTo(r.l+18,y);ctx.bezierCurveTo(r.l+50,y-18,r.r-55,y+21,r.r-18,y+2);ctx.stroke()}
  ctx.fillStyle='rgba(111,139,78,.18)';ctx.fillRect(r.l-3,r.t,r.w+6,7);
}
function drawPlatform(platform){
  if(platform.broken)return;const r=platformRect(platform),moss=platform.type==='industrial'?'#595b4e':platform.type==='dead'?'#5b4731':'#526238';ctx.save();ctx.translate(platform.x,platform.y+(platform.flex||0)*16);if(platform.type==='industrial'){
    ctx.fillStyle='#242a26';ctx.fillRect(-platform.w/2,-platform.h/2,platform.w,platform.h);ctx.fillStyle='#9c7848';ctx.fillRect(-platform.w/2+6,-platform.h/2+3,platform.w-12,3);for(let x=-platform.w/2+14;x<platform.w/2;x+=28){ctx.fillStyle='#151b18';ctx.fillRect(x,-platform.h/2,4,platform.h)}
  }else{
    ctx.lineCap='round';ctx.strokeStyle='#11150d';ctx.lineWidth=platform.h+9;ctx.beginPath();ctx.moveTo(-platform.w/2+4,2);ctx.quadraticCurveTo(0,platform.type==='spring'?(platform.flex||0)*7:2,platform.w/2-5,-1);ctx.stroke();ctx.strokeStyle=moss;ctx.lineWidth=platform.h;ctx.beginPath();ctx.moveTo(-platform.w/2+4,2);ctx.quadraticCurveTo(0,platform.type==='spring'?(platform.flex||0)*7:2,platform.w/2-5,-1);ctx.stroke();ctx.strokeStyle=platform.type==='sap'&&platform.sapCharged?COLORS.spirit:'rgba(190,210,145,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-platform.w/2+10,-5);ctx.lineTo(platform.w/2-12,-7);ctx.stroke();for(let i=0;i<3;i++){const x=-platform.w*.3+i*platform.w*.3;ctx.strokeStyle='rgba(54,67,39,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,7);ctx.lineTo(x-7,15+i*2);ctx.stroke()}
  }ctx.restore();
}
function drawVine(vine){const t=vineTip(vine);ctx.strokeStyle='#48653b';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(vine.ax,vine.ay);ctx.quadraticCurveTo((vine.ax+t.x)/2+Math.sin(state.time+vine.angle)*7,(vine.ay+t.y)/2,t.x,t.y);ctx.stroke();for(let i=1;i<6;i++){const k=i/6,x=lerp(vine.ax,t.x,k),y=lerp(vine.ay,t.y,k);ctx.fillStyle='#6c8c50';ctx.beginPath();ctx.ellipse(x+(i%2?7:-7),y,6,3,i%2?.6:-.6,0,TAU);ctx.fill()}ctx.fillStyle=COLORS.guardianEdge;ctx.beginPath();ctx.arc(t.x,t.y,8,0,TAU);ctx.fill()}
function drawHazard(hazard){ctx.save();ctx.translate(hazard.x,hazard.y);ctx.rotate(state.time*4.5);ctx.fillStyle='#343a36';ctx.strokeStyle='#d7a45f';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<16;i++){const a=i/16*TAU,r=i%2?hazard.r*.7:hazard.r;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
function drawCheckpoint(cp,index){const lit=index<=state.checkpoint;ctx.globalAlpha=lit?.9:.28;ctx.strokeStyle=COLORS.spirit;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cp.x,cp.y,14+Math.sin(state.time*2+index)*2,0,TAU);ctx.stroke();ctx.fillStyle='rgba(184,243,212,.16)';ctx.beginPath();ctx.arc(cp.x,cp.y,8,0,TAU);ctx.fill();ctx.globalAlpha=1}
function drawGuardian(p){
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.facing,1);const blink=p.invuln>0&&Math.floor(state.time*28)%2===0;ctx.globalAlpha=blink?.38:1;const airborne=!p.onGround,lean=clamp(p.vx/700,-.18,.18);ctx.rotate(lean);
  ctx.fillStyle='#0c1710';ctx.beginPath();ctx.ellipse(0,3,14,21,0,0,TAU);ctx.fill();ctx.fillStyle='#27452d';ctx.beginPath();ctx.moveTo(-14,-7);ctx.quadraticCurveTo(-4,-28,5,-24);ctx.lineTo(16,-4);ctx.lineTo(11,19);ctx.lineTo(-10,19);ctx.closePath();ctx.fill();
  ctx.fillStyle='#55734d';ctx.beginPath();ctx.moveTo(-11,-10);ctx.lineTo(-5,-29);ctx.lineTo(1,-14);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(8,-11);ctx.lineTo(13,-28);ctx.lineTo(16,-7);ctx.closePath();ctx.fill();
  ctx.fillStyle='#dff4c8';ctx.fillRect(5,-13,3,3);ctx.fillRect(10,-12,3,3);
  ctx.strokeStyle='#6f8c63';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-7,18);ctx.lineTo(-10+(airborne?-4:0),29);ctx.moveTo(7,18);ctx.lineTo(10+(airborne?4:0),29);ctx.stroke();
  // A substantial, always-readable machete: wrapped handle, guard, bright steel blade.
  const attack=p.attack,wallFacing=attack?.type==='wall'&&p.wallDir?-p.wallDir:1;ctx.save();ctx.scale(wallFacing,1);let angle=-.33;if(attack?.type==='up')angle=-1.3;else if(attack?.type==='down'||attack?.type==='plunge')angle=1.18;else if(attack?.type==='dash')angle=-.08;ctx.rotate(angle);ctx.strokeStyle='#5a4027';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(20,0);ctx.stroke();ctx.strokeStyle='#b79b68';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(18,-6);ctx.lineTo(18,6);ctx.stroke();ctx.fillStyle=COLORS.blade;ctx.beginPath();ctx.moveTo(20,-4);ctx.lineTo(57,-6);ctx.lineTo(69,0);ctx.lineTo(56,6);ctx.lineTo(20,4);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,255,235,.8)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(25,-2);ctx.lineTo(61,-2);ctx.stroke();ctx.restore();
  if(attack){const b=attackBox(p,false);if(b){ctx.globalAlpha=.2;ctx.strokeStyle=COLORS.blade;ctx.lineWidth=7;ctx.beginPath();if(attack.type==='up')ctx.arc(0,-18,44,Math.PI,TAU);else if(attack.type==='down'||attack.type==='plunge')ctx.arc(0,18,46,0,Math.PI);else ctx.arc(10,-2,48,-.9,.9);ctx.stroke()}}
  ctx.restore();
}
function drawLogger(enemy){ctx.save();ctx.translate(enemy.x,enemy.y+(enemy.visualLift||0));ctx.scale(enemy.facing,1);ctx.globalAlpha=enemy.hitFlash>0?.55:1;ctx.fillStyle='#50372a';ctx.fillRect(-14,-10,28,34);ctx.fillStyle='#b87543';ctx.beginPath();ctx.arc(0,-27,11,0,TAU);ctx.fill();ctx.fillStyle='#d68d3f';ctx.fillRect(-13,-36,26,6);ctx.fillStyle='#303933';ctx.fillRect(-15,20,10,20);ctx.fillRect(5,20,10,20);ctx.strokeStyle=enemy.state==='windup'?COLORS.danger:'#c3b9a4';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(12,-5);ctx.lineTo(32,-23);ctx.lineTo(45,-8);ctx.stroke();ctx.restore()}
function drawRanger(enemy){ctx.save();ctx.translate(enemy.x,enemy.y+(enemy.visualLift||0));ctx.scale(enemy.facing,1);ctx.globalAlpha=enemy.hitFlash>0?.55:1;ctx.fillStyle='#303b35';ctx.fillRect(-15,-11,30,37);ctx.fillStyle='#b37a4c';ctx.beginPath();ctx.arc(0,-27,10,0,TAU);ctx.fill();ctx.fillStyle='#d99442';ctx.fillRect(-13,-35,26,5);ctx.fillStyle='#6b6d65';ctx.fillRect(8,-10,39,10);ctx.fillStyle=COLORS.danger;ctx.fillRect(35,-8,11,6);ctx.restore();if(enemy.state==='aim'){ctx.globalAlpha=.28;ctx.strokeStyle=COLORS.danger;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(enemy.x,enemy.y-8);ctx.lineTo(state.player.x,state.player.y);ctx.stroke();ctx.globalAlpha=1}}
function drawClimber(enemy){ctx.save();ctx.translate(enemy.x,enemy.y+(enemy.visualLift||0));ctx.scale(enemy.facing,1);ctx.fillStyle='#252d23';ctx.beginPath();ctx.ellipse(0,0,15,22,0,0,TAU);ctx.fill();ctx.strokeStyle='#c78d4a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-8,-10);ctx.lineTo(-21,-20);ctx.moveTo(-9,7);ctx.lineTo(-22,18);ctx.stroke();ctx.fillStyle=COLORS.danger;ctx.fillRect(7,-9,3,3);ctx.restore()}
function drawDrone(enemy){ctx.save();ctx.translate(enemy.x,enemy.y);ctx.fillStyle='#252d2b';ctx.beginPath();ctx.ellipse(0,0,24,14,0,0,TAU);ctx.fill();ctx.strokeStyle='#9b7d51';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-30,-8);ctx.lineTo(30,-8);ctx.stroke();ctx.fillStyle=COLORS.danger;ctx.beginPath();ctx.arc(0,2,5,0,TAU);ctx.fill();ctx.restore()}
function drawTrapper(enemy){ctx.save();ctx.translate(enemy.x,enemy.y);ctx.scale(enemy.facing,1);ctx.fillStyle='#45372d';ctx.fillRect(-15,-10,30,36);ctx.fillStyle='#ad7748';ctx.beginPath();ctx.arc(0,-27,10,0,TAU);ctx.fill();ctx.strokeStyle='#8d734d';ctx.lineWidth=4;ctx.beginPath();ctx.arc(17,2,12,0,TAU);ctx.stroke();if(enemy.state==='aim'){ctx.strokeStyle=COLORS.danger;ctx.beginPath();ctx.arc(17,2,18,0,TAU);ctx.stroke()}ctx.restore()}
function drawBoss(boss){
  if(!state.bossActive||boss.dead)return;ctx.save();ctx.translate(boss.x,boss.y);ctx.scale(boss.facing,1);ctx.globalAlpha=boss.hitFlash>0?.55:1;ctx.fillStyle='#282a25';ctx.fillRect(-37,-24,74,78);ctx.fillStyle='#72533a';ctx.fillRect(-28,-14,56,54);ctx.fillStyle='#c07c3e';ctx.beginPath();ctx.arc(0,-46,20,0,TAU);ctx.fill();ctx.fillStyle='#d69648';ctx.fillRect(-27,-61,54,8);ctx.strokeStyle=boss.state==='axeWindup'?COLORS.danger:'#c2b7a1';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(25,-8);ctx.lineTo(58,-45);ctx.lineTo(81,-25);ctx.stroke();ctx.fillStyle='#3a403c';ctx.fillRect(-42,49,27,29);ctx.fillRect(15,49,27,29);if(boss.guard>0){ctx.strokeStyle='rgba(220,169,92,.6)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,63,0,TAU);ctx.stroke()}ctx.restore();
}
function drawProjectile(p){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx)+(p.spin||0));ctx.fillStyle=p.friendly?COLORS.blade:COLORS.danger;ctx.shadowColor=p.friendly?COLORS.guardianEdge:COLORS.danger;ctx.shadowBlur=9;if(p.kind==='saw'){ctx.beginPath();for(let i=0;i<12;i++){const a=i/12*TAU,r=i%2?p.r*.65:p.r;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill()}else if(p.kind==='snare'){ctx.beginPath();ctx.arc(0,0,p.r,0,TAU);ctx.fill();ctx.strokeStyle='#c2a06d';ctx.stroke()}else ctx.fillRect(-12,-3,24,6);ctx.restore()}
function drawTrap(trap){ctx.globalAlpha=clamp(trap.life/2.8,0,1)*.5;ctx.strokeStyle=COLORS.danger;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(trap.x,trap.y,trap.w/2,trap.h/2,0,0,TAU);ctx.stroke();ctx.globalAlpha=1}
function drawWorld(){
  ctx.save();worldTransform();for(const wall of world.walls)drawBarkWall(wall);for(const platform of world.platforms)drawPlatform(platform);for(const vine of world.vines)drawVine(vine);for(const hazard of world.hazards)drawHazard(hazard);world.checkpoints.forEach(drawCheckpoint);for(const trap of state.traps)drawTrap(trap);for(const enemy of world.enemies){if(enemy.dead)continue;if(enemy.kind==='logger')drawLogger(enemy);else if(enemy.kind==='ranger')drawRanger(enemy);else if(enemy.kind==='climber')drawClimber(enemy);else if(enemy.kind==='drone')drawDrone(enemy);else drawTrapper(enemy)}drawBoss(world.boss);for(const projectile of state.projectiles)drawProjectile(projectile);drawGuardian(state.player);for(const f of state.fx){ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(f.x,f.y,f.size,0,TAU);ctx.fill()}ctx.globalAlpha=1;for(const firefly of fireflies){if(Math.abs(firefly.y-state.camera.y)>VIEW.h*.7)continue;ctx.fillStyle='rgba(214,235,174,.28)';ctx.beginPath();ctx.arc(firefly.x,firefly.y+Math.sin(state.time*firefly.s+firefly.p)*7,1.4,0,TAU);ctx.fill()}ctx.restore();
}
function drawForeground(){const g=ctx.createLinearGradient(0,0,0,VIEW.h);g.addColorStop(0,'rgba(2,5,4,.25)');g.addColorStop(.38,'rgba(2,5,4,0)');g.addColorStop(1,'rgba(1,3,2,.42)');ctx.fillStyle=g;ctx.fillRect(0,0,VIEW.w,VIEW.h);if(state.flash>0){ctx.fillStyle=`rgba(255,190,120,${state.flash*.28})`;ctx.fillRect(0,0,VIEW.w,VIEW.h)}}

let cssW=VIEW.w,cssH=VIEW.h,scale=1,offsetX=0,offsetY=0,dpr=1;
function resize(){const r=canvas.getBoundingClientRect();cssW=r.width;cssH=r.height;dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);scale=Math.min(cssW/VIEW.w,cssH/VIEW.h);offsetX=(cssW-VIEW.w*scale)/2;offsetY=(cssH-VIEW.h*scale)/2}
addEventListener('resize',resize);resize();
function render(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*offsetX,dpr*offsetY);drawBackground();drawWorld();drawForeground()}

function updateHud(){
  const p=state.player;if(!p)return;const zone=currentZone(),remaining=world.enemies.filter(e=>!e.dead&&e.y>=zone.top&&e.y<zone.bottom).length;ui.health.textContent=`BARK ${'●'.repeat(Math.max(0,p.hp))}${'○'.repeat(Math.max(0,p.maxHp-p.hp))}`;ui.zone.textContent=zone.name;ui.altitude.textContent=`${Math.max(0,Math.round((WORLD.h-p.y)/10))} M`;ui.objective.textContent=state.bossActive&&!world.boss.dead?'BREAK THE CROWN FELLER · DOWNSTRIKE / DASH THROUGH ITS GUARD':world.boss.dead?'THE CROWN IS OPEN · ASCEND':`${remaining} THREAT${remaining===1?'':'S'} IN THIS BAND · CLIMB`;ui.airStep.textContent=`AIR STEP ${p.airDash?'●':'○'}`;
  if(state.bossActive&&!world.boss.dead){ui.boss?.classList.remove('hidden');ui.bossName.textContent=`${world.boss.name} · PHASE ${world.boss.phase}`;ui.bossBar.style.width=`${clamp(world.boss.hp/world.boss.maxHp,0,1)*100}%`;ui.bossGuard.textContent=world.boss.guard>0?`GUARD ${world.boss.guard}/${world.boss.maxGuard}`:`CORE OPEN ${state.bossOpenTimer.toFixed(1)}s`}else ui.boss?.classList.add('hidden');
}

function renderBindings(snapshot){
  if(!ui.bindList)return;ui.bindList.innerHTML='';const labels={left:'Move left',right:'Move right',up:'Aim up / grab vine',down:'Aim down / drop',jump:'Jump',attack:'Machete',dash:'Air dash',interact:'Vine interact',restart:'Restart'};
  for(const action of Object.keys(labels)){const row=document.createElement('button');row.className='bindRow';row.type='button';row.dataset.action=action;const listening=snapshot.captureAction===action;row.innerHTML=`<span>${labels[action]}</span><b>${listening?'PRESS A KEY':prettyKey(snapshot.bindings[action])}</b>`;row.addEventListener('click',()=>input.beginCapture(action));ui.bindList.append(row)}
}
input.subscribe(renderBindings);
ui.settingsButton?.addEventListener('click',()=>{ui.settings?.classList.remove('hidden');state.modeBeforeSettings=state.mode;if(state.mode==='playing')state.mode='paused'});
ui.closeSettings?.addEventListener('click',()=>{ui.settings?.classList.add('hidden');input.cancelCapture();if(state.mode==='paused')state.mode=state.modeBeforeSettings==='playing'?'playing':'menu'});
ui.resetBindings?.addEventListener('click',()=>input.reset());
ui.start?.addEventListener('click',()=>{audioCtx??=new AudioContext();reset(true)});ui.restart?.addEventListener('click',()=>reset(true));ui.retry?.addEventListener('click',()=>reset(true));

let last=performance.now(),acc=0;
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;acc+=dt;let steps=0;while(acc>=FIXED_DT&&steps<8){if(input.take('pause')){if(state.mode==='playing'){state.mode='paused';ui.pause?.classList.remove('hidden')}else if(state.mode==='paused'){state.mode='playing';ui.pause?.classList.add('hidden')}}update(FIXED_DT);acc-=FIXED_DT;steps++}if(state.visualHold>0)state.visualHold--;else render();requestAnimationFrame(frame)}
requestAnimationFrame(frame);

reset(false);
window.__SYLVARIA_V3__={
  version:VERSION,fixedDt:FIXED_DT,state,get world(){return world},input,
  reset:()=>reset(true),step:(ticks=1)=>{for(let i=0;i<ticks;i++)update(FIXED_DT);return window.__SYLVARIA_V3__.snapshot()},
  snapshot:()=>({version:VERSION,mode:state.mode,time:state.time,zone:currentZone().id,checkpoint:state.checkpoint,bossActive:state.bossActive,boss:{hp:world.boss.hp,guard:world.boss.guard,phase:world.boss.phase,dead:world.boss.dead},player:{x:state.player.x,y:state.player.y,vx:state.player.vx,vy:state.player.vy,hp:state.player.hp,onGround:state.player.onGround,groundId:state.player.groundId,wallDir:state.player.wallDir,wallId:state.player.wallId,vineId:state.player.vineId,airDash:state.player.airDash,attack:state.player.attack?.type||null},stats:{...state.stats},platforms:world.platforms.map(p=>({id:p.id,type:p.type,broken:p.broken,flex:p.flex||0,sapCharged:p.sapCharged})),enemies:world.enemies.filter(e=>!e.dead).map(e=>({id:e.id,kind:e.kind,hp:e.hp,state:e.state,x:e.x,y:e.y})),projectiles:state.projectiles.map(p=>({kind:p.kind,friendly:p.friendly,x:p.x,y:p.y})),camera:{...state.camera},bindings:{...input.bindings}}),
};
