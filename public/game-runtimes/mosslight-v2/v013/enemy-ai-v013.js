const G=window.Sylvaria091;
const {W,H,state,clamp,lerp,dist,hash,rngFrom,entityRand}=G;
const F=G.fn;

export const AI_VERSION='0.13.0';
export const KINETIC_ARCHETYPES=Object.freeze({
  skimmer:{label:'Skimmer',baseType:'drone',hp:3,r:12,speed:128,reaction:.055,dodge:82,reward:135},
  strider:{label:'Pond Strider',baseType:'surveyor',hp:4,r:14,speed:102,reaction:.038,dodge:96,reward:175},
  sniper:{label:'Needle Dragonfly',baseType:'drone',hp:4,r:15,speed:82,reaction:.075,dodge:72,reward:210},
  shellback:{label:'Shellback Beetle',baseType:'skidder',hp:9,r:23,speed:48,reaction:.14,dodge:0,reward:290},
});

const q=v=>Math.round(v*100000)/100000;
const norm=(x,y)=>{const m=Math.hypot(x,y)||1;return{x:q(x/m),y:q(y/m)}};
const extraStats={enemyArcDodges:0,shellBlocks:0,kineticEnemies:0};
const inheritedFresh=G.freshStats;
G.freshStats=()=>({...inheritedFresh(),...extraStats});
for(const [k,v] of Object.entries(extraStats))if(!Number.isFinite(state.stats[k]))state.stats[k]=v;

function rosterForDepth(depth){
  if(depth===1)return['skimmer'];
  if(depth===2)return['skimmer','strider'];
  if(depth===3)return['strider','skimmer'];
  if(depth===4)return['sniper','skimmer'];
  if(depth===5)return['shellback','strider'];
  const pool=['skimmer','strider','sniper','shellback'];
  const count=depth<10?2:depth<18?3:depth<26?4:5;
  const out=[];for(let i=0;i<count;i++)out.push(pool[(depth+i*3+Math.floor(depth/4))%pool.length]);
  if(depth%5===0&&!out.includes('shellback'))out[out.length-1]='shellback';
  return out;
}

function findSpawn(rng,r){
  for(let n=0;n<70;n++){
    const x=clamp(310+rng()*570,70,W-55),y=clamp(105+rng()*(H-165),95,H-45);
    if(F.positionClear(x,y,r)&&dist({x,y},state.player)>170&&state.enemies.every(e=>e.dead||Math.hypot(e.x-x,e.y-y)>e.r+r+18))return{x,y};
  }
  return{x:W-120,y:130+(state.enemies.length%6)*70};
}

function spawnKineticEnemy(kind,index,rng){
  const spec=KINETIC_ARCHETYPES[kind],p=findSpawn(rng,spec.r),depthScale=1+Math.max(0,state.worldDepth-8)*.018,hp=Math.ceil(spec.hp*depthScale);
  const e={id:`v013-${kind}-${state.worldDepth}-${index}`,type:spec.baseType,kineticType:kind,kineticLabel:spec.label,x:p.x,y:p.y,r:spec.r,hp,maxHp:hp,clock:.48+rng()*.55,telegraph:0,state:'move',phase:rng()*Math.PI*2,angle:rng()*Math.PI*2,armor:kind==='shellback'?2:0,boosted:0,intent:null,attackCount:0,rngState:hash(`v013:${state.room?.seed||0}:${kind}:${index}`),hitFlash:0,dead:false,evadeCooldown:0,evade:null,counterStagger:0,hazardCooldown:0,recoil:0,locomotion:rng()*Math.PI*2,afterimages:[],arcDodgeCooldown:.18+rng()*.42,kineticEvade:null,kineticCue:0,contactCooldown:0,facingAngle:Math.PI,velocity:{x:0,y:0},reward:spec.reward};
  state.enemies.push(e);state.stats.kineticEnemies=(state.stats.kineticEnemies||0)+1;return e;
}

function injectRoster(depth){
  const rng=rngFrom(hash(`sylvaria-v013-roster-${depth}`));
  rosterForDepth(depth).forEach((kind,index)=>spawnKineticEnemy(kind,index,rng));
}

const inheritedSetup=F.setupRoom;
F.setupRoom=(depth,...rest)=>{const result=inheritedSetup(depth,...rest);injectRoster(depth);return result};

function moveEntity(e,target,speed,dt){
  const dx=target.x-e.x,dy=target.y-e.y,n=norm(dx,dy),mob=F.mobilityAt(e.x,e.y),current=F.currentAt?.(e.x,e.y)||{x:0,y:0};
  const step=speed*mob.move*dt,nx=clamp(q(e.x+n.x*step+current.x*dt*.42),34,W-34),ny=clamp(q(e.y+n.y*step+current.y*dt*.42),88,H-35);
  if(F.positionClear(nx,e.y,e.r))e.x=nx;if(F.positionClear(e.x,ny,e.r))e.y=ny;
  e.facingAngle=Math.atan2(state.player.y-e.y,state.player.x-e.x);e.locomotion+=dt*speed*.04*mob.move;F.applyTerrainHazard(e,'enemy');
}

function spawnShot(owner,target,{speed=420,kind='nail',pattern='straight',spread=0,amp=70,freq=7,turnAt=.3,turnAngle=.35}={}){
  if(state.shots.length>=G.MAX_SHOTS)return null;
  const dx=target.x-owner.x,dy=target.y-owner.y,n=norm(dx,dy),c=Math.cos(spread),s=Math.sin(spread),vx=n.x*c-n.y*s,vy=n.x*s+n.y*c;
  const shot={x:owner.x,y:owner.y,vx:q(vx*speed),vy:q(vy*speed),r:kind==='saw'?8:6,life:4,kind,color:kind==='survey'?'#78f1da':kind==='saw'?'#7de7ff':'#ffbd7d',friendly:false,owner,originalOwnerId:owner.id,damage:1,dead:false,spin:0,grazed:false,age:0,pattern,baseSpeed:speed,patternPhase:owner.phase||0,patternAmp:amp,patternFreq:freq,turnRate:.55,turnAt,turnAngle,turned:false,beneficiaryId:null,trail:[],counterQuality:null,counterTargetId:null,reflectedTravel:0,hitIds:new Set(),pierces:0,v013Scaled:true};
  state.shots.push(shot);return shot;
}

function arcThreat(){
  for(let i=state.slashes.length-1;i>=0;i--){const s=state.slashes[i];if(s.kind==='arc'&&(s.phase==='windup'||s.phase==='active'))return s}
  return null;
}
function chooseEvadeDestination(e,s,distance){
  const p=state.player,radial=norm(e.x-p.x,e.y-p.y),swing=s.sweepDir>0?{x:-radial.y,y:radial.x}:{x:radial.y,y:-radial.x};
  const candidates=[
    {x:e.x-swing.x*distance,y:e.y-swing.y*distance},
    {x:e.x+swing.x*distance,y:e.y+swing.y*distance},
    {x:e.x+radial.x*distance*.8-swing.x*distance*.45,y:e.y+radial.y*distance*.8-swing.y*distance*.45},
  ];
  return candidates.find(c=>F.evadeDestinationSafe(c.x,c.y,e.r))||null;
}
function maybeReadArc(e){
  const spec=KINETIC_ARCHETYPES[e.kineticType];if(!spec||spec.dodge<=0||e.arcDodgeCooldown>0||e.kineticEvade||e.state==='recover')return false;
  const s=arcThreat();if(!s||!F.fullArcContains?.(s,e,12))return false;
  const reactionRoll=Math.floor(entityRand(e)*100);if(reactionRoll>spec.dodge)return false;
  const dest=chooseEvadeDestination(e,s,e.kineticType==='strider'?92:e.kineticType==='skimmer'?76:70);if(!dest)return false;
  e.kineticCue=spec.reaction;e.kineticEvade={sx:e.x,sy:e.y,tx:dest.x,ty:dest.y,t:0,duration:e.kineticType==='strider'?.105:.135};e.state='kinetic-evade-cue';e.intent={kind:'arc-dodge',x:dest.x,y:dest.y};e.arcDodgeCooldown=.56+entityRand(e)*.45;return true;
}
function updateArcEvade(e,dt){
  const v=e.kineticEvade;if(!v)return false;
  if(e.state==='kinetic-evade-cue'){e.kineticCue-=dt;if(e.kineticCue<=0){e.state='kinetic-evade';state.stats.enemyArcDodges=(state.stats.enemyArcDodges||0)+1;G.audio.evade?.()}return true}
  if(e.state!=='kinetic-evade')return false;
  v.t+=dt;const t=clamp(v.t/v.duration,0,1),u=1-Math.pow(1-t,3);e.x=q(lerp(v.sx,v.tx,u));e.y=q(lerp(v.sy,v.ty,u));e.afterimages.push({x:e.x,y:e.y,life:.15,mode:'arc'});if(e.afterimages.length>4)e.afterimages.shift();
  if(t>=1){e.kineticEvade=null;e.intent=null;e.state='move';e.clock=Math.max(e.clock,.16);F.applyTerrainHazard(e,'enemy')}
  return true;
}

function telegraph(e,time,target=state.player){e.state='kinetic-telegraph';e.telegraph=time;e.intent={kind:'player',x:target.x,y:target.y}}
function fireKinetic(e){
  const target=e.intent||state.player;e.attackCount++;
  if(e.kineticType==='skimmer'){
    spawnShot(e,target,{speed:430,kind:'saw',pattern:'wave',amp:e.attackCount%2?92:-92,freq:10.5,spread:-.05});
    spawnShot(e,target,{speed:450,kind:'saw',pattern:'wave',amp:e.attackCount%2?-84:84,freq:9.4,spread:.06});
  }else if(e.kineticType==='strider'){
    const n=norm(target.x-e.x,target.y-e.y);e.velocity={x:n.x*510,y:n.y*510};e.state='kinetic-lunge';e.lunge=.16;e.contactCooldown=0;
  }else if(e.kineticType==='sniper'){
    spawnShot(e,target,{speed:535,kind:'survey',pattern:'straight'});
    spawnShot(e,target,{speed:480,kind:'survey',pattern:'swerve',spread:e.attackCount%2?.035:-.035,turnAt:.24,turnAngle:e.attackCount%2?-.26:.26});
  }else if(e.kineticType==='shellback'){
    for(const spread of[-.16,0,.16])spawnShot(e,target,{speed:350,kind:'nail',pattern:spread===0?'straight':'swerve',spread,turnAt:.32,turnAngle:-spread*1.8});
  }
  if(e.state!=='kinetic-lunge'){e.state='move';e.intent=null;e.clock=e.kineticType==='sniper'?1.1:e.kineticType==='shellback'?1.25:.72}
}

function updateKineticEnemy(e,dt,global){
  if(e.dead)return;
  if(e.hitFlash>0)e.hitFlash-=dt;if(e.recoil>0)e.recoil-=dt;if(e.counterStagger>0)e.counterStagger-=dt;if(e.hazardCooldown>0)e.hazardCooldown-=dt;if(e.arcDodgeCooldown>0)e.arcDodgeCooldown-=dt;if(e.contactCooldown>0)e.contactCooldown-=dt;
  for(const g of e.afterimages)g.life-=dt;e.afterimages=e.afterimages.filter(g=>g.life>0);
  if(updateArcEvade(e,dt))return;
  if(e.counterStagger>0&&e.state==='recover')return;
  if(maybeReadArc(e))return;
  if(e.state==='kinetic-telegraph'){e.telegraph-=dt;if(e.telegraph<=0)fireKinetic(e);return}
  if(e.state==='kinetic-lunge'){
    const nx=e.x+e.velocity.x*dt,ny=e.y+e.velocity.y*dt;if(F.positionClear(nx,ny,e.r)){e.x=q(nx);e.y=q(ny)}else e.lunge=0;e.lunge-=dt;
    if(e.contactCooldown<=0&&dist(e,state.player)<e.r+state.player.r+5){F.damagePlayer(1,e);e.contactCooldown=.4}
    if(e.lunge<=0){e.state='recover';e.clock=.38;e.velocity={x:0,y:0}}return;
  }
  if(e.state==='recover'){e.clock-=dt;if(e.clock<=0){e.state='move';e.clock=.5+entityRand(e)*.45}return}
  e.clock-=dt;
  const p=state.player,d=dist(e,p),spec=KINETIC_ARCHETYPES[e.kineticType],boost=1+Math.min(.28,Math.max(0,state.worldDepth-1)*.012);
  if(e.kineticType==='skimmer'){
    const orbit=e.phase+state.roomTime*2.55,desired={x:p.x+Math.cos(orbit)*150,y:p.y+Math.sin(orbit)*105};moveEntity(e,desired,spec.speed*boost,dt);
  }else if(e.kineticType==='strider'){
    const side=Math.sin(e.phase+state.roomTime*3.1)>=0?1:-1,n=norm(p.x-e.x,p.y-e.y),desired={x:e.x-n.y*side*92+(d>135?n.x*30:-n.x*24),y:e.y+n.x*side*92+(d>135?n.y*30:-n.y*24)};moveEntity(e,desired,spec.speed*boost,dt);
  }else if(e.kineticType==='sniper'){
    const desired=315;if(d>desired+45)moveEntity(e,p,spec.speed*boost,dt);else if(d<desired-65)moveEntity(e,{x:e.x+(e.x-p.x),y:e.y+(e.y-p.y)},spec.speed*boost,dt);else{const n=norm(p.x-e.x,p.y-e.y),side=Math.sin(e.phase+state.roomTime*.9)>=0?1:-1;moveEntity(e,{x:e.x-n.y*side*70,y:e.y+n.x*side*70},spec.speed*.45,dt)}
  }else if(e.kineticType==='shellback'){
    if(d>170)moveEntity(e,p,spec.speed*boost,dt);else if(d<115)moveEntity(e,{x:e.x+(e.x-p.x),y:e.y+(e.y-p.y)},spec.speed*.7,dt);else e.facingAngle=Math.atan2(p.y-e.y,p.x-e.x);
  }
  if(e.clock<=0){if(e.kineticType==='skimmer')telegraph(e,.16);else if(e.kineticType==='strider')telegraph(e,.20);else if(e.kineticType==='sniper')telegraph(e,.34);else telegraph(e,.42)}
}

const inheritedEnemies=F.updateEnemies;
F.updateEnemies=(dt)=>{
  const kinetic=state.enemies.filter(e=>e.kineticType&&!e.dead),legacy=state.enemies.filter(e=>!e.kineticType);
  state.enemies=legacy;inheritedEnemies(dt);const updatedLegacy=state.enemies;state.enemies=[...updatedLegacy,...kinetic];
  const global=1+Math.min(.32,Math.max(0,state.worldDepth-1)*.014);for(const e of kinetic)updateKineticEnemy(e,dt,global);
};

const inheritedDamage=F.damageEnemy;
F.damageEnemy=(e,amount,dir=null,source={})=>{
  if(!e?.kineticType)return inheritedDamage(e,amount,dir,source);
  if(e.kineticType==='shellback'&&!source.hazard){
    if(source.counterShot){amount*=1.45}else{
      const p=state.player,toPlayer=norm(p.x-e.x,p.y-e.y),front=Math.cos(e.facingAngle)*toPlayer.x+Math.sin(e.facingAngle)*toPlayer.y;
      if(front>.18){amount*=.22;state.stats.shellBlocks=(state.stats.shellBlocks||0)+1;if((state.stats.shellBlocks%3)===1)F.addCallout?.(e.x,e.y-e.r-14,'SHELL BLOCK','#d8e7c7')}
    }
  }
  const before=e.dead,result=inheritedDamage(e,amount,dir,source);if(!before&&e.dead)state.score+=Math.max(0,(e.reward||250)-250);return result;
};

window.SylvariaKineticAI=Object.freeze({version:AI_VERSION,archetypes:KINETIC_ARCHETYPES,rosterForDepth,snapshot:()=>({version:AI_VERSION,alive:state.enemies.filter(e=>e.kineticType&&!e.dead).map(e=>({id:e.id,kind:e.kineticType,hp:e.hp,state:e.state,x:e.x,y:e.y,dodging:Boolean(e.kineticEvade)})),dodges:state.stats.enemyArcDodges||0,shellBlocks:state.stats.shellBlocks||0})});
