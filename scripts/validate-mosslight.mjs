import fs from'node:fs';
import crypto from'node:crypto';
const root='public/game-runtimes/mosslight-v2',read=p=>fs.readFileSync(p,'utf8'),errors=[],expect=(ok,msg)=>{if(!ok)errors.push(msg)},has=(s,...xs)=>xs.every(x=>s.includes(x));
const html=read(`${root}/index.html`),model=read(`${root}/v091/model.js`),world=read(`${root}/v091/world.js`),boot=read(`${root}/v091/boot.js`),rooms=read(`${root}/v011/rooms-v011.js`),competitive=read(`${root}/v011/competitive-v011.js`),entry13=read(`${root}/v013-entry.js`),replay13=read(`${root}/v013/replay-v013.js`),entry14=read(`${root}/v014-entry.js`),boss14=read(`${root}/v014/boss-flow-v014.js`),threat14=read(`${root}/v014/threat-manager-v014.js`),enemy14=read(`${root}/v014/enemy-flow-v014.js`),space14=read(`${root}/v014/presentation-space-v014.js`),entry15=read(`${root}/v015-entry.js`),cut15=read(`${root}/v015/cutstep-v015.js`),encounter15=read(`${root}/v015/encounter-director-v015.js`),forest15=read(`${root}/v015/forest-world-v015.js`),discoveries15=read(`${root}/v015/discoveries-v015.js`),actors15=read(`${root}/v015/forest-actors-v015.js`),presentation15=read(`${root}/v015/cutstep-presentation-v015.js`),arcade=read('src/data/arcadeGames.ts'),serverReplay=read('src/lib/sylvaria/replay.ts');

expect(has(html,'<title>Sylvaria · Cutstep Forest</title>','01 / forest','Whispering Pine Verge','WASD moves your body','Arrow keys or mouse aim independently','SPACE or click instantly Cutsteps','sylvaria-forest-v015.css'),'v0.15 forest shell incomplete');
expect(html.includes('<script type="module" src="./v015-entry.js"></script>'),'production shell must boot v0.15');
expect(!/Kinetic Pond|01 \/ pond|<b>lilies<\/b>|hold \/ release dash|156° tongue/i.test(html),'retired pond/charged-dash vocabulary leaked into v0.15 shell');

expect(has(model,"VERSION='0.9.1'",'FIXED_DT=1/120','MAX_SHOTS=128','MAX_PENDING=72'),'120 Hz substrate changed');
expect((rooms.match(/\bR\(/g)||[]).length>=30,'preserved authored-room substrate missing');
expect(has(world,'function terrainAt','function mobilityAt','function damageEnemy','function damageBoss'),'shared collision/ecology substrate incomplete');
expect(has(boot,'while(accumulator>=FIXED_DT)','requestAnimationFrame(frame)'),'fixed-step loop changed');

expect(has(entry13,"v013/kinetic-combat-v013.js","v013/enemy-ai-v013.js","v013/replay-v013.js"),'v0.13 verifier substrate incomplete');
expect(has(entry14,"await import('./v013-entry.js')",'boss-flow-v014.js','threat-manager-v014.js','combat-readability-v014.js'),'v0.14 combat substrate incomplete');
expect(has(entry15,"await import('./v014-entry.js')",'v015/cutstep-v015.js','v015/encounter-director-v015.js','v015/forest-world-v015.js','v015/discoveries-v015.js','v015/forest-actors-v015.js','v015/cutstep-presentation-v015.js',"window.SylvariaRankedDisabledReason='v0.15 Cutstep alpha · verifier migration required'",'curatedEncounters:true','professionalForestActors:true','meaningfulDiscoveries:true','escalatingDifficulty:true','ranked:false'),'v0.15 alpha entry or ranking boundary incomplete');
expect(has(competitive,'window.SylvariaRankedDisabledReason','if(unrankedReason())return null'),'competitive client ignores changed-engine quarantine');

expect(has(cut15,"CUTSTEP_VERSION='0.15.0'",'maxSegments:3','distance:86','thrustDistance:104','ticks:9','bladeLead:14','passiveRefillPerSecond:.55','brushRefillPerBlade:.018','counterRefill:.42','killRefill:.48',"kind:'thrust'","kind:'crosscut'","kind:'reversal'",'F.beginDashCharge=()=>false;F.releaseDashCharge=()=>false','launchCutstep(currentAim())'),'Cutstep core contract incomplete');
expect(has(cut15,"const active=p.dash?.v015Cutstep?p.dash:null",'if(active)state.heldMoves=new Set()','finally{if(active)state.heldMoves=held}','tipX=bx+dash.dir.x*CUTSTEP_CONFIG.bladeLead'),'WASD or point-blank projectile timing can violate the aimed Cutstep line');
expect(has(cut15,'dash.v015HitIds.has(s)','dash.v015HitIds.add(s)','reflectShot(s,dash.dir,p)','F.damageEnemy?.','f.cut=true;f.v015RegrowAt=','boons().counterRefill','boons().passiveRefill','boons().damage'),'Cutstep line/economy does not multiply across projectiles enemies brush and discoveries');
expect(!cut15.includes('`shot:${s}`'),'Cutstep projectile identity collapses multiple shots into one key');
expect(!/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/.test(cut15),'Cutstep authoritative mechanics contain wall-clock/random APIs');

const authoredRooms=(encounter15.match(/room\('/g)||[]).length;expect(authoredRooms===12,`expected 12 alpha clearings, found ${authoredRooms}`);
for(const archetype of['Clearcut Scout','Nailgun Ranger','Saw Drone','Brush Hound','Shielded Foreman','Cable Trapper','Lantern Surveyor','Spore Tender','Timber Harvester'])expect(encounter15.includes(archetype),`missing v0.15 enemy archetype ${archetype}`);
expect(has(encounter15,"room('Burnscar Haul Road'",'miniBoss:true',"room('The Walking Sawmill'",'boss:true',"bossName:'The Walking Sawmill'",'state.enemies.length=0','Math.min(7,4+Math.floor((depth-13)/4))','cadence=Math.max(.40','concurrent=Math.min(3'),'function armReadyEnemies','addWire','addSpore'),'curated difficulty director incomplete');
expect(has(encounter15,'amount*=.18','amount*=1.45','v015Archetype===\'shield\''),'flankable heavy armor contract incomplete');
expect(!/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/.test(encounter15),'encounter director contains wall-clock/random combat scheduling');

for(const biome of['mist-pine','oak-hollow','cedar-gloom','burnscar','ancient-grove'])expect(forest15.includes(biome),`forest biome missing ${biome}`);
expect(has(forest15,'brush:11','brush:12','brush:13','20+Math.floor(r/3.5)','v015RegrowAt>0&&state.roomTime>=f.v015RegrowAt','function drawPine','function drawOak','function drawBurned','function drawBrushFog','bp?.v015Roster','state.v015RunBoons?.fogMultiplier','v015VisionBurst>0?.42:1'),'dark forest density/regrowth/visibility language incomplete');
expect(has(forest15,"p.type==='water'||p.type==='ice'","?'bramble':'grass'","p.type==='sand'||p.type==='shards'","?'bramble':'mud'"),'pond terrain is not forestified');
expect(!/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/.test(forest15),'forest world contains non-deterministic gameplay APIs');

expect(has(discoveries15,"DISCOVERY_VERSION='0.15.0'",'moonflower','spirit-stag','root-shrine','leaf-edge','quickroot','moon-eye','segmentDistance(node.x,node.y,ax,ay,bx,by)','p.v015Segments=clamp((p.v015Segments||0)+1.25','b.counterRefill=Math.min(.32','b.damage=Math.min(1.36','b.passiveRefill=Math.min(.36','b.fogMultiplier=Math.max(.55'),'v015VisionBurst=6'),'discovery risk/reward contract incomplete');
expect(!/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/.test(discoveries15),'discoveries contain non-deterministic gameplay APIs');
expect(has(actors15,"FOREST_ACTORS_VERSION='0.15.0'","canvas.id='actorCanvas'",'function drawGuardian','function drawHuman','function drawSawDrone','function drawHound','function drawShield','function drawSurveyor','function drawHarvester','function drawDiscovery','function drawBoss',"industrialLight:'warm'","discoveryLight:'cool'"),'professional actor presentation incomplete');
expect(!/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/.test(actors15),'actor presentation contains non-deterministic timing APIs');

expect(has(presentation15,"overlay.id='cutstepCanvas'",'drawHistory','drawActive','drawAim','drawSegments','prospectiveTechnique','bladeLead'),'Cutstep aim/path presentation incomplete');
expect(has(space14,"['forestCanvas','actorCanvas','kineticCanvas','flowCanvas','cutstepCanvas']",'ctx?.setTransform(scale,0,0,scale,0,0)','logicalToClient','clientToLogical'),'v0.15 overlays are not DPR-safe');

expect(has(enemy14,'spec.dodge=100','v014PunishTimer'),'deterministic enemy punish substrate damaged');
expect(has(boss14,'guardByPhase:Object.freeze({1:3,2:4,3:5})','guardedHpMultiplier:0',"'CORE OPEN'"),'boss mastery substrate damaged');
const profiles=(threat14.match(/\bP\(/g)||[]).length;expect(profiles===30,`expected 30 explicit threat profiles, found ${profiles}`);
expect(!/Math\.random|Date\.now|performance\.now|setTimeout/.test(threat14),'threat scheduler lost determinism');

expect(has(replay13,"VERSION='0.13.0'",'SCHEMA=2'),'v0.13 replay compatibility damaged');
expect(has(serverReplay,'SYLVARIA_REPLAY_SCHEMA = 2','SYLVARIA_ENGINE_VERSION = \'0.13.0\''),'server verifier changed without migration');
expect(has(arcade,"version: 'v0.15.0'",'DRAW THE LINE · SURVIVE THE FOREST.','Cutstep','Arrow keys or mouse aim independently','no charge delay','regrowing undergrowth','ranking remains paused'),'Game Network metadata does not describe v0.15 truthfully');

const authoritativeHash=crypto.createHash('sha256').update([model,world,rooms,cut15,encounter15,forest15,discoveries15,boss14,threat14].join('\n')).digest('hex');
if(errors.length){console.error(`Sylvaria v0.15 validation failed (${errors.length})`);for(const e of errors)console.error(` - ${e}`);process.exit(1)}
console.log(`Sylvaria v0.15 validator PASS · immediate Cutstep · 12 curated escalating clearings · meaningful discoveries · professional forest actors · endless bounded pressure · preserved deterministic boss/verifier substrate · sha256 ${authoritativeHash}`);
