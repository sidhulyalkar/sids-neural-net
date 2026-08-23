const G=window.Sylvaria091;
const {W,H,state,clamp,hash,rngFrom}=G,F=G.fn;

export const DISCOVERY_VERSION='0.15.0';
const q=v=>Math.round(v*100000)/100000;
const SHRINE_BOONS=Object.freeze([
  Object.freeze({id:'leaf-edge',label:'LEAF EDGE',description:'+12% Cutstep damage'}),
  Object.freeze({id:'quickroot',label:'QUICKROOT',description:'+0.12 segment refill / second'}),
  Object.freeze({id:'moon-eye',label:'MOON EYE',description:'thinner forest fog'}),
]);
function freshBoons(){return{damage:1,passiveRefill:0,counterRefill:0,fogMultiplier:1,discoveries:0}}
function ensureBoons(reset=false){if(reset||!state.v015RunBoons)state.v015RunBoons=freshBoons();return state.v015RunBoons}
function segmentDistance(px,py,ax,ay,bx,by){const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,l2=vx*vx+vy*vy,t=l2>1e-7?clamp((wx*vx+wy*vy)/l2,0,1):0,cx=ax+vx*t,cy=ay+vy*t;return Math.hypot(px-cx,py-cy)}
function findPoint(rng,minFromPlayer=230){for(let i=0;i<90;i++){const x=110+rng()*(W-220),y=120+rng()*(H-190);if(F.positionClear(x,y,20)&&Math.hypot(x-state.player.x,y-state.player.y)>minFromPlayer)return{x:q(x),y:q(y)}}return{x:W-150,y:H*.32}}
function shrineNodes(x,y){return SHRINE_BOONS.map((boon,i)=>{const a=-Math.PI/2+i*Math.PI*2/3;return{...boon,x:q(x+Math.cos(a)*44),y:q(y+Math.sin(a)*44),r:12}})}
function spawnDiscovery(depth){
  const bp=G.roomBlueprint(depth),kind=bp.v015Discovery;if(!kind)return null;const rng=rngFrom(hash(`v015-discovery:${depth}:${kind}`)),p=findPoint(rng,235);
  if(kind==='moonflower')return{id:`moonflower-${depth}`,kind,x:p.x,y:p.y,r:15,ttl:8.5,maxTtl:8.5,collected:false,expired:false,pulse:rng()*Math.PI*2};
  if(kind==='spirit-stag')return{id:`stag-${depth}`,kind,x:p.x,y:p.y,r:18,ttl:10.5,maxTtl:10.5,collected:false,expired:false,pulse:rng()*Math.PI*2,vx:0,vy:0};
  if(kind==='root-shrine')return{id:`shrine-${depth}`,kind,x:p.x,y:p.y,r:27,ttl:Infinity,maxTtl:Infinity,collected:false,expired:false,pulse:rng()*Math.PI*2,nodes:shrineNodes(p.x,p.y)};
  return null;
}
function applyBoon(id){const b=ensureBoons();if(id==='leaf-edge')b.damage=Math.min(1.36,q(b.damage+.12));else if(id==='quickroot')b.passiveRefill=Math.min(.36,q(b.passiveRefill+.12));else if(id==='moon-eye')b.fogMultiplier=Math.max(.55,q(b.fogMultiplier*.78));b.discoveries++;return b}
function reward(d,node=null){
  if(d.collected||d.expired)return;const p=state.player,b=ensureBoons();d.collected=true;b.discoveries++;
  if(d.kind==='moonflower'){p.v015Segments=clamp((p.v015Segments||0)+1.25,0,3);p.v015VisionBurst=6;state.score+=240;F.addCallout?.(d.x,d.y-24,'MOONFLOWER · +1.25 SEGMENTS','#dffff2')}
  else if(d.kind==='spirit-stag'){p.v015Segments=3;b.counterRefill=Math.min(.32,q(b.counterRefill+.08));state.score+=480;F.addCallout?.(d.x,d.y-28,'SPIRIT STAG · RETURNS GROW STRONGER','#d7f4ff')}
  else if(d.kind==='root-shrine'&&node){b.discoveries=Math.max(0,b.discoveries-1);applyBoon(node.id);state.score+=320;F.addCallout?.(node.x,node.y-22,`${node.label} · ${node.description}`,'#e8efb4')}
  for(let i=0;i<16;i++)F.spawnParticle?.(node?.x||d.x,node?.y||d.y,d.kind==='spirit-stag'?'#c9ecff':'#e6ffc7',30+i*3,.3,1.8);
}
function processCutstep(d,ax,ay,bx,by){
  if(!d||d.collected||d.expired)return;if(d.kind==='root-shrine'){for(const node of d.nodes||[])if(segmentDistance(node.x,node.y,ax,ay,bx,by)<=node.r+9){reward(d,node);return}}else if(segmentDistance(d.x,d.y,ax,ay,bx,by)<=d.r+10)reward(d);
}
function updateStag(d,dt){
  const p=state.player,dx=d.x-p.x,dy=d.y-p.y,m=Math.hypot(dx,dy)||1,near=m<210,speed=near?94:28,tx=dx/m,ty=dy/m;d.vx=q(d.vx*.86+tx*speed*.14);d.vy=q(d.vy*.86+ty*speed*.14);const nx=clamp(d.x+d.vx*dt,48,W-48),ny=clamp(d.y+d.vy*dt,100,H-44);if(F.positionClear(nx,d.y,d.r))d.x=q(nx);else d.vx*=-.7;if(F.positionClear(d.x,ny,d.r))d.y=q(ny);else d.vy*=-.7;
}
const inheritedSetup=F.setupRoom;
F.setupRoom=(depth,...rest)=>{const out=inheritedSetup(depth,...rest);ensureBoons(depth===1);state.v015Discoveries=[];const d=spawnDiscovery(depth);if(d)state.v015Discoveries.push(d);return out};
const inheritedMovement=F.updateMovement;
F.updateMovement=dt=>{
  const p=state.player,active=p?.dash?.v015Cutstep||null,ax=p?.x||0,ay=p?.y||0;const out=inheritedMovement(dt),bx=p?.x||ax,by=p?.y||ay;
  for(const d of state.v015Discoveries||[]){if(d.collected||d.expired)continue;if(Number.isFinite(d.ttl)){d.ttl-=dt;if(d.ttl<=0){d.expired=true;F.addCallout?.(d.x,d.y-16,'LOST TO THE MIST','#a9b7a8');continue}}if(d.kind==='spirit-stag')updateStag(d,dt);if(active)processCutstep(d,ax,ay,bx,by)}
  if(p?.v015VisionBurst>0)p.v015VisionBurst=Math.max(0,p.v015VisionBurst-dt);return out;
};
window.SylvariaDiscoveries=Object.freeze({version:DISCOVERY_VERSION,boons:SHRINE_BOONS,snapshot:()=>({version:DISCOVERY_VERSION,runBoons:{...ensureBoons()},discoveries:(state.v015Discoveries||[]).map(d=>({id:d.id,kind:d.kind,x:d.x,y:d.y,ttl:d.ttl,collected:d.collected,expired:d.expired,nodes:d.nodes?.map(n=>({id:n.id,x:n.x,y:n.y}))||null}))})});
