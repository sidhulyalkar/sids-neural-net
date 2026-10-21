/** Ground interaction for a spinning disc. Units: metres, m/s, seconds.
 * This is a bounded Coulomb-friction / restitution model with terrain-normal
 * collisions and distinct shallow skips vs. surface skids. Disc mold friction
 * and restitution are nominal until matched with filmed impact data.
 */
import type {Point} from "./model";
import type {AeroVector} from "./discGolfAerodynamics";
import type {RigidDisc} from "./discGolfRigidBody";
import {discNormal,dot} from "./discGolfRigidBody";
export type GroundDiscContact={mode:"air"|"slide"|"roll";impacts:number;elapsed:number;rollAngle?:number;rollSign?:number};
export type Surface= (p:Point)=>number;
export type GroundImpulse={velocity:AeroVector;position:{x:number;y:number;z:number};
 contact:GroundDiscContact;settled:boolean};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function discGroundNormal(p:Point,height:Surface):AeroVector{
 const e=.35;
 const sx=(height({x:p.x+e,z:p.z})-height({x:p.x-e,z:p.z}))/(2*e);
 const sz=(height({x:p.x,z:p.z+e})-height({x:p.x,z:p.z-e}))/(2*e);
 const m=Math.hypot(sx,1,sz);
 return {x:-sx/m,y:1/m,z:-sz/m};
}
export function discImpact(velocity:AeroVector,p:Point,height:Surface,
 rigid:RigidDisc|null,impacts:number):GroundImpulse{
 const normal=discGroundNormal(p,height);
 const vn=dot(velocity,normal),speed=Math.hypot(velocity.x,velocity.y,velocity.z);
 const tangential={x:velocity.x-vn*normal.x,
  y:velocity.y-vn*normal.y,z:velocity.z-vn*normal.z};
 const tangentSpeed=Math.hypot(tangential.x,tangential.y,tangential.z);
 // A flat shallow-angle rim impact can skip; nose-down/steep impacts skid.
 const discPlane=rigid?discNormal(rigid):{x:0,y:1,z:0};
 const rimInclination=Math.acos(clamp(dot(discPlane,normal),-1,1));
 const shallow=Math.abs(vn)/Math.max(.01,speed)<.34;
 const skip=impacts<2&&vn< -1.4&&tangentSpeed>8&&shallow&&rimInclination<.56;
 if(skip){
  const bounce=.34+(tangentSpeed>17?.07:0);
  return {velocity:{
   x:tangential.x*.81-normal.x*vn*bounce,
   y:tangential.y*.81-normal.y*vn*bounce,
   z:tangential.z*.81-normal.z*vn*bounce,
  },position:{x:p.x,y:height(p)+.19,z:p.z},
   contact:{mode:"air",impacts:impacts+1,elapsed:0},settled:false};
 }
 if(rimInclination>.68&&tangentSpeed>3){
  // A near-vertical landing can convert translation into edge rolling.
  // The rotational phase advances from traveled distance divided by radius.
  return {velocity:{x:tangential.x*.78,y:0,z:tangential.z*.78},
   position:{x:p.x,y:height(p)+.16,z:p.z},
   contact:{mode:"roll",impacts:impacts+1,elapsed:0,rollAngle:0,
     rollSign:dot(discPlane,{x:0,y:1,z:0})>=0?1:-1},settled:false};
 }
 // Surface friction turns forward momentum into a skid, rather than
 // teleporting the disc to its exact first-contact point.
 const frictionLoss=clamp(.83-.13*rimInclination,0.45,.83);
 const velocityOut={x:tangential.x*frictionLoss,
  y:tangential.y*frictionLoss,z:tangential.z*frictionLoss};
 return {velocity:velocityOut,position:{x:p.x,y:height(p)+.16,z:p.z},
  contact:{mode:"slide",impacts:impacts+1,elapsed:0},
  settled:tangentSpeed<1.2};
}
export function stepGroundSlide(position:{x:number;y:number;z:number},
 velocity:AeroVector,contact:GroundDiscContact,dt:number,height:Surface):GroundImpulse{
 const h=clamp(Number.isFinite(dt)?dt:0,0,.05);
 const p={x:position.x,z:position.z};
 const n=discGroundNormal(p,height);
 const along=Math.hypot(velocity.x,velocity.z);
 // Gravity projected onto the terrain tangent plus dry-vegetation friction.
 const g=10.8,mu=.42;
 const tangentG={x:g*n.y*n.x,y:0,z:g*n.y*n.z};
 const friction=(contact.mode==="roll"?.14:mu)*g*Math.max(.2,n.y);
 const decel=along>1e-6?Math.min(along/h,friction):0;
 const vx=velocity.x+(tangentG.x-(along>1e-6?velocity.x/along*decel:0))*h;
 const vz=velocity.z+(tangentG.z-(along>1e-6?velocity.z/along*decel:0))*h;
 const next={x:p.x+vx*h,z:p.z+vz*h};
 const nextPosition={...next,y:height(next)+.16};
 const elapsed=contact.elapsed+h;
 const traveled=Math.hypot(vx*h,vz*h);
 const settled=Math.hypot(vx,vz)<.65||elapsed>2.5;
 return {position:nextPosition,velocity:{x:settled?0:vx,y:0,z:settled?0:vz},
  contact:{...contact,elapsed,rollAngle:contact.mode==="roll"?
    (contact.rollAngle??0)+(contact.rollSign??1)*traveled/.108:
    contact.rollAngle},settled};
}
