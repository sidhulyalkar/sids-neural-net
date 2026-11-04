import * as THREE from "three/src/Three.Core.js";
import {terrainHeight} from "@/lib/world/model";
import {groundHeight} from "@/lib/world/activities";
import {
  ALPINE_HALFPIPE,ALPINE_KICKERS,ALPINE_PARK_RAILS,ALPINE_FEATURE_BOXES,
  GLACIER_PASSAGE,ALPINE_ROCK_RIBS,alpineSportClearance,alpineHalfpipeStrength,glacierPassageStrength,glacierVaultHeight,
} from "@/lib/world/alpineTerrainPark";
import {GeometryBatch} from "./worldGeometry";

type V=[number,number,number];
const P=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);

/** A single triangulated, finely sampled skin. Underlying support is the exact
 * terrainHeight/groundHeight used for skis, not an unrelated decorative ramp. */
function sheet(
  minX:number,maxX:number,minZ:number,maxZ:number,
  nx:number,nz:number,sample:(x:number,z:number)=>V,
  visible:(x:number,z:number)=>number,
){
  const positions:number[]=[],colors:number[]=[];
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
    const x0=minX+(maxX-minX)*ix/nx,
      x1=minX+(maxX-minX)*(ix+1)/nx;
    const z0=minZ+(maxZ-minZ)*iz/nz,
      z1=minZ+(maxZ-minZ)*(iz+1)/nz;
    // Trim the fine snow overlay to actual sculpted ground. An unrestricted
    // rectangular snow patch would visibly bleed into adjacent biomes.
    if(visible((x0+x1)/2,(z0+z1)/2)<.015)continue;
    const a=sample(x0,z0),b=sample(x1,z0),
      c=sample(x1,z1),d=sample(x0,z1);
    for(const vertex of [a,b,c,a,c,d]){
      positions.push(...vertex);
      const pale=new THREE.Color(
        vertex[2]<-75?"#d9eaf1":vertex[0]>20?"#eff7f8":"#dfeff4");
      const variation=.965+.025*Math.sin(vertex[0]*2.7+vertex[2]*.73);
      colors.push(pale.r*variation,pale.g*variation,pale.b*variation);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingSphere();
  return g;
}

/** Thin ice arch with open ends, sampled from the real ski floor. Rock strata
 * wrap up and around the corridor with no cap blocking either entrance. */
function iceVault(){
  const g=GLACIER_PASSAGE,positions:number[]=[],colors:number[]=[];
  const xSteps=48,angleSteps=28;
  const palette=["#a8d8ed","#8ac9e3","#76b9d6","#b5e6f2","#7cbdd8"];
  const push=(p:THREE.Vector3,x:number,theta:number)=>{
    positions.push(p.x,p.y,p.z);
    const shade=palette[
      Math.min(palette.length-1,Math.floor((theta/Math.PI)*palette.length))];
    const col=new THREE.Color(shade);
    const entry=Math.min((x-g.westX)/3,(g.eastX-x)/3,1);
    col.lerp(new THREE.Color("#e4faff"),
      .10+.28*Math.max(0,1-entry));
    // Distinct compressed ice bands and a soft, cold-light variation.
    // Geometry stays unchanged at the rideable inner vault surface.
    const dense=.91+.055*Math.sin(x*2.6+theta*18.4)+
      .035*Math.cos(theta*38.0-x*.81);
    colors.push(col.r*dense,col.g*dense,col.b*dense);
  };
  const point=(x:number,theta:number,outer:boolean)=>{
    const width=outer?g.outerHalfWidth:g.innerHalfWidth;
    const z=g.centerZ+width*Math.cos(theta);
    // The ice shell and ski headroom use the SAME analytic vault measured
    // from the carved centerline floor, not two independent roof shapes.
    const centerFloor=terrainHeight(x,g.centerZ);
    const y=glacierVaultHeight({x,z},centerFloor,outer)??centerFloor;
    return P(x,y+.045,z);
  };
  for(let ix=0;ix<xSteps;ix++)for(let ia=0;ia<angleSteps;ia++){
    const xa=g.westX+(g.eastX-g.westX)*ix/xSteps,
      xb=g.westX+(g.eastX-g.westX)*(ix+1)/xSteps;
    const a=Math.PI*ia/angleSteps,b=Math.PI*(ia+1)/angleSteps;
    for(const outer of [false,true]){
      const q=[point(xa,a,outer),point(xb,a,outer),
        point(xb,b,outer),point(xa,b,outer)];
      const corners=outer?[q[0],q[2],q[1],q[0],q[3],q[2]]:
        [q[0],q[1],q[2],q[0],q[2],q[3]];
      for(const v of corners)push(v,v.x,Math.abs(a+b)/2);
    }
  }
  const mesh=new THREE.BufferGeometry();
  mesh.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  mesh.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  mesh.computeVertexNormals();mesh.computeBoundingSphere();
  return mesh;
}

/** Crisp, contiguous snow jump skins, analytically sampled from the ramp
 * support; no scattered cube/cylinder snow lumps at the actual takeoffs. */
function snowKickerDeck(){
  const vertices:number[]=[];
  const rings=28,cross=16;
  const push=(x:number,z:number)=>vertices.push(x,groundHeight({x,z})+.085,z);
  for(const jump of ALPINE_KICKERS){
    const h=jump.heading,length=Math.hypot(h.x,h.z)||1,
      fx=h.x/length,fz=h.z/length,rx=fz,rz=-fx;
    const sample=(along:number,across:number)=>{
      const x=jump.point.x+fx*along+rx*across;
      const z=jump.point.z+fz*along+rz*across;
      return {x,z};
    };
    for(let i=0;i<rings;i++)for(let k=0;k<cross;k++){
      const u0=i/rings,u1=(i+1)/rings,
        v0=k/cross,v1=(k+1)/cross;
      const a=sample(-4.0+u0*4.9,-1.65+v0*3.3),
        b=sample(-4.0+u1*4.9,-1.65+v0*3.3),
        c=sample(-4.0+u1*4.9,-1.65+v1*3.3),
        d=sample(-4.0+u0*4.9,-1.65+v1*3.3);
      for(const p of [a,b,c,a,c,d])push(p.x,p.z);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geo.computeVertexNormals();geo.computeBoundingSphere();
  return geo;
}

function addBar(batch:GeometryBatch,cylinder:THREE.CylinderGeometry,
  a:THREE.Vector3,b:THREE.Vector3,radius:number,color:string){
  const midpoint=a.clone().add(b).multiplyScalar(.5);
  const direction=b.clone().sub(a),length=direction.length();
  if(length<1e-4)return;
  // The cylinder's local +Y axis follows the same segment as grinding.
  const quaternion=new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0,1,0),direction.normalize());
  const rotation=new THREE.Euler().setFromQuaternion(quaternion);
  batch.add(cylinder,color,midpoint,new THREE.Vector3(radius,length,radius),rotation);
}

/** Entire static park is four batched/fine-grained meshes plus one snow sheet.
 * No per-frame rebuild, texture download, animation timer or extra light. */
export function createWorldAlpineTerrainPark(scene:THREE.Scene){
  const owned:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],meshes:THREE.Mesh[]=[];
  const attach=(geo:THREE.BufferGeometry,material:THREE.Material,name:string)=>{
    const mesh=new THREE.Mesh(geo,material);
    mesh.name=name;mesh.receiveShadow=true;scene.add(mesh);
    owned.push(geo);materials.push(material);meshes.push(mesh);
    return mesh;
  };
  const h=ALPINE_HALFPIPE;
  attach(sheet(h.centerX-h.rimHalfWidth-h.outerFeather,
      h.centerX+h.rimHalfWidth+h.outerFeather,h.startZ,h.endZ,48,84,
      (x,z)=>[x,terrainHeight(x,z)+.065,z],
      (x,z)=>alpineHalfpipeStrength({x,z})),
    new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,
      roughness:.89,metalness:0}),
    "alpine-halfpipe-analytic-snow-skin");
  const g=GLACIER_PASSAGE;
  attach(sheet(g.westX-2,g.eastX+2,g.centerZ-3.8,g.centerZ+3.8,70,30,
      (x,z)=>[x,terrainHeight(x,z)+.07,z],
      (x,z)=>glacierPassageStrength({x,z})),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:.54,
      side:THREE.DoubleSide,metalness:.06}),
    "glacier-passage-exact-ski-floor");
  attach(iceVault(),
    // Stable ice scattering approximation. Opaque vertex-colored layers
    // avoid alpha-sort shimmer between the inner and outer concentric skins.
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:.37,
      metalness:.025,side:THREE.DoubleSide,depthWrite:true}),
    "glacier-blue-ice-open-arch");

  const batch=new GeometryBatch();
  const cylinder=new THREE.CylinderGeometry(1,1,1,9);
  const stone=new THREE.IcosahedronGeometry(1,1);
  const snowcap=new THREE.ConeGeometry(1,1,6);
  const railCount=ALPINE_PARK_RAILS.length;
  for(const rail of ALPINE_PARK_RAILS){
    if(rail.chainId==="alpine-box-spine")continue;
    const a=P(rail.a.x,terrainHeight(rail.a.x,rail.a.z)+rail.lift+.16,rail.a.z);
    const b=P(rail.b.x,terrainHeight(rail.b.x,rail.b.z)+rail.liftEnd+.16,rail.b.z);
    addBar(batch,cylinder,a,b,rail.radius,rail.chainId==="alpine-rainbow"?
      "#788d99":"#789eac");
    for(const root of [a,b]){
      const floor=terrainHeight(root.x,root.z);
      addBar(batch,cylinder,P(root.x,floor,root.z),
        P(root.x,root.y-.13,root.z),.045,"#687d84");
    }
  }
  // Make the wide box a continuous contact-matched slab, not a washboard
  // of transverse cylinders. Fine top tessellation samples groundHeight,
  // which already includes the tapered deck and its real landing support.
  for(const box of ALPINE_FEATURE_BOXES){
    const dx=box.to.x-box.from.x,dz=box.to.z-box.from.z,length=Math.hypot(dx,dz);
    const side={x:dz/length,z:-dx/length},tops:number[]=[];
    const point=(t:number,cross:number)=>{
      const x=box.from.x+dx*t+side.x*cross*box.halfWidth*.91;
      const z=box.from.z+dz*t+side.z*cross*box.halfWidth*.91;
      return P(x,groundHeight({x,z})+.038,z);
    };
    for(let i=0;i<36;i++)for(let k=0;k<6;k++){
      const a=point(i/36,-1+2*k/6),
        b=point((i+1)/36,-1+2*k/6),
        c=point((i+1)/36,-1+2*(k+1)/6),
        d=point(i/36,-1+2*(k+1)/6);
      for(const p of [a,b,c,a,c,d])tops.push(p.x,p.y,p.z);
    }
    const top=new THREE.BufferGeometry();
    top.setAttribute("position",new THREE.Float32BufferAttribute(tops,3));
    top.computeVertexNormals();
    batch.add(top,"#a6bdc3",P(0,0,0),new THREE.Vector3(1,1,1));
    top.dispose();
    // The polished edges and low steel feet are visibly supported, and
    // are too far below the ski for phantom grind acquisition.
    for(const sign of [-1,1]){
      for(let i=0;i<36;i++){
        const a=point(i/36,sign),b=point((i+1)/36,sign);
        addBar(batch,cylinder,a,b,.045,"#d4e1e3");
      }
    }
    for(const t of [.16,.5,.84]){
      const p=point(t,0),y=terrainHeight(p.x,p.z);
      addBar(batch,cylinder,P(p.x,y+.035,p.z),P(p.x,p.y-.07,p.z),
        .09,"#77858b");
    }
  }
  // Halfpipe coping is a quiet snow/ice seam, following the same bank profile
  // as the physically rideable terrain rather than an ungrounded chrome pipe.
  for(const sign of [-1,1]){
    const x=h.centerX+sign*h.rimHalfWidth;
    for(let j=0;j<42;j++){
      const z0=h.startZ+(h.endZ-h.startZ)*j/42;
      const z1=h.startZ+(h.endZ-h.startZ)*(j+1)/42;
      addBar(batch,cylinder,P(x,terrainHeight(x,z0)+.15,z0),
        P(x,terrainHeight(x,z1)+.15,z1),.067,"#c2dfe9");
    }
  }
  // Rock stratification outside active corridors. Static, deterministic,
  // deliberately sparse; rock silhouettes are not invisible ski colliders.
  ALPINE_ROCK_RIBS.forEach(([x,z,height],i)=>{
    if(alpineSportClearance({x,z}))return;
    const y=terrainHeight(x,z);
    batch.add(stone,i%3===0?"#586975":i%3===1?"#788994":"#657880",
      P(x,y+height*.32,z),new THREE.Vector3(1.2+height*.11,height*.75,1.1));
    batch.add(snowcap,i%2===0?"#dde8e9":"#e8f0ef",
      P(x,y+height*.72,z),new THREE.Vector3(.95,height*.40,1.0));
  });
  attach(snowKickerDeck(),new THREE.MeshStandardMaterial({
    color:"#f3f8fb",roughness:.92,side:THREE.DoubleSide}),
    "alpine-large-snow-kicker-rideable-surfaces");
  const geometry=batch.finish();
  attach(geometry,new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.83,metalness:.02,
    side:THREE.DoubleSide}),"alpine-park-rails-boxes-snow-and-ridge-strata");
  cylinder.dispose();stone.dispose();snowcap.dispose();
  return {meshes,rails:railCount,jumps:ALPINE_KICKERS.length,
    dispose(){for(const mesh of meshes)scene.remove(mesh);
      for(const g of owned)g.dispose();
      for(const m of materials)m.dispose();}
  };
}
