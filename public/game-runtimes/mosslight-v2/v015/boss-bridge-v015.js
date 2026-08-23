const G=window.Sylvaria091;
const {H,state,hash}=G,F=G.fn;

export const BOSS_BRIDGE_VERSION='0.15.0';

function bossState(depth,bp){
  const maxHp=42+Math.max(0,depth-10)*2;
  return{
    id:`v015-walking-sawmill-${depth}`,
    type:'boss',
    name:bp.bossName||'The Walking Sawmill',
    v015Boss:true,
    x:720,
    y:H/2,
    r:48,
    hp:maxHp,
    maxHp,
    phase:1,
    clock:1.15,
    telegraph:0,
    recover:0,
    state:'move',
    angle:0,
    sawAngle:0,
    attackCount:0,
    intent:null,
    rngState:hash(`v015-boss:${depth}:${bp.bossName||'sawmill'}`),
    hitFlash:0,
    dead:false,
    counterStagger:0,
    hazardCooldown:0,
    recoil:0,
    exhaustClock:0,
    heat:0,
  };
}
function ensureBoss(depth=state.worldDepth){
  const bp=G.roomBlueprint(depth);
  if(!bp?.boss)return null;
  if(!state.boss)state.boss=bossState(depth,bp);
  state.boss.name=bp.bossName||state.boss.name||'The Walking Sawmill';
  state.boss.v015Boss=true;
  window.SylvariaBossFlow?.initialize?.(state.boss);
  return state.boss;
}
const inheritedSetup=F.setupRoom;
F.setupRoom=(depth,...rest)=>{const result=inheritedSetup(depth,...rest);ensureBoss(depth);return result};
if(state.room)ensureBoss(state.worldDepth);

window.SylvariaBossBridge=Object.freeze({
  version:BOSS_BRIDGE_VERSION,
  ensureBoss,
  snapshot:()=>({version:BOSS_BRIDGE_VERSION,boss:state.boss&&!state.boss.dead?{id:state.boss.id,name:state.boss.name,hp:state.boss.hp,maxHp:state.boss.maxHp,phase:state.boss.phase,guard:state.boss.v014Guard??null,guardMax:state.boss.v014GuardMax??null}:null}),
});
