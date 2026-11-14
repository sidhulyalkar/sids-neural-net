import * as THREE from "three";
import {SKI_HALF_LENGTH,SKI_HALF_WIDTH,SKI_SOLE_Y} from "@/components/world/worldSkiContact";
import {tuning,type SkiSimulation} from "@/lib/world/ski/simulation";

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
   // Anchor to the loaded running surface. A binding or tail can hang far
   // above the snow on a convex lip even though the ski has some support.
   let station=0;
   for(let j=1;j<sole.deficits.length;j++)if(sole.deficits[j]>sole.deficits[station])station=j;
   let best=Infinity;
   for(let w=-1;w<=1;w++){
    this.probe.set(w*SKI_HALF_WIDTH,SKI_SOLE_Y,SKI_HALF_LENGTH*(2*station/(sole.deficits.length-1)-1))
     .applyQuaternion(sole.rotation).add(sole.position);
    const gap=this.probe.y-this.height(this.probe.x,this.probe.z);
    if(gap<best){best=gap;this.point.copy(this.probe);}
   }
   if(Math.abs(best)>.045){this.active[i]=false;continue;}
   const prev=this.previous[i],dx=this.point.x-prev.x,dz=this.point.z-prev.z;
   const length=Math.hypot(dx,dz);
   if(this.active[i]&&length<.12)continue;
   if(this.active[i]&&length<.6){
    const strength=Math.min(1,sim.load[i]*(.35+Math.abs(sim.edge))*(.4+sim.velocity.length()/8));
    const width=.026+.036*strength;
    for(let n=0;n<6;n++){
     const corner=corners[n],side=corner%2?1:-1,center=corner<2?prev:this.point;
     const x=center.x+side*width*dz/length,z=center.z-side*width*dx/length;
     const index=this.cursor*6+n;
     this.position.setXYZ(index,x,this.height(x,z)+.012,z);
     this.sample.setXYZ(index,time,side,.22+.4*strength);
    }
    this.cursor=(this.cursor+1)%segments;this.count=Math.min(segments,this.count+1);
    this.lastStamp=time;this.mesh.visible=true;
    this.position.needsUpdate=true;this.sample.needsUpdate=true;
    this.geometry.setDrawRange(0,this.count*6);
   }
   this.active[i]=true;prev.copy(this.point);
  }
 }
 dispose(){this.geometry.dispose();this.material.dispose();}
}
