const G=window.Sylvaria091;
const {W,H,FIXED_DT,state,clamp}=G,F=G.fn;

export const CUTSTEP_VERSION='0.15.0';
export const CUTSTEP_CONFIG=Object.freeze({
  maxSegments:3,
  segmentCost:1,
  passiveRefillPerSecond:.55,
  brushRefillPerBlade:.018,
  brushRefillCap:.30,
  counterRefill:.42,
  killRefill:.48,
  distance:86,
  thrustDistance:104,
  ticks:9,
  decay:.86,
  chainWindow:.52,
  bladeRadius:10,
  crosscutRadius:17,
  crosscutHalfSpan:34,
  reversalBurstRadius:48,
  grassRegrowSeconds:7.5,
});

const ARROWS=new Set(['arrowup','arrowdown','arrowleft','arrowright']);
const heldAim=new Set();
const q=v=>Math.round(v*100000)/100000;
const norm=(x,y)=>{const m=Math.hypot(x,y);return m>1e-7?{x:q(x/m),y:q(y/m),m}:{x:0,y:0,m:0}};
const dot=(a,b)=>clamp(a.x*b.x+a.y*b.y,-1,1);
const angleBetween=(a,b)=>Math.acos(dot(a,b));
const surface=()=>document.getElementById('pondCanvas')||G.canvas;

function arrowVector(){
  let x=0,y=0;
  if(heldAim.has('arrowleft'))x--;
  if(heldAim.has('arrowright'))x++;
  if(heldAim.has('arrowup'))y--;
  if(heldAim.has('arrowdown'))y++;
  return norm(x,y);
}
function currentAim(p=state.player){
  const arrows=arrowVector();if(arrows.m)return{x:arrows.x,y:arrows.y,source:'arrows'};
  const mouse=norm(p?.v015MouseAim?.x||0,p?.v015MouseAim?.y||0);if(mouse.m)return{x:mouse.x,y:mouse.y,source:'mouse'};
  const remembered=norm(p?.v015Aim?.x||0,p?.v015Aim?.y||0);if(remembered.m)return{x:remembered.x,y:remembered.y,source:p?.v015AimSource||'remembered'};
  return{x:1,y:0,source:'default'};
}
function classifyTechnique(p,dir){
  const last=p?.v015LastCutstepDir;
  if(!last||!(p.v015ChainTimer>0))return{kind:'carve',angle:null,distance:CUTSTEP_CONFIG.distance,radius:CUTSTEP_CONFIG.bladeRadius};
  const angle=angleBetween(last,dir);
  if(angle<=Math.PI/7.2)return{kind:'thrust',angle,distance:CUTSTEP_CONFIG.thrustDistance,radius:8};
  if(angle>=Math.PI*.40&&angle<=Math.PI*.62)return{kind:'crosscut',angle,distance:CUTSTEP_CONFIG.distance,radius:CUTSTEP_CONFIG.crosscutRadius};
  if(angle>=Math.PI*.80)return{kind:'reversal',angle,distance:80,radius:12};
  return{kind:'carve',angle,distance:CUTSTEP_CONFIG.distance,radius:CUTSTEP_CONFIG.bladeRadius};
}
function solvedSpeed(distance,ticks,decay=CUTSTEP_CONFIG.decay){return q(distance*(1-decay)/(FIXED_DT*(1-Math.pow(decay,ticks))))}
function segmentDistance(px,py,ax,ay,bx,by){
  const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,l2=vx*vx+vy*vy;
  const t=l2>1e-7?clamp((wx*vx+wy*vy)/l2,0,1):0,cx=ax+vx*t,cy=ay+vy*t;
  return Math.hypot(px-cx,py-cy);
}
function refill(p,amount){if(!p||amount<=0)return;p.v015Segments=clamp((p.v015Segments||0)+amount,0,CUTSTEP_CONFIG.maxSegments)}
function reflectShot(s,dir,p,source='line'){
  if(!s||s.dead||s.friendly)return false;
  const speed=Math.max(860,Math.hypot(s.vx||0,s.vy||0));
  s.friendly=true;s.vx=q(dir.x*speed);s.vy=q(dir.y*speed);s.baseSpeed=speed;s.pattern='return';s.counterQuality='cutstep';s.damage=Math.max(1.2,s.damage||1);s.reflectedTravel=0;s.pierces=Math.max(0,s.pierces||0);s.hitIds=new Set();
  state.stats.counters=(state.stats.counters||0)+1;state.score+=source==='reversal'?70:45;refill(p,CUTSTEP_CONFIG.counterRefill);
  F.addCallout?.(s.x,s.y-12,source==='reversal'?'REVERSAL':'CUT RETURN','#efffb6');
  for(let i=0;i<7;i++)F.spawnParticle?.(s.x,s.y,'#eaffb7',24+i*4,.18,1.5);
  return true;
}
function reversalBurst(p,dir,dash){
  if(dash.v015BurstDone)return;dash.v015BurstDone=true;
  let reflected=0;
  for(const s of state.shots){if(!s.dead&&!s.friendly&&Math.hypot(s.x-p.x,s.y-p.y)<=CUTSTEP_CONFIG.reversalBurstRadius+(s.r||0)){if(reflectShot(s,dir,p,'reversal'))reflected++}}
  if(reflected){F.signalHitStop?.('parry',2);state.shake=Math.max(state.shake||0,4.2)}
}
function processLine(p,dash,ax,ay,bx,by,radius){
  if(!dash.v015HitIds)dash.v015HitIds=new Set();
  for(const s of state.shots){if(s.dead||s.friendly||dash.v015HitIds.has(`shot:${s}`))continue;if(segmentDistance(s.x,s.y,ax,ay,bx,by)<=radius+(s.r||0)){dash.v015HitIds.add(`shot:${s}`);reflectShot(s,dash.dir,p)}}
  for(const e of state.enemies){
    if(e.dead||dash.v015HitIds.has(e.id))continue;
    if(segmentDistance(e.x,e.y,ax,ay,bx,by)>radius+(e.r||0))continue;
    dash.v015HitIds.add(e.id);const before=e.hp;
    const amount=dash.v015Technique==='thrust'?1.35:dash.v015Technique==='crosscut'?1.16:dash.v015Technique==='reversal'?1.22:1.05;
    F.damageEnemy?.(e,amount,dash.dir,{melee:true,cutstep:true,attack:{dashCancelled:true,cutstep:true},technique:dash.v015Technique});
    if(before>0&&e.dead)refill(p,CUTSTEP_CONFIG.killRefill);
    F.signalHitStop?.('enemy',e.r>=22?2:1);
  }
  const b=state.boss;if(b&&!b.dead&&!dash.v015HitIds.has(b.id)&&segmentDistance(b.x,b.y,ax,ay,bx,by)<=radius+(b.r||0)){
    dash.v015HitIds.add(b.id);F.damageBoss?.(1.1,dash.dir,{melee:true,cutstep:true,attack:{dashCancelled:true,cutstep:true},technique:dash.v015Technique});F.signalHitStop?.('enemy',2);
  }
  let brushGain=0;
  for(const f of state.foliage){
    if(f.cut||segmentDistance(f.x,f.y,ax,ay,bx,by)>radius+(f.r||4))continue;
    f.cut=true;f.v015RegrowAt=state.roomTime+CUTSTEP_CONFIG.grassRegrowSeconds+(f.phase||0)%1.5;state.stats.grassCut=(state.stats.grassCut||0)+1;
    brushGain=Math.min(CUTSTEP_CONFIG.brushRefillCap,brushGain+CUTSTEP_CONFIG.brushRefillPerBlade);
    if((state.stats.grassCut||0)%3===0)F.spawnParticle?.(f.x,f.y,'#9bcf83',16,.22,1.2);
  }
  refill(p,brushGain);
  for(const d of state.debris){if(!d.dead&&segmentDistance(d.x,d.y,ax,ay,bx,by)<=radius+(d.r||0)){dash.v015HitIds.add(d.id);F.breakDeadwood?.(d)}}
  for(const r of state.brittle){if(!r.dead&&segmentDistance(r.x,r.y,ax,ay,bx,by)<=radius+(r.r||0)){dash.v015HitIds.add(r.id);r.hp=(r.hp||1)-1;if(r.hp<=0)F.breakBrittle?.(r,true)}}
  for(const m of state.mushrooms){if(!m.cut&&segmentDistance(m.x,m.y,ax,ay,bx,by)<=radius+(m.r||0))F.cutMushroom?.(m)}
}
function processCutstepSweep(p,dash,ax,ay,bx,by){
  processLine(p,dash,ax,ay,bx,by,dash.v015Radius||CUTSTEP_CONFIG.bladeRadius);
  if(dash.v015Technique==='crosscut'){
    const n={x:-dash.dir.y,y:dash.dir.x},h=CUTSTEP_CONFIG.crosscutHalfSpan;
    processLine(p,dash,bx-n.x*h,by-n.y*h,bx+n.x*h,by+n.y*h,CUTSTEP_CONFIG.bladeRadius);
  }
  if(dash.v015Technique==='reversal')reversalBurst(p,dash.dir,dash);
}
function initPlayer(p){
  if(!p)return;
  p.v015Segments=CUTSTEP_CONFIG.maxSegments;p.v015Aim={x:1,y:0};p.v015AimSource='default';p.v015MouseAim=null;p.v015LastCutstepDir=null;p.v015ChainTimer=0;p.v015QueuedCutstep=null;p.v015Technique='carve';p.v015CutstepSerial=0;
  p.dashCharging=false;p.dashCharge=0;p.dashBuffer=0;p.dashBufferHeld=false;p.dashBufferReleased=false;p.dashCooldown=0;
  state.v015PathHistory=[];
}
const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{const result=inheritedSetup(...args);initPlayer(state.player);return result};
if(state.player)initPlayer(state.player);

function launchCutstep(dir=currentAim()){
  const p=state.player;if(!p||state.mode!=='playing')return false;
  const d=norm(dir.x,dir.y);if(!d.m)return false;
  if(p.dash?.v015Cutstep){p.v015QueuedCutstep={x:d.x,y:d.y};return true}
  if((p.v015Segments||0)<CUTSTEP_CONFIG.segmentCost){F.addCallout?.(p.x,p.y-30,'ROOTED · CARVE OR COUNTER','#d5d0a4');return false}
  const tech=classifyTechnique(p,d),distance=tech.distance,ticks=CUTSTEP_CONFIG.ticks,speed=solvedSpeed(distance,ticks);
  p.v015Segments=q(Math.max(0,p.v015Segments-CUTSTEP_CONFIG.segmentCost));p.v015Aim={x:d.x,y:d.y};p.v015AimSource=dir.source||'stored';p.v015Technique=tech.kind;p.v015CutstepSerial=(p.v015CutstepSerial||0)+1;
  p.vx=q(d.x*speed);p.vy=q(d.y*speed);p.dash={timer:ticks*FIXED_DT,duration:ticks*FIXED_DT,dir:{x:d.x,y:d.y},charge:1,curve:1,sx:p.x,sy:p.y,tx:p.x,ty:p.y,reactive:true,speed,decay:CUTSTEP_CONFIG.decay,ticksLeft:ticks,totalTicks:ticks,elapsedTicks:0,distanceTarget:distance,v015Cutstep:true,v015Technique:tech.kind,v015Radius:tech.radius,v015Serial:p.v015CutstepSerial,v015HitIds:new Set(),v014LaunchDir:{x:d.x,y:d.y}};
  p.v015LastCutstepDir={x:d.x,y:d.y};p.v015ChainTimer=CUTSTEP_CONFIG.chainWindow;p.dashCooldown=0;p.invuln=0;
  if(tech.kind!=='carve')F.addCallout?.(p.x+d.x*28,p.y+d.y*28,tech.kind==='thrust'?'THRUST':tech.kind==='crosscut'?'CROSSCUT':'REVERSAL',tech.kind==='reversal'?'#fff0a8':'#d9ffb2');
  state.v015PathHistory.push({x:p.x,y:p.y,tx:p.x+d.x*distance,ty:p.y+d.y*distance,life:.72,maxLife:.72,technique:tech.kind});if(state.v015PathHistory.length>12)state.v015PathHistory.shift();
  state.stats.dashes=(state.stats.dashes||0)+1;state.shake=Math.max(state.shake||0,1.4);
  for(let i=0;i<5;i++)F.spawnParticle?.(p.x-d.x*i*3,p.y-d.y*i*3,'#dfffc2',20+i*4,.16,1.5);
  G.audio?.dash?.(F.mobilityAt?.(p.x,p.y)?.type||'ground');
  return true;
}
F.beginDashCharge=()=>false;F.releaseDashCharge=()=>false;F.cancelDashCharge=()=>{const p=state.player;if(p){p.dashCharging=false;p.dashCharge=0}};
F.cutstep=launchCutstep;

const inheritedMovement=F.updateMovement;
F.updateMovement=(dt)=>{
  const p=state.player;if(!p)return inheritedMovement(dt);
  p.v015ChainTimer=Math.max(0,(p.v015ChainTimer||0)-dt);
  p.v015Segments=clamp((p.v015Segments||0)+CUTSTEP_CONFIG.passiveRefillPerSecond*dt,0,CUTSTEP_CONFIG.maxSegments);
  for(const h of state.v015PathHistory||[])h.life-=dt;state.v015PathHistory=(state.v015PathHistory||[]).filter(h=>h.life>0);
  const active=p.dash?.v015Cutstep?p.dash:null,ox=p.x,oy=p.y;
  const result=inheritedMovement(dt);
  if(active)processCutstepSweep(p,active,ox,oy,p.x,p.y);
  if(active&&!p.dash&&p.v015QueuedCutstep){const queued=p.v015QueuedCutstep;p.v015QueuedCutstep=null;launchCutstep({...queued,source:'queued'})}
  return result;
};

function updateAimFromArrows(){const p=state.player,v=arrowVector();if(p&&v.m){p.v015Aim={x:v.x,y:v.y};p.v015AimSource='arrows'}}
function isActionKey(event){const k=String(event.key||'').toLowerCase();return ARROWS.has(k)||k===' '||event.code==='Space'}
window.addEventListener('keydown',event=>{
  const k=String(event.key||'').toLowerCase();
  if(ARROWS.has(k)){event.preventDefault();event.stopPropagation();heldAim.add(k);updateAimFromArrows();return}
  if((k===' '||event.code==='Space')&&!event.repeat&&state.mode==='playing'){event.preventDefault();event.stopPropagation();launchCutstep(currentAim())}
},true);
window.addEventListener('keyup',event=>{
  const k=String(event.key||'').toLowerCase();
  if(ARROWS.has(k)){event.preventDefault();event.stopPropagation();heldAim.delete(k);updateAimFromArrows();return}
  if(k===' '||event.code==='Space'){event.preventDefault();event.stopPropagation()}
},true);
window.addEventListener('blur',()=>heldAim.clear());
window.addEventListener('pointermove',event=>{
  if(state.mode!=='playing'||!state.player)return;const s=surface(),rect=s?.getBoundingClientRect?.();if(!rect||rect.width<=0||rect.height<=0)return;
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;
  const x=(event.clientX-rect.left)/rect.width*W,y=(event.clientY-rect.top)/rect.height*H,d=norm(x-state.player.x,y-state.player.y);if(!d.m)return;
  state.player.v015MouseAim={x:d.x,y:d.y};if(!arrowVector().m){state.player.v015Aim={x:d.x,y:d.y};state.player.v015AimSource='mouse'}
},{passive:true});
window.addEventListener('pointerdown',event=>{
  if(event.button!==0||state.mode!=='playing')return;if(event.target?.closest?.('button,input,.screen'))return;
  const rect=surface()?.getBoundingClientRect?.();if(!rect||event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;
  event.preventDefault();launchCutstep(currentAim());
},true);

window.SylvariaCutstep=Object.freeze({
  version:CUTSTEP_VERSION,config:CUTSTEP_CONFIG,launch:launchCutstep,currentAim,
  snapshot:()=>({version:CUTSTEP_VERSION,segments:state.player?.v015Segments||0,maxSegments:CUTSTEP_CONFIG.maxSegments,aim:state.player?currentAim(state.player):null,technique:state.player?.v015Technique||null,chainTimer:state.player?.v015ChainTimer||0,queued:Boolean(state.player?.v015QueuedCutstep),active:Boolean(state.player?.dash?.v015Cutstep),pathSegments:state.v015PathHistory?.length||0})
});
