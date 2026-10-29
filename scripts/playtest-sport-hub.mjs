import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/sport-hub";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[],observations=[];
const shortcuts=["Disc golf","Bike race","Jet ski","Ski jump","Skatepark"];
const launch=async (page,name)=>{
  const toggle=page.getByRole("button",{name:"Show sport shortcuts"});
  assert.equal(await toggle.getAttribute("aria-expanded"),"false");
  await toggle.click();
  const drawer=page.getByRole("group",{name:"Sport shortcuts"});
  assert.equal(await drawer.isVisible(),true);
  assert.deepEqual(await drawer.getByRole("button").allTextContents(),shortcuts);
  await drawer.getByRole("button",{name,exact:true}).click();
};
async function enter(page){
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  await page.goto(base);
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
    null,{timeout:45000});
}
try{
  const desktop=await browser.newPage({viewport:{width:1440,height:900}});
  await enter(desktop);
  const dock=desktop.getByRole("navigation",{name:"World movement and sports"});
  const dimensions=await dock.boundingBox();
  // Desktop retains its complete activity HUD; compact collapse is touch-only.
  assert.ok(dimensions&&dimensions.height<230&&dimensions.width<410,
    "Desktop HUD must remain bounded with activity controls available");
  assert.equal(await dock.getByRole("button",{name:"Run"}).isVisible(),true);
  assert.equal(await dock.getByRole("button",{name:"Show sport shortcuts"}).isVisible(),true);
  assert.equal(await dock.getByRole("group",{name:"Sport shortcuts"}).isVisible(),false);
  assert.equal(await dock.getByRole("button",{name:"Skateboarding"}).getAttribute("aria-pressed"),"false");
  await desktop.screenshot({path:path.join(out,"01-desktop-collapsed.png")});
  await dock.getByRole("button",{name:"Show sport shortcuts"}).focus();
  await desktop.keyboard.press("Enter");
  assert.equal(await dock.getByRole("group",{name:"Sport shortcuts"}).isVisible(),true,
    "Keyboard must expand the native button-controlled drawer");
  await desktop.screenshot({path:path.join(out,"02-desktop-expanded.png")});
  await dock.getByRole("button",{name:"Hide sport shortcuts"}).click();
  assert.equal(await dock.getByRole("group",{name:"Sport shortcuts"}).isVisible(),false);
  await launch(desktop,"Skatepark");
  await desktop.waitForFunction(()=>document.querySelector("canvas")?.dataset.skatePark==="true",
    null,{timeout:15000});
  assert.equal(await desktop.locator("canvas").getAttribute("data-activity"),"skate");
  assert.equal(await dock.getByRole("button",{name:"Show sport shortcuts"}).getAttribute("aria-expanded"),"false",
    "A launched sport must close its drawer");
  observations.push({sport:"Skatepark",player:await desktop.locator("canvas").getAttribute("data-player")});
  await desktop.close();
  for(const [name,check] of [
    ["Disc golf",async(page)=>{
      await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.discGolfPhase==="ready",
        null,{timeout:15000});
      assert.equal(await page.locator('[data-world-game="disc"]').count(),1);
    }],
    ["Bike race",async(page)=>{
      await page.waitForFunction(()=>["armed","running"].includes(document.querySelector("canvas")?.dataset.trialPhase),
        null,{timeout:15000});
      assert.equal(await page.locator("canvas").getAttribute("data-activity"),"bike");
    }],
    ["Ski jump",async(page)=>{
      await page.waitForFunction(()=>["armed","flying"].includes(document.querySelector("canvas")?.dataset.bigAirPhase),
        null,{timeout:15000});
      assert.equal(await page.locator("canvas").getAttribute("data-activity"),"ski");
    }],
    ["Jet ski",async(page)=>{
      const chooser=page.getByRole("dialog",{name:"Choose a jet ski"});
      await chooser.waitFor({state:"visible",timeout:15000});
      const point=(await page.locator("canvas").getAttribute("data-player")).split(",").map(Number);
      assert.ok(point[0]>=61.5&&Math.abs(point[1]-14)<.1,
        "Jet Ski must land on the actual walkable boarding deck");
      assert.equal(await page.locator("canvas").getAttribute("data-jet-ski-chooser"),"open");
      await chooser.getByRole("button",{name:/Free ride/}).click();
      await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus!=="docked",
        null,{timeout:15000});
    }],
  ]){
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    await enter(page);
    await launch(page,name);
    await check(page);
    assert.equal(await page.getByRole("navigation",{name:"World movement and sports"}).isVisible(),false,
      "Active minigames must not expose competing activity switches");
    observations.push({sport:name,game:await page.locator("[data-world-game]").getAttribute("data-world-game")});
    await page.screenshot({path:path.join(out,name.toLowerCase().replaceAll(" ","-")+".png")});
    await page.close();
  }
  const mobile=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  await enter(mobile);
  const mobileDock=mobile.getByRole("navigation",{name:"World movement and sports"});
  const box=await mobileDock.boundingBox();
  assert.ok(box&&box.x>=0&&box.x+box.width<=376,"Mobile dock must fit the viewport");
  assert.equal(await mobileDock.getAttribute("data-mobile-open"),"false");
  assert.equal(await mobileDock.getByRole("button",{name:"Show sport shortcuts"}).isVisible(),false);
  await mobileDock.getByRole("button",{name:"Expand island controls"}).tap();
  assert.equal(await mobileDock.getAttribute("data-mobile-open"),"true");
  await mobileDock.getByRole("button",{name:"Show sport shortcuts"}).tap();
  const expanded=await mobileDock.boundingBox();
  assert.ok(expanded&&expanded.height<=400,"Expanded mobile hub must be bounded and scrollable");
  assert.equal(await mobileDock.getByRole("group",{name:"Sport shortcuts"}).getByRole("button").count(),5);
  await mobile.screenshot({path:path.join(out,"03-mobile-expanded.png")});
  await mobileDock.getByRole("button",{name:"Hide sport shortcuts"}).tap();
  await mobileDock.getByRole("button",{name:"Collapse island controls"}).tap();
  assert.equal(await mobileDock.getAttribute("data-mobile-open"),"false");
  await mobile.screenshot({path:path.join(out,"04-mobile-collapsed.png")});
  assert.deepEqual(errors,[],"No browser or renderer errors during sport shortcuts");
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({dimensions,observations,errors},null,2)+"\n");
  console.log("SPORT HUB BROWSER PASS",JSON.stringify({dimensions,observations}));
}finally{await browser.close();}
