// Run with Next dev and the same Playwright installation as ski presentation QA.
import {createRequire} from "node:module";
import path from "node:path";
import {mkdir} from "node:fs/promises";
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,"package.json"))("playwright");
const dir=process.env.WORLD_AUDIT_DIR??"artifacts/five-carve";
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
try{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 for(const tick of [120,676,706,736,830]){
  await page.goto(new URL("/dev/ski-lab?five-carve&capture-tick="+tick,process.env.WORLD_BASE_URL??"http://localhost:3000").href);
  await page.locator('canvas[data-capture-tick="'+tick+'"]').waitFor({timeout:120000});
  await page.screenshot({path:path.join(dir,"chase-"+tick+".png")});
 }
}finally{await browser.close();}
