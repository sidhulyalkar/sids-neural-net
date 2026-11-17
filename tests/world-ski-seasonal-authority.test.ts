import assert from "node:assert/strict";
import test from "node:test";
import {
  ARCADE_CAVE,
  terrainHeight,
  terrainHeightBeforeHalfpipe,
  winterTerrainHeight,
  worldFloorHeight,
  winterWorldFloorHeight,
  isWater,
  seaFloorHeight,
} from "../lib/world/model";
import {
  MOUNTAIN_HALFPIPE,
  MOUNTAIN_PROTECTED_ANCHORS,
  mountainHalfpipeInfluence,
  mountainSummitBoost,
} from "../lib/world/mountainHalfpipe";
import {groundHeight,winterGroundHeight} from "../lib/world/activities";

test("the normal island never carries the sculpted halfpipe or summit",()=>{
  let nonzeroWinter=0;
  for(let x=-90;x<=90;x+=2.3)for(let z=-94;z<=100;z+=2.7){
    const base=terrainHeightBeforeHalfpipe(x,z);
    assert.equal(terrainHeight(x,z),base);
    const winter=winterTerrainHeight(x,z);
    assert.ok(Number.isFinite(winter));
    if(Math.abs(winter-base)>1e-8)nonzeroWinter++;
    if(mountainHalfpipeInfluence({x,z})===0 &&
        mountainSummitBoost({x,z})===0)
      assert.equal(winter,base,"winter sculpt leaks past authorized patch");
  }
  assert.ok(nonzeroWinter>50,"winter must genuinely sculpt the localized ski face");
});

test("waterfall, museum, arcade roof and all protected anchors are immutable",()=>{
  for(const [name,p] of Object.entries({
    ...MOUNTAIN_PROTECTED_ANCHORS,
    arcadeDoor:ARCADE_CAVE.entrance,
    arcadeApproach:ARCADE_CAVE.approach,
  })){
    assert.equal(winterTerrainHeight(p.x,p.z),terrainHeight(p.x,p.z),name);
    assert.equal(winterWorldFloorHeight(p.x,p.z),worldFloorHeight(p.x,p.z),name);
  }
  for(let x=12.2;x<=19.8;x+=.4)for(let z=-81;z<=-63;z+=.4)
    assert.equal(winterTerrainHeight(x,z),terrainHeight(x,z),
      "winter must never move an arcade museum roof");
});

test("underwater terrain and coast remain identical in all seasons",()=>{
  for(const p of [{x:-70,z:12},{x:85,z:8},{x:3,z:105}]){
    assert.equal(isWater(p),true);
    assert.equal(worldFloorHeight(p.x,p.z),seaFloorHeight(p.x,p.z));
    assert.equal(winterWorldFloorHeight(p.x,p.z),seaFloorHeight(p.x,p.z));
  }
});

test("winter ground contact is explicit; no hidden process-global season flag",()=>{
  const h=MOUNTAIN_HALFPIPE;
  const p={x:h.centerX,z:(h.startZ+h.endZ)/2};
  const normal=groundHeight(p);
  const winter=winterGroundHeight(p);
  assert.ok(Math.abs(normal-winter)>.4,
    "actual support must differ at the carved halfpipe center");
  assert.equal(groundHeight(p),normal,"winter queries cannot mutate ordinary support");
  assert.equal(winterGroundHeight(p),winter,"winter contact is deterministic");
  const outside={x:0,z:17};
  assert.equal(groundHeight(outside),winterGroundHeight(outside));
});
