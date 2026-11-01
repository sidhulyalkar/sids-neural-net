import * as THREE from "three/src/Three.Core.js";
import {bunkerLayout,bunkerInside,bunkerNearby,bunkerHatchAccessible,
 UNDERWATER_BUNKER,type BunkerPhotoSlot} from "@/lib/world/underwaterBunker";
import {constrainMove,seaFloorHeight,type Point,type WorldPhoto,type Obstacle} from "@/lib/world/model";

type PhotoEntry={group:THREE.Group;material:THREE.MeshBasicMaterial;
 image:THREE.Mesh;photo:WorldPhoto;slot:BunkerPhotoSlot;
 texture:THREE.Texture|null;generation:number;pending:boolean};

/**
 * A lightweight aquarium-blue photography museum: pressure-glass walls, metal
 * bulkheads, an operable circular hatch and individually framed image panels.
 * Wall/roof/floor/trim meshes are instanced. Photos load only near the diver,
 * with a bounded residency and immediate GPU texture disposal on departure.
 */
export function createWorldUnderwaterGallery(photos:readonly WorldPhoto[]){
 const layout=bunkerLayout();
 const root=new THREE.Group();root.name="sea-glass-underwater-photo-maze";
 const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
 const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
 const mat=<T extends THREE.Material>(m:T)=>{materials.push(m);return m;};
 const glass=mat(new THREE.MeshStandardMaterial({
  color:"#198fd4",emissive:"#085078",emissiveIntensity:.24,
  metalness:.15,roughness:.12,transparent:true,opacity:.34,
  depthWrite:false,side:THREE.DoubleSide,
 }));
 const metal=mat(new THREE.MeshStandardMaterial({
  color:"#27485d",metalness:.67,roughness:.35,emissive:"#063042",emissiveIntensity:.16,
 }));
 const dark=mat(new THREE.MeshStandardMaterial({
  color:"#103b4e",metalness:.44,roughness:.56,emissive:"#0a3349",emissiveIntensity:.18,
 }));
 const glow=mat(new THREE.MeshBasicMaterial({color:"#38d8df",toneMapped:false}));
 const floorMat=mat(new THREE.MeshStandardMaterial({
  color:"#163747",metalness:.18,roughness:.75,emissive:"#072934",emissiveIntensity:.22,
 }));
 const box=geo(new THREE.BoxGeometry(1,1,1)),photoGeo=geo(new THREE.PlaneGeometry(1,1));
 const dummy=new THREE.Object3D();
 const wallMeshes=new THREE.InstancedMesh(box,glass,layout.walls.length);
 const edgeMeshes=new THREE.InstancedMesh(box,metal,layout.walls.length*2);
 const ceiling=new THREE.InstancedMesh(box,glass,UNDERWATER_BUNKER.grid**2);
 const floors=new THREE.InstancedMesh(box,floorMat,UNDERWATER_BUNKER.grid**2);
 const floorLight=new THREE.InstancedMesh(box,glow,UNDERWATER_BUNKER.grid**2);
 const colliders:Obstacle[]=[];
 let e=0;
 const put=(inst:THREE.InstancedMesh,index:number,x:number,y:number,z:number,
  sx:number,sy:number,sz:number,ry=0)=>{
  dummy.position.set(x,y,z);dummy.rotation.set(0,ry,0);
  dummy.scale.set(sx,sy,sz);dummy.updateMatrix();inst.setMatrixAt(index,dummy.matrix);
 };
 for(let i=0;i<layout.walls.length;i++){
  const w=layout.walls[i],horizontal=w.along==="x";
  const y=seaFloorHeight(w.x,w.z)+UNDERWATER_BUNKER.wallHeight/2+.05;
  const rotate=horizontal?0:Math.PI/2;
  // Extend below the sloping seafloor to avoid hairline daylight gaps
  // between adjacent pressure panels and terrain triangles.
  put(wallMeshes,i,w.x,y-.34,w.z,w.length,
   UNDERWATER_BUNKER.wallHeight+.68,.13,rotate);
  for(const offset of [-w.length/2+.09,w.length/2-.09]){
   put(edgeMeshes,e++,w.x+(horizontal?offset:0),y,
    w.z+(horizontal?0:offset),.13,UNDERWATER_BUNKER.wallHeight+.15,.16,0);
  }
  // Continuous circular samples provide swept collision through frame hitches.
  const count=Math.max(2,Math.ceil(w.length/.47));
  for(let k=0;k<=count;k++){
   const f=k/count-.5;
   colliders.push({x:w.x+(horizontal?f*w.length:0),
    z:w.z+(horizontal?0:f*w.length),radius:.08});
  }
 }
 const g=UNDERWATER_BUNKER.grid,size=UNDERWATER_BUNKER.cell;
 for(let r=0;r<g;r++)for(let c=0;c<g;c++){
  const x=UNDERWATER_BUNKER.center.x+(c-(g-1)/2)*size;
  const z=UNDERWATER_BUNKER.center.z+(r-(g-1)/2)*size;
  const floor=seaFloorHeight(x,z);
  const index=r*g+c;
  put(floors,index,x,floor+.05,z,size-.10,.13,size-.10);
  put(ceiling,index,x,floor+UNDERWATER_BUNKER.wallHeight+.16,z,
   size-.12,.09,size-.12);
  put(floorLight,index,x,floor+.13,z,size-.45,.02,.06);
 }
 for(const instance of [wallMeshes,edgeMeshes,ceiling,floors,floorLight]){
  instance.instanceMatrix.needsUpdate=true;
  instance.frustumCulled=false;
  root.add(instance);
 }
 wallMeshes.name="translucent-blue-pressure-glass-bulkheads";
 ceiling.name="transparent-blue-ocean-skylights";
 // The circular airlock opens vertically inside a fixed steel pressure ring.
 const ringGeo=geo(new THREE.TorusGeometry(1.45,.18,8,32));
 const lipGeo=geo(new THREE.TorusGeometry(1.27,.06,7,32));
 const circleGeo=geo(new THREE.CircleGeometry(1.29,32));
 const hatch=new THREE.Group();
 hatch.position.set(layout.entry.x,layout.entryY,layout.entry.z);
 hatch.rotation.y=Math.PI/2;
 const ring=new THREE.Mesh(ringGeo,metal),rim=new THREE.Mesh(lipGeo,glow);
 ring.name="sea-glass-airlock-ring";hatch.add(ring,rim);
 const door=new THREE.Mesh(circleGeo,dark);
 door.name="sea-glass-circular-metal-hatch";
 // A door rising upward never obstructs the narrow entrance corridor while open.
 door.position.z=-.055;
 hatch.add(door);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3;
  const bolt=new THREE.Mesh(geo(new THREE.SphereGeometry(.07,5,4)),glow);
  bolt.position.set(Math.cos(a)*1.35,Math.sin(a)*1.35,.12);hatch.add(bolt);
 }
 root.add(hatch);
 const pressureDoor:Obstacle[]=[];
 for(let i=0;i<8;i++)pressureDoor.push({
  x:layout.entry.x,z:layout.entry.z-1.3+i*2.6/7,radius:.1,
 });
 const loader=new THREE.TextureLoader();
 const photoEntries:PhotoEntry[]=[],targets:THREE.Mesh[]=[];
 const panelBase=mat(new THREE.MeshBasicMaterial({color:"#092b40",toneMapped:false}));
 const pictureFrame=mat(new THREE.MeshBasicMaterial({color:"#8ddde8",toneMapped:false}));
 for(let i=0;i<Math.min(photos.length,layout.slots.length);i++){
  const photo=photos[i],slot=layout.slots[i];
  const grp=new THREE.Group();
  grp.position.set(slot.x,slot.y,slot.z);grp.rotation.y=slot.yaw;
  const frame=new THREE.Mesh(box,pictureFrame);
  frame.scale.set(2.91,2.18,.075);frame.position.z=.012;grp.add(frame);
  const backing=new THREE.Mesh(box,panelBase);
  backing.scale.set(2.78,2.06,.07);backing.position.z=.072;grp.add(backing);
  const aspect=Math.max(.2,Math.min(4,photo.width/Math.max(1,photo.height)));
  const width=Math.min(2.67,1.94*aspect),height=width/aspect;
  const material=mat(new THREE.MeshBasicMaterial({
   color:"#b2c7d1",toneMapped:false,side:THREE.DoubleSide,
  }));
  const image=new THREE.Mesh(photoGeo,material);
  image.scale.set(width,height,1);image.position.z=.118;
  image.userData.photoId=photo.id;image.userData.galleryPhotoIndex=i;
  image.name="underwater-photo-"+photo.id;grp.add(image);
  grp.visible=false;root.add(grp);targets.push(image);
  photoEntries.push({group:grp,material,image,photo,slot,
   texture:null,generation:0,pending:false});
 }
 // Subtle marine motif. Each fin-like blue glass vane is instanced, with no
 // animated scene lights or new particle emitter near the busy kelp biome.
 const vanes=new THREE.InstancedMesh(box,glow,12);
 for(let i=0;i<12;i++){
  const a=i*Math.PI*2/12,r=1.83;
  put(vanes,i,layout.entry.x-.35,layout.entryY+Math.sin(a)*r,
   layout.entry.z+Math.cos(a)*r,.055,.13,.055);
 }
 vanes.instanceMatrix.needsUpdate=true;vanes.frustumCulled=false;root.add(vanes);
 const activeTextures=new Map<number,THREE.Texture>();
 let alive=true,openAmount=0,isOpen=false,updateClock=0,failed=0;
 function unload(entry:PhotoEntry){
  entry.generation++;
  if(entry.texture){entry.texture.dispose();entry.texture=null;
   activeTextures.delete(photoEntries.indexOf(entry));}
  entry.material.map=null;entry.material.color.set("#b2c7d1");
  entry.material.needsUpdate=true;
  entry.pending=false;
 }
 function load(entry:PhotoEntry,index:number){
  if(entry.texture||entry.pending)return;
  entry.pending=true;const token=++entry.generation;
  const t=loader.load(entry.photo.thumbSrc??entry.photo.src,()=>{
   if(!alive||token!==entry.generation){t.dispose();return;}
   t.colorSpace=THREE.SRGBColorSpace;
   t.anisotropy=2;
   entry.texture=t;entry.material.map=t;entry.material.color.set("#ffffff");
   entry.material.needsUpdate=true;entry.pending=false;
   activeTextures.set(index,t);
  },undefined,()=>{
   if(!alive||token!==entry.generation)return;
   failed++;entry.pending=false;
   // The clearly visible neutral frame remains even if the image is missing.
  });
  t.colorSpace=THREE.SRGBColorSpace;
 }
 function update(player:Point,y:number,mode:string,dt:number){
  const close=bunkerNearby(player,46);
  root.visible=close&&mode!=="land";
  const eligible=bunkerHatchAccessible(player,y,mode)||
   (bunkerInside(player)&&Math.hypot(player.x-layout.entry.x,player.z-layout.entry.z)<5);
  isOpen=eligible;
  openAmount+=((isOpen?1:0)-openAmount)*(1-Math.exp(-Math.min(.2,dt)*4.2));
  door.position.y=openAmount*2.9;
  // Photo texturing is throttled to 2Hz; photos more than 17m away have no
  // GPU texture resident. The maze geometry stays stable and collision-solid.
  updateClock+=dt;
  if(updateClock>=.5||!root.visible){
   updateClock=0;
   const nearby=photoEntries.map((p,index)=>({
    index,d:Math.hypot(p.slot.x-player.x,p.slot.z-player.z),
   })).sort((a,b)=>a.d-b.d);
   const allowed=new Set(nearby.filter(p=>root.visible&&p.d<17)
    .slice(0,12).map(p=>p.index));
   for(let i=0;i<photoEntries.length;i++){
    const photo=photoEntries[i];
    photo.group.visible=root.visible&&
      Math.hypot(photo.slot.x-player.x,photo.slot.z-player.z)<19;
    if(allowed.has(i))load(photo,i);
    else if(photo.texture||photo.pending)unload(photo);
   }
  }
  return {near:close,open:isOpen,inside:bunkerInside(player),
   loaded:activeTextures.size,missing:failed};
 }
 return {root,targets,layout,update,
  get obstacles(){return isOpen?colliders:[...colliders,...pressureDoor];},
  get loadedPhotos(){return activeTextures.size;},
  get photoCount(){return photoEntries.length;},
  constrain(from:Point,to:Point){
   if(!bunkerNearby(from,30)&&!bunkerNearby(to,30))return to;
   return constrainMove(from,to,isOpen?colliders:[...colliders,...pressureDoor]);
  },
  dispose(){
   alive=false;
   for(const p of photoEntries)unload(p);
   root.removeFromParent();
   geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  },
 };
}
