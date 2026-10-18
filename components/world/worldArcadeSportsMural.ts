import type * as THREE from "three/src/Three.Core.js";

/**
 * Curated art direction for the stadium wall. All THREE team marks are actual
 * self-hosted crest/helmet/basketball PNGs, never approximations drawn with
 * triangle/line primitives. Canvas draws *the environment around* the marks:
 * broad pigment fields, thick underpainting, readable typography and a few
 * carefully located scuffs. Nothing moves, fetches externally or raycasts.
 */
export const SPORTS_MARKS = [
 {id:"chelsea",src:"/world/arcade-cavern/sports/chelsea-crest.png"},
 {id:"patriots",src:"/world/arcade-cavern/sports/patriots-crest.png"},
 {id:"warriors",src:"/world/arcade-cavern/sports/warriors-crest.png"},
] as const;

type TextureThree=Pick<typeof import("three/src/Three.Core.js"),
 "CanvasTexture"|"SRGBColorSpace"|"LinearMipmapLinearFilter">;

type ArtAnchor={x:number;y:number;radius:number;scale:number;paint:string;rim:string};
const ANCHORS:ArtAnchor[]=[
 {x:343,y:570,radius:250,scale:425,paint:"#1749ac",rim:"#7bb9f1"},
 {x:1032,y:565,radius:282,scale:485,paint:"#243f60",rim:"#fb99a6"},
 {x:1693,y:575,radius:251,scale:430,paint:"#103c92",rim:"#ffcf71"},
];
const W=2048,H=1120;

function f(c:CanvasRenderingContext2D,points:readonly [number,number][],fill:string){
 c.fillStyle=fill;c.beginPath();c.moveTo(points[0][0],points[0][1]);
 for(const [x,y] of points.slice(1))c.lineTo(x,y);
 c.closePath();c.fill();
}
function paintGround(c:CanvasRenderingContext2D,a:ArtAnchor,index:number){
 c.save();
 c.translate(a.x,a.y);
 const g=c.createRadialGradient(0,0,90,0,0,a.radius*1.33);
 g.addColorStop(0,a.paint+"ee");
 g.addColorStop(.55,a.paint+"b8");
 g.addColorStop(.87,a.paint+"33");
 g.addColorStop(1,a.paint+"00");
 c.fillStyle=g;c.fillRect(-360,-355,720,710);
 // A chunky swept spray stroke rather than a mess of 1px arcs.
 c.save();c.rotate(index===1?-.18:.13);
 c.beginPath();
 c.ellipse(0,0,a.radius*1.05,a.radius*.94,0,-2.67,1.6);
 c.strokeStyle=a.rim;c.lineWidth=28;c.globalAlpha=.64;c.stroke();
 c.beginPath();
 c.ellipse(0,0,a.radius*1.12,a.radius*1.02,0,1.92,3.5);
 c.strokeStyle="#f0e3c9";c.lineWidth=11;c.globalAlpha=.32;c.stroke();
 c.restore();
 // Three stylized spray strike-lines intentionally placed BEHIND marks.
 const sweep=index%2===0?1:-1;
 c.strokeStyle=a.rim;c.lineWidth=16;c.lineCap="round";c.globalAlpha=.43;
 for(let i=0;i<3;i++){
  c.beginPath();
  c.moveTo(-a.radius*.9,(i-1)*67);
  c.lineTo(-a.radius*.6*sweep,(i-1)*67-41);
  c.stroke();
 }
 c.restore();
}
function solidTitle(
 c:CanvasRenderingContext2D,value:string,
 x:number,y:number,size:number,maxWidth:number,fill:string,
):void{
 c.save();c.translate(x,y);c.font="900 "+size+"px Impact, 'Arial Black',sans-serif";
 c.textBaseline="middle";c.textAlign="center";c.lineJoin="round";
 const measured=c.measureText(value).width;
 c.scale(Math.min(1,maxWidth/Math.max(measured,1)),1);
 c.lineWidth=size*.18;c.strokeStyle="#081923";c.strokeText(value,0,0);
 c.lineWidth=size*.055;c.strokeStyle="#d2d4c9";c.strokeText(value,0,0);
 c.fillStyle=fill;c.fillText(value,0,0);c.restore();
}
function crest(
 c:CanvasRenderingContext2D,image:CanvasImageSource,
 a:ArtAnchor,id:string,
):void{
 // Preserve original proportions and transparent alpha, including the
 // Patriots' wide Flying Elvis. Never squash an authentic logo to a circle.
 const w=id==="patriots"?a.scale*1.18:a.scale;
 const h=id==="patriots"?a.scale*.92:a.scale;
 const x=a.x-w/2,y=a.y-h/2;
 c.save();
 c.shadowColor="rgba(3,8,17,.8)";c.shadowBlur=28;
 c.shadowOffsetY=15;
 c.drawImage(image,x,y,w,h);
 c.restore();
}
function distressBackdrop(c:CanvasRenderingContext2D){
 // Scuff only the low-opacity backing pigments, BEFORE logos/text are drawn.
 // This preserves crisp, true proportions of the official team marks.
 let seed=0x8edb7143;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 c.save();c.globalCompositeOperation="destination-out";
 for(let i=0;i<460;i++){
  const x=rnd()*W,y=195+rnd()*675,r=.7+rnd()*3.5;
  c.globalAlpha=.10+rnd()*.34;
  c.beginPath();c.ellipse(x,y,r,r*(.2+rnd()*.6),rnd()*Math.PI,0,Math.PI*2);
  c.fillStyle="#000";c.fill();
 }
 c.restore();
}
function pigmentMask(c:CanvasRenderingContext2D){
 // Fade to absolute zero-alpha at canvas edges, so graphics blend with
 // rock instead of forming a visible rectangle.
 c.save();c.globalCompositeOperation="destination-in";
 const horizontal=c.createLinearGradient(0,0,W,0);
 horizontal.addColorStop(0,"rgba(255,255,255,0)");
 horizontal.addColorStop(.038,"#fff");
 horizontal.addColorStop(.963,"#fff");
 horizontal.addColorStop(1,"rgba(255,255,255,0)");
 c.fillStyle=horizontal;c.fillRect(0,0,W,H);
 const vertical=c.createLinearGradient(0,0,0,H);
 vertical.addColorStop(0,"rgba(255,255,255,0)");
 vertical.addColorStop(.09,"#fff");
 vertical.addColorStop(.92,"#fff");
 vertical.addColorStop(1,"rgba(255,255,255,0)");
 c.fillStyle=vertical;c.fillRect(0,0,W,H);
 c.restore();
}
export function createSportsFanMural(
 images:ReadonlyArray<CanvasImageSource>,
 three:TextureThree,
):THREE.Texture{
 if(images.length!==3)throw Error("Sports mural requires the three approved crest textures");
 const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
 const c=canvas.getContext("2d");
 if(!c)throw Error("Sports atlas 2D compositor unavailable");
 ANCHORS.forEach((anchor,i)=>paintGround(c,anchor,i));
 c.save();c.globalAlpha=.35;
 f(c,[[74,793],[282,746],[449,825],[683,780],[1014,864],[1365,766],
  [1639,842],[1992,776],[2001,892],[63,914]],"#eacb9e");
 c.restore();
 distressBackdrop(c);
 ANCHORS.forEach((a,i)=>crest(c,images[i],a,SPORTS_MARKS[i].id));
 solidTitle(c,"THE HOME STAND",W/2,175,142,1610,"#f4e9c8");
 for(let i=0;i<3;i++){
  solidTitle(c,["CHELSEA","PATRIOTS","WARRIORS"][i],
   ANCHORS[i].x,949,93,560,["#c1e0ff","#ffbfbd","#ffe3a4"][i]);
 }
 pigmentMask(c);
 const tex=new three.CanvasTexture(canvas);
 tex.colorSpace=three.SRGBColorSpace;
 tex.anisotropy=4;
 tex.generateMipmaps=true;
 tex.minFilter=three.LinearMipmapLinearFilter;
 return tex;
}
