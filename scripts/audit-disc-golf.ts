import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {auditDiscGolfFairways} from "../lib/world/discGolfFairway";
import {DISC_GOLF_HOLES,DISC_GOLF_VERSION} from "../lib/world/discGolf";
import {isWater,terrainHeight} from "../lib/world/model";
import {discGolfRoundSummary,emptyDiscGolfRound} from "../lib/world/discGolfRound";

const report=auditDiscGolfFairways();
const dir=process.env.WORLD_AUDIT_DIR??"artifacts/world";
mkdirSync(dir,{recursive:true});
const issues=report.filter(h=>isWater(DISC_GOLF_HOLES[h.hole-1].tee)||
 isWater(DISC_GOLF_HOLES[h.hole-1].target)||
 !Number.isFinite(terrainHeight(DISC_GOLF_HOLES[h.hole-1].target.x,
   DISC_GOLF_HOLES[h.hole-1].target.z)));
const summary={
 version:DISC_GOLF_VERSION,
 holes:report.length,
 coursePar:discGolfRoundSummary(emptyDiscGolfRound()).coursePar,
 flaggedFairways:report.filter(h=>h.risks.length>0).length,
 invalidTeesOrBaskets:issues.length,
 disclaimer:"Analytic heightfield/landmark survey. Rendered tree and rock collision, camera occlusion, walkability and actual shot lines require human browser playtest.",
};
writeFileSync(join(dir,"disc-golf-fairways.json"),
 JSON.stringify({summary,report},null,2)+"\n");
const markdown=[
 "# Island disc golf · fairway review",
 "",
 "Automated heightfield review only. These findings flag placement risks; they do not certify a fairway as clear or playable.",
 "",
 "| # | Hole | Par | Distance | Δ elevation | Tee → basket | Max slope | Risks |",
 "| ---: | --- | ---: | ---: | ---: | --- | ---: | --- |",
 ...report.map(h=>`| ${h.hole} | ${h.name} | ${h.par} | ${h.distance} | ${h.climb} | ${h.teeBiome} → ${h.basketBiome} | ${h.maxSlope} | ${h.risks.join(", ")||"none detected"} |`),
 "",
 "Review basket clearance (trees, boulders, markers), route silhouettes, short putts, water retries and hazards in a real browser before release.",
 "",
];
writeFileSync(join(dir,"disc-golf-fairways.md"),markdown.join("\n"));
console.log(JSON.stringify(summary,null,2));
if(report.length!==9||issues.length>0)process.exitCode=1;
