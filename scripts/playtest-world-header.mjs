import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const runner=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!runner)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(runner,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
const output=process.env.WORLD_AUDIT_DIR??"artifacts/world/header";
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"],
});
const viewports=[
 {width:832,height:634,mobile:false},
 {width:1280,height:800,mobile:false},
 {width:390,height:844,mobile:true},
 {width:320,height:568,mobile:true},
];
const results=[],errors=[];
try{
 for(const viewport of viewports){
  const page=await browser.newPage({
   viewport:{width:viewport.width,height:viewport.height},
   deviceScaleFactor:1,isMobile:viewport.mobile,hasTouch:viewport.mobile,
  });
  page.on("pageerror",e=>errors.push(viewport.width+": "+e.message));
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:90000});
  await page.getByRole("button",{name:"Explore world",exact:true})
   .click({timeout:90000});
  const menu=page.getByRole("button",{name:"Open navigation menu"});
  const dock=page.getByRole("navigation",{name:"World movement and sports"});
  await dock.waitFor({state:"visible",timeout:90000});
  const measure=async()=>page.evaluate(()=>{
   const menu=document.querySelector('button[aria-label="Open navigation menu"]');
   const dock=document.querySelector('nav[aria-label="World movement and sports"]');
   if(!menu||!dock)throw Error("Menu and sports dock must exist");
   const m=menu.getBoundingClientRect(),d=dock.getBoundingClientRect();
   return {gap:d.top-m.bottom,menuRight:m.right,dockRight:d.right,
    dockLeft:d.left,dockTop:d.top,menuBottom:m.bottom,
    clipped:d.left<0||d.right>innerWidth,
    viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    menuVisible:m.width>0&&m.height>0,dockVisible:d.width>0&&d.height>0};
  });
  const rect=await measure();
  assert.ok(rect.menuVisible&&rect.dockVisible,JSON.stringify(rect));
  assert.ok(rect.gap>=10&&rect.gap<=14,
   "12px visual gap required between Menu and sports bar: "+JSON.stringify(rect));
  assert.ok(Math.abs(rect.menuRight-rect.dockRight)<=2,
   "Right edges must align without overlapping: "+JSON.stringify(rect));
  assert.ok(!rect.clipped,
   "Sports bar must stay fully within the viewport: "+JSON.stringify(rect));
  assert.ok(rect.scrollWidth<=rect.viewportWidth+1,
   "Header should not cause horizontal overflow: "+JSON.stringify(rect));
  await page.screenshot({path:path.join(output,
   viewport.width+"x"+viewport.height+"-header.png")});
  await page.getByRole("button",{name:"Show sport shortcuts"}).click();
  const expanded=page.getByRole("group",{name:"Sport shortcuts"});
  await expanded.waitFor({state:"visible"});
  assert.equal(await expanded.getByRole("button").count(),5);
  const opened=await measure();
  assert.ok(opened.gap>=10&&opened.gap<=14,
   "Expanded sports drawer must preserve Menu gap: "+JSON.stringify(opened));
  await page.getByRole("button",{name:"Hide sport shortcuts"}).click();
  await menu.click();
  await page.getByRole("dialog").waitFor({state:"visible"});
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({state:"hidden"});
  results.push({viewport,rect,expandedGap:opened.gap});
  await page.close();
 }
 assert.deepEqual(errors,[],"No browser runtime errors");
 fs.writeFileSync(path.join(output,"report.json"),
  JSON.stringify({results,errors},null,2)+"\n");
 console.log("WORLD HEADER SPACING QA PASS",JSON.stringify({results,errors}));
}finally{await browser.close();}
