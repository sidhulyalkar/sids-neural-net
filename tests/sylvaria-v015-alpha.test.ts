import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const encounter=read('public/game-runtimes/mosslight-v2/v015/encounter-director-v015.js');
const discoveries=read('public/game-runtimes/mosslight-v2/v015/discoveries-v015.js');
const actors=read('public/game-runtimes/mosslight-v2/v015/forest-actors-v015.js');
const forest=read('public/game-runtimes/mosslight-v2/v015/forest-world-v015.js');
const entry=read('public/game-runtimes/mosslight-v2/v015-entry.js');

test('combat alpha authors exactly twelve escalating clearings before endless pressure',()=>{
  const authored=[...encounter.matchAll(/room\('([^']+)'/g)].map(m=>m[1]);
  assert.equal(authored.length,12);
  assert.deepEqual(authored.slice(0,4),['Whispering Pine Verge','Needle-Mist Crossing','Old Oak Trapline','Rootvault Clearing']);
  assert.equal(authored[5],'Burnscar Haul Road');
  assert.equal(authored[11],'The Walking Sawmill');
  assert.match(encounter,/miniBoss:true/);
  assert.match(encounter,/boss:true,bossName:'The Walking Sawmill'/);
  assert.match(encounter,/Math\.min\(7,4\+Math\.floor\(\(depth-13\)\/4\)\)/);
  assert.match(encounter,/cadence=Math\.max\(\.40/);
});

test('enemy roster teaches distinct combat jobs instead of reskinned health bars',()=>{
  for(const kind of ['scout','nailgun','sawdrone','hound','shield','trapper','surveyor','spore','harvester'])assert.match(encounter,new RegExp(`${kind}:Object\\.freeze`));
  for(const label of ['Clearcut Scout','Nailgun Ranger','Saw Drone','Brush Hound','Shielded Foreman','Cable Trapper','Lantern Surveyor','Spore Tender','Timber Harvester'])assert.match(encounter,new RegExp(label));
  for(const role of ["role:'engage'","role:'precision'","role:'coverage'","role:'heavy'","role:'control'"])assert.match(encounter,new RegExp(role));
  assert.match(encounter,/addWire/);
  assert.match(encounter,/addSpore/);
  assert.match(encounter,/v015Archetype==='shield'/);
  assert.match(encounter,/amount\*=\.18/);
  assert.match(encounter,/amount\*=1\.45/);
});

test('difficulty grows through cadence concurrency composition and intensity while body count remains bounded',()=>{
  assert.match(encounter,/cadence:1\.02/);
  assert.match(encounter,/cadence:\.48/);
  assert.match(encounter,/concurrent:3/);
  assert.match(encounter,/intensity:1\.68/);
  assert.match(encounter,/Math\.min\(2\.15,1\.68\+\(depth-12\)\*\.035\)/);
  assert.match(encounter,/Math\.min\(3,2\+Math\.floor\(\(depth-11\)\/8\)\)/);
  assert.doesNotMatch(encounter,/count=Math\.min\((?:8|9|10|11|12)/);
});

test('v0.15 clears inherited additive rosters and owns one curated enemy set per room',()=>{
  assert.match(encounter,/state\.enemies\.length=0/);
  assert.match(encounter,/\(bp\.v015Roster\|\|\[\]\)\.forEach/);
  assert.match(encounter,/const ours=state\.enemies\.filter\(e=>e\.v015Enemy\)/);
  assert.match(encounter,/state\.enemies=others;inheritedEnemies\(dt\)/);
  assert.match(entry,/curatedEncounters:true/);
});

test('threat scheduling is deterministic and limits simultaneous commitments',()=>{
  assert.match(encounter,/function armReadyEnemies/);
  assert.match(encounter,/slots=Math\.max\(0,c\.concurrent-active\)/);
  assert.match(encounter,/rolePriority/);
  assert.match(encounter,/c\.lastRole/);
  assert.match(encounter,/c\.nextBeat=state\.roomTime\+c\.cadence/);
  assert.doesNotMatch(encounter,/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);
});

test('discoveries are line-based decisions with concrete run effects',()=>{
  for(const kind of ['moonflower','spirit-stag','root-shrine'])assert.match(discoveries,new RegExp(kind));
  for(const boon of ['leaf-edge','quickroot','moon-eye'])assert.match(discoveries,new RegExp(boon));
  assert.match(discoveries,/segmentDistance\(node\.x,node\.y,ax,ay,bx,by\)/);
  assert.match(discoveries,/p\.v015Segments=clamp\(\(p\.v015Segments\|\|0\)\+1\.25/);
  assert.match(discoveries,/b\.counterRefill=Math\.min\(\.32/);
  assert.match(discoveries,/b\.damage=Math\.min\(1\.36/);
  assert.match(discoveries,/b\.passiveRefill=Math\.min\(\.36/);
  assert.match(discoveries,/b\.fogMultiplier=Math\.max\(\.55/);
  assert.doesNotMatch(discoveries,/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);
});

test('forest atmosphere respects authored encounter identity and earned visibility boons',()=>{
  assert.match(forest,/if\(bp\?\.v015Roster\)\{state\.room\.title=bp\.title/);
  assert.match(forest,/if\(!e\.v015Name\)e\.v015Name=/);
  assert.match(forest,/state\.v015RunBoons\?\.fogMultiplier/);
  assert.match(forest,/v015VisionBurst>0\?\.42:1/);
});

test('professional actor layer owns forest guardian industrial silhouettes hazards discoveries and boss presentation',()=>{
  assert.match(actors,/canvas\.id='actorCanvas'/);
  assert.match(actors,/moss-cloaked forest guardian/);
  for(const fn of ['drawGuardian','drawHuman','drawSawDrone','drawHound','drawShield','drawSurveyor','drawHarvester','drawDiscovery','drawBoss'])assert.match(actors,new RegExp(`function ${fn}`));
  assert.match(actors,/drawWires/);
  assert.match(actors,/drawSpores/);
  assert.match(actors,/industrialLight:'warm'/);
  assert.match(actors,/discoveryLight:'cool'/);
  assert.doesNotMatch(actors,/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);
});
