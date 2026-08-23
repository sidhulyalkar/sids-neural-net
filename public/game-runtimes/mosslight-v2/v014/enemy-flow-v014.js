const G=window.Sylvaria091;
const {state}=G,F=G.fn,AI=window.SylvariaKineticAI;

export const ENEMY_FLOW_VERSION='0.14.0';
export const EVADE_FLOW=Object.freeze({
  skimmer:Object.freeze({reactionTicks:12,cooldownTicks:156,punishTicks:20,punishMultiplier:1.20}),
  strider:Object.freeze({reactionTicks:9,cooldownTicks:108,punishTicks:30,punishMultiplier:1.35}),
  sniper:Object.freeze({reactionTicks:14,cooldownTicks:174,punishTicks:24,punishMultiplier:1.25}),
});

const DT=1/120,q=v=>Math.round(v*100000)/100000;

// v0.13 owns the kinetic archetypes. Its outer registry is frozen, while the
// versioned archetype records remain tunable. v0.14 removes hidden dodge odds:
// if an agile enemy's readable evade cooldown is ready, it reacts every time.
for(const [kind,flow] of Object.entries(EVADE_FLOW)){
  const spec=AI?.archetypes?.[kind];if(!spec)continue;
  spec.dodge=100;
  spec.reaction=flow.reactionTicks*DT;
}

function flowFor(e){return EVADE_FLOW[e?.kineticType]||null}
function initEnemyFlow(e){
  if(!flowFor(e))return;
  e.v014EvadeCycle=Boolean(e.kineticEvade);
  e.v014PunishTimer=0;
}
for(const e of state.enemies)initEnemyFlow(e);

const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{
  const result=inheritedSetup(...args);
  for(const e of state.enemies)initEnemyFlow(e);
  return result;
};

const inheritedEnemies=F.updateEnemies;
F.updateEnemies=(dt)=>{
  for(const e of state.enemies)if(e.v014PunishTimer>0)e.v014PunishTimer=Math.max(0,e.v014PunishTimer-dt);
  const result=inheritedEnemies(dt);
  for(const e of state.enemies){
    const flow=flowFor(e);if(!flow||e.dead)continue;
    const evading=Boolean(e.kineticEvade);
    if(evading&&!e.v014EvadeCycle){
      e.v014EvadeCycle=true;
      e.arcDodgeCooldown=q(flow.cooldownTicks*DT);
    }else if(!evading&&e.v014EvadeCycle){
      e.v014EvadeCycle=false;
      e.v014PunishTimer=q(flow.punishTicks*DT);
    }
  }
  return result;
};

const inheritedDamage=F.damageEnemy;
F.damageEnemy=(e,amount,dir=null,source={})=>{
  const flow=flowFor(e),bladePunish=flow&&e.v014PunishTimer>0&&(source.arc||source.melee)&&!source.hazard;
  if(bladePunish){
    amount*=flow.punishMultiplier;
    e.v014PunishTimer=0;
    F.addCallout?.(e.x,e.y-e.r-12,'OPEN','#eaffb5');
  }
  return inheritedDamage(e,amount,dir,source);
};

window.SylvariaEnemyFlow=Object.freeze({
  version:ENEMY_FLOW_VERSION,
  config:EVADE_FLOW,
  snapshot:()=>({
    version:ENEMY_FLOW_VERSION,
    enemies:state.enemies.filter(e=>flowFor(e)&&!e.dead).map(e=>({
      id:e.id,
      kind:e.kineticType,
      evadeCooldown:e.arcDodgeCooldown||0,
      evading:Boolean(e.kineticEvade),
      punishTimer:e.v014PunishTimer||0,
    })),
  }),
});
