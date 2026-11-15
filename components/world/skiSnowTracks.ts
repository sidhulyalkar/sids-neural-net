import * as THREE from "three/src/Three.Core.js";
import {SKI_HALF_LENGTH,SKI_HALF_WIDTH,SKI_SOLE_Y} from "@/components/world/worldSkiContact";
import {tuning,type SkiSimulation} from "@/lib/world/ski/simulation";
import {SkiV4Simulation} from "@/lib/world/ski/v4/adapter";

const segments=768;
const lifetime=6;
const corners=[0,1,2,2,1,3];

// Two narrow ribbons share a single fixed buffer and draw call. The shader
// fades highlights and grooves together on simulation time, including replay.
export class SnowTracks {
 private readonly geometry=new THREE.BufferGeometry();
 private readonly position=new THREE.BufferAttribute(new Float32Array(segments*18),3).setUsage(THREE.DynamicDrawUsage);
 private readonly sample=new THREE.BufferAttribute(new Float32Array(segments*18),3).setUsage(THREE.DynamicDrawUsage);
 private readonly material=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
  uniforms:{time:{value:0}},
  vertexShader:`attribute vec3 stamp; varying vec3 vStamp;
   void main(){vStamp=stamp;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float time;varying vec3 vStamp;
   void main(){float age=max(0.,time-vStamp.x);float fade=1.-smoothstep(0.,6.,age);
    float ridge=smoothstep(.25,.8,vStamp.y);float margin=1.-smoothstep(.65,1.,abs(vStamp.y));
    gl_FragColor=vec4(mix(vec3(.16,.30,.42),vec3(.94,.98,1.),ridge),fade*margin*vStamp.z);
    #include <colorspace_fragment>
   }`,
 });
 readonly mesh=new THREE.Mesh(this.geometry,this.material);
 private readonly previous=[new THREE.Vector3(),new THREE.Vector3()];
 private readonly active=[false,false];
 private readonly point=new THREE.Vector3();
 private readonly probe=new THREE.Vector3();
 private cursor=0;
 private count=0;
 private lastStamp=-Infinity;
 constructor(private readonly height:(x:number,z:number)=>number){
  this.geometry.setAttribute("position",this.position);this.geometry.setAttribute("stamp",this.sample);
  this.mesh.frustumCulled=false;
  this.reset();
 }
 reset(){
  this.cursor=0;this.count=0;this.lastStamp=-Infinity;this.active.fill(false);
  this.geometry.setDrawRange(0,0);this.mesh.visible=false;
 }
 update(sim:SkiSimulation){
  const time=sim.tick*tuning.dt;
  this.material.uniforms.time.value=time;
  this.mesh.visible=this.count>0&&time-this.lastStamp<lifetime;
  for(let i=0;i<2;i++){
   if(sim.footprint!=="independent"||sim.phase==="air"||!sim.contact[i]||sim.load[i]<=.05){
    this.active[i]=false;continue;
   }
   const sole=sim.soles[i];
   const v4=sim instanceof SkiV4Simulation?sim.v4:null;
   const physical=v4?.contact[i]??null;
   let best=Infinity;
   if(physical){
    // The only valid V4 footprint originates from a load-bearing station
    // in the physical contact solver. Never search arbitrary floating tips
    // or legacy sole deficits for a plausible-looking footprint.
    const loaded=physical.sections.filter(section=>section.load>0);
    if(!physical.loaded||physical.edgeContactStations===0||
       physical.snowFraction<.5||physical.snowLoad<.1||!loaded.length){
      this.active[i]=false;continue;
    }
    const section=loaded.reduce((a,b)=>a.gap<=b.gap?a:b);
    for(let w=-1;w<=1;w++){
     this.probe.set(w*SKI_HALF_WIDTH,SKI_SOLE_Y+section.flex,section.along)
      .applyQuaternion(sole.rotation).add(sole.position);
     const gap=this.probe.y-this.height(this.probe.x,this.probe.z);
     if(gap<best){best=gap;this.point.copy(this.probe);}
    }
   }else{
    // Preserve the legacy/V3 footprint contract unchanged.
    let station=0;
    for(let j=1;j<sole.deficits.length;j++)
     if(sole.deficits[j]>sole.deficits[station])station=j;
    for(let w=-1;w<=1;w++){
     this.probe.set(w*SKI_HALF_WIDTH,SKI_SOLE_Y,
      SKI_HALF_LENGTH*(2*station/(sole.deficits.length-1)-1))
      .applyQuaternion(sole.rotation).add(sole.position);
     const gap=this.probe.y-this.height(this.probe.x,this.probe.z);
     if(gap<best){best=gap;this.point.copy(this.probe);}
    }
   }
   // The centre and both track edges must remain on snow, not just one
   // opportunistically selected point at a visually white terrain border.
   if(Math.abs(best)>.045 ||
      (v4&&((this.height as ((x:number,z:number)=>number)&{snowCoverage?:(x:number,z:number)=>number})
        .snowCoverage?.(this.point.x,this.point.z)??0)<.45)){
     this.active[i]=false;continue;
   }
   const prev=this.previous[i],dx=this.point.x-prev.x,dz=this.point.z-prev.z;
   const length=Math.hypot(dx,dz);
   if(this.active[i]&&length<.12)continue;
   // V4 maintains visual continuity during low frame rates by sampling
   // physically loaded tracks along the actual displacement, not by skipping
   // every >0.6-unit frame. A large discontinuity still breaks the trail.
   if(this.active[i]&&length<(physical?2.5:.6)){
    const powder=physical?.snowpack.powderDepth??0;
    const penetration=physical?.estimatedSink??0;
    const strength=Math.min(1,sim.load[i]*
      (.35+Math.abs(sim.edge))*(.4+sim.velocity.length()/8)+
      Math.min(.25,penetration*2));
    const skidding=physical&&v4?.telemetry.turnRegime==="skid";
    // Shallow compacted pistes leave fine incisions, while deeper powder
    // spreads a visibly broader, softer compressed ribbon. This is surface
    // shading, NOT actual mesh excavation or a hidden change to collision.
    const width=(physical&&!skidding ? .018 : .026)+.036*strength+
      (physical?Math.min(.035,powder*.10):0);
    const steps=physical?Math.max(1,Math.ceil(length/.15)):1;
    for(let step=1;step<=steps;step++){
     const fromX=prev.x+dx*(step-1)/steps,fromZ=prev.z+dz*(step-1)/steps;
     const toX=prev.x+dx*step/steps,toZ=prev.z+dz*step/steps;
     const segDx=toX-fromX,segDz=toZ-fromZ,segLen=Math.hypot(segDx,segDz);
     if(segLen<1e-6)continue;
     for(let n=0;n<6;n++){
      const corner=corners[n],side=corner%2?1:-1;
      const cx=corner<2?fromX:toX,cz=corner<2?fromZ:toZ;
      const x=cx+side*width*segDz/segLen,z=cz-side*width*segDx/segLen;
      const index=this.cursor*6+n;
      this.position.setXYZ(index,x,this.height(x,z)+.012,z);
      this.sample.setXYZ(index,time,side,.22+.4*strength);
     }
     this.cursor=(this.cursor+1)%segments;this.count=Math.min(segments,this.count+1);
    }
    this.lastStamp=time;this.mesh.visible=true;
    this.position.needsUpdate=true;this.sample.needsUpdate=true;
    this.geometry.setDrawRange(0,this.count*6);
   }
   this.active[i]=true;prev.copy(this.point);
  }
 }
 dispose(){this.geometry.dispose();this.material.dispose();}
}
