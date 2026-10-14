import * as THREE from "three/src/Three.Core.js";
import {
  SKATE_PARK, SKATE_PARK_RAILS, REDWOOD_BOWL, STUMP_PADS,
  skateParkSurface, skateParkZone,
} from "@/lib/world/skatepark";
import {terrainHeight,type Point} from "@/lib/world/model";
import {biomeAt,BIOME_COLORS} from "@/lib/world/biomes";

/**
 * Static, self-owned forest skate geometry. Everything that looks like a
 * rideable surface samples skateParkSurface: bark, plank seams and grain are
 * thin overlays, not additional physics colliders.
 *
 * No external textures, runtime allocation, terrain edits or scene-global
 * materials. Kept separate from worldRenderer to avoid another 400 lines in
 * its animation loop.
 */
export function createWorldSkateGrove(scene:THREE.Scene,support:(p:Point)=>number){
 const group=new THREE.Group();
 group.name="Redwood Skate Grove";
 scene.add(group);
 const ownedGeometry:THREE.BufferGeometry[]=[];
 const ownedMaterials:THREE.Material[]=[];
 const geometry=<T extends THREE.BufferGeometry>(g:T):T=>{ownedGeometry.push(g);return g;};
 const material=(color:string,other:THREE.MeshStandardMaterialParameters={})=>{
  const m=new THREE.MeshStandardMaterial({color,roughness:.91,flatShading:false,...other});
  ownedMaterials.push(m);return m;
 };
 const timber=material("#946142");
 const darkTimber=material("#563b30");
 const grain=material("#e0b983");
 const bark=material("#684733");
 const metal=material("#c8cbbd",{metalness:.45,roughness:.42});
 const unitCylinder=geometry(new THREE.CylinderGeometry(1,1,1,9));
 const up=new THREE.Vector3(0,1,0);
 const dummy=new THREE.Object3D();
 type Part={a:THREE.Vector3;b:THREE.Vector3;radius:number};
 function beam(a:THREE.Vector3,b:THREE.Vector3,radius:number):Part{return {a,b,radius};}
 function pooled(name:string,parts:Part[],m:THREE.Material){
  if(!parts.length)return;
  const instance=new THREE.InstancedMesh(unitCylinder,m,parts.length);
  instance.name=name;instance.castShadow=false;instance.receiveShadow=true;
  parts.forEach((part,i)=>{
   const axis=part.b.clone().sub(part.a);
   const length=axis.length();
   dummy.position.copy(part.a).add(part.b).multiplyScalar(.5);
   dummy.scale.set(part.radius,Math.max(.001,length),part.radius);
   dummy.quaternion.setFromUnitVectors(up,length>.00001?axis.normalize():up);
   dummy.updateMatrix();instance.setMatrixAt(i,dummy.matrix);
  });
  instance.instanceMatrix.needsUpdate=true;
  instance.computeBoundingSphere();
  group.add(instance);
 }
 const ride=(p:Point)=>skateParkSurface(p)??terrainHeight(p.x,p.z);
 const onRide=(p:Point,offset=.06)=>new THREE.Vector3(p.x,ride(p)+offset,p.z);

 // Primary satin-polished cedar and earth surface. Same sampled mesh geometry
 // as the world support profile, with color regions rather than box patches.
 const widthSteps=64,depthSteps=56;
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const color=new THREE.Color();
 for(let iz=0;iz<=depthSteps;iz++)for(let ix=0;ix<=widthSteps;ix++){
  const x=SKATE_PARK.center.x-SKATE_PARK.halfWidth+
   ix*SKATE_PARK.halfWidth*2/widthSteps;
  const z=SKATE_PARK.center.z-SKATE_PARK.halfDepth+
   iz*SKATE_PARK.halfDepth*2/depthSteps;
  const p={x,z},zone=skateParkZone(p);
  positions.push(x,ride(p)+.035,z);
  if(zone==="redwood-bowl"){
   const d=Math.hypot(x-REDWOOD_BOWL.center.x,z-REDWOOD_BOWL.center.z);
   color.set(d<4.35?"#c9ab7e":d<5.4?"#b99669":"#a67c53");
  }else if(zone==="timber-quarter"){
   color.set(iz%3===0?"#caa471":"#bf9566");
  }else if(zone==="stump-pad")color.set("#c8a477");
  else if(zone==="street")color.set("#a98a63");
  else color.set("#8b8971");
  // Match the host island's actual biome pigments at the perimeter, so
  // this remains a grove in the meadow instead of a visible square slab.
  const edge=Math.min(SKATE_PARK.halfWidth-Math.abs(x-SKATE_PARK.center.x),
    SKATE_PARK.halfDepth-Math.abs(z-SKATE_PARK.center.z));
  if(edge<3){
   const host=new THREE.Color(0,0,0);
   for(const [id,w] of Object.entries(biomeAt(p).weights))
    host.add(new THREE.Color(BIOME_COLORS[id as keyof typeof BIOME_COLORS]).multiplyScalar(w));
   const f=Math.max(0,Math.min(1,edge/3));
   color.lerp(host,1-f*f*(3-2*f));
  }
  colors.push(color.r,color.g,color.b);
 }
 for(let iz=0;iz<depthSteps;iz++)for(let ix=0;ix<widthSteps;ix++){
  const a=iz*(widthSteps+1)+ix,b=a+1,c=a+widthSteps+1,d=c+1;
  indices.push(a,c,b,b,c,d);
 }
 const field=geometry(new THREE.BufferGeometry());
 field.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
 field.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 field.setIndex(indices);field.computeVertexNormals();
 const surface=new THREE.Mesh(field,material("#ffffff",{vertexColors:true,side:THREE.DoubleSide}));
 surface.name="skate-grove-ride-surface";
 surface.castShadow=false;surface.receiveShadow=true;
 group.add(surface);

 // Huge, hollow redwood cross-section. Bark wraps outside the curved rim,
 // with an actual break facing east: the shallow roll-in stays inviting.
 // All upper vertices sample the support field; the vertical bark face is
 // *outside* the ride envelope and is not used as a collision wall.
 const barkPositions:number[]=[],barkColors:number[]=[],barkIndices:number[]=[];
 const rimSegments=72,rimBands=5;
 const barkColorsPalette=["#9b6d49","#745038","#583d31","#80583b","#99724c"];
 const barkColor=new THREE.Color();
 for(let i=0;i<rimSegments;i++){
  const angle0=i*2*Math.PI/rimSegments;
  const angle1=(i+1)*2*Math.PI/rimSegments;
  const mid=(angle0+angle1)*.5;
  // Opening slightly north of east, centered around +0.15 radians.
  const delta=Math.atan2(Math.sin(mid-.15),Math.cos(mid-.15));
  if(Math.abs(delta)<.29)continue;
  const start=barkPositions.length/3;
  for(let side=0;side<2;side++){
   const angle=side?angle1:angle0;
   const cosine=Math.cos(angle),sine=Math.sin(angle);
   for(let band=0;band<=rimBands;band++){
    const t=band/rimBands;
    const radius=REDWOOD_BOWL.rimRadius+.07+t*(REDWOOD_BOWL.barkRadius-REDWOOD_BOWL.rimRadius-.07);
    const p={x:REDWOOD_BOWL.center.x+cosine*radius,
      z:REDWOOD_BOWL.center.z+sine*radius};
    const wave=Math.sin(angle*11+radius*2)*.007;
    barkPositions.push(p.x,ride(p)+.048+wave,p.z);
    barkColor.set(barkColorsPalette[Math.min(rimBands-1,Math.floor(t*rimBands))]??"#745038");
    barkColors.push(barkColor.r,barkColor.g,barkColor.b);
   }
  }
  for(let band=0;band<rimBands;band++){
   const a=start+band,b=start+rimBands+1+band;
   barkIndices.push(a,b,a+1,a+1,b,b+1);
  }
  // Bark exterior slopes to the existing meadow; no raised extrusion inside.
  const radius=REDWOOD_BOWL.barkRadius;
  const left={x:REDWOOD_BOWL.center.x+Math.cos(angle0)*radius,
    z:REDWOOD_BOWL.center.z+Math.sin(angle0)*radius};
  const right={x:REDWOOD_BOWL.center.x+Math.cos(angle1)*radius,
    z:REDWOOD_BOWL.center.z+Math.sin(angle1)*radius};
  const edgeStart=barkPositions.length/3;
  for(const p of [left,right]){
   const top=ride(p)+.045;
   for(const y of [top,terrainHeight(p.x,p.z)+.01]){
    barkPositions.push(p.x,y,p.z);
    barkColor.set(y===top?"#765039":"#513b31");
    barkColors.push(barkColor.r,barkColor.g,barkColor.b);
   }
  }
  barkIndices.push(edgeStart,edgeStart+1,edgeStart+2,
   edgeStart+1,edgeStart+3,edgeStart+2);
 }
 const shellGeo=geometry(new THREE.BufferGeometry());
 shellGeo.setAttribute("position",new THREE.Float32BufferAttribute(barkPositions,3));
 shellGeo.setAttribute("color",new THREE.Float32BufferAttribute(barkColors,3));
 shellGeo.setIndex(barkIndices);shellGeo.computeVertexNormals();
 const shell=new THREE.Mesh(shellGeo,material("#ffffff",{
  vertexColors:true,roughness:1,side:THREE.DoubleSide,
 }));
 shell.name="hollow-redwood-bark-shell";shell.castShadow=false;
 group.add(shell);

 // The bowl used to read as a thin wooden saucer: its bark surface curved
 // down to the meadow but there was no *visible trunk thickness*. Expose a
 // partly buried vertical bark face UNDER the sampled rim, following the
 // natural terrain underneath. This changes neither ride height nor wheel
 // collision, and its upper edge remains below the sampled skating surface.
 // The broad east split stays open rather than turning into a fake wall.
 const fasciaPositions:number[]=[],fasciaColors:number[]=[],fasciaIndices:number[]=[];
 const fasciaSegments=96,fasciaBands=6,fasciaColor=new THREE.Color();
 for(let i=0;i<fasciaSegments;i++){
  const startAngle=i*Math.PI*2/fasciaSegments;
  const stopAngle=(i+1)*Math.PI*2/fasciaSegments;
  const delta=Math.atan2(
   Math.sin((startAngle+stopAngle)*.5-.15),
   Math.cos((startAngle+stopAngle)*.5-.15));
  if(Math.abs(delta)<.37)continue;
  const offset=fasciaPositions.length/3;
  for(const a of [startAngle,stopAngle]){
   const noise=.025*Math.sin(a*13)+.016*Math.sin(a*29);
   const topRadius=REDWOOD_BOWL.rimRadius+.29+noise;
   const topPoint={x:REDWOOD_BOWL.center.x+Math.cos(a)*topRadius,
    z:REDWOOD_BOWL.center.z+Math.sin(a)*topRadius};
   const crest=ride(topPoint)-.055;
   for(let band=0;band<=fasciaBands;band++){
    const t=band/fasciaBands;
    const radius=topRadius+t*(.18+.038*Math.sin(a*7));
    const p={x:REDWOOD_BOWL.center.x+Math.cos(a)*radius,
     z:REDWOOD_BOWL.center.z+Math.sin(a)*radius};
    const ground=terrainHeight(p.x,p.z)+.025;
    const y=ground+(crest-ground)*(1-t);
    fasciaPositions.push(p.x,y,p.z);
    const striation=Math.sin(a*41+band*.5)*.085;
    fasciaColor.setHSL(.067+striation*.1,.36,.235+
     .052*Math.sin(a*17+band*.43)+.025*Math.sin(a*43));
    fasciaColors.push(fasciaColor.r,fasciaColor.g,fasciaColor.b);
   }
  }
  for(let j=0;j<fasciaBands;j++){
   const a=offset+j,b=offset+fasciaBands+1+j;
   fasciaIndices.push(a,b,a+1,b,b+1,a+1);
  }
 }
 const fasciaGeo=geometry(new THREE.BufferGeometry());
 fasciaGeo.setAttribute("position",new THREE.Float32BufferAttribute(fasciaPositions,3));
 fasciaGeo.setAttribute("color",new THREE.Float32BufferAttribute(fasciaColors,3));
 fasciaGeo.setIndex(fasciaIndices);fasciaGeo.computeVertexNormals();
 const fascia=new THREE.Mesh(fasciaGeo,material("#ffffff",{
  vertexColors:true,roughness:1,side:THREE.DoubleSide,
 }));
 fascia.name="redwood-buried-trunk-fascia";
 fascia.castShadow=false;fascia.receiveShadow=true;
 group.add(fascia);

 // Subtle carved annual rings and a thin coping line, interrupted at the
 // opening. Never place any wood roughness in the wheel-height function.
 const annualRings:Part[]=[],innerCoping:Part[]=[],outerRoots:Part[]=[];
 for(const radius of [1.85,3.1,4.3]){
  for(let i=0;i<rimSegments;i++){
   const a=i*2*Math.PI/rimSegments,b=(i+1)*2*Math.PI/rimSegments;
   const p={x:REDWOOD_BOWL.center.x+Math.cos(a)*radius,
    z:REDWOOD_BOWL.center.z+Math.sin(a)*radius};
   const q={x:REDWOOD_BOWL.center.x+Math.cos(b)*radius,
    z:REDWOOD_BOWL.center.z+Math.sin(b)*radius};
   annualRings.push(beam(onRide(p,.055),onRide(q,.055),.016));
  }
 }
 for(let i=0;i<rimSegments;i++){
  const a=i*2*Math.PI/rimSegments,b=(i+1)*2*Math.PI/rimSegments;
  const mid=(a+b)*.5;
  const delta=Math.atan2(Math.sin(mid-.15),Math.cos(mid-.15));
  if(Math.abs(delta)<.30)continue;
  const radius=REDWOOD_BOWL.rimRadius-.1;
  const p={x:REDWOOD_BOWL.center.x+Math.cos(a)*radius,z:REDWOOD_BOWL.center.z+Math.sin(a)*radius};
  const q={x:REDWOOD_BOWL.center.x+Math.cos(b)*radius,z:REDWOOD_BOWL.center.z+Math.sin(b)*radius};
  innerCoping.push(beam(onRide(p,.065),onRide(q,.065),.040));
  if(i%9===0){
   const rootRadius=REDWOOD_BOWL.barkRadius+.18;
   const out={x:REDWOOD_BOWL.center.x+Math.cos(mid)*rootRadius,
    z:REDWOOD_BOWL.center.z+Math.sin(mid)*rootRadius};
   const inn={x:REDWOOD_BOWL.center.x+Math.cos(mid)*(rootRadius-.65),
    z:REDWOOD_BOWL.center.z+Math.sin(mid)*(rootRadius-.65)};
   outerRoots.push(beam(onRide(inn,.035),onRide(out,.025),.065));
  }
 }
 pooled("redwood-growth-rings",annualRings,grain);
 pooled("split-redwood-coping",innerCoping,metal);
 pooled("outside-redwood-root-grain",outerRoots,bark);
 // Raised, staggered redwood bark ridges articulate the cut trunk at a
 // distance. They lie on the *outside* skirt, never across the hollow ride
 // surface or the east-facing roll-in. A few warm cut-face strokes clarify
 // that the entrance is split wood, not a missing polygon.
 const barkRidges:Part[]=[],woodEndGrain:Part[]=[];
 // Keep the trunk exterior a solid bark surface, not a porcupine fringe.
 // Sparse low flutes are embedded into the skirt and terminate *inside*
 // the rim, never dangling past the edge or crossing the east roll-in.
 for(let i=0;i<28;i++){
  const a=(i+.16*(i%3))*2*Math.PI/28;
  const delta=Math.atan2(Math.sin(a-.15),Math.cos(a-.15));
  if(Math.abs(delta)<.38)continue;
  const radius0=5.60+(i%2)*.09,radius1=6.07+(i%3)*.055;
  const p={x:REDWOOD_BOWL.center.x+Math.cos(a)*radius0,
   z:REDWOOD_BOWL.center.z+Math.sin(a)*radius0};
  const q={x:REDWOOD_BOWL.center.x+Math.cos(a+.012)*radius1,
   z:REDWOOD_BOWL.center.z+Math.sin(a+.012)*radius1};
  barkRidges.push(beam(onRide(p,.065),onRide(q,.065),.014+(i%3)*.003));
 }
 for(const split of [-.33,.33]){
  const a=.15+split;
  for(let k=0;k<5;k++){
   const inner=5.48+k*.185,outer=inner+.16;
   const p={x:REDWOOD_BOWL.center.x+Math.cos(a)*inner,
    z:REDWOOD_BOWL.center.z+Math.sin(a)*inner};
   const q={x:REDWOOD_BOWL.center.x+Math.cos(a)*outer,
    z:REDWOOD_BOWL.center.z+Math.sin(a)*outer};
   woodEndGrain.push(beam(onRide(p,.085),onRide(q,.085),.040));
  }
 }
 pooled("redwood-bark-striations",barkRidges,bark);
 pooled("open-trunk-end-grain",woodEndGrain,grain);

 // Timber quarterpipes and halfpipe rhythm. Thin seams follow the real
 // slope so they cannot float above the deck as straight boxes.
 const plankSeams:Part[]=[],sideRails:Part[]=[],supportPosts:Part[]=[],supportBraces:Part[]=[],lipTrim:Part[]=[];
 for(const zStart of [28.7,46.15]){
  const zEnd=zStart<40?34.2:51.3;
  for(let z=zStart;z<=zEnd;z+=.76){
   for(let x=-1.75;x<6.5;x+=.67){
    const p={x,z},q={x:Math.min(6.5,x+.67),z};
    plankSeams.push(beam(onRide(p,.063),onRide(q,.063),.012));
   }
  }
  // Exposed timber end stringers on the outside, never across the roll-in.
  for(const x of [-2.17,7.15]){
   for(let z=zStart;z<zEnd-.4;z+=.65){
    const p={x,z},q={x,z:Math.min(zEnd,z+.65)};
    sideRails.push(beam(onRide(p,-.13),onRide(q,-.13),.085));
   }
   for(const z of [zStart+.38,(zStart+zEnd)*.5,zEnd-.38]){
    const p={x,z},top=ride(p)-.16,bottom=terrainHeight(p.x,p.z)+.035;
    if(top>bottom+.18){
     supportPosts.push(beam(
      new THREE.Vector3(x,bottom,z),new THREE.Vector3(x,top,z),.095));
     // A timber knee brace inside the outside frame, not a floating
     // obstacle crossing the quarterpipe riding corridor.
     const braceZ=Math.min(zEnd-.15,z+.58);
     const foot={x,z:braceZ};
     supportBraces.push(beam(
      new THREE.Vector3(x,bottom+.09,z),
      new THREE.Vector3(x,Math.max(bottom+.12,ride(foot)-.21),braceZ),.058));
    }
   }
  }
 }
 for(const z of [30.9,49.1]){
  for(let x=-1.8;x<6.5;x+=.6){
   const p={x,z},q={x:Math.min(6.5,x+.6),z};
   lipTrim.push(beam(onRide(p,.078),onRide(q,.078),.044));
  }
 }
 pooled("timber-quarter-plank-joints",plankSeams,darkTimber);
 pooled("exterior-halfpipe-stringers",sideRails,timber);
 pooled("halfpipe-understructure",supportPosts,darkTimber);
 pooled("halfpipe-braced-timber-knees",supportBraces,timber);
 pooled("timber-quarter-lips",lipTrim,metal);

 // Two polished, shallow split-stump manual targets. The radial rise is
 // already part of skateParkSurface, these are only visual grain inlays.
 const stumpRing:Part[]=[],stumpGrain:Part[]=[],stumpSplits:Part[]=[];
 for(const pad of STUMP_PADS){
  for(const radius of [pad.radius*.31,pad.radius*.62,pad.radius*.91]){
   const segments=24;
   for(let i=0;i<segments;i++){
    const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
    const p={x:pad.center.x+Math.cos(a)*radius,z:pad.center.z+Math.sin(a)*radius};
    const q={x:pad.center.x+Math.cos(b)*radius,z:pad.center.z+Math.sin(b)*radius};
    const part=beam(onRide(p,.054),onRide(q,.054),radius > pad.radius * 0.85 ? 0.034 : 0.019);
    (radius > pad.radius * 0.85 ? stumpRing : stumpGrain).push(part);
   }
  }
  // Short, asymmetrical end-grain checks help a cut stump read as wood,
  // rather than a target graphic painted onto the plaza.
  for(let k=0;k<6;k++){
   const a=k*Math.PI/3+k*.08;
   const inner=.22+(k%2)*.13,outer=pad.radius*(.60+(k%3)*.07);
   const p={x:pad.center.x+Math.cos(a)*inner,z:pad.center.z+Math.sin(a)*inner};
   const q={x:pad.center.x+Math.cos(a+.07)*outer,z:pad.center.z+Math.sin(a+.07)*outer};
   stumpSplits.push(beam(onRide(p,.061),onRide(q,.061),.017));
  }
 }
 pooled("split-stump-ring-edges",stumpRing,timber);
 pooled("split-stump-end-grain",stumpGrain,grain);
 pooled("split-stump-grain-checks",stumpSplits,darkTimber);

 // Shared segment metadata is the sole authority for targeting and height.
 // Natural polished log/bar rails keep the old grind physics exactly.
 const logRails:Part[]=[],hybridRails:Part[]=[],railCaps:Part[]=[],railPosts:Part[]=[];
 for(const rail of SKATE_PARK_RAILS){
  const a=new THREE.Vector3(rail.a.x,support(rail.a)+rail.lift,rail.a.z);
  const b=new THREE.Vector3(rail.b.x,support(rail.b)+rail.lift,rail.b.z);
  const log=rail.id==="park-flat-bar";
  (log?logRails:hybridRails).push(beam(a,b,log ? 0.14 : 0.085));
  const capOffset=log ? 0.1 : 0.058;
  railCaps.push(beam(a.clone().add(new THREE.Vector3(0,capOffset,0)),
   b.clone().add(new THREE.Vector3(0,capOffset,0)),.023));
  for(const p of [rail.a,rail.b]){
   railPosts.push(beam(
    new THREE.Vector3(p.x,support(p)+.04,p.z),
    new THREE.Vector3(p.x,support(p)+rail.lift-.025,p.z),.056));
  }
 }
 pooled("redwood-log-grind",logRails,timber);
 pooled("split-timber-hybrid-rails",hybridRails,darkTimber);
 pooled("durable-grind-caps",railCaps,metal);
 pooled("grind-rail-timber-stands",railPosts,bark);

 // Vegetation grows along the outer meadow seam, leaving every bank, rail,
 // stump and entrance clear. Fronds are static pooled strokes, not animated
 // shader foliage, and stay below foot/board height on any ride line.
 const fernStems:Part[]=[],fernFronds:Part[]=[];
 const fernStemMat=material("#52715a"),fernFrondMat=material("#7e9a72");
 for(let i=0;i<30;i++){
  const u=((i*29)%31)/30,side=i%4;
  const p=side===0?{x:-19.38,z:30.3+u*18.9}:
   side===1?{x:7.45,z:30.4+u*18.7}:
   side===2?{x:-17.9+u*23,z:28.72}:
             {x:-18.2+u*23,z:51.14};
  if(skateParkZone(p)==="redwood-bowl"||skateParkZone(p)==="timber-quarter")continue;
  const ground=ride(p),h=.26+(i%5)*.055;
  const base=new THREE.Vector3(p.x,ground+.03,p.z);
  fernStems.push(beam(base,new THREE.Vector3(p.x,ground+h,p.z),.014));
  for(let sideLeaf of [-1,1])for(let j=0;j<3;j++){
   const angle=i*2.4+j*2.09;
   const distance=(.13+j*.043)*sideLeaf;
   const origin=new THREE.Vector3(p.x,ground+.13+j*.053,p.z);
   const tip=new THREE.Vector3(p.x+Math.cos(angle)*distance,
    ground+.13+j*.062,
    p.z+Math.sin(angle)*distance);
   fernFronds.push(beam(origin,tip,.022));
  }
 }
 pooled("park-edge-fern-stems",fernStems,fernStemMat);
 pooled("park-edge-fern-fronds",fernFronds,fernFrondMat);

 return {
  root:group,
  /** One-time teardown prevents orphaned scene geometry on route changes. */
  dispose(){
   group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});
   group.removeFromParent();
   ownedGeometry.forEach(g=>g.dispose());
   ownedMaterials.forEach(m=>m.dispose());
  },
 };
}
