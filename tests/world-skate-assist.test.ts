import test from "node:test";
import assert from "node:assert/strict";
import {assistedSkateSpin,selectAssistedSkateTrick} from "../lib/world/skateAssist";
import {finishSkateTrick,flickTrick,idleSkateTrick,skateTrickPose,startSkateTrick} from "../lib/world/skateTricks";

test("a visitor can press one button to do a varied trick sequence",()=>{
 const base={attempt:0,speed:0,inPark:true,airborne:false};
 assert.equal(selectAssistedSkateTrick(base),"Ollie");
 assert.equal(selectAssistedSkateTrick({...base,attempt:1}),"Kickflip");
 assert.equal(selectAssistedSkateTrick({...base,attempt:2}),"Pop Shuvit");
 assert.equal(selectAssistedSkateTrick({...base,attempt:3}),"Heelflip");
 assert.equal(selectAssistedSkateTrick({...base,attempt:4}),"Tre Flip");
 assert.equal(selectAssistedSkateTrick({...base,attempt:5}),"360 Shuvit");
 assert.equal(selectAssistedSkateTrick({...base,attempt:6}),"Ollie");
 assert.equal(selectAssistedSkateTrick({...base,attempt:3}),
  selectAssistedSkateTrick({...base,attempt:3}),"replays should be deterministic");
});
test("park momentum and ramp flight introduce style without extra inputs",()=>{
 const base={attempt:0,speed:8,inPark:true,airborne:false};
 assert.equal(selectAssistedSkateTrick(base),"Kickflip");
 assert.equal(selectAssistedSkateTrick({...base,airborne:true}),"Tre Flip");
 assert.equal(selectAssistedSkateTrick({...base,speed:2,airborne:true}),"Kickflip");
 assert.equal(selectAssistedSkateTrick({...base,speed:2,inPark:false,airborne:false}),"Ollie");
 assert.equal(assistedSkateSpin({...base,attempt:2}),1);
 assert.equal(assistedSkateSpin({...base,attempt:6}),-1);
 assert.equal(assistedSkateSpin({...base,attempt:1}),0);
 assert.equal(assistedSkateSpin({...base,attempt:2,speed:1}),0);
 assert.equal(assistedSkateSpin({...base,attempt:2,inPark:false}),0);
});
test("assist catches slightly sooner but never makes an impossible landing",()=>{
 const base=idleSkateTrick();
 const manual=startSkateTrick(base,"Kickflip",1,7);
 const assisted=startSkateTrick(base,"Kickflip",1,7,true);
 assert.equal(manual.assisted,false);
 assert.equal(assisted.assisted,true);
 assert.equal(finishSkateTrick(manual,1.38,7).lastLabel,"Bail");
 const landed=finishSkateTrick(assisted,1.38,7);
 assert.equal(landed.lastLabel,"Kickflip");
 assert.ok(landed.points>0);
 assert.equal(landed.assisted,false,"assist is scoped to one trick");
 assert.ok(skateTrickPose(assisted,1.38).progress>.8,
  "the assisted catch should look nearly complete at touchdown");
 assert.equal(finishSkateTrick(startSkateTrick(base,"Tre Flip",1,7,true),1.1,7).lastLabel,"Bail",
  "extremely short hops must still fail");
 assert.equal(flickTrick("left",.12),"Kickflip","expert Flick remains intact");
});
test("invalid assist input still chooses a bounded safe move",()=>{
 const bad={attempt:Infinity,speed:NaN,inPark:false,airborne:false};
 assert.equal(selectAssistedSkateTrick(bad),"Ollie");
 assert.equal(assistedSkateSpin(bad),0);
});
