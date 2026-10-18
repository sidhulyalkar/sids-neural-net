import test from "node:test";
import assert from "node:assert/strict";
import {isSafeRideContact,findRideRecoveryPoint,initialRideRecovery,
 advanceRideRecovery,isRideMode} from "../lib/world/rideRecovery";
import {stepTravel,type Travel} from "../lib/world/activities";

const level=(_p:{x:number;z:number})=>6;
test("only board, bike and ski enter the recovery watchdog",()=>{
 assert.equal(isRideMode("skate"),true);
 assert.equal(isRideMode("bike"),true);
 assert.equal(isRideMode("ski"),true);
 assert.equal(isRideMode("run"),false);
 assert.equal(isRideMode("boulder"),false);
});

test("ride contact rejects deeply intersecting trunks, false elevated support and water",()=>{
 const obstacle={x:5,z:-50,radius:1.2};
 assert.equal(isSafeRideContact({x:5,z:-50},[obstacle],level,level),false);
 assert.equal(isSafeRideContact({x:7,z:-50},[obstacle],level,level),true);
 assert.equal(isSafeRideContact({x:7,z:-50},[],()=>8,level),false);
 assert.equal(isSafeRideContact({x:7,z:-50},[],level,level),true);
 assert.equal(isSafeRideContact({x:200,z:200},[],level,level),false);
 assert.equal(isSafeRideContact({x:0,z:102},[],level,level),false);
});

test("local recovery finds a playable downhill-side point outside a pillar",()=>{
 const point={x:8,z:-54},obstacles=[{...point,radius:1.05}];
 const recovered=findRideRecoveryPoint(point,{x:0,z:1},
  {x:2,z:-52},obstacles,level,level);
 assert.ok(recovered,"a clear alternative exists nearby");
 assert.ok(Math.hypot(recovered!.x-point.x,recovered!.z-point.z)<=3.6);
 assert.ok(isSafeRideContact(recovered!,obstacles,level,level));
});

test("recovery never teleports across the island when every nearby candidate is blocked",()=>{
 const p={x:8,z:-54};
 const rescue=findRideRecoveryPoint(p,{x:0,z:1},{x:80,z:52},
  [{...p,radius:12}],level,level);
 assert.equal(rescue,null);
});

test("stuck detector needs sustained steering intent, not a normal pause",()=>{
 const p={x:8,z:-54};
 let state=initialRideRecovery(p);
 for(let n=0;n<29;n++){
  const r=advanceRideRecovery(state,{
   point:p,previous:p,mode:"ski",dt:.05,moving:true,
   grounded:true,controlledStunt:false,clear:false,
  });
  assert.equal(r.recover,false);state=r.state;
 }
 let last=advanceRideRecovery(state,{
  point:p,previous:p,mode:"ski",dt:.05,moving:true,
  grounded:true,controlledStunt:false,clear:false,
 });
 assert.equal(last.recover,true);
 for(const halted of [
  {moving:false,grounded:true,controlledStunt:false},
  {moving:true,grounded:false,controlledStunt:false},
  {moving:true,grounded:true,controlledStunt:true},
 ]){
  const r=advanceRideRecovery(last.state,{
   point:p,previous:p,mode:"ski",dt:.05,...halted,clear:false,
  });
  assert.equal(r.state.blockedFor,0);
  assert.equal(r.recover,false);
 }
});

test("normal riding and genuine progress never build a hidden recovery timer",()=>{
 const origin={x:8,z:-54},moved={x:8.25,z:-54};
 const before={...initialRideRecovery(origin),blockedFor:1.45};
 const progress=advanceRideRecovery(before,{
  point:moved,previous:origin,mode:"bike",dt:.05,
  moving:true,grounded:true,controlledStunt:false,clear:true,
 });
 assert.equal(progress.recover,false);
 assert.equal(progress.state.blockedFor,0);
 assert.deepEqual(progress.state.anchor,moved);
 const noIntent=advanceRideRecovery(progress.state,{
  point:moved,previous:moved,mode:"bike",dt:.05,
  moving:false,grounded:true,controlledStunt:false,clear:true,
 });
 assert.equal(noIntent.recover,false);
});

test("ski and bike obstruction remains solid in ordinary travel, recovery is explicit",()=>{
 const obstacle={x:8,z:-54,radius:1.1};
 const current:Travel={point:{x:8,z:-57},heading:{x:0,z:1},speed:10};
 for(const mode of ["bike","ski","skate"] as const){
  let t=current;
  for(let n=0;n<30;n++)
   t=stepTravel(t,{x:0,z:1},.05,mode,[obstacle],false,null,0,level);
  assert.ok(Math.hypot(t.point.x-obstacle.x,t.point.z-obstacle.z)>=1.55-1e-3,
   mode+" should not ghost through solid obstacles");
 }
});
