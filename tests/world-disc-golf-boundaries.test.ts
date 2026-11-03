import assert from "node:assert/strict";
import test from "node:test";
import {
  DISC_GOLF_PLAY_BOUNDS,discGolfOutOfBounds,discGolfTreeContact,
  discGolfSafeTreeLie,startDiscGolf,stepDiscGolf,
} from "../lib/world/discGolf";
const flat=()=>0,land=()=>false;

test("north shore frisbee flight is in bounds until actual island edge",()=>{
  assert.ok(DISC_GOLF_PLAY_BOUNDS.maxZ>=104);
  for(const z of [49,56,57,64,78,99,104])
    assert.equal(discGolfOutOfBounds({x:0,z}),false,`north position ${z}`);
  for(const p of [{x:0,z:104.2},{x:0,z:-97},{x:95,z:0},{x:NaN,z:0}])
    assert.ok(discGolfOutOfBounds(p));
  let game=startDiscGolf(0,flat);
  game={
    ...game,phase:"flying",flightTime:1,
    disc:{x:30,y:18,z:56.8},
    velocity:{x:0,y:0,z:20},
  };
  const result=stepDiscGolf(game,.08,flat,land,-1.4);
  assert.equal(result.phase,"flying");
  assert.ok(result.disc.z>57);
  assert.equal(result.waterRedos,0);
});

test("leaving a trunk from inside its radius does not create an infinite collision loop",()=>{
  const obstacle={x:0,z:0,radius:1,height:4};
  const movingOut=discGolfTreeContact(
    {x:.4,y:2,z:0},{x:2.4,y:2,z:0},obstacle,flat);
  assert.equal(movingOut,null);
  const movingIn=discGolfTreeContact(
    {x:-3,y:2,z:0},{x:.2,y:2,z:0},obstacle,flat);
  assert.ok(movingIn);
  assert.ok(movingIn!.x<0);
});

test("post-frisbee tree lie cannot overlap neighboring trunks or water",()=>{
  const trees=[
    {x:0,z:0,radius:1.1,height:6},
    {x:2,z:0,radius:1.15,height:6},
    {x:0,z:2,radius:1.2,height:6},
  ];
  const wet=(p:{x:number;z:number})=>p.z<-.7;
  const lie=discGolfSafeTreeLie({x:1.1,z:0},trees[0],trees,wet);
  assert.ok(lie,"search for an alternate safe throwing lie");
  assert.ok(!wet(lie!));
  assert.ok(trees.every(tree=>
    Math.hypot(lie!.x-tree.x,lie!.z-tree.z)>=tree.radius+.55));
  assert.equal(discGolfSafeTreeLie(
    {x:1.1,z:0},trees[0],trees,()=>true),null,
    "an entirely flooded contact must not strand the player");
});
