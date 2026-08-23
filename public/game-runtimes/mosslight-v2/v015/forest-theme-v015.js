const G=window.Sylvaria091;
const {W,H,state,clamp,hash,rngFrom}=G,F=G.fn,canvas=G.canvas;

export const FOREST_THEME_VERSION='0.15.0';
export const FOREST_BIOMES=Object.freeze([
  Object.freeze({id:'mist-pine',label:'Misty Pinewood',ground:'#102018',deep:'#07110d',fog:'#a7c8b7',leaf:'#315c3e',accent:'#d9f4c2',industrial:'#d68750',undergrowth:11}),
  Object.freeze({id:'oak-hollow',label:'Oakroot Hollow',ground:'#172217',deep:'#0a100b',fog:'#b2b8a1',leaf:'#49643d',accent:'#e4e3b2',industrial:'#c77b4e',undergrowth:10}),
  Object.freeze({id:'cedar-gloom',label:'Cedar Gloom',ground:'#0c1d1b',deep:'#06100f',fog:'#8fbdb7',leaf:'#27554d',accent:'#c9f6d8',industrial:'#ce7655',undergrowth:12}),
  Object.freeze({id:'burnscar',label:'Burnscar Timberline',ground:'#211b16',deep:'#100c0a',fog:'#b29c88',leaf:'#4a4230',accent:'#efd69f',industrial:'#f0804f',undergrowth:7}),
  Object.freeze({id:'ancient-grove',label:'Ancient Sylvarian Grove',ground:'#122019',deep:'#07100d',fog:'#a6c4af',leaf:'#3b6349',accent:'#dff7b8',industrial:'#c36f4d',undergrowth:13}),
]);
const TITLES=Object.freeze({
  'mist-pine':['Whispering Pine Verge','Needle-Mist Crossing','Blackpine Hollow','Fogbound Timberline'],
  'oak-hollow':['Old Oak Threshold','Rootvault Clearing','Moss-Crown Hollow','Hearthless Copse'],
  'cedar-gloom':['Cedar Veil','Rainroot Passage','Gloomwood Corridor','Mist-Cut Ravine'],
  burnscar:['Charred Survey Line','Ashbark Scar','Cinder Logging Road','Black Stump Reach'],
  'ancient-grove':['Elderroot Sanctuary','Moonmoss Grove','Sylvarian Heartwood','The Listening Trees'],
});
const ENEMY_NAMES=Object.freeze({
  feller:'Clearcut Hand',foreman:'Nailgun Logger',lobbyist:'Timber Lobbyist',skidder:'Barkcrusher',drone:'Saw-Moth Drone',chair:'Permit Warden',broker:'Subsidy Runner',surveyor:'Boundary Wisp',mech:'Feller Mech',mulcher:'Root Mulcher',
});
const q=v=>Math.round(v*100000)/100000;
const overlay=document.createElement('canvas');overlay.id='forestCanvas';overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
overlay.style.position='absolute';overlay.style.inset='0';overlay.style.width='100%';overlay.style.height='100%';overlay.style.pointerEvents='none';overlay.style.zIndex='2.7';
(document.getElementById('pondCanvas')||canvas).insertAdjacentElement('afterend',overlay);
const ctx=overlay.getContext('2d');
let lastBiome=null,regrown=0,forestPatches=0;

function biomeForDepth(depth=state.worldDepth||1){return FOREST_BIOMES[(Math.max(1,depth)-1)%FOREST_BIOMES.length]}
function pointBlocked(x,y,r=18){return F.blockers?.().some(o=>Math.hypot(x-o.x,y-o.y)<r+(o.r||0)+12)}
function addUndergrowth(depth,biome){
  const rng=rngFrom(hash(`sylvaria-v015-undergrowth-${depth}-${biome.id}`)),count=biome.undergrowth;
  for(let i=0;i<count;i++){
    let x=260+rng()*(W-315),y=112+rng()*(H-175),radius=45+rng()*40;
    for(let attempt=0;attempt<18&&pointBlocked(x,y,radius*.35);attempt++){x=230+rng()*(W-285);y=105+rng()*(H-165)}
    const patch={id:`v015-forest-${depth}-${i}`,type:'grass',x:q(x),y:q(y),r:q(radius),phase:rng()*Math.PI*2,active:true,cracked:false,cacheReleased:true,v015Forest:true};
    state.terrain.push(patch);forestPatches++;
    const blades=18+Math.floor(radius/3.6);
    for(let j=0;j<blades;j++){
      const a=rng()*Math.PI*2,rr=Math.sqrt(rng())*radius*.93;
      state.foliage.push({id:`${patch.id}-fern-${j}`,patchId:patch.id,x:q(x+Math.cos(a)*rr),y:q(y+Math.sin(a)*rr),r:5,cut:false,phase:rng()*Math.PI*2,v015Forest:true,v015RegrowAt:0});
    }
  }
}
function forestifyTerrain(biome){
  for(const p of state.terrain){
    if(p.v015Forest)continue;
    if(p.type==='water'||p.type==='ice')p.type=biome.id==='burnscar'?'bramble':'grass';
    else if(p.type==='sand'||p.type==='shards')p.type=biome.id==='burnscar'?'bramble':'mud';
    p.cacheReleased=true;
  }
}
function seedConvertedGrass(){
  const existing=new Set(state.foliage.map(f=>f.patchId));
  for(const patch of state.terrain){
    if(patch.type!=='grass'||existing.has(patch.id))continue;
    const rng=rngFrom(hash(`v015-converted-${patch.id}`)),blades=14+Math.floor((patch.r||40)/4);
    for(let j=0;j<blades;j++){const a=rng()*Math.PI*2,rr=Math.sqrt(rng())*(patch.r||40)*.88;state.foliage.push({id:`${patch.id}-v015-${j}`,patchId:patch.id,x:q(patch.x+Math.cos(a)*rr),y:q(patch.y+Math.sin(a)*rr),r:5,cut:false,phase:rng()*Math.PI*2,v015Forest:true,v015RegrowAt:0})}
  }
}
function applyForestRoom(){
  const biome=biomeForDepth();lastBiome=biome;forestPatches=0;regrown=0;
  if(state.room){const names=TITLES[biome.id],idx=(state.worldDepth-1)%names.length;state.room.title=names[idx];state.room.subtitle=`${biome.label.toLowerCase()} · carve visibility · survive the clearcut`}
  forestifyTerrain(biome);seedConvertedGrass();addUndergrowth(state.worldDepth,biome);
  for(const e of state.enemies)e.v015Name=ENEMY_NAMES[e.type]||e.kineticType||e.type;
  document.documentElement.dataset.sylvariaBiome=biome.id;
  document.documentElement.style.setProperty('--sylvaria-deep',biome.deep);document.documentElement.style.setProperty('--sylvaria-ground',biome.ground);document.documentElement.style.setProperty('--sylvaria-accent',biome.accent);
  state.terrainCacheDirty=true;F.rebuildTerrainCache?.();F.updateHud?.(true);
}
const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{const result=inheritedSetup(...args);applyForestRoom();return result};
if(state.player&&state.room)applyForestRoom();

const inheritedMovement=F.updateMovement;
F.updateMovement=(dt)=>{
  const result=inheritedMovement(dt);
  for(const f of state.foliage){if(!f.cut||!(f.v015RegrowAt>0)||state.roomTime<f.v015RegrowAt)continue;f.cut=false;f.v015RegrowAt=0;regrown++}
  return result;
};
function patchVisibility(patch){const blades=state.foliage.filter(f=>f.patchId===patch.id),uncut=blades.filter(f=>!f.cut).length;return blades.length?uncut/blades.length:0}
function drawPine(t,biome,cedar=false){
  const r=t.r||24,base=t.y+r*.95;
  ctx.fillStyle=cedar?'rgba(48,42,30,.93)':'rgba(55,39,27,.94)';ctx.fillRect(t.x-r*.12,t.y-r*.35,r*.24,r*1.35);
  const levels=cedar?4:3;for(let i=0;i<levels;i++){const y=t.y-r*(1.58-i*.42),w=r*(1.15+i*.18);ctx.fillStyle=i%2?`${biome.leaf}e6`:`${biome.leaf}f2`;ctx.beginPath();ctx.moveTo(t.x,y-r*.55);ctx.lineTo(t.x-w,y+r*.72);ctx.lineTo(t.x+w,y+r*.72);ctx.closePath();ctx.fill()}
  ctx.fillStyle='rgba(5,14,9,.35)';ctx.beginPath();ctx.ellipse(t.x,base,r*1.15,r*.28,0,0,Math.PI*2);ctx.fill();
}
function drawOak(t,biome,ancient=false){
  const r=t.r||24;ctx.save();ctx.translate(t.x,t.y);
  ctx.strokeStyle=ancient?'rgba(66,55,34,.98)':'rgba(74,52,32,.97)';ctx.lineWidth=r*.34;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,r*.92);ctx.lineTo(-r*.04,-r*.62);ctx.stroke();
  ctx.lineWidth=r*.15;for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(0,-r*.20);ctx.lineTo(s*r*.58,-r*.78);ctx.stroke()}
  const blobs=[[-.58,-.72,.88],[.42,-.82,.92],[-.02,-1.16,1.05],[-.02,-.46,1.12]];for(const [x,y,z] of blobs){ctx.fillStyle=ancient?'rgba(48,91,55,.96)':`${biome.leaf}ef`;ctx.beginPath();ctx.arc(x*r,y*r,z*r*.68,0,Math.PI*2);ctx.fill()}
  if(ancient){ctx.strokeStyle='rgba(155,202,111,.42)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-r*.12,-r*.4);ctx.quadraticCurveTo(r*.15,r*.2,r*.32,r*.92);ctx.stroke()}
  ctx.restore();
}
function drawBurnedTree(t){
  const r=t.r||24;ctx.save();ctx.translate(t.x,t.y);ctx.strokeStyle='rgba(34,25,20,.98)';ctx.lineCap='round';ctx.lineWidth=r*.30;ctx.beginPath();ctx.moveTo(0,r*.92);ctx.lineTo(0,-r*1.15);ctx.stroke();ctx.lineWidth=r*.10;for(const [sx,sy,ex,ey] of[[-.02,-.4,-.7,-.95],[.02,-.65,.62,-1.08],[-.02,-.15,-.55,-.48]]){ctx.beginPath();ctx.moveTo(sx*r,sy*r);ctx.lineTo(ex*r,ey*r);ctx.stroke()}ctx.restore();
}
function drawForestTrees(biome){
  ctx.save();for(const t of state.trees){if(!t.alive)continue;if(biome.id==='mist-pine')drawPine(t,biome,false);else if(biome.id==='cedar-gloom')drawPine(t,biome,true);else if(biome.id==='burnscar')drawBurnedTree(t);else drawOak(t,biome,biome.id==='ancient-grove')}ctx.restore();
}
function drawCanopyShadow(biome){
  ctx.save();for(const t of state.trees){if(!t.alive)continue;const r=t.r||24,g=ctx.createRadialGradient(t.x-r*.2,t.y-r*.35,4,t.x,t.y,r*2.4);g.addColorStop(0,'rgba(2,10,6,.04)');g.addColorStop(.62,'rgba(2,10,6,.20)');g.addColorStop(1,'rgba(2,10,6,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(t.x,t.y,r*2.4,0,Math.PI*2);ctx.fill()}ctx.restore();
}
function drawUndergrowthFog(){
  for(const p of state.terrain){if(!p.active||p.type!=='grass')continue;const visibility=patchVisibility(p);if(visibility<=.06)continue;
    const r=(p.r||45)*(1.05+.16*visibility),g=ctx.createRadialGradient(p.x,p.y,r*.16,p.x,p.y,r);g.addColorStop(0,`rgba(5,18,10,${.06+.12*visibility})`);g.addColorStop(.58,`rgba(9,29,15,${.10+.18*visibility})`);g.addColorStop(1,'rgba(5,14,9,0)');ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
  }
}
function drawMist(biome){
  const t=state.roomTime||0;ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<5;i++){
    const phase=i*1.73+(state.worldDepth||1)*.41,x=((120+i*215+t*(8+i*1.7))%(W+260))-130,y=120+i*92+Math.sin(t*.23+phase)*24;
    const g=ctx.createRadialGradient(x,y,8,x,y,150);g.addColorStop(0,biome.id==='burnscar'?'rgba(177,150,125,.055)':'rgba(178,213,198,.060)');g.addColorStop(.55,biome.id==='burnscar'?'rgba(139,120,105,.035)':'rgba(139,181,166,.036)');g.addColorStop(1,'rgba(160,200,185,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,155,44,Math.sin(phase)*.08,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawIndustrialLights(biome){
  ctx.save();ctx.globalCompositeOperation='screen';for(const e of state.enemies){if(e.dead)continue;const industrial=['feller','foreman','lobbyist','skidder','chair','broker','mech','mulcher'].includes(e.type);if(!industrial)continue;const r=e.type==='mech'||e.type==='mulcher'?48:28,g=ctx.createRadialGradient(e.x,e.y,2,e.x,e.y,r);g.addColorStop(0,'rgba(244,151,82,.22)');g.addColorStop(.45,'rgba(215,112,62,.08)');g.addColorStop(1,'rgba(215,112,62,0)');ctx.fillStyle=g;ctx.fillRect(e.x-r,e.y-r,r*2,r*2)}ctx.restore();
}
function drawDiscoveryGlow(){
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const item of state.pickups){if(item.dead)continue;const g=ctx.createRadialGradient(item.x,item.y,2,item.x,item.y,36);g.addColorStop(0,'rgba(225,255,174,.52)');g.addColorStop(.35,'rgba(184,239,135,.20)');g.addColorStop(1,'rgba(184,239,135,0)');ctx.fillStyle=g;ctx.fillRect(item.x-36,item.y-36,72,72)}
  for(const m of state.mushrooms){if(m.cut)continue;const g=ctx.createRadialGradient(m.x,m.y,2,m.x,m.y,24);g.addColorStop(0,'rgba(189,238,177,.28)');g.addColorStop(1,'rgba(189,238,177,0)');ctx.fillStyle=g;ctx.fillRect(m.x-24,m.y-24,48,48)}ctx.restore();
}
function drawForestFloor(biome){ctx.save();ctx.globalAlpha=biome.id==='burnscar'?.31:.25;ctx.fillStyle=biome.ground;ctx.fillRect(0,0,W,H);ctx.restore()}
function drawVignette(){const g=ctx.createRadialGradient(W*.5,H*.5,145,W*.5,H*.5,575);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.72,'rgba(0,0,0,.07)');g.addColorStop(1,'rgba(0,0,0,.52)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
function drawForest(){
  const biome=lastBiome||biomeForDepth();ctx.clearRect(0,0,W,H);if(state.mode!=='playing'&&!state.room)return;drawForestFloor(biome);drawForestTrees(biome);drawCanopyShadow(biome);drawUndergrowthFog();drawMist(biome);drawIndustrialLights(biome);drawDiscoveryGlow();drawVignette();
}
const inheritedRender=F.render;
F.render=()=>{const result=inheritedRender?.();drawForest();return result};

window.SylvariaForestTheme=Object.freeze({
  version:FOREST_THEME_VERSION,biomes:FOREST_BIOMES,biome:()=>lastBiome||biomeForDepth(),draw:drawForest,
  playerTint:()=>lastBiome?.id==='burnscar'?[1.05,.98,.80,1]:[.90,1.06,.88,1],
  enemyTint:e=>e?.type==='mech'||e?.type==='mulcher'?[1.08,.86,.72,1]:[.92,.97,.88,1],
  snapshot:()=>({version:FOREST_THEME_VERSION,biome:(lastBiome||biomeForDepth()).id,label:(lastBiome||biomeForDepth()).label,forestPatches,uncutFoliage:state.foliage.filter(f=>!f.cut).length,cutFoliage:state.foliage.filter(f=>f.cut).length,regrown})
});
