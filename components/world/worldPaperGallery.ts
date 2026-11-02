import * as THREE from "three/src/Three.Core.js";
import {paperCaveFloorHeight} from "@/lib/world/model";

type PaperCard={id:string;title:string;year:number|null;href:string};

/** Existing waterfall museum, not an invented second archive.
 * Eight true research records become framed, clickable exhibits on two rows
 * of the original stone back wall. All visitor-facing details are sourced. */
export function createWorldPaperGallery(scene:THREE.Scene,papers:readonly PaperCard[]){
  const root=new THREE.Group();
  root.name="waterfall-paper-museum";
  scene.add(root);
  const targets:THREE.Mesh[]=[];
  const geometries:THREE.BufferGeometry[]=[];
  const materials:THREE.Material[]=[];
  const textures:THREE.Texture[]=[];
  const paperFloor=paperCaveFloorHeight({x:-20,z:-35});
  const backMaterial=new THREE.MeshStandardMaterial({color:"#5b4834",roughness:.82});
  const goldMaterial=new THREE.MeshStandardMaterial({color:"#c8a778",metalness:.48,roughness:.43});
  materials.push(backMaterial,goldMaterial);
  const box=new THREE.BoxGeometry(1,1,1);geometries.push(box);
  function wrap(ctx:CanvasRenderingContext2D,title:string,maxWidth:number){
    const lines:string[]=[];
    let line="";
    for(const word of title.split(/\s+/)){
      const next=line?line+" "+word:word;
      if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}
      else line=next;
    }
    if(line)lines.push(line);
    return lines;
  }
  papers.slice(0,8).forEach((paper,index)=>{
    const col=index%4,row=Math.floor(index/4);
    const x=-22.85+col*1.9;
    const y=paperFloor+(row===0?2.95:1.16);
    const bg=new THREE.Mesh(box,backMaterial);
    bg.position.set(x,y,-35.56);bg.scale.set(1.73,1.72,.12);
    root.add(bg);
    const trim=new THREE.Mesh(box,goldMaterial);
    trim.position.set(x,y,-35.48);trim.scale.set(1.61,1.6,.065);
    root.add(trim);
    const canvas=document.createElement("canvas");
    canvas.width=512;canvas.height=560;
    const ctx=canvas.getContext("2d");
    if(ctx){
      ctx.fillStyle="#eee4d0";ctx.fillRect(0,0,512,560);
      ctx.fillStyle="#a17e51";ctx.fillRect(26,22,460,3);
      ctx.fillStyle="#544333";
      ctx.textAlign="left";ctx.font="700 22px Georgia,serif";
      ctx.fillText("RESEARCH ARCHIVE",31,58);
      ctx.font="20px Georgia,serif";
      ctx.fillText(String(paper.year??"Publication"),31,95);
      ctx.font="bold 26px Georgia,serif";
      const lines=wrap(ctx,paper.title,448);
      lines.slice(0,10).forEach((line,i)=>ctx.fillText(line,31,155+i*34));
      ctx.fillStyle="#806548";ctx.fillRect(31,493,448,2);
      ctx.font="18px sans-serif";
      ctx.fillText("View publication  ·  "+String(index+1).padStart(2,"0"),31,529);
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;
    textures.push(texture);
    const material=new THREE.MeshBasicMaterial({
      map:texture,side:THREE.DoubleSide,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    });
    materials.push(material);
    const geometry=new THREE.PlaneGeometry(1.53,1.5);
    geometries.push(geometry);
    const art=new THREE.Mesh(geometry,material);
    art.position.set(x,y,-35.425);
    art.userData.discovery="gallery-paper:"+index;
    art.name="waterfall-paper-"+index;
    art.frustumCulled=false;
    art.renderOrder=2;
    root.add(art);targets.push(art);
  });
  return {root,targets,count:targets.length,dispose(){
    root.removeFromParent();
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
    textures.forEach(t=>t.dispose());
  }};
}
