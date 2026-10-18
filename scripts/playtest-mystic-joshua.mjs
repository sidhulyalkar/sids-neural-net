import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("Set PLAYWRIGHT_MODULE_ROOT");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/mystic-joshua-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"],
});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",err=>errors.push(err.message));
 await page.goto(base);
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 const canvas=page.locator("canvas");
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 await page.getByRole("button",{name:"Open navigation menu"}).click();
 await page.getByRole("button",{name:/03 Mystic grove Things I explore/}).click();
 const probe=()=>canvas.evaluate(c=>({
  player:c.dataset.player,activity:c.dataset.activity,
  region:c.dataset.region,nav:c.dataset.navigation,
  active:c.dataset.mysticElectricActive,
  position:c.dataset.mysticGrovePosition,
  trees:c.dataset.mysticGroveTrees,
  arcs:c.dataset.mysticGroveArcs,
  aquatic:c.dataset.aquatic,
  drawCalls:c.dataset.drawCalls,
 }));
 console.log("MYSTIC FIRST NAV",JSON.stringify(await probe()));
 try{
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   const p=d?.player?.split(",").map(Number);
   // The shared fast-travel landing is three units north of the marker.
   return p&&Math.hypot(p[0]-37,p[1]-68)<2&&
    d.mysticElectricActive==="true";
  },null,{timeout:45000});
 }catch(error){
  const snapshot=await probe();
  fs.writeFileSync(path.join(out,"mystic-failure.json"),
   JSON.stringify({snapshot,errors},null,2)+"\n");
  await page.screenshot({path:path.join(out,"mystic-navigation-failure.png")});
  throw new Error("Mystic Grove did not activate after navigation: "+
   JSON.stringify(snapshot),{cause:error});
 }
 const mystic=await canvas.evaluate(c=>({
  trees:Number(c.dataset.mysticGroveTrees),
  arcs:Number(c.dataset.mysticGroveArcs),
  position:c.dataset.mysticGrovePosition,
  active:c.dataset.mysticElectricActive,
  player:c.dataset.player,
  water:c.dataset.aquatic,
  drawCalls:Number(c.dataset.drawCalls),
 }));
 assert.equal(mystic.position,"37,65");
 assert.equal(mystic.trees,6);
 assert.equal(mystic.arcs,6);
 assert.equal(mystic.active,"true");
 assert.equal(mystic.water,"land");
 await page.screenshot({path:path.join(out,"01-mystic-shore-electric-branches.png")});
 await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,"02-mystic-shore-animation-next-frame.png")});
 await page.getByRole("button",{name:"Open navigation menu"}).click();
 await page.getByRole("button",{name:/Joshua basin Granite and desert trails/}).click();
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  const p=d?.player?.split(",").map(Number);
  return p&&Math.hypot(p[0]-22,p[1]+33)<2&&Number(d.joshuaTrees)>=15;
 },null,{timeout:30000});
 const joshua=await canvas.evaluate(c=>({
  trees:Number(c.dataset.joshuaTrees),player:c.dataset.player,
  aquatic:c.dataset.aquatic,drawCalls:Number(c.dataset.drawCalls),
 }));
 assert.ok(joshua.trees>=15,"living Joshua ring must remain visible");
 assert.equal(joshua.aquatic,"land");
 await page.screenshot({path:path.join(out,"03-joshua-race-restored-trees.png")});
 assert.deepEqual(errors,[],"No browser runtime exceptions");
 fs.writeFileSync(path.join(out,"report.json"),
  JSON.stringify({mystic,joshua,errors},null,2)+"\n");
 console.log("MYSTIC SHORE + JOSHUA VEGETATION BROWSER PASS",
  JSON.stringify({mystic,joshua,errors}));
}finally{await browser.close();}
