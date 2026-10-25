import type * as THREE from "three/src/Three.Core.js";
import {sampleCavernArt,type CavernArtSurface} from "@/lib/world/arcadeCavernSurface";

/**
 * The inner rock is surface-conforming, not an obstruction. Two tileable
 * authored-at-startup pigment maps replace the repeating brick/crack texture:
 * four octaves of seamless mineral color and a separately encoded height map.
 * Do not add the mesh to gameplay collision or target raycasting.
 */
type StoneThree=Pick<typeof import("three/src/Three.Core.js"),
 "CanvasTexture"|"BufferGeometry"|"Float32BufferAttribute"|
 "MeshStandardMaterial"|"Color"|"DoubleSide"|"Mesh"|
 "SRGBColorSpace"|"RepeatWrapping"|"LinearMipmapLinearFilter">;

const EDGE=512;
function rand(seed:number){
 let v=seed|0;
 return ()=>{v=(Math.imul(1664525,v)+1013904223)|0;return(v>>>0)/4294967296;};
}
function hash(x:number,y:number,n:number){
 let h=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(n,2246822519))|0;
 h=Math.imul(h^(h>>>13),1274126177);
 return((h^(h>>>16))>>>0)/4294967295;
}
function noise(x:number,y:number,period:number){
 const fx=x*period,fy=y*period;
 const ix=Math.floor(fx),iy=Math.floor(fy);
 const tx=fx-ix,ty=fy-iy;
 const u=tx*tx*(3-2*tx),v=ty*ty*(3-2*ty);
 const a=hash(ix%period,iy%period,period);
 const b=hash((ix+1)%period,iy%period,period);
 const c=hash(ix%period,(iy+1)%period,period);
 const d=hash((ix+1)%period,(iy+1)%period,period);
 return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
function rockTextures(){
 const albedo=document.createElement("canvas");
 const height=document.createElement("canvas");
 albedo.width=height.width=EDGE;albedo.height=height.height=EDGE;
 const ctx=albedo.getContext("2d"),hc=height.getContext("2d");
 if(!ctx||!hc)throw Error("Cavern rock drawing context unavailable");
 const pix=ctx.createImageData(EDGE,EDGE),relief=hc.createImageData(EDGE,EDGE);
 const a=pix.data,b=relief.data;
 for(let y=0;y<EDGE;y++)for(let x=0;x<EDGE;x++){
  const u=x/EDGE,v=y/EDGE,i=(y*EDGE+x)*4;
  const broad=noise(u,v,4),stone=noise(u,v,13);
  const fine=noise(u,v,47),grain=noise(u,v,119);
  // Mineral islands and fine grain; avoid synthetic grid seams or long
  // horizontal fake brick joints. Values wrap exactly at the atlas edges.
  const rise=(broad-.5)*.48+(stone-.5)*.27+
   (fine-.5)*.14+(grain-.5)*.07;
  const strata=Math.abs(stone-.52);
  const darkSeam=strata<.026?-.095:0;
  const mineral=Math.max(0,Math.min(1,.54+rise+darkSeam));
  const amber=Math.max(0,noise(u+.23,v+.11,7)-.62)*.24;
  const lichen=Math.max(0,noise(u+.54,v+.4,13)-.70)*.27;
  a[i]=Math.round(47+mineral*47+amber*33);
  a[i+1]=Math.round(45+mineral*43+lichen*35);
  a[i+2]=Math.round(43+mineral*38-amber*23);
  a[i+3]=255;
  const elevation=Math.max(0,Math.min(1,.52+rise*1.4+darkSeam*1.7));
  const h=Math.round(102+elevation*135);
  b[i]=b[i+1]=b[i+2]=h;b[i+3]=255;
 }
 ctx.putImageData(pix,0,0);hc.putImageData(relief,0,0);
 // Angular hairline fractures in a single material layer. They are
 // intermittent and mineral-scale, not an all-over maze of white scribbles.
 const rnd=rand(0x5a22bf09);
 for(let i=0;i<60;i++){
  const x=rnd()*EDGE,y=rnd()*EDGE;
  const angle=(rnd()-.5)*2.1;
  const span=15+rnd()*67;
  ctx.beginPath();hc.beginPath();
  ctx.moveTo(x,y);hc.moveTo(x,y);
  let cx=x,cy=y;
  for(let j=0;j<4;j++){
   cx+=Math.cos(angle+(rnd()-.5)*.65)*span/4;
   cy+=Math.sin(angle+(rnd()-.5)*.65)*span/4;
   ctx.lineTo(cx,cy);hc.lineTo(cx,cy);
  }
  ctx.strokeStyle=i%6===0?"rgba(178,137,94,.14)":"rgba(10,15,20,.32)";
  ctx.lineWidth=.65+rnd()*1.5;ctx.stroke();
  hc.strokeStyle="rgba(7,7,7,.5)";hc.lineWidth=ctx.lineWidth;hc.stroke();
 }
 return {albedo,height};
}
function gpuTexture(
 canvas:HTMLCanvasElement,three:StoneThree,isColor:boolean,
):THREE.Texture{
 const t=new three.CanvasTexture(canvas);
 if(isColor)t.colorSpace=three.SRGBColorSpace;
 t.wrapS=three.RepeatWrapping;t.wrapT=three.RepeatWrapping;
 t.generateMipmaps=true;t.minFilter=three.LinearMipmapLinearFilter;
 t.anisotropy=4;
 return t;
}
export function createArcadeStoneLining(three:StoneThree){
 const {albedo,height}=rockTextures();
 const texture=gpuTexture(albedo,three,true);
 const heightTexture=gpuTexture(height,three,false);
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
   const across=spec.surface==="floor"||spec.surface==="ceiling"?s:t;
   const p=sampleCavernArt(spec.surface,z,across,s,.019);
   if(!p)throw Error("Stone outside cavern "+spec.surface);
   // A fraction of a centimeter of facet displacement remains safely
   // below the artwork offset and gameplay collision surface.
   const facets=Math.sin(t*128.2+s*93.1)*Math.cos(t*52.4-s*73.2);
   const bump=(facets+1)*.004;
   vertices.push(p.position.x+p.normal.x*bump,
    p.position.y+p.normal.y*bump,
    p.position.z+p.normal.z*bump);
   uvs.push(t*(spec.surface==="back"?2.7:3.3),s*2.05);
   const warm=spec.surface==="ceiling"?.94:spec.surface==="floor"?1.05:1;
   // Faceted geology shading uses broad variation; not repeating grid lines.
   const l=.82+.11*Math.sin(t*23.8+s*7.3)+.055*Math.cos(t*17.4-s*11.3);
   color.setRGB(l*warm,l*warm*.96,l*warm*.9);
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
  map:texture,vertexColors:true,roughness:.96,
  bumpMap:heightTexture,bumpScale:.13,
  roughnessMap:heightTexture,side:three.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:-.35,polygonOffsetUnits:-.35,
 });
 const mesh=new three.Mesh(g,mat);
 mesh.name="arcade-layered-mineral-basalt-lining";
 mesh.castShadow=false;mesh.receiveShadow=true;
 mesh.raycast=()=>{};mesh.renderOrder=1;
 return {mesh,texture,heightTexture,triangles:indices.length/3};
}
