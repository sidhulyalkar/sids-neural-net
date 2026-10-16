import * as THREE from "three/src/Three.Core.js";
import {
  SKATE_PARK, SKATE_PARK_RAILS, REDWOOD_BOWL, STUMP_PADS,
  skateParkSurface, skateParkZone, GROVE_LOG, GROVE_BRIDGE,
  GROVE_TUNNEL, SKATE_LOOP,
  groveBridgeRise, groveStoneRise,
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
 const widthSteps=96,depthSteps=84;
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const color=new THREE.Color();
 const hollowFloor=new THREE.Color("#aa825c");
 const carvedWall=new THREE.Color("#dfbd89");
 const darkHeartwood=new THREE.Color("#ad7950");
 const exteriorBark=new THREE.Color("#674633"),soil=new THREE.Color("#8b8971");
 const sandedPyramid=new THREE.Color("#ba9b72");
 const graded=(lo:number,hi:number,value:number)=>{
  const t=THREE.MathUtils.clamp((value-lo)/(hi-lo),0,1);
  return t*t*(3-2*t);
 };
 for(let iz=0;iz<=depthSteps;iz++)for(let ix=0;ix<=widthSteps;ix++){
  const x=SKATE_PARK.center.x-SKATE_PARK.halfWidth+
   ix*SKATE_PARK.halfWidth*2/widthSteps;
  const z=SKATE_PARK.center.z-SKATE_PARK.halfDepth+
   iz*SKATE_PARK.halfDepth*2/depthSteps;
  const p={x,z},zone=skateParkZone(p);
  positions.push(x,ride(p)+.035,z);
  const d=Math.hypot(x-REDWOOD_BOWL.center.x,z-REDWOOD_BOWL.center.z);
  if(d<REDWOOD_BOWL.barkRadius+.72){
   // One physically rideable tree trunk, not a second dark shell clipping
   // through the terrain on the shoulder. The actual GPU deck triangles
   // carry the cut heartwood, cambium and bark colors directly.
   const az=Math.atan2(z-REDWOOD_BOWL.center.z,x-REDWOOD_BOWL.center.x);
   // A darker recessed floor and brighter rising walls help the viewer
   // perceive the real concavity without a fake shadow mesh or extra lights.
   color.copy(hollowFloor).lerp(carvedWall,graded(2.05,4.45,d));
   color.lerp(darkHeartwood,graded(4.85,5.47,d));
   color.lerp(exteriorBark,graded(5.47,5.91,d));
   // Bark fluting is color on the real shoulder, never protruding stakes.
   if(d>5.55&&d<6.5)color.multiplyScalar(.88+.12*Math.cos(az*29+d*1.7));
   color.lerp(soil,graded(6.32,7.18,d));
   const grain=.975+.019*Math.sin(d*8.7+.65*Math.sin(az*5))+
    .010*Math.sin(d*17.7+.55*Math.cos(az*9));
   color.multiplyScalar(grain);
  }else if(groveBridgeRise(p)>.025){
   color.set(Math.floor((x-GROVE_BRIDGE.center.x)*3)%2===0?"#bb8c59":"#c79b68");
  }else if(Math.abs(x-GROVE_LOG.center.x)<GROVE_LOG.halfLength &&
    Math.abs(z-GROVE_LOG.center.z)<GROVE_LOG.halfWidth*1.5){
   const across=Math.abs(z-GROVE_LOG.center.z)/GROVE_LOG.halfWidth;
   color.copy(carvedWall).lerp(exteriorBark,graded(.85,1.1,across));
   color.lerp(soil,graded(1.18,1.5,across));
   color.multiplyScalar(.96+.04*Math.sin(x*4.2+across*7));
  }else if(groveStoneRise(p)>.015){
   color.set("#93978b");
   color.multiplyScalar(.88+.12*Math.sin(Math.floor(x*2)*3+Math.floor(z*2)));
  }else if(zone==="timber-quarter"){
   color.set(iz%3===0?"#caa471":"#bf9566");
  }else if(zone==="stump-pad")color.set("#c8a477");
  else if(zone==="street"){
   // The old rectangular brown street patch looked like a plywood slab.
   // Only the authored raised pyramid is polished wood; the rest is
   // contiguous meadow soil, with a feathered non-rectangular edge.
   const relief=Math.max(0,1-Math.abs(x+1)/2.5)*
    Math.max(0,1-Math.abs(z-40)/3.2);
   color.copy(soil).lerp(sandedPyramid,graded(.035,.72,relief));
  }else color.copy(soil);
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

 // The new landmark art is one semantic scene group. Root child count stays
 // within the original low-draw / easy-disposal contract.
 const landmarkStart=group.children.length;

 // An enormous old-growth sequoia, elliptical rather than cylindrical. Inner
 // and outer skins share a tapering skeleton. The sole wheel-height authority
 // is the sampled polished floor already present in skateParkSurface.
 const sequoiaInner=material("#ffffff",{side:THREE.DoubleSide,vertexColors:true});
 const sequoiaBark=material("#ffffff",{side:THREE.DoubleSide,vertexColors:true});
 const sequoiaCut=material("#d7ac78",{side:THREE.DoubleSide});
 const archSlices=60,logSlices=44,archExtent=GROVE_TUNNEL.archExtent;
 const treePoint=(x:number,a:number,outer:boolean)=>{
  const along=(x-GROVE_TUNNEL.center.x)/GROVE_TUNNEL.halfLength;
  const taper=1-GROVE_TUNNEL.taper*along;
  // Bark has rugged longitudinal ridges, but the inner bore stays clean.
  const grain=outer?1+.024*Math.sin(21*a+along*8)+
   .014*Math.cos(38*a-along*7)+.010*Math.sin(7*a+along*17):1;
  const vertical=(outer?GROVE_TUNNEL.outerRadius:GROVE_TUNNEL.innerRadius)*taper*grain;
  const lateral=(outer?GROVE_TUNNEL.outerHalfWidth:GROVE_TUNNEL.innerHalfWidth)*taper*grain;
  const base=ride({x,z:GROVE_TUNNEL.center.z})+GROVE_TUNNEL.archCenterLift;
  return new THREE.Vector3(x,base+Math.cos(a)*vertical,
   GROVE_TUNNEL.center.z+Math.sin(a)*lateral);
 };
 const makeSequoiaSkin=(outer:boolean)=>{
  const vertices:number[]=[],faces:number[]=[],tints:number[]=[];
  const light=new THREE.Color(outer?"#7e533b":"#dbb58c");
  const dark=new THREE.Color(outer?"#34251c":"#b9875e");
  const shade=new THREE.Color();
  for(let ix=0;ix<=logSlices;ix++){
   const x=GROVE_TUNNEL.center.x-GROVE_TUNNEL.halfLength+
    ix*GROVE_TUNNEL.halfLength*2/logSlices;
   for(let j=0;j<=archSlices;j++){
    const a=-archExtent+j*2*archExtent/archSlices,p=treePoint(x,a,outer);
    vertices.push(p.x,p.y,p.z);
    const detail=outer ? .44+.29*Math.sin(21*a+x)+.13*Math.cos(38*a-x*2) :
     .78+.075*Math.sin(x*4+a*8);
    shade.copy(dark).lerp(light,THREE.MathUtils.clamp(detail,0,1));
    tints.push(shade.r,shade.g,shade.b);
   }
  }
  for(let ix=0;ix<logSlices;ix++)for(let j=0;j<archSlices;j++){
   const a=ix*(archSlices+1)+j,b=a+1,n=a+archSlices+1;
   faces.push(a,b,n,b,n+1,n);
  }
  const g=geometry(new THREE.BufferGeometry());
  g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(tints,3));
  g.setIndex(faces);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,outer?sequoiaBark:sequoiaInner);
  mesh.name=outer?"sequoia-deep-fluted-bark":"sequoia-hollow-inner-roof";
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 };
 makeSequoiaSkin(false);makeSequoiaSkin(true);
 // Annular END faces only: a true hollow mouth, never a disk blocking passage.
 const cutVertices:number[]=[],cutFaces:number[]=[];
 for(const side of [-1,1]){
  const x=GROVE_TUNNEL.center.x+side*GROVE_TUNNEL.halfLength;
  const off=cutVertices.length/3;
  for(let j=0;j<=archSlices;j++){
   const a=-archExtent+j*2*archExtent/archSlices;
   for(const outer of [false,true]){
    const p=treePoint(x,a,outer);
    cutVertices.push(p.x+side*.005,p.y,p.z);
   }
  }
  for(let j=0;j<archSlices;j++){
   const v=off+j*2;
   cutFaces.push(v,v+1,v+2,v+1,v+3,v+2);
  }
 }
 const cutG=geometry(new THREE.BufferGeometry());
 cutG.setAttribute("position",new THREE.Float32BufferAttribute(cutVertices,3));
 cutG.setIndex(cutFaces);cutG.computeVertexNormals();
 const endFaces=new THREE.Mesh(cutG,sequoiaCut);
 endFaces.name="sequoia-open-end-heartwood";endFaces.receiveShadow=true;
 group.add(endFaces);
 const sequoiaEndGrain:Part[]=[],barkFlutes:Part[]=[],brokenRoots:Part[]=[];
 for(const side of [-1,1]){
  const x=GROVE_TUNNEL.center.x+side*GROVE_TUNNEL.halfLength;
  for(const weight of [.15,.38,.68,.93])for(let j=0;j<archSlices;j++){
   const a=-archExtent+j*2*archExtent/archSlices,b=a+2*archExtent/archSlices;
   const wood=(angle:number)=>treePoint(x,angle,false)
    .lerp(treePoint(x,angle,true),weight);
   sequoiaEndGrain.push(beam(wood(a),wood(b),weight>.8?.023:.013));
  }
  for(const bank of [-1,1]){
   const z=GROVE_TUNNEL.center.z+bank*(GROVE_TUNNEL.outerHalfWidth-.25);
   const h=terrainHeight(x,z);
   const rootX=x+side*1.35,rootZ=z+bank*.65;
   brokenRoots.push(beam(new THREE.Vector3(x,h+.48,z),
    new THREE.Vector3(rootX,terrainHeight(rootX,rootZ)+.08,rootZ),.17));
  }
 }
 for(let j=0;j<30;j++){
  const a=-archExtent+.10+j*(archExtent*2-.20)/29;
  let last:THREE.Vector3|null=null;
  for(let ix=0;ix<=logSlices;ix++){
   const x=GROVE_TUNNEL.center.x-GROVE_TUNNEL.halfLength+
    ix*GROVE_TUNNEL.halfLength*2/logSlices;
   const p=treePoint(x,a,true);
   p.y+=Math.cos(a)*.02;p.z+=Math.sin(a)*.02;
   if(last)barkFlutes.push(beam(last,p,.018+(j%6)*.005));
   last=p;
  }
 }
 pooled("sequoia-open-end-growth-rings",sequoiaEndGrain,sequoiaCut);
 pooled("sequoia-longitudinal-bark-flutes",barkFlutes,darkTimber);
 pooled("sequoia-broken-root-buttresses",brokenRoots,bark);

 // Full vertical timber loop. This is a real 3D wheel path supported by the
 // dedicated skateboard loop state, NEVER by the single-valued meadow field.
 // Broadside to the riding direction so the inversion reads clearly on camera.
 const loopBase=ride(SKATE_LOOP.center)+.09;
 const loopCedar=material("#bc8b58",{side:THREE.DoubleSide});
 const loopBark=material("#59402f",{side:THREE.DoubleSide});
 const loopSegments=120;
 function addLoopSkin(radius:number,mat:THREE.Material,name:string){
  const vertices:number[]=[],triangles:number[]=[];
  for(let i=0;i<=loopSegments;i++){
   const angle=i*2*Math.PI/loopSegments;
   const x=SKATE_LOOP.center.x-radius*Math.sin(angle);
   const y=loopBase+radius*(1-Math.cos(angle));
   for(const side of [-1,1])
    vertices.push(x,y,SKATE_LOOP.center.z+side*SKATE_LOOP.width*.5);
  }
  for(let i=0;i<loopSegments;i++){
   const a=i*2;triangles.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  const g=geometry(new THREE.BufferGeometry());
  g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(triangles);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mat);
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 addLoopSkin(SKATE_LOOP.radius,loopCedar,"full-360-loop-polished-tread");
 addLoopSkin(SKATE_LOOP.radius+SKATE_LOOP.supportThickness,loopBark,"full-360-loop-bark-understructure");
 const loopCoping:Part[]=[],loopSlats:Part[]=[],loopStruts:Part[]=[];
 for(let side of [-1,1]){
  const z=SKATE_LOOP.center.z+side*SKATE_LOOP.width*.5;
  for(let i=0;i<loopSegments;i++){
   const a=i*2*Math.PI/loopSegments,b=(i+1)*2*Math.PI/loopSegments;
   const p=(t:number,r:number)=>new THREE.Vector3(
    SKATE_LOOP.center.x-r*Math.sin(t),loopBase+r*(1-Math.cos(t)),z);
   loopCoping.push(beam(p(a,SKATE_LOOP.radius+.028),p(b,SKATE_LOOP.radius+.028),.044));
  }
  for(const x of [SKATE_LOOP.center.x-SKATE_LOOP.radius,
    SKATE_LOOP.center.x+SKATE_LOOP.radius]){
   // Buttressed on the outside; no vertical posts in the center riding lane.
   const outsideZ=z+side*.58;
   const foot=terrainHeight(x,outsideZ)+.06;
   loopStruts.push(beam(new THREE.Vector3(x,foot,outsideZ),
    new THREE.Vector3(x,loopBase+SKATE_LOOP.radius*.83,z),.15));
   // Angled root-like braces hold up the giant circular timber ribs.
   loopStruts.push(beam(new THREE.Vector3(x,foot,outsideZ+side*.35),
    new THREE.Vector3(x-(x<SKATE_LOOP.center.x?.7:-.7),
     loopBase+SKATE_LOOP.radius*.53,z),.11));
  }
 }
 for(let i=0;i<48;i++){
  const a=i*2*Math.PI/48,r=SKATE_LOOP.radius+.035;
  const x=SKATE_LOOP.center.x-r*Math.sin(a),y=loopBase+r*(1-Math.cos(a));
  loopSlats.push(beam(
   new THREE.Vector3(x,y,SKATE_LOOP.center.z-SKATE_LOOP.width*.5),
   new THREE.Vector3(x,y,SKATE_LOOP.center.z+SKATE_LOOP.width*.5),.021));
 }
 pooled("loop-timber-safety-edges",loopCoping,metal);
 pooled("loop-crossgrain-planks",loopSlats,grain);
 pooled("loop-exterior-buttresses",loopStruts,darkTimber);

 // The outer stump becomes genuine rugged sequoia bark. This annular shell
 // hugs only the OUTSIDE of the drivable rim and fades into terrain: no roof,
 // invisible collider, or bark slab occupying the carved bowl interior.
 const barkVertices:number[]=[],barkFaces:number[]=[],barkColors:number[]=[];
 const barkLight=new THREE.Color("#82543a"),barkDark=new THREE.Color("#35271f");
 const barkMix=new THREE.Color(),barkAzimuths=128,barkRings=10;
 for(let k=0;k<=barkAzimuths;k++){
  const a=k*2*Math.PI/barkAzimuths;
  const split=Math.abs(Math.atan2(Math.sin(a-.15),Math.cos(a-.15)));
  for(let j=0;j<=barkRings;j++){
   const f=j/barkRings,r=REDWOOD_BOWL.rimRadius+.18+
    f*(REDWOOD_BOWL.barkRadius-REDWOOD_BOWL.rimRadius+.24);
   const p={x:REDWOOD_BOWL.center.x+r*Math.cos(a),
    z:REDWOOD_BOWL.center.z+r*Math.sin(a)};
   const flare=.028*Math.sin(a*27+f*4)+.022*Math.cos(a*43-f*8);
   // Near the open eastern roll-in, recess the bark skin completely.
   const rise=split<.43?0:.025+.028*Math.max(0,flare);
   barkVertices.push(p.x,ride(p)+rise,p.z);
   const grain=.47+.26*Math.sin(a*37+f*1.5)+.12*Math.cos(a*59-f*5);
   barkMix.copy(barkDark).lerp(barkLight,THREE.MathUtils.clamp(grain,0,1));
   barkColors.push(barkMix.r,barkMix.g,barkMix.b);
  }
 }
 for(let k=0;k<barkAzimuths;k++)for(let j=0;j<barkRings;j++){
  const a=k*(barkRings+1)+j,b=a+1,d=a+barkRings+1;
  barkFaces.push(a,b,d,b,d+1,d);
 }
 const barkG=geometry(new THREE.BufferGeometry());
 barkG.setAttribute("position",new THREE.Float32BufferAttribute(barkVertices,3));
 barkG.setAttribute("color",new THREE.Float32BufferAttribute(barkColors,3));
 barkG.setIndex(barkFaces);barkG.computeVertexNormals();
 const bowlBark=new THREE.Mesh(barkG,material("#ffffff",
  {vertexColors:true,side:THREE.DoubleSide,roughness:1}));
 bowlBark.name="stump-bowl-outer-bark-apron";
 bowlBark.castShadow=false;bowlBark.receiveShadow=true;group.add(bowlBark);
 const stumpFlutes:Part[]=[],stumpRoots:Part[]=[];
 for(let j=0;j<72;j++){
  const a=(j+.5)*Math.PI*2/72;
  if(Math.abs(Math.atan2(Math.sin(a-.15),Math.cos(a-.15)))<.46)continue;
  for(let k=0;k<10;k++){
   const r1=REDWOOD_BOWL.rimRadius+.27+
    k*(REDWOOD_BOWL.barkRadius-REDWOOD_BOWL.rimRadius)/10;
   const r2=r1+(REDWOOD_BOWL.barkRadius-REDWOOD_BOWL.rimRadius)/10;
   const sample=(r:number)=>{
    const p={x:REDWOOD_BOWL.center.x+r*Math.cos(a),
     z:REDWOOD_BOWL.center.z+r*Math.sin(a)};
    return onRide(p,.07);
   };
   stumpFlutes.push(beam(sample(r1),sample(r2),.018+(j%7)*.005));
  }
  if(j%5===0){
   const r=REDWOOD_BOWL.barkRadius-.27;
   const aPoint={x:REDWOOD_BOWL.center.x+r*Math.cos(a),
    z:REDWOOD_BOWL.center.z+r*Math.sin(a)};
   const endR=r+.55;
   const bPoint={x:REDWOOD_BOWL.center.x+endR*Math.cos(a+.055),
    z:REDWOOD_BOWL.center.z+endR*Math.sin(a+.055)};
   stumpRoots.push(beam(onRide(aPoint,.03),
    new THREE.Vector3(bPoint.x,terrainHeight(bPoint.x,bPoint.z)+.02,bPoint.z),.095));
  }
 }
 pooled("stump-bowl-longitudinal-bark",stumpFlutes,darkTimber);
 pooled("stump-bowl-flared-roots",stumpRoots,bark);
 const landmarkGroup=new THREE.Group();
 landmarkGroup.name="sequoia-tunnel-and-timber-loop";
 for(const child of group.children.slice(landmarkStart))
  landmarkGroup.add(child);
 group.add(landmarkGroup);

 // The dark bark shoulder is painted on this SINGLE sampled riding mesh.
 // No intersecting decorative shell, hidden fascia or extra draw call.

 // Subtle carved annual rings and a thin coping line, interrupted at the
 // opening. Never place any wood roughness in the wheel-height function.
 const rimSegments=72;
 const annualRings:Part[]=[],innerCoping:Part[]=[];
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

 }
 pooled("redwood-growth-rings",annualRings,grain);
 pooled("split-redwood-coping",innerCoping,metal);

 // The split entrance keeps subtle cross-cut end grain, with no vertical
 // bark beams that could resemble barriers across a rideable lip.
 const woodEndGrain:Part[]=[];
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
 // Cross-cut growth lines on both open log ends and two bark edges.
 // The log is split lengthwise so visitors can enter without a head collider.
 for(const side of [-1,1]){
  for(const inset of [.4,.65,.9]){
   const x=GROVE_LOG.center.x+side*(GROVE_LOG.halfLength-inset);
   for(let z=GROVE_LOG.center.z-GROVE_LOG.halfWidth;
    z<GROVE_LOG.center.z+GROVE_LOG.halfWidth;z+=.15){
    woodEndGrain.push(beam(onRide({x,z},.05),onRide({x,z:z+.15},.05),.018));
   }
  }
 }
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
 // Plank arch crossing the granite garden. Every joint is subdivided
 // across the smooth camber and samples exactly the same wheel surface.
 for(let x=GROVE_BRIDGE.center.x-GROVE_BRIDGE.halfLength+.15;
   x<GROVE_BRIDGE.center.x+GROVE_BRIDGE.halfLength;x+=.33){
  for(let z=GROVE_BRIDGE.center.z-GROVE_BRIDGE.halfWidth;
    z<GROVE_BRIDGE.center.z+GROVE_BRIDGE.halfWidth;z+=.21){
   plankSeams.push(beam(onRide({x,z},.048),onRide({x,z:Math.min(z+.21,GROVE_BRIDGE.center.z+GROVE_BRIDGE.halfWidth)},.048),.012));
  }
 }
 for(const side of [-1,1]){
  const z=GROVE_BRIDGE.center.z+side*GROVE_BRIDGE.halfWidth;
  for(let x=GROVE_BRIDGE.center.x-GROVE_BRIDGE.halfLength;
    x<GROVE_BRIDGE.center.x+GROVE_BRIDGE.halfLength;x+=.2){
   sideRails.push(beam(onRide({x,z},.065),onRide({x:x+.2,z},.065),.055));
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
