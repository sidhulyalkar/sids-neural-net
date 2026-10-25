import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse} from 'yaml';
import {caveObstacles,constrainMove,paperCaveCenterX,paperCaveHalfWidth,paperCaveInside,mountainSurfaceHeight,PAPER_CAVE} from '../lib/world/model';
import {paperCaveShellRings,SNOWMELT_POOL,drainagePoints,mountainTributaries} from '../lib/world/hydrology';
import {RESEARCH_GALLERY} from '../lib/world/researchGallery';
test('three rooms and both corner corridors allow traversal in both directions',()=>{
 const solids=caveObstacles(),route=[{x:-20,z:-32},{x:-20,z:-41},{x:-23.4,z:-42},{x:-23.4,z:-50},{x:-20,z:-53},{x:-20,z:-58},{x:-16.6,z:-59},{x:-16.6,z:-67},{x:-20,z:-70},{x:-20,z:-77}];
 for(const points of [route,[...route].reverse()])for(let i=1;i<points.length;i++){
  const p=constrainMove(points[i-1],points[i],solids);assert.ok(Math.hypot(p.x-points[i].x,p.z-points[i].z)<.001);assert.ok(paperCaveInside(p));
 }
 for(const z of [-38,-46,-55,-64,-73]){const center={x:paperCaveCenterX(z),z},w=paperCaveHalfWidth(z);for(const side of [-1,1])assert.ok(Math.abs(constrainMove(center,{x:center.x+side*(w+4),z},solids).x-center.x)<w);}
 assert.ok(constrainMove({x:-20,z:-77},{x:-20,z:-84},solids).z>PAPER_CAVE.backZ);
});
test('ceilings stay below mountain and wall footprints match floor bounds',()=>{
 const rings=paperCaveShellRings();assert.equal(rings.at(-1)![0].z,PAPER_CAVE.backZ);
 for(const ring of rings){for(const p of ring.slice(1,-1))assert.ok(p.y<mountainSurfaceHeight(p.x,p.z)-.3);const z=ring[0].z,c=paperCaveCenterX(z),w=paperCaveHalfWidth(z);assert.equal(ring[0].x,c-w);assert.equal(ring.at(-1)!.x,c+w);}
});
test('one enlarged snowmelt pool supplies exactly two waterfall routes',()=>{
 const paths=[drainagePoints(),...mountainTributaries()];assert.equal(paths.length,2);assert.ok(SNOWMELT_POOL.radius>3);for(const path of paths){assert.equal(path[0].x,SNOWMELT_POOL.x);assert.equal(path[0].z,SNOWMELT_POOL.z);}
});
test('all canonical publications have local exhibits, three per room',()=>{
 const publications=parse(fs.readFileSync('data/manual/publications.yaml','utf8')).publications;
 for(const p of publications)assert.ok(RESEARCH_GALLERY.some(e=>e.href.startsWith(p.localPdfPath??'NONE')||p.externalLinks.some((l:{href:string})=>e.href===l.href)),p.id);
 for(const room of [1,2,3])assert.equal(RESEARCH_GALLERY.filter(e=>e.room===room).length,3);
 for(const e of RESEARCH_GALLERY){assert.ok(fs.existsSync('public'+e.image));assert.ok(e.position.z<PAPER_CAVE.z&&e.position.z>PAPER_CAVE.backZ);assert.ok(e.width/e.aspect<4.5);}
});
