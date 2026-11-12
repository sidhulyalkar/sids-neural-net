"use client";
import {useEffect,useRef} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {terrainHeight} from "@/lib/world/model";
import {SoleProbe,createTrial,inside,bankOffset} from "./fiveCarve";
import {EarlyEdgeController} from "./earlyEdge";
import {FlexibleSoles,type SoleDeformation} from "./flexibleSoles";
import {SKI_HALF_LENGTH,SKI_HALF_WIDTH,SKI_SOLE_Y} from "@/components/world/worldSkiContact";
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
  const terrain=new THREE.PlaneGeometry(40,60,120,180);
  terrain.rotateX(-Math.PI/2);terrain.translate(7,0,-47);
  const verts=terrain.attributes.position;
  for(let i=0;i<verts.count;i++)verts.setY(i,terrainHeight(verts.getX(i),verts.getZ(i)));
  terrain.computeVertexNormals();
  const snow=new THREE.Mesh(terrain,new THREE.MeshNormalMaterial());
  scene.add(snow);
  const rig=new THREE.Group();
  const skiGeo=new THREE.BoxGeometry(2*SKI_HALF_WIDTH,.06,2*SKI_HALF_LENGTH);
  skiGeo.translate(0,SKI_SOLE_Y+.03,0);
  const bodyGeo=new THREE.CapsuleGeometry(.22,.65,4,8);
  const ink=new THREE.MeshBasicMaterial({color:0x162839,side:THREE.DoubleSide});
  const modeParam=new URLSearchParams(location.search).get("sole");
  const soleMode:SoleDeformation=modeParam==="bounded"||modeParam==="surface"?modeParam:"rigid";
  const probe=new SoleProbe();
  const skis=probe.poses.map(()=>{const ski=new THREE.Mesh(skiGeo,ink);ski.visible=soleMode==="rigid";scene.add(ski);return ski;});
  const flex=new FlexibleSoles(soleMode,.3);
  flex.geometry.map(g=>{const ski=new THREE.Mesh(g,ink);ski.visible=soleMode!=="rigid";scene.add(ski);return ski;});
  const body=new THREE.Mesh(bodyGeo,ink);body.position.y=.75;rig.add(body);scene.add(rig);
  const query=new URLSearchParams(location.search);
  const trial=query.has("five-carve");
  const leadParam=Number(query.get("early-lead")??0);
  const lead=Number.isFinite(leadParam)?Math.min(bankOffset-.1,Math.max(0,leadParam)):0;
  const captureTick=Number(query.get("capture-tick"));
  const make=()=>{if(trial)return createTrial();const s=new SkiSimulation(terrainHeight,7,-57);s.velocity.set(4,0,4);return s;};
  let controller=new EarlyEdgeController(lead),trialTime=0;
  let sim=make(),paused=false,replaying=false,follow=true;
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
  actions.current={step:()=>{paused=true;advance(tuning.dt);},pause:()=>{paused=!paused;host.focus();},
   replay:()=>{controller=new EarlyEdgeController(lead);trialTime=0;sim=make();replaying=true;paused=false;},camera:()=>{follow=!follow;orbit.enabled=!follow;}};
  const resize=new ResizeObserver(()=>{
   renderer.setSize(host.clientWidth,host.clientHeight);
   camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();
  });resize.observe(host);
  const direction=new THREE.Vector3(0,0,1),offset=new THREE.Vector3();
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
   velocity.position.copy(rig.position);normal.position.copy(rig.position);
   velocity.setLength(Math.max(.01,sim.velocity.length()*.3));normal.setDirection(sim.normal);
   if(sim.velocity.lengthSq()>.001)velocity.setDirection(offset.copy(sim.velocity).normalize());
   if(follow){
    offset.copy(sim.velocity);offset.y=0;if(offset.lengthSq()>.01)direction.lerp(offset.normalize(),1-Math.exp(-4*frameSeconds)).normalize();
    camera.position.copy(rig.position).addScaledVector(direction,-7);camera.position.y+=4;
    camera.position.y=Math.max(camera.position.y,terrainHeight(camera.position.x,camera.position.z)+.5);
    orbit.target.copy(rig.position);orbit.target.y+=.6;camera.lookAt(orbit.target);
   }
   renderer.render(scene,camera);
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
   terrain.dispose();snow.material.dispose();skiGeo.dispose();bodyGeo.dispose();ink.dispose();flex.dispose();renderer.dispose();
   renderer.domElement.remove();host.removeEventListener("keydown",key);host.removeEventListener("keyup",key);host.removeEventListener("blur",clear);
  };
 },[]);
 return <main><h1>Ski physics lab</h1><p>A/D steer or spin · W/S tuck or brake, pitch in air · Q/E roll · hold and release Space to jump · Shift to grab. For the controlled comparison use /dev/ski-lab?five-carve&amp;early-lead=1.5; zero lead preserves the original V3-1 input timing. Add &amp;sole=rigid|bounded|surface to compare sole models; the surface option is a diagnostic upper bound, not a physically qualified ski.</p>
 <div ref={viewport} tabIndex={0} aria-label="Ski simulation" style={{height:"60vh"}}/>
 <div>{(["pause","step","replay","camera"] as const).map((action,i)=><button key={action} onClick={()=>actions.current[action]()}>{["Pause / resume","Step one tick","Replay inputs","Follow / orbit"][i]}</button>)}</div>
 <output ref={status}/></main>;
}
