const G=window.Sylvaria091;
const {W,H,state,canvas,clamp}=G,F=G.fn;

export const CUTSTEP_PRESENTATION_VERSION='0.15.0';
const overlay=document.createElement('canvas');overlay.id='cutstepCanvas';overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
overlay.style.position='absolute';overlay.style.inset='0';overlay.style.width='100%';overlay.style.height='100%';overlay.style.pointerEvents='none';overlay.style.zIndex='3.6';
(document.getElementById('flowCanvas')||document.getElementById('kineticCanvas')||document.getElementById('pondCanvas')||canvas).insertAdjacentElement('afterend',overlay);
const ctx=overlay.getContext('2d');
let renderedFrames=0,aimFrames=0,pathFrames=0;
const COLORS=Object.freeze({carve:'#dfffc2',thrust:'#f2ffc5',crosscut:'#9fe8c5',reversal:'#ffe8a7'});
const q=v=>Math.round(v*1000)/1000;
function prospectiveTechnique(p,aim){
  if(!p?.v015LastCutstepDir||!(p.v015ChainTimer>0))return'carve';
  const d=clamp(p.v015LastCutstepDir.x*aim.x+p.v015LastCutstepDir.y*aim.y,-1,1),a=Math.acos(d);
  if(a<=Math.PI/7.2)return'thrust';if(a>=Math.PI*.40&&a<=Math.PI*.62)return'crosscut';if(a>=Math.PI*.80)return'reversal';return'carve';
}
function drawHistory(){
  const history=state.v015PathHistory||[];if(!history.length)return;pathFrames++;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const h of history){const t=clamp(h.life/(h.maxLife||.72),0,1),color=COLORS[h.technique]||COLORS.carve;ctx.globalAlpha=.08+.28*t;ctx.strokeStyle=color;ctx.lineWidth=2+3*t;ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.tx,h.ty);ctx.stroke();ctx.globalAlpha=.14+.28*t;ctx.fillStyle=color;ctx.beginPath();ctx.arc(h.tx,h.ty,2.5+2*t,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}
function drawActive(p){
  const d=p.dash;if(!d?.v015Cutstep)return;const color=COLORS[d.v015Technique]||COLORS.carve;
  ctx.save();ctx.lineCap='round';const g=ctx.createLinearGradient(d.sx,d.sy,p.x,p.y);g.addColorStop(0,'rgba(213,255,190,.05)');g.addColorStop(1,color);ctx.strokeStyle=g;ctx.lineWidth=d.v015Technique==='crosscut'?8:6;ctx.beginPath();ctx.moveTo(d.sx,d.sy);ctx.lineTo(p.x,p.y);ctx.stroke();
  if(d.v015Technique==='crosscut'){const n={x:-d.dir.y,y:d.dir.x},h=34;ctx.strokeStyle='rgba(187,255,211,.65)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x-n.x*h,p.y-n.y*h);ctx.lineTo(p.x+n.x*h,p.y+n.y*h);ctx.stroke()}
  if(d.v015Technique==='reversal'){ctx.strokeStyle='rgba(255,238,173,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,48,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}
function drawAim(p){
  const system=window.SylvariaCutstep,aim=system?.currentAim?.(p);if(!aim)return;aimFrames++;
  const tech=prospectiveTechnique(p,aim),config=system.config,distance=tech==='thrust'?config.thrustDistance:tech==='reversal'?80:config.distance,tx=p.x+aim.x*distance,ty=p.y+aim.y*distance,color=COLORS[tech]||COLORS.carve,ready=(p.v015Segments||0)>=1;
  ctx.save();ctx.lineCap='round';ctx.setLineDash([5,7]);ctx.strokeStyle=ready?color:'rgba(190,194,170,.32)';ctx.globalAlpha=ready ? .58 : .32;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(p.x+aim.x*(p.r+8),p.y+aim.y*(p.r+8));ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=ready ? .84 : .42;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(tx,ty,6,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(tx-aim.y*7,ty+aim.x*7);ctx.lineTo(tx+aim.y*7,ty-aim.x*7);ctx.stroke();
  if(tech!=='carve'&&p.v015ChainTimer>0){ctx.globalAlpha=.75;ctx.font='600 10px ui-monospace, SFMono-Regular, Menlo, monospace';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(tech.toUpperCase(),tx,ty-12)}
  ctx.restore();
}
function drawSegments(p){
  const max=window.SylvariaCutstep?.config?.maxSegments||3,value=clamp(p.v015Segments||0,0,max),baseX=p.x-(max-1)*7,baseY=p.y+p.r+17;
  ctx.save();for(let i=0;i<max;i++){const fill=clamp(value-i,0,1);ctx.strokeStyle='rgba(215,238,190,.34)';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(baseX+i*14,baseY,4.5,0,Math.PI*2);ctx.stroke();if(fill>0){ctx.fillStyle=`rgba(215,255,184,${.25+.65*fill})`;ctx.beginPath();ctx.arc(baseX+i*14,baseY,3.2,0,Math.PI*2);ctx.fill()}}ctx.restore();
}
function draw(){ctx.clearRect(0,0,W,H);if(state.mode!=='playing'||!state.player)return;drawHistory();drawActive(state.player);drawAim(state.player);drawSegments(state.player);renderedFrames++}
const inheritedRender=F.render;
F.render=()=>{const result=inheritedRender?.();draw();return result};
window.SylvariaCutstepPresentation=Object.freeze({version:CUTSTEP_PRESENTATION_VERSION,canvas:overlay,snapshot:()=>({version:CUTSTEP_PRESENTATION_VERSION,renderedFrames,aimFrames,pathFrames,logical:{width:W,height:H},aim:state.player&&window.SylvariaCutstep?.currentAim?.(state.player),segments:q(state.player?.v015Segments||0),activeTechnique:state.player?.dash?.v015Technique||null})});
