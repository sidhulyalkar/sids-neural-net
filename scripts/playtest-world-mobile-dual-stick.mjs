import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/mobile-dual-stick";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const trace=[],errors=[];
let page;
try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,
  });
  page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(process.env.WORLD_BASE_URL??"http://127.0.0.1:3000");
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
    null,{timeout:110000});
  const canvas=page.locator("canvas").first();
  const nav=page.getByRole("navigation",{name:"World movement and sports"});
  const move=page.locator("button[data-axis=movement]");
  const look=page.locator("button[data-axis=look]");
  assert.equal(await canvas.getAttribute("data-mobile-joysticks"),"true");
  assert.equal(await nav.getAttribute("data-mobile-open"),"false");
  assert.equal(await move.isVisible(),true);
  assert.equal(await look.isVisible(),true);
  assert.equal(await nav.locator("#world-hub-contents").isVisible(),false);
  const hub=await nav.boundingBox();
  assert.ok(hub&&hub.width<=220,"collapsed hub does not cover the world");
  await page.screenshot({path:path.join(out,"01-portrait.png")});
  const lb=await move.boundingBox(),rb=await look.boundingBox();
  assert.ok(lb&&rb&&lb.x+lb.width<rb.x);
  const lc={x:lb.x+lb.width/2,y:lb.y+lb.height/2};
  const rc={x:rb.x+rb.width/2,y:rb.y+rb.height/2};
  const touch=(id,x,y)=>({id,x,y,force:1,radiusX:8,radiusY:8});
  const client=await context.newCDPSession(page);
  const send=(type,touchPoints)=>client.send("Input.dispatchTouchEvent",{type,touchPoints});
  const movement=touch(1,lc.x,lc.y-lb.height*.39);
  const camera=touch(2,rc.x+rb.width*.39,rc.y);
  await send("touchStart",[touch(1,lc.x,lc.y)]);
  await send("touchMove",[movement]);
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.mobileMove?.split(",")[1])>.3,
    null,{timeout:10000});
  // A finger may be holding Move while the other taps Jump: focus transfer
  // must preserve the analog movement vector, not clear both pointers.
  await canvas.evaluate(el=>el.focus({preventScroll:true}));
  await page.locator('button[class*="mobileActionButton"]').evaluate(el=>el.focus({preventScroll:true}));
  assert.ok(Number((await canvas.getAttribute("data-mobile-move")).split(",")[1])>.3,
    "Touch action focus must preserve the held movement stick");
  await send("touchStart",[movement,touch(2,rc.x,rc.y)]);
  await send("touchMove",[movement,camera]);
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.mobileLook?.split(",")[0])>.3,
    null,{timeout:10000});
  const moving=await canvas.evaluate(c=>({...c.dataset}));
  assert.ok(Math.hypot(...moving.rideInputVector.split(",").map(Number))>.05);
  trace.push({stage:"two thumb input",move:moving.mobileMove,look:moving.mobileLook,
    vector:moving.rideInputVector});
  await page.screenshot({path:path.join(out,"02-both-thumbs.png")});
  // CDP touchEnd takes the contact that ends (not the contacts remaining).
  await send("touchEnd",[movement]);
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.mobileMove==="0.00,0.00",
    null,{timeout:10000});
  assert.ok(Number((await canvas.getAttribute("data-mobile-look")).split(",")[0])>.3);
  await send("touchEnd",[camera]);
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.mobileLook==="0.00,0.00",
    null,{timeout:10000});
  await nav.getByRole("button",{name:"Expand island controls"}).click();
  assert.equal(await nav.locator("#world-hub-contents").isVisible(),true);
  await page.screenshot({path:path.join(out,"03-expanded.png")});
  await nav.getByRole("button",{name:"Collapse island controls"}).click();
  assert.equal(await nav.getAttribute("data-mobile-open"),"false");
  await nav.getByRole("button",{name:"Open navigation menu"}).click();
  assert.equal(await page.locator("dialog[open]").count(),1);
  assert.equal(await move.isVisible(),false);
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>!document.querySelector("dialog[open]"),null,{timeout:10000});
  await page.setViewportSize({width:844,height:390});
  const landscape=await nav.boundingBox();
  assert.ok(landscape&&landscape.x>=0&&landscape.y+landscape.height<=390);
  assert.equal(await move.isVisible(),true);
  await page.screenshot({path:path.join(out,"04-landscape.png")});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({trace,errors},null,2)+"\n");
  console.log("MOBILE DUAL-STICK PASS",JSON.stringify({trace,errors}));
}catch(e){
  try{await page?.screenshot({path:path.join(out,"failure.png")});}catch{}
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({trace,errors,error:String(e)},null,2)+"\n");
  throw e;
}finally{await browser.close();}
