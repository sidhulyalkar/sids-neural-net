import type * as THREE from "three/src/Three.Core.js";
import {sampleCavernArt,type CavernArtSurface} from "@/lib/world/arcadeCavernSurface";
/** Interior-only rough basalt lining. Shares the exact 17-ring collision-
 * independent shell sampler with pigment. It is always behind the painted
 * surface, cannot intercept raycasts and doesn't alter the cave floor. */
type StoneThree=Pick<typeof import("three/src/Three.Core.js"),
 "CanvasTexture"|"BufferGeometry"|"Float32BufferAttribute"|
 "MeshStandardMaterial"|"Color"|"DoubleSide"|"Mesh"|
 "SRGBColorSpace"|"RepeatWrapping"|"LinearMipmapLinearFilter">;
function seeded(){
 let n=0x34ab19cd;
 return ()=>{n=Math.imul(1664525,n)+1013904223|0;return(n>>>0)/4294967296;};
}
function basaltCanvas(){
 const c=document.createElement("canvas");c.width=512;c.height=512;
 const ctx=c.getContext("2d");
 if(!ctx)throw Error("Cavern stone texture unavailable");
 const r=seeded();
 const sky=ctx.createLinearGradient(0,0,512,512);
 sky.addColorStop(0,"#554940");sky.addColorStop(.5,"#342f30");
 sky.addColorStop(1,"#50433b");ctx.fillStyle=sky;ctx.fillRect(0,0,512,512);
 // Broad geological planes make the stone read as carved fractured basalt,
 // unlike a uniformly gray 3D shell.
 for(let i=0;i<110;i++){
  const x=r()*512,y=r()*512,scale=20+120*r();
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.lineTo(x+scale*(.2+r()),y-scale*(.15+r()*.4));
  ctx.lineTo(x+scale*(.75+r()*.4),y+scale*.4);
  ctx.lineTo(x+scale*(.1+r()*.5),y+scale*(.8+r()*.2));
  ctx.closePath();ctx.fillStyle=i%4===0?"rgba(13,18,21,.14)":
   i%3===0?"rgba(194,130,84,.09)":"rgba(154,157,140,.055)";
  ctx.fill();
 }
 for(let i=0;i<280;i++){
  const x=r()*512,y=r()*512,s=8+r()*58;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+s,y+(r()-.5)*19);
  ctx.lineTo(x+s+(r()-.5)*11,y+(r()-.5)*49);
  ctx.lineWidth=.4+r()*2.3;ctx.strokeStyle=i%7===0?
   "rgba(174,125,81,.25)":"rgba(10,16,19,.29)";
  ctx.stroke();
 }
 for(let i=0;i<1850;i++){
  const x=r()*512,y=r()*512,size=.3+r()*2.8;
  ctx.fillStyle=i%7===0?"rgba(146,135,104,.3)":
   i%5===0?"rgba(95,130,108,.27)":"rgba(205,190,162,.10)";
  ctx.fillRect(x,y,size,size*(.5+r()));
 }
 return c;
}
export function createArcadeStoneLining(three:StoneThree){
 const tex=new three.CanvasTexture(basaltCanvas());
 tex.colorSpace=three.SRGBColorSpace;
 tex.wrapS=three.RepeatWrapping;tex.wrapT=three.RepeatWrapping;
 tex.generateMipmaps=true;tex.minFilter=three.LinearMipmapLinearFilter;
 tex.anisotropy=4;
 const vertices:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
 const color=new three.Color();
 const sections:{surface:CavernArtSurface;start:number;end:number;length:number;breadth:number}[]=[
  {surface:"left",start:-81.91,end:-63.17,length:80,breadth:14},
  {surface:"right",start:-81.91,end:-63.17,length:80,breadth:14},
  {surface:"ceiling",start:-81.91,end:-63.17,length:80,breadth:18},
  {surface:"floor",start:-81.91,end:-63.17,length:80,breadth:14},
  {surface:"back",start:-63.32,end:-63.32,length:34,breadth:18},
 ];
 for(const spec of sections){
  const base=vertices.length/3;
  for(let i=0;i<=spec.length;i++)for(let j=0;j<=spec.breadth;j++){
   const t=i/spec.length,s=j/spec.breadth;
   const z=spec.start+(spec.end-spec.start)*t;
   // Hold the stone below the decal offset .056. Very small faceted
   // displacement adds depth without touching the player's collision mesh.
   const p=sampleCavernArt(spec.surface,z,t,s,.019);
   if(!p)throw Error("Stone outside cavern "+spec.surface);
   const fine=Math.sin(t*273.7+s*132.4)*Math.sin(t*109.3-s*218.8);
   const bump=(fine+1)*.004;
   vertices.push(p.position.x+p.normal.x*bump,
    p.position.y+p.normal.y*bump,
    p.position.z+p.normal.z*bump);
   uvs.push(t*(spec.surface==="back"?2.5:3.8),s*1.9);
   const l=.73+.12*Math.sin(t*53+s*17)+.08*Math.sin(t*213-s*93);
   const warm=spec.surface==="ceiling"?.92:spec.surface==="floor"?1.08:1;
   color.setRGB(l*warm,l*warm*.94,l*warm*.86);
   colors.push(color.r,color.g,color.b);
  }
  for(let i=0;i<spec.length;i++)for(let j=0;j<spec.breadth;j++){
   const a=base+i*(spec.breadth+1)+j;
   indices.push(a,a+spec.breadth+1,a+1,
    a+1,a+spec.breadth+1,a+spec.breadth+2);
  }
 }
 const g=new three.BufferGeometry();
 g.setAttribute("position",new three.Float32BufferAttribute(vertices,3));
 g.setAttribute("uv",new three.Float32BufferAttribute(uvs,2));
 g.setAttribute("color",new three.Float32BufferAttribute(colors,3));
 g.setIndex(indices);g.computeVertexNormals();
 const mat=new three.MeshStandardMaterial({
  map:tex,vertexColors:true,roughness:.99,
  bumpMap:tex,bumpScale:.052,side:three.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:-.35,polygonOffsetUnits:-.35,
 });
 const mesh=new three.Mesh(g,mat);
 mesh.name="arcade-weathered-basalt-lining";
 mesh.castShadow=false;mesh.receiveShadow=true;
 mesh.raycast=()=>{};mesh.renderOrder=1;
 return {mesh,texture:tex,triangles:indices.length/3};
}
