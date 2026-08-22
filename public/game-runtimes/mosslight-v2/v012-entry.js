import'./v011-entry.js';
import{createPondRenderer}from'./v012/webgl-pond-v012.js';

const G=window.Sylvaria091,F=G.fn,state=G.state,$=G.$,PRESENTATION='0.12.0',ENGINE='0.11.1';
const renderer=createPondRenderer(G),legacyRender=F.render,baseHud=F.updateHud;
let tonguePulses=0,lastTongue=null;
const hints=[
  'Move first. Tongue-slap incoming attacks back.','Use the reeds for cover and open space for returns.','Mud slows everything. Pick your line.','Shallow water changes the pace.','Keep moving when the pond closes in.',
  'Open side paths when the center gets crowded.','Dense reeds hide useful routes.','Break only the cover you need.','Use the crossing, then make room.','Read the large insect before committing.',
  'Fast bugs now overlap with ranged pressure.','Water lanes reward clean angles.','Use roots and banks to split the swarm.','Dark ground makes attack tells more important.','Mixed surfaces punish automatic movement.',
  'Poison can hurt insects too.','Do not clear every obstacle immediately.','Open one safe lane before chasing damage.','The pond is dense. Prioritize the nearest threat.','Survive the pattern, then punish.',
  'Open ground means fewer safe mistakes.','Use remaining cover to break crossfire.','Do not dash onto slick ground without an exit.','Create a lane before the next wave.','Landing space is part of the fight.',
  'Hazards and aggressive bugs can solve each other.','Commit only when you know the next tile.','The maze rewards deliberate movement.','Nearly every insect role appears here.','Final fixed pond. Read, reflect, survive.'
];

F.render=()=>{
  const tongue=state.slashes?.[state.slashes.length-1]||null;
  if(tongue&&tongue!==lastTongue){lastTongue=tongue;tonguePulses++}
  if(renderer.ready){
    if(state.terrainCacheDirty)F.rebuildTerrainCache?.();
    if(renderer.render())return;
  }
  legacyRender?.();
};

F.updateHud=(force=false)=>{
  baseHud?.(force);
  if(!state.player||!state.room)return;
  const depth=String(state.worldDepth).padStart(2,'0');
  $('roomKicker').textContent=`${depth} / pond`;
  $('roomTitle').textContent=renderer.displayRoomName(state.worldDepth);
  $('roomTask').textContent=hints[(state.worldDepth-1)%hints.length]||'Read the room. Move, slap, reflect.';
  const treeLabel=document.querySelector('#runRail>div:first-child b');if(treeLabel)treeLabel.textContent='lilies';
  const field=$('fieldState');if(field&&field.textContent==='none')field.textContent='clear';
};

for(const id of['start','explore'])$(id)?.addEventListener('click',()=>queueMicrotask(()=>{const t=$('toast');if(t)t.textContent='WASD move · arrows tongue-slap / reflect'}));

const playtest=window.__MOSSLIGHT_PLAYTEST__;
if(playtest){
  const base=playtest.snapshot.bind(playtest);playtest.presentationVersion=PRESENTATION;
  playtest.snapshot=()=>{const snap=base();return{...snap,presentationVersion:PRESENTATION,visual:{...(snap.visual||{}),presentationVersion:PRESENTATION,frogPond:true,webgl2Pond:renderer.ready,tongueAttack:true,insectEnemies:true,pondEnvironment:true,renderMode:renderer.snapshot().mode,tonguePulses}}};
}
const visual=window.SylvariaVisualSystem;
if(visual){const base=visual.snapshot.bind(visual);visual.presentationVersion=PRESENTATION;visual.snapshot=()=>({...base(),presentationVersion:PRESENTATION,frogPond:true,webgl2Pond:renderer.ready,tongueAttack:true,insectEnemies:true,pondEnvironment:true,renderMode:renderer.snapshot().mode,tonguePulses})}
window.Sylvaria012=G;
window.SylvariaPondRenderer=renderer;
window.SylvariaPresentation012=Object.freeze({version:PRESENTATION,engineVersion:ENGINE,roomName:renderer.displayRoomName,get tonguePulses(){return tonguePulses}});
