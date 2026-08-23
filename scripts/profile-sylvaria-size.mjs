import fs from'node:fs';
import path from'node:path';
import{gzipSync,brotliCompressSync,constants as z}from'node:zlib';

const root=process.cwd(),artifactDir=path.join(root,'artifacts','sylvaria-size');fs.mkdirSync(artifactDir,{recursive:true});
const runtimeRoot='public/game-runtimes/sylvaria-v3';
const runtimeFiles=[
  `${runtimeRoot}/index.html`,
  `${runtimeRoot}/sylvaria-v3.css`,
  `${runtimeRoot}/config-v3.js`,
  `${runtimeRoot}/input-v3.js`,
  `${runtimeRoot}/world-v3.js`,
  `${runtimeRoot}/engine-v3.js`,
  `${runtimeRoot}/engine-feel-v3.js`,
  `${runtimeRoot}/engine-sapline-v3.js`,
  `${runtimeRoot}/render-v3.js`,
  `${runtimeRoot}/render-motion-v3.js`,
  `${runtimeRoot}/game-v3.js`,
];
function profile(files){const rows=files.map(file=>{const data=fs.readFileSync(path.join(root,file));return{file,raw:data.length,gzip:gzipSync(data,{level:9}).length,brotli:brotliCompressSync(data,{params:{[z.BROTLI_PARAM_QUALITY]:11}}).length}}),joined=Buffer.concat(files.map(file=>fs.readFileSync(path.join(root,file))));return{rows,aggregate:{raw:joined.length,gzip:gzipSync(joined,{level:9}).length,brotli:brotliCompressSync(joined,{params:{[z.BROTLI_PARAM_QUALITY]:11}}).length}}}
const runtime=profile(runtimeFiles),report={presentationVersion:'3.1.0-alpha.1',engineVersion:'3.1.0-alpha.1',generatedAt:new Date().toISOString(),note:'Measures the complete public Sylvaria ancient-tree ascent runtime: deterministic 120 Hz movement, momentum-preserving air control, Bark Grip, vines, branch physics, Sapline elastic tethering, contextual directional machete counters, enemies, Crown Feller boss, motion-first character rendering and persistent custom controls. Historical top-down runtimes are intentionally excluded because they are not part of the current public launch.',runtime};
fs.writeFileSync(path.join(artifactDir,'report.json'),JSON.stringify(report,null,2));console.log('Sylvaria v3.1 ancient-tree ascent runtime size profile');console.table(runtime.rows.map(row=>({file:row.file.replace(`${runtimeRoot}/`,''),raw:row.raw,gzip:row.gzip,brotli:row.brotli})));console.log(`Playable runtime aggregate: raw ${runtime.aggregate.raw} B · gzip ${runtime.aggregate.gzip} B · brotli ${runtime.aggregate.brotli} B`);
