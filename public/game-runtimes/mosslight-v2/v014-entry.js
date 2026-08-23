// v0.14 changes authoritative combat timing and movement. Keep the portfolio build
// playable while preventing the legacy v0.13 verifier from accepting altered physics.
window.SylvariaRankedDisabledReason='v0.14 replay verifier migration';

await import('./v013-entry.js');
await import('./v014/character-rig-v014.js');
await import('./v014/combat-flow-v014.js');
await import('./v014/enemy-flow-v014.js');
await import('./v014/boss-flow-v014.js');
await import('./v014/threat-manager-v014.js');
await import('./v014/flow-presentation-v014.js');

const G=window.Sylvaria091,F=G.fn,state=G.state,$=G.$;
const VERSION='0.14.0',PRESENTATION='0.14.0';

function roomInstruction(){
  const depth=state.worldDepth||1;
  if(state.boss&&!state.boss.dead)return'Crack guard with perfect returns, hazards, or a dash-cut through the telegraph. Strike when the core opens.';
  if(depth<=10)return'Read the lead threat. Parry or dash the opening beat, then punish the responder instead of chasing everything.';
  if(depth<=20)return'Split the phrase with terrain and reflected fire. Bait an evade, take the opening, then leave before the answer.';
  return'Create your own opening: redirect pressure, route enemies through hazards, punish vulnerability, and reposition before the next beat.';
}
const inheritedHud=F.updateHud;
F.updateHud=(force=false)=>{inheritedHud?.(force);const task=$('roomTask');if(task&&state.mode==='playing')task.textContent=roomInstruction()};

const title=document.querySelector('#title .eyebrow');if(title)title.textContent='v0.14 · unified kinetic combat';
const lede=document.querySelector('#title .lede');if(lede)lede.textContent='A 120 Hz counter-action run through thirty hostile pond arenas. Carve committed dash lines, sweep from Sprid’s actual mouth, redirect enemy fire, bait readable evasions, weaponize terrain, and break boss guard through earned openings.';
const micro=document.querySelector('#title .microcopy');if(micro)micro.textContent='Thirty authored arenas escalate from readable duets into tightly staggered call-and-response phrases. Every heavy commitment shares one deterministic threat budget, so late rooms become faster and denser without collapsing into simultaneous projectile soup.';
const season=$('rankSeason');if(season)season.textContent='v0.14 development';
const rankPanel=$('rankPanel');if(rankPanel)rankPanel.hidden=true;

for(const id of['start','explore'])$(id)?.addEventListener('click',()=>queueMicrotask(()=>{const t=$('toast');if(t)t.textContent='WASD carve · hold/release SPACE burst · arrows Reactive Blade · parry the opening 5 ticks'}));

const playtest=window.__MOSSLIGHT_PLAYTEST__;
if(playtest){
  const base=playtest.snapshot.bind(playtest);playtest.version=VERSION;playtest.engineVersion=VERSION;playtest.presentationVersion=PRESENTATION;
  playtest.snapshot=()=>{const snap=base();return{...snap,version:VERSION,engineVersion:VERSION,presentationVersion:PRESENTATION,characterRig:window.SylvariaCharacterRig?.snapshot?.()||null,flowCombat:window.SylvariaFlowCombat?.snapshot?.()||null,enemyFlow:window.SylvariaEnemyFlow?.snapshot?.()||null,bossFlow:window.SylvariaBossFlow?.snapshot?.()||null,threatManager:window.SylvariaThreatManager?.snapshot?.()||null,flowPresentation:window.SylvariaFlowPresentation?.snapshot?.()||null,visual:{...(snap.visual||{}),version:VERSION,presentationVersion:PRESENTATION,unifiedCharacterRig:true,attachedReactiveBlade:true,deterministicThreatOrchestration:true,deterministicEnemyPunish:true,bossGuardBreak:true,environmentalBossRoutes:true,ranked:false}}};
}
const visual=window.SylvariaVisualSystem;
if(visual){const base=visual.snapshot.bind(visual);visual.version=VERSION;visual.presentationVersion=PRESENTATION;visual.snapshot=()=>({...base(),version:VERSION,presentationVersion:PRESENTATION,unifiedCharacterRig:true,attachedReactiveBlade:true,deterministicThreatOrchestration:true,bossGuardBreak:true,ranked:false})}

window.Sylvaria014=G;
window.SylvariaCombat014=Object.freeze({
  version:VERSION,presentationVersion:PRESENTATION,ranked:false,
  rig:window.SylvariaCharacterRig,combat:window.SylvariaFlowCombat,enemies:window.SylvariaEnemyFlow,boss:window.SylvariaBossFlow,threats:window.SylvariaThreatManager,presentation:window.SylvariaFlowPresentation,
});
