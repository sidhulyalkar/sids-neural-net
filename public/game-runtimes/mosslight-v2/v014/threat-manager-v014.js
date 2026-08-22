const G=window.Sylvaria091;
const {state,FIXED_DT,hash}=G,F=G.fn;

export const THREAT_MANAGER_VERSION='0.14.0';
const q=v=>Math.round(v*100000)/100000;

const ROLE_COST=Object.freeze({coverage:2,engage:1,precision:2,heavy:3,support:1,light:0});
const ROLE_TRANSITIONS=Object.freeze({
  coverage:Object.freeze(['engage','precision','support','heavy','coverage']),
  engage:Object.freeze(['precision','coverage','support','heavy','engage']),
  precision:Object.freeze(['engage','coverage','heavy','support','precision']),
  heavy:Object.freeze(['precision','engage','support','coverage','heavy']),
  support:Object.freeze(['coverage','engage','precision','heavy','support']),
  light:Object.freeze(['coverage','engage','precision','heavy','support','light']),
});
const KINETIC_ROLE=Object.freeze({skimmer:'coverage',strider:'engage',sniper:'precision',shellback:'heavy'});
const LEGACY_ROLE=Object.freeze({feller:'engage',foreman:'precision',lobbyist:'support',skidder:'engage',drone:'coverage',chair:'support',broker:'support',surveyor:'precision',mech:'heavy',mulcher:'coverage'});

const P=(gapMin,gapMax,budget,maxAttacks,restTicks,punishGraceTicks,accent)=>Object.freeze({gapMin,gapMax,budget,maxAttacks,restTicks,punishGraceTicks,accent});
export const ROOM_THREAT_PROFILES=Object.freeze([
  P(12,12,3,2,24,12,'duet'),P(11,12,3,2,23,12,'lane'),P(11,12,3,2,22,12,'drag'),P(10,12,4,3,22,11,'bait'),P(10,11,4,3,21,11,'coverage'),
  P(10,11,4,3,20,11,'support'),P(9,11,4,3,20,10,'evade'),P(9,10,5,3,19,10,'artillery'),P(9,10,5,3,18,10,'mixed'),P(9,10,5,3,20,10,'boss'),
  P(9,10,5,3,18,9,'fast'),P(8,10,5,3,18,9,'water'),P(8,10,5,3,17,9,'charge'),P(8,9,5,3,17,9,'vision'),P(8,9,6,4,17,8,'drag'),
  P(8,9,6,4,16,8,'hazard'),P(7,9,6,4,16,8,'fracture'),P(7,9,6,4,16,8,'support'),P(7,8,6,4,15,8,'systems'),P(7,8,6,4,17,8,'boss'),
  P(7,8,6,4,15,7,'speed'),P(7,8,7,4,15,7,'crossfire'),P(7,8,7,4,14,7,'poison'),P(6,8,7,4,14,7,'heavy-pair'),P(6,8,7,4,14,7,'shards'),
  P(6,7,7,4,13,6,'blink'),P(6,7,8,5,13,6,'pressure'),P(6,7,8,5,13,6,'artillery-pair'),P(6,7,8,5,12,6,'maximum-mixed'),P(6,7,8,5,14,6,'final-boss'),
]);

let roomDepth=1,tick=0,gateTick=0,phraseStartTick=0,phraseCost=0,phraseAttacks=0,lastRole='light',serial=0,phraseIndex=0;
let pending=[];
let releases=[];
let punishGraceUntil=0,punishWindowActive=false;
const MAX_RELEASE_LOG=48;

function profileForDepth(depth=state.worldDepth||1){return ROOM_THREAT_PROFILES[Math.max(0,Math.min(ROOM_THREAT_PROFILES.length-1,(depth|0)-1))]}
function allThreatActors(){const actors=[...state.enemies];if(state.boss&&!state.boss.dead)actors.push(state.boss);return actors}
function roleFor(actor){if(actor&&actor===state.boss)return'heavy';return KINETIC_ROLE[actor?.kineticType]||LEGACY_ROLE[actor?.type]||'light'}
function costFor(actor){return ROLE_COST[roleFor(actor)]??1}
function stableId(actor){return String(actor?.id||`${actor===state.boss?'boss':actor?.kineticType||actor?.type||'enemy'}:${actor?.x||0}:${actor?.y||0}`)}
function isTelegraphing(actor){return actor?.state==='telegraph'||actor?.state==='kinetic-telegraph'||(actor?.telegraph||0)>0}
function isBusy(actor){return Boolean(actor?.dead||actor?.kineticEvade||actor?.evade||actor?.counterStagger>0||actor?.state==='recover'||actor?.state==='charge'||actor?.state==='kinetic-lunge'||isTelegraphing(actor))}
function readyToRequest(actor){return costFor(actor)>0&&!isBusy(actor)&&actor?.state==='move'&&(actor.clock||0)<=FIXED_DT+.000001&&!actor.v014ThreatQueued&&!Number.isFinite(actor.v014ThreatScheduledTick)}
function transitionRank(role){const order=ROLE_TRANSITIONS[lastRole]||ROLE_TRANSITIONS.light;const i=order.indexOf(role);return i<0?order.length:i}
function candidateSort(a,b){const ar=transitionRank(a.role),br=transitionRank(b.role);if(ar!==br)return ar-br;if(a.requestTick!==b.requestTick)return a.requestTick-b.requestTick;return a.id<b.id?-1:a.id>b.id?1:0}
function deterministicGap(profile,item){const span=profile.gapMax-profile.gapMin+1;if(span<=1)return profile.gapMin;return profile.gapMin+(hash(`v014-threat:${roomDepth}:${phraseIndex}:${item.id}:${item.serial}`)%span)}
function resetPhrase(startTick=tick){phraseStartTick=startTick;phraseCost=0;phraseAttacks=0;phraseIndex++;lastRole='light'}
function clearActorReservation(actor){if(!actor)return;actor.v014ThreatQueued=false;actor.v014ThreatScheduledTick=null;actor.v014ThreatRole=null;actor.v014ThreatSerial=null}

function enqueueReady(){
  for(const actor of allThreatActors()){
    if(!readyToRequest(actor)||pending.some(item=>item.actor===actor))continue;
    const item={actor,id:stableId(actor),role:roleFor(actor),cost:costFor(actor),requestTick:tick,serial:serial++,armed:false,slotTick:null,gapTicks:null};
    actor.v014ThreatQueued=true;actor.v014ThreatRole=item.role;actor.v014ThreatSerial=item.serial;pending.push(item);
  }
}
function cancelInvalidRequests(){
  for(const item of pending){
    if(item.armed)continue;
    const actor=item.actor;if(!actor||actor.dead||actor.kineticEvade||actor.evade||actor.state==='recover'||actor.state==='charge'||actor.state==='kinetic-lunge'){
      clearActorReservation(actor);item.cancelled=true;
    }
  }
  pending=pending.filter(item=>!item.cancelled);
}
function beginPhraseRest(profile){resetPhrase(tick+profile.restTicks);gateTick=Math.max(gateTick,punishGraceUntil,tick+profile.restTicks)}
function resetIdlePhrase(profile){if(phraseAttacks>0&&tick>gateTick+profile.restTicks)resetPhrase(tick)}
function chooseBeat(){
  const profile=profileForDepth();resetIdlePhrase(profile);if(tick<Math.max(gateTick,punishGraceUntil))return null;
  const waiting=pending.filter(item=>!item.armed&&!item.cancelled);if(!waiting.length)return null;
  if(phraseAttacks>=profile.maxAttacks){beginPhraseRest(profile);return null}
  const remaining=profile.budget-phraseCost;
  const eligible=waiting.filter(item=>item.cost<=remaining);
  if(!eligible.length){beginPhraseRest(profile);return null}
  eligible.sort(candidateSort);const item=eligible[0],actor=item.actor,gap=deterministicGap(profile,item);
  item.armed=true;item.slotTick=tick;item.gapTicks=gap;
  actor.v014ThreatQueued=false;actor.v014ThreatScheduledTick=tick;actor.clock=0;
  if(phraseAttacks===0)phraseStartTick=tick;
  phraseCost+=item.cost;phraseAttacks++;lastRole=item.role;gateTick=tick+gap;
  return item;
}
function holdWaitingThreats(){
  for(const item of pending){
    if(item.armed||item.cancelled)continue;const actor=item.actor;if(!actor||actor.dead||actor.state!=='move')continue;
    actor.clock=Math.max(actor.clock||0,q(FIXED_DT*2));
  }
}
function recordReleasedTelegraphs(){
  for(const item of pending){
    if(!item.armed||item.released)continue;const actor=item.actor;if(!actor||actor.dead)continue;
    if(isTelegraphing(actor)){
      item.released=true;clearActorReservation(actor);
      releases.push({tick,id:item.id,role:item.role,cost:item.cost,requestTick:item.requestTick,slotTick:item.slotTick,gapTicks:item.gapTicks,roomDepth,phraseIndex,boss:actor===state.boss});
      if(releases.length>MAX_RELEASE_LOG)releases.shift();
    }
  }
  pending=pending.filter(item=>!item.released&&!item.cancelled);
}
function observePunishWindows(){
  const open=state.enemies.some(e=>!e.dead&&(e.v014PunishTimer||0)>0);
  if(open&&!punishWindowActive){const profile=profileForDepth();punishGraceUntil=Math.max(punishGraceUntil,tick+profile.punishGraceTicks);gateTick=Math.max(gateTick,punishGraceUntil)}
  punishWindowActive=open;
}
function resetThreatState(depth=state.worldDepth||1){
  for(const item of pending)clearActorReservation(item.actor);
  roomDepth=depth|0;tick=0;gateTick=0;phraseStartTick=0;phraseCost=0;phraseAttacks=0;lastRole='light';serial=0;phraseIndex=0;pending=[];releases=[];punishGraceUntil=0;punishWindowActive=false;
  for(const actor of allThreatActors())clearActorReservation(actor);
}

const inheritedSetup=F.setupRoom;
F.setupRoom=(depth,...rest)=>{const result=inheritedSetup(depth,...rest);resetThreatState(depth);return result};
resetThreatState(state.worldDepth||1);

const inheritedEnemies=F.updateEnemies;
F.updateEnemies=(dt)=>{
  tick++;observePunishWindows();cancelInvalidRequests();enqueueReady();chooseBeat();holdWaitingThreats();
  const result=inheritedEnemies(dt);recordReleasedTelegraphs();return result;
};
const inheritedBoss=F.updateBoss;
F.updateBoss=(dt)=>{const result=inheritedBoss(dt);recordReleasedTelegraphs();return result};

window.SylvariaThreatManager=Object.freeze({
  version:THREAT_MANAGER_VERSION,profiles:ROOM_THREAT_PROFILES,roleCost:ROLE_COST,transitions:ROLE_TRANSITIONS,roleFor,
  snapshot:()=>({
    version:THREAT_MANAGER_VERSION,roomDepth,tick,profile:profileForDepth(),gateTick,phraseStartTick,phraseCost,phraseAttacks,phraseIndex,lastRole,punishGraceUntil,punishWindowActive,
    queuedCost:pending.filter(item=>!item.armed&&!item.cancelled).reduce((sum,item)=>sum+item.cost,0),
    queue:pending.map(item=>({id:item.id,role:item.role,cost:item.cost,requestTick:item.requestTick,armed:item.armed,slotTick:item.slotTick,gapTicks:item.gapTicks,boss:item.actor===state.boss})),
    releases:[...releases],
  }),
});
