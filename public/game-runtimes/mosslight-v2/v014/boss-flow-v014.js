const G=window.Sylvaria091;
const {state}=G,F=G.fn;

export const BOSS_FLOW_VERSION='0.14.0';
export const BOSS_FLOW_CONFIG=Object.freeze({
  guardByPhase:Object.freeze({1:3,2:4,3:5}),
  punishTicksByPhase:Object.freeze({1:36,2:30,3:24}),
  bladePunishMultiplier:1.35,
  guardedHpMultiplier:0,
  perfectReturnGuardDamage:2,
  hazardGuardDamage:1,
  telegraphDashCutGuardDamage:1,
});
const DT=1/120,q=v=>Math.round(v*100000)/100000;

function guardMax(phase=1){return BOSS_FLOW_CONFIG.guardByPhase[phase]||5}
function punishDuration(phase=1){return(BOSS_FLOW_CONFIG.punishTicksByPhase[phase]||24)*DT}
function initBossFlow(b=state.boss){
  if(!b)return;
  b.v014GuardMax=guardMax(b.phase);
  b.v014Guard=b.v014GuardMax;
  b.v014PunishTimer=0;
  b.v014PunishSerial=0;
  b.v014LastPhase=b.phase;
  b.v014GuardHitFlash=0;
  b.v014GuardSource=null;
}
const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{const result=inheritedSetup(...args);initBossFlow(state.boss);return result};
if(state.boss)initBossFlow(state.boss);

function openBoss(b,source){
  if(!b||b.dead||b.v014PunishTimer>0)return false;
  b.v014Guard=0;b.v014PunishTimer=q(punishDuration(b.phase));b.v014PunishSerial=(b.v014PunishSerial||0)+1;b.v014GuardSource=source;
  b.telegraph=0;b.intent=null;b.state='recover';b.recover=b.v014PunishTimer;b.counterStagger=Math.max(b.counterStagger||0,b.v014PunishTimer);b.clock=Math.max(b.clock||0,b.v014PunishTimer+.18);
  state.stats.bossOpenings=(state.stats.bossOpenings||0)+1;
  F.addCallout?.(b.x,b.y-b.r-22,'CORE OPEN','#fff3a5');
  for(let i=0;i<18;i++)F.spawnParticle?.(b.x,b.y,i%2?'#fff0a6':'#9ef8d2',28+i*2,.34,2.4);
  return true;
}
function guardDamageFor(b,source={}){
  const shot=source.counterShot;
  if(shot?.counterQuality==='perfect')return{amount:BOSS_FLOW_CONFIG.perfectReturnGuardDamage,kind:'perfect-return'};
  if(source.hazard)return{amount:BOSS_FLOW_CONFIG.hazardGuardDamage,kind:source.gas?'spore-route':`terrain-${source.terrain||'hazard'}`};
  if((source.arc||source.melee)&&source.attack?.dashCancelled&&b.state==='telegraph')return{amount:BOSS_FLOW_CONFIG.telegraphDashCutGuardDamage,kind:'dash-cut'};
  return null;
}
function damageGuard(b,hit){
  if(!b||!hit||b.v014PunishTimer>0)return false;
  b.v014Guard=Math.max(0,(b.v014Guard??guardMax(b.phase))-hit.amount);b.v014GuardHitFlash=.12;b.v014GuardSource=hit.kind;
  if(b.v014Guard<=0)return openBoss(b,hit.kind);
  F.addCallout?.(b.x,b.y-b.r-16,`GUARD ${b.v014Guard}/${b.v014GuardMax}`,'#d8ffca');
  return true;
}
function rejectGuardedDamage(b,amount){
  if(!(amount>0))return;
  b.v014GuardHitFlash=Math.max(b.v014GuardHitFlash||0,.08);b.v014GuardSource='blocked';
  F.addCallout?.(b.x,b.y-b.r-16,'GUARD · RETURN / ROUTE / DASH-CUT','#d8ffca');
}

const inheritedDamageBoss=F.damageBoss;
F.damageBoss=(amount,dir=null,source={})=>{
  const b=state.boss;if(!b||b.dead)return false;
  const phaseBefore=b.phase,open=b.v014PunishTimer>0,guarding=!open&&(b.v014Guard??guardMax(b.phase))>0,bladePunish=open&&(source.arc||source.melee)&&!source.hazard;
  const hit=guarding?guardDamageFor(b,source):null;
  const hpAmount=guarding?amount*BOSS_FLOW_CONFIG.guardedHpMultiplier:bladePunish?amount*BOSS_FLOW_CONFIG.bladePunishMultiplier:amount;
  const result=inheritedDamageBoss(hpAmount,dir,source);
  if(!state.boss||state.boss.dead)return result;
  if(state.boss.phase!==phaseBefore){initBossFlow(state.boss);return result}
  if(bladePunish)F.addCallout?.(b.x,b.y-b.r-16,'CORE HIT','#efffc1');
  if(hit)damageGuard(b,hit);else if(guarding)rejectGuardedDamage(b,amount);
  return result;
};

const inheritedBoss=F.updateBoss;
F.updateBoss=(dt)=>{
  const b=state.boss;if(!b||b.dead)return inheritedBoss(dt);
  if(b.v014GuardHitFlash>0)b.v014GuardHitFlash=Math.max(0,b.v014GuardHitFlash-dt);
  if(b.phase!==b.v014LastPhase){initBossFlow(b)}
  if(b.v014PunishTimer>0){
    b.v014PunishTimer=Math.max(0,b.v014PunishTimer-dt);b.recover=b.v014PunishTimer;b.counterStagger=Math.max(b.counterStagger||0,b.v014PunishTimer);
    if(b.v014PunishTimer<=0){b.v014GuardMax=guardMax(b.phase);b.v014Guard=b.v014GuardMax;b.v014GuardSource=null;b.state='recover';b.recover=.16;b.counterStagger=0;b.clock=Math.max(b.clock||0,.42)}
    return;
  }
  return inheritedBoss(dt);
};

const snapshot=()=>{const b=state.boss;return{version:BOSS_FLOW_VERSION,boss:b&&!b.dead?{phase:b.phase,guard:b.v014Guard??null,guardMax:b.v014GuardMax??null,punishTimer:b.v014PunishTimer||0,punishSerial:b.v014PunishSerial||0,lastGuardSource:b.v014GuardSource||null}:null}};
window.SylvariaBossFlow=Object.freeze({
  version:BOSS_FLOW_VERSION,
  config:BOSS_FLOW_CONFIG,
  initialize:(boss=state.boss)=>{initBossFlow(boss);return boss||null},
  snapshot,
});
