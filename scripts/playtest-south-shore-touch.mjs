import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/mobile-snorkel";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[],trace=[];
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1
 });
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world");
  await page.getByRole("button",{name:"Explore world",exact:true}).tap();
  const canvas=page.locator("canvas");
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,null,{timeout:50000});
  assert.equal(await canvas.getAttribute("data-mobile-joysticks"),"true");
  await page.getByRole("button",{name:"Open navigation menu"}).tap();
  await page.getByRole("button",{name:/South shore/}).tap();
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.currentRegion==="south-shore"
   &&document.querySelector("canvas")?.dataset.aquatic==="surface",null,{timeout:20000});
  const move=page.locator('button[data-axis="movement"]');
  const look=page.locator('button[data-axis="look"]');
  assert.equal(await move.isVisible(),true);
  assert.equal(await look.isVisible(),true);
  const mb=await move.boundingBox(),lb=await look.boundingBox();
  assert.ok(mb&&lb&&mb.x+mb.width<lb.x,"move/look must not overlap");
  await page.screenshot({path:path.join(out,"01-south-shore-two-thumb-ui.png")});
  const start=(await canvas.getAttribute("data-player")).split(",").map(Number);
  assert.ok(start[0]<=8&&start[0]>=6,"menu begins in the clear western swim corridor");
  const water=page.getByRole("button",{name:"Dive",exact:true});
  assert.equal(await water.isVisible(),true);
  await water.tap();
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.aquatic==="dive",null,{timeout:18000});
  const c1={x:mb.x+mb.width/2,y:mb.y+mb.height/2};
  const c2={x:lb.x+lb.width/2,y:lb.y+lb.height/2};
  const touch=(id,x,y)=>({id,x,y,force:1,radiusX:7,radiusY:7});
  const session=await context.newCDPSession(page);
  const send=(type,touchPoints)=>session.send("Input.dispatchTouchEvent",{type,touchPoints});
  const mv=touch(1,c1.x,c1.y-mb.height*.40),lk=touch(2,c2.x+lb.width*.35,c2.y);
  await send("touchStart",[touch(1,c1.x,c1.y)]);
  await send("touchMove",[mv]);
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.mobileMove?.split(",")[1])>.25,null,{timeout:10000});
  await send("touchStart",[mv,touch(2,c2.x,c2.y)]);
  await send("touchMove",[mv,lk]);
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.mobileLook?.split(",")[0])>.20,null,{timeout:10000});
  await page.waitForTimeout(1450);
  const moving=await canvas.evaluate(el=>({
   player:el.dataset.player,move:el.dataset.mobileMove,look:el.dataset.mobileLook,
   input:el.dataset.rideInputVector,depth:el.dataset.depth,region:el.dataset.currentRegion
  }));
  trace.push({start,moving});
  assert.ok(Math.hypot(...moving.input.split(",").map(Number))>.05);
  assert.ok(Math.hypot(...moving.player.split(",").map(Number).map((v,i)=>v-start[i]))>.45,
   "mobile thumb movement must affect actual diver position");
  assert.equal(moving.region,"south-shore");
  const actualCameraDistance=Number(await canvas.getAttribute("data-south-camera-actual-distance"));
  const cameraPose=await canvas.getAttribute("data-south-camera-pos");
  const focusPose=await canvas.getAttribute("data-south-camera-focus");
  trace.push({actualCameraDistance,cameraPose,focusPose});
  assert.ok(Number.isFinite(actualCameraDistance)&&actualCameraDistance>=5.5,
   "diver camera must retain a real third-person boom: "+actualCameraDistance);
  const clearance=Number(await canvas.getAttribute("data-south-rock-clearance"));
  const cameraClearance=Number(await canvas.getAttribute("data-south-camera-rock-clearance"));
  assert.ok(clearance>=.74,"swimmer must not intersect a volcanic arch leg: "+clearance);
  assert.ok(cameraClearance>=.98,"camera must not see through a volcanic arch leg: "+cameraClearance);
  trace.push({clearance,cameraClearance});
  await page.screenshot({path:path.join(out,"02-south-shore-underwater-two-thumb.png")});
  await send("touchEnd",[mv]);
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.mobileMove==="0.00,0.00",null,{timeout:12000});
  assert.ok(Number((await canvas.getAttribute("data-mobile-look")).split(",")[0])>.2);
  await send("touchEnd",[lk]);
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.mobileLook==="0.00,0.00",null,{timeout:12000});
  await page.setViewportSize({width:844,height:390});
  assert.ok(await move.isVisible());
  assert.ok(await look.isVisible());
  await page.screenshot({path:path.join(out,"03-landscape.png")});
  assert.deepEqual(errors,[]);
  console.log("MOBILE SOUTH SHORE TOUCH PASS",JSON.stringify({trace,errors}));
 }catch(e){
  try{await page.screenshot({path:path.join(out,"failure.png")});}catch{/*closed*/}
  console.error("MOBILE SOUTH SHORE TOUCH FAIL",String(e),JSON.stringify({trace,errors}));
  throw e;
 }finally{
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({trace,errors},null,2)+"\n");
  await page.close();
 }
}finally{await browser.close();}
