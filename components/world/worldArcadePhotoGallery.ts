import type * as THREE from "three/src/Three.Core.js";
import {
 CAVERN_PHOTO_ALBUMS,CAVERN_GAME_ART,CAVERN_GAME_PANEL_ART,
} from "@/lib/world/arcadeCavernGalleryContent";

type GalleryKind="shasta-gallery"|"nature-gallery"|"game-gallery"|"feature-gallery";
type GalleryThree=Pick<typeof import("three/src/Three.Core.js"),
 "CanvasTexture"|"SRGBColorSpace"|"LinearMipmapLinearFilter">;
type Area={x:number;y:number;w:number;h:number;angle?:number};
const W=2400,H=1080;
function roundRect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
 c.beginPath();c.roundRect(x,y,w,h,r);
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
 if(!imgs.length)return;
 // The large central portrait is intentional. Other photos form a balanced
 // collage WITHOUT captions, titles, or lettering baked into the texture.
 const heroIndex=Math.min(CAVERN_PHOTO_ALBUMS.shasta.heroIndex,imgs.length-1);
 framedImage(c,imgs[heroIndex],{x:831,y:101,w:735,h:867,angle:-.006},heroIndex);
 const others=imgs.filter((_,i)=>i!==heroIndex);
 const mid=Math.ceil(others.length/2);
 const groups=[others.slice(0,mid),others.slice(mid)];
 const cols=Math.max(1,Math.min(4,Math.ceil(mid/2)));
 const rows=Math.max(1,Math.ceil(mid/cols));
 for(const [side,group] of groups.entries()){
  const gap=17,regionX=side===0?57:1590;
  const regionWidth=750;
  const cellWidth=(regionWidth-gap*(cols-1))/cols;
  const cellHeight=(882-gap*(rows-1))/rows;
  group.forEach((image,i)=>{
   const col=i%cols,row=Math.floor(i/cols);
   framedImage(c,image,{
    x:regionX+col*(cellWidth+gap),
    y:108+row*(cellHeight+gap),
    w:cellWidth,h:cellHeight,
    angle:((i*7+side*3)%5-2)*.008,
   },i+side*20);
  });
 }
}
/** A softly sprayed landscape exposure without a straight poster border.
 * Each offscreen mask is created once while building the shared gallery atlas.
 * The image remains real photography; the alpha perimeter reveals basalt. */
function photoWash(c:CanvasRenderingContext2D,img:HTMLImageElement,
 x:number,y:number,w:number,h:number,opacity:number){
 const tile=document.createElement("canvas");
 tile.width=Math.round(w);tile.height=Math.round(h);
 const p=tile.getContext("2d");
 if(!p)throw Error("Nature pigment compositing unavailable");
 const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
 const scale=Math.max(w/iw,h/ih);
 const sw=w/scale,sh=h/scale;
 p.drawImage(img,(iw-sw)/2,(ih-sh)/2,sw,sh,0,0,w,h);
 p.globalCompositeOperation="destination-in";
 const mask=p.createRadialGradient(w/2,h/2,Math.min(w,h)*.20,
  w/2,h/2,Math.max(w,h)*.54);
 mask.addColorStop(0,"rgba(255,255,255,1)");
 mask.addColorStop(.62,"rgba(255,255,255,.95)");
 mask.addColorStop(.82,"rgba(255,255,255,.55)");
 mask.addColorStop(1,"rgba(255,255,255,0)");
 p.fillStyle=mask;p.fillRect(0,0,w,h);
 c.save();c.globalAlpha=opacity;c.drawImage(tile,x,y);c.restore();
}
/** Large contiguous peaks, glacier facets and rushing water are the visual
 * bridge between the real travel photographs. They sit BEHIND the photos. */
function natureInk(c:CanvasRenderingContext2D){
 const landscape=(coords:readonly (readonly [number,number])[],fill:string,a:number)=>{
  c.save();c.globalAlpha=a;c.fillStyle=fill;c.beginPath();
  c.moveTo(coords[0][0],coords[0][1]);
  for(const [x,y] of coords.slice(1))c.lineTo(x,y);
  c.closePath();c.fill();c.restore();
 };
 landscape([[0,460],[153,251],[294,431],[423,158],[560,446],
  [719,273],[875,488],[1051,313],[1269,537],[1458,256],
  [1674,467],[1868,213],[2070,422],[2228,285],[2400,506],
  [2400,1080],[0,1080]],"#26565a",.45);
 landscape([[386,204],[423,158],[489,286],[454,256],[426,197],
  [415,241]],"#e8f4e2",.68);
 landscape([[1816,290],[1868,213],[1944,330],[1893,299],
  [1863,253],[1841,277]],"#edf6e6",.68);
 landscape([[0,832],[315,673],[610,826],[880,644],[1120,851],
  [1435,710],[1780,890],[2097,705],[2400,867],[2400,1080],[0,1080]],
  "#183f3f",.53);
 // Thick multi-stroke waterfall + glacier melt, placed in a space
 // intentionally left behind image borders (not across wildlife/people).
 const ribbon=(pts:readonly (readonly [number,number])[],stroke:string,width:number,a:number)=>{
  c.save();c.globalAlpha=a;c.strokeStyle=stroke;c.lineWidth=width;
  c.lineCap="round";c.lineJoin="round";
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
  for(const [x,y] of pts.slice(1))c.lineTo(x,y);
  c.stroke();c.restore();
 };
 ribbon([[2280,205],[2250,342],[2266,479],[2231,616],
  [2247,742]],"#65c3d5",60,.45);
 ribbon([[2295,212],[2272,350],[2288,500],[2255,619],
  [2271,737]],"#e7f7f1",18,.55);
 ribbon([[2256,750],[2108,844],[1943,828],[1747,901],
  [1505,923]],"#55c7c1",56,.45);
 ribbon([[2258,754],[2099,866],[1943,850],[1747,923],
  [1505,944]],"#cbf5e9",13,.53);
 // Pine clusters silhouette through the transition to the rock floor.
 for(let i=0;i<28;i++){
  const x=34+i*90,base=1061+(i%3)*7;
  const height=75+(i%5)*17;
  landscape([[x-29,base],[x,base-height],[x+29,base]],
   i%3===0?"#235e55":"#123f40",.65);
 }
}
function galleryNature(c:CanvasRenderingContext2D,imgs:readonly HTMLImageElement[]){
 mountains(c);natureInk(c);
 if(!imgs.length)return;
 // Automatically accommodate the next album without editing wall geometry.
 // Every configured image appears exactly once in a balanced photo grid.
 const cols=imgs.length>16?5:imgs.length>7?4:Math.min(3,imgs.length);
 const rows=Math.ceil(imgs.length/cols);
 const margin=68,gap=23;
 const cellWidth=(W-margin*2-(cols-1)*gap)/cols;
 const cellHeight=(H-142-(rows-1)*gap)/rows;
 imgs.forEach((image,i)=>{
  const col=i%cols,row=Math.floor(i/cols);
  framedImage(c,image,{
   x:margin+col*(cellWidth+gap),
   y:71+row*(cellHeight+gap),
   w:cellWidth,h:cellHeight,
   angle:((i*5)%7-3)*.004,
  },i+54);
 });
}
function galleryFeature(c:CanvasRenderingContext2D,imgs:readonly HTMLImageElement[]){
 // Narrow photo triptych at the back. Replaces the former oversized
 // SID'S UNDERGROUND sign; no typography is generated.
 mountains(c);
 const gap=24,margin=59;
 const cols=Math.max(1,imgs.length);
 const w=(W-margin*2-gap*(cols-1))/cols;
 imgs.forEach((img,i)=>framedImage(c,img,{
  x:margin+i*(w+gap),y:88,w,h:897,
  angle:((i%3)-1)*.005,
 },i+101));
}
function galleryGames(c:CanvasRenderingContext2D,imgs:readonly HTMLImageElement[]){
 mountains(c);
 const gap=35,margin=58;
 const width=(W-2*margin-gap*(imgs.length-1))/Math.max(1,imgs.length);
 imgs.forEach((image,i)=>{
  const x=margin+i*(width+gap),y=90,h=890;
  c.save();c.translate(x+width/2,y+h/2);
  c.rotate((i-1)*.006);c.translate(-width/2,-h/2);
  c.shadowColor="#081e25";c.shadowBlur=25;c.shadowOffsetY=13;
  c.fillStyle="#182930";roundRect(c,-13,-13,width+26,h+26,8);c.fill();
  c.shadowColor="transparent";
  c.strokeStyle=["#e4c9a8","#9be6df","#f5b8f3"][i%3];c.lineWidth=8;
  c.strokeRect(0,0,width,h);
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const scale=Math.min((width-24)/iw,(h-24)/ih);
  const w=iw*scale,drawH=ih*scale;
  c.drawImage(image,(width-w)/2,(h-drawH)/2,w,drawH);
  c.restore();
 });
}
/** Runs once per cave mount; each input is an existing local site asset.
 * Cache is only one GPU texture per complete gallery, not 28 extra meshes.
 * The caller owns texture disposal and suppresses stale async completion.
 */
export async function composeArcadeGallery(
 kind:GalleryKind,three:GalleryThree,
):Promise<{texture:THREE.Texture;photoCount:number}>{
 const sources=kind==="shasta-gallery"?CAVERN_PHOTO_ALBUMS.shasta.images:
  kind==="nature-gallery"?CAVERN_PHOTO_ALBUMS.nature.images:
  kind==="feature-gallery"?CAVERN_PHOTO_ALBUMS.feature.images:
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
 else if(kind==="feature-gallery")galleryFeature(ctx,images);
 else galleryGames(ctx,images);
 fadeEdges(ctx);
 const texture=new three.CanvasTexture(canvas);
 texture.colorSpace=three.SRGBColorSpace;
 texture.generateMipmaps=true;texture.minFilter=three.LinearMipmapLinearFilter;
 texture.anisotropy=4;
 return {texture,photoCount:images.length};
}

/** Three individual, in-world interaction backdrops. Their visible paint is
 * mounted on the existing curved walls, never on the invisible click volumes.
 * Preserves artwork proportions and puts game identity at the point of play.
 */
export async function composeArcadeGamePlaques(
 three:GalleryThree,
):Promise<readonly THREE.Texture[]>{
 // Physical niche order follows worldRenderer's gameTitles:
 // left Stretchicorn, rear uniRico, right Unicorn Stampede.
 // The separate wall gallery uses promotional ordering instead.
 const gameOrder=CAVERN_GAME_PANEL_ART;
 const images=await Promise.all(gameOrder.map(item=>
  new Promise<HTMLImageElement>((resolve,reject)=>{
   const image=new Image();image.decoding="async";
   image.onload=()=>resolve(image);
   image.onerror=()=>reject(new Error("Missing game artwork "+item.src));
   image.src=item.src;
  })));
 return images.map((image,index)=>{
  const canvas=document.createElement("canvas");
  canvas.width=840;canvas.height=680;
  const c=canvas.getContext("2d");
  if(!c)throw Error("Game plaque paint context missing");
  const ww=canvas.width,hh=canvas.height;
  // Keep the canvas transparent outside the game-specific carved frame.
  c.shadowColor="#04181e";c.shadowBlur=34;c.shadowOffsetY=13;
  c.fillStyle="#172d33";roundRect(c,26,28,ww-52,hh-55,17);c.fill();
  c.shadowColor="transparent";
  c.strokeStyle=["#ffdf9e","#99e8f4","#f1abec"][index];
  c.lineWidth=10;roundRect(c,34,34,ww-68,hh-74,12);c.stroke();
  const x=60,y=65,w=ww-120,h=hh-130;
  c.save();roundRect(c,x,y,w,h,6);c.clip();
  c.fillStyle="#13242d";c.fillRect(x,y,w,h);
  // Letterboxing is intentional. Cropping original game lettering is worse
  // than a dark matte around a logo.
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const scale=Math.min(w/iw,h/ih);
  const drawW=iw*scale,drawH=ih*scale;
  c.drawImage(image,x+(w-drawW)/2,y+(h-drawH)/2,drawW,drawH);
  c.restore();
  // Fade only the last few outer pixels, not the actual cover image.
  c.save();c.globalCompositeOperation="destination-in";
  const grad=c.createLinearGradient(0,0,ww,0);
  grad.addColorStop(0,"#0000");grad.addColorStop(.02,"#fff");
  grad.addColorStop(.98,"#fff");grad.addColorStop(1,"#0000");
  c.fillStyle=grad;c.fillRect(0,0,ww,hh);c.restore();
  const texture=new three.CanvasTexture(canvas);
  texture.colorSpace=three.SRGBColorSpace;
  texture.generateMipmaps=true;texture.minFilter=three.LinearMipmapLinearFilter;
  texture.anisotropy=4;
  return texture;
 });
}
