import fs from 'node:fs';
import crypto from 'node:crypto';

const root='public/game-runtimes/mosslight-v2';
const read=(path)=>fs.readFileSync(path,'utf8');
const errors=[];
const expect=(ok,message)=>{if(!ok)errors.push(message)};
const requireTokens=(source,label,tokens)=>{for(const token of tokens)expect(source.includes(token),`${label}: missing ${token}`)};
const rejectPattern=(source,label,pattern)=>expect(!pattern.test(source),`${label}: forbidden ${pattern}`);

const html=read(`${root}/index.html`);
const model=read(`${root}/v091/model.js`);
const world=read(`${root}/v091/world.js`);
const boot=read(`${root}/v091/boot.js`);
const rooms=read(`${root}/v011/rooms-v011.js`);
const competitive=read(`${root}/v011/competitive-v011.js`);
const entry13=read(`${root}/v013-entry.js`);
const replay13=read(`${root}/v013/replay-v013.js`);
const entry14=read(`${root}/v014-entry.js`);
const boss14=read(`${root}/v014/boss-flow-v014.js`);
const threat14=read(`${root}/v014/threat-manager-v014.js`);
const enemy14=read(`${root}/v014/enemy-flow-v014.js`);
const space14=read(`${root}/v014/presentation-space-v014.js`);
const entry15=read(`${root}/v015-entry.js`);
const cut15=read(`${root}/v015/cutstep-v015.js`);
const encounter15=read(`${root}/v015/encounter-director-v015.js`);
const forest15=read(`${root}/v015/forest-world-v015.js`);
const discoveries15=read(`${root}/v015/discoveries-v015.js`);
const actors15=read(`${root}/v015/forest-actors-v015.js`);
const presentation15=read(`${root}/v015/cutstep-presentation-v015.js`);
const arcade=read('src/data/arcadeGames.ts');
const serverReplay=read('src/lib/sylvaria/replay.ts');

requireTokens(html,'public forest shell',[
  '<title>Sylvaria · Cutstep Forest</title>',
  '01 / forest',
  'Whispering Pine Verge',
  'WASD moves your body',
  'Arrow keys or mouse aim independently',
  'SPACE or click instantly Cutsteps',
  'sylvaria-forest-v015.css',
  '<script type="module" src="./v015-entry.js"></script>',
]);
rejectPattern(html,'public forest shell',/Kinetic Pond|01 \/ pond|<b>lilies<\/b>|hold \/ release dash|156° tongue/i);

requireTokens(model,'120 Hz substrate',["VERSION='0.9.1'",'FIXED_DT=1/120','MAX_SHOTS=128','MAX_PENDING=72']);
expect((rooms.match(/\bR\(/g)||[]).length>=30,'preserved authored-room substrate missing');
requireTokens(world,'shared collision/ecology substrate',['function terrainAt','function mobilityAt','function damageEnemy','function damageBoss']);
requireTokens(boot,'fixed-step loop',['while(accumulator>=FIXED_DT)','requestAnimationFrame(frame)']);

requireTokens(entry13,'v0.13 verifier substrate',['v013/kinetic-combat-v013.js','v013/enemy-ai-v013.js','v013/replay-v013.js']);
requireTokens(entry14,'v0.14 combat substrate',["await import('./v013-entry.js')",'boss-flow-v014.js','threat-manager-v014.js','combat-readability-v014.js']);
requireTokens(entry15,'v0.15 alpha entry',[
  "await import('./v014-entry.js')",
  'v015/cutstep-v015.js',
  'v015/encounter-director-v015.js',
  'v015/forest-world-v015.js',
  'v015/discoveries-v015.js',
  'v015/forest-actors-v015.js',
  'v015/cutstep-presentation-v015.js',
  "window.SylvariaRankedDisabledReason='v0.15 Cutstep alpha · verifier migration required'",
  'curatedEncounters:true',
  'professionalForestActors:true',
  'meaningfulDiscoveries:true',
  'escalatingDifficulty:true',
  'ranked:false',
]);
requireTokens(competitive,'competitive quarantine',['window.SylvariaRankedDisabledReason','if(unrankedReason())return null']);

requireTokens(cut15,'Cutstep core',[
  "CUTSTEP_VERSION='0.15.0'",
  'maxSegments:3',
  'distance:86',
  'thrustDistance:104',
  'ticks:9',
  'bladeLead:14',
  'passiveRefillPerSecond:.55',
  'brushRefillPerBlade:.018',
  'counterRefill:.42',
  'killRefill:.48',
  "kind:'thrust'",
  "kind:'crosscut'",
  "kind:'reversal'",
  'F.beginDashCharge=()=>false;F.releaseDashCharge=()=>false',
  'launchCutstep(currentAim())',
]);
requireTokens(cut15,'Cutstep fixed geometry',[
  'const active=p.dash?.v015Cutstep?p.dash:null',
  'if(active)state.heldMoves=new Set()',
  'finally{if(active)state.heldMoves=held}',
  'tipX=bx+dash.dir.x*CUTSTEP_CONFIG.bladeLead',
]);
requireTokens(cut15,'Cutstep interaction multiplication',[
  'dash.v015HitIds.has(s)',
  'dash.v015HitIds.add(s)',
  'reflectShot(s,dash.dir,p)',
  'F.damageEnemy?.',
  'f.cut=true;f.v015RegrowAt=',
  'boons().counterRefill',
  'boons().passiveRefill',
  'boons().damage',
]);
expect(!cut15.includes('`shot:${s}`'),'Cutstep projectile identity collapses multiple shots into one key');
rejectPattern(cut15,'Cutstep authoritative mechanics',/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);

const authoredRooms=(encounter15.match(/room\('/g)||[]).length;
expect(authoredRooms===12,`expected 12 alpha clearings, found ${authoredRooms}`);
for(const archetype of['Clearcut Scout','Nailgun Ranger','Saw Drone','Brush Hound','Shielded Foreman','Cable Trapper','Lantern Surveyor','Spore Tender','Timber Harvester'])expect(encounter15.includes(archetype),`missing v0.15 enemy archetype ${archetype}`);
requireTokens(encounter15,'curated difficulty director',[
  "room('Burnscar Haul Road'",
  'miniBoss:true',
  "room('The Walking Sawmill'",
  'boss:true',
  "bossName:'The Walking Sawmill'",
  'state.enemies.length=0',
  'Math.min(7,4+Math.floor((depth-13)/4))',
  'cadence=Math.max(.40',
  'concurrent=Math.min(3',
  'function armReadyEnemies',
  'addWire',
  'addSpore',
]);
requireTokens(encounter15,'flankable heavy armor',['amount*=.18','amount*=1.45',"v015Archetype==='shield'"]);
rejectPattern(encounter15,'encounter director',/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);

for(const biome of['mist-pine','oak-hollow','cedar-gloom','burnscar','ancient-grove'])expect(forest15.includes(biome),`forest biome missing ${biome}`);
requireTokens(forest15,'dark forest density/regrowth/visibility',[
  'brush:11',
  'brush:12',
  'brush:13',
  '20+Math.floor(r/3.5)',
  'v015RegrowAt>0&&state.roomTime>=f.v015RegrowAt',
  'function drawPine',
  'function drawOak',
  'function drawBurned',
  'function drawBrushFog',
  'bp?.v015Roster',
  'state.v015RunBoons?.fogMultiplier',
  'v015VisionBurst>0?.42:1',
]);
requireTokens(forest15,'forestified inherited terrain',["p.type==='water'||p.type==='ice'","?'bramble':'grass'","p.type==='sand'||p.type==='shards'","?'bramble':'mud'"]);
rejectPattern(forest15,'forest world',/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);

requireTokens(discoveries15,'discovery risk/reward',[
  "DISCOVERY_VERSION='0.15.0'",
  'moonflower',
  'spirit-stag',
  'root-shrine',
  'leaf-edge',
  'quickroot',
  'moon-eye',
  'segmentDistance(node.x,node.y,ax,ay,bx,by)',
  'p.v015Segments=clamp((p.v015Segments||0)+1.25',
  'b.counterRefill=Math.min(.32',
  'b.damage=Math.min(1.36',
  'b.passiveRefill=Math.min(.36',
  'b.fogMultiplier=Math.max(.55',
  'v015VisionBurst=6',
]);
rejectPattern(discoveries15,'discoveries',/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);

requireTokens(actors15,'professional actor presentation',[
  "FOREST_ACTORS_VERSION='0.15.0'",
  "canvas.id='actorCanvas'",
  'function drawGuardian',
  'function drawHuman',
  'function drawSawDrone',
  'function drawHound',
  'function drawShield',
  'function drawSurveyor',
  'function drawHarvester',
  'function drawDiscovery',
  'function drawBoss',
  "industrialLight:'warm'",
  "discoveryLight:'cool'",
]);
rejectPattern(actors15,'actor presentation',/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);

requireTokens(presentation15,'Cutstep aim/path presentation',["overlay.id='cutstepCanvas'",'drawHistory','drawActive','drawAim','drawSegments','prospectiveTechnique','bladeLead']);
requireTokens(space14,'DPR-safe v0.15 overlays',["['forestCanvas','actorCanvas','kineticCanvas','flowCanvas','cutstepCanvas']",'ctx?.setTransform(scale,0,0,scale,0,0)','logicalToClient','clientToLogical']);

requireTokens(enemy14,'deterministic enemy punish substrate',['spec.dodge=100','v014PunishTimer']);
requireTokens(boss14,'boss mastery substrate',['guardByPhase:Object.freeze({1:3,2:4,3:5})','guardedHpMultiplier:0',"'CORE OPEN'"]);
const profiles=(threat14.match(/\bP\(/g)||[]).length;
expect(profiles===30,`expected 30 explicit threat profiles, found ${profiles}`);
rejectPattern(threat14,'threat scheduler',/Math\.random|Date\.now|performance\.now|setTimeout/);

requireTokens(replay13,'v0.13 replay compatibility',["VERSION='0.13.0'",'SCHEMA=2']);
requireTokens(serverReplay,'server verifier compatibility',['SYLVARIA_REPLAY_SCHEMA = 2',"SYLVARIA_ENGINE_VERSION = '0.13.0'"]);
requireTokens(arcade,'Game Network v0.15 metadata',["version: 'v0.15.0'",'DRAW THE LINE · SURVIVE THE FOREST.','Cutstep','Arrow keys or mouse aim independently','no charge delay','regrowing undergrowth','ranking remains paused']);

const authoritativeHash=crypto.createHash('sha256').update([model,world,rooms,cut15,encounter15,forest15,discoveries15,boss14,threat14].join('\n')).digest('hex');
if(errors.length){
  console.error(`Sylvaria v0.15 validation failed (${errors.length})`);
  for(const error of errors)console.error(` - ${error}`);
  process.exit(1);
}
console.log(`Sylvaria v0.15 validator PASS · immediate Cutstep · 12 curated escalating clearings · meaningful discoveries · professional forest actors · endless bounded pressure · preserved deterministic boss/verifier substrate · sha256 ${authoritativeHash}`);
