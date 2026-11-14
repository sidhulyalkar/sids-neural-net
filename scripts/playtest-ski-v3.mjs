import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,"package.json"))("playwright");
const dir=process.env.WORLD_AUDIT_DIR ?? "artifacts/ski-v3";
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"]});
const page=await browser.newPage({viewport:{width:850,height:610},recordVideo:{dir}});
const canvas=page.locator("canvas").first();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
async function phase(value){
  await page.waitForFunction(s=>document.querySelector("canvas")?.dataset.skiRidePhase===s,value,{timeout:90000});
}
async function capture(name){
  await page.screenshot({path:path.join(dir,name+".png")});
  const data=await canvas.evaluate(c=>({...c.dataset}));
  fs.writeFileSync(path.join(dir,name+".json"),JSON.stringify(data,null,2));
  assert.equal(data.bigAirPhase,"idle");
}
try{
  await page.goto(process.env.WORLD_BASE_URL ?? "http://localhost:3000",{timeout:120000});
  await page.getByRole("button",{name:"Explore world",exact:true}).click({timeout:120000});
  await page.getByRole("button",{name:"Skiing",exact:true}).click();
  await phase("riding");
  await page.keyboard.down("Space");
  await phase("charging");
  await capture("charge");
  await page.keyboard.up("Space");
  await phase("air");
  await page.keyboard.down("a");
  await capture("air");
  await page.keyboard.up("a");
  await page.waitForFunction(()=>["rough","clean","crash"].includes(document.querySelector("canvas")?.dataset.skiLanding),null,{timeout:90000});
  await capture("touchdown");
  await page.getByRole("button",{name:"Trail running",exact:true}).click();
  await phase("");
  assert.deepEqual(errors,[]);
} finally {
  fs.writeFileSync(path.join(dir,"errors.json"),JSON.stringify(errors));
  await page.close();await browser.close();
}
