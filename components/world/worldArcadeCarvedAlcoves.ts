import type * as THREE from "three/src/Three.Core.js";
import {ARCADE_CAVE,arcadeCaveFloorHeight} from "@/lib/world/model";

/**
 * Non-interactive rock around arcade selection panels. The former cave
 * contained only thin L-shaped outlines on completely empty flat slabs.
 * Broad faceted basalt fragments now give the game bays a carved silhouette.
 * Rock never enters the 3.6 x 2.65m reserved selection rectangles.
 */
type Three=Pick<typeof import("three/src/Three.Core.js"),
 "BufferGeometry"|"Float32BufferAttribute"|"MeshStandardMaterial"|
 "Color"|"Mesh"|"DoubleSide">;
type Point=readonly [number,number,number];
type Niche={x:number;z:number;yaw:number;accent:string};
const NICHES:readonly Niche[]=[
 {x:10.35,z:-67,yaw:Math.PI/2,accent:"#79cde6"},
 {x:16,z:-63.45,yaw:0,accent:"#f0cd99"},
 {x:21.65,z:-67,yaw:-Math.PI/2,accent:"#c9a6e8"},
];
function seeded(seed:number){
 let v=seed|0;return()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return(v>>>0)/4294967296;};
}
export function createArcadeCarvedAlcoves(three:Three){
 const positions:number[]=[],indices:number[]=[],colors:number[]=[];
 const floor=arcadeCaveFloorHeight(ARCADE_CAVE.wall);
 const panelY=floor+2.35;
 const rnd=seeded(0x75afe221);
 function triangle(a:Point,b:Point,c:Point,shade:readonly number[]){
  const start=positions.length/3;
  positions.push(...a,...b,...c);
  for(let i=0;i<3;i++)colors.push(...shade);
  indices.push(start,start+1,start+2);
 }
 for(const [index,niche] of NICHES.entries()){
  const base=new three.Color(index===0?"#544640":index===1?"#514640":"#50454c");
  const quartz=new three.Color(niche.accent);
  // Uses the exact game-frame local basis; face offset is toward open cave.
  const point=(u:number,v:number,offset:number):Point=>[
   niche.x+Math.cos(niche.yaw)*u+Math.sin(niche.yaw)*offset,
   panelY+v,
   niche.z-Math.sin(niche.yaw)*u-Math.cos(niche.yaw)*offset,
  ];
  const chips:{u:number;v:number;r:number}[]=[];
  for(const side of [-1,1])for(let k=0;k<9;k++){
   chips.push({
    u:side*(2.31+(rnd()-.5)*.07),
    v:-1.44+k*.38+(rnd()-.5)*.08,r:.15+rnd()*.10,
   });
  }
  for(let k=0;k<11;k++)chips.push({
   u:-2.15+k*.43+(rnd()-.5)*.08,
   v:1.78+(rnd()-.5)*.07,r:.14+rnd()*.08,
  });
  for(let k=0;k<9;k++)chips.push({
   u:-2.11+k*.52+(rnd()-.5)*.09,
   v:-1.76+(rnd()-.5)*.05,r:.11+rnd()*.07,
  });
  for(const [i,chip] of chips.entries()){
   const sides=6,angle=rnd()*Math.PI*2;
   const depth=.15+rnd()*.055;
   const face:Point[]=[],back:Point[]=[];
   for(let k=0;k<sides;k++){
    const a=angle+k*Math.PI*2/sides;
    const r=chip.r*(.77+.23*rnd());
    const du=Math.cos(a)*r,dv=Math.sin(a)*r;
    face.push(point(chip.u+du,chip.v+dv,depth));
    back.push(point(chip.u+du*1.06,chip.v+dv*1.06,.022));
   }
   const pale=.73+rnd()*.23;
   const shade:[number,number,number]=[
    base.r*pale,base.g*pale,base.b*pale,
   ];
   const dark=shade.map(x=>x*.65);
   const highlight=i%7===0?
    [quartz.r*.48+base.r*.52,
     quartz.g*.48+base.g*.52,
     quartz.b*.48+base.b*.52]:
    shade.map(x=>x*1.09);
   const center=point(chip.u,chip.v,depth+.045);
   for(let k=0;k<sides;k++){
    const j=(k+1)%sides;
    triangle(center,face[k],face[j],k%3===0?highlight:shade);
    triangle(face[k],back[k],back[j],dark);
    triangle(face[k],back[j],face[j],dark);
   }
  }
 }
 const g=new three.BufferGeometry();
 g.setAttribute("position",new three.Float32BufferAttribute(positions,3));
 g.setAttribute("color",new three.Float32BufferAttribute(colors,3));
 g.setIndex(indices);g.computeVertexNormals();
 const material=new three.MeshStandardMaterial({
  vertexColors:true,roughness:.97,metalness:0,
  side:three.DoubleSide,polygonOffset:true,
  polygonOffsetFactor:-.65,polygonOffsetUnits:-.65,
 });
 const mesh=new three.Mesh(g,material);
 mesh.name="arcade-carved-basalt-alcove-frames";
 mesh.castShadow=false;mesh.receiveShadow=true;
 mesh.raycast=()=>{};mesh.renderOrder=2;
 return mesh;
}
