import * as THREE from 'three/src/Three.Core.js';
import {GeometryBatch} from './worldGeometry';
import {createRayWingGeometry,createSharkGeometry} from './worldFaunaGeometry';
export function lagoonAnimalShape(kind:string):THREE.BufferGeometry|null {
 if(kind==='blacktip')return createSharkGeometry('blacktip');
 if(!['baby-turtle','whipray','giant-clam','pearl-clam','seagrass'].includes(kind))return null;
 const batch=new GeometryBatch();
 const add=(g:THREE.BufferGeometry,c:string,p:number[],s:number[],r:number[]=[0,0,0])=>{
  batch.add(g,c,new THREE.Vector3(...p),new THREE.Vector3(...s),new THREE.Euler(...r));g.dispose();
 };
 const oval=(c:string,p:number[],s:number[])=>add(new THREE.SphereGeometry(1,12,8),c,p,s);
 if(kind==='baby-turtle'){
  oval('#849d69',[0,0,0],[.46,.18,.64]);
  oval('#5b7751',[0,.14,-.05],[.45,.24,.56]);
  for(let i=0;i<5;i++)oval('#a2af79',[Math.sin(i*2.4)*.24,.32,-.05+Math.cos(i*2.4)*.3],[.13,.055,.16]);
  oval('#a9b87c',[0,.02,.66],[.19,.15,.23]);
  for(const side of [-1,1]){
   add(new THREE.SphereGeometry(1,8,5),'#91a876',[side*.48,-.04,.24],[.42,.055,.17],[0,side*.5,0]);
   oval('#91a876',[side*.36,-.05,-.46],[.24,.045,.13]);
   oval('#1b302a',[side*.12,.085,.82],[.025,.025,.025]);
  }
 }else if(kind==='whipray'){
  add(createRayWingGeometry(),'#bdaea6',[0,0,0],[.72,.72,.72],[Math.PI/2,0,0]);
  oval('#b3a098',[0,.035,0],[.28,.10,.53]);
  add(new THREE.CylinderGeometry(.012,.045,1.6,6),'#8e817b',[0,0,-1.05],[1,1,1],[Math.PI/2,0,0]);
  for(const side of [-1,1])oval('#273b38',[side*.15,.11,.4],[.035,.03,.035]);
 }else if(kind==='seagrass'){
  for(let i=0;i<7;i++)add(new THREE.ConeGeometry(.065,.65,3),'#829d67',
   [Math.sin(i*2.4)*.18,.3,Math.cos(i*2.4)*.18],[1,1+(i%3)*.15,1],[.1*Math.sin(i),i,.13*Math.cos(i)]);
 }else{
  // Paired ribbed valves frame a vivid open mantle; pearl is a rare variant.
  for(const side of [-1,1]){
   for(let i=0;i<9;i++){
    const z=(i-4)*.12,w=.28+.23*Math.sin((i+1)/10*Math.PI);
    add(new THREE.SphereGeometry(1,8,5),'#d9cfb2',[side*w*.65,.18,z],[w,.13,.10],[0,0,side*.35]);
   }
  }
  oval('#478b98',[0,.23,0],[.29,.09,.53]);
  for(let i=0;i<9;i++)oval('#91c6ba',[Math.sin(i*2.4)*.2,.30,(i-4)*.10],[.035,.025,.04]);
  if(kind==='pearl-clam')oval('#fff2db',[0,.39,.02],[.105,.105,.105]);
 }
 return batch.finish();
}
