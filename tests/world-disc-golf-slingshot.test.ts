import test from "node:test";
import assert from "node:assert/strict";
import {discGolfSlingshot} from "../lib/world/discGolfSlingshot";
import {startDiscGolf,discGolfThrow,discGolfAimedHeading,discGolfNextTarget,DISC_GOLF_HOLES} from "../lib/world/discGolf";
test("pull depth maps to power with a release deadzone",()=>{
 assert.equal(discGolfSlingshot(0,.03).armed,false);
 assert.equal(discGolfSlingshot(0,-1).armed,false);
 assert.equal(discGolfSlingshot(0,.5).power,50);
 assert.equal(discGolfSlingshot(0,2).power,100);
 assert.equal(discGolfSlingshot(1,0).armed,false);
});
test("sideways pull launches opposite the displacement, without adding power",()=>{
 assert.ok(discGolfSlingshot(.5,.6).accuracy<0);
 assert.equal(discGolfSlingshot(-.5,.6).accuracy,-discGolfSlingshot(.5,.6).accuracy);
 assert.equal(discGolfSlingshot(1,.6).power,60);
 assert.equal(discGolfSlingshot(0,.6).accuracy,0);
 assert.equal(discGolfSlingshot(NaN,1).armed,false);
 assert.equal(discGolfSlingshot(0,Infinity).armed,false);
});
test("straight pull launches along facing; lateral pulls straddle that heading",()=>{
 for(let i=0;i<9;i++){
  const state=startDiscGolf(i,()=>0);
  for(const aimOffset of [-180,-90,0,90]){
   const h=discGolfAimedHeading(state.lie,discGolfNextTarget(state),DISC_GOLF_HOLES[i].target,aimOffset);
   for(const side of [-1,0,1]){
    const p=discGolfSlingshot(side,.6);
    const shot=discGolfThrow(state,{power:p.power,accuracy:p.accuracy,aimOffset,loft:24},()=>0);
    const cross=h.z*shot.velocity.x-h.x*shot.velocity.z;
    if(side===0)assert.ok(Math.abs(cross)<1e-8);
    else assert.equal(Math.sign(cross),-side);
   }
  }
 }
});

test("center tolerance rejects jitter without a discontinuous side jump",()=>{
 assert.equal(discGolfSlingshot(.03,.7).accuracy,0);
 assert.equal(discGolfSlingshot(-.03,.7).accuracy,0);
 assert.ok(Math.abs(discGolfSlingshot(.04001,.7).accuracy)<.00002);
 assert.equal(discGolfSlingshot(1,.7).accuracy,-1);
 assert.equal(discGolfSlingshot(-1,.7).accuracy,1);
 assert.equal(discGolfSlingshot(.5,.02).armed,false);
});
