import {ARCADE_CAVE,arcadeCaveFloorHeight,caveHalfWidth,mountainSurfaceHeight} from "./model";

export type CavernArtSurface="left"|"right"|"ceiling"|"floor"|"back";
export type CavernArtTheme="sports"|"anime"|"comedy"|"sport-anime"|"identity"|"shasta"|"neural";
export type CavernMural={
 id:string;theme:CavernArtTheme;surface:CavernArtSurface;
 z0:number;z1:number;v0:number;v1:number;title:string;
 /** Horizontal authored patch range on the BACK wall only. */
 u0?:number;u1?:number;
 tags:readonly string[];
};
export type CavernPoint={x:number;y:number;z:number};
export type CavernSurfaceSample={position:CavernPoint;normal:CavernPoint};

/** Exact piecewise 17-ring profile of the active arcade shell in
 * worldRenderer.ts. The double interpolation matters: interpolating
 * mountain height directly would put decals behind the triangles. */
export function caveArtRing(index:number):CavernPoint[]{
 const i=Math.max(0,Math.min(16,index));
 const z=ARCADE_CAVE.entrance.z+i/16*ARCADE_CAVE.tunnelDepth;
 const w=caveHalfWidth(z),floor=arcadeCaveFloorHeight({x:16,z});
 const roof=Math.min(floor+6.05,mountainSurfaceHeight(16,z)-.3);
 const jitter=Math.sin(i*1.7)*.08;
 const shoulder=floor+(roof-floor)*.58;
 return [
  {x:16-w,y:floor-.08,z},
  {x:16-w-.15,y:shoulder,z},
  {x:16-w*.72,y:roof-.28+jitter,z},
  {x:16,y:roof+jitter,z},
  {x:16+w*.72,y:roof-.22,z},
  {x:16+w+.15,y:shoulder,z},
  {x:16+w,y:floor-.08,z},
 ];
}
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const interp=(a:CavernPoint,b:CavernPoint,t:number):CavernPoint=>({
 x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t),
});
function ringAt(z:number):CavernPoint[]{
 const exact=(z-ARCADE_CAVE.entrance.z)/ARCADE_CAVE.tunnelDepth*16;
 const i=Math.max(0,Math.min(15,Math.floor(exact)));
 const t=Math.max(0,Math.min(1,exact-i));
 const a=caveArtRing(i),b=caveArtRing(i+1);
 return a.map((p,k)=>interp(p,b[k],t));
}
export function sampleCavernArt(surface:CavernArtSurface,z:number,u:number,v:number,offset=.045):CavernSurfaceSample|null{
 if(![z,u,v,offset].every(Number.isFinite)||offset<.016||offset>.10||
  u<0||u>1||v<0||v>1)return null;
 if(surface!=="back"&&(z<ARCADE_CAVE.entrance.z+.04||
  z>ARCADE_CAVE.wall.z-.05))return null;
 const r=ringAt(Math.min(-63.05,Math.max(-81.95,z)));
 let p:CavernPoint,n:CavernPoint;
 if(surface==="left"||surface==="right"){
  const indices=surface==="left"?[0,1,2]:[6,5,4];
  const h=v*2; // cover the complete wall-to-roof two-facet surface
  const s=Math.max(0,Math.min(1.999999,h));
  const j=Math.floor(s),t=s-j;
  p=interp(r[indices[j]],r[indices[j+1]],t);
  const a=r[indices[j]],b=r[indices[j+1]];
  // Per-facet inward normal for stone-art projection. When viewed from
  // the cave center, this normal moves the ink into open air.
  const dx=b.x-a.x,dy=b.y-a.y;
  const sign=surface==="left"?1:-1;
  let nx=sign*Math.abs(dy),ny=surface==="left"?-dx:dx;
  const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;
  n={x:nx,y:ny,z:0};
 }else if(surface==="ceiling"){
  const a=u<.5?r[2]:r[3],b=u<.5?r[3]:r[4];
  p=interp(a,b,u<.5?u*2:(u-.5)*2);
  n={x:0,y:-1,z:0};
 }else if(surface==="floor"){
  const w=caveHalfWidth(z)-.18;
  const x=16+(u-.5)*2*w;
  p={x,y:arcadeCaveFloorHeight({x,z})-.08,z};
  n={x:0,y:1,z:0};
 }else{
  if(Math.abs(z-ARCADE_CAVE.wall.z)>.6)return null;
  p={x:16+(u-.5)*12.45,y:arcadeCaveFloorHeight(ARCADE_CAVE.wall)+.48+v*5.45,z:-63.32};
  n={x:0,y:0,z:-1};
 }
 return {position:{x:p.x+n.x*offset,y:p.y+n.y*offset,z:p.z+n.z*offset},normal:n};
}

/** The title band is above the current center-game hitbox.
 * Art near the two side niches should remain at z<=-68. */
export function validateCavernMural(m:CavernMural):string|null{
 if(!m.id||!m.title||!m.tags||!["left","right","ceiling","floor","back"].includes(m.surface))return "invalid descriptor";
 if(![m.z0,m.z1,m.v0,m.v1].every(Number.isFinite))return "nonfinite coordinates";
 const u0=m.u0,u1=m.u1;
 if((u0!==undefined||u1!==undefined)&&
  (u0===undefined||u1===undefined||
   !Number.isFinite(u0)||!Number.isFinite(u1)||
   u0<0||u1>1||u0>=u1))return "invalid back patch";
 if(m.surface==="back"){
  const header=m.v0>=.62&&m.v1<=.91&&m.u0===undefined&&m.u1===undefined;
  const side=m.v0>=.14&&m.v1<=.60&&(
   (m.u0!==undefined&&m.u1!==undefined&&m.u1<=.28)||
   (m.u0!==undefined&&m.u1!==undefined&&m.u0>=.72)
  );
  if(m.z0!==-63.32||m.z1!==-63.32||(!header&&!side))
   return "game title overlap";
 }else if(m.z0< -81.96||m.z1> -63.1||m.z1<=m.z0||m.v0<0||m.v1>1||m.v1<=m.v0){
  return "cave shell bounds";
 }
 if(m.surface!=="back"&&m.z1>-67.9&&m.v0<.8)return "game panel sightline";
 return null;
}
