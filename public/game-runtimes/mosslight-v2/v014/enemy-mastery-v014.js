const G=window.Sylvaria091;
const {state}=G,F=G.fn;

export const ENEMY_MASTERY_VERSION='0.14.0';
export const ENEMY_MASTERY_CONFIG=Object.freeze({
  striderWhiffPunishTicks:28,
  sniperCounterPunishTicks:32,
  shellbackRearMultiplier:1.35,
  shellbackRearDot:-.24,
});
const DT=1/120,q=v=>Math.round(v*100000)/100000;

function initEnemy(e){if(!e?.kineticType)return;e.v014MasteryOpening=null}
for(const e of state.enemies)initEnemy(e);
const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{const result=inheritedSetup(...args);for(const e of state.enemies)initEnemy(e);return result};

const inheritedEnemies=F.updateEnemies;
F.updateEnemies=(dt)=>{
  const before=new Map(state.enemies.filter(e=>e.kineticType&&!e.dead).map(e=>[e.id,{state:e.state,contactCooldown:e.contactCooldown||0}]));
  const result=inheritedEnemies(dt);
  for(const e of state.enemies){
    if(e.dead||e.kineticType!=='strider')continue;
    const prior=before.get(e.id);if(!prior||prior.state!=='kinetic-lunge'||e.state!=='recover')continue;
    const connected=prior.contactCooldown>0||(e.contactCooldown||0)>0;if(connected)continue;
    e.v014PunishTimer=Math.max(e.v014PunishTimer||0,q(ENEMY_MASTERY_CONFIG.striderWhiffPunishTicks*DT));
    e.v014MasteryOpening='lunge-whiff';
    F.addCallout?.(e.x,e.y-e.r-15,'WHIFF OPEN','#eaffb5');
  }
  return result;
};

const inheritedDamage=F.damageEnemy;
F.damageEnemy=(e,amount,dir=null,source={})=>{
  let adjusted=amount;
  if(e?.kineticType==='shellback'&&!source.hazard&&!source.counterShot&&(source.arc||source.melee)&&state.player){
    const dx=state.player.x-e.x,dy=state.player.y-e.y,m=Math.hypot(dx,dy)||1,front=Math.cos(e.facingAngle||0)*dx/m+Math.sin(e.facingAngle||0)*dy/m;
    if(front<ENEMY_MASTERY_CONFIG.shellbackRearDot){adjusted*=ENEMY_MASTERY_CONFIG.shellbackRearMultiplier;e.v014MasteryOpening='rear-flank';F.addCallout?.(e.x,e.y-e.r-15,'FLANK','#f0ffbb')}
  }
  const hp=e?.hp??0,result=inheritedDamage(e,adjusted,dir,source);
  if(e?.kineticType==='sniper'&&!e.dead&&source.counterShot&&e.hp<hp){
    e.v014PunishTimer=Math.max(e.v014PunishTimer||0,q(ENEMY_MASTERY_CONFIG.sniperCounterPunishTicks*DT));
    e.v014MasteryOpening='counter-stagger';
    F.addCallout?.(e.x,e.y-e.r-15,'LINE BROKEN','#fff0ad');
  }
  return result;
};

window.SylvariaEnemyMastery=Object.freeze({
  version:ENEMY_MASTERY_VERSION,
  config:ENEMY_MASTERY_CONFIG,
  snapshot:()=>({
    version:ENEMY_MASTERY_VERSION,
    enemies:state.enemies.filter(e=>e.kineticType&&!e.dead).map(e=>({id:e.id,kind:e.kineticType,state:e.state,opening:e.v014MasteryOpening||null,punishTimer:e.v014PunishTimer||0})),
  }),
});
