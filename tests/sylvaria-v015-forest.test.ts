import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const forest=read('public/game-runtimes/mosslight-v2/v015/forest-world-v015.js');
const css=read('public/game-runtimes/mosslight-v2/sylvaria-forest-v015.css');
const html=read('public/game-runtimes/mosslight-v2/index.html');

test('Sylvaria v0.15 is explicitly a dark forest rather than a pond reskin',()=>{
  for(const id of['mist-pine','oak-hollow','cedar-gloom','burnscar','ancient-grove'])assert.match(forest,new RegExp(id));
  assert.match(html,/01 \/ forest/);
  assert.match(html,/Whispering Pine Verge/);
  assert.match(html,/canopy/);
  assert.doesNotMatch(html,/Kinetic Pond|01 \/ pond|<b>lilies<\/b>|hold \/ release dash/);
  assert.match(css,/--sylvaria-deep/);
});

test('biomes replace inherited pond terrain with forest-floor equivalents',()=>{
  assert.match(forest,/p\.type==='water'\|\|p\.type==='ice'/);
  assert.match(forest,/\?'bramble':'grass'/);
  assert.match(forest,/p\.type==='sand'\|\|p\.type==='shards'/);
  assert.match(forest,/\?'bramble':'mud'/);
});

test('dense understory is deterministic and substantially populated',()=>{
  assert.match(forest,/brush:11/);
  assert.match(forest,/brush:12/);
  assert.match(forest,/brush:13/);
  assert.match(forest,/20\+Math\.floor\(r\/3\.5\)/);
  assert.match(forest,/rngFrom\(hash\(`v015-forest-/);
  assert.doesNotMatch(forest,/Math\.random/);
});

test('Cutstep-cleared visibility regrows into fog',()=>{
  assert.match(forest,/v015RegrowAt>0&&state\.roomTime>=f\.v015RegrowAt/);
  assert.match(forest,/f\.cut=false;f\.v015RegrowAt=0;regrown\+\+/);
  assert.match(forest,/function brushRatio/);
  assert.match(forest,/drawBrushFog/);
  assert.match(forest,/uncutFoliage/);
  assert.match(forest,/cutFoliage/);
});

test('forest structure has biome-specific tree silhouettes',()=>{
  assert.match(forest,/function drawPine/);
  assert.match(forest,/function drawOak/);
  assert.match(forest,/function drawBurned/);
  assert.match(forest,/activeBiome\.id==='mist-pine'/);
  assert.match(forest,/activeBiome\.id==='cedar-gloom'/);
  assert.match(forest,/activeBiome\.id==='burnscar'/);
  assert.match(forest,/activeBiome\.id==='ancient-grove'/);
});

test('combatants and discoveries use opposing light languages through the mist',()=>{
  assert.match(forest,/Clearcut Hand/);
  assert.match(forest,/Nailgun Logger/);
  assert.match(forest,/Feller Mech/);
  assert.match(forest,/Root Mulcher/);
  assert.match(forest,/rgba\(240,145,78,\.22\)/);
  assert.match(forest,/rgba\(225,255,174,\.5\)/);
});

test('forest world remains deterministic and presentation-only where appropriate',()=>{
  assert.match(forest,/rngFrom/);
  assert.match(forest,/state\.terrainCacheDirty=true/);
  assert.doesNotMatch(forest,/Date\.now|performance\.now|setTimeout|setInterval|Math\.random/);
});
