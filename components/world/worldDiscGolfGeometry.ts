import * as THREE from "three/src/Three.Core.js";
import {
 DISC_GOLF_HOLES,discGolfBasketPosition,discGolfNextTarget,traceDiscGolfShot,
 type DiscGolfState,type DiscShot,type DiscGolfObstacle,
} from "@/lib/world/discGolf";
import {terrainHeight,isWater,SEA_SURFACE} from "@/lib/world/model";

/** One active target and one disc. No imported models or shader/postprocessing.
 * Chains are one instanced mesh; beacon is visible only at a valid land lie. */
export function createDiscGolfGeometry(scene:THREE.Scene){
 const root=new THREE.Group();root.name="disc-golf-active-target";scene.add(root);
 const poleGeo=new THREE.CylinderGeometry(.065,.065,2.1,8);
 const chainGeo=new THREE.CylinderGeometry(.019,.019,1.04,5);
 const ringGeo=new THREE.TorusGeometry(.72,.055,6,24);
 const coneGeo=new THREE.ConeGeometry(.62,.38,16,1,true);
 const discGeo=new THREE.CylinderGeometry(.24,.25,.055,18);
 const rimGeo=new THREE.TorusGeometry(.243,.035,5,22);
 const beamGeo=new THREE.CylinderGeometry(.13,.24,10,10,1,true);
 const materials=[
  new THREE.MeshStandardMaterial({color:"#787f80",metalness:.57,roughness:.31}),
  new THREE.MeshStandardMaterial({color:"#d8c28d",metalness:.47,roughness:.36}),
  new THREE.MeshStandardMaterial({color:"#ec8344",metalness:.05,roughness:.48}),
  new THREE.MeshBasicMaterial({color:"#e1c878",transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide}),
 ];
 const [steel,gold,plastic,glow]=materials;
 // One clearly readable glowing mandatory gate. Three lightweight meshes;
 // a single active gate is rendered at any time.
 const gateRoot=new THREE.Group();gateRoot.name="disc-golf-next-mandatory-gate";
 scene.add(gateRoot);
 const gateMat=new THREE.MeshStandardMaterial({color:"#ffcc6e",emissive:"#f7ad42",
  emissiveIntensity:.8,metalness:.1,roughness:.35});
 const postGeo=new THREE.CylinderGeometry(.13,.13,10,7);
 const topGeo=new THREE.CylinderGeometry(.16,.16,1,7);
 const posts=[-1,1].map(side=>{
  const p=new THREE.Mesh(postGeo,gateMat);gateRoot.add(p);return p;
 });
 const topBar=new THREE.Mesh(topGeo,gateMat);gateRoot.add(topBar);

 const pole=new THREE.Mesh(poleGeo,steel);pole.position.y=1.02;root.add(pole);
 const rim=new THREE.Mesh(ringGeo,gold);rim.rotation.x=Math.PI/2;rim.position.y=1.04;root.add(rim);
 const upper=new THREE.Mesh(ringGeo,steel);upper.rotation.x=Math.PI/2;upper.position.y=2.00;root.add(upper);
 const canopy=new THREE.Mesh(coneGeo,plastic);canopy.position.y=2.16;root.add(canopy);
 const chainCount=12,chains=new THREE.InstancedMesh(chainGeo,steel,chainCount);
 root.add(chains);
 const dummy=new THREE.Object3D();
 for(let i=0;i<chainCount;i++){
  const a=i*Math.PI*2/chainCount;
  dummy.position.set(Math.cos(a)*.47,1.54,Math.sin(a)*.47);
  dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();
  chains.setMatrixAt(i,dummy.matrix);
 }
 chains.instanceMatrix.needsUpdate=true;
 const disc=new THREE.Group();scene.add(disc);
 const body=new THREE.Mesh(discGeo,plastic);disc.add(body);
 const discRim=new THREE.Mesh(rimGeo,gold);discRim.rotation.x=Math.PI/2;disc.add(discRim);
 const beacon=new THREE.Mesh(beamGeo,glow);beacon.visible=false;scene.add(beacon);
 const pathGeometry=new THREE.BufferGeometry();
 const pathBuffer=new Float32Array(96*3);
 pathGeometry.setAttribute("position",new THREE.BufferAttribute(pathBuffer,3).setUsage(THREE.DynamicDrawUsage));
 pathGeometry.setDrawRange(0,0);
 const guideMat=new THREE.LineBasicMaterial({color:"#f1d9a0",transparent:true,
   opacity:.52,depthWrite:false});
 const guide=new THREE.Line(pathGeometry,guideMat);
 guide.name="disc-golf-estimated-flight";guide.frustumCulled=false;
 guide.visible=false;scene.add(guide);
 const ringMat=new THREE.MeshBasicMaterial({color:"#e7c987",
  transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide});
 const ring=new THREE.Mesh(ringGeo,ringMat);
 ring.name="disc-golf-estimated-landing";ring.rotation.x=Math.PI/2;
 ring.visible=false;scene.add(ring);
 // A subtle, collision-free tee circle makes the starting lie unambiguous.
 // It is separate from the basket and disappears after the first throw.
 const teeMarker=new THREE.Mesh(ringGeo,gold);
 teeMarker.name="disc-golf-tee";teeMarker.rotation.x=Math.PI/2;
 teeMarker.scale.setScalar(1.65);teeMarker.visible=false;scene.add(teeMarker);
 const updatePreview=(state:DiscGolfState,shot:DiscShot|null,
   obstacles:readonly DiscGolfObstacle[])=>{
   const allowed=state.phase==="ready"||state.phase==="landed"||state.phase==="water";
   if(!shot||!allowed){guide.visible=ring.visible=false;return;}
   const trace=traceDiscGolfShot(state,{...shot,accuracy:0},
     p=>terrainHeight(p.x,p.z),isWater,SEA_SURFACE,obstacles);
   const count=Math.min(trace.points.length,96);
   for(let i=0;i<count;i++){
     const p=trace.points[i];
     pathBuffer[3*i]=p.x;pathBuffer[3*i+1]=p.y+.08;pathBuffer[3*i+2]=p.z;
   }
   pathGeometry.attributes.position.needsUpdate=true;
   pathGeometry.setDrawRange(0,count);
   guide.visible=count>1;
   ring.visible=trace.outcome==="landed";
   if(ring.visible){
     ring.position.set(trace.end.x,terrainHeight(trace.end.x,trace.end.z)+.11,trace.end.z);
     ring.scale.setScalar(.72);
   }
 };
 beacon.name="disc-golf-lie-light";
 const update=(game:DiscGolfState)=>{
  const active=game.phase!=="off";
  root.visible=disc.visible=active;
  const hole=DISC_GOLF_HOLES[game.holeIndex];
  const gate=hole.gates[game.gatesCleared];
  gateRoot.visible=active&&!!gate;
  if(gateRoot.visible&&gate){
   const point=gate.point;
   const groundY=terrainHeight(point.x,point.z);
   gateRoot.position.set(point.x,groundY,point.z);
   const prev=game.gatesCleared===0?hole.tee:
    hole.gates[game.gatesCleared-1].point;
   const dir=Math.atan2(point.x-prev.x,point.z-prev.z);
   gateRoot.rotation.y=dir;
   const side=gate.radius;
   posts[0].position.set(-side,5,0);
   posts[1].position.set(side,5,0);
   topBar.position.set(0,10,0);
   topBar.scale.y=side*2;
   topBar.rotation.z=Math.PI/2;
  }
  teeMarker.visible=game.phase==="ready";
  beacon.visible=game.phase==="landed";
  if(!active)return;
  const basket=discGolfBasketPosition(DISC_GOLF_HOLES[game.holeIndex],game.clock);
  root.position.set(basket.x,terrainHeight(basket.x,basket.z),basket.z);
  if(teeMarker.visible){
   const tee=DISC_GOLF_HOLES[game.holeIndex].tee;
   teeMarker.position.set(tee.x,terrainHeight(tee.x,tee.z)+.1,tee.z);
  }
  const t=game.phase==="holed"&&game.resultAt!==undefined?
    Math.max(0,game.clock-game.resultAt):Infinity;
  chains.rotation.z=Number.isFinite(t)?Math.sin(t*20)*Math.exp(-t*3)*.16:0;
  chains.rotation.x=Number.isFinite(t)?Math.cos(t*17)*Math.exp(-t*3)*.08:0;
  disc.position.set(game.disc.x,game.disc.y,game.disc.z);
  disc.rotation.z=game.phase==="flying"
    ?Math.sin(game.flightTime*14)*.13:0;
  disc.rotation.y=game.phase==="flying"?game.flightTime*14:0;
  if(beacon.visible){
   beacon.position.set(game.lie.x,terrainHeight(game.lie.x,game.lie.z)+5,game.lie.z);
  }
 };
 update({phase:"off",holeIndex:0,lie:{x:0,z:0},disc:{x:0,y:0,z:0},
  velocity:{x:0,y:0,z:0},strokes:0,waterRedos:0,flightTime:0,clock:0,
  lockedWind:{x:0,z:0,speed:0},lastDistance:0,spin:0});
 return {update,updatePreview,dispose(){
  scene.remove(root,disc,beacon,guide,ring,teeMarker,gateRoot);
  pathGeometry.dispose();guideMat.dispose();ringMat.dispose();
  poleGeo.dispose();chainGeo.dispose();ringGeo.dispose();coneGeo.dispose();
  discGeo.dispose();rimGeo.dispose();beamGeo.dispose();
  chains.dispose();postGeo.dispose();topGeo.dispose();gateMat.dispose();materials.forEach(m=>m.dispose());
 },drawCalls:14};
}
