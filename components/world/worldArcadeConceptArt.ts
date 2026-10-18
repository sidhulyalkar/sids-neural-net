import type {CavernArtTheme} from "@/lib/world/arcadeCavernSurface";

/** Source-authored ink details. All images are drawn once into a local
 * CanvasTexture; no remote show art, fonts, or HTTP requests at runtime.
 * Each mark is a real alpha-channeled pigment shape, not a wall rectangle. */
type C=CanvasRenderingContext2D;
type P=readonly [number,number];
const PI=Math.PI,TAU=2*PI;
function random(seed:string){
 let v=2166136261;
 for(let i=0;i<seed.length;i++){v^=seed.charCodeAt(i);v=Math.imul(v,16777619);}
 return ()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return (v>>>0)/4294967296;};
}
function path(c:C,pts:readonly P[],color:string,alpha=1){
 if(!pts.length)return;
 c.save();c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();
 c.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)c.lineTo(...pts[i]);
 c.closePath();c.fill();c.restore();
}
function line(c:C,pts:readonly P[],color:string,w:number,alpha=1){
 if(pts.length<2)return;
 c.save();c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=w;
 c.lineCap="round";c.lineJoin="round";c.beginPath();c.moveTo(...pts[0]);
 for(let i=1;i<pts.length;i++)c.lineTo(...pts[i]);c.stroke();c.restore();
}
function circle(c:C,x:number,y:number,r:number,fill:string){
 c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=fill;c.fill();
}
function lettering(c:C,label:string,x:number,y:number,size:number,color:string,angle=0,maxWidth=800){
 c.save();c.translate(x,y);c.rotate(angle);
 c.font="900 "+size+"px Impact, 'Arial Black', sans-serif";
 c.textBaseline="middle";c.lineJoin="round";
 const raw=c.measureText(label).width;
 c.scale(Math.min(1,maxWidth/Math.max(1,raw)),1);
 c.strokeStyle="#10151b";c.lineWidth=size*.20;c.strokeText(label,0,0);
 c.strokeStyle="#eee3d0";c.lineWidth=size*.055;c.strokeText(label,0,0);
 c.fillStyle=color;c.fillText(label,0,0);c.restore();
}
function mountainRange(c:C,base=420){
 path(c,[[10,base],[110,base-99],[175,base-28],[250,base-165],
  [324,base-66],[406,base-195],[474,base-77],[570,base-114],
  [635,base-14],[745,base-142],[840,base-70],[1013,base]],"#182e35",.98);
 path(c,[[192,base-91],[250,base-165],[303,base-85],[273,base-101],
  [251,base-123],[233,base-101]],"#d2e3dd",.95);
 path(c,[[347,base-137],[406,base-195],[455,base-100],[423,base-125],
  [406,base-151],[387,base-125]],"#d2d7d5",.95);
 for(let i=0;i<27;i++){
  const x=24+i*38,y=base+11+(i%3)*16,h=45+(i%4)*27;
  path(c,[[x-16,y],[x,y-h],[x+17,y]],i%3===0?"#28544e":"#173e3d",.86);
 }
}
function husky(c:C){
 // Three-quarter husky portrait: ears, reverse mask, muzzle and chest;
 // deliberately hand-cut and high contrast so it reads across the chamber.
 path(c,[[333,469],[330,253],[353,115],[439,214],[521,160],
   [620,102],[667,254],[677,459],[596,533],[398,531]],"#101b22");
 path(c,[[358,245],[361,147],[430,229],[418,316]],"#d8c8b6");
 path(c,[[564,267],[621,145],[634,271],[612,336]],"#dccfbd");
 path(c,[[383,313],[434,248],[510,286],[576,238],[625,312],
  [604,418],[557,491],[457,505],[387,436]],"#e2ded0");
 path(c,[[380,314],[413,260],[451,289],[474,361],[456,399],
  [400,394]],"#1d3039");
 path(c,[[622,305],[590,253],[554,283],[537,360],[564,407],
  [614,394]],"#203442");
 path(c,[[457,362],[482,336],[507,355],[531,338],[551,364],
  [567,413],[538,455],[468,449],[437,411]],"#f3e8cf");
 path(c,[[478,390],[504,383],[532,390],[514,408],[493,408]],"#111b22");
 line(c,[[504,410],[503,429],[485,436]],"#53626a",4);
 line(c,[[503,429],[524,435]],"#53626a",4);
 path(c,[[403,360],[439,353],[450,360],[434,368]],"#b0d9da");
 path(c,[[560,359],[586,352],[601,358],[570,369]],"#b0d9da");
 circle(c,431,360,6,"#121923");circle(c,577,358,6,"#121923");
 path(c,[[357,451],[408,463],[447,497],[469,540],[423,575],
  [352,558],[314,513]],"#101b22");
 path(c,[[577,487],[629,446],[694,480],[691,529],[632,577],
  [566,561],[532,516]],"#101b22");
 path(c,[[434,462],[487,488],[527,473],[573,466],[546,555],
   [510,596],[457,566]],"#e5dfcc");
}
function paintShasta(c:C){
 const rng=random("shasta-story");
 const g=c.createRadialGradient(505,330,24,505,330,340);
 g.addColorStop(0,"rgba(23,122,127,.31)");
 g.addColorStop(1,"rgba(3,21,25,0)");
 c.fillStyle=g;c.fillRect(120,0,810,640);
 mountainRange(c,504);husky(c);
 for(let i=0;i<32;i++){
  const x=rng()*1024,y=250+rng()*355;
  line(c,[[x,y],[x+9+rng()*23,y-3-rng()*18]],
   i%3===0?"#ffca83":"#78d5d4",2+rng()*3,.55);
 }
 lettering(c,"SHASTA",640,544,79,"#ffe2b7",-.03,355);
 lettering(c,"TRAIL COMPANION",36,96,53,"#9bdcd2",-.025,510);
 for(let i=0;i<4;i++){
  const x=755+i*43,y=442+(i%2)*12;
  circle(c,x,y,11,"#f0d6a0");circle(c,x-9,y-19,5,"#f0d6a0");
  circle(c,x+9,y-19,5,"#f0d6a0");
 }
}
function paintNeural(c:C){
 const rng=random("neural-network");
 const g=c.createRadialGradient(465,335,5,465,335,310);
 g.addColorStop(0,"#7831bf77");g.addColorStop(.65,"#135bb34a");
 g.addColorStop(1,"transparent");c.fillStyle=g;c.fillRect(125,40,700,575);
 // Brain-like bilateral contours and traversing folds, plus distributed
 // synapse graph derived from spatial curves, not an image billboard.
 c.save();c.lineCap="round";c.lineJoin="round";
 for(let side of [-1,1]){
  c.save();c.translate(465,289);c.scale(side,1);
  c.beginPath();c.moveTo(0,-153);c.bezierCurveTo(65,-184,95,-135,114,-105);
  c.bezierCurveTo(197,-89,184,-1,146,27);
  c.bezierCurveTo(177,102,97,132,63,109);
  c.bezierCurveTo(23,152,7,101,0,94);
  c.strokeStyle=side===1?"#7fe4ed":"#cf8dff";c.lineWidth=12;
  c.shadowColor=c.strokeStyle;c.shadowBlur=19;c.stroke();
  for(let i=0;i<6;i++){
   const y=-112+i*39;
   c.beginPath();c.moveTo(10,y);c.bezierCurveTo(30+i*6,y-48,
     89+i*6,y+20,116,y+10);
   c.strokeStyle=i%2?"#9ceded":"#c49bf0";
   c.lineWidth=4;c.shadowBlur=8;c.stroke();
  }
  c.restore();
 }
 c.restore();
 const nodes:P[]=[
 [160,465],[250,395],[300,519],[390,441],[456,531],[536,427],
 [628,492],[709,406],[818,480],[870,349],[725,258],[610,305],
 [313,272],[187,299],[920,546],[101,534],
 ];
 const edges=[ [0,1],[0,15],[1,2],[1,3],[2,4],[3,4],[3,5],
 [4,5],[4,6],[5,6],[5,11],[6,7],[6,8],[7,8],[7,9],[9,10],
 [10,11],[11,12],[12,13],[8,14] ];
 edges.forEach(([a,b],i)=>line(c,[nodes[a],nodes[b]],
  i%3===0?"#ce9aff":"#55d5e4",3,.82));
 nodes.forEach(([x,y],i)=>{
  circle(c,x,y,i%4===0?11:6,i%3===0?"#e3b4ff":"#c3fff3");
  circle(c,x,y,2.8,"#fff8dc");
 });
 for(let i=0;i<27;i++){
  const x=rng()*1024,y=rng()*640;
  line(c,[[x,y],[x+5+rng()*18,y],[x+5+rng()*18,y-8]],
   "#7ee9d6",1.3,.28);
 }
 lettering(c,"MIND FORGE",590,96,70,"#9ce9e9",.05,398);
 lettering(c,"NEUROSCIENCE",40,82,55,"#e1b5ff",-.025,510);
 lettering(c,"BUILD  //  PLAY",80,577,49,"#f5d09b",.035,530);
}
function astronautSticker(c:C,x:number,y:number,size:number,color:string){
 c.save();c.translate(x,y);c.scale(size/100,size/100);
 c.strokeStyle="#101d20";c.lineWidth=11;c.fillStyle=color;
 c.beginPath();c.moveTo(-43,-29);c.quadraticCurveTo(-42,-75,0,-76);
 c.quadraticCurveTo(45,-75,43,-29);c.lineTo(45,34);
 c.quadraticCurveTo(0,78,-43,34);c.closePath();c.stroke();c.fill();
 path(c,[[-30,-15],[31,-15],[28,19],[-28,19]],"#19343c");
 circle(c,-14,-1,7,"#ffe2ab");circle(c,15,-1,7,"#ffe2ab");
 c.restore();
}
function comicExtra(c:C){
 // Sticker silhouettes in the margins of the original portal/city mural.
 astronautSticker(c,815,363,105,"#afc7b6");
 for(let i=0;i<4;i++){
  const x=106+i*86,y=461+(i%2)*7,col=["#d04d49","#85ba4e","#d5a34d","#f0a85a"][i];
  circle(c,x,y,35,"#edcfb7");path(c,[[x-35,y-8],
   [x-30,y-43],[x+29,y-43],[x+36,y-8]],col);
  circle(c,x-13,y+3,3,"#1e252a");circle(c,x+13,y+3,3,"#1e252a");
  line(c,[[x-11,y+22],[x+12,y+22]],"#3d2926",2.5);
 }
}
function sportsExtra(c:C){
 // Emblem-shaped paint, no exact club crest or licensed badge asset.
 for(let i=0;i<3;i++){
  const x=120+i*365,y=410;
  path(c,[[x-65,y-55],[x+65,y-55],[x+55,y+56],
   [x,y+99],[x-55,y+56]],"#0f1d2b",.56);
  line(c,[[x-65,y-55],[x+65,y-55],[x+55,y+56],
   [x,y+99],[x-55,y+56],[x-65,y-55]],
   ["#b1d0f9","#f1d2cf","#ffdb8f"][i],6,.8);
 }
}
function animeExtra(c:C){
 for(let i=0;i<6;i++){
  const x=85+i*165, y=365+(i%3)*24;
  line(c,[[x-33,y+54],[x+7,y-46],[x+40,y+38]],
   i%2?"#c6a0ff":"#a2e5df",3,.9);
  line(c,[[x-32,y-14],[x+39,y+8]],"#f1c49c",2,.7);
 }
}
function sportAnimeExtra(c:C){
 for(let i=0;i<5;i++){
  const x=80+i*190,y=422+(i%2)*25;
  circle(c,x,y,5,"#fff7d8");circle(c,x+20,y-32,4,"#fff7d8");
  line(c,[[x-20,y+15],[x+55,y-54]],"#e7f5e9",2,.6);
 }
}
function identityExtra(c:C){
 // A hand-cut mountain/gamepad identity woven into the hero wordmark.
 line(c,[[122,270],[203,221],[246,248],[306,193],[373,255],[453,212]],
  "#efd3a7",7,.75);
 for(let i=0;i<8;i++){
  const x=705+i*35,y=262+(i%2)*6;
  circle(c,x,y,5,i%3===0?"#e6b2f2":"#86dbe0");
  if(i)line(c,[[x-35,y],[x,y]],"#82d6df",2,.75);
 }
}
function icon(c:C,kind:number,x:number,y:number,s:number,color:string){
 c.save();c.translate(x,y);c.rotate(Math.sin(x+y)*.19);
 c.strokeStyle=color;c.fillStyle=color;c.lineWidth=3;c.lineJoin="round";
 if(kind===0){ // spray-star
  c.beginPath();
  for(let j=0;j<10;j++){const a=j*PI/5-PI/2,r=(j%2?s*.37:s);
   if(j)c.lineTo(Math.cos(a)*r,Math.sin(a)*r);
   else c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
  c.closePath();c.stroke();
 }else if(kind===1){ // controller
  c.beginPath();c.ellipse(0,0,s,s*.55,0,0,TAU);c.stroke();
  line(c,[[-s*.55,0],[-s*.13,0]],color,3);
  line(c,[[-s*.34,-s*.2],[-s*.34,s*.2]],color,3);
  circle(c,s*.40,-s*.1,s*.1,color);circle(c,s*.56,s*.14,s*.08,color);
 }else if(kind===2){ // crooked crown
  line(c,[[-s,-s*.4],[-s*.55,s*.5],[0,-s*.5],
   [s*.6,s*.5],[s,-s*.4],[s*.83,s*.9],[-s*.83,s*.9]],color,3);
 }else{ // runic level-up arrow
  line(c,[[0,s],[0,-s],[-s*.45,-s*.45],[0,-s],[s*.45,-s*.45]],color,3);
 }
 c.restore();
}
/** An authored 2-D layering stage, kept within the same conforming wall mesh.
 * Drawing over the old compositions avoids multiplying transparent decals and
 * reduces overdraw and draw calls. */
export function paintConceptStory(c:C,theme:CavernArtTheme){
 if(theme==="shasta")paintShasta(c);
 if(theme==="neural")paintNeural(c);
 if(theme==="sports")sportsExtra(c);
 if(theme==="anime")animeExtra(c);
 if(theme==="comedy")comicExtra(c);
 if(theme==="sport-anime")sportAnimeExtra(c);
 if(theme==="identity")identityExtra(c);
 const rng=random("microtags:"+theme);
 const w=c.canvas.width,h=c.canvas.height;
 const accents=theme==="shasta"?["#d6f2df","#f0bc7a","#5bccc3"]:
  theme==="neural"?["#71efec","#d5a2ff","#e2e8d8"]:
  theme==="anime"?["#d6a2ee","#6fdaca","#ffb778"]:
  theme==="comedy"?["#a3e986","#adcaee","#edd0a3"]:
  ["#f1cb88","#7dcad7","#d6a6d7"];
 // 15-18 stickers in the peripheral paint; no repeating grid, no scene nodes.
 for(let i=0;i<18;i++){
  const x=30+rng()*(w-60),y=17+rng()*(h-34);
  if(theme==="identity"&&y>h*.47&&x>w*.29&&x<w*.84)continue;
  if(theme==="shasta"&&x>310&&x<700&&y>h*.18)continue;
  if(theme==="neural"&&x>250&&x<670&&y>h*.21&&y<h*.7)continue;
  if(rng()<.16)continue;
  c.save();c.globalAlpha=.33+.38*rng();
  icon(c,i%4,x,y,8+rng()*11,accents[i%3]);
  c.restore();
 }
}
/** Remove hundreds of pigment-sized pores and knife-edge scuffs, *only*
 * where marks were painted. Preserves true transparent rock between strokes.
 * Deterministic for identical theme and resolution, no runtime animation. */
export function distressPigment(c:C,theme:CavernArtTheme){
 const rng=random("weathered-pigment:"+theme);
 c.save();c.globalCompositeOperation="destination-out";
 for(let i=0;i<1000;i++){
  const x=rng()*c.canvas.width,y=rng()*c.canvas.height;
  const r=.5+rng()*1.65;
  c.fillStyle="rgba(0,0,0,"+(.06+rng()*.26)+")";
  c.beginPath();c.ellipse(x,y,r,r*(.4+rng()*.8),
   rng()*TAU,0,TAU);c.fill();
 }
 for(let i=0;i<45;i++){
  const x=rng()*c.canvas.width,y=rng()*c.canvas.height;
  line(c,[[x,y],[x+7+rng()*33,y-4-rng()*17]],
   "rgba(0,0,0,"+(.1+rng()*.25)+")",.4+rng()*.9);
 }
 c.restore();
}
