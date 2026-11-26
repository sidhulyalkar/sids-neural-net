/** Pull coordinates are normalized by the interaction surface dimensions.
 * Backward depth sets speed; lateral displacement sets release angle independently.
 */
export function discGolfSlingshot(dx:number,dy:number){
 const finite=Number.isFinite(dx)&&Number.isFinite(dy);
 const depth=finite?Math.max(0,Math.min(1,dy)):0;
 const rawSide=finite?Math.max(-1,Math.min(1,dx)):0;
 // Ignore small hand jitter; ramp continuously beyond the center corridor.
 const side=Math.abs(rawSide)<=.04?0:
  Math.sign(rawSide)*(Math.abs(rawSide)-.04)/.96;
 const power=Math.round(depth*100);
 return {power,accuracy:depth>=.06&&side!==0?-side:0,armed:finite&&depth>=.06,
  depth,side};
}
