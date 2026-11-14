import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const runner=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!runner)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(runner,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const output=process.env.WORLD_AUDIT_DIR??"artifacts/world/cairn-stories";
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"],
});
const errors=[],report=[];
const cases=[
 {width:1280,height:800,region:"Redwood grove",story:"Building the experiment before analyzing the brain",hero:true,thumbs:1},
 {width:390,height:844,region:"Wild coast",story:"Where observation becomes a collection of questions",hero:false,thumbs:6},
];
try{
 for(const scenario of cases){
  const page=await browser.newPage({viewport:{width:scenario.width,height:scenario.height},
   deviceScaleFactor:1,isMobile:scenario.width<500,hasTouch:scenario.width<500});
  page.on("pageerror",e=>errors.push(scenario.region+": "+e.message));
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:90000});
  await page.getByRole("button",{name:"Explore world",exact:true}).click({timeout:90000});
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:90000});
  await page.getByRole("button",{name:"Open navigation menu"}).click();
  const menu=page.getByRole("dialog");
  await menu.getByRole("button",{name:new RegExp("^"+scenario.region)}).click();
  // Use actual Cairn navigation and live discovery instead of injecting UI state.
  const discovery=page.locator('button[class*="discovery"]');
  await discovery.waitFor({state:"visible",timeout:90000});
  await discovery.click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("heading",{name:scenario.story}).waitFor({state:"visible",timeout:15000});
  const context=dialog.locator("details");
  assert.equal(await context.count(),1);
  assert.equal(await context.evaluate(el=>el.open),false);
  await context.locator("summary").click();
  assert.equal(await context.evaluate(el=>el.open),true);
  const related=dialog.getByRole("navigation",{name:"Related work"});
  assert.equal(await related.getByRole("link").count(),2);
  for(const link of await related.getByRole("link").all()){
   const href=await link.getAttribute("href");
   assert.ok(href?.startsWith("/")&&!href.startsWith("//"));
  }
  const photos=dialog.getByRole("button",{name:/^View photograph:/});
  assert.equal(await photos.count(),scenario.hero?1:0);
  const thumbs=dialog.locator('div[class*="memoryList"] button');
  assert.equal(await thumbs.count(),scenario.thumbs);
  if(scenario.hero){
   await page.waitForFunction(()=>{
    const img=document.querySelector('section[class*="cairnStory"] figure img');
    return img?.complete&&img.naturalWidth>0;
   },null,{timeout:15000});
   assert.ok(await photos.first().locator("img").isVisible());
  }
  const bounds=await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,
   height:el.clientHeight,scrollHeight:el.scrollHeight}));
  assert.ok(bounds.scroll<=bounds.width+2,
   "Cairn content must not overflow its responsive dialog "+JSON.stringify(bounds));
  await page.screenshot({path:path.join(output,scenario.width+"-cairn.png")});
  const back=dialog.getByRole("button",{name:"Return to the island"});
  assert.ok(await back.isVisible());
  await back.click();
  await page.waitForFunction(()=>!document.querySelector("dialog")?.open,null,{timeout:15000});
  assert.ok(await discovery.isVisible());
  report.push({...scenario,bounds,relatedLinks:2});
  await page.close();
 }
 assert.deepEqual(errors,[],"No browser runtime errors during Cairn traversal");
 fs.writeFileSync(path.join(output,"report.json"),JSON.stringify({report,errors},null,2)+"\n");
 console.log("CAIRN STORIES UI QA PASS",JSON.stringify({report,errors}));
}finally{await browser.close();}
