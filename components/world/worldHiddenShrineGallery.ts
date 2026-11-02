import * as THREE from "three/src/Three.Core.js";
import { visualArchive } from "@/src/data/visualArchive";
import { GeometryBatch } from "./worldGeometry";
import {
  SHRINE_GALLERY, GALLERY_ROOMS, galleryDoorSide,
  galleryPhotoSlots, galleryShaftTopY, galleryFloorFootprint,
  galleryDoorThresholds, galleryCeilingTiles, type GallerySide,
} from "@/lib/world/hiddenShrineGallery";

/**
 * A truly enclosed submerged stone gallery, NOT an ocean-facing glass maze.
 * The weathered wooden shrine is external; gallery stone, photos and lamps
 * render only during the descent / inside the authored chamber volume.
 */
export function createHiddenShrineGallery(scene: THREE.Scene) {
  const exterior = new THREE.Group();
  const interior = new THREE.Group();
  exterior.name = "hidden-wooden-shrine";
  interior.name = "sealed-stone-photo-gallery";
  exterior.visible = false;
  interior.visible = false;
  scene.add(exterior, interior);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(box);
  const stone = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.96,
    depthWrite:true, depthTest:true,
  });
  const ornateFrameMaterial=new THREE.MeshStandardMaterial({
    vertexColors:true,metalness:.52,roughness:.36,side:THREE.DoubleSide,
    depthWrite:true,depthTest:true,
  });
  const wood = new THREE.MeshStandardMaterial({ color: "#58402d", roughness: .96 });
  const edge = new THREE.MeshStandardMaterial({ color: "#9b805d", roughness: .9 });
  materials.push(stone, ornateFrameMaterial, wood, edge);
  function plank(parent: THREE.Group, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, material: THREE.Material, rx = 0, rz = 0) {
    const m = new THREE.Mesh(box, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, 0, rz);
    parent.add(m);
    return m;
  }

  const seaFloor = galleryShaftTopY();
  const e = SHRINE_GALLERY.entrance;
  // Low profile and muted timber: the roof itself is below the ocean surface.
  for (const dx of [-1.45, 1.45]) for (const dz of [-1.45, 1.45]) {
    plank(exterior, e.x + dx, seaFloor + 1.0, e.z + dz,
      .23, 2.0, .23, wood);
  }
  for (const dz of [-1.55, 1.55])
    plank(exterior, e.x, seaFloor + 2.04, e.z + dz,
      3.65, .28, .34, edge);
  for (const dx of [-1.55, 1.55])
    plank(exterior, e.x + dx, seaFloor + 2.04, e.z,
      .24, .28, 3.4, wood);
  plank(exterior, e.x - .89, seaFloor + 2.48, e.z, 2.2, .19, 3.75, wood, 0, -.22);
  plank(exterior, e.x + .89, seaFloor + 2.48, e.z, 2.2, .19, 3.75, wood, 0, .22);
  for(const dz of [-1.35,1.35]) plank(exterior,e.x,seaFloor+.19,e.z+dz,
    3.1,.22,.2,edge);
  for(const dx of [-1.35,1.35]) plank(exterior,e.x+dx,seaFloor+.19,e.z,
    .2,.22,3.1,edge);
  // Pale threshold markers quietly reveal the shaft to observant divers.
  for (const dx of [-1, 1]) {
    const glow = new THREE.MeshStandardMaterial({
      color: "#e2c088", emissive: "#af7c43", emissiveIntensity: .62,
    });
    materials.push(glow);
    plank(exterior, e.x + dx * 1.28, seaFloor + .28, e.z + 1.35,
      .13, .18, .14, glow);
  }

  const batched = new GeometryBatch();
  const frameBatch = new GeometryBatch();
  // A small shared set of carved ornament primitives is merged into the
  // existing frame batch. No per-photo meshes, draw calls or cloned materials.
  const ornamentBead=new THREE.SphereGeometry(1,8,6);
  const ornamentStroke=new THREE.CylinderGeometry(1,1,1,7);
  geometries.push(ornamentBead,ornamentStroke);
  const up=new THREE.Vector3(0,1,0);
  const v = (x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const add = (x:number,y:number,z:number,sx:number,sy:number,sz:number,
    color:string, yaw=0) =>
    batched.add(box,color,v(x,y,z),v(sx,sy,sz),new THREE.Euler(0,yaw,0));
  const h=SHRINE_GALLERY.halfRoom;
  const t=SHRINE_GALLERY.wallThickness;
  const bottom=SHRINE_GALLERY.floorY;
  const top=SHRINE_GALLERY.roofY;
  const height=top-bottom;
  function wall(r:{x:number;z:number},side:GallerySide,open:boolean){
    const horizontal=side==="north"||side==="south";
    const edgePosition=horizontal
      ? r.z+(side==="south"?h:-h)
      : r.x+(side==="east"?h:-h);
    const segment=(offset:number,length:number,y:number,sy:number)=>{
      if(horizontal) add(r.x+offset,y,edgePosition,length,sy,t,"#514e46");
      else add(edgePosition,y,r.z+offset,t,sy,length,"#514e46");
    };
    if(!open){segment(0,2*h,bottom+height/2,height);return;}
    const opening=SHRINE_GALLERY.doorHalfWidth;
    const sideLength=h-opening;
    segment(-(h+opening)/2,sideLength,bottom+height/2,height);
    segment((h+opening)/2,sideLength,bottom+height/2,height);
    // Head-height stone lintel makes the doorway feel excavated, not glassy.
    segment(0,opening*2,bottom+height-.32,.64);
  }
  // This single foundation replaces 12 room slabs and 11 overlapping
  // bridge plates. The old bridge plates were COPLANAR with both room floors
  // and flickered at exactly the shared door thresholds.
  const floor=galleryFloorFootprint();
  add(floor.x,bottom-.22,floor.z,floor.width,.45,floor.depth,"#494d46");
  // The ceiling uses the same disjoint-patch geometry invariant as the
  // foundation, except for the deliberate 2.8m shaft opening.
  for(const patch of galleryCeilingTiles()){
    add(patch.x,top+.28,patch.z,patch.width,.62,patch.depth,"#353b37");
  }
  for (const [i,r] of GALLERY_ROOMS.entries()) {
    for (const side of ["north","east","south","west"] as const)
      wall(r,side,galleryDoorSide(i,side));
    // Natural dressed-stone shoulders, subtle variation in place of cyan glass.
    for(const dx of [-h+.38,h-.38])for(const dz of [-h+.38,h-.38])
      add(r.x+dx,bottom+height/2,r.z+dz,.48,height,.48,
        (i+dx+dz)%3>0?"#646157":"#484e49");
  }
  // Raised, narrow brass-stone sills mark passages without a coplanar
  // second floor face. Their entire underside clears the foundation top.
  for(const sill of galleryDoorThresholds()){
    add(sill.x,bottom+.045,sill.z,sill.width,.045,sill.depth,"#847356");
  }
  // The entry shaft really does extend upward to the sea-floor opening.
  const shaftHeight=seaFloor-(top+.2);
  for(const side of [-1,1]){
    add(e.x+side*1.5,top+shaftHeight/2,e.z,.32,shaftHeight,3.2,"#625a4b");
    add(e.x,top+shaftHeight/2,e.z+side*1.5,3.2,shaftHeight,.32,"#625a4b");
  }
  // The last frame has its own freestanding stone back inside the vestibule.
  const entrancePhoto=galleryPhotoSlots().at(-1)!;
  batched.add(box,"#5c584e",
    v(entrancePhoto.x,SHRINE_GALLERY.floorY+1.9,entrancePhoto.z),
    v(1.82,3.3,.2),new THREE.Euler(0,entrancePhoto.yaw,0));
  const stoneGeometry=batched.finish();
  geometries.push(stoneGeometry);
  const stoneMesh=new THREE.Mesh(stoneGeometry,stone);
  stoneMesh.name="opaque-gallery-stone-shell";
  stoneMesh.frustumCulled=false;
  stoneMesh.renderOrder=0;
  interior.add(stoneMesh);

  // The atlas is a SINGLE GPU texture. Each failed thumbnail only replaces its
  // own tile with a labelled fallback, never hiding other photographs.
  const slots=galleryPhotoSlots();
  // 2688² atlas supplies safe image fallbacks while nearby photos use their
  // ORIGINAL high-resolution web files, loaded only around the viewer.
  const columns=7,tileW=384,tileH=384;
  const canvas=document.createElement("canvas");
  canvas.width=columns*tileW;canvas.height=columns*tileH;
  const ctx=canvas.getContext("2d");
  if(ctx){
    for(let i=0;i<slots.length;i++){
      const col=i%columns,row=Math.floor(i/columns);
      ctx.fillStyle="#252923";ctx.fillRect(col*tileW,row*tileH,tileW,tileH);
      // Intentionally no titles or file numbers beneath wall-mounted art.
    }
  }
  const atlas=new THREE.CanvasTexture(canvas);
  atlas.colorSpace=THREE.SRGBColorSpace;
  atlas.minFilter=THREE.LinearMipmapLinearFilter;
  atlas.anisotropy=8;
  textures.push(atlas);
  const photoMat=new THREE.MeshBasicMaterial({
    map:atlas,side:THREE.DoubleSide,depthWrite:true,depthTest:true,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
  });
  materials.push(photoMat);
  const photoTargets:THREE.Mesh[]=[];
  const hdMeshes:THREE.Mesh[]=[];
  const placeholderMaterials:THREE.MeshBasicMaterial[]=[];
  let selectedHighRes=new Set<number>();
  const hdResources=new Map<number,{texture:THREE.Texture;material:THREE.Material}>();
  const loading=new Set<number>();
  const photoEntries=new Map(visualArchive.map(p=>[p.id,p]));
  let disposed=false;
  let lastFocusedRoom=-1;
  // Native-resolution photos can each occupy tens of MB in GPU memory.
  // Keep the closest four on desktop, two on mobile; the 2688px atlas
  // remains an always-visible fallback when rotating or changing rooms.
  const highResCap=window.matchMedia("(max-width: 760px)").matches?2:4;
  // Shared plane UVs for full-resolution overlays: never sample a small atlas
  // tile from a native photo texture by mistake.
  const fullUvs=[0,0,1,0,1,1,0,0,1,1,0,1];
  slots.forEach((slot,i)=>{
    const imageHeight=2.15;
    const normalX=Math.sin(slot.yaw),normalZ=Math.cos(slot.yaw);
    const px=slot.x+normalX*.275,pz=slot.z+normalZ*.275;
    const facePoint=(dx:number,dy:number,offset:number)=>
      v(slot.x+Math.cos(slot.yaw)*dx+Math.sin(slot.yaw)*offset,
        slot.y+dy,
        slot.z-Math.sin(slot.yaw)*dx+Math.cos(slot.yaw)*offset);
    const front = (dx:number,dy:number,offset:number,sx:number,sy:number,sz:number,color:string)=>{
      frameBatch.add(box,color,facePoint(dx,dy,offset),v(sx,sy,sz),
        new THREE.Euler(0,slot.yaw,0));
    };
    const bead=(dx:number,dy:number,offset:number,size:number,color:string)=>{
      frameBatch.add(ornamentBead,color,facePoint(dx,dy,offset),
        v(size,size*.85,size*.55),new THREE.Euler(0,slot.yaw,0));
    };
    const carvedStroke=(path:readonly [number,number][],color:string,width=.019)=>{
      for(let k=1;k<path.length;k++){
        const a=facePoint(path[k-1][0],path[k-1][1],.303);
        const b=facePoint(path[k][0],path[k][1],.303);
        const delta=b.clone().sub(a);
        const length=delta.length();
        if(length<.001)continue;
        const rotation=new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(up,delta.normalize()));
        frameBatch.add(ornamentStroke,color,a.add(b).multiplyScalar(.5),
          v(width,length,width),rotation);
      }
    };
    // A layered carved walnut/antique-brass frame, crowned at the top.
    // All pieces are baked into ONE draw call, not 49 independent material sets.
    front(0,0,0,slot.width+.40,imageHeight+.48,.19,"#543b2b");
    front(0,0,.11,slot.width+.31,imageHeight+.39,.09,"#b79055");
    front(0,0,.15,slot.width+.12,imageHeight+.17,.055,"#221a14");
    for(const sign of [-1,1]){
      front(sign*(slot.width/2+.135),0,.20,.075,imageHeight+.31,.07,"#e1b976");
      front(0,sign*(imageHeight/2+.13),.20,slot.width+.24,.07,.07,"#e1b976");
      for(const vSign of [-1,1]){
        front(sign*(slot.width/2+.16),vSign*(imageHeight/2+.16),
          .23,.14,.14,.095,"#f0d198");
      }
      // Symmetrical carved wing details above and below the photographs.
      front(sign*.29,sign*(imageHeight/2+.20),.25,.35,.075,.08,"#aa7843");
    }
    front(0,imageHeight/2+.22,.245,.19,.19,.10,"#eed095");
    front(0,-imageHeight/2-.22,.245,.17,.13,.09,"#eed095");
    // Archival gilding: stepped pediment, crown, floral corner scrollwork,
    // polished rivets and repeated beadwork. The ornament stays strictly
    // OUTSIDE the photograph aperture, so it cannot hide the artwork.
    const halfW=slot.width/2,halfH=imageHeight/2;
    front(0,halfH+.34,.13,.88,.15,.19,"#503324");
    front(0,halfH+.39,.225,.72,.07,.10,"#d3a668");
    front(0,-halfH-.30,.19,.67,.09,.12,"#785336");
    for(const sign of [-1,1]){
      // Twin laurel branches on the upper and lower crowns.
      carvedStroke([
        [sign*.10,halfH+.38],[sign*.22,halfH+.46],
        [sign*.38,halfH+.43],[sign*.51,halfH+.30],
      ],"#edd093",.023);
      carvedStroke([
        [sign*.10,-halfH-.29],[sign*.25,-halfH-.39],
        [sign*.44,-halfH-.28],
      ],"#cfa463",.019);
      bead(sign*.26,halfH+.46,.33,.047,"#e8c47b");
      bead(sign*.36,-halfH-.37,.33,.043,"#efcb8a");
      // Thin carved beading runs down both stiles in evenly spaced relief.
      for(let k=0;k<7;k++){
        bead(sign*(halfW+.16),-.74+k*.25,.30,.036,
          k%2===0?"#eac784":"#b98a4a");
      }
      for(const vertical of [-1,1]){
        const cornerX=sign*(halfW+.16);
        const cornerY=vertical*(halfH+.16);
        bead(cornerX,cornerY,.315,.075,"#f2d99f");
        bead(cornerX,cornerY,.35,.029,"#79502a");
        // Constrained scrolls turn inwards but never cross the picture edge.
        carvedStroke([
          [cornerX,cornerY],
          [cornerX-sign*.10,cornerY+vertical*.095],
          [cornerX-sign*.24,cornerY+vertical*.11],
          [cornerX-sign*.33,cornerY+vertical*.045],
          [cornerX-sign*.28,cornerY-vertical*.012],
        ],"#c99556",.018);
        carvedStroke([
          [cornerX,cornerY],
          [cornerX+sign*.08,cornerY-vertical*.08],
          [cornerX+sign*.09,cornerY-vertical*.18],
        ],"#e7c68b",.017);
      }
    }
    // Central raised shield and inset jewel complete the pediment.
    bead(0,halfH+.43,.33,.115,"#bb8647");
    bead(0,halfH+.47,.392,.062,"#f9df9a");
    bead(0,-halfH-.30,.33,.09,"#b88952");
    const col=i%columns,row=Math.floor(i/columns);
    const u0=(col+.012)/columns,u1=(col+.988)/columns;
    const v0=1-(row+.988)/columns,v1=1-(row+.012)/columns;
    const points=[[-.5,-.5,u0,v0],[.5,-.5,u1,v0],
      [.5,.5,u1,v1],[-.5,-.5,u0,v0],[.5,.5,u1,v1],[-.5,.5,u0,v1]];
    const vertices:number[]=[],uvs:number[]=[];
    for(const [lx,ly,u,vv] of points){
      vertices.push(px+lx*slot.width*Math.cos(slot.yaw),
        slot.y+ly*imageHeight,pz-lx*slot.width*Math.sin(slot.yaw));
      uvs.push(u,vv);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();geometries.push(geometry);
    const m=new THREE.Mesh(geometry,photoMat);
    m.name="gallery-"+slot.id;
    m.userData.discovery=slot.id;
    m.frustumCulled=false;
    m.renderOrder=2;
    photoTargets.push(m);
    interior.add(m);
    const hiGeo=geometry.clone();
    hiGeo.setAttribute("uv",new THREE.Float32BufferAttribute(fullUvs,2));
    hiGeo.translate(normalX*.018,0,normalZ*.018);
    geometries.push(hiGeo);
    const placeholder=new THREE.MeshBasicMaterial({
      color:"#ffffff",side:THREE.DoubleSide,depthWrite:true,depthTest:true,
    });
    const hd=new THREE.Mesh(hiGeo,placeholder);
    placeholderMaterials.push(placeholder);
    materials.push(placeholder);
    hd.visible=false;
    hd.frustumCulled=false;
    hd.renderOrder=3;
    hd.name="high-resolution-"+slot.id;
    hdMeshes.push(hd);
    interior.add(hd);
  });
  const frames=frameBatch.finish();geometries.push(frames);
  const frameMesh=new THREE.Mesh(frames,ornateFrameMaterial);
  frameMesh.frustumCulled=false;
  frameMesh.renderOrder=1;
  interior.add(frameMesh);

  // Stable indirect bounce light avoids abrupt dark-room transitions between
  // the authored point-light pools at each doorway.
  interior.add(new THREE.AmbientLight("#cdb79a",0.42));
  for(let i=0;i<GALLERY_ROOMS.length;i+=2){
    const r=GALLERY_ROOMS[i];
    const lamp=new THREE.PointLight("#ffc68a",3.2,12,2);
    lamp.position.set(r.x,bottom+3.25,r.z);
    interior.add(lamp);
    const material=new THREE.MeshStandardMaterial({
      color:"#d4ac72",emissive:"#f6ae61",emissiveIntensity:.75,
    });
    materials.push(material);
    plank(interior,r.x,bottom+3.55,r.z,.34,.17,.34,material);
  }
  // Start only a bounded number of decodes concurrently.
  let next=0,loaded=0;
  // Only keep full-resolution images in the nearby rooms. Offscreen images
  // remain legible at atlas quality and never flash blank while HD loads.
  function releaseHighResolution(){
    selectedHighRes.clear();
    lastFocusedRoom=-1;
    for(const [i,resource] of hdResources){
      hdMeshes[i].visible=false;
      hdMeshes[i].material=placeholderMaterials[i];
      resource.material.dispose();resource.texture.dispose();
    }
    hdResources.clear();
  }
  function updateNearPhotos(player:{x:number;z:number}){
    let focused=0,best=Infinity;
    for(const [i,room] of GALLERY_ROOMS.entries()){
      const d=Math.hypot(player.x-room.x,player.z-room.z);
      if(d<best){best=d;focused=i;}
    }
    if(focused===lastFocusedRoom)return;
    lastFocusedRoom=focused;
    const candidates=slots.map((slot,i)=>({
      i,dist:Math.hypot(slot.x-player.x,slot.z-player.z)
    })).sort((a,b)=>a.dist-b.dist)
      .filter(o=>o.dist<14).slice(0,highResCap);
    const selected=new Set(candidates.map(o=>o.i));
    selectedHighRes=selected;
    for(const [i,resource] of hdResources){
      if(selected.has(i))continue;
      hdMeshes[i].visible=false;
      hdMeshes[i].material=placeholderMaterials[i];
      resource.material.dispose();resource.texture.dispose();
      hdResources.delete(i);
    }
    for(const {i} of candidates){
      if(hdResources.has(i)||loading.has(i))continue;
      const entry=photoEntries.get(slots[i].id);
      if(!entry)continue;
      loading.add(i);
      const image=new Image();
      image.decoding="async";image.src=entry.src;
      void image.decode().then(()=>{
        if(disposed||!selectedHighRes.has(i))return;
        const tex=new THREE.Texture(image);
        tex.colorSpace=THREE.SRGBColorSpace;
        tex.minFilter=THREE.LinearMipmapLinearFilter;
        tex.magFilter=THREE.LinearFilter;
        tex.anisotropy=8;
        tex.needsUpdate=true;
        const material=new THREE.MeshBasicMaterial({
          map:tex,side:THREE.DoubleSide,depthWrite:true,
          polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
        });
        hdResources.set(i,{texture:tex,material});
        hdMeshes[i].material=material;
        hdMeshes[i].visible=true;
      }).catch(()=>{}).finally(()=>loading.delete(i));
    }
  }
  const entries=photoEntries;
  const worker=async()=>{
    while(next<slots.length && !disposed){
      const i=next++,entry=entries.get(slots[i].id);
      if(!entry||!ctx)continue;
      try{
        const image=new Image();
        image.src=entry.thumbSrc;
        await image.decode();
        if(disposed)return;
        const tx=i%columns*tileW,ty=Math.floor(i/columns)*tileH;
        const availW=tileW-12,availH=tileH-12;
        const scale=Math.min(availW/image.naturalWidth,availH/image.naturalHeight);
        const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
        ctx.fillStyle="#252923";ctx.fillRect(tx,ty,tileW,tileH);
        ctx.drawImage(image,tx+(tileW-w)/2,ty+(tileH-h)/2,w,h);
        loaded++;
      }catch{/* The labelled fallback for this image remains visible. */}
    }
  };
  void Promise.all(Array.from({length:6},()=>worker())).then(()=>{
    if(!disposed)atlas.needsUpdate=true;
  });
  return {
    exterior, interior, photoTargets, stoneMesh,
    photoCount:slots.length,
    loadedPhotos:()=>loaded,
    highResolutionPhotos:()=>hdResources.size,
    updateNearPhotos,releaseHighResolution,
    dispose(){
      disposed=true;
      releaseHighResolution();
      exterior.removeFromParent();interior.removeFromParent();
      geometries.forEach(g=>g.dispose());
      materials.forEach(m=>m.dispose());
      textures.forEach(t=>t.dispose());
    },
  };
}
