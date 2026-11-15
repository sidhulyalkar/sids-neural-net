#!/usr/bin/env node
/** Install only the exact six vetted generated graffiti WebP textures.
 * The original murals stay active unless the entire archive passes checks.
 * Supports an extracted pack directory or its .zip, on a review branch.
 */
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, readFileSync, mkdirSync, mkdtempSync,
 copyFileSync, rmSync, writeFileSync, statSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join,dirname,sep} from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const input=process.argv.find((v,i)=>i>=2&&!v.startsWith("--"));
const dryRun=process.argv.includes("--dry-run");
const replace=process.argv.includes("--replace");
/** The manifest is descriptive, not proof of what the binary decoder will see.
 * WebP's VP8X header stores real width/height (minus one) and alpha flag.
 * This pipeline requires VP8X because every source has feathered alpha.
 */
function inspectWebp(bytes,name){
 if(bytes.length<30||bytes.toString("ascii",0,4)!=="RIFF"||
    bytes.toString("ascii",8,12)!=="WEBP"||
    bytes.readUInt32LE(4)+8!==bytes.length)
  throw Error("Corrupt WebP container: "+name);
 if(bytes.toString("ascii",12,16)!=="VP8X"||
    bytes.readUInt32LE(16)!==10)
  throw Error("Expected extended alpha WebP: "+name);
 const dimension=offset=>1+bytes[offset]+bytes[offset+1]*256+
   bytes[offset+2]*65536;
 const width=dimension(24),height=dimension(27);
 if(!(bytes[20]&16))throw Error("Generated wall art has no alpha channel: "+name);
 return {width,height};
}

if(!input){
 console.error("Usage: npm run arcade:install-murals -- /path/to/sids_arcade_generated_webgl_textures.zip [--dry-run] [--replace]");
 process.exitCode=2;
}else{
 let temporary=null;
 try{
  let base=resolve(input);
  if(!existsSync(base))throw Error("Artwork pack not found: "+base);
  if(statSync(base).isFile()){
   if(!base.toLowerCase().endsWith(".zip"))throw Error("Pass a .zip or extracted pack directory");
   const entries=spawnSync("unzip",["-Z1",base],{encoding:"utf8"});
   if(entries.status!==0)throw Error("unzip listing failed; install unzip or extract the pack first: "+(entries.stderr||""));
   for(const name of entries.stdout.trim().split(/\r?\n/)){
    const normalized=name.replaceAll("\\","/");
    if(normalized.startsWith("/")||normalized.startsWith("../")||normalized.includes("/../"))
     throw Error("Unsafe archive entry: "+name);
   }
   temporary=mkdtempSync(join(tmpdir(),"arcade-graffiti-"));
   const extracted=spawnSync("unzip",["-q",base,"-d",temporary],{encoding:"utf8"});
   if(extracted.status!==0)throw Error("Archive extraction failed: "+(extracted.stderr||""));
   base=temporary;
  }
  const manifestPath=join(base,"mural-textures.json");
  if(!existsSync(manifestPath))throw Error("Missing mural-textures.json in pack");
  const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
  const expected=new Set([
   "sports-fandom.webp","sports-fandom-mobile.webp",
   "anime-favorites.webp","anime-favorites-mobile.webp",
   "tv-comedy.webp","tv-comedy-mobile.webp",
  ]);
  if(!Array.isArray(manifest.items)||manifest.items.length!==6)
   throw Error("Expected six desktop/mobile generated mural assets");
  let totalDesktop=0,totalMobile=0;
  const verified=[];
  for(const item of manifest.items){
   const filename=item.path?.split("/").at(-1);
   const canonical="public/world/arcade-cavern/generated/"+filename;
   if(!filename||!expected.delete(filename)||item.file!==canonical||
       item.path!=="/world/arcade-cavern/generated/"+filename)
    throw Error("Unexpected or duplicate generated mural path: "+item.file);
   const source=resolve(base,canonical);
   if(!source.startsWith(resolve(base)+sep)||!existsSync(source))
    throw Error("Missing generated texture: "+canonical);
   const bytes=readFileSync(source);
   if(bytes.toString("ascii",0,4)!=="RIFF"||
       bytes.toString("ascii",8,12)!=="WEBP")
    throw Error("Not an actual WebP: "+canonical);
   const actual=inspectWebp(bytes,canonical);
   if(actual.width!==item.width||actual.height!==item.height)
    throw Error("Binary pixel dimensions disagree with manifest: "+canonical);
   const expectedVariant=filename.endsWith("-mobile.webp")?"mobile":"desktop";
   if(item.variant!==expectedVariant)throw Error("Variant mismatch: "+canonical);
   const digest=createHash("sha256").update(bytes).digest("hex");
   if(digest!==item.sha256||bytes.length!==item.bytes)
    throw Error("Checksum/size mismatch for "+canonical);
   if(!(item.width>=300&&item.width<=2048&&item.height>=80&&item.height<=768))
    throw Error("Unexpected texture dimensions: "+canonical);
   if(!(Math.abs(item.width/item.height-item.aspect_ratio)<.04))
    throw Error("Texture aspect mismatch: "+canonical);
   if(item.variant==="desktop")totalDesktop+=bytes.length;
   else if(item.variant==="mobile")totalMobile+=bytes.length;
   else throw Error("Unexpected texture variant: "+canonical);
   verified.push({source,destination:resolve(repoRoot,canonical),bytes:bytes.length,file:filename});
  }
  if(expected.size)throw Error("Pack missing expected textures: "+[...expected].join(", "));
  if(totalDesktop>800000||totalMobile>260000)
   throw Error("Generated graffiti art exceeds download budget");
  const flagPath=join(repoRoot,"lib/world/arcadeGeneratedMuralConfig.ts");
  const flagSource=readFileSync(flagPath,"utf8");
  if(!/export const GENERATED_MURAL_TEXTURES_BUNDLED = (true|false) as boolean;/.test(flagSource))
   throw Error("Mural-ready flag missing from current branch; checkout draft PR #185");
  for(const item of verified){
   if(!replace&&existsSync(item.destination)){
    const current=createHash("sha256").update(readFileSync(item.destination)).digest("hex");
    const candidate=createHash("sha256").update(readFileSync(item.source)).digest("hex");
    if(current!==candidate)throw Error("Existing texture differs; use --replace: "+item.file);
   }
  }
  if(!dryRun){
   for(const item of verified){
    mkdirSync(dirname(item.destination),{recursive:true});
    copyFileSync(item.source,item.destination);
   }
   const manifestTarget=join(repoRoot,"public/world/arcade-cavern/generated/mural-textures.json");
   writeFileSync(manifestTarget,JSON.stringify(manifest,null,2)+"\n");
   writeFileSync(flagPath,flagSource.replace(
    /export const GENERATED_MURAL_TEXTURES_BUNDLED = (?:true|false) as boolean;/,
    "export const GENERATED_MURAL_TEXTURES_BUNDLED = true as boolean;"));
  }
  console.log(JSON.stringify({
   status:dryRun?"verified_only":"installed_review_assets",
   desktopBytes:totalDesktop,mobileBytes:totalMobile,assets:verified.map(x=>x.file),
   next:"Run npm run typecheck && npm test && re-run the cavern screenshot CI; do not merge/deploy",
  },null,2));
 }catch(error){
  console.error("Generated mural install refused:",error instanceof Error?error.message:String(error));
  process.exitCode=1;
 }finally{
  if(temporary)rmSync(temporary,{recursive:true,force:true});
 }
}
