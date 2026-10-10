import * as THREE from "three/src/Three.Core.js";
import {DISC_GOLF_HOLES,discGolfBasketPosition,type DiscGolfState} from "@/lib/world/discGolf";
import {terrainHeight} from "@/lib/world/model";

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
 beacon.name="disc-golf-lie-light";
 const update=(game:DiscGolfState)=>{
  const active=game.phase!=="off";
  root.visible=disc.visible=active;
  beacon.visible=game.phase==="landed";
  if(!active)return;
  const basket=discGolfBasketPosition(DISC_GOLF_HOLES[game.holeIndex],game.clock);
  root.position.set(basket.x,terrainHeight(basket.x,basket.z),basket.z);
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
 return {update,dispose(){
  scene.remove(root,disc,beacon);
  poleGeo.dispose();chainGeo.dispose();ringGeo.dispose();coneGeo.dispose();
  discGeo.dispose();rimGeo.dispose();beamGeo.dispose();
  chains.dispose();materials.forEach(m=>m.dispose());
 },drawCalls:8};
}
