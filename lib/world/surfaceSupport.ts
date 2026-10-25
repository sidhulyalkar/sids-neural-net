import type {Point} from './model';
export type SurfacePoint=Point&{y:number};
type Rings=readonly (readonly SurfacePoint[])[];
const bounds=new WeakMap<Rings,{min:number;max:number}[]>();
/** Uses exactly the a,b,c / a,c,d triangles drawn by ringSurface. */
export function ringSurfaceHeight(rings:Rings,p:Point):number|null{
 let boxes=bounds.get(rings);if(!boxes){boxes=rings.slice(0,-1).map((r,i)=>({min:Math.min(...r.map(p=>p.z),...rings[i+1].map(p=>p.z)),max:Math.max(...r.map(p=>p.z),...rings[i+1].map(p=>p.z))}));bounds.set(rings,boxes);}
 let height=-Infinity;
 const tri=(a:SurfacePoint,b:SurfacePoint,c:SurfacePoint)=>{
  const det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-9)return;
  const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/det,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/det;
  if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)height=Math.max(height,u*a.y+v*b.y+(1-u-v)*c.y);
 };
 for(let i=0;i<rings.length-1;i++){if(p.z<boxes[i].min-1e-7||p.z>boxes[i].max+1e-7)continue;const a=rings[i],b=rings[i+1];for(let j=0;j<a.length-1;j++){tri(a[j],b[j],b[j+1]);tri(a[j],b[j+1],a[j+1]);}}
 return Number.isFinite(height)?height:null;
}
/** Ease downward settling, but never interpolate upward through solid rock. */
export function settleSurfaceHeight(previous:number,support:number,dt:number){
 return Number.isFinite(previous)?Math.max(support,previous+(support-previous)*(1-Math.exp(-Math.max(0,dt)*9))):support;
}
