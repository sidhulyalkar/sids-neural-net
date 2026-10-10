import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DESERT_JUMPS, jumpWorld } from "../lib/world/desertTrack";
import { rampImpulseAt, stepAirborne } from "../lib/world/activities";
import { terrainHeight } from "../lib/world/model";

/** Deterministic measured cross sections, not a substitute for a browser capture. */
const output=process.env.WORLD_AUDIT_DIR??"artifacts/world";
mkdirSync(output,{recursive:true});
const speed=11;
const data=DESERT_JUMPS.filter(j=>j.kind==="gap").map(jump=>{
  const from=-5,to=jump.landing+4;
  const ground=Array.from({length:Math.ceil((to-from)/0.12)+1},(_,i)=>{
    const along=Math.min(to,from+i*0.12),p=jumpWorld(jump,along);
    return {along,y:terrainHeight(p.x,p.z)};
  });
  const origin=terrainHeight(jump.point.x,jump.point.z);
  let y=origin,v=rampImpulseAt(jump.point,jump.heading,"bike",speed)!.impulse;
  const flight=[{along:0,y}];
  for(let i=1;i<35;i++) {
    const along=i*speed*0.05,p=jumpWorld(jump,along);
    const integrated=stepAirborne(y,v,terrainHeight(p.x,p.z),0.05);
    y=integrated.y;v=integrated.verticalSpeed;
    flight.push({along,y});
    if(integrated.airHeight===0)break;
  }
  return {id:jump.id,obstacle:jump.obstacle,gapStart:jump.gapStart,
    gapEnd:jump.gapEnd,landing:jump.landing,origin,ground,flight};
});
writeFileSync(join(output,"desert-gap-profiles.json"),
  JSON.stringify({speed,units:"world units",note:"analytic terrain and 50ms ballistic integration",gaps:data},null,2)+"\n");
const w=820,h=310*data.length+65;
const panels=data.map((entry,i)=>{
  const top=i*310+42,plotLeft=66,plotRight=790,plotTop=top+35,plotBottom=top+228;
  const from=-5,to=entry.landing+4;
  const allY=[...entry.ground,...entry.flight].map(p=>p.y);
  const yMin=Math.min(...allY)-0.9,yMax=Math.max(...allY)+0.7;
  const px=(x:number)=>plotLeft+(x-from)/(to-from)*(plotRight-plotLeft);
  const py=(y:number)=>plotBottom-(y-yMin)/(yMax-yMin)*(plotBottom-plotTop);
  const line=(pts:readonly {along:number;y:number}[])=>
    pts.map(p=>`${px(p.along).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  return `<g font-family="system-ui" font-size="13">
  <text x="24" y="${top}" font-weight="bold" font-size="17" fill="#282a24">${entry.id} · ${entry.obstacle}</text>
  <rect x="${px(entry.gapStart)}" y="${plotTop}" width="${px(entry.gapEnd)-px(entry.gapStart)}" height="${plotBottom-plotTop}" fill="#dfd5c2" opacity="0.45"/>
  <line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" stroke="#766d61" stroke-width="1"/>
  <line x1="${px(0)}" y1="${plotTop}" x2="${px(0)}" y2="${plotBottom}" stroke="#af7d48" stroke-dasharray="4,4"/>
  <line x1="${px(entry.landing)}" y1="${plotTop}" x2="${px(entry.landing)}" y2="${plotBottom}" stroke="#859079" stroke-dasharray="4,4"/>
  <polyline points="${line(entry.ground)}" fill="none" stroke="#6f5440" stroke-width="3"/>
  <polyline points="${line(entry.flight)}" fill="none" stroke="#247b97" stroke-width="2.5" stroke-dasharray="6,3"/>
  <text x="${px(0)+4}" y="${plotTop-5}" font-size="11" fill="#785434">takeoff</text>
  <text x="${px(entry.landing)+4}" y="${plotTop-5}" font-size="11" fill="#536e58">landing</text>
  <text x="${plotLeft}" y="${plotBottom+22}" fill="#5f5c54" font-size="11">solid brown: real ground · dashed blue: simulated bike flight at speed 11 · shaded: gap</text>
  <text x="${plotLeft}" y="${plotBottom+38}" fill="#5f5c54" font-size="11">X: along-track distance · Y: world elevation · no ground-support deletion</text>
  </g>`;
}).join("");
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="100%" height="100%" fill="#f8f7f2"/>
<text x="24" y="25" font-family="system-ui" font-size="19" font-weight="bold" fill="#282a24">Joshua basin · authored terrain / flight audit</text>
${panels}
</svg>`;
writeFileSync(join(output,"desert-gap-profiles.svg"),svg);
console.log("Measured real terrain/flight profiles:",data.map(d=>({
  id:d.id,soilMin:Math.min(...d.ground.map(p=>p.y)),
  flightMax:Math.max(...d.flight.map(p=>p.y)),
  landedAt:d.flight.at(-1)!.along,
})));
