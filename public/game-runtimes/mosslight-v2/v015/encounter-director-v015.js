const G=window.Sylvaria091;
const {W,H,FIXED_DT,state,clamp,hash,rngFrom,entityRand}=G,F=G.fn;

export const ENCOUNTER_DIRECTOR_VERSION='0.15.0';

export const ARCHETYPES=Object.freeze({
  scout:Object.freeze({label:'Clearcut Scout',baseType:'feller',role:'engage',hp:2,r:15,speed:96,telegraph:.28,cooldown:1.05,reward:110}),
  nailgun:Object.freeze({label:'Nailgun Ranger',baseType:'foreman',role:'precision',hp:3,r:16,speed:68,telegraph:.38,cooldown:1.22,reward:145}),
  sawdrone:Object.freeze({label:'Saw Drone',baseType:'drone',role:'coverage',hp:3,r:15,speed:88,telegraph:.34,cooldown:1.16,reward:160}),
  hound:Object.freeze({label:'Brush Hound',baseType:'surveyor',role:'engage',hp:3,r:16,speed:116,telegraph:.25,cooldown:1.00,reward:170}),
  shield:Object.freeze({label:'Shielded Foreman',baseType:'skidder',role:'heavy',hp:7,r:23,speed:54,telegraph:.44,cooldown:1.35,reward:260}),
  trapper:Object.freeze({label:'Cable Trapper',baseType:'lobbyist',role:'control',hp:4,r:17,speed:62,telegraph:.42,cooldown:1.42,reward:205}),
  surveyor:Object.freeze({label:'Lantern Surveyor',baseType:'chair',role:'precision',hp:3,r:17,speed:60,telegraph:.50,cooldown:1.48,reward:220}),
  spore:Object.freeze({label:'Spore Tender',baseType:'broker',role:'control',hp:4,r:18,speed:58,telegraph:.52,cooldown:1.55,reward:225}),
  harvester:Object.freeze({label:'Timber Harvester',baseType:'mech',role:'heavy',hp:11,r:29,speed:44,telegraph:.58,cooldown:1.72,reward:430}),
});

const P={forest:['#07110d','#173325','#739278','#d7e0c2'],deep:['#06100f','#17372e','#76a58c','#cfe1ca'],cut:['#100c0a','#33291f','#a58968','#e2bd86']};
const T=(type,count,a,b)=>({type,count,r:[a,b]});
const room=(title,area,subtitle,trees,deadwood,roster,terrain,opts={})=>({title,area,subtitle,palette:P[area],trees,deadwood,enemies:[],dash:86,terrain,mushrooms:[],brittle:opts.brittle||0,secrets:opts.discovery?1:0,hint:opts.hint||'Read the next line.',v015Roster:roster,v015Discovery:opts.discovery||null,v015Cadence:opts.cadence||.9,v015Concurrent:opts.concurrent||1,v015Intensity:opts.intensity||1,v015MiniBoss:Boolean(opts.miniBoss),boss:Boolean(opts.boss),bossName:opts.bossName});

export const ALPHA_ROOMS=Object.freeze([
  room('Whispering Pine Verge','forest','learn the line · scout + nailgun',6,4,['scout','nailgun'],[T('grass',2,42,56)],{discovery:'moonflower',cadence:1.02,intensity:.88,hint:'Cut the nail back, then cross the scout’s recovery.'}),
  room('Needle-Mist Crossing','forest','moving lane · saw pressure',7,5,['scout','nailgun','sawdrone'],[T('grass',3,40,58)],{discovery:'spirit-stag',cadence:.94,intensity:.95,hint:'The drone bends your route. Do not chase it through the scout.'}),
  room('Old Oak Trapline','forest','control · lunge + cable',8,6,['hound','nailgun','trapper'],[T('grass',3,42,60),T('mud',1,46,58)],{discovery:'root-shrine',cadence:.88,intensity:1.0,hint:'Make the hound cross the cable lane you refuse to use.'}),
  room('Rootvault Clearing','forest','armor · learn the flank',8,6,['shield','nailgun','scout'],[T('grass',4,38,56)],{discovery:'moonflower',cadence:.84,intensity:1.06,hint:'Front armor wastes your line. Reposition, then Cutstep through the rear quarter.'}),
  room('Cedar Veil','deep','crossfire · visibility debt',9,7,['sawdrone','nailgun','trapper','surveyor'],[T('grass',4,42,62),T('mud',1,46,60)],{discovery:'spirit-stag',cadence:.76,concurrent:2,intensity:1.12,hint:'Carve only enough fog to see the survey beam and the next safe landing.'}),
  room('Burnscar Haul Road','cut','miniboss · first machinery wall',8,8,['harvester','scout','nailgun'],[T('bramble',2,36,48),T('grass',2,38,50)],{discovery:'root-shrine',cadence:.72,concurrent:2,intensity:1.18,miniBoss:true,hint:'Use returned nails on the Harvester while the scout is committed elsewhere.'}),
  room('Fogbound Logging Road','deep','priority · pressure support',10,8,['hound','shield','nailgun','surveyor'],[T('grass',5,40,60),T('mud',2,46,60)],{discovery:'moonflower',cadence:.68,concurrent:2,intensity:1.25,hint:'Remove the Surveyor before its fast lane turns the shield into a wall.'}),
  room('Blackpine Snareworks','deep','route denial · layered pursuit',10,9,['trapper','trapper','hound','sawdrone','nailgun'],[T('grass',5,42,62),T('bramble',1,34,46)],{discovery:'spirit-stag',cadence:.64,concurrent:2,intensity:1.31,hint:'You cannot keep every route. Cut one cable lane open and own it.'}),
  room('Old Growth Siege','deep','toxic control · heavy pressure',11,9,['shield','spore','surveyor','nailgun','harvester'],[T('grass',5,40,60),T('mud',2,46,62)],{discovery:'root-shrine',cadence:.60,concurrent:2,intensity:1.38,hint:'Spore zones remove resting space. Move before the Harvester decides for you.'}),
  room('Cinder Machinery Yard','cut','industrial crossfire',10,10,['harvester','sawdrone','trapper','nailgun','spore'],[T('bramble',3,34,48),T('grass',2,36,50)],{discovery:'moonflower',cadence:.56,concurrent:3,intensity:1.46,hint:'Break the trapper first or every saw line becomes a forced route.'}),
  room('Heartwood Breach','deep','mastery check · full role mix',12,10,['shield','hound','nailgun','surveyor','harvester','spore'],[T('grass',6,40,62),T('bramble',2,34,46)],{discovery:'spirit-stag',cadence:.52,concurrent:3,intensity:1.56,hint:'Read priority, not proximity. One wrong target lets three roles overlap.'}),
  room('The Walking Sawmill','cut','boss · carve the machine apart',12,12,['nailgun','trapper'],[T('bramble',3,34,48),T('grass',3,38,54)],{discovery:'root-shrine',cadence:.48,concurrent:3,intensity:1.68,boss:true,bossName:'The Walking Sawmill',hint:'Return its fire, cut support lanes, break guard, then spend a segment on the core.'}),
]);

function endlessRoster(depth){
  const pool=['scout','nailgun','sawdrone','hound','shield','trapper','surveyor','spore','harvester'];
  const count=Math.min(7,4+Math.floor((depth-13)/4));
  const out=[];for(let i=0;i<count;i++)out.push(pool[(depth*3+i*5+Math.floor(depth/3))%pool.length]);
  if(depth%3===0&&!out.includes('nailgun'))out[0]='nailgun';
  if(depth%4===0&&!out.includes('shield'))out[out.length-1]='shield';
  if(depth%5===0&&!out.includes('harvester'))out[Math.max(0,out.length-2)]='harvester';
  return out;
}
function endlessRoom(depth){
  const cycle=(depth-13)%5,area=cycle===3?'cut':cycle===1||cycle===2?'deep':'forest',intensity=Math.min(2.15,1.68+(depth-12)*.035),cadence=Math.max(.40,.48-(depth-12)*.004),concurrent=Math.min(3,2+Math.floor((depth-11)/8));
  return room(`Sylvarian Depth ${depth}`,area,depth%10===0?'endless boss pressure':'endless survival pressure',Math.min(14,10+Math.floor(depth/6)),Math.min(14,9+Math.floor(depth/7)),endlessRoster(depth),[T('grass',Math.min(7,4+Math.floor(depth/10)),38,62),T(area==='cut'?'bramble':'mud',2,34,54)],{discovery:depth%3===0?'root-shrine':depth%2===0?'spirit-stag':'moonflower',cadence,concurrent,intensity,boss:depth%10===0,bossName:depth%10===0?'Clearcut Colossus':undefined,hint:'The forest is no longer teaching. Preserve a line, choose priority, and keep earning movement.'});
}
const historicalBlueprint=G.roomBlueprint;
G.roomBlueprint=depth=>depth>=1&&depth<=ALPHA_ROOMS.length?ALPHA_ROOMS[depth-1]:depth>ALPHA_ROOMS.length?endlessRoom(depth):historicalBlueprint(depth);

const q=v=>Math.round(v*100000)/100000;
const norm=(x,y)=>{const m=Math.hypot(x,y)||1;return{x:q(x/m),y:q(y/m)}};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function rolePriority(role){return role==='precision'?0:role==='control'?1:role==='engage'?2:role==='coverage'?3:4}
function findSpawn(rng,r,index){
  for(let n=0;n<70;n++){const x=clamp(300+rng()*590,72,W-58),y=clamp(108+rng()*(H-170),94,H-48);if(F.positionClear(x,y,r)&&distance({x,y},state.player)>185&&state.enemies.every(e=>e.dead||Math.hypot(e.x-x,e.y-y)>e.r+r+22))return{x,y}}
  return{x:W-125-(index%2)*75,y:135+(index%6)*72};
}
function spawnEnemy(kind,index,rng,intensity){
  const s=ARCHETYPES[kind],p=findSpawn(rng,s.r,index),hp=Math.ceil(s.hp*(.92+intensity*.13));
  const e={id:`v015-${kind}-${state.worldDepth}-${index}`,type:s.baseType,v015Enemy:true,v015Archetype:kind,v015Name:s.label,v015Role:s.role,x:p.x,y:p.y,r:s.r,hp,maxHp:hp,dead:false,angle:rng()*Math.PI*2,facingAngle:Math.PI,phase:rng()*Math.PI*2,mode:'move',cooldown:.35+rng()*.5,telegraph:0,intent:null,velocity:{x:0,y:0},lunge:0,hitFlash:0,recoil:0,attackCount:0,contactCooldown:0,reward:Math.round(s.reward*intensity),rngState:hash(`v015:${state.worldDepth}:${kind}:${index}`)};
  state.enemies.push(e);return e;
}
function spawnShot(e,target,{speed=430,kind='nail',spread=0,pattern='straight',damage=1}={}){
  if(state.shots.length>=G.MAX_SHOTS)return;const n=norm(target.x-e.x,target.y-e.y),c=Math.cos(spread),s=Math.sin(spread),dx=n.x*c-n.y*s,dy=n.x*s+n.y*c;
  state.shots.push({x:e.x+dx*(e.r+6),y:e.y+dy*(e.r+6),vx:q(dx*speed),vy:q(dy*speed),r:kind==='saw'?8:kind==='survey'?7:6,life:4.5,kind,color:kind==='survey'?'#f6c06b':kind==='saw'?'#ff9e64':'#ffd08a',friendly:false,owner:e,originalOwnerId:e.id,damage,dead:false,spin:0,grazed:false,age:0,pattern,baseSpeed:speed,patternPhase:e.phase,patternAmp:kind==='saw'?72:0,patternFreq:kind==='saw'?8.4:0,turnRate:.5,turnAt:.3,turnAngle:0,turned:false,beneficiaryId:null,trail:[],counterQuality:null,counterTargetId:null,reflectedTravel:0,hitIds:new Set(),pierces:0,v013Scaled:true});
}
function moveToward(e,target,speed,dt){
  const n=norm(target.x-e.x,target.y-e.y),nx=clamp(q(e.x+n.x*speed*dt),35,W-35),ny=clamp(q(e.y+n.y*speed*dt),90,H-36);if(F.positionClear(nx,e.y,e.r))e.x=nx;if(F.positionClear(e.x,ny,e.r))e.y=ny;e.facingAngle=Math.atan2(state.player.y-e.y,state.player.x-e.x);F.applyTerrainHazard?.(e,'enemy');
}
function keepRange(e,desired,speed,dt){const d=distance(e,state.player);if(d>desired+35)moveToward(e,state.player,speed,dt);else if(d<desired-40)moveToward(e,{x:e.x+(e.x-state.player.x),y:e.y+(e.y-state.player.y)},speed*.85,dt);else{const n=norm(state.player.x-e.x,state.player.y-e.y),side=Math.sin(e.phase+state.roomTime*1.2)>=0?1:-1;moveToward(e,{x:e.x-n.y*side*70,y:e.y+n.x*side*70},speed*.42,dt)}}
function addWire(e){
  let tree=null,best=Infinity;for(const t of state.trees){if(!t.alive)continue;const d=Math.hypot(t.x-e.x,t.y-e.y);if(d<best&&d<260){best=d;tree=t}}
  if(!tree)return;state.v015Wires.push({id:`wire-${e.id}-${e.attackCount}`,ax:e.x,ay:e.y,bx:tree.x,by:tree.y,life:5.2,cooldown:0,owner:e});F.addCallout?.((e.x+tree.x)/2,(e.y+tree.y)/2-10,'SNARE LINE','#f3a96b');
}
function addSpore(e){const p=state.player,n=norm(p.x-e.x,p.y-e.y),x=clamp(p.x+n.x*38,55,W-55),y=clamp(p.y+n.y*38,105,H-50);state.v015Spores.push({id:`spore-${e.id}-${e.attackCount}`,x,y,r:12,targetR:54,age:0,life:5.4,cooldown:0});F.addCallout?.(x,y-14,'SPORE BLOOM','#d6b673')}
function performAttack(e){
  const s=ARCHETYPES[e.v015Archetype],target=e.intent||{x:state.player.x,y:state.player.y};e.attackCount++;
  if(e.v015Archetype==='scout'){const n=norm(target.x-e.x,target.y-e.y);e.velocity={x:n.x*360,y:n.y*360};e.mode='lunge';e.lunge=.18}
  else if(e.v015Archetype==='hound'){const n=norm(target.x-e.x,target.y-e.y);e.velocity={x:n.x*470,y:n.y*470};e.mode='lunge';e.lunge=.22}
  else if(e.v015Archetype==='nailgun'){spawnShot(e,target,{speed:470,kind:'nail'});if(state.worldDepth>=7)spawnShot(e,target,{speed:445,kind:'nail',spread:e.attackCount%2?.075:-.075});e.mode='move'}
  else if(e.v015Archetype==='sawdrone'){spawnShot(e,target,{speed:360,kind:'saw',pattern:'wave'});e.mode='move'}
  else if(e.v015Archetype==='shield'){const n=norm(target.x-e.x,target.y-e.y);e.velocity={x:n.x*300,y:n.y*300};e.mode='lunge';e.lunge=.24}
  else if(e.v015Archetype==='trapper'){addWire(e);e.mode='move'}
  else if(e.v015Archetype==='surveyor'){spawnShot(e,target,{speed:590,kind:'survey'});e.mode='move'}
  else if(e.v015Archetype==='spore'){addSpore(e);e.mode='move'}
  else if(e.v015Archetype==='harvester'){for(const spread of[-.22,0,.22])spawnShot(e,target,{speed:390,kind:'saw',spread,pattern:spread===0?'straight':'wave'});e.mode='move'}
  e.intent=null;e.cooldown=s.cooldown/(state.v015Combat?.intensity||1);
}
function updateEnemy(e,dt){
  if(e.dead)return;const s=ARCHETYPES[e.v015Archetype],intensity=state.v015Combat?.intensity||1;if(e.hitFlash>0)e.hitFlash-=dt;if(e.contactCooldown>0)e.contactCooldown-=dt;if(e.cooldown>0)e.cooldown-=dt;
  if(e.mode==='telegraph'){e.telegraph-=dt;if(e.telegraph<=0)performAttack(e);return}
  if(e.mode==='lunge'){const nx=e.x+e.velocity.x*dt,ny=e.y+e.velocity.y*dt;if(F.positionClear(nx,ny,e.r)){e.x=q(nx);e.y=q(ny)}else e.lunge=0;e.lunge-=dt;e.facingAngle=Math.atan2(e.velocity.y,e.velocity.x);if(e.contactCooldown<=0&&distance(e,state.player)<e.r+state.player.r+4){F.damagePlayer?.(1,e);e.contactCooldown=.5}if(e.lunge<=0){e.mode='recover';e.cooldown=Math.max(e.cooldown,.32);e.velocity={x:0,y:0}}return}
  if(e.mode==='recover'){e.cooldown-=dt;if(e.cooldown<=0){e.mode='move';e.cooldown=.2}return}
  const speed=s.speed*Math.min(1.34,.9+intensity*.14);
  if(e.v015Archetype==='scout'||e.v015Archetype==='hound')moveToward(e,state.player,speed,dt);
  else if(e.v015Archetype==='shield'||e.v015Archetype==='harvester')keepRange(e,e.v015Archetype==='shield'?125:205,speed,dt);
  else if(e.v015Archetype==='sawdrone')keepRange(e,210,speed,dt);
  else keepRange(e,e.v015Archetype==='trapper'?250:285,speed,dt);
}
function armReadyEnemies(){
  const c=state.v015Combat;if(!c||state.mode!=='playing'||state.roomTime<c.nextBeat)return;const live=state.enemies.filter(e=>e.v015Enemy&&!e.dead),active=live.filter(e=>e.mode==='telegraph'||e.mode==='lunge').length,slots=Math.max(0,c.concurrent-active);if(!slots)return;
  const ready=live.filter(e=>e.mode==='move'&&e.cooldown<=0).sort((a,b)=>{const pa=rolePriority(ARCHETYPES[a.v015Archetype].role),pb=rolePriority(ARCHETYPES[b.v015Archetype].role);const repeatA=ARCHETYPES[a.v015Archetype].role===c.lastRole?2:0,repeatB=ARCHETYPES[b.v015Archetype].role===c.lastRole?2:0;return pa+repeatA-(pb+repeatB)||String(a.id).localeCompare(String(b.id))});
  for(let i=0;i<Math.min(slots,ready.length);i++){const e=ready[i],s=ARCHETYPES[e.v015Archetype];e.mode='telegraph';e.telegraph=Math.max(.16,s.telegraph/c.intensity);e.intent={x:state.player.x,y:state.player.y};c.lastRole=s.role}
  c.nextBeat=state.roomTime+c.cadence;
}
function pointSegmentDistance(px,py,ax,ay,bx,by){const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,l2=vx*vx+vy*vy,t=l2>1e-7?clamp((wx*vx+wy*vy)/l2,0,1):0,cx=ax+vx*t,cy=ay+vy*t;return Math.hypot(px-cx,py-cy)}
function updateHazards(dt){
  const p=state.player;for(const w of state.v015Wires){w.life-=dt;if(w.cooldown>0)w.cooldown-=dt;if(w.life>0&&w.cooldown<=0&&pointSegmentDistance(p.x,p.y,w.ax,w.ay,w.bx,w.by)<p.r+5){F.damagePlayer?.(1,w.owner);w.cooldown=.8}}state.v015Wires=state.v015Wires.filter(w=>w.life>0&&w.owner&&!w.owner.dead);
  for(const s of state.v015Spores){s.age+=dt;s.life-=dt;s.r=Math.min(s.targetR,s.r+dt*58);if(s.cooldown>0)s.cooldown-=dt;if(s.age>.58&&s.cooldown<=0&&Math.hypot(p.x-s.x,p.y-s.y)<s.r+p.r*.45){F.damagePlayer?.(1,{x:s.x,y:s.y});s.cooldown=.9}}state.v015Spores=state.v015Spores.filter(s=>s.life>0);
}

const inheritedSetup=F.setupRoom;
F.setupRoom=(depth,...rest)=>{
  const result=inheritedSetup(depth,...rest),bp=G.roomBlueprint(depth),rng=rngFrom(hash(`v015-alpha-roster:${depth}`));
  state.enemies.length=0;state.v015Wires=[];state.v015Spores=[];state.v015Combat={depth,intensity:bp.v015Intensity||1,cadence:bp.v015Cadence||.9,concurrent:bp.v015Concurrent||1,lastRole:null,nextBeat:.55,miniBoss:Boolean(bp.v015MiniBoss)};
  (bp.v015Roster||[]).forEach((kind,index)=>spawnEnemy(kind,index,rng,state.v015Combat.intensity));
  return result;
};

const inheritedEnemies=F.updateEnemies;
F.updateEnemies=dt=>{
  const ours=state.enemies.filter(e=>e.v015Enemy),others=state.enemies.filter(e=>!e.v015Enemy);state.enemies=others;inheritedEnemies(dt);const updatedOthers=state.enemies;state.enemies=[...updatedOthers,...ours];for(const e of ours)updateEnemy(e,dt);armReadyEnemies();updateHazards(dt);
};

const inheritedDamage=F.damageEnemy;
F.damageEnemy=(e,amount,dir=null,source={})=>{
  if(!e?.v015Enemy)return inheritedDamage(e,amount,dir,source);if(e.dead)return false;const p=state.player,base=amount*(p?.v015DamageMultiplier||1);amount=base;
  if(e.v015Archetype==='shield'&&!source.hazard&&!source.counterShot){const toPlayer=norm(p.x-e.x,p.y-e.y),front=Math.cos(e.facingAngle)*toPlayer.x+Math.sin(e.facingAngle)*toPlayer.y;if(front>.12){amount*=.18;F.addCallout?.(e.x,e.y-26,'ARMORED','#f0bd7c')}else{amount*=1.45;F.addCallout?.(e.x,e.y-26,'FLANK','#dfffad')}}
  if(e.v015Archetype==='harvester'&&source.counterShot)amount*=1.35;
  e.hp-=amount;e.hitFlash=.08;if(dir){e.x+=dir.x*3;e.y+=dir.y*3}if(e.hp>0)return true;e.hp=0;e.dead=true;state.score+=e.reward||100;state.stats.kills=(state.stats.kills||0)+1;F.addCallout?.(e.x,e.y-24,`+${e.reward||100}`,'#dfffb6');for(let i=0;i<10;i++)F.spawnParticle?.(e.x,e.y,e.v015Archetype==='harvester'?'#f0a05e':'#d8d2a7',28+i*3,.22,1.6);F.signalHitStop?.('enemy',e.r>=23?2:1);return true;
};

window.SylvariaEncounterDirector=Object.freeze({version:ENCOUNTER_DIRECTOR_VERSION,archetypes:ARCHETYPES,rooms:ALPHA_ROOMS,snapshot:()=>({version:ENCOUNTER_DIRECTOR_VERSION,depth:state.worldDepth,combat:state.v015Combat?{...state.v015Combat}:null,alive:state.enemies.filter(e=>e.v015Enemy&&!e.dead).map(e=>({id:e.id,kind:e.v015Archetype,role:e.v015Role||ARCHETYPES[e.v015Archetype]?.role,mode:e.mode,hp:e.hp,maxHp:e.maxHp})),wires:state.v015Wires?.length||0,spores:state.v015Spores?.length||0})});
