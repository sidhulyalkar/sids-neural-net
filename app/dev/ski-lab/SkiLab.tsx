"use client";
import {useEffect,useRef} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {terrainHeight} from "@/lib/world/model";
import {refineMountainSnow} from "@/components/world/worldMountainHalfpipe";
import {SoleProbe,createTrial,inside,bankOffset} from "./fiveCarve";
import {EarlyEdgeController} from "./earlyEdge";
import {FlexibleSoles,type SoleDeformation} from "./flexibleSoles";
import {SKI_HALF_LENGTH,SKI_HALF_WIDTH,SKI_SOLE_Y,constrainSkiCamera} from "@/components/world/worldSkiContact";
import {neutral,SkiSimulation,tuning,type SkiInput} from "@/lib/world/ski/simulation";

export default function SkiLab(){
 const viewport=useRef<HTMLDivElement>(null);
 const status=useRef<HTMLOutputElement>(null);
 const actions=useRef({step:()=>{},pause:()=>{},replay:()=>{},camera:()=>{}});
 useEffect(()=>{
  if(!viewport.current)return;
  const host=viewport.current;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}
  catch{if(status.current)status.current.value="WebGL unavailable";return;}
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xbdd8e4);
  const camera=new THREE.PerspectiveCamera(48,1,.1,200);
  const orbit=new OrbitControls(camera,renderer.domElement);
  // Match the island mesh-refinement path instead of showing a coarse
  // interpolated surface while diagnostics sample the analytic heightfield.
  const terrain=new THREE.PlaneGeometry(40,60,44,66);
  terrain.rotateX(-Math.PI/2);terrain.translate(7,0,-47);
  const verts=terrain.attributes.position;
  for(let i=0;i<verts.count;i++)verts.setY(i,terrainHeight(verts.getX(i),verts.getZ(i)));
  terrain.setAttribute("color",new THREE.Float32BufferAttribute(new Float32Array(verts.count*3),3));
  refineMountainSnow(terrain);
  const snow=new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({color:0xeaf5fb,roughness:1,side:THREE.DoubleSide}));
  scene.add(snow);
  scene.add(new THREE.HemisphereLight(0xe9f5ff,0x8799ab,2));
  const sun=new THREE.DirectionalLight(0xffffff,2);
  sun.position.set(-12,28,8);scene.add(sun);
  const rig=new THREE.Group();
  const skiGeo=new THREE.BoxGeometry(2*SKI_HALF_WIDTH,.06,2*SKI_HALF_LENGTH);
  skiGeo.translate(0,SKI_SOLE_Y+.03,0);
  const bodyGeo=new THREE.CapsuleGeometry(.22,.65,4,8);
  const ink=new THREE.MeshBasicMaterial({color:0x162839,side:THREE.DoubleSide});
  const modeParam=new URLSearchParams(location.search).get("sole");
  const inspectView=new URLSearchParams(location.search).get("view")==="contact";
  const footprint=new URLSearchParams(location.search).has("footprint");
  const sideView=new URLSearchParams(location.search).get("view")==="side";
  const soleMode:SoleDeformation=footprint?"rigid":modeParam==="bounded"||modeParam==="surface"?modeParam:"rigid";
  const probe=new SoleProbe();
  const skis=probe.poses.map(()=>{const ski=new THREE.Mesh(skiGeo,ink);ski.visible=soleMode==="rigid";scene.add(ski);return ski;});
  const flex=new FlexibleSoles(soleMode,.3);
  flex.geometry.map(g=>{const ski=new THREE.Mesh(g,ink);ski.visible=soleMode!=="rigid";scene.add(ski);return ski;});
  const body=new THREE.Mesh(bodyGeo,ink);body.position.y=.75;rig.add(body);scene.add(rig);
  const bootGeo=new THREE.BoxGeometry(.17,.16,.33);
  const boneGeo=new THREE.CylinderGeometry(.075,.065,1,8);
  const jointUp=new THREE.Vector3(0,1,0),hip=new THREE.Vector3(),ankle=new THREE.Vector3(),knee=new THREE.Vector3(),boneAxis=new THREE.Vector3();
  const landingLegs=skis.map(()=>{
   const boot=new THREE.Mesh(bootGeo,ink),thigh=new THREE.Mesh(boneGeo,ink),shin=new THREE.Mesh(boneGeo,ink);
   scene.add(boot,thigh,shin);
   return {boot,thigh,shin};
  });
  function placeBone(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3){
   boneAxis.subVectors(b,a);mesh.scale.y=boneAxis.length();
   mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(jointUp,boneAxis.normalize());
  }
  const query=new URLSearchParams(location.search);
  const trial=query.has("five-carve");
  const leadParam=Number(query.get("early-lead")??0);
  const lead=Number.isFinite(leadParam)?Math.min(bankOffset-.1,Math.max(0,leadParam)):0;
  const captureTick=Number(query.get("capture-tick"));
  const make=()=>{if(trial)return createTrial(footprint);const s=new SkiSimulation(terrainHeight,7,-57,footprint);s.velocity.set(4,0,4);return s;};
  let controller=new EarlyEdgeController(lead),trialTime=0;
  let sim=make(),paused=false,replaying=false,follow=!inspectView;
  const trace:SkiInput[]=[];
  const keys=new Set<string>();
  const supported=["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","KeyA","KeyD","KeyW","KeyS","KeyQ","KeyE","Space","ShiftLeft","ShiftRight"];
  const key=(e:KeyboardEvent)=>{
   if(!supported.includes(e.code))return;
   e.preventDefault();
   if(e.type==="keydown")keys.add(e.code);else keys.delete(e.code);
  };
  const clear=()=>keys.clear();
  const read=(tick:number)=>{
   if(replaying)return trace[tick]??neutral;
   if(trial){const input=controller.input(sim);trace[tick]=input;return input;}
   const left=keys.has("KeyA")||keys.has("ArrowLeft"),right=keys.has("KeyD")||keys.has("ArrowRight");
   const tuck=keys.has("KeyW")||keys.has("ArrowUp"),brake=keys.has("KeyS")||keys.has("ArrowDown");
   const input={steer:Number(right)-Number(left),pitch:Number(tuck)-Number(brake),tuck,brake,
    roll:Number(keys.has("KeyE"))-Number(keys.has("KeyQ")),jump:keys.has("Space"),grab:keys.has("ShiftLeft")||keys.has("ShiftRight")};
   trace[tick]=input;return input;
  };
  host.addEventListener("keydown",key);host.addEventListener("keyup",key);host.addEventListener("blur",clear);
  const advance=(dt:number)=>{
   if(replaying)dt=Math.min(dt,Math.max(0,(trace.length-sim.tick)*tuning.dt-sim.remainder));
   // Bound live recording to three minutes; keep the entire trace replayable.
   const capacity=180/tuning.dt;
   if(!replaying)dt=Math.min(dt,Math.max(0,(capacity-sim.tick)*tuning.dt-sim.remainder));
   if(trial){
    trialTime+=dt;
    while(trialTime+1e-12>=tuning.dt){
     sim.advance(tuning.dt,read);trialTime=Math.max(0,trialTime-tuning.dt);
     controller.observe(sim);
     if(!inside(sim.position.x,sim.position.z)||controller.visits===6||sim.tick>=3600||sim.tick===captureTick){paused=true;break;}
    }
   }else sim.advance(dt,read);
   if(!replaying&&sim.tick>=capacity)paused=true;
   if(replaying&&sim.tick>=trace.length)paused=true;
  };
  // Recreate a diagnostic frame from tick zero without tying physics progress
  // to slow software-WebGL frame cadence. This never changes live skiing.
  if(trial&&Number.isSafeInteger(captureTick)&&captureTick>0){
   while(sim.tick<captureTick&&inside(sim.position.x,sim.position.z)&&controller.visits<6){
    const input=read(sim.tick);
    sim.advance(tuning.dt,()=>input);
    controller.observe(sim);
   }
   paused=true;
  }
  actions.current={step:()=>{paused=true;advance(tuning.dt);},pause:()=>{paused=!paused;host.focus();},
   replay:()=>{controller=new EarlyEdgeController(lead);trialTime=0;sim=make();replaying=true;paused=false;},camera:()=>{follow=!follow;orbit.enabled=!follow;}};
  const resize=new ResizeObserver(()=>{
   renderer.setSize(host.clientWidth,host.clientHeight);
   camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();
  });resize.observe(host);
  const direction=new THREE.Vector3(0,0,1),offset=new THREE.Vector3();
  const cameraLook=new THREE.Vector3(),bodyCenter=new THREE.Vector3();
  const projected=new THREE.Vector3(),tip=new THREE.Vector3(),visibilityDirection=new THREE.Vector3();
  const ray=new THREE.Raycaster();
  const snowHeight=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);
  const velocity=new THREE.ArrowHelper(direction,sim.position,1,0x005bc0);
  const normal=new THREE.ArrowHelper(direction,sim.position,1,0x00934e);
  scene.add(velocity,normal);
  let last=performance.now(),lastHud=0;
  renderer.setAnimationLoop((time:number)=>{
   const frameSeconds=Math.max(0,time-last)/1000;
   if(!paused)advance(frameSeconds);
   last=time;
   rig.position.copy(sim.position);
   const rigidGaps=probe.update(sim);
   skis.forEach((ski,i)=>{ski.position.copy(probe.poses[i].position);ski.quaternion.copy(probe.poses[i].rotation);});
   const gaps=soleMode==="rigid"?rigidGaps:flex.update(sim);
   if(trial&&(!inside(sim.position.x,sim.position.z)||controller.visits>=6))paused=true;
   rig.quaternion.copy(sim.rotation);body.scale.y=sim.grab?.65:1-.35*sim.charge/tuning.maxCharge;
   landingLegs.forEach(({boot,thigh,shin},i)=>{
    const pose=probe.poses[i];
    boot.position.set(0,.13,0).applyQuaternion(pose.rotation).add(pose.position);
    boot.quaternion.copy(pose.rotation);
    ankle.copy(boot.position);
    hip.set(i===0?-.16:.16,.68-.18*sim.charge/tuning.maxCharge,0).applyQuaternion(sim.rotation).add(sim.position);
    knee.copy(ankle).lerp(hip,.5).add(boneAxis.set(0,0,.13+.12*sim.charge/tuning.maxCharge).applyQuaternion(sim.rotation));
    placeBone(thigh,hip,knee);placeBone(shin,knee,ankle);
   });
   velocity.position.copy(rig.position);normal.position.copy(rig.position);
   velocity.setLength(Math.max(.01,sim.velocity.length()*.3));normal.setDirection(sim.normal);
   if(sim.velocity.lengthSq()>.001)velocity.setDirection(offset.copy(sim.velocity).normalize());
   if(sideView){
    cameraLook.copy(sim.position);cameraLook.y+=.35;
    offset.set(1,0,0).applyQuaternion(sim.rotation);
    offset.y=0;offset.normalize();
    if(offset.x*(sim.position.x-7)>0)offset.negate();
    camera.position.copy(cameraLook).addScaledVector(offset,3.5);
    camera.lookAt(cameraLook);
   }else if(inspectView){
    // Physical-contact QA uses an inward, elevated angle, not a blinded
    // tangent view through the near halfpipe wall.
    camera.position.set(rig.position.x+(rig.position.x>=7?-4.5:4.5),
     rig.position.y+4,rig.position.z+5.5);
    camera.position.y=Math.max(camera.position.y,terrainHeight(camera.position.x,camera.position.z)+1);
    cameraLook.copy(rig.position);cameraLook.y+=.6;
    constrainSkiCamera(cameraLook,camera.position,snowHeight);
    camera.lookAt(cameraLook);
   }else if(follow){
    offset.copy(sim.velocity);offset.y=0;if(offset.lengthSq()>.01)direction.lerp(offset.normalize(),1-Math.exp(-4*frameSeconds)).normalize();
    camera.position.copy(rig.position).addScaledVector(direction,-7);camera.position.y+=4;
    cameraLook.copy(rig.position);cameraLook.y+=.6;
    constrainSkiCamera(cameraLook,camera.position,snowHeight);
    camera.lookAt(cameraLook);
   }
   renderer.render(scene,camera);
   // Visibility is an acceptance condition, not inferred from successful
   // screenshot creation or finite camera coordinates.
   body.getWorldPosition(bodyCenter);
   projected.copy(bodyCenter).project(camera);
   const framed=Math.abs(projected.x)<.85&&Math.abs(projected.y)<.85&&projected.z>-1&&projected.z<1;
   visibilityDirection.copy(bodyCenter).sub(camera.position);
   const sightLength=visibilityDirection.length();
   ray.set(camera.position,visibilityDirection.multiplyScalar(1/Math.max(.001,sightLength)));
   ray.near=.02;ray.far=Math.max(.02,sightLength-.12);
   const blocked=ray.intersectObject(snow,false).length>0;
   let skisFramed=true;
   for(const pose of probe.poses)for(const sign of [-1,1]){
    tip.set(0,SKI_SOLE_Y,sign*SKI_HALF_LENGTH).applyQuaternion(pose.rotation).add(pose.position).project(camera);
    skisFramed&&=Math.abs(tip.x)<.92&&Math.abs(tip.y)<.92&&tip.z>-1&&tip.z<1;
   }
   renderer.domElement.dataset.skierVisible=String(framed&&!blocked);
   renderer.domElement.dataset.skierOccluded=String(blocked);
   renderer.domElement.dataset.skisFramed=String(skisFramed);
   renderer.domElement.dataset.skierScreen=projected.x.toFixed(3)+","+projected.y.toFixed(3);
   if(trial&&paused)renderer.domElement.dataset.captureTick=String(sim.tick);
   if(status.current&&time-lastHud>100){
    const flexStats=soleMode==="rigid"?"":` · max bend ${flex.metrics.map(g=>g.maxVerticalBend.toFixed(2)).join("/")} · curvature ${flex.metrics.map(g=>g.maxCurvature.toFixed(2)).join("/")}`;
    status.current.value=`Tick ${sim.tick} · ${sim.phase} · speed ${sim.velocity.length().toFixed(2)} · L/R contact ${sim.contact.map(Number).join("/")} · visits ${controller.visits}/6 · lead ${lead.toFixed(1)} · sole ${soleMode} · L/R max gap ${gaps.map(g=>g.max.toFixed(2)).join("/")}${flexStats} · landing ${sim.landing} · impact ${sim.impact.toFixed(2)}`;
    lastHud=time;
   }
  });
  host.focus();
  return ()=>{
   renderer.setAnimationLoop(null);resize.disconnect();orbit.dispose();velocity.dispose();normal.dispose();
   bootGeo.dispose();boneGeo.dispose();terrain.dispose();snow.material.dispose();skiGeo.dispose();bodyGeo.dispose();ink.dispose();flex.dispose();renderer.dispose();
   renderer.domElement.remove();host.removeEventListener("keydown",key);host.removeEventListener("keyup",key);host.removeEventListener("blur",clear);
  };
 },[]);
 return <main><h1>Ski physics lab</h1><p>A/D steer or spin · W/S tuck or brake, pitch in air · Q/E roll · hold and release Space to jump · Shift to grab. For the controlled comparison use /dev/ski-lab?five-carve&amp;early-lead=1.5; zero lead preserves the original V3-1 input timing. Add &amp;sole=rigid|bounded|surface to compare sole models; the surface option is a diagnostic upper bound, not a physically qualified ski.</p>
 <div ref={viewport} tabIndex={0} aria-label="Ski simulation" style={{height:"60vh"}}/>
 <div>{(["pause","step","replay","camera"] as const).map((action,i)=><button key={action} onClick={()=>actions.current[action]()}>{["Pause / resume","Step one tick","Replay inputs","Follow / orbit"][i]}</button>)}</div>
 <output ref={status}/></main>;
}
