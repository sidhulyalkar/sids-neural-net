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
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.arcadeGraffitiVersion==="fresco-v1",
   null,{timeout:14000});
  const canvas=page.locator("canvas");
  evidence.metrics=await canvas.evaluate(el=>({
   count:Number(el.dataset.arcadeGraffitiMurals),
   calls:Number(el.dataset.arcadeGraffitiDrawCalls),
   triangles:Number(el.dataset.arcadeGraffitiTriangles),
  }));
  assert.equal(evidence.metrics.count,5,"all authored original murals must be loaded");
  assert.ok(evidence.metrics.calls<=18,"graffiti is an optimized draw batch");
  assert.ok(evidence.metrics.triangles<=40000,"stay inside geometry budget");
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
  await move("a",0,18.1,true);
  await move("w",1,-69.9,true);
  await page.waitForTimeout(600);
  evidence.interior=await canvas.evaluate(el=>({
   player:el.dataset.player,layer:el.dataset.caveLayer,
   drawCalls:el.dataset.drawCalls,triangles:el.dataset.triangles,
   fps:el.dataset.fps,graffiti:el.dataset.arcadeGraffitiVersion,
   caveCameraClear:el.dataset.caveCameraClear,
  }));
  assert.equal(evidence.interior.layer,"arcade");
  assert.equal(evidence.interior.graffiti,"fresco-v1");
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
