import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/arcade-interior";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
let evidence={},errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push(String(e)));
 try{
  await page.goto(base);
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:45000});
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.arcadeGraffitiVersion==="asset-first-v3",
   null,{timeout:14000});
  const canvas=page.locator("canvas");
  evidence.metrics=await canvas.evaluate(el=>({
   count:Number(el.dataset.arcadeGraffitiMurals),
   calls:Number(el.dataset.arcadeGraffitiDrawCalls),
   triangles:Number(el.dataset.arcadeGraffitiTriangles),
  }));
  assert.equal(evidence.metrics.count,9,"all gallery and identity murals must be loaded");
  assert.ok(evidence.metrics.calls<=18,"graffiti is an optimized draw batch");
  assert.ok(evidence.metrics.triangles<=40000,"stay inside geometry budget");
  assert.equal(await canvas.getAttribute("data-arcade-architecture"),
   "open-stone-cap-v3","the old rear-wall box and throat baffle must be absent");
  // A source-authored local title texture must really load into WebGL.
  // The procedural fallback is not accepted as evidence of that asset.
  await page.waitForFunction(()=>Number(
   document.querySelector("canvas")?.dataset.arcadeAuthoredMuralsReady)>=9,
   null,{timeout:40000});
  const titleResponse=await page.request.get(base+
   "/world/arcade-cavern/hero/sids-underground.svg");
  assert.equal(titleResponse.status(),200,"authored mural texture must be present");
  for(const name of ["chelsea-crest.png","patriots-crest.png",
   "warriors-crest.png"]){
   const path="/world/arcade-cavern/sports/"+name;
   const response=await page.request.get(base+path);
   assert.equal(response.status(),200,"missing authentic sports source: "+path);
   assert.match(response.headers()["content-type"]??"",/image\/png/,
    "team crest must be a real PNG, not missing-page HTML");
  }
  for(const source of [
   "/world/arcade-cavern/science/mindforge-brain.svg",
   "/world/arcade-cavern/anime/raid-ascend.svg",
   "/world/arcade-cavern/comedy/out-of-this-world.svg",
   "/world/arcade-cavern/sport-anime/striker-setpoint.svg",
  ]){
   const response=await page.request.get(base+source);
   assert.equal(response.status(),200,"missing painted composition: "+source);
   assert.match(await response.text(),/^<svg[^>]+/,"must contain a real SVG composition");
  }
  // Decode every mural and quantify visible painted area. This rejects
  // accidental zero-alpha/empty SVGs and wire-only "mural" placeholders.
  evidence.authoredInk=await page.evaluate(async()=>{
   const sources=[
    "/world/arcade-cavern/science/mindforge-brain.svg",
    "/world/arcade-cavern/anime/raid-ascend.svg",
    "/world/arcade-cavern/comedy/out-of-this-world.svg",
   "/world/arcade-cavern/sport-anime/striker-setpoint.svg",
   ];
   const values=[];
   for(const source of sources){
    const image=new Image();image.src=source;await image.decode();
    const c=document.createElement("canvas");c.width=160;c.height=100;
    const ctx=c.getContext("2d",{willReadFrequently:true});
    if(!ctx)throw Error("no artwork compositor for "+source);
    ctx.drawImage(image,0,0,160,100);
    const pixels=ctx.getImageData(0,0,160,100).data;
    let painted=0,chromatic=0,opaqueCorners=0;
    for(let i=0;i<pixels.length;i+=4){
     if(pixels[i+3]>90)painted++;
     if(pixels[i+3]>90&&Math.max(pixels[i],pixels[i+1],pixels[i+2])-
       Math.min(pixels[i],pixels[i+1],pixels[i+2])>30)chromatic++;
    }
    for(const [x,y] of [[0,0],[159,0],[0,99],[159,99]])
     opaqueCorners+=ctx.getImageData(x,y,1,1).data[3]>0?1:0;
    values.push({source,painted,chromatic,opaqueCorners});
   }
   return values;
  });
  for(const art of evidence.authoredInk){
   assert.ok(art.painted>1200,
    "asset lacks substantial filled graphical paint: "+art.source);
   assert.ok(art.chromatic>900,
    "asset needs bold illustrated color masses, not faint lines: "+art.source);
   assert.equal(art.opaqueCorners,0,
    "asset must expose stone outside its irregular alpha edges: "+art.source);
  }
  const shastaPhoto=await page.request.get(base+"/visual-archive/web/photo-037.webp");
  assert.equal(shastaPhoto.status(),200,
   "the source photograph of Shasta must exist in the public visual archive");
  const titleAlpha=await page.evaluate(async()=>{
   const image=new Image();
   image.src="/world/arcade-cavern/hero/sids-underground.svg";
   await image.decode();
   const tile=document.createElement("canvas");tile.width=64;tile.height=64;
   const ctx=tile.getContext("2d");if(!ctx)throw Error("No art QA 2D canvas");
   ctx.drawImage(image,0,0,64,64);
   return [[1,1],[62,1],[1,62],[62,62]].map(([x,y])=>
    ctx.getImageData(x,y,1,1).data[3]);
  });
  assert.ok(titleAlpha.every(v=>v===0),
   "hero artwork must have true transparent corners, never a rectangular billboard");

  await page.getByRole("button",{name:"Open navigation menu"}).click();
  await page.getByRole("button",{name:/08 Arcade cavern Play my games/}).click();
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.caveLayer==="surface"&&d.arcadeTrailStage==="entrance";
  },null,{timeout:14000});
  await page.screenshot({path:path.join(out,"01-exterior-gateway.png")});
  await canvas.focus();
  // Walk to inner murals with normal keyboard controls. No injection or
  // forced pose manipulation: mural art must be visible during real play.
  const move=async(key,axis,limit,greater)=>{
   await page.keyboard.down(key);
   try{
    await page.waitForFunction(({axis,limit,greater})=>{
     const pos=(document.querySelector("canvas")?.dataset.player??"").split(",").map(Number);
     return greater?pos[axis]>=limit:pos[axis]<=limit;
    },{axis,limit,greater},{timeout:110000});
   }finally{await page.keyboard.up(key);}
  };
  await move("w",1,-77,true);
  await page.screenshot({path:path.join(out,"02-lantern-throat-comedy.png")});
  // The baffle was removed. Walk straight down the open centerline,
  // proving the build no longer hides an invisible obstacle.
  await move("w",1,-69.9,true);
  const clearWalk=await canvas.evaluate(el=>(el.dataset.player??"").split(",").map(Number));
  assert.ok(Math.abs(clearWalk[0]-16)<1.4,
   "the direct arcade centerline must be traversable without a lateral detour");
  await page.waitForTimeout(600);
  evidence.interior=await canvas.evaluate(el=>({
   player:el.dataset.player,layer:el.dataset.caveLayer,
   drawCalls:el.dataset.drawCalls,triangles:el.dataset.triangles,
   fps:el.dataset.fps,graffiti:el.dataset.arcadeGraffitiVersion,
   caveCameraClear:el.dataset.caveCameraClear,
  }));
  assert.equal(evidence.interior.layer,"arcade");
  assert.equal(evidence.interior.graffiti,"asset-first-v3");
  await page.screenshot({path:path.join(out,"03-fandom-main-chamber-reveal.png")});
  // Rotate the gameplay camera to inspect both original side compositions.
  await page.mouse.move(700,430);await page.mouse.down();
  await page.mouse.move(935,430,{steps:12});await page.mouse.up();
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(out,"04-graffiti-left-wall.png")});
  await page.mouse.move(700,430);await page.mouse.down();
  await page.mouse.move(220,430,{steps:20});await page.mouse.up();
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(out,"05-graffiti-right-wall.png")});
  // Deliberately pitch upward: Shasta and the Mind Forge mural are high
  // on the rock facets, not pasted on the three clickable game panels.
  await page.mouse.move(700,430);await page.mouse.down();
  await page.mouse.move(700,600,{steps:14});await page.mouse.up();
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(out,"06-neural-upper-facet.png")});
  await page.mouse.move(700,430);await page.mouse.down();
  await page.mouse.move(1180,430,{steps:20});await page.mouse.up();
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(out,"07-shasta-upper-facet.png")});
  assert.deepEqual(errors,[],"graffiti rendering must not produce JavaScript errors");
  console.log("ARCADE FRESCO BROWSER PASS",JSON.stringify({evidence,errors}));
 }catch(error){
  try{await page.keyboard.up("w");await page.keyboard.up("a");}
  catch{/* page may be disposed */}
  try{await page.screenshot({path:path.join(out,"failure.png")});}
  catch{/* page may be disposed */}
  console.error("ARCADE FRESCO BROWSER FAIL",String(error),JSON.stringify({evidence,errors}));
  throw error;
 }finally{
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({evidence,errors},null,2)+"\n");
 }
}finally{await browser.close();}
