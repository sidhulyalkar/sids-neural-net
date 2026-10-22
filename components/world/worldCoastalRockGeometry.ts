import * as THREE from "three/src/Three.Core.js";
import {SEA_SURFACE} from "@/lib/world/model";
import type {JetSkiRock,JetSkiArch,JetSkiRockKind} from "@/lib/world/jetSkiCourse";

/** Faceted, strata-aware offshore geology; no model downloads or per-frame
 * geometry allocation. Rendered bases stay within the collision radii (+.65m
 * hull margin), and crowns never put a hidden obstacle in the arch opening. */
const palette:Record<JetSkiRockKind,[number,number,number]>={
 sandstone:[.66,.52,.37],
 "sea-stack":[.41,.44,.41],
 basalt:[.19,.24,.26],
};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const colorFor=(kind:JetSkiRockKind,level:number,fracture:number)=>{
 const base=palette[kind];
 // Angular weathering, dark wet foot, and fine bedding/joint planes.
 const wet=.73+.27*clamp(level*3,0,1);
 const bands=kind==="basalt"?
   .93+.08*Math.sin(level*45+fracture):
   .91+.11*Math.sin(level*33+fracture*1.3);
 const value=wet*bands*(.95+.06*Math.sin(fracture*3));
 return base.map(c=>clamp(c*value,0,1)) as [number,number,number];
};
const finish=(positions:number[],colors:number[],indices:number[])=>{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 return geometry;
};
/** Tapered sea stacks with eroded necks, wide wave-cut feet and chipped lips.
 * Their largest plan radius is <1.2x the rock's collider radius. */
export function createSeaStackGeometry(rock:JetSkiRock):THREE.BufferGeometry{
 const sides=13,levels=10,vertices:number[]=[],colors:number[]=[],indices:number[]=[];
 const seed=rock.point.x*.81+rock.point.z*1.17;
 for(let j=0;j<levels;j++){
  const t=j/(levels-1);
  const lowFoot=.13*Math.exp(-t*20);
  const taper=1-.48*t-.13*Math.sin(Math.PI*t)+lowFoot;
  const undercut=.07*Math.sin(t*13+seed);
  for(let i=0;i<sides;i++){
   const angle=i/sides*Math.PI*2;
   const angular=.049*Math.sin(angle*5+seed)+
     .035*Math.sin(angle*9-seed*.4+t*3.1);
   const radius=rock.radius*clamp(taper+undercut+angular,.32,1.14);
   const edge=(i%4===0?.09:0)*Math.sin(t*13+seed);
   vertices.push(Math.cos(angle)*radius,
    SEA_SURFACE-1.7+rock.height*t+edge,
    Math.sin(angle)*radius);
   colors.push(...colorFor(rock.kind,t,angle+seed));
  }
 }
 for(let j=0;j<levels-1;j++)for(let i=0;i<sides;i++){
  const a=j*sides+i,b=j*sides+(i+1)%sides;
  const c=(j+1)*sides+i,d=(j+1)*sides+(i+1)%sides;
  indices.push(a,c,b,b,c,d);
 }
 for(let i=1;i<sides-1;i++)
  indices.push((levels-1)*sides,(levels-1)*sides+i+1,(levels-1)*sides+i);
 return finish(vertices,colors,indices);
}
/** A continuous coastal arch, not a roof draped over two tall sea stacks.
 *
 * One connected concave cross-section forms both load-bearing feet and the
 * bridge. The clear central void is actual empty geometry, not a transparent
 * texture or a hidden collider. Local X spans the arch; local Y is height
 * above sea level; the parent rotates X into the offshore race passage.
 * The lower foot envelope is deliberately within the existing two rock
 * colliders, which remain collision-authoritative in jetSkiCourse.ts.
 */
export function createSeaArchGeometry(arch:JetSkiArch):THREE.BufferGeometry{
 const half=arch.span*.5,h=arch.height,foot=-1.8;
 const lava=arch.kind==="basalt";
 // Unequal shoulders, gently weathered crest and deeply carved underside.
 // Values are fractions of half-span and height, respectively.
 const outline:[number,number][]=[
  [-1.22,foot],[-1.25,h*.09],[-1.18,h*.39],[-1.04,h*.67],
  [-.85,h*.91],[-.59,h*.99],[-.25,h*1.025],[.10,h*1.03],
  [.43,h*.99],[.76,h*.92],[1.00,h*.76],[1.16,h*.46],
  [1.24,h*.13],[1.22,foot],
  [.748,foot],[.748,h*.12],[.72,h*.31],[.62,h*.47],
  [.46,h*.62],[.22,h*.71],[-.13,h*.72],[-.39,h*.65],
  [-.58,h*.49],[-.71,h*.28],[-.75,h*.105],[-.755,foot],
 ];
 const shape=new THREE.Shape();
 outline.forEach(([x,y],i)=>i?shape.lineTo(x*half,y):shape.moveTo(x*half,y));
 shape.closePath();
 const depth=lava?4.35:4.2;
 const raw=new THREE.ExtrudeGeometry(shape,{
  depth,steps:1,bevelEnabled:true,bevelThickness:.22,
  bevelSize:.14,bevelSegments:2,curveSegments:1,
 });
 raw.translate(0,0,-depth*.5);
 // Add bounded surface detail to the flat faces. Subdividing also prevents
 // giant triangulation facets and gives light a believable eroded surface.
 const src=raw.getAttribute("position");
 const positions:number[]=[];
 const seed=arch.center.x*.19+arch.center.z*.083;
 const sculpt=(x:number,y:number,z:number):[number,number,number]=>{
  const upper=clamp(y/h,0,1);
  const grain=.085*Math.sin(x*.64+y*.37+seed)+
   .065*Math.sin(x*.24-y*.91+seed*.7);
  return [
   x+.035*Math.sin(y*.43+x*.71+seed)*(y>0?1:.35),
   y+.025*Math.sin(x*.72+y*.35+seed),
   z*(1-.12*upper)+Math.sign(z)*grain,
  ];
 };
 const emit=(a:number[],b:number[],c:number[])=>{
  for(const p of [a,b,c])positions.push(...sculpt(p[0],p[1],p[2]));
 };
 const mid=(a:number[],b:number[])=>[
  (a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5,
 ];
 for(let i=0;i<src.count;i+=3){
  const a=[src.getX(i),src.getY(i),src.getZ(i)];
  const b=[src.getX(i+1),src.getY(i+1),src.getZ(i+1)];
  const c=[src.getX(i+2),src.getY(i+2),src.getZ(i+2)];
  const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
  emit(a,ab,ca);emit(ab,b,bc);emit(ca,bc,c);emit(ab,bc,ca);
 }
 raw.dispose();
 const geo=new THREE.BufferGeometry();
 geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
 geo.computeVertexNormals();
 const p=geo.getAttribute("position"),n=geo.getAttribute("normal"),colors:number[]=[];
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),x=p.getX(i);
  // Submerged toes are darker, sunlit ledges warmer, inner ceiling shaded.
  const level=clamp((y+.65)/(h+1),0,1);
  const fracture=seed+x*.14+p.getZ(i)*.18;
  const [r,g,b]=colorFor(arch.kind,level,fracture);
  const shade=clamp(.89+.12*Math.max(0,n.getY(i))-
   .16*Math.max(0,-n.getY(i))+
   .055*Math.sin(y*(lava?2.4:1.8)+fracture*.8),.65,1.08);
  colors.push(clamp(r*shade,0,1),clamp(g*shade,0,1),clamp(b*shade,0,1));
 }
 geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 geo.computeBoundingBox();
 geo.computeBoundingSphere();
 geo.userData.coastalArchStyle="continuous-wave-cut-v2";
 return geo;
}
