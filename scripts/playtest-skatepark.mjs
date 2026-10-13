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
 await page.keyboard.down("ArrowDown");await page.keyboard.up("ArrowDown");
 await page.keyboard.press("ArrowLeft");
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.skateTrick==="Kickflip",
  null,{timeout:10000});
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.skateTrick===""&&Number(d?.skateCombo)>=2;
 },null,{timeout:26000});
 const second=await sample(canvas);
 assert.ok(Number(second.score)>Number(first.score),
  "Clean flick landing chains into the current line");
 await page.screenshot({path:path.join(out,"02-skate-combo.png")});
 assert.deepEqual(errors,[],"No renderer errors or browser console errors");
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({first,second,errors},null,2)+"\n");
 console.log("Skatepark browser acceptance PASS",JSON.stringify({first,second,errors}));
}finally{await browser.close();}
