import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/photos/map-location-links";
fs.mkdirSync(out,{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});

const mapQuery=async link=>{
  const url=new URL(await link.getAttribute("href"));
  assert.equal(url.hostname,"www.google.com");
  assert.equal(url.pathname,"/maps/search/");
  assert.equal(url.searchParams.get("api"),"1");
  const query=url.searchParams.get("query");
  assert.ok(query && query.length>4);
  assert.equal(await link.getAttribute("target"),"_blank");
  assert.match(await link.getAttribute("rel"),/noopener/);
  return query;
};

try {
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`${base}/photography`);
    const stills=page.getByRole("region",{name:"Selected personal photography"});
    await stills.waitFor({state:"visible",timeout:45000});
    const thumbnails=stills.getByRole("button",{name:/Open image \d+ of 49/});
    await page.waitForFunction(()=>document.querySelectorAll(".visual-archive-card").length===49,
      null,{timeout:20000});
    assert.equal(await thumbnails.count(),49);
    const maps=stills.getByRole("link",{name:/View .* on Google Maps/});
    assert.equal(await maps.count(),49);
    for(const link of await maps.all())await mapQuery(link);
    assert.equal(await page.getByText(/\b(20\d\d|19\d\d)\b/).count(),0,
      "Capture years are never inferred on the public photo gallery");
    if(width===1440)await page.screenshot({path:path.join(out,"desktop-gallery.png"),fullPage:false});
    for(const [index,expected] of [[28,/Kualoa Regional Park/i],[29,/Moorea/i],[39,/Hidden Garden Steps/i],[3,/Death Valley/i]]){
      await stills.getByRole("button",{name:`Open image ${index} of 49`}).click();
      const modal=page.getByRole("dialog",{name:"Visual Cortex image viewer"});
      await modal.waitFor({state:"visible",timeout:10000});
      const map=modal.getByRole("link",{name:/Open .* on Google Maps/});
      const query=await mapQuery(map);
      assert.match(query,expected,`Photo ${index} map label`);
      if(index===3)assert.equal(await modal.getByText(/Approximate location/).isVisible(),true);
      if(index===29)await page.screenshot({path:path.join(out,width===1440?"desktop-moorea.png":"mobile-moorea.png")});
      await modal.getByRole("button",{name:"Close image viewer"}).click();
      assert.equal(await modal.count(),0);
    }
    await page.close();
  }
  assert.deepEqual(errors,[],"No browser rendering errors");
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({photos:49,viewports:[1440,390],errors},null,2)+"\n");
  console.log("VISUAL ARCHIVE LOCATION LINKS PASS (49 images, desktop + mobile)");
} finally {
  await browser.close();
}
