/** Authored static snow strata. Lengths are game-world units, comparable to
 * metres for tuning, NOT climate observations or independently simulated
 * snow accumulation. The existing rendered height is the TOP of the pack.
 * Bedrock/reference substrate is (rendered height - total snow depth).
 *
 * This contract is pure/deterministic. Only the render mesh's material
 * attributes qualify real snow; altitude by itself never qualifies snow.
 */
export type Snowpack={
  coverage:number;
  powderDepth:number;
  packedDepth:number;
  crust:number;
  ice:number;
  totalDepth:number;
};
export type SnowpackSampler=(x:number,z:number)=>Snowpack;
export type SnowResponse={
  edgeFactor:number;shearFactor:number;brakeFactor:number;
  dragFactor:number;estimatedSink:number;
};
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const smooth=(a:number,b:number,x:number)=>{
  const t=clamp((x-a)/(b-a));
  return t*t*(3-2*t);
};
const zero:Readonly<Snowpack>=Object.freeze({
  coverage:0,powderDepth:0,packedDepth:0,crust:0,ice:0,totalDepth:0,
});
export const BARE_SNOWPACK=zero;
export function makeSnowpack(coverage:number,powder:number,packed:number,crust:number,ice:number):Snowpack{
  const c=clamp(coverage);
  if(c<1e-6)return {...zero};
  const p=clamp(powder,0,2.5),h=clamp(packed,0,3.2);
  return {coverage:c,powderDepth:p,packedDepth:h,
    crust:clamp(crust),ice:clamp(ice),totalDepth:p+h};
}
// Stable baseline for synthetic all-snow experiments. Physics normalizes
// response around this pack, preserving previous deterministic tests.
export const GROOMED_SNOWPACK:Readonly<Snowpack>=Object.freeze(
  makeSnowpack(1,.06,.5,.5,.035));
export function uniformSnowpack(coverage:number):Snowpack{
  const c=clamp(coverage);
  return makeSnowpack(c,GROOMED_SNOWPACK.powderDepth*c,
    GROOMED_SNOWPACK.packedDepth*c,GROOMED_SNOWPACK.crust,
    GROOMED_SNOWPACK.ice);
}
/** Procedural, but fully deterministic and spatially continuous. The local
 * halfpipe is compacted/groomed. Leeward depressions collect powder, while
 * windward shoulders become shallow hardpack or exposed icy crust.
 * No geometry displacement, and no snow outside explicitly painted snow.
 */
export function authorSnowpack(x:number,z:number,topHeight:number,
  coverage:number,halfpipeWeight=0):Snowpack{
  const cover=clamp(coverage);
  if(cover<1e-6)return {...zero};
  const pipe=clamp(halfpipeWeight);
  const north=smooth(-31,-9,-z); // More accumulated snow toward northern summit.
  const elevation=smooth(7,25,topHeight);
  const wind=.5+.5*Math.sin(x*.36+z*.12)*Math.cos(z*.19-x*.08);
  const lee=.5+.5*Math.sin(x*.23-z*.27)*Math.sin(x*.15+z*.34);
  const drift=smooth(.45,.9,lee)*(1-.55*wind);
  const scour=smooth(.62,.96,wind)*(.4+.6*elevation);
  const ambientPowder=(.055+.21*north+.20*drift)*(1-.72*scour);
  const ambientPacked=.18+.28*elevation+.15*drift-.11*scour;
  // Halfpipe snow is pressed through repeated groomer passes. Along lips,
  // shallow glazed snow sits above a dense base, not a metre of loose powder.
  const rim=smooth(3.7,6.3,Math.abs(x-7));
  const pipePowder=.012+.048*lee*(1-.55*rim);
  const pipePacked=.42+.22*(1-rim)+.07*lee;
  const powder=cover*(ambientPowder*(1-pipe)+pipePowder*pipe);
  const packed=cover*Math.max(.04,ambientPacked*(1-pipe)+pipePacked*pipe);
  const ice=clamp((.035+.44*scour+.16*(1-north))*(1-pipe)+
    (.04+.40*rim)*pipe);
  const crust=clamp((.15+.42*scour)*(1-pipe)+(.45+.27*rim)*pipe);
  return makeSnowpack(cover,powder,packed,crust,ice);
}
function rawResponse(s:Snowpack){
  const ratio=s.packedDepth/(s.totalDepth+.05);
  const powder=clamp(s.powderDepth/.55);
  const edge=clamp(.62+.55*ratio+.16*s.crust-.72*s.ice-.23*powder,.10,1.5);
  const shear=clamp(.78+.30*ratio+.18*powder-.63*s.ice,.1,1.6);
  const brake=clamp(.76+.66*powder+.12*s.crust-.57*s.ice,.1,2);
  const drag=clamp(.77+1.9*s.powderDepth+.10*s.crust-.28*s.ice,.12,2.8);
  return {edge,shear,brake,drag};
}
const baseline=rawResponse(GROOMED_SNOWPACK);
/** Factors are applied ONLY after snow-covered cutting-edge contact was
 * resolved. This is a tunable phenomenological resistance law, not FEM. */
export function snowResponse(s:Snowpack,skiLoad=1):SnowResponse{
  if(s.coverage<=0||s.totalDepth<=0)return {
    edgeFactor:0,shearFactor:0,brakeFactor:0,dragFactor:0,estimatedSink:0};
  const raw=rawResponse(s);
  const sink=Math.min(s.powderDepth,
    Math.max(0,s.powderDepth*(.08+.25*clamp(skiLoad,0,1.5))*
      (1-.4*s.crust)));
  return {
    edgeFactor:raw.edge/baseline.edge,
    shearFactor:raw.shear/baseline.shear,
    brakeFactor:raw.brake/baseline.brake,
    dragFactor:raw.drag/baseline.drag,
    estimatedSink:sink,
  };
}
export function snowSurfaceLabel(s:Snowpack):"bare"|"thin"|"ice"|"packed"|"powder"{
  if(s.coverage<.08||s.totalDepth<.015)return "bare";
  if(s.totalDepth<.1)return "thin";
  if(s.ice>.48)return "ice";
  if(s.powderDepth>.18&&s.powderDepth>s.packedDepth*.3)return "powder";
  return "packed";
}
