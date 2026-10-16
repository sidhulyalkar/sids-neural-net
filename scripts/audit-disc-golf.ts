import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {auditDiscGolfFairways} from "../lib/world/discGolfFairway";
import {DISC_GOLF_HOLES,DISC_GOLF_VERSION} from "../lib/world/discGolf";
import {discGolfSurfaceIsWater,discGolfSurfaceHeight} from "../lib/world/discGolfSurface";
import {discGolfRoundSummary,emptyDiscGolfRound} from "../lib/world/discGolfRound";

const report=auditDiscGolfFairways();
const dir=process.env.WORLD_AUDIT_DIR??"artifacts/world";
mkdirSync(dir,{recursive:true});
const issues=report.filter(h=>
 discGolfSurfaceIsWater(DISC_GOLF_HOLES[h.hole-1].tee)||
 discGolfSurfaceIsWater(DISC_GOLF_HOLES[h.hole-1].target)||
 !Number.isFinite(discGolfSurfaceHeight(DISC_GOLF_HOLES[h.hole-1].target)));
const summary={
 version:DISC_GOLF_VERSION,
 holes:report.length,
 coursePar:discGolfRoundSummary(emptyDiscGolfRound()).coursePar,
 totalGates:report.reduce((n,h)=>n+h.gateCount,0),
 totalRouteDistance:Math.round(report.reduce((n,h)=>n+h.routeDistance,0)),
 flaggedFairways:report.filter(h=>h.risks.length>0).length,
 invalidTeesOrBaskets:issues.length,
 disclaimer:"Analytic heightfield/landmark survey. Rendered tree and rock collision, camera occlusion, walkability and actual shot lines require human browser playtest.",
};
writeFileSync(join(dir,"disc-golf-fairways.json"),
 JSON.stringify({summary,report},null,2)+"\n");
const markdown=[
 "# Disc Golf · fairway review",
 "",
 "Automated heightfield review only. These findings flag placement risks; they do not certify a fairway as clear or playable.",
 "",
 "| # | Hole | Par | Route | Gates | Straight | Δ elev | Tee → basket | Tee slope | Green slope | Tee clearance | Green clearance | First shot | Risks |",
 "| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |",
 ...report.map(h=>`| ${h.hole} | ${h.name} | ${h.par} | ${h.routeDistance} | ${h.gateCount} | ${h.distance} | ${h.climb} | ${h.teeBiome} → ${h.basketBiome} | ${h.teeSlope} | ${h.basketSlope} | ${h.teeFeatureClearance} | ${h.greenFeatureClearance} | ${h.firstShotDistance} (${h.firstShotPhase}) | ${h.risks.join(", ")||"none"} |`),
 "",
 "Review basket clearance (trees, boulders, markers), route silhouettes, short putts, water retries and hazards in a real browser before release.",
 "",
];
writeFileSync(join(dir,"disc-golf-fairways.md"),markdown.join("\n"));
console.log(JSON.stringify(summary,null,2));
for(const h of report)console.log(
 `HOLE ${h.hole} ${h.id}: span=${h.distance}; slopes=${h.teeSlope}/${h.basketSlope}; clear=${h.teeFeatureClearance}/${h.greenFeatureClearance}; coast=${h.teeCoastMargin}/${h.greenCoastMargin}; first=${h.firstShotDistance}@${h.firstShotPower}% ${h.firstShotPhase}; legs=${h.legDistances.join("/")}; gates=${h.gateReachable.map((v,i)=>(v?"pass":"FAIL")+"@"+h.gateClearance[i]).join("/")}; risks=${h.risks.join(",")||"none"}`
);
if(report.length!==9||issues.length>0||
 report.some(h=>h.risks.includes("steep-tee")||
  h.risks.includes("crowded-tee")||
  h.risks.includes("crowded-green")||
  (h.teeSupport!=="pier"&&h.risks.includes("coastal-tee"))||
  h.risks.includes("coastal-green")||
  h.risks.includes("short-first-shot")||
  h.risks.includes("first-shot-water")||
  h.basketSlope>1.45||h.risks.includes("unsafe-gate")||
  h.risks.includes("short-leg")||
  h.risks.includes("missed-gate-from-staging")))process.exitCode=1;
