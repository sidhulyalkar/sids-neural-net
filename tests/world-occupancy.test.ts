import assert from "node:assert/strict";
import test from "node:test";
import { auditIslandCells, summarizeIsland, OCCUPANCY_DOMAIN } from "../lib/world/occupancy";
import { DESERT_TRACK_LENGTH, desertTrackCenterline } from "../lib/world/desertTrack";
import { desertTrackClearance } from "../lib/world/desertTrack";
import { isWater, REGIONS } from "../lib/world/model";

test("island survey is finite, deterministic and distinguishes actual open landscapes", () => {
  const cells=auditIslandCells(6);
  const copy=auditIslandCells(6);
  assert.deepEqual(copy,cells);
  const summary=summarizeIsland(cells);
  assert.ok(summary.land>100,"substantial playable land is audited");
  assert.equal(summary.cells,cells.length);
  assert.ok(summary.counts.water && summary.counts.forest &&
    summary.counts.sport && summary.counts["alpine-open"] &&
    summary.counts["desert-open"],"distinct regions retain distinct uses");
  assert.equal(summary.reviewCandidates,summary.counts["needs-review"]??0);
  assert.ok(summary.reviewShare>=0 && summary.reviewShare<=1);
  for (const c of cells) {
    assert.ok(Number.isFinite(c.height)&&Number.isFinite(c.slope)&&
      Number.isFinite(c.moisture)&&Number.isFinite(c.understory));
    assert.equal(c.category==="water",isWater(c),
      `underwater vs land classification at ${c.x},${c.z}`);
    assert.ok(c.x>=OCCUPANCY_DOMAIN.minX&&c.x<=OCCUPANCY_DOMAIN.maxX);
  }
});
test("expanded desert lap remains off the protected waterfall and cave", () => {
  assert.ok(DESERT_TRACK_LENGTH>300,"not just three counted runs around old oval");
  for (const p of desertTrackCenterline(80)) {
    assert.ok(p.x>8&&p.x<57 && p.z>-64&&p.z<13);
  }
  for(const landmark of REGIONS.filter(r=>r.id==="waterfall"||
    r.id==="cavern"||r.id==="rainforest"||r.id==="lagoon"))
    assert.equal(desertTrackClearance(landmark.point),false,landmark.id);
});
