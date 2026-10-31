import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createShastaFootAnchor,updateShastaFootContact,
 SHASTA_CONTACT_TETHER,SHASTA_PAW_CENTER_HEIGHT,
} from '../lib/world/shastaFootContact';

const slope=(x:number,z:number)=>1+.23*x-.17*z;
const out={x:0,y:0,z:0};

test('planted paw holds a fixed world contact on sloped terrain while torso shifts',()=>{
 const anchor=createShastaFootAnchor();
 const first={x:2,y:1.1,z:-3};
 assert.equal(updateShastaFootContact(anchor,first,true,slope,out),true);
 const expected={x:2,y:slope(2,-3)+SHASTA_PAW_CENTER_HEIGHT,z:-3};
 assert.deepEqual(out,expected);
 for(let i=1;i<=20;i++){
  const nominal={x:2+i*.005,y:1.1+i*.011,z:-3+i*.003};
  assert.equal(updateShastaFootContact(anchor,nominal,true,slope,out),true);
  assert.deepEqual(out,expected,'world paw contact must not slide with the pelvis');
 }
 assert.equal(anchor.resets,1);
});
test('swing, jump, roll and interrupted motion release each foot independently',()=>{
 const anchor=createShastaFootAnchor();
 updateShastaFootContact(anchor,{x:0,y:.05,z:0},true,slope,out);
 assert.equal(anchor.active,true);
 const airborne={x:.4,y:.8,z:.2};
 assert.equal(updateShastaFootContact(anchor,airborne,false,slope,out),false);
 assert.deepEqual(out,airborne);
 assert.equal(anchor.active,false);
 assert.equal(updateShastaFootContact(anchor,airborne,true,slope,out),true);
 assert.equal(anchor.active,true);
 assert.equal(anchor.resets,2);
});
test('stance tether resets unreachable feet without NaNs or elastic overreach',()=>{
 const anchor=createShastaFootAnchor();
 updateShastaFootContact(anchor,{x:0,y:0,z:0},true,slope,out);
 const newPose={x:SHASTA_CONTACT_TETHER+.2,y:.1,z:0};
 updateShastaFootContact(anchor,newPose,true,slope,out);
 assert.equal(anchor.resets,2);
 assert.equal(out.x,newPose.x);
 assert.ok(Number.isFinite(out.y)&&Number.isFinite(out.z));
});
test('non-finite terrain or corrupted coordinates cannot contaminate the stance rig',()=>{
 const anchor=createShastaFootAnchor();
 const badTerrain=()=>Number.NaN;
 assert.equal(updateShastaFootContact(anchor,{x:1,y:0,z:2},true,badTerrain,out),false);
 assert.equal(anchor.active,false);
 assert.ok(Number.isFinite(out.y));
 const bad={x:Infinity,y:0,z:0};
 assert.equal(updateShastaFootContact(anchor,bad,true,slope,out),false);
 assert.equal(anchor.active,false);
});
test('all four paws can be independently anchored on uneven terrain',()=>{
 const paws=Array.from({length:4},createShastaFootAnchor);
 const samples=[[-.2,.44],[.2,.44],[-.2,-.44],[.2,-.44]];
 const outcomes=samples.map(([x,z],i)=>{
  const p={x,y:1.4,z};
  const dst={x:0,y:0,z:0};
  updateShastaFootContact(paws[i],p,true,slope,dst);
  return {...dst};
 });
 assert.equal(outcomes.length,4);
 assert.equal(paws.filter(p=>p.active).length,4);
 assert.ok(outcomes.every(p=>Math.abs(p.y-slope(p.x,p.z)-SHASTA_PAW_CENTER_HEIGHT)<1e-10));
});
