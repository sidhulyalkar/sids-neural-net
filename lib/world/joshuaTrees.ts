import {desertTrackSampleAt,desertTrackFrame,DESERT_TRACK_LENGTH,
 desertTrackClearance,desertBypassClearance,DESERT_JUMPS} from "./desertTrack";
import {terrainHeight,isWater,REGIONS,type Point} from "./model";
import {sportClearance} from "./activities";

export type JoshuaTreeSite=Point&{height:number;arms:number;rotation:number};
/** Restores a readable living Joshua forest along both sides of the course.
 * Sampling is DETERMINISTIC and follows the real serpentine centerline, not
 * randomly hoping the biome generator deposits trees near the track.
 * Neither the racing tread, runouts, bypasses nor checkpoints receive trunks.
 */
export function joshuaTreeSites():JoshuaTreeSite[]{
 const trees:JoshuaTreeSite[]=[];
 const steps=Math.ceil(DESERT_TRACK_LENGTH/7.0);
 for(let i=0;i<steps;i++){
  const s=(i+.41)*DESERT_TRACK_LENGTH/steps;
  const frame=desertTrackFrame(desertTrackSampleAt(s));
  const side=i%2?1:-1;
  const spread=5.0+(i*7%5)*.65;
  const x=frame.center.x-side*frame.tangent.z*spread;
  const z=frame.center.z+side*frame.tangent.x*spread;
  const p={x,z};
  if(x<19||x>58||z< -59||z>4||isWater(p)||
     desertTrackClearance(p)||desertBypassClearance(p)||
     sportClearance(p)||
     REGIONS.some(r=>Math.hypot(x-r.point.x,z-r.point.z)<4.8)||
     DESERT_JUMPS.some(j=>Math.hypot(x-j.point.x,z-j.point.z)<9)||
     trees.some(t=>Math.hypot(x-t.x,z-t.z)<3.3))continue;
  const slope=Math.hypot(terrainHeight(x+.4,z)-terrainHeight(x-.4,z),
    terrainHeight(x,z+.4)-terrainHeight(x,z-.4));
  if(slope>1.5)continue;
  trees.push({x,z,height:2.6+(i*13%11)*.25,
    arms:2+(i%3),rotation:(i*2.39996)%(Math.PI*2)});
 }
 return trees;
}
