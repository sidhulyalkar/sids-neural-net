import * as THREE from "three/src/Three.Core.js";
import {GeometryBatch} from "./worldGeometry";
import {
  RESEARCH_MUSEUM_SLOTS,RESEARCH_MUSEUM_VIEW,
  researchMuseumLayoutValid,
} from "@/lib/world/researchMuseum";

type PaperCard={id:string;title:string;year:number|null;href:string};

/** Full multi-room research gallery behind the original hidden waterfall.
 * The eight genuine publication records span three connected rooms with
 * straight-on visitor approaches and no overlapping door/floor geometry.
 * Frames are batched; only the eight unique paper canvases are separate.
 */
export function createWorldPaperGallery(scene:THREE.Scene,papers:readonly PaperCard[]){
  if(!researchMuseumLayoutValid())
    throw new Error("Waterfall museum has obstructed paper viewing positions");
  const root=new THREE.Group();root.name="waterfall-paper-museum";
  scene.add(root);
  const targets:THREE.Mesh[]=[];
  const geometries:THREE.BufferGeometry[]=[];
  const materials:THREE.Material[]=[];
  const textures:THREE.Texture[]=[];
  const baseGeo=new THREE.BoxGeometry(1,1,1);
  const fleurGeo=new THREE.IcosahedronGeometry(1,1);
  const paperGeo=new THREE.PlaneGeometry(
    RESEARCH_MUSEUM_VIEW.artWidth,RESEARCH_MUSEUM_VIEW.artHeight);
  geometries.push(baseGeo,fleurGeo,paperGeo);
  const woodBatch=new GeometryBatch();
  const goldBatch=new GeometryBatch();
  const matteBatch=new GeometryBatch();
  const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const size=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const details=(slot:(typeof RESEARCH_MUSEUM_SLOTS)[number],
    dx:number,dy:number,depth:number)=>{
    const {yaw}=slot;
    return V(slot.x+Math.cos(yaw)*dx+Math.sin(yaw)*depth,
      slot.y+dy,
      slot.z-Math.sin(yaw)*dx+Math.cos(yaw)*depth);
  };
  const frameW=RESEARCH_MUSEUM_VIEW.frameWidth;
  const frameH=RESEARCH_MUSEUM_VIEW.frameHeight;
  const wrap=(ctx:CanvasRenderingContext2D,title:string,maxWidth:number)=>{
    const lines:string[]=[];let line="";
    for(const word of title.split(/\s+/)){
      const candidate=line?line+" "+word:word;
      if(ctx.measureText(candidate).width>maxWidth&&line){
        lines.push(line);line=word;
      }else line=candidate;
    }
    if(line)lines.push(line);
    return lines;
  };
  papers.slice(0,8).forEach((paper,index)=>{
    const slot=RESEARCH_MUSEUM_SLOTS[index];
    if(!slot)return;
    const rotation=new THREE.Euler(0,slot.yaw,0);
    const wood="#493629",gold="#c9a06d",antique="#e8c594";
    woodBatch.add(baseGeo,wood,details(slot,0,0,-.07),
      size(frameW+.16,frameH+.20,.13),rotation);
    goldBatch.add(baseGeo,gold,details(slot,0,0,-.005),
      size(frameW,frameH,.075),rotation);
    matteBatch.add(baseGeo,"#312c28",details(slot,0,0,.057),
      size(RESEARCH_MUSEUM_VIEW.artWidth+.10,
        RESEARCH_MUSEUM_VIEW.artHeight+.11,.05),rotation);
    for(const x of [-1,1]){
      for(const y of [-1,1]){
        goldBatch.add(fleurGeo,antique,
          details(slot,x*frameW*.49,y*frameH*.48,.067),
          size(.10,.13,.045),rotation);
      }
      goldBatch.add(baseGeo,antique,
        details(slot,x*frameW*.44,0,.073),
        size(.025,frameH-.22,.022),rotation);
    }
    for(const y of [-1,1]){
      goldBatch.add(baseGeo,antique,
        details(slot,0,y*frameH*.44,.073),
        size(frameW-.17,.025,.022),rotation);
    }
    goldBatch.add(fleurGeo,antique,
      details(slot,0,frameH*.52+.095,.04),
      size(.21,.14,.07),rotation);
    const canvas=document.createElement("canvas");
    canvas.width=768;canvas.height=840;
    const ctx=canvas.getContext("2d");
    if(ctx){
      ctx.fillStyle="#f0e6d2";ctx.fillRect(0,0,768,840);
      ctx.fillStyle="#ac885e";ctx.fillRect(35,34,698,4);
      ctx.fillStyle="#574434";ctx.textAlign="left";
      ctx.font="700 30px Georgia,serif";
      ctx.fillText("RESEARCH ARCHIVE",46,96);
      ctx.font="26px Georgia,serif";
      ctx.fillText(String(paper.year??"Publication"),46,151);
      ctx.font="bold 38px Georgia,serif";
      const lines=wrap(ctx,paper.title,670);
      lines.slice(0,13).forEach((line,i)=>ctx.fillText(line,46,227+i*41));
      ctx.fillStyle="#967653";ctx.fillRect(46,748,670,2);
      ctx.font="25px Georgia,serif";
      ctx.fillText("View publication  ·  "+
        String(index+1).padStart(2,"0"),46,800);
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    textures.push(texture);
    const material=new THREE.MeshBasicMaterial({
      map:texture,side:THREE.DoubleSide,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    });
    materials.push(material);
    const art=new THREE.Mesh(paperGeo,material);
    art.position.copy(details(slot,0,0,.101));
    art.rotation.y=slot.yaw;
    art.userData.discovery="gallery-paper:"+index;
    art.name="waterfall-paper-"+index;
    art.frustumCulled=false;art.renderOrder=2;
    root.add(art);targets.push(art);
  });
  const mats=[
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,
      metalness:.02,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:.46,
      metalness:.43,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,
      metalness:0,side:THREE.DoubleSide}),
  ];
  materials.push(...mats);
  const frameMeshes=[
    new THREE.Mesh(woodBatch.finish(),mats[0]),
    new THREE.Mesh(goldBatch.finish(),mats[1]),
    new THREE.Mesh(matteBatch.finish(),mats[2]),
  ];
  for(const [index,mesh] of frameMeshes.entries()){
    mesh.name=["museum-wood-frames","museum-ornate-gold",
      "museum-dark-matting"][index];
    root.add(mesh);
  }
  return {
    root,targets,count:targets.length,roomCount:3,
    dispose(){
      root.removeFromParent();
      for(const mesh of frameMeshes)mesh.geometry.dispose();
      geometries.forEach(g=>g.dispose());
      materials.forEach(m=>m.dispose());
      textures.forEach(t=>t.dispose());
    },
  };
}
