import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/skatepark-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[];
const sample=async canvas=>({
 park:await canvas.getAttribute("data-skate-park"),
 trick:await canvas.getAttribute("data-skate-trick"),
 score:await canvas.getAttribute("data-skate-score"),
 combo:await canvas.getAttribute("data-skate-combo"),
 result:await canvas.getAttribute("data-skate-result"),
 lastResult:await canvas.getAttribute("data-skate-last-result"),
 resultSerial:await canvas.getAttribute("data-skate-result-serial"),
 resultPoints:await canvas.getAttribute("data-skate-result-points"),
 assist:await canvas.getAttribute("data-skate-assist"),
 grove:await canvas.getAttribute("data-skate-grove"),
 groveZone:await canvas.getAttribute("data-skate-grove-zone"),
 speed:await canvas.getAttribute("data-speed"),
 height:await canvas.getAttribute("data-height"),
});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text());});
 await page.goto(base);
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 const canvas=page.locator("canvas");
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 await page.getByRole("button",{name:"Skateboarding",exact:true}).click();
 await page.getByRole("button",{name:"Skatepark · south meadow",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.skatePark==="true",
  null,{timeout:15000});
 assert.equal(await canvas.getAttribute("data-activity"),"skate");
 assert.equal(await canvas.getAttribute("data-skate-assist"),"on");
 assert.equal(await page.locator('[aria-label="Land sports target boost"]').isVisible(),false,
  "Skate mode should hide the unrelated permanent aim/fire banner");
 assert.equal(await canvas.getAttribute("data-skate-grove"),"redwood-timber-v1");
 assert.ok(["timber-quarter","street","apron","redwood-bowl","stump-pad"].includes(
  await canvas.getAttribute("data-skate-grove-zone")),"named wooden park zone");
 assert.equal(await page.getByRole("button",{name:"Do an assisted skate trick",includeHidden:true}).count(),1,
  "Single accessible touch trick button exists even when hidden on desktop");
 assert.ok(Number(await canvas.getAttribute("data-height"))>0);
 await page.screenshot({path:path.join(out,"01-skatepark-overview.png")});
 await canvas.focus();
 await page.keyboard.press("Space");
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.skateTrick==="Ollie",
  null,{timeout:10000});
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return Number(d?.skateScore)>0&&d?.skateTrick==="";
 },null,{timeout:26000});
 const first=await sample(canvas);
 assert.ok(Number(first.score)>0,"Landed ollie should score");
 assert.equal(first.lastResult,"Ollie","The first landed trick must emit a persistent completion event");
 assert.ok(Number(first.resultSerial)>0,"Landing event must increment a serial");
 assert.equal(await page.locator("[aria-label='Completed skateboard trick']").count(),1);
 await page.keyboard.down("ArrowDown");await page.keyboard.up("ArrowDown");
 await page.keyboard.press("ArrowLeft");
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.skateTrick==="Kickflip",
  null,{timeout:10000});
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.skateTrick===""&&Number(d?.skateCombo)>=2;
 },null,{timeout:26000});
 const second=await sample(canvas);
 assert.equal(second.lastResult,"Kickflip","An explicit flick should record the completed move");
 assert.ok(Number(second.resultSerial)>Number(first.resultSerial),"Each landing emits exactly a new result event");
 assert.ok(Number(second.resultPoints)>0,"The scored kickflip records earned points");
 assert.ok(Number(second.score)>Number(first.score),
  "Clean flick landing chains into the current line");
 await page.screenshot({path:path.join(out,"02-skate-combo.png")});
 // A second Space should choose a new move without any special flick sequence.
 await page.keyboard.press("Space");
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.skateTrick==="Kickflip",
  null,{timeout:10000});
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.skateTrick===""&&d?.skateLastResult==="Kickflip"&&
    Number(d?.skateResultSerial)>2;
 },null,{timeout:26000});
 const third=await sample(canvas);
 assert.ok(Number(third.resultSerial)>Number(second.resultSerial),"Assisted trick emits a third result event");
 assert.ok(Number(third.score)>Number(second.score),
  "A second one-button assisted trick should increase the player's line score");
 await page.screenshot({path:path.join(out,"03-skate-assisted-trick.png")});
 assert.deepEqual(errors,[],"No renderer errors or browser console errors");
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({first,second,third,errors},null,2)+"\n");
 console.log("Skatepark browser acceptance PASS",JSON.stringify({first,second,third,errors}));
}finally{await browser.close();}
