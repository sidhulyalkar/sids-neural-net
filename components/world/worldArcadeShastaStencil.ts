import type * as THREE from "three/src/Three.Core.js";

/** The original photo is from the site's own visual archive. This render
 * preserves Shasta's real face and coat while transforming the rectangular
 * photo into a porous, transparent spray-paint mural. No new HTTP host. */
export function createShastaPhotoStencil(
 image:HTMLImageElement,
 three:Pick<typeof import("three/src/Three.Core.js"),"CanvasTexture"|"SRGBColorSpace">,
):THREE.Texture{
 const canvas=document.createElement("canvas");
 canvas.width=1024;canvas.height=640;
 const c=canvas.getContext("2d");
 if(!c)throw Error("Shasta paint canvas unavailable");
 const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
 // photo-037 is 1800x2400: Shasta's face occupies the right-middle
 // with his full seated posture below. Crop deliberately, never stretch
 // the whole portrait into a banner-sized wall rectangle.
 const sx=w*.38,sy=h*.27,sw=w*.54,sh=h*.68;
 const photo=document.createElement("canvas");
 photo.width=500;photo.height=594;
 const p=photo.getContext("2d");
 if(!p)throw Error("Shasta portrait compositor unavailable");
 p.filter="contrast(1.13) saturate(.90) brightness(1.05)";
 p.drawImage(image,sx,sy,sw,sh,0,0,photo.width,photo.height);
 // Apply a precise elliptical pigment bleed. The outermost image pixels
 // are transparent and leave actual 3D rock exposed behind the mural.
 p.globalCompositeOperation="destination-in";
 const fade=p.createRadialGradient(250,274,132,250,274,303);
 fade.addColorStop(0,"rgba(255,255,255,1)");
 fade.addColorStop(.72,"rgba(255,255,255,.99)");
 fade.addColorStop(.88,"rgba(255,255,255,.76)");
 fade.addColorStop(.97,"rgba(255,255,255,.21)");
 fade.addColorStop(1,"rgba(255,255,255,0)");
 p.fillStyle=fade;p.fillRect(0,0,photo.width,photo.height);
 // A muted mountainscape connects the large photograph to the rest of
 // the cave without pretending that an illustrated wolf resembles Shasta.
 const mountain=(points:readonly number[][],color:string,opacity:number)=>{
  c.save();c.globalAlpha=opacity;c.fillStyle=color;c.beginPath();
  c.moveTo(points[0][0],points[0][1]);
  for(const [x,y] of points.slice(1))c.lineTo(x,y);
  c.closePath();c.fill();c.restore();
 };
 mountain([[0,504],[138,370],[215,420],[327,275],[459,453],
  [515,398],[691,501],[824,401],[1024,525],[1024,640],[0,640]],
 "#2d5e5b",.58);
 mountain([[0,580],[115,465],[221,548],[337,403],[451,530],
  [554,463],[727,590],[865,474],[1024,570],[1024,640],[0,640]],
 "#102f3c",.83);
 mountain([[297,346],[337,403],[363,371],[340,381],[331,355],
  [316,369]],"#d1d8cc",.76);
 c.drawImage(photo,446,34,507,584);
 // True alpha in irregular small holes makes the photo read as worn
 // pigment. The holes are deliberate and stay away from Shasta's face.
 let seed=0x5a57a121;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;
  return(seed>>>0)/4294967296;};
 c.save();c.globalCompositeOperation="destination-out";
 for(let i=0;i<390;i++){
  const x=420+rnd()*565,y=40+rnd()*545;
  if(x>594&&x<869&&y<303)continue;
  const size=.5+rnd()*1.85;
  c.fillStyle="rgba(0,0,0,"+(.09+rnd()*.40)+")";
  c.beginPath();c.ellipse(x,y,size,size*(.4+rnd()*.7),
   rnd()*Math.PI,0,Math.PI*2);c.fill();
 }
 c.restore();
 // Authored block-title: one readable typographic beat rather than
 // a random collection of slogans and overlapping marker strokes.
 c.save();c.font="900 112px Impact, 'Arial Black',sans-serif";
 c.textBaseline="middle";c.lineJoin="round";
 c.lineWidth=21;c.strokeStyle="#0a2830";c.strokeText("SHASTA",67,204);
 c.lineWidth=6;c.strokeStyle="#dfeeda";c.strokeText("SHASTA",67,204);
 c.fillStyle="#f3cfa1";c.fillText("SHASTA",67,204);
 c.font="700 41px 'Arial Black',sans-serif";
 c.lineWidth=8;c.strokeStyle="#102e37";
 c.strokeText("TRAIL COMPANION",76,257);
 c.fillStyle="#c6f0d9";c.fillText("TRAIL COMPANION",76,257);
 c.restore();
 c.strokeStyle="#9cded5";c.lineWidth=10;c.lineCap="round";
 c.beginPath();c.moveTo(81,320);c.lineTo(211,302);c.lineTo(333,330);c.stroke();
 const tex=new three.CanvasTexture(canvas);
 tex.colorSpace=three.SRGBColorSpace;
 tex.anisotropy=4;
 tex.generateMipmaps=true;
 return tex;
}
