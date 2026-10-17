import type * as THREE from "three/src/Three.Core.js";
/** Passing a full Three.Core namespace defeats Turbopack tree-shaking. Accept
 * only the constructors actually used to render the mural meshes. */
type ArcadeThree=Pick<typeof import("three/src/Three.Core.js"),
 "CanvasTexture"|"BufferGeometry"|"Float32BufferAttribute"|
 "MeshStandardMaterial"|"Color"|"DoubleSide"|"Mesh"|"Group"|
 "SRGBColorSpace"|"LinearMipmapLinearFilter">;
import {ARCADE_CAVERN_MURALS,validateArcadeArtManifest} from "@/lib/world/arcadeCavernArtManifest";
import {ARCADE_CAVE,arcadeCaveFloorHeight} from "@/lib/world/model";
import {sampleCavernArt,type CavernArtTheme,type CavernArtSurface,type CavernMural} from "@/lib/world/arcadeCavernSurface";

const TAU=Math.PI*2;
type Paint=CanvasRenderingContext2D;
function randomFor(id:string){
 let h=2166136261;
 for(const ch of id){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return (h>>>0)/4294967296;};
}
function stroke(ctx:Paint,points:readonly [number,number][],color:string,width:number,glow=0){
 if(points.length<2)return;
 ctx.save();ctx.beginPath();ctx.moveTo(...points[0]);
 for(let i=1;i<points.length-1;i++){
  const a=points[i],b=points[i+1];
  ctx.quadraticCurveTo(a[0],a[1],(a[0]+b[0])*.5,(a[1]+b[1])*.5);
 }
 ctx.lineTo(...points[points.length-1]);
 ctx.lineJoin="round";ctx.lineCap="round";ctx.strokeStyle=color;
 ctx.lineWidth=width;ctx.shadowColor=color;ctx.shadowBlur=glow;ctx.stroke();ctx.restore();
}
function polygon(ctx:Paint,points:readonly [number,number][],fill:string,alpha=1){
 ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=fill;ctx.beginPath();
 points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
 ctx.closePath();ctx.fill();ctx.restore();
}
function tag(ctx:Paint,text:string,x:number,y:number,size:number,
 color:string,angle=0,max=800){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.font="900 "+size+"px Impact, 'Arial Black', sans-serif";
 const w=ctx.measureText(text).width,scale=Math.min(1,max/Math.max(1,w));
 ctx.scale(scale,1);
 ctx.textBaseline="middle";ctx.lineJoin="round";
 ctx.lineWidth=size*.22;ctx.strokeStyle="#15222ad9";ctx.strokeText(text,0,0);
 ctx.lineWidth=size*.09;ctx.strokeStyle="#e8d3acaa";ctx.strokeText(text,0,0);
 ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=5;
 ctx.fillText(text,0,0);
 ctx.shadowBlur=0;
 // Slight hand-printed offset underlining.
 stroke(ctx,[[0,size*.60],[Math.min(w,max)*.80,size*.57],[Math.min(w,max)*.92,size*.63]],
  color,size*.035);
 ctx.restore();
}
function splash(ctx:Paint,x:number,y:number,color:string,r:number,rng:()=>number){
 ctx.save();ctx.fillStyle=color;
 for(let i=0;i<22;i++){
  const a=rng()*TAU,d=r*(.28+rng()*1.1),s=r*(.016+rng()*.09);
  ctx.globalAlpha=.22+.48*rng();ctx.beginPath();
  ctx.ellipse(x+Math.cos(a)*d,y+Math.sin(a)*d,s,s*(.65+rng()),a,0,TAU);ctx.fill();
 }
 ctx.globalAlpha=.58;
 ctx.beginPath();ctx.ellipse(x,y,r*.19,r*.12,-.2,0,TAU);ctx.fill();
 ctx.restore();
}
function ring(ctx:Paint,x:number,y:number,rx:number,ry:number,
 color:string,width=7,start=0,end=TAU){
 ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx,ry,-.13,start,end);
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.stroke();ctx.restore();
}
function basePaint(ctx:Paint,id:string,w:number,h:number,accent:string){
 const rng=randomFor(id);
 // No opaque rectangle; each mark is irregular and leaves plenty of raw rock.
 for(let i=0;i<7;i++){
  const x=w*(.08+.84*rng()),y=h*(.12+.72*rng());
  const r=60+150*rng();ctx.save();ctx.globalAlpha=.08+.07*rng();
  const g=ctx.createRadialGradient(x,y,r*.12,x,y,r);
  g.addColorStop(0,accent);g.addColorStop(1,"transparent");
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
 }
 for(let i=0;i<14;i++){
  const x=w*rng(),y=h*rng(),len=20+160*rng();
  stroke(ctx,[[x,y],[x+len*.55,y-(rng()-.5)*42],
   [x+len,y+(rng()-.5)*28]],accent,1+6*rng());
 }
 for(let i=0;i<15;i++){
  const x=w*rng(),y=h*rng();
  splash(ctx,x,y,i%4===0?"#ffbb77":accent,11+22*rng(),rng);
 }
 // Sprayed drip clusters: restrained and pushed to composition edges.
 for(let i=0;i<22;i++){
  const x=w*rng(),y=h*(.08+.52*rng()),length=8+58*rng();
  stroke(ctx,[[x,y],[x+2*rng(),y+length]],accent,1+3*rng());
 }
}
function paintSports(ctx:Paint){
 const rng=randomFor("home-stand");
 // Three interwoven horizontal bands rather than three framed posters.
 polygon(ctx,[[20,180],[395,94],[455,166],[320,480],[12,525]],"#1656c3",.66);
 polygon(ctx,[[305,210],[600,80],[738,156],[615,532],[366,495]],"#a52340",.65);
 polygon(ctx,[[610,145],[995,70],[1000,540],[742,490]],"#f3bc43",.51);
 for(let i=0;i<12;i++){
  const y=160+i*19;
  stroke(ctx,[[12,y+i*3],[250,y-34],[840,y+40],[1012,y-25]],
   i%3===0?"#f9d58e":i%2?"#f0f3ea":"#3984ff",2+i%4);
 }
 ring(ctx,178,307,100,115,"#99c8ff",11,-.6,4.0);
 polygon(ctx,[[141,366],[146,264],[166,237],[174,280],[192,249],
  [233,288],[209,351],[183,378]],"#eff4d8",.85); // original lion-like crest
 // Patriots speed stars across a diagonal path.
 for(let i=0;i<7;i++){
  const x=430+i*38,y=280-i*15;
  polygon(ctx,[[x,y-12],[x+6,y-3],[x+16,y],[x+6,y+6],
   [x+3,y+17],[x-4,y+6],[x-15,y+1],[x-4,y-4]],"#eaeff3",.86);
 }
 // Stylized Bay bridge sweep with golden deck stripes.
 for(let i=0;i<5;i++)stroke(ctx,[[720,395-i*26],[760,300-i*13],
  [823,285-i*4],[922,320-i*8]],"#ffd875",3);
 stroke(ctx,[[672,406],[772,363],[850,354],[990,390]],"#fff3c7",12);
 ring(ctx,846,340,71,74,"#ffd45f",6);
 ring(ctx,846,340,58,61,"#eff9f9",3,.2,2.6);
 tag(ctx,"HOME STAND",62,80,42,"#f5e8ca",-.045);
 tag(ctx,"CHELSEA",40,438,78,"#b7d9ff",-.065,400);
 tag(ctx,"PATRIOTS",365,520,69,"#f2e1e7",-.045,410);
 tag(ctx,"WARRIORS",647,105,66,"#ffda75",.05,365);
 for(let i=0;i<6;i++)splash(ctx,90+i*160,530-(i%3)*90,
  i%2?"#ffdb79":"#c1e2ef",14+15*rng(),rng);
}
function paintAnime(ctx:Paint){
 const rng=randomFor("raid-ascend");
 // Tall rift/level gateway, stepped vertical dungeon ascent.
 const gradient=ctx.createRadialGradient(540,310,32,540,310,310);
 gradient.addColorStop(0,"#78d8dc99");gradient.addColorStop(.6,"#6652d370");
 gradient.addColorStop(1,"#1b174200");
 ctx.fillStyle=gradient;ctx.fillRect(190,20,690,590);
 for(let i=0;i<8;i++){
  ring(ctx,530,316,66+i*25,107+i*20,
   i%2?"#8d66f0":"#40d6dc",3+i%3,Math.PI*(.05*i),Math.PI*(1.55+.04*i));
 }
 polygon(ctx,[[482,533],[469,340],[510,300],[497,242],[544,188],
  [584,259],[570,316],[590,520]],"#11142b",.95); // tower of layered thresholds
 for(let i=0;i<6;i++)stroke(ctx,[[480-i*18,440-i*36],
  [570+i*18,427-i*36]],i%2?"#91dce8":"#f4bd80",3);
 // Industrial saw-tooth red slashes, original noncharacter motif.
 for(let i=0;i<3;i++){
  const x=130+i*43;
  polygon(ctx,[[x,190],[x+20,163],[x+14,285],[x+44,250],
   [x+39,373],[x+70,353],[x+36,480]],"#f05b42",.7-i*.14);
 }
 // Violet cursed-energy arcs and fiery crescents.
 for(let i=0;i<10;i++){
  const angle=i*.48;
  ring(ctx,235,328,100+i*7,78+i*5,i%2?"#c3a0ff":"#7164df",2.1,
   angle,angle+1.25);
 }
 for(let i=0;i<8;i++){
  const x=720+i*26,y=350+(i%2)*35;
  polygon(ctx,[[x,y+80],[x-22,y+19],[x+2,y-33],[x+10,y+18],
   [x+38,y-13],[x+26,y+43]],i%2?"#f6a34b":"#ffdc79",.25+.06*i);
 }
 // Kaiju fracture and Hell's Paradise floral thorns.
 for(let i=0;i<12;i++){
  let x=780+rng()*210,y=210+rng()*350;
  stroke(ctx,[[x,y],[x+12*rng(),y+28],[x-17+rng()*34,y+62]],
   "#80d5bf",2+rng()*3);
 }
 for(let i=0;i<8;i++){
  const a=i*TAU/8;stroke(ctx,[[902,467],[902+Math.cos(a)*80,467+Math.sin(a)*60]],
   "#dd88bb",3);
 }
 tag(ctx,"RAID",75,103,118,"#f8f1d7",-.075,415);
 tag(ctx,"ASCEND",585,115,100,"#acd9f5",.04,380);
 tag(ctx,"SOLO LEVELING  /  JJK",74,542,35,"#a8c5ff");
 tag(ctx,"CHAINSAW MAN  ·  FIRE FORCE  ·  KAIJU 08",58,590,26,"#f7c18b");
 tag(ctx,"TOWER OF GOD  ·  HELL'S PARADISE",518,547,24,"#d7b5ff",-.015,490);
 tag(ctx,"SHANGRI-LA FRONTIER",590,586,24,"#8de4cd");
 for(let i=0;i<12;i++)splash(ctx,55+i*83,140+(i%4)*94,
  i%2?"#c294ec":"#f4a85d",12+13*rng(),rng);
}
function paintComedy(ctx:Paint){
 const rng=randomFor("out-of-this-world");
 const p=ctx.createRadialGradient(270,310,20,270,310,210);
 p.addColorStop(0,"#a8f465b8");p.addColorStop(.6,"#3db99577");
 p.addColorStop(1,"transparent");
 ctx.fillStyle=p;ctx.fillRect(45,45,465,520);
 for(let i=0;i<11;i++)ring(ctx,270,312,39+i*15,77+i*12,
  i%2?"#a4f35a":"#4ce7da",4+i%3,i*.15,Math.PI*1.8+i*.12);
 // Futuristic orbital city and off-center saucer.
 for(let i=0;i<16;i++){
  const x=520+i*29,h=28+90*rng();
  polygon(ctx,[[x,430],[x,430-h],[x+17,430-h],[x+17,430]],"#4cc6d7",.27+.3*rng());
 }
 ring(ctx,763,286,126,28,"#ec9beb",9,.2,Math.PI*1.9);
 polygon(ctx,[[681,287],[720,250],[800,250],[851,286]],"#f8ce7e",.48);
 for(let i=0;i<9;i++){
  const x=605+i*36;
  stroke(ctx,[[x,436],[x+9,410-rng()*130]],"#95e7e1",1.8);
 }
 // Tiny cut-paper snowy town and abstract funny aliens.
 polygon(ctx,[[72,482],[135,449],[180,478],[260,428],[358,475],[425,430],
  [448,510]],"#f0f1e8",.4);
 for(let i=0;i<4;i++){
  const x=540+i*111,y=150+30*(i%2);
  ring(ctx,x,y,21,28,"#c2ec9b",5);ring(ctx,x-8,y-3,4,8,"#f7f7e5",5);
  ring(ctx,x+8,y-3,4,8,"#f7f7e5",5);
  stroke(ctx,[[x-9,y+14],[x,y+21],[x+13,y+10]],"#e3ecdb",3);
 }
 tag(ctx,"OUT OF THIS",46,83,91,"#b9f27d",-.038,915);
 tag(ctx,"WORLD",370,165,102,"#c5e9ff",.03,545);
 tag(ctx,"RICK & MORTY   FUTURAMA",60,556,31,"#b5edd3");
 tag(ctx,"SOLAR OPPOSITES   SOUTH PARK",510,542,26,"#ffca8f");
 tag(ctx,"BOJACK / ARCHER / BOONDOCKS",505,580,22,"#e9c9df");
 tag(ctx,"AMERICAN DAD  ·  BRICKLEBERRY  ·  THE LEAGUE",47,604,19,"#d4e9df",0,900);
 for(let i=0;i<9;i++)splash(ctx,40+rng()*925,80+rng()*460,
  i%2?"#bff77b":"#94d5f3",16+rng()*13,rng);
}
function paintSportAnime(ctx:Paint){
 const rng=randomFor("striker");
 // Blue Lock converging target, Haikyu net and volleyball arcs.
 polygon(ctx,[[0,145],[450,80],[505,475],[0,515]],"#2069ec",.54);
 polygon(ctx,[[505,100],[1024,175],[1024,490],[478,510]],"#f5aa55",.38);
 for(let i=0;i<6;i++){
  stroke(ctx,[[0,95+i*71],[463,310]],i%2?"#d2ecfa":"#4495fb",3);
 }
 ring(ctx,410,310,112,116,"#daf2fb",7);
 ring(ctx,410,310,65,68,"#acd8ed",5);
 ring(ctx,410,310,23,24,"#fff7e8",5);
 for(let i=0;i<=9;i++){
  const x=540+i*45;
  stroke(ctx,[[x,195],[x,477]],"#e6e8e0",2.7);
 }
 for(let i=0;i<8;i++)stroke(ctx,[[535,210+i*37],[993,210+i*37]],"#f6edda",2);
 ring(ctx,770,297,70,70,"#ffcf91",13);
 stroke(ctx,[[700,315],[760,235],[825,282],[870,220]],"#fff0c5",7);
 tag(ctx,"BLUE LOCK",57,118,86,"#c3eaff",-.06,460);
 tag(ctx,"HAIKYU!!",555,102,92,"#ffe1a4",.05,440);
 tag(ctx,"STRIKER  //  SET POINT",118,552,43,"#f9efe1",-.025);
 for(let i=0;i<9;i++)splash(ctx,40+rng()*950,130+rng()*350,
  i%2?"#bfe4ed":"#fcb675",12+rng()*15,rng);
}
function paintIdentity(ctx:Paint){
 const rng=randomFor("sids");
 // Wide open title on dark stone, art confined above interactive game band.
 for(let i=0;i<12;i++){
  const y=35+i*18;
  stroke(ctx,[[35,y],[180,y-21],[480,y+20],[780,y-9],[993,y+11]],
   i%3===0?"#f6bd63":i%2?"#59c8dd":"#b48dd4",1.6+i%3);
 }
 polygon(ctx,[[42,100],[175,68],[865,65],[1003,114],
  [945,194],[82,191]],"#202334",.68);
 tag(ctx,"SID'S",74,106,105,"#ffde95",-.03,295);
 tag(ctx,"UNDERGROUND",365,107,91,"#d0eafa",.013,600);
 tag(ctx,"LEVEL SELECT  •  PLAY LOUD",307,216,41,"#d4c3e9");
 for(let i=0;i<16;i++)splash(ctx,40+rng()*935,20+rng()*230,
  i%3?"#73c2dd":"#f5ba77",8+rng()*12,rng);
}
function paintFloor(ctx:Paint){
 const rng=randomFor("cavern-floor");
 for(let side=0;side<2;side++){
  const x=side?915:120;
  stroke(ctx,[[x,35],[x-55*(side?1:-1),300],[x,625],
   [x+36*(side?1:-1),970]],side?"#e9b55b":"#3ec2cc",15);
  for(let i=0;i<6;i++){
   const y=70+i*165;
   ring(ctx,x+(side?-55:55),y,45,70,side?"#f0b771":"#6ed2d4",4,0,Math.PI);
  }
 }
 for(let i=0;i<7;i++){
  const y=100+i*138;
  polygon(ctx,[[480,y],[512,y+51],[544,y]],"#b1e8d8",.24);
  stroke(ctx,[[512,y+42],[512,y+100]],"#c5cfc4",4);
 }
 tag(ctx,"ONE MORE RUN",222,380,62,"#f1c89a",-.07,620);
 tag(ctx,"PLAY LOUD",360,780,68,"#8cc9d6",.025,410);
 for(let i=0;i<55;i++){
  const x=rng()*1024,y=rng()*1024;
  splash(ctx,x,y,i%2?"#edb674":"#7da9b7",3+7*rng(),rng);
 }
}
function paintCeiling(ctx:Paint){
 const rng=randomFor("cavern-ceiling");
 for(let i=0;i<3;i++){
  const x=230+i*260,y=310+(i%2)*130;
  ring(ctx,x,y,73+i*20,83+i*9,"#d3ad8a",3.5,Math.PI*.15,TAU*.89);
  for(let k=0;k<8;k++){
   const a=k*TAU/8;
   stroke(ctx,[[x+Math.cos(a)*87,y+Math.sin(a)*96],
    [x+Math.cos(a)*128,y+Math.sin(a)*133]],"#7ed1d1",3);
  }
 }
 for(let i=0;i<35;i++){
  const x=rng()*1024,y=rng()*1024;
  ring(ctx,x,y,2+rng()*4,2+rng()*4,i%4?"#e2c99d":"#7dbdc4",1.8);
 }
 tag(ctx,"LEVELS ABOVE",295,140,56,"#cfb18b",-.025);
}
function paintTexture(theme:CavernArtTheme,three:ArcadeThree){
 const canvas=document.createElement("canvas");
 canvas.width=1024;canvas.height=theme==="identity"?320:theme==="sports"||theme==="anime"||theme==="sport-anime"||theme==="comedy"?640:1024;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Arcade mural 2D canvas unavailable");
 basePaint(ctx,theme,canvas.width,canvas.height,
  theme==="sports"?"#8bbbef":theme==="anime"?"#947ae5":
  theme==="comedy"?"#77dca5":"#e1ac78");
 ctx.save();
 if(theme==="identity")paintIdentity(ctx);
 if(theme==="sports")paintSports(ctx);
 if(theme==="anime")paintAnime(ctx);
 if(theme==="comedy")paintComedy(ctx);
 if(theme==="sport-anime")paintSportAnime(ctx);
 ctx.restore();
 // Feather the spray as pigment on irregular stone, not an abruptly
 // cropped rectangular canvas. Preserve the center and lettering while
 // letting both lateral ends vanish into the basalt.
 ctx.save();
 ctx.globalCompositeOperation="destination-in";
 const fadeX=ctx.createLinearGradient(0,0,canvas.width,0);
 fadeX.addColorStop(0,"rgba(255,255,255,0)");
 fadeX.addColorStop(.045,"rgba(255,255,255,1)");
 fadeX.addColorStop(.94,"rgba(255,255,255,1)");
 fadeX.addColorStop(1,"rgba(255,255,255,0)");
 ctx.fillStyle=fadeX;ctx.fillRect(0,0,canvas.width,canvas.height);
 const fadeY=ctx.createLinearGradient(0,0,0,canvas.height);
 fadeY.addColorStop(0,"rgba(255,255,255,0)");
 fadeY.addColorStop(.055,"rgba(255,255,255,1)");
 fadeY.addColorStop(.95,"rgba(255,255,255,1)");
 fadeY.addColorStop(1,"rgba(255,255,255,0)");
 ctx.fillStyle=fadeY;ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.restore();
 const texture=new three.CanvasTexture(canvas);
 texture.colorSpace=three.SRGBColorSpace;
 texture.anisotropy=4;texture.generateMipmaps=true;
 texture.minFilter=three.LinearMipmapLinearFilter;
 return texture;
}
function atmosphereTexture(kind:"floor"|"ceiling",three:ArcadeThree){
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=1024;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Arcade paint canvas unavailable");
 if(kind==="floor")paintFloor(ctx);else paintCeiling(ctx);
 const texture=new three.CanvasTexture(canvas);
 texture.colorSpace=three.SRGBColorSpace;
 texture.anisotropy=4;
 return texture;
}
function surfaceMesh(surface:CavernArtSurface,z0:number,z1:number,
 v0:number,v1:number,texture:THREE.Texture,name:string,
 three:ArcadeThree,zSegments=34,vSegments=14){
 const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
 const left=surface==="left";
 for(let iz=0;iz<=zSegments;iz++)for(let iv=0;iv<=vSegments;iv++){
  const t=iz/zSegments,s=iv/vSegments;
  const z=z0+(z1-z0)*t,v=v0+(v1-v0)*s;
  const u=surface==="floor"||surface==="ceiling"?s:
   surface==="back"?t:.5;
  const mapped=sampleCavernArt(surface,z,u,v,.056);
  if(!mapped)throw Error("Invalid paint placement: "+name+" "+z+" "+v);
  const p=mapped.position;
  vertices.push(p.x,p.y,p.z);
  // Wall horizontal = longitudinal cave axis; floor horizontal = X axis.
  // The rear (+Z longitudinal) wall is viewed from -Z: viewer-right is
  // world -X. Flip U only on that back surface so painted text reads
  // left-to-right, matching the separately oriented carved game titles.
  uvs.push(surface==="floor"||surface==="ceiling"?s:
   (surface==="back"||left)?1-t:t,
   surface==="floor"||surface==="ceiling"?t:s);
 }
 for(let iz=0;iz<zSegments;iz++)for(let iv=0;iv<vSegments;iv++){
  const i=iz*(vSegments+1)+iv;
  indices.push(i,i+vSegments+1,i+1,i+1,i+vSegments+1,i+vSegments+2);
 }
 const g=new three.BufferGeometry();
 g.setAttribute("position",new three.Float32BufferAttribute(vertices,3));
 g.setAttribute("uv",new three.Float32BufferAttribute(uvs,2));
 g.setIndex(indices);g.computeVertexNormals();
 const mat=new three.MeshStandardMaterial({
  map:texture,emissiveMap:texture,emissive:new three.Color("#7f5f58"),
  emissiveIntensity:.17,transparent:true,opacity:.97,
  alphaTest:.015,depthWrite:false,
  side:three.DoubleSide,roughness:1,polygonOffset:true,
  polygonOffsetFactor:-2,polygonOffsetUnits:-2,
 });
 const mesh=new three.Mesh(g,mat);
 mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.raycast=()=>{};mesh.renderOrder=3;
 return mesh;
}
/** Pooled corner-stencil frames around, never over, the three playable
 * carved game targets. One non-raycast mesh for all 24 short paint strips.
 * The accurate hitboxes and carved title glyphs remain in worldRenderer. */
function createNicheGraffitiFrames(three:ArcadeThree){
 const floor=arcadeCaveFloorHeight(ARCADE_CAVE.wall),panelY=floor+2.35;
 const niches=[
  {x:10.35,z:-67,yaw:Math.PI/2,color:"#75bce7"},
  {x:16,z:-63.45,yaw:0,color:"#e9c17a"},
  {x:21.65,z:-67,yaw:-Math.PI/2,color:"#b2a0eb"},
 ];
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 for(const niche of niches){
  const color=new three.Color(niche.color);
  const basis=(u:number,v:number)=>{
   const offset=.104;
   return [
    niche.x+Math.cos(niche.yaw)*u+Math.sin(niche.yaw)*offset,
    panelY+v,
    niche.z-Math.sin(niche.yaw)*u-Math.cos(niche.yaw)*offset,
   ];
  };
  const paintLine=(x0:number,y0:number,x1:number,y1:number,thickness:number)=>{
   const len=Math.hypot(x1-x0,y1-y0)||1;
   const ox=-(y1-y0)/len*thickness*.5;
   const oy=(x1-x0)/len*thickness*.5;
   const start=positions.length/3;
   for(const [u,v] of [[x0+ox,y0+oy],[x0-ox,y0-oy],
    [x1+ox,y1+oy],[x1-ox,y1-oy]]){
    positions.push(...basis(u,v));colors.push(color.r,color.g,color.b);
   }
   indices.push(start,start+1,start+2,start+1,start+3,start+2);
  };
  const halfW=2.07,halfH=1.54,arm=.54;
  for(const sx of [-1,1]){
   for(const sy of [-1,1]){
    paintLine(sx*halfW,sy*halfH,sx*(halfW-arm),sy*halfH,.067);
    paintLine(sx*halfW,sy*halfH,sx*halfW,sy*(halfH-arm),.067);
   }
  }
  // Painted skill/score ticks below each carved target, distinct by color.
  for(const k of [-1,0,1]){
   paintLine(k*.19,-1.69,k*.19+.10,-1.69,.042);
  }
 }
 const geo=new three.BufferGeometry();
 geo.setAttribute("position",new three.Float32BufferAttribute(positions,3));
 geo.setAttribute("color",new three.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 const mat=new three.MeshStandardMaterial({
  color:new three.Color("#ffffff"),vertexColors:true,transparent:true,
  opacity:.91,depthWrite:false,side:three.DoubleSide,roughness:.82,
  emissive:new three.Color("#575048"),emissiveIntensity:.34,
 });
 const mesh=new three.Mesh(geo,mat);
 mesh.name="arcade-niche-graffiti-frames";
 mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};
 mesh.renderOrder=4;
 return mesh;
}

export function createWorldArcadeGraffiti(scene:THREE.Scene,three:ArcadeThree){
 const issues=validateArcadeArtManifest(ARCADE_CAVERN_MURALS);
 if(issues.length)throw Error("Cave mural manifest: "+issues.join("; "));
 const root=new three.Group();root.name="sid-underground-fandom-fresco";
 const meshes:THREE.Mesh[]=[],textures:THREE.Texture[]=[];
 for(const mural of ARCADE_CAVERN_MURALS){
  const tex=paintTexture(mural.theme,three);textures.push(tex);
  const wall=surfaceMesh(mural.surface,mural.z0,mural.z1,
   mural.v0,mural.v1,tex,"paint-"+mural.id,three,mural.surface==="back"?1:34,14);
  // For the rear upper band the longitudinal z dimension is zero: texture
  // horizontal must use wall width, not the degenerate z-coordinate.
  meshes.push(wall);root.add(wall);
 }
 for(const layer of ["floor","ceiling"] as const){
  const tex=atmosphereTexture(layer,three);textures.push(tex);
  const mesh=surfaceMesh(layer,layer==="floor"?-79:-75.5,
   layer==="floor"?-65:-65.2,layer==="floor"?.06:.18,
   layer==="floor"?.93:.86,tex,"paint-"+layer,three,38,16);
  meshes.push(mesh);root.add(mesh);
 }
 const nicheFrames=createNicheGraffitiFrames(three);
 root.add(nicheFrames);meshes.push(nicheFrames);
 scene.add(root);
 const triangles=meshes.reduce((sum,m)=>sum+(m.geometry.index?.count??0)/3,0);
 return {
  root,diagnostics:{murals:ARCADE_CAVERN_MURALS.length,
   drawCalls:meshes.length,triangles,materials:meshes.length,
   textureCount:textures.length},
  dispose(){
   scene.remove(root);
   for(const mesh of meshes){mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();}
   for(const texture of textures)texture.dispose();
   root.clear();
  },
 };
}
