/** Terrain-aware stance anchor for Shasta's stylized four-paw rig.
 *
 * The solver owns only ground-contact targets. It does NOT rotate the body,
 * alter locomotion, or claim to be anatomical inverse kinematics. The renderer
 * converts each anchored world-space paw into Shasta's articulated local rig.
 * All mutable values are allocated once; the per-frame call is allocation-free.
 */
export type ShastaFootPoint={x:number;y:number;z:number};
export type ShastaFootAnchor={
  x:number;y:number;z:number;active:boolean;
  resets:number;
};
export function createShastaFootAnchor():ShastaFootAnchor{
  return {x:0,y:0,z:0,active:false,resets:0};
}
export const SHASTA_CONTACT_TETHER=.34;
export const SHASTA_PAW_CENTER_HEIGHT=.055;
export function updateShastaFootContact(
  anchor:ShastaFootAnchor,
  nominal:Readonly<ShastaFootPoint>,
  canPlant:boolean,
  surfaceHeight:(x:number,z:number)=>number,
  out:ShastaFootPoint,
  tether=SHASTA_CONTACT_TETHER,
):boolean{
  // Suspended paws have no stationary world-space anchor.
  if(!canPlant||!Number.isFinite(nominal.x)||!Number.isFinite(nominal.y)||
      !Number.isFinite(nominal.z)){
    anchor.active=false;
    out.x=nominal.x;out.y=nominal.y;out.z=nominal.z;
    return false;
  }
  const distance=Math.hypot(nominal.x-anchor.x,nominal.z-anchor.z);
  const maxTether=Math.max(.05,Math.min(.7,tether));
  // Reset when the pelvis moves farther than reachable joint limits, rather
  // than stretching a limb across the island. Such resets remain observable.
  if(!anchor.active||distance>maxTether){
    anchor.x=nominal.x;
    anchor.z=nominal.z;
    anchor.active=true;
    anchor.resets++;
  }
  const support=surfaceHeight(anchor.x,anchor.z);
  if(!Number.isFinite(support)){
    anchor.active=false;
    out.x=nominal.x;out.y=nominal.y;out.z=nominal.z;
    return false;
  }
  anchor.y=support+SHASTA_PAW_CENTER_HEIGHT;
  out.x=anchor.x;out.y=anchor.y;out.z=anchor.z;
  return true;
}
