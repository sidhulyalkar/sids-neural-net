const G=window.Sylvaria091;
const {state,canvas,DIRS,clamp}=G,F=G.fn;

export const FLOW_PRESENTATION_VERSION='0.14.0';
const overlay=document.createElement('canvas');overlay.id='flowCanvas';overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
overlay.style.position='absolute';overlay.style.inset='0';overlay.style.width='100%';overlay.style.height='100%';overlay.style.pointerEvents='none';overlay.style.zIndex='4';
(document.getElementById('kineticCanvas')||document.getElementById('pondCanvas')||canvas).insertAdjacentElement('afterend',overlay);
const ctx=overlay.getContext('2d');
let lastHitStopSerial=0,holdFrames=0,renderedFlowFrames=0,bufferCues=0,punishCues=0;

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

function draw(){
  if(overlay.width!==canvas.width||overlay.height!==canvas.height){overlay.width=canvas.width;overlay.height=canvas.height}
  ctx.clearRect(0,0,overlay.width,overlay.height);bufferCues=0;punishCues=0;
  if(state.mode!=='playing'||!state.player)return;
  drawFlowRing(state.player);drawBufferedBlade(state.player);drawPunishWindows();renderedFlowFrames++;
}

const inheritedRender=F.render;
F.render=()=>{
  syncHitStop();const holding=holdFrames>0;
  inheritedRender?.();
  if(holding){holdFrames--;return}
  draw();
};

window.SylvariaFlowPresentation=Object.freeze({
  version:FLOW_PRESENTATION_VERSION,
  canvas:overlay,
  snapshot:()=>({version:FLOW_PRESENTATION_VERSION,overlay:true,renderedFlowFrames,bufferCues,punishCues,holdFrames,flow:state.player?.flow||0}),
});
