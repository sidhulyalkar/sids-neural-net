const G=window.Sylvaria091;
const {W,H,state,hash,rngFrom}=G,F=G.fn,canvas=G.canvas;

export const FOREST_WORLD_VERSION='0.15.0';
export const BIOMES=Object.freeze([
  {id:'mist-pine',label:'Misty Pinewood',ground:'#102018',deep:'#07110d',leaf:'#315c3e',accent:'#d9f4c2',brush:11},
  {id:'oak-hollow',label:'Oakroot Hollow',ground:'#172217',deep:'#0a100b',leaf:'#49643d',accent:'#e4e3b2',brush:10},
  {id:'cedar-gloom',label:'Cedar Gloom',ground:'#0c1d1b',deep:'#06100f',leaf:'#27554d',accent:'#c9f6d8',brush:12},
  {id:'burnscar',label:'Burnscar Timberline',ground:'#211b16',deep:'#100c0a',leaf:'#4a4230',accent:'#efd69f',brush:7},
  {id:'ancient-grove',label:'Ancient Sylvarian Grove',ground:'#122019',deep:'#07100d',leaf:'#3b6349',accent:'#dff7b8',brush:13},
].map(Object.freeze));
const TITLES={
  'mist-pine':['Whispering Pine Verge','Needle-Mist Crossing','Blackpine Hollow','Fogbound Timberline'],
  'oak-hollow':['Old Oak Threshold','Rootvault Clearing','Moss-Crown Hollow','Hearthless Copse'],
  'cedar-gloom':['Cedar Veil','Rainroot Passage','Gloomwood Corridor','Mist-Cut Ravine'],
  burnscar:['Charred Survey Line','Ashbark Scar','Cinder Logging Road','Black Stump Reach'],
  'ancient-grove':['Elderroot Sanctuary','Moonmoss Grove','Sylvarian Heartwood','The Listening Trees'],
};
const ENEMY_NAMES={feller:'Clearcut Hand',foreman:'Nailgun Logger',lobbyist:'Timber Lobbyist',skidder:'Barkcrusher',drone:'Saw-Moth Drone',chair:'Permit Warden',broker:'Subsidy Runner',surveyor:'Boundary Wisp',mech:'Feller Mech',mulcher:'Root Mulcher'};
const q=v=>Math.round(v*100000)/100000;
const overlay=document.createElement('canvas');overlay.id='forestCanvas';overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2.7';
(document.getElementById('pondCanvas')||canvas).insertAdjacentElement('afterend',overlay);
const ctx=overlay.getContext('2d');
let activeBiome=BIOMES[0],regrown=0,forestPatches=0;

const biomeForDepth=(depth=state.worldDepth||1)=>BIOMES[(Math.max(1,depth)-1)%BIOMES.length];
function addBrushPatch(rng,depth,index){
  let x=250+rng()*(W-300),y=108+rng()*(H-170),r=44+rng()*42;
  for(let n=0;n<16;n++){const blocked=F.blockers?.().some(o=>Math.hypot(x-o.x,y-o.y)<r*.35+(o.r||0)+10);if(!blocked)break;x=240+rng()*(W-290);y=108+rng()*(H-170)}
  const id=`v015-brush-${depth}-${index}`,patch={id,type:'grass',x:q(x),y:q(y),r:q(r),phase:rng()*Math.PI*2,active:true,cracked:false,cacheReleased:true,v015Forest:true};state.terrain.push(patch);forestPatches++;
  const blades=20+Math.floor(r/3.5);for(let i=0;i<blades;i++){const a=rng()*Math.PI*2,rr=Math.sqrt(rng())*r*.93;state.foliage.push({id:`${id}-${i}`,patchId:id,x:q(x+Math.cos(a)*rr),y:q(y+Math.sin(a)*rr),r:5,phase:rng()*Math.PI*2,cut:false,v015Forest:true,v015RegrowAt:0})}
}
function convertLegacyTerrain(){
  for(const p of state.terrain){if(p.v015Forest)continue;if(p.type==='water'||p.type==='ice')p.type=activeBiome.id==='burnscar'?'bramble':'grass';else if(p.type==='sand'||p.type==='shards')p.type=activeBiome.id==='burnscar'?'bramble':'mud';p.cacheReleased=true}
  const existing=new Set(state.foliage.map(f=>f.patchId));
  for(const p of state.terrain){if(p.type!=='grass'||existing.has(p.id))continue;const rng=rngFrom(hash(`v015-convert-${p.id}`)),count=14+Math.floor((p.r||40)/4);for(let i=0;i<count;i++){const a=rng()*Math.PI*2,rr=Math.sqrt(rng())*(p.r||40)*.88;state.foliage.push({id:`${p.id}-v015-${i}`,patchId:p.id,x:q(p.x+Math.cos(a)*rr),y:q(p.y+Math.sin(a)*rr),r:5,phase:rng()*Math.PI*2,cut:false,v015Forest:true,v015RegrowAt:0})}}
}
function applyRoom(){
  activeBiome=biomeForDepth();forestPatches=0;regrown=0;const depth=state.worldDepth||1;
  if(state.room){const names=TITLES[activeBiome.id];state.room.title=names[(depth-1)%names.length];state.room.subtitle=`${activeBiome.label.toLowerCase()} · carve visibility · survive the clearcut`}
  convertLegacyTerrain();const rng=rngFrom(hash(`v015-forest-${depth}-${activeBiome.id}`));for(let i=0;i<activeBiome.brush;i++)addBrushPatch(rng,depth,i);
  for(const e of state.enemies)e.v015Name=ENEMY_NAMES[e.type]||e.kineticType||e.type;
  document.documentElement.dataset.sylvariaBiome=activeBiome.id;document.documentElement.style.setProperty('--sylvaria-deep',activeBiome.deep);document.documentElement.style.setProperty('--sylvaria-ground',activeBiome.ground);document.documentElement.style.setProperty('--sylvaria-accent',activeBiome.accent);
  state.terrainCacheDirty=true;F.rebuildTerrainCache?.();F.updateHud?.(true);
}
const inheritedSetup=F.setupRoom;F.setupRoom=(...args)=>{const out=inheritedSetup(...args);applyRoom();return out};if(state.player&&state.room)applyRoom();
const inheritedMovement=F.updateMovement;F.updateMovement=dt=>{const out=inheritedMovement(dt);for(const f of state.foliage){if(f.cut&&f.v015RegrowAt>0&&state.roomTime>=f.v015RegrowAt){f.cut=false;f.v015RegrowAt=0;regrown++}}return out};

function drawPine(t,cedar=false){const r=t.r||24;ctx.fillStyle=cedar?'#3d3328':'#463223';ctx.fillRect(t.x-r*.12,t.y-r*.35,r*.24,r*1.3);for(let i=0;i<(cedar?4:3);i++){const y=t.y-r*(1.55-i*.42),w=r*(1.12+i*.19);ctx.fillStyle=i%2?activeBiome.leaf:`${activeBiome.leaf}e8`;ctx.beginPath();ctx.moveTo(t.x,y-r*.52);ctx.lineTo(t.x-w,y+r*.72);ctx.lineTo(t.x+w,y+r*.72);ctx.closePath();ctx.fill()}}
function drawOak(t,ancient=false){const r=t.r||24;ctx.save();ctx.translate(t.x,t.y);ctx.strokeStyle=ancient?'#51472d':'#533a28';ctx.lineCap='round';ctx.lineWidth=r*.34;ctx.beginPath();ctx.moveTo(0,r*.9);ctx.lineTo(0,-r*.58);ctx.stroke();ctx.lineWidth=r*.13;for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(0,-r*.18);ctx.lineTo(s*r*.58,-r*.74);ctx.stroke()}for(const [x,y,z] of[[-.55,-.7,.88],[.42,-.8,.92],[-.02,-1.14,1.0],[-.02,-.45,1.1]]){ctx.fillStyle=ancient?'#315a39':activeBiome.leaf;ctx.beginPath();ctx.arc(x*r,y*r,z*r*.68,0,Math.PI*2);ctx.fill()}if(ancient){ctx.strokeStyle='rgba(167,214,118,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-r*.1,-r*.45);ctx.quadraticCurveTo(r*.18,r*.2,r*.3,r*.9);ctx.stroke()}ctx.restore()}
function drawBurned(t){const r=t.r||24;ctx.save();ctx.translate(t.x,t.y);ctx.strokeStyle='#261c17';ctx.lineCap='round';ctx.lineWidth=r*.3;ctx.beginPath();ctx.moveTo(0,r*.9);ctx.lineTo(0,-r*1.12);ctx.stroke();ctx.lineWidth=r*.09;for(const [x,y] of[[-.72,-.92],[.62,-1.02],[-.5,-.42]]){ctx.beginPath();ctx.moveTo(0,-r*.35);ctx.lineTo(x*r,y*r);ctx.stroke()}ctx.restore()}
function drawTrees(){for(const t of state.trees){if(!t.alive)continue;if(activeBiome.id==='mist-pine')drawPine(t,false);else if(activeBiome.id==='cedar-gloom')drawPine(t,true);else if(activeBiome.id==='burnscar')drawBurned(t);else drawOak(t,activeBiome.id==='ancient-grove')}}
function brushRatio(p){const blades=state.foliage.filter(f=>f.patchId===p.id);return blades.length?blades.filter(f=>!f.cut).length/blades.length:0}
function drawBrushFog(){for(const p of state.terrain){if(!p.active||p.type!=='grass')continue;const ratio=brushRatio(p);if(ratio<.06)continue;const r=(p.r||45)*1.15,g=ctx.createRadialGradient(p.x,p.y,r*.15,p.x,p.y,r);g.addColorStop(0,`rgba(4,16,9,${.08+.14*ratio})`);g.addColorStop(.62,`rgba(7,25,13,${.11+.18*ratio})`);g.addColorStop(1,'rgba(4,13,8,0)');ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2)}}
function drawMist(){const t=state.roomTime||0;ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<5;i++){const x=((80+i*210+t*(7+i*1.4))%(W+260))-130,y=130+i*90+Math.sin(t*.22+i*1.7)*24,g=ctx.createRadialGradient(x,y,6,x,y,150);g.addColorStop(0,activeBiome.id==='burnscar'?'rgba(173,145,122,.055)':'rgba(176,211,197,.06)');g.addColorStop(1,'rgba(170,205,192,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,155,42,0,0,Math.PI*2);ctx.fill()}ctx.restore()}
function drawSignals(){ctx.save();ctx.globalCompositeOperation='screen';for(const e of state.enemies){if(e.dead||!['feller','foreman','lobbyist','skidder','chair','broker','mech','mulcher'].includes(e.type))continue;const r=['mech','mulcher'].includes(e.type)?48:28,g=ctx.createRadialGradient(e.x,e.y,2,e.x,e.y,r);g.addColorStop(0,'rgba(240,145,78,.22)');g.addColorStop(1,'rgba(210,100,52,0)');ctx.fillStyle=g;ctx.fillRect(e.x-r,e.y-r,r*2,r*2)}for(const item of state.pickups){if(item.dead)continue;const r=36,g=ctx.createRadialGradient(item.x,item.y,2,item.x,item.y,r);g.addColorStop(0,'rgba(225,255,174,.5)');g.addColorStop(1,'rgba(184,239,135,0)');ctx.fillStyle=g;ctx.fillRect(item.x-r,item.y-r,r*2,r*2)}ctx.restore()}
function draw(){ctx.clearRect(0,0,W,H);if(!state.room)return;ctx.save();ctx.globalAlpha=activeBiome.id==='burnscar' ? .31 : .25;ctx.fillStyle=activeBiome.ground;ctx.fillRect(0,0,W,H);ctx.restore();drawTrees();drawBrushFog();drawMist();drawSignals();const v=ctx.createRadialGradient(W*.5,H*.5,150,W*.5,H*.5,575);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.72,'rgba(0,0,0,.07)');v.addColorStop(1,'rgba(0,0,0,.52)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H)}
const inheritedRender=F.render;F.render=()=>{const out=inheritedRender?.();draw();return out};

window.SylvariaForestTheme=Object.freeze({version:FOREST_WORLD_VERSION,biomes:BIOMES,biome:()=>activeBiome,draw,snapshot:()=>({version:FOREST_WORLD_VERSION,biome:activeBiome.id,label:activeBiome.label,forestPatches,uncutFoliage:state.foliage.filter(f=>!f.cut).length,cutFoliage:state.foliage.filter(f=>f.cut).length,regrown})});
