import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  OCCUPANCY_DOMAIN, auditIslandCells, summarizeIsland,
  type OccupancyClass,
} from "../lib/world/occupancy";
import { DESERT_TRACK_LENGTH, desertTrackCenterline } from "../lib/world/desertTrack";

const step = 6;
const cells = auditIslandCells(step), summary = summarizeIsland(cells);
const dir = process.env.WORLD_AUDIT_DIR ?? "artifacts/world";
mkdirSync(dir, {recursive:true});
writeFileSync(join(dir,"island-occupancy.json"),
  JSON.stringify({ step, bounds:OCCUPANCY_DOMAIN, trackLength:DESERT_TRACK_LENGTH, summary, cells },null,2)+"\n");
writeFileSync(join(dir,"island-occupancy.csv"),
  "x,z,height,biome,slope,moisture,understory,category\n" +
  cells.map(c=>[c.x,c.z,c.height,c.biome,c.slope,c.moisture,c.understory,c.category].join(",")).join("\n")+"\n");

const colors: Record<OccupancyClass,string> = {
  water:"#477f9c",sport:"#ae8651",discovery:"#e8d9a4",
  "alpine-open":"#d8d6ce","beach-open":"#e5cfa2",
  "desert-open":"#c6ae83",forest:"#528264",
  ecotone:"#829769","needs-review":"#c47a7d",
};
const x0 = OCCUPANCY_DOMAIN.minX,z0=OCCUPANCY_DOMAIN.minZ;
const width = Math.round((OCCUPANCY_DOMAIN.maxX-x0)/step+1)*13;
const height = Math.round((OCCUPANCY_DOMAIN.maxZ-z0)/step+1)*13;
const squares = cells.map(c => `<rect x="${Math.round((c.x-x0)/step)*13}" y="${Math.round((OCCUPANCY_DOMAIN.maxZ-c.z)/step)*13}" width="12.2" height="12.2" fill="${colors[c.category]}" aria-label="${c.category}"></rect>`).join("");
const routePoints = desertTrackCenterline(160).map(p =>
  `${((p.x-x0)/step*13).toFixed(2)},${((OCCUPANCY_DOMAIN.maxZ-p.z)/step*13).toFixed(2)}`).join(" ");
const legend = Object.entries(colors).map(([name,color],i)=>
  `<rect x="${i%3*175}" y="${Math.floor(i/3)*24}" width="12" height="12" fill="${color}"/><text x="${i%3*175+19}" y="${Math.floor(i/3)*24+11}" font-size="12" fill="#2f302e">${name}</text>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(565,width+20)}" height="${height+160}" viewBox="0 0 ${Math.max(565,width+20)} ${height+160}">
<rect width="100%" height="100%" fill="#f7f5f0"/>
<text x="15" y="24" font-family="system-ui" font-size="17" font-weight="bold" fill="#2f302e">Sid's World · island occupancy baseline</text>
<text x="15" y="43" font-family="system-ui" font-size="11" fill="#555">Each tile is a deterministic classification, not a rendered-coverage measurement. North is up.</text>
<g transform="translate(15 56)">${squares}
  <polyline fill="none" stroke="#6c4e35" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${routePoints}"/>
  <circle cx="${((27-x0)/step*13).toFixed(2)}" cy="${((OCCUPANCY_DOMAIN.maxZ+10)/step*13).toFixed(2)}" r="3.5" fill="#faf7eb" stroke="#6c4e35" stroke-width="1.5"/>
</g>
<g transform="translate(15 ${height+70})" font-family="system-ui">${legend}</g>
<text x="15" y="${height+150}" font-family="system-ui" font-size="11" fill="#555">Course ${DESERT_TRACK_LENGTH.toFixed(1)} units · ${summary.reviewCandidates} candidate infill cells · survey spacing ${step}</text>
</svg>`;
writeFileSync(join(dir,"island-occupancy.svg"),svg);
console.log(JSON.stringify({output:dir,trackLength:DESERT_TRACK_LENGTH,summary},null,2));
