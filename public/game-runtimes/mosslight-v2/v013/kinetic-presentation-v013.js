const G=window.Sylvaria091;
const {state,canvas,clamp}=G,F=G.fn;
const VERSION='0.13.0';
const overlay=document.createElement('canvas');overlay.id='kineticCanvas';overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
overlay.style.position='absolute';overlay.style.inset='0';overlay.style.width='100%';overlay.style.height='100%';overlay.style.pointerEvents='none';overlay.style.zIndex='4';
(document.getElementById('pondCanvas')||canvas).insertAdjacentElement('afterend',overlay);
const ctx=overlay.getContext('2d');
let renderedArcs=0,renderedTrailSamples=0,lastHitStopSerial=0,holdFrames=0,hitStopsRendered=0,lastHitStopKind=null,lastHoldFramesApplied=0;

function anglePoint(p,a,r){return{x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r}}
function curveTongue(p,a,length,alpha=1,trail=false){
  const mouth=anglePoint(p,a,Math.max(7,p.r*.48)),tip=anglePoint(p,a,length),tx=-Math.sin(a),ty=Math.cos(a),bend=(trail?5:9)*(p.swingParity%2?1:-1),cx=(mouth.x+tip.x)*.5+tx*bend,cy=(mouth.y+tip.y)*.5+ty*bend;
  ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#6e2940';ctx.lineWidth=trail?12:17;ctx.beginPath();ctx.moveTo(mouth.x,mouth.y);ctx.quadraticCurveTo(cx,cy,tip.x,tip.y);ctx.stroke();
  ctx.strokeStyle='#ef7894';ctx.lineWidth=trail?7:11;ctx.beginPath();ctx.moveTo(mouth.x,mouth.y);ctx.quadraticCurveTo(cx,cy,tip.x,tip.y);ctx.stroke();
  if(!trail){ctx.strokeStyle='rgba(255,207,214,.72)';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(mouth.x,mouth.y-1);ctx.quadraticCurveTo(cx,cy-2,tip.x,tip.y);ctx.stroke();ctx.fillStyle='#ffafbd';ctx.beginPath();ctx.ellipse(tip.x,tip.y,8,5,a,0,Math.PI*2);ctx.fill()}
  ctx.restore();return tip;
}

function drawBladeTrails(){
  renderedTrailSamples=0;
  const trails=state.bladeTrails||[];if(!trails.length)return;
  ctx.save();ctx.lineCap='round';
  for(const t of trails){
    const life=clamp(t.life/(t.maxLife||.095),0,1),alpha=life*life,ccw=t.sweepDir<0;
    renderedTrailSamples++;
    ctx.strokeStyle=`rgba(255,246,190,${.12+.43*alpha})`;ctx.lineWidth=2.2+5.2*alpha;ctx.beginPath();ctx.arc(t.x,t.y,t.reach*.96,t.from,t.to,ccw);ctx.stroke();
    ctx.strokeStyle=`rgba(255,130,166,${.08+.24*alpha})`;ctx.lineWidth=4.5*alpha;ctx.beginPath();ctx.arc(t.x,t.y,t.reach*.72,t.from,t.to,ccw);ctx.stroke();
  }
  ctx.restore();
}

function drawArcAttack(s,p){
  renderedArcs++;
  if(s.phase==='windup'){
    const t=clamp(s.phaseTime/s.windup,0,1),len=18+t*28;curveTongue(p,s.startAngle,len,.78);return;
  }
  if(s.phase==='active'){
    const prior=s.angle-(s.sweepDir||1)*.07;curveTongue(p,prior,s.reach*.92,.10,true);const tip=curveTongue(p,s.angle,s.reach,1);
    if((s.phaseTime||0)<(s.parryWindow||0)){ctx.save();ctx.strokeStyle='rgba(255,250,185,.92)';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(tip.x,tip.y,13,0,Math.PI*2);ctx.stroke();ctx.restore()}
    return;
  }
  const t=clamp(s.phaseTime/s.recovery,0,1);curveTongue(p,s.endAngle,s.reach*(1-t)+14,.68*(1-t));
}

function drawDash(p){
  if(p.dashCharging){const t=clamp(p.dashCharge||0,0,1),pulse=1+Math.sin(state.roomTime*8)*.025;ctx.save();ctx.strokeStyle='rgba(206,255,171,.78)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.r*1.55*pulse,-Math.PI/2,-Math.PI/2+Math.PI*2*t);ctx.stroke();const d=p.dashChargeVector||{x:1,y:0};ctx.strokeStyle='rgba(224,255,198,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x+d.x*(p.r+8),p.y+d.y*(p.r+8));ctx.lineTo(p.x+d.x*(p.r+22+t*20),p.y+d.y*(p.r+22+t*20));ctx.stroke();ctx.restore()}
  if(p.dash){const d=p.dash.dir||{x:1,y:0},charge=p.dash.charge||.5,speedRatio=clamp((p.dash.speed||0)/1100,0,1);ctx.save();const gradient=ctx.createLinearGradient(p.x-d.x*82,p.y-d.y*82,p.x,p.y);gradient.addColorStop(0,'rgba(153,255,151,0)');gradient.addColorStop(1,`rgba(214,255,177,${.28+.34*speedRatio})`);ctx.strokeStyle=gradient;ctx.lineWidth=3+charge*4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-d.x*(48+charge*40),p.y-d.y*(48+charge*40));ctx.lineTo(p.x-d.x*12,p.y-d.y*12);ctx.stroke();ctx.restore()}
}

function drawCurrents(){
  ctx.save();ctx.lineCap='round';ctx.lineWidth=1.4;for(const patch of state.terrain){if(!patch.active||patch.type!=='water')continue;const a=patch.phase+Math.sin(state.roomTime*.82+patch.phase)*.32,dx=Math.cos(a),dy=Math.sin(a),nx=-dy,ny=dx;ctx.strokeStyle='rgba(166,235,226,.18)';for(let i=-1;i<=1;i++){const x=patch.x+nx*i*patch.r*.32,y=patch.y+ny*i*patch.r*.32;ctx.beginPath();ctx.moveTo(x-dx*12,y-dy*12);ctx.quadraticCurveTo(x+nx*3,y+ny*3,x+dx*15,y+dy*15);ctx.stroke()}}
  ctx.restore();
}

function drawKineticEnemies(){
  const p=state.player;if(!p)return;ctx.save();for(const e of state.enemies){if(e.dead||!e.kineticType)continue;
    if(e.kineticType==='skimmer'){ctx.strokeStyle='rgba(131,244,255,.42)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(e.x,e.y,e.r+7,e.phase+state.roomTime*2,e.phase+state.roomTime*2+1.4);ctx.stroke()}
    else if(e.kineticType==='strider'){ctx.strokeStyle='rgba(215,255,230,.48)';ctx.lineWidth=2;const side=Math.sin(e.phase+state.roomTime*3.1)>=0?1:-1;ctx.beginPath();ctx.moveTo(e.x-side*18,e.y-8);ctx.lineTo(e.x-side*27,e.y);ctx.lineTo(e.x-side*18,e.y+8);ctx.stroke()}
    else if(e.kineticType==='sniper'&&e.state==='kinetic-telegraph'){ctx.setLineDash([5,7]);ctx.strokeStyle='rgba(255,219,128,.54)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.intent?.x??p.x,e.intent?.y??p.y);ctx.stroke();ctx.setLineDash([])}
    else if(e.kineticType==='shellback'){ctx.strokeStyle='rgba(226,239,199,.68)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(e.x,e.y,e.r+5,e.facingAngle-.72,e.facingAngle+.72);ctx.stroke()}
    if(e.state==='kinetic-evade-cue'){ctx.strokeStyle='rgba(255,255,218,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+10,0,Math.PI*2);ctx.stroke()}
  }ctx.restore();
}

function drawOverlay(){
  if(overlay.width!==canvas.width||overlay.height!==canvas.height){overlay.width=canvas.width;overlay.height=canvas.height}
  ctx.clearRect(0,0,overlay.width,overlay.height);renderedArcs=0;if(state.mode!=='playing'&&!state.player)return;drawCurrents();drawBladeTrails();const p=state.player;if(p){drawDash(p);for(const s of state.slashes)if(s.kind==='arc')drawArcAttack(s,p)}drawKineticEnemies();
}

function syncHitStop(){
  const serial=state.hitStopSerial||0;if(serial===lastHitStopSerial)return;
  lastHitStopSerial=serial;const kind=state.hitStopKind||'enemy';
  holdFrames=kind==='parry'?3:kind==='armor'?2:1;lastHitStopKind=kind;lastHoldFramesApplied=holdFrames;hitStopsRendered++;
}

const inheritedRender=F.render;
F.render=()=>{
  syncHitStop();if(holdFrames>0){holdFrames--;return}
  const original=state.slashes,legacy=original.filter(s=>s.kind!=='arc');state.slashes=legacy;
  try{inheritedRender?.()}finally{state.slashes=original}
  drawOverlay();
};

const inheritedHud=F.updateHud;
F.updateHud=(force=false)=>{inheritedHud?.(force);const p=state.player,d=G.$('dashState');if(!p||!d)return;if(p.dashCharging)d.textContent=`charge ${Math.round((p.dashCharge||0)*100)}%`;else if(p.dashBuffer>0)d.textContent='dash queued';else if(p.dash)d.textContent='burst';else if(p.dashCooldown>0)d.textContent=`dash ${p.dashCooldown.toFixed(1)}s`;else d.textContent='space · dash'};

window.SylvariaKineticPresentation=Object.freeze({version:VERSION,canvas:overlay,snapshot:()=>({version:VERSION,renderedArcs,renderedTrailSamples,overlay:true,chargeRing:Boolean(state.player?.dashCharging),dashBuffered:Boolean(state.player?.dashBuffer>0),hitStopHoldFrames:holdFrames,hitStopsRendered,lastHitStopKind,lastHoldFramesApplied,kineticEnemies:state.enemies.filter(e=>e.kineticType&&!e.dead).length})});