import type {Point} from "./model";
import {JET_SKI_ROCKS} from "./jetSkiCourse";

/**
 * The volcanic arch is a real jet-ski obstacle, not a hologram.
 * Snorkelers and their camera must not travel through its submerged legs.
 *
 * Sweep the full movement segment to prevent tunneling on slow frames.
 * This never changes jet-ski or land collisions, only their shared marine
 * geometry contract. Any initial overlap is safely projected out.
 */
const SOUTH_ROCKS=JET_SKI_ROCKS.filter(r=>r.point.z< -96);
const EPS=.001;

export function southRockClearance(point:Point,margin=0):number{
 return Math.min(Infinity,...SOUTH_ROCKS.map(r=>
  Math.hypot(point.x-r.point.x,point.z-r.point.z)-(r.radius+margin)));
}
export function constrainSouthRockMove(from:Point,to:Point,margin=.75):Point {
 if(![from.x,from.z,to.x,to.z,margin].every(Number.isFinite))return {...from};
 const m=Math.max(.1,Math.min(3,margin));
 let out={...to};
 // Iterative correction handles rare simultaneous neighboring footprints.
 for(let pass=0;pass<2;pass++){
  let earliest=Infinity, rockHit:typeof SOUTH_ROCKS[number]|null=null;
  for(const rock of SOUTH_ROCKS){
   const radius=rock.radius+m,fx=from.x-rock.point.x,fz=from.z-rock.point.z;
   const dx=out.x-from.x,dz=out.z-from.z;
   const aa=dx*dx+dz*dz,bb=2*(fx*dx+fz*dz);
   const cc=fx*fx+fz*fz-radius*radius;
   // The caller may enter this region through a menu/old saved position.
   // Do not keep them trapped inside a rock when moving outward.
   if(cc<0){
    const ox=out.x-rock.point.x,oz=out.z-rock.point.z;
    const norm=Math.hypot(ox,oz)||Math.hypot(fx,fz)||1;
    const nx=norm<1e-7?1:Math.abs(ox)+Math.abs(oz)>1e-8?ox/norm:fx/norm;
    const nz=norm<1e-7?0:Math.abs(ox)+Math.abs(oz)>1e-8?oz/norm:fz/norm;
    out={x:rock.point.x+nx*(radius+EPS),z:rock.point.z+nz*(radius+EPS)};
    continue;
   }
   if(aa<1e-10)continue;
   const discriminant=bb*bb-4*aa*cc;
   if(discriminant<0)continue;
   const first=(-bb-Math.sqrt(discriminant))/(2*aa);
   if(first<0||first>1)continue;
   if(first<earliest){earliest=first;rockHit=rock;}
  }
  if(!rockHit)break;
  // Halt at the collision surface. The next frame allows tangent steering.
  const t=Math.max(0,earliest-EPS);
  out={x:from.x+(out.x-from.x)*t,z:from.z+(out.z-from.z)*t};
 }
 return out;
}
