import type * as THREE from "three/src/Three.Core.js";
import {
 SHASTA_PHOTOS,NATURE_PHOTOS,CAVERN_GAME_ART,CAVERN_GAME_PANEL_ART,archivePhotoPath,
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
 if(imgs.length!==12)throw Error("Nature gallery must use the twelve curated images");
 mountains(c);
 natureInk(c);
 // The four unframed travel exposures become wide, feathered pigment.
 // Eight additional images remain framed and independently readable.
 for(const [i,area] of [
  [1,{x:60,y:268,w:670,h:500,opacity:.22}],
  [4,{x:578,y:292,w:705,h:465,opacity:.28}],
  [5,{x:1090,y:272,w:690,h:510,opacity:.24}],
  [10,{x:1640,y:280,w:720,h:500,opacity:.24}],
 ] as const){
  photoWash(c,imgs[i],area.x,area.y,area.w,area.h,area.opacity);
 }
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
  const x=60,y=68,w=ww-120,h=hh-206;
  c.save();roundRect(c,x,y,w,h,6);c.clip();
  c.fillStyle="#13242d";c.fillRect(x,y,w,h);
  // Letterboxing is intentional. Cropping original game lettering is worse
  // than a dark matte around a logo.
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const scale=Math.min(w/iw,h/ih);
  const drawW=iw*scale,drawH=ih*scale;
  c.drawImage(image,x+(w-drawW)/2,y+(h-drawH)/2,drawW,drawH);
  c.restore();
  paintWord(c,gameOrder[index].label,ww/2,hh-85,65,ww-128,
   ["#ffe2ac","#b8f7fc","#f4c1eb"][index]);
  c.fillStyle="#afd6ce";c.font="700 22px system-ui,sans-serif";
  c.textAlign="center";c.fillText("ENTER TO PLAY",ww/2,hh-37);
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
