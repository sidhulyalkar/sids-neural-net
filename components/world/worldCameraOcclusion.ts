import * as THREE from "three/src/Three.Core.js";
import {CameraVisibilityField,type CameraPoint,type CameraVolume} from "@/lib/world/cameraVisibility";

/** Snapshot static scenery before adding the player. Each instance keeps its
 * own cutaway handle: hiding one leaf never removes an entire forest. */
export function createWorldCameraOcclusion(scene:THREE.Object3D,options:{cutaways?:boolean}={}){
 type Part={start:number;count:number;min:number[];max:number[]};
 const entries:{mesh:THREE.Mesh;instance?:number;part?:Part}[]=[],volumes:CameraVolume[]=[];
 const matrix=new THREE.Matrix4(),world=new THREE.Matrix4(),box=new THREE.Box3();
 const center=new THREE.Vector3(),size=new THREE.Vector3();
 scene.updateMatrixWorld(true);
 scene.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||!object.visible)return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  if(!materials.some(m=>m.visible&&m.colorWrite&&(!m.transparent||m.opacity>=.65)))return;
  object.geometry.computeBoundingBox();
  const bounds=object.geometry.boundingBox;if(!bounds)return;
  const parts=object.geometry.userData.cameraParts as Part[]|undefined;
  if(options.cutaways!==false&&parts&&!object.geometry.index){
   object.geometry.setIndex(Array.from({length:object.geometry.getAttribute("position").count},(_,i)=>i));
  }
  const count=object instanceof THREE.InstancedMesh?object.count:parts?.length??1;
  for(let i=0;i<count;i++){
   world.copy(object.matrixWorld);
   if(object instanceof THREE.InstancedMesh){object.getMatrixAt(i,matrix);world.multiply(matrix);}
   const part=parts?.[i];
   if(part){box.min.fromArray(part.min);box.max.fromArray(part.max);}else box.copy(bounds);
   box.applyMatrix4(world);box.getSize(size);box.getCenter(center);
   // Island terrain/ocean are checked by the terrain clearance solver, not
   // treated as one giant solid foliage volume enclosing the whole island.
   if(Math.max(size.x,size.z)>120||size.length()<.02)continue;
   const k=Math.sqrt(3)/2; // ellipsoid encloses all eight box corners
   volumes.push({x:center.x,y:center.y,z:center.z,
    rx:Math.max(.02,size.x*k),ry:Math.max(.02,size.y*k),rz:Math.max(.02,size.z*k)});
   entries.push({mesh:object,instance:object instanceof THREE.InstancedMesh?i:undefined,part});
  }
 });
 const field=new CameraVisibilityField(volumes);
 const hidden:{mesh:THREE.Mesh;instance?:number;matrix?:THREE.Matrix4;part?:Part;visible:boolean}[]=[];
 let hiddenKey="";
 function restore(){
  for(const h of hidden){
   if(h.instance!==undefined&&h.mesh instanceof THREE.InstancedMesh){
    h.mesh.setMatrixAt(h.instance,h.matrix!);h.mesh.instanceMatrix.needsUpdate=true;
   }else if(h.part){
    const index=h.mesh.geometry.index!;
    for(let i=h.part.start;i<h.part.start+h.part.count;i++)index.setX(i,i);
    index.needsUpdate=true;
   }else h.mesh.visible=h.visible;
  }
  hidden.length=0;hiddenKey="";
 }
 function cutaway(camera:CameraPoint,focus:CameraPoint){
  if(options.cutaways===false)return 0;
  const ids=field.blockingIndices(camera,focus),key=ids.join(",");
  if(key===hiddenKey){
   for(const h of hidden)if(h.instance===undefined&&!h.part)h.mesh.visible=false;
   return hidden.length;
  }
  restore();hiddenKey=key;
  for(const id of ids){
   const e=entries[id];
   if(e.instance!==undefined&&e.mesh instanceof THREE.InstancedMesh){
    const original=new THREE.Matrix4();e.mesh.getMatrixAt(e.instance,original);
    hidden.push({...e,matrix:original,visible:e.mesh.visible});
    e.mesh.setMatrixAt(e.instance,new THREE.Matrix4().makeScale(0,0,0));
    e.mesh.instanceMatrix.needsUpdate=true;
   }else if(e.part){
    hidden.push({...e,visible:e.mesh.visible});
    const index=e.mesh.geometry.index!;
    for(let i=e.part.start;i<e.part.start+e.part.count;i++)index.setX(i,e.part.start);
    index.needsUpdate=true;
   }else{hidden.push({...e,visible:e.mesh.visible});e.mesh.visible=false;}
  }
  return hidden.length;
 }
 return {field,volumes,cutaway,restore,count:volumes.length};
}
