import {visualArchive} from "@/src/data/visualArchive";

/** A single atlas per wall keeps the photo collection to one draw call.
 * Decode independently: one missing asset must not blank the entire gallery. */
export async function paintCavernPhotoGallery(
 canvas:HTMLCanvasElement,theme:"shasta"|"nature",active:()=>boolean,variant="",
){
 const ctx=canvas.getContext("2d");
 if(!ctx)return;
 const selected=visualArchive.filter(p=>theme==="shasta"
  ?p.tags?.includes("dog")
  :p.tags?.some(t=>["mountains","ice","forest","water"].includes(t))
   &&!p.tags?.includes("dog"));
 const entries=theme==="shasta"?selected:selected.slice(variant==="wild-country"?7:0,variant==="wild-country"?14:7);
 const images=await Promise.all(entries.map(async entry=>{
  const image=new Image();image.src=entry.src;
  try{await image.decode();return image;}catch{return null;}
 }));
 if(!active())return;
 ctx.setTransform(canvas.width/1024,0,0,canvas.height/640,0,0);
 ctx.clearRect(0,0,1024,640);
 const backing=ctx.createLinearGradient(0,0,0,640);
 backing.addColorStop(0,"#4a3727");backing.addColorStop(1,"#152d28");
 ctx.fillStyle=backing;ctx.fillRect(12,12,1000,616);
 // Fine timber grain and mineral speckle remain visible between frames.
 for(let i=0;i<400;i++){
  ctx.fillStyle=i%3?"#a28b4930":"#d5bf8338";
  ctx.fillRect(16+(i*137)%990,16+(i*71)%610,2+(i%13),1);
 }
 ctx.textAlign="center";ctx.fillStyle="#ffe7b4";
 ctx.font="900 54px Georgia, serif";
 ctx.fillText(theme==="shasta"?"SHASTA":"WILD COUNTRY",512,77);
 ctx.font="600 18px sans-serif";
 ctx.fillText(theme==="shasta"?"TRAIL COMPANION":"LAKES · GLACIERS · MOUNTAINS",512,107);
 const frames:number[][]=theme==="shasta"?[[322,142,380,438],
  ...Array.from({length:entries.length-1},(_,i)=>{
   const side=i<6?0:1,k=i%6;
   return [37+side*700+(k%2)*132,143+Math.floor(k/2)*153,118,137];
  })]:[[322,142,380,438],[37,143,250,142],[37,306,250,142],
  [37,469,250,128],[737,143,250,142],[737,306,250,142],[737,469,250,128]];
 images.forEach((image,i)=>{
  const [x,y,w,h]=frames[i];
  ctx.shadowColor="#000b";ctx.shadowBlur=12;ctx.shadowOffsetY=5;
  ctx.fillStyle="#876445";ctx.fillRect(x-9,y-9,w+18,h+18);
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.fillStyle="#ead6ad";ctx.fillRect(x-4,y-4,w+8,h+8);
  ctx.fillStyle="#263d3b";ctx.fillRect(x,y,w,h);
  if(image){
   // Contain rather than crop: retain the real dog's face and landscape.
   const scale=Math.min(w/image.naturalWidth,h/image.naturalHeight);
   const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
   ctx.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
  }
 });
}
