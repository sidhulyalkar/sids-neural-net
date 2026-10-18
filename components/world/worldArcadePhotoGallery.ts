import type * as THREE from "three/src/Three.Core.js";
import {
 SHASTA_PHOTOS,NATURE_PHOTOS,CAVERN_GAME_ART,archivePhotoPath,
} from "@/lib/world/arcadeCavernGalleryContent";

type GalleryKind="shasta-gallery"|"nature-gallery"|"game-gallery";
type GalleryThree=Pick<typeof import("three/src/Three.Core.js"),
 "CanvasTexture"|"SRGBColorSpace"|"LinearMipmapLinearFilter">;
type Area={x:number;y:number;w:number;h:number;angle?:number};
const W=2400,H=1080;
function roundRect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
 c.beginPath();c.roundRect(x,y,w,h,r);
}
function paintWord(c:CanvasRenderingContext2D,title:string,x:number,y:number,size:number,maxWidth:number,fill:string){
 c.save();
 c.translate(x,y);
 c.font="900 "+size+"px Impact,'Arial Black',sans-serif";
 c.textAlign="center";c.textBaseline="middle";c.lineJoin="round";
 const measured=c.measureText(title).width;
 c.scale(Math.min(1,maxWidth/Math.max(1,measured)),1);
 c.strokeStyle="#132b2d";c.lineWidth=size*.22;c.strokeText(title,0,0);
 c.strokeStyle="#ecdbc3";c.lineWidth=size*.053;c.strokeText(title,0,0);
 c.fillStyle=fill;c.fillText(title,0,0);c.restore();
}
function mountains(c:CanvasRenderingContext2D){
 // Underpaint lives ON the cave; the unpainted background stays transparent.
 c.save();c.globalAlpha=.52;
 const layers=[
  {base:1045,high:660,color:"#19454a"},
  {base:1065,high:790,color:"#315c56"},
  {base:1080,high:875,color:"#102f35"},
 ];
 for(const {base,high,color} of layers){
  c.fillStyle=color;c.beginPath();
  c.moveTo(0,base);
  for(let i=0;i<=24;i++){
   const x=i*W/24,offset=Math.sin(i*1.36)*.35+Math.cos(i*.7)*.3;
   c.lineTo(x,high+offset*150+(i%5)*20);
  }
  c.lineTo(W,base);c.closePath();c.fill();
 }
 c.restore();
}
function fadeEdges(c:CanvasRenderingContext2D){
 c.save();c.globalCompositeOperation="destination-in";
 const h=c.createLinearGradient(0,0,W,0);
 h.addColorStop(0,"rgba(255,255,255,0)");
 h.addColorStop(.023,"#fff");h.addColorStop(.978,"#fff");
 h.addColorStop(1,"rgba(255,255,255,0)");
 c.fillStyle=h;c.fillRect(0,0,W,H);
 const v=c.createLinearGradient(0,0,0,H);
 v.addColorStop(0,"rgba(255,255,255,0)");
 v.addColorStop(.047,"#fff");v.addColorStop(.954,"#fff");
 v.addColorStop(1,"rgba(255,255,255,0)");
 c.fillStyle=v;c.fillRect(0,0,W,H);
 c.restore();
}
function framedImage(c:CanvasRenderingContext2D,img:HTMLImageElement,a:Area,seed:number){
 c.save();c.translate(a.x+a.w/2,a.y+a.h/2);
 c.rotate(a.angle??0);c.translate(-a.w/2,-a.h/2);
 c.shadowColor="#07181b";c.shadowBlur=17;c.shadowOffsetY=12;
 c.fillStyle="#d9c6a8";roundRect(c,-11,-11,a.w+22,a.h+22,6);c.fill();
 c.shadowColor="transparent";
 c.fillStyle="#1e3538";roundRect(c,0,0,a.w,a.h,3);c.fill();
 c.save();roundRect(c,0,0,a.w,a.h,3);c.clip();
 const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
 const scale=Math.max(a.w/iw,a.h/ih);
 const sw=a.w/scale,sh=a.h/scale;
 const ox=(iw-sw)*(.49+Math.sin(seed*1.91)*.065);
 const oy=(ih-sh)*(.48+Math.cos(seed*1.67)*.075);
 c.filter="contrast(1.055) saturate(.94)";
 c.drawImage(img,Math.max(0,ox),Math.max(0,oy),sw,sh,0,0,a.w,a.h);
 c.restore();
 c.strokeStyle="#fff1d7";c.lineWidth=4;
 c.strokeRect(3,3,a.w-6,a.h-6);
 c.restore();
}
function galleryShasta(c:CanvasRenderingContext2D,imgs:readonly HTMLImageElement[]){
 mountains(c);
 paintWord(c,"SHASTA",1190,134,157,1150,"#f4e3c6");
 paintWord(c,"TRAIL COMPANION",1200,222,66,985,"#b6e7da");
 // Curated primary portrait: Shasta seated among flowering shrubs.
 const hero=imgs[3];
 framedImage(c,hero,{x:853,y:293,w:694,h:652,angle:-.008},3);
 const cards:Area[]=[
  {x:72,y:267,w:238,h:283,angle:-.03},
  {x:346,y:282,w:233,h:275,angle:.042},
  {x:614,y:298,w:213,h:254,angle:-.033},
  {x:67,y:627,w:232,h:276,angle:.022},
  {x:338,y:643,w:234,h:274,angle:-.025},
  {x:612,y:658,w:211,h:257,angle:.036},
  {x:1587,y:288,w:215,h:259,angle:.026},
  {x:1836,y:275,w:228,h:280,angle:-.041},
  {x:2090,y:286,w:232,h:270,angle:.02},
  {x:1590,y:651,w:220,h:262,angle:-.019},
  {x:1844,y:644,w:220,h:269,angle:.032},
  {x:2094,y:633,w:225,h:282,angle:-.023},
 ];
 const surrounding=imgs.filter((_,i)=>i!==3);
 for(let i=0;i<cards.length;i++)framedImage(c,surrounding[i],cards[i],i+13);
 // Small intentionally chunky paw icon, not a swarm of procedurally
 // random marks over the photo faces.
 c.save();c.globalAlpha=.67;c.fillStyle="#eacb9c";
 c.beginPath();c.ellipse(455,159,20,17,0,0,Math.PI*2);c.fill();
 for(const [x,y] of [[424,133],[443,119],[465,122],[487,139]]){
  c.beginPath();c.ellipse(x,y,8,11,0,0,Math.PI*2);c.fill();
 }
 c.restore();
}
function galleryNature(c:CanvasRenderingContext2D,imgs:readonly HTMLImageElement[]){
 mountains(c);
 paintWord(c,"WILD PLACES",1200,115,151,1780,"#eed9bb");
 paintWord(c,"MOUNTAINS  ·  FORESTS  ·  WATER",1200,221,51,1590,"#a5e6d9");
 // A landscape photography exhibition cut directly from the owner's
 // image archive. Broad frames and real subject images take priority over
 // geometric fake waterfall shapes.
 const areas:Area[]=[
  {x:67,y:280,w:525,h:300,angle:-.016},
  {x:623,y:284,w:531,h:297,angle:.012},
  {x:1187,y:280,w:538,h:301,angle:-.01},
  {x:1752,y:277,w:577,h:302,angle:.022},
  {x:65,y:621,w:535,h:316,angle:.009},
  {x:620,y:625,w:538,h:314,angle:-.017},
  {x:1185,y:619,w:540,h:323,angle:.012},
  {x:1760,y:620,w:570,h:313,angle:-.014},
 ];
 const ids=[0,2,3,6,7,8,9,11];
 areas.forEach((area,i)=>framedImage(c,imgs[ids[i]],area,i+54));
}
function galleryGames(c:CanvasRenderingContext2D,imgs:readonly HTMLImageElement[]){
 mountains(c);
 paintWord(c,"PLAY MY GAMES",1200,111,155,1910,"#f8d6bd");
 paintWord(c,"THREE WORLDS · ONE ARCADE",1200,210,53,1530,"#9be0d9");
 const areas:Area[]=[
  {x:58,y:284,w:728,h:647,angle:-.008},
  {x:838,y:283,w:728,h:647,angle:.005},
  {x:1619,y:278,w:719,h:649,angle:-.005},
 ];
 const colors=["#e4c9a8","#9be6df","#f5b8f3"];
 for(let i=0;i<areas.length;i++){
  const area=areas[i],image=imgs[i];
  // Distinct real project artwork, never hand-coded character doodles.
  // Letterbox an original wide banner, so logos are never cropped.
  c.save();c.translate(area.x+area.w/2,area.y+area.h/2);
  c.rotate(area.angle??0);c.translate(-area.w/2,-area.h/2);
  c.shadowColor="#081e25";c.shadowBlur=25;c.shadowOffsetY=13;
  c.fillStyle="#1b253d";roundRect(c,-12,-12,area.w+24,area.h+24,9);c.fill();
  c.shadowColor="transparent";c.strokeStyle=colors[i];c.lineWidth=10;
  c.strokeRect(0,0,area.w,area.h);
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const scale=Math.min((area.w-18)/iw,(area.h-84)/ih);
  const w=iw*scale,h=ih*scale;
  c.drawImage(image,(area.w-w)/2,(area.h-85-h)/2+15,w,h);
  c.restore();
  paintWord(c,CAVERN_GAME_ART[i].label,
   area.x+area.w/2,area.y+area.h-37,48,area.w-40,colors[i]);
 }
}
/** Runs once per cave mount; each input is an existing local site asset.
 * Cache is only one GPU texture per complete gallery, not 28 extra meshes.
 * The caller owns texture disposal and suppresses stale async completion.
 */
export async function composeArcadeGallery(
 kind:GalleryKind,three:GalleryThree,
):Promise<{texture:THREE.Texture;photoCount:number}>{
 const sources=kind==="shasta-gallery"?
  SHASTA_PHOTOS.map(id=>archivePhotoPath(id,id==="photo-037")):
  kind==="nature-gallery"?
   NATURE_PHOTOS.map(id=>archivePhotoPath(id)):
   CAVERN_GAME_ART.map(item=>item.src);
 const images=await Promise.all(sources.map(src=>new Promise<HTMLImageElement>((resolve,reject)=>{
  const img=new Image();
  img.decoding="async";
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error("Failed loading local arcade gallery asset "+src));
  img.src=src;
 })));
 const canvas=document.createElement("canvas");
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Gallery compositor needs Canvas2D");
 if(kind==="shasta-gallery")galleryShasta(ctx,images);
 else if(kind==="nature-gallery")galleryNature(ctx,images);
 else galleryGames(ctx,images);
 fadeEdges(ctx);
 const texture=new three.CanvasTexture(canvas);
 texture.colorSpace=three.SRGBColorSpace;
 texture.generateMipmaps=true;texture.minFilter=three.LinearMipmapLinearFilter;
 texture.anisotropy=4;
 return {texture,photoCount:images.length};
}
