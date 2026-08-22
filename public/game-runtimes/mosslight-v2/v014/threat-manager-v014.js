const G=window.Sylvaria091;
const {state,FIXED_DT,hash}=G,F=G.fn;

export const THREAT_MANAGER_VERSION='0.14.0';
const q=v=>Math.round(v*100000)/100000;

const ROLE_COST=Object.freeze({
  coverage:2,
  engage:1,
  precision:2,
  heavy:3,
  support:1,
  light:0,
});

const ROLE_TRANSITIONS=Object.freeze({
  coverage:Object.freeze(['engage','precision','support','heavy','coverage']),
  engage:Object.freeze(['precision','coverage','support','heavy','engage']),
  precision:Object.freeze(['engage','coverage','heavy','support','precision']),
  heavy:Object.freeze(['precision','engage','support','coverage','heavy']),
  support:Object.freeze(['coverage','engage','precision','heavy','support']),
  light:Object.freeze(['coverage','engage','precision','heavy','support','light']),
});

const KINETIC_ROLE=Object.freeze({
  skimmer:'coverage',
  strider:'engage',
  sniper:'precision',
  shellback:'heavy',
});
const LEGACY_ROLE=Object.freeze({
  feller:'light',
  foreman:'precision',
  lobbyist:'support',
  skidder:'engage',
  drone:'coverage',
  chair:'support',
  broker:'support',
  surveyor:'precision',
  mech:'heavy',
  mulcher:'coverage',
});

const P=(gapMin,gapMax,budget,maxAttacks,restTicks,punishGraceTicks,accent)=>Object.freeze({gapMin,gapMax,budget,maxAttacks,restTicks,punishGraceTicks,accent});
export const ROOM_THREAT_PROFILES=Object.freeze([
  P(12,12,3,2,24,12,'duet'),P(11,12,3,2,23,12,'lane'),P(11,12,3,2,22,12,'drag'),P(10,12,4,3,22,11,'bait'),P(10,11,4,3,21,11,'coverage'),
  P(10,11,4,3,20,11,'support'),P(9,11,4,3,20,10,'evade'),P(9,10,5,3,19,10,'artillery'),P(9,10,5,3,18,10,'mixed'),P(9,10,5,3,20,10,'boss'),
  P(9,10,5,3,18,9,'fast'),P(8,10,5,3,18,9,'water'),P(8,10,5,3,17,9,'charge'),P(8,9,5,3,17,9,'vision'),P(8,9,6,4,17,8,'drag'),
  P(8,9,6,4,16,8,'hazard'),P(7,9,6,4,16,8,'fracture'),P(7,9,6,4,16,8,'support'),P(7,8,6,4,15,8,'systems'),P(7,8,6,4,17,8,'boss'),
  P(7,8,6,4,15,7,'speed'),P(7,8,7,4,15,7,'crossfire'),P(7,8,7,4,14,7,'poison'),P(6,8,7,4,14,7,'heavy-pair'),P(6,8,7,4,14,7,'shards'),
  P(6,7,7,4,13,6,'blink'),P(6,7,8,5,13,6,'pressure'),P(6,7,8,5,13,6,'artillery-pair'),P(6,7,8,5,12,6,'maximum-mixed'),P(6,7,8,5,14,6,'final-boss'),
]);

let roomDepth=1,tick=0,nextSlotTick=0,phraseStartTick=0,phraseCost=0,phraseAttacks=0,lastRole='light',serial=0;
let pending=[];
let releases=[];
let punishGraceUntil=0,punishWindowActive=false;
const MAX_RELEASE_LOG=48;

function profileForDepth(depth=state.worldDepth||1){
  return ROOM_THREAT_PROFILES[Math.max(0,Math.min(ROOM_THREAT_PROFILES.length-1,(depth|0)-1))];
}
function roleFor(e){return KINETIC_ROLE[e?.kineticType]||LEGACY_ROLE[e?.type]||'light'}
function costFor(e){return ROLE_COST[roleFor(e)]??1}
function stableId(e){return String(e?.id||`${e?.kineticType||e?.type||'enemy'}:${e?.x||0}:${e?.y||0}`)}
function isTelegraphing(e){return e?.state==='telegraph'||e?.state==='kinetic-telegraph'||(e?.telegraph||0)>0}
function isBusy(e){return Boolean(e?.dead||e?.kineticEvade||e?.evade||e?.counterStagger>0||e?.state==='recover'||e?.state==='charge'||e?.state==='kinetic-lunge'||isTelegraphing(e))}
function isHeavyThreat(e){return costFor(e)>0}
function readyToRequest(e){return isHeavyThreat(e)&&!isBusy(e)&&e?.state==='move'&&(e.clock||0)<=FIXED_DT+.000001&&!Number.isFinite(e.v014ThreatScheduledTick)}
function transitionRank(role){const order=ROLE_TRANSITIONS[lastRole]||ROLE_TRANSITIONS.light;const i=order.indexOf(role);return i<0?order.length:i}
function candidateSort(a,b){
  const ar=transitionRank(a.role),br=transitionRank(b.role);if(ar!==br)return ar-br;
  if(a.requestTick!==b.requestTick)return a.requestTick-b.requestTick;
  const ai=stableId(a.enemy),bi=stableId(b.enemy);return ai<bi?-1:ai>bi?1:0;
}
function deterministicGap(profile,item){
  const span=profile.gapMax-profile.gapMin+1;if(span<=1)return profile.gapMin;
  return profile.gapMin+(hash(`v014-threat:${roomDepth}:${item.id}:${item.serial}`)%span);
}
function resetPhrase(startTick){phraseStartTick=startTick;phraseCost=0;phraseAttacks=0}
function assignSlot(item){
  const profile=profileForDepth();
  let slot=Math.max(tick,nextSlotTick,punishGraceUntil);
  if(phraseAttacks>=profile.maxAttacks||phraseCost+item.cost>profile.budget){
    slot=Math.max(slot,nextSlotTick+profile.restTicks,punishGraceUntil);
    resetPhrase(slot);
  }else if(phraseAttacks===0){
    phraseStartTick=slot;
  }
  const gap=deterministicGap(profile,item);
  item.slotTick=slot;item.gapTicks=gap;
  item.enemy.v014ThreatScheduledTick=slot;
  item.enemy.v014ThreatRole=item.role;
  item.enemy.v014ThreatSerial=item.serial;
  phraseCost+=item.cost;phraseAttacks++;
  nextSlotTick=slot+gap;lastRole=item.role;
}
function enqueueReady(){
  for(const e of state.enemies){
    if(!readyToRequest(e)||pending.some(p=>p.enemy===e))continue;
    pending.push({enemy:e,id:stableId(e),role:roleFor(e),cost:costFor(e),requestTick:tick,serial:serial++,slotTick:null,gapTicks:null});
  }
  const unscheduled=pending.filter(p=>!Number.isFinite(p.slotTick));
  while(unscheduled.length){
    unscheduled.sort(candidateSort);
    const item=unscheduled.shift();assignSlot(item);
  }
}
function cancelInvalidReservations(){
  for(const item of pending){
    const e=item.enemy;if(!e||e.dead){if(e)e.v014ThreatScheduledTick=null;item.cancelled=true;continue}
    if(Number.isFinite(item.slotTick)&&tick<item.slotTick&&(e.kineticEvade||e.evade||e.state==='recover')){
      e.v014ThreatScheduledTick=null;e.v014ThreatRole=null;item.cancelled=true;
    }
  }
  pending=pending.filter(p=>!p.cancelled);
}
function pushQueuePastGrace(until){
  let cursor=until;
  for(const item of pending.filter(p=>!p.cancelled&&!p.released&&Number.isFinite(p.slotTick)).sort((a,b)=>a.slotTick-b.slotTick||a.serial-b.serial)){
    if(item.slotTick<cursor){item.slotTick=cursor;item.enemy.v014ThreatScheduledTick=cursor}
    cursor=item.slotTick+(item.gapTicks||profileForDepth().gapMin);
  }
  nextSlotTick=Math.max(nextSlotTick,cursor);
}
function holdQueuedThreats(){
  for(const item of pending){
    const e=item.enemy;if(!e||e.dead||!Number.isFinite(item.slotTick))continue;
    if(tick<item.slotTick&&e.state==='move'&&!e.kineticEvade&&!e.evade){
      const ticksRemaining=item.slotTick-tick+1;
      e.clock=Math.max(e.clock||0,q(ticksRemaining*FIXED_DT));
    }
  }
}
function recordReleasedTelegraphs(){
  for(const item of pending){
    const e=item.enemy;if(!e||e.dead)continue;
    if(!item.released&&isTelegraphing(e)){
      item.released=true;
      e.v014ThreatScheduledTick=null;
      releases.push({tick,id:item.id,role:item.role,cost:item.cost,requestTick:item.requestTick,slotTick:item.slotTick,gapTicks:item.gapTicks,roomDepth});
      if(releases.length>MAX_RELEASE_LOG)releases.shift();
    }
  }
  pending=pending.filter(p=>!p.released&&!p.cancelled);
}
function observePunishWindows(){
  const open=state.enemies.some(e=>!e.dead&&(e.v014PunishTimer||0)>0);
  if(open&&!punishWindowActive){
    const profile=profileForDepth();punishGraceUntil=Math.max(punishGraceUntil,tick+profile.punishGraceTicks);pushQueuePastGrace(punishGraceUntil);
  }
  punishWindowActive=open;
}
function resetThreatState(depth=state.worldDepth||1){
  roomDepth=depth|0;tick=0;nextSlotTick=0;phraseStartTick=0;phraseCost=0;phraseAttacks=0;lastRole='light';serial=0;pending=[];releases=[];punishGraceUntil=0;punishWindowActive=false;
  for(const e of state.enemies){e.v014ThreatScheduledTick=null;e.v014ThreatRole=null;e.v014ThreatSerial=null}
}

const inheritedSetup=F.setupRoom;
F.setupRoom=(depth,...rest)=>{const result=inheritedSetup(depth,...rest);resetThreatState(depth);return result};
resetThreatState(state.worldDepth||1);

const inheritedEnemies=F.updateEnemies;
F.updateEnemies=(dt)=>{
  tick++;
  observePunishWindows();
  cancelInvalidReservations();
  enqueueReady();
  holdQueuedThreats();
  const result=inheritedEnemies(dt);
  recordReleasedTelegraphs();
  return result;
};

window.SylvariaThreatManager=Object.freeze({
  version:THREAT_MANAGER_VERSION,
  profiles:ROOM_THREAT_PROFILES,
  roleCost:ROLE_COST,
  transitions:ROLE_TRANSITIONS,
  roleFor,
  snapshot:()=>({
    version:THREAT_MANAGER_VERSION,roomDepth,tick,profile:profileForDepth(),nextSlotTick,phraseStartTick,phraseCost,phraseAttacks,lastRole,punishGraceUntil,punishWindowActive,
    queue:pending.map(p=>({id:p.id,role:p.role,cost:p.cost,requestTick:p.requestTick,slotTick:p.slotTick,gapTicks:p.gapTicks})),
    releases:[...releases],
  }),
});
