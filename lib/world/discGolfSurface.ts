/** The raised pier is a real walking and disc-golf tee surface, not ocean.
 * All live throws, previews, tee markers, and course tests share this rule.
 * Elsewhere the default island terrain/water contracts remain unchanged.
 */
import {terrainHeight,isWater,type Point} from "./model";
import {jetSkiPierHeight} from "./jetSkiPier";
export function discGolfSurfaceHeight(p:Point):number{
 return jetSkiPierHeight(p)??terrainHeight(p.x,p.z);
}
export function discGolfSurfaceIsWater(p:Point):boolean{
 return jetSkiPierHeight(p)===null&&isWater(p);
}
