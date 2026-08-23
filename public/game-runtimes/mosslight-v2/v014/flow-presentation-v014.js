const G=window.Sylvaria091;
const {state,canvas,DIRS,clamp}=G,F=G.fn;

export const FLOW_PRESENTATION_VERSION='0.14.0';
const overlay=document.createElement('canvas');overlay.id='flowCanvas';overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
overlay.style.position='absolute';overlay.style.inset='0';overlay.style.width='100%';overlay.style.height='100%';overlay.style.pointerEvents='none';overlay.style.zIndex='4';
(document.getElementById('kineticCanvas')||document.getElementById('pondCanvas')||canvas).insertAdjacentElement('afterend',overlay);
const ctx=overlay.getContext('2d');
let lastHitStopSerial=0,holdFrames=0,renderedFlowFrames=0,bufferCues=0,punishCues=0,bossCues=0;

function syncHitStop(){
  const serial=state.hitStopSerial||0;if(serial===lastHitStopSerial)return;
  lastHitStopSerial=serial;
  const kind=state.hitStopKind||'enemy';holdFrames=kind==='parry'?3:kind==='armor'?2:1;
}

function drawFlowRing(p){
  const flow=clamp((p.flow||0)/100,0,1);if(flow<=.01)return;
  const r=p.r+12,pulse=flow>.8?1+Math.sin(state.roomTime*8)*.035:1;
  ctx.save();ctx.lineCap='round';
  ctx.strokeStyle=`rgba(187,255,157,${.16+.48*flow})`;ctx.lineWidth=2+flow*2;
  ctx.beginPath();ctx.arc(p.x,p.y,r*pulse,-Math.PI/2,-Math.PI/2+Math.PI*2*flow);ctx.stroke();
  if(flow>.74){ctx.strokeStyle=`rgba(232,255,194,${(flow-.74)*1.6})`;ctx.lineWidth=1.25;ctx.beginPath();ctx.arc(p.x,p.y,(r+5)*pulse,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}

function drawBufferedBlade(p){
  if(!(p.bladeBuffer>0)||!p.bladeQueuedDirection)return;
  const d=DIRS[p.bladeQueuedDirection]||DIRS.right,t=clamp(p.bladeBuffer/(window.SylvariaFlowCombat?.config?.bladeBuffer||7/120),0,1),x=p.x+d.x*(p.r+24),y=p.y+d.y*(p.r+24),n={x:-d.y,y:d.x};
  bufferCues++;
  ctx.save();ctx.globalAlpha=.35+.55*t;ctx.strokeStyle='#fff1a8';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-d.x*8+n.x*6,y-d.y*8+n.y*6);ctx.lineTo(x,y);ctx.lineTo(x-d.x*8-n.x*6,y-d.y*8-n.y*6);ctx.stroke();ctx.restore();
}

function drawPunishWindows(){
  const config=window.SylvariaEnemyFlow?.config||{};
  for(const e of state.enemies){
    if(e.dead||!(e.v014PunishTimer>0))continue;
    const spec=config[e.kineticType],max=(spec?.punishTicks||1)/120,t=clamp(e.v014PunishTimer/max,0,1),r=e.r+11;
    punishCues++;
    ctx.save();ctx.lineCap='round';ctx.strokeStyle=`rgba(231,255,176,${.34+.58*t})`;ctx.lineWidth=2.5;ctx.setLineDash([8,5]);ctx.lineDashOffset=-state.roomTime*28;ctx.beginPath();ctx.arc(e.x,e.y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*t);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=`rgba(242,255,205,${.10+.16*t})`;ctx.beginPath();ctx.arc(e.x,e.y,e.r+4,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

function drawBossIntent(b){
  if(!(b.telegraph>0)||b.v014PunishTimer>0)return;
  const target=b.intent||state.player;if(!target)return;
  const a=Math.atan2(target.y-b.y,target.x-b.x),r=b.r+20;
  ctx.save();ctx.lineCap='round';ctx.lineWidth=1.8;
  if(b.phase===1){
    ctx.strokeStyle='rgba(255,205,135,.58)';for(const spread of[-.22,0,.22]){const aa=a+spread;ctx.beginPath();ctx.moveTo(b.x+Math.cos(aa)*r,b.y+Math.sin(aa)*r);ctx.lineTo(b.x+Math.cos(aa)*165,b.y+Math.sin(aa)*165);ctx.stroke()}
  }else if(b.phase===2){
    ctx.strokeStyle='rgba(255,220,151,.5)';for(let i=0;i<10;i++){const aa=i*Math.PI*2/10+(b.sawAngle||0)*.04;ctx.beginPath();ctx.moveTo(b.x+Math.cos(aa)*r,b.y+Math.sin(aa)*r);ctx.lineTo(b.x+Math.cos(aa)*(r+28),b.y+Math.sin(aa)*(r+28));ctx.stroke()}
  }else{
    ctx.strokeStyle='rgba(255,162,132,.62)';ctx.setLineDash([7,6]);ctx.beginPath();ctx.moveTo(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
  }
  ctx.restore();bossCues++;
}

function drawBossFlow(){
  const b=state.boss;if(!b||b.dead)return;
  const max=b.v014GuardMax||0,guard=b.v014Guard??max,open=b.v014PunishTimer>0,r=b.r+14;
  drawBossIntent(b);
  if(!max&&!open)return;
  ctx.save();ctx.lineCap='round';
  if(open){
    const config=window.SylvariaBossFlow?.config,ticks=config?.punishTicksByPhase?.[b.phase]||24,t=clamp(b.v014PunishTimer/(ticks/120),0,1);
    ctx.strokeStyle=`rgba(255,244,171,${.45+.5*t})`;ctx.lineWidth=4;ctx.setLineDash([10,6]);ctx.lineDashOffset=-state.roomTime*34;ctx.beginPath();ctx.arc(b.x,b.y,r+5,-Math.PI/2,-Math.PI/2+Math.PI*2*t);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=`rgba(246,255,194,${.12+.2*t})`;ctx.beginPath();ctx.arc(b.x,b.y,b.r*.62,0,Math.PI*2);ctx.fill();bossCues++;
  }else if(max>0){
    const gap=.12,segment=Math.PI*2/max;
    for(let i=0;i<max;i++){const alive=i<guard;ctx.strokeStyle=alive?'rgba(210,255,188,.70)':'rgba(110,128,104,.22)';ctx.lineWidth=alive?3:1.5;ctx.beginPath();ctx.arc(b.x,b.y,r,-Math.PI/2+i*segment+gap,-Math.PI/2+(i+1)*segment-gap);ctx.stroke()}
    bossCues++;
  }
  ctx.restore();
}

function draw(){
  if(overlay.width!==canvas.width||overlay.height!==canvas.height){overlay.width=canvas.width;overlay.height=canvas.height}
  ctx.clearRect(0,0,overlay.width,overlay.height);bufferCues=0;punishCues=0;bossCues=0;
  if(state.mode!=='playing'||!state.player)return;
  drawFlowRing(state.player);drawBufferedBlade(state.player);drawPunishWindows();drawBossFlow();renderedFlowFrames++;
}

const inheritedRender=F.render;
F.render=()=>{
  syncHitStop();const holding=holdFrames>0;
  inheritedRender?.();
  if(holding){
    // Freeze the underlying world for impact weight, but redraw the tactical overlay.
    // A parry, punish window, buffered direction, or newly cracked boss core must be
    // readable on the very frame it is earned instead of appearing after hit-stop.
    draw();holdFrames--;return;
  }
  draw();
};

window.SylvariaFlowPresentation=Object.freeze({
  version:FLOW_PRESENTATION_VERSION,
  canvas:overlay,
  snapshot:()=>({version:FLOW_PRESENTATION_VERSION,overlay:true,renderedFlowFrames,bufferCues,punishCues,bossCues,holdFrames,flow:state.player?.flow||0}),
});
