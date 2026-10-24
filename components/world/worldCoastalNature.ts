import * as THREE from 'three/src/Three.Core.js';
import {GeometryBatch,ringSurface} from './worldGeometry';
import {COAST_BENCH,COAST_FALL,COAST_WHALE,mountainTributaries} from '@/lib/world/hydrology';
import {coastlineX,SEA_SURFACE,type Obstacle} from '@/lib/world/model';
import type {OceanObservation} from '@/lib/world/coastalObservation';
/** Bake static scenery; animate only the water and offshore whale. */
export function createCoastalNature(height:(p:{x:number;z:number})=>number){
 const root=new THREE.Group(),batch=new GeometryBatch(),obstacles:Obstacle[]=[];
 const stone=new THREE.IcosahedronGeometry(1,1),branch=new THREE.CylinderGeometry(.72,1,1,7),leaf=new THREE.IcosahedronGeometry(1,1);
 const up=new THREE.Vector3(0,1,0),v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 const segment=(a:THREE.Vector3,b:THREE.Vector3,r:number,color:string)=>{const delta=b.clone().sub(a),q=new THREE.Quaternion().setFromUnitVectors(up,delta.clone().normalize());batch.add(branch,color,a.clone().add(b).multiplyScalar(.5),v(r,delta.length(),r),new THREE.Euler().setFromQuaternion(q));};
 const trees=[[-28,-59,0,4.8],[-29,-53,1,4.3],[-30,-44,0,3.9],[-27,-34,2,5.5],[-25,-48,3,3.7],[-24,-57,2,6.3],[-24,-65,1,4.8],[-27,-70,0,4.4],[-30,-65,0,3.7],[-28,-27,3,3.5],[-30,-22,1,4.2],[-26,-75,2,5.8]];
 for(let i=0;i<trees.length;i++){
  const [x,z,kind,h]=trees[i],y=height({x,z}),base=v(x,y-.12,z),top=v(x+(kind===0?-1.05:.2),y+h,z+.25),bark=kind===3?'#a65f3c':kind===2?'#78503a':'#77756a';
  segment(base,top,kind===2?.33:.23,bark);obstacles.push({x,z,radius:.35,topY:y+h});
  for(let level=0;level<3;level++)for(let arm=0;arm<4;arm++){
   const a=arm*Math.PI/2+level*.7+i*.8,t=.44+level*.18,origin=base.clone().lerp(top,t),spread=(kind===2?1.6:2.3)*(1-level*.15),end=origin.clone().add(v(Math.cos(a)*spread-(kind===0?.8:0),.35+level*.2,Math.sin(a)*spread)),elbow=origin.clone().lerp(end,.55).add(v(0,.24,0));
   segment(origin,elbow,.1,bark);segment(elbow,end,.06,bark);batch.add(leaf,kind===3?'#627e40':kind===1?'#355d49':kind===2?'#365e46':'#4b7145',end,v(kind===2?1.1:1.25,kind===0?.35:.65,1.05),new THREE.Euler(0,a,0));
   if(kind===0)segment(end,end.clone().add(v(-.45,.25,.25)),.025,'#b1b0a1');
  }
  for(let r=0;r<4;r++){const a=r*1.6;segment(base.clone().add(v(0,.25,0)),v(x+Math.cos(a)*.8,height({x:x+Math.cos(a)*.8,z:z+Math.sin(a)*.8})+.04,z+Math.sin(a)*.8),.12,bark);}
 }
 const benchY=height(COAST_BENCH),benchRoot=new THREE.Group();benchRoot.position.set(COAST_BENCH.x,benchY,COAST_BENCH.z);root.add(benchRoot);
 const wood=new THREE.MeshStandardMaterial({color:'#967b58',roughness:.98});
 const bp=(g:THREE.BufferGeometry,p:THREE.Vector3)=>{const m=new THREE.Mesh(g,wood);m.position.copy(p);benchRoot.add(m);return m;};
 const seat=bp(new THREE.CylinderGeometry(.43,.47,3.6,12),v(0,.42,0));seat.rotation.x=Math.PI/2;
 bp(new THREE.BoxGeometry(.9,.17,3.6),v(0,.64,0));
 for(const z of [-1.25,1.25]){bp(new THREE.CylinderGeometry(.18,.23,.6,8),v(.1,.29,z));bp(new THREE.CylinderGeometry(.08,.12,1.25,7),v(.45,.9,z));}
 bp(new THREE.BoxGeometry(.18,.36,3.6),v(.44,1.37,0));
 const ringMat=new THREE.MeshBasicMaterial({color:'#63513b'});
 for(const z of [-1.81,1.81])for(const r of [.12,.23,.34]){const m=new THREE.Mesh(new THREE.TorusGeometry(r,.012,3,22),ringMat);m.position.set(0,.42,z);benchRoot.add(m);}
 for(const z of [-1.2,0,1.2])obstacles.push({x:COAST_BENCH.x+.2,z:COAST_BENCH.z+z,radius:.48,topY:benchY+1.6});
 for(let i=0;i<34;i++){const a=i*2.4,r=.8+(i%7)*.25,x=COAST_BENCH.x+Math.cos(a)*r,z=COAST_BENCH.z+Math.sin(a)*r;batch.add(stone,i%2?'#9e9e88':'#b8af94',v(x,height({x,z})+.03,z),v(.09,.035,.07));}
 const streams=mountainTributaries(),water=new THREE.MeshStandardMaterial({color:'#91d0d2',transparent:true,opacity:.78,roughness:.25,side:THREE.DoubleSide});
 for(const [index,path] of streams.entries()){
  const rings=path.map((p,i)=>{const prev=path[Math.max(0,i-1)],next=path[Math.min(path.length-1,i+1)],dx=next.x-prev.x,dz=next.z-prev.z,n=Math.hypot(dx,dz)||1,w=.38+index*.1;return [-1,1].map(side=>v(p.x+side*dz/n*w,Math.max(p.y,height({x:p.x+side*dz/n*w,z:p.z-side*dx/n*w})+.055),p.z-side*dx/n*w));});
  root.add(new THREE.Mesh(ringSurface(rings),water));
  for(let i=0;i<path.length;i+=14){const p=path[i];for(const side of [-1,1]){const x=p.x+side*.8,z=p.z;batch.add(stone,i%3?'#778477':'#969c86',v(x,height({x,z})+.07,z),v(.25,.13,.3));}}
 }
 const lipY=streams[0].at(-1)!.y;
 const fallRings=Array.from({length:32},(_,i)=>{const t=i/31;return [-1,1].map(side=>v(COAST_FALL.x-2.35*t,lipY+(SEA_SURFACE+.12-lipY)*t,COAST_FALL.z+side*(.23+.12*t)));});root.add(new THREE.Mesh(ringSurface(fallRings),water));
 for(let i=0;i<14;i++){const z=COAST_FALL.z-3.6+i*.55,x=coastlineX(z)+.75,y=height({x,z});batch.add(stone,i%3?'#777f73':'#a1a18c',v(x+.15,y-.35,z),v(.65,.45,.4));}
 const foamMat=new THREE.MeshBasicMaterial({color:'#e0f5ec',transparent:true,opacity:.7});
 const foam=new THREE.Mesh(new THREE.RingGeometry(.35,1.7,36),foamMat);foam.rotation.x=-Math.PI/2;foam.position.set(COAST_FALL.x-2.35,SEA_SURFACE+.07,COAST_FALL.z);root.add(foam);
 const drops=new THREE.InstancedMesh(new THREE.SphereGeometry(.035,4,3),foamMat,38);root.add(drops);const dummy=new THREE.Object3D();
 const staticMesh=new THREE.Mesh(batch.finish(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));staticMesh.castShadow=true;staticMesh.receiveShadow=true;root.add(staticMesh);stone.dispose();branch.dispose();leaf.dispose();
 const whale=new THREE.Group();root.add(whale);const skin=new THREE.MeshStandardMaterial({color:'#3b535c',roughness:.43}),belly=new THREE.MeshStandardMaterial({color:'#a8b9b5',roughness:.7});
 const wp=(scale:THREE.Vector3,p:THREE.Vector3,m:THREE.Material=skin)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),m);o.scale.copy(scale);o.position.copy(p);whale.add(o);return o;};
 wp(v(1.22,1.02,3.5),v(0,0,0));wp(v(1.08,.82,1.5),v(0,.08,2.25));wp(v(.82,.17,2.8),v(0,-.85,.6),belly);wp(v(.38,.4,1.3),v(0,0,-3.2));
 for(const side of [-1,1]){const fin=wp(v(.4,.16,2.25),v(side*1.7,-.4,.3),belly);fin.rotation.y=side*.78;const fluke=wp(v(1.4,.13,.65),v(side*.95,.05,-4.25));fluke.rotation.y=side*-.25;}
 const dorsal=new THREE.Mesh(new THREE.ConeGeometry(.4,.8,5),skin);dorsal.position.set(0,.95,-1.25);dorsal.rotation.x=-.35;whale.add(dorsal);
 const splash=new THREE.Mesh(new THREE.RingGeometry(.6,1,40),foamMat);splash.rotation.x=-Math.PI/2;splash.position.set(COAST_WHALE.x,SEA_SURFACE+.09,COAST_WHALE.z);root.add(splash);
 const spray=new THREE.InstancedMesh(new THREE.SphereGeometry(.1,5,4),foamMat,36);root.add(spray);
 const hideEncounter=()=>{whale.visible=false;splash.visible=false;spray.visible=false;};
 hideEncounter();
 return {root,staticMesh,obstacles,benchY,benchRoot,hideEncounter,streams:streams.length+1,updateWater(time:number){
  for(let i=0;i<38;i++){const t=(time*.7+i/38)%1;dummy.position.set(COAST_FALL.x-2.35*t,lipY+(SEA_SURFACE+.15-lipY)*t,COAST_FALL.z+Math.sin(i*2.4)*.23);dummy.scale.set(1,3.5,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);}drops.instanceMatrix.needsUpdate=true;foam.scale.setScalar(1+Math.sin(time*1.9)*.09);
 },updateEncounter(o:OceanObservation){
  if(o.phase==='quiet'){hideEncounter();return;}
  whale.visible=o.phase==='breach';splash.visible=o.phase==='splash';spray.visible=true;const t=Math.max(0,Math.min(1,(o.time-2)/4));
  whale.position.set(COAST_WHALE.x+Math.sin(t*Math.PI)*2,SEA_SURFACE-4.1+Math.sin(Math.PI*t)*10,COAST_WHALE.z+t*3);whale.rotation.set(-1.05+t*2.3,.35,.15+Math.sin(Math.PI*t)*.75);
  const st=Math.max(0,o.time-6);splash.scale.setScalar(1+st*2.3);
  for(let i=0;i<36;i++){const a=i*2.4,r=o.phase==='spout'?.08+o.time*.3:st*(.7+(i%5)*.2),h=o.phase==='spout'?Math.sin(o.time/2*Math.PI)*3.5:Math.max(0,st*(4+i%3)-st*st*2.5);dummy.position.set(COAST_WHALE.x+Math.cos(a)*r,SEA_SURFACE+.1+h,COAST_WHALE.z+Math.sin(a)*r);dummy.scale.setScalar(o.phase==='spout'?.35:.6);dummy.updateMatrix();spray.setMatrixAt(i,dummy.matrix);}spray.instanceMatrix.needsUpdate=true;
 },dispose(){const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));if(o instanceof THREE.InstancedMesh)o.dispose();}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}};
}
