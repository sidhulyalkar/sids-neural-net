import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/hidden-gallery";
fs.mkdirSync(out,{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const report={routes:[],screenshots:[],errors};
try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/?gallery=photos",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>{
    const canvas=document.querySelector("canvas[data-hidden-gallery-phase='inside']");
    return !!canvas && canvas.dataset.hiddenGalleryLocomotion==="walking" &&
      canvas.dataset.hiddenGalleryInBounds==="true";
  },null,{timeout:90000});
  const scene=page.locator("canvas[data-hidden-gallery-phase='inside']");
  assert.equal(await scene.getAttribute("data-hidden-gallery-photos"),"49");
  assert.equal(await scene.getAttribute("data-hidden-gallery-locomotion"),"walking");
  const initial=await scene.getAttribute("data-player");
  await page.screenshot({path:path.join(out,"gallery-start.png")});
  await page.keyboard.down("w");
  await page.waitForTimeout(850);
  await page.keyboard.up("w");
  await page.waitForTimeout(600);
  assert.equal(await scene.getAttribute("data-hidden-gallery-phase"),"inside");
  assert.equal(await scene.getAttribute("data-hidden-gallery-in-bounds"),"true");
  const moved=await scene.getAttribute("data-player");
  assert.notEqual(moved,initial,"Walking must move the actual player");
  await page.screenshot({path:path.join(out,"gallery-walking.png")});
  report.routes.push({route:"/?gallery=photos",phase:"inside",locomotion:"walking",moved:true});
  await page.goto(base+"/photography?photo=photo-021",{waitUntil:"domcontentloaded"});
  const viewer=page.getByRole("dialog",{name:"Visual Cortex image viewer"});
  await viewer.waitFor({state:"visible",timeout:60000});
  assert.ok(await viewer.locator("img[src*='photo-021']").count()>0);
  await page.screenshot({path:path.join(out,"photo-deep-link.png")});
  await viewer.getByRole("button",{name:"Close image viewer"}).click();
  const worldPhotoLink=page.getByRole("link",{name:/Walk through the hidden photography gallery/});
  assert.equal(await worldPhotoLink.getAttribute("href"),"/?gallery=photos");
  report.routes.push({route:"/photography?photo=photo-021",viewer:true,worldBacklink:true});
  await page.goto(base+"/publications",{waitUntil:"domcontentloaded"});
  const worldPaperLink=page.getByRole("link",{name:/Enter the hidden waterfall research museum/});
  await worldPaperLink.waitFor({state:"visible",timeout:90000});
  assert.equal(await worldPaperLink.getAttribute("href"),"/?gallery=papers");
  await worldPaperLink.click();
  await page.waitForFunction(()=>{
    const c=document.querySelector("canvas[data-cave-layer='paper']");
    return !!c&&c.dataset.paperGalleryCount==="8";
  },null,{timeout:90000});
  await page.screenshot({path:path.join(out,"paper-gallery.png")});
  report.routes.push({route:"/?gallery=papers",museum:"paper",papers:8});
  report.screenshots=["gallery-start.png","gallery-walking.png","photo-deep-link.png","paper-gallery.png"];
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
  console.log("GALLERY WALK / PHOTO DEEP LINK / PAPER MUSEUM BROWSER QA PASS");
  await page.close();
}finally{await browser.close();}
