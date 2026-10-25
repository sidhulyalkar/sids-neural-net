import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceSkateTunnelRide,beginSkateTunnelRide} from '../lib/world/skateTunnel';
import {GROVE_TUNNEL} from '../lib/world/skatepark';
test('log push accelerates promptly with consistent real-time progress across frame rates',()=>{
 const speeds:number[]=[];
 for(const fps of [10,30,60]){
  let ride=beginSkateTunnelRide({x:GROVE_TUNNEL.center.x-3,z:GROVE_TUNNEL.center.z},{x:1,z:0},2)!;
  for(let i=0;i<fps/2;i++)ride=advanceSkateTunnelRide(ride,1/fps,{push:true,steer:0,brake:false}).ride;
  assert.ok(ride.speed>4,'half a second of pushing should add more than 2m/s');speeds.push(ride.speed);
 }
 assert.ok(Math.max(...speeds)-Math.min(...speeds)<.02);
});
