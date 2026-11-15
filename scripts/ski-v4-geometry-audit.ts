import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {MOUNTAIN_HALFPIPE} from "../lib/world/mountainHalfpipe";
import {SKI_V4_TUNING} from "../lib/world/ski/v4/core";
import {evaluateCurrentHalfpipeBudget} from "../lib/world/ski/v4/geometryBudget";

const out=process.env.SKI_V4_GEOMETRY_DIR??"artifacts/ski-v4/geometry";
mkdirSync(out,{recursive:true});
const rows=evaluateCurrentHalfpipeBudget();
const failures=rows.filter(x=>!x.withinBudget);
const peakSlope=Math.max(...rows.map(x=>x.nominalSlopeDegrees));
const minRadius=Math.min(...rows.map(x=>x.radiusOfCurvature));
const maxLowerBound=Math.max(...rows.map(x=>x.unavoidableFlexGap));
const summary={
  schema:"ski-v4-halfpipe-affine-sole-geometry-v1",
  warning:"1D centerline lower bound only; does not qualify full 3D contact or current snow solver",
  halfpipe:MOUNTAIN_HALFPIPE,
  skiHalfLength:SKI_V4_TUNING.skiHalfLength,
  maxSoleFlex:SKI_V4_TUNING.maxSoleFlex,
  contactTolerance:SKI_V4_TUNING.contactTolerance,
  samples:rows.length,unqualifiedSamples:failures.length,
  peakSlopeDegrees:peakSlope,minRadiusOfCurvature:minRadius,
  maxUnavoidableGap:maxLowerBound,
  physicallyQualified:false,
  rows
};
writeFileSync(join(out,"report.json"),JSON.stringify(summary,null,2)+"\n");
const cols=["side","bankFraction","crossAngleDegrees","rigidMaxGap","unavoidableFlexGap","withinBudget","nominalSlopeDegrees","radiusOfCurvature"];
writeFileSync(join(out,"cross-section.csv"),[cols.join(","),
  ...rows.map(row=>cols.map(k=>String(row[k as keyof typeof row])).join(","))].join("\n")+"\n");
console.log("V4 PIPE GEOMETRY AUDIT",JSON.stringify({
  samples:rows.length,failures:failures.length,peakSlope,minRadius,maxLowerBound,
  physicallyQualified:false
}));
