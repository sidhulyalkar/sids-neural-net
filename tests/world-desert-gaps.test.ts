import assert from "node:assert/strict";
import test from "node:test";
import {
  DESERT_JUMPS, DESERT_GAP_DEBRIS, DESERT_TRACK_LENGTH,
  desertGapBypassPoints, desertBypassClearance,
  desertTrackCenterline, desertJumpOffset, jumpWorld,
} from "../lib/world/desertTrack";
import {
  groundHeight, rampImpulseAt, rampImpulseCrossing, stepAirborne,
  sportClearance, stepTravel,
} from "../lib/world/activities";
import { isWater, terrainHeight, distance } from "../lib/world/model";

const gaps = DESERT_JUMPS.filter(j=>j.kind==="gap");
test("one safe tabletop and two physically separated dirt gaps",()=>{
  assert.equal(DESERT_JUMPS.filter(j=>j.kind==="table").length,1);
  assert.deepEqual(gaps.map(g=>g.obstacle).sort(),["dry-arroyo","fallen-joshua"]);
  assert.equal(DESERT_GAP_DEBRIS.length,1);
  assert.ok(DESERT_TRACK_LENGTH>=300);
  for(const jump of gaps) {
    const center=jumpWorld(jump,(jump.gapStart+jump.gapEnd)/2);
    const outer=jumpWorld(jump,(jump.gapStart+jump.gapEnd)/2,4.6);
    const pit=terrainHeight(center.x,center.z);
    const shoulder=terrainHeight(outer.x,outer.z);
    assert.ok(shoulder-pit>0.7,
      jump.id+" must have genuine lowered ground, not an invisible gap");
    const lip=jump.point, landing=jumpWorld(jump,jump.landing);
    assert.ok(desertJumpOffset(lip)>jump.height*0.65);
    assert.ok(desertJumpOffset(landing)>0.25);
    assert.ok(pit < Math.min(terrainHeight(lip.x,lip.z),
      terrainHeight(landing.x,landing.z))-0.5,
      jump.id+" must have separated takeoff and receiving bank");
    for(const p of [lip,center,landing]) {
      assert.ok(!isWater(p),jump.id+" remains a dry desert feature");
      assert.ok(sportClearance(p),jump.id+" clears vegetation");
      assert.ok(Math.abs(groundHeight(p)-terrainHeight(p.x,p.z))<1e-8);
    }
    const bypass=desertGapBypassPoints(jump);
    assert.equal(bypass.length,7);
    for(const p of bypass) {
      assert.ok(desertBypassClearance(p),jump.id+" bypass is reserved");
      assert.ok(!isWater(p));
      assert.ok(Number.isFinite(groundHeight(p)));
    }
    for(const p of bypass.slice(2,5)) {
      const projected=(p.x-center.x)*jump.heading.z-
        (p.z-center.z)*jump.heading.x;
      assert.ok(Math.abs(projected)>4.2,
        "alternative stays outside excavated trough");
    }
  }
});
test("gap launch is a swept oriented, speed-gated lip crossing",()=>{
  for(const jump of gaps) {
    const before=jumpWorld(jump,-0.30),after=jumpWorld(jump,0.27);
    const speed=jump.minSpeed+1.0;
    const launch=rampImpulseCrossing(before,after,jump.heading,"bike",speed);
    assert.equal(launch?.id,jump.id);
    assert.ok((launch?.impulse??0)>0);
    assert.equal(rampImpulseCrossing(before,after,jump.heading,"bike",jump.minSpeed-0.1),null);
    assert.equal(rampImpulseCrossing(before,after,
      {x:-jump.heading.x,z:-jump.heading.z},"bike",speed),null);
    assert.equal(rampImpulseCrossing(before,after,jump.heading,"run",speed),null);
    assert.equal(rampImpulseCrossing(after,jumpWorld(jump,0.52),jump.heading,"bike",speed),null,
      "remaining near lip must not re-launch");
    assert.equal(rampImpulseCrossing(jumpWorld(jump,-0.3,1.7),
      jumpWorld(jump,0.2,1.7),jump.heading,"bike",speed),null,
      "riding alongside the lip does not jump");
    assert.equal(rampImpulseAt(jump.point,jump.heading,"bike",jump.minSpeed-0.2),null);
  }
});
test("jumped bike follows world-space trajectory above real dirt and lands",()=>{
  for(const jump of gaps) {
    const speed=11;
    const impulse=rampImpulseAt(jump.point,jump.heading,"bike",speed);
    assert.equal(impulse?.id,jump.id);
    let y=terrainHeight(jump.point.x,jump.point.z),v=impulse!.impulse;
    let passedGap=false,landed=false,landingAlong=Infinity;
    for(let i=1;i<40;i++) {
      const along=i*speed*0.05,p=jumpWorld(jump,along);
      const soil=terrainHeight(p.x,p.z);
      const state=stepAirborne(y,v,soil,0.05);
      y=state.y;v=state.verticalSpeed;
      if(along>jump.gapStart+0.5 && along<jump.gapEnd-0.5) {
        assert.ok(y>soil+0.15,jump.id+" rider cannot glue to the trough");
        passedGap=true;
      }
      if(along>jump.gapEnd && state.airHeight===0) {
        landed=true;landingAlong=along;break;
      }
    }
    assert.ok(passedGap && landed,jump.id+" must fly across and recover contact");
    assert.ok(landingAlong <= jump.landing + 3.3,
      jump.id+" cannot overfly its authored receiving bank: "+landingAlong);
  }
});
test("failed jump has a walkable side escape without an airborne teleport",()=>{
  for (const jump of gaps) {
    const centerAlong=(jump.gapStart+jump.gapEnd)/2;
    const escapeSide=jump.id==="desert-step"?-1:1;
    let position=jumpWorld(jump,centerAlong);
    let speed=2.4;
    for (let side=0.2;side<=5.7;side+=0.2) {
      const target=jumpWorld(jump,centerAlong,side*escapeSide);
      const input={x:target.x-position.x,z:target.z-position.z};
      const next=stepTravel(
        {point:position,heading:input,speed},input,0.05,"run",
        [...DESERT_GAP_DEBRIS],false,target,
      );
      assert.ok(distance(next.point,position)>0.005,
        jump.id+" must permit walking out of the wash at side "+side);
      position=next.point;speed=next.speed;
    }
    assert.ok(distance(position,jumpWorld(jump,centerAlong,5.7*escapeSide))<1.1);
  }
});

test("a low-speed underjump enters the physical wash and can retreat by its bypass",()=>{
  for(const jump of gaps) {
    const tooSlow=jump.minSpeed-1;
    const before=jumpWorld(jump,-0.3),after=jumpWorld(jump,0.1);
    assert.equal(rampImpulseCrossing(before,after,jump.heading,"bike",tooSlow),null);
    const pit=jumpWorld(jump,(jump.gapStart+jump.gapEnd)/2);
    assert.ok(groundHeight(pit) < Math.min(groundHeight(jump.point),
      groundHeight(jumpWorld(jump,jump.landing)))-0.5);
    const bypass=desertGapBypassPoints(jump);
    for(let i=1;i<bypass.length;i++) {
      const a=bypass[i-1],b=bypass[i];
      // The route can be traversed as short ground-contact steps rather than
      // requiring an invisible teleport to escape a failed jump.
      const n=Math.ceil(distance(a,b)/0.2);
      let position={...a},speed=4.5;
      for(let k=1;k<=n;k++) {
        const target={x:a.x+(b.x-a.x)*k/n,z:a.z+(b.z-a.z)*k/n};
        const dir={x:target.x-position.x,z:target.z-position.z};
        if(Math.hypot(dir.x,dir.z)<0.001)continue;
        const next=stepTravel({point:position,speed,heading:dir},dir,0.04,
          "run",[],false,target);
        assert.ok(distance(next.point,position)>0.001,
          jump.id+" bypass blocked at "+i+":"+k);
        position=next.point;speed=next.speed;
      }
    }
  }
});
