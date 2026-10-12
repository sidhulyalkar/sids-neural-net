import * as THREE from "three/src/Three.Core.js";
import {groundHeight,type Activity} from "@/lib/world/activities";
import {RIDE_BOOST_TARGETS,type RideBoost,canFireRideBoost,
 type RideBoostTarget} from "@/lib/world/rideBoost";
import {JOSHUA_GHOSTS,joshuaGhostPose} from "@/lib/world/joshuaGhostRace";
import type {TrialState} from "@/lib/world/trials";
import type {Point} from "@/lib/world/model";

/** Pooled meshes: no allocations of WebGL objects inside the update loop.
 * Ghosts are intentionally translucent non-colliding pace riders. */
export function createRideChallengeGeometry(scene:THREE.Scene){
 const root=new THREE.Group();root.name="Joshua ghost riders and ride skill-shot rings";
 scene.add(root);
 const targetMat=new THREE.MeshBasicMaterial({color:"#baf4ca",transparent:true,
  opacity:.84,depthWrite:false,side:THREE.DoubleSide});
 const targetInactive=new THREE.MeshBasicMaterial({color:"#899ba1",transparent:true,
  opacity:.25,depthWrite:false});
 const coreMat=new THREE.MeshBasicMaterial({color:"#ffeb9d",transparent:true,
  opacity:.9,depthWrite:false});
 const ringGeo=new THREE.TorusGeometry(.94,.14,7,24);
 const coreGeo=new THREE.SphereGeometry(.68,10,8);
 const haloGeo=new THREE.TorusGeometry(1.24,.027,4,24);
 const tracerGeo=new THREE.BufferGeometry();
 tracerGeo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(6),3));
 const tracerMat=new THREE.LineBasicMaterial({color:"#f5efad",transparent:true,
  opacity:.95,depthWrite:false,depthTest:false});
 const tracer=new THREE.Line(tracerGeo,tracerMat);
 tracer.visible=false;tracer.renderOrder=80;root.add(tracer);
 let shotUntil=0;
 const aimVector=new THREE.Vector3();
 const targets=RIDE_BOOST_TARGETS.map(target=>{
  const group=new THREE.Group();group.name="skill-shot-"+target.id;
  group.position.set(target.point.x,groundHeight(target.point)+2.9,target.point.z);
  const ring=new THREE.Mesh(ringGeo,targetMat);
  const core=new THREE.Mesh(coreGeo,coreMat);
  const halo=new THREE.Mesh(haloGeo,targetMat);
  group.add(ring,core,halo);root.add(group);
  // Only the core is shot-sensitive, so clicking blank space inside a halo
  // cannot grant a reward. Hitbox is generous enough for touch.
  core.userData.boostTargetId=target.id;
  return {target,group,ring,core,halo};
 });
 const wheelGeo=new THREE.TorusGeometry(.36,.09,6,12);
 const frameGeo=new THREE.BoxGeometry(.18,.19,1.6);
 const torsoGeo=new THREE.CapsuleGeometry(.22,.44,3,6);
 const headGeo=new THREE.SphereGeometry(.22,8,6);
 const ghostMaterials=JOSHUA_GHOSTS.map((ghost,i)=>
  new THREE.MeshBasicMaterial({color:i===0?"#f0ae73":"#9dc8ec",
   transparent:true,opacity:.55,depthWrite:false}));
 const ghosts=JOSHUA_GHOSTS.map((ghost,i)=>{
  const group=new THREE.Group();group.name="ghost-"+ghost.id;
  const mat=ghostMaterials[i];
  for(const z of [-.57,.57]){
   const wheel=new THREE.Mesh(wheelGeo,mat);
   wheel.position.set(0,.46,z);wheel.rotation.y=Math.PI/2;group.add(wheel);
  }
  const frame=new THREE.Mesh(frameGeo,mat);frame.position.y=.8;group.add(frame);
  const body=new THREE.Mesh(torsoGeo,mat);body.position.set(0,1.33,-.12);
  body.rotation.x=.42;group.add(body);
  const head=new THREE.Mesh(headGeo,mat);head.position.set(0,1.88,-.39);
  group.add(head);root.add(group);
  return {ghost,group};
 });
 return {
  targets:targets.map(t=>t.core),
  fireTracer(from:THREE.Vector3,to:THREE.Vector3,now:number){
    const positions=tracerGeo.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0,from.x,from.y,from.z);
    positions.setXYZ(1,to.x,to.y,to.z);
    positions.needsUpdate=true;
    tracer.visible=true;shotUntil=now+.17;
  },
  updateTracer(now:number){tracer.visible=now<shotUntil;},
  /** Read-only camera projection for browser acceptance and aim accessibility. */
  visibleAimTarget(mode:Activity,player:Point,speed:number,now:number,
   state:RideBoost,camera:THREE.Camera):{id:string;x:number;y:number}|null{
   let best:{id:string;x:number;y:number}|null=null;
   let bestDistance=Infinity;
   for(const {target,group} of targets){
    if(!group.visible||!canFireRideBoost(target,mode,player,speed,now,state))continue;
    aimVector.copy(group.position).project(camera);
    if(aimVector.z<0||aimVector.z>1||
      Math.abs(aimVector.x)>.87||Math.abs(aimVector.y)>.85)continue;
    const d=aimVector.x*aimVector.x+aimVector.y*aimVector.y;
    if(d<bestDistance){best={id:target.id,x:aimVector.x,y:aimVector.y};
     bestDistance=d;}
   }
   return best;
  },
  targetFromHit(object:THREE.Object3D):RideBoostTarget|null{
   const id=object.userData.boostTargetId;
   return RIDE_BOOST_TARGETS.find(t=>t.id===id)??null;
  },
  updateTargets(mode:Activity,player:Point,speed:number,now:number,
   state:RideBoost,camera:THREE.Camera,enabled:boolean){
   for(const {target,group,ring,halo,core} of targets){
    const distance=Math.hypot(target.point.x-player.x,target.point.z-player.z);
    group.visible=enabled&&target.activity===mode&&distance<55;
    if(!group.visible)continue;
    const charged=canFireRideBoost(target,mode,player,speed,now,state);
    ring.material=halo.material=charged?targetMat:targetInactive;
    core.material=charged?coreMat:targetInactive;
    group.quaternion.copy(camera.quaternion);
    group.scale.setScalar(1+.055*Math.sin(now*3+target.point.x));
   }
  },
  updateGhosts(state:TrialState){
   const enabled=state.phase==="armed"||state.phase==="running"||
    state.phase==="complete";
   for(const {ghost,group} of ghosts){
    group.visible=enabled;
    if(!enabled)continue;
    const pose=joshuaGhostPose(state.phase==="armed"?0:state.elapsedMs,ghost);
    group.position.set(pose.point.x,groundHeight(pose.point)+.12,pose.point.z);
    group.rotation.y=pose.heading;
   }
  },
  dispose(){
   root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
   // Target geometry is shared; double-disposing a Three geometry is safe but
   // use a single disposal path for each shared resource.
   [targetMat,targetInactive,coreMat,tracerMat,...ghostMaterials].forEach(m=>m.dispose());
   scene.remove(root);
  }
 };
}
