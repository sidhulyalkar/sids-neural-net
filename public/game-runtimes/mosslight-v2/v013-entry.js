import'./v012-entry.js';
await import('./v013/kinetic-combat-v013.js');
await import('./v013/enemy-ai-v013.js');
await import('./v013/replay-v013.js');
await import('./v011/competitive-v011.js');
await import('./v013/coach-v013.js');
await import('./v013/kinetic-presentation-v013.js');

const G=window.Sylvaria091,F=G.fn,state=G.state,$=G.$,VERSION='0.13.0',PRESENTATION='0.13.0';
const hints=[
  'Glide freely. Mid-swing tongue contact sends attacks back.',
  'Charge Space while steering, then release into a diagonal burst.',
  'Striders read the wind-up. Change your spacing before you sweep.',
  'Dragonflies fire fast lines. Reflect near the middle of the arc.',
  'Shellbacks block frontal tongue hits. Flank them or return heavy fire.',
  'Skimmers orbit while other insects fire through their movement.',
  'Use water currents to change an approach without spending a dash.',
  'Do not chase every dodge. Let enemies move into reflected fire.',
  'Charge dash while the tongue recovers, then reposition before the next lane closes.',
  'Boss ponds now include mobile pressure. Create space before committing a sweep.',
];
const baseHud=F.updateHud;F.updateHud=(force=false)=>{baseHud?.(force);if(!state.room)return;const task=$('roomTask');if(task)task.textContent=hints[(state.worldDepth-1)%hints.length];};
for(const id of['start','explore'])$(id)?.addEventListener('click',()=>queueMicrotask(()=>{const t=$('toast');if(t)t.textContent='WASD glide · hold/release SPACE dash · arrows sweep / reflect'}));

const playtest=window.__MOSSLIGHT_PLAYTEST__;
if(playtest){
  const base=playtest.snapshot.bind(playtest);playtest.version=VERSION;playtest.presentationVersion=PRESENTATION;
  playtest.beginDashCharge=()=>{F.beginDashCharge();return playtest.snapshot()};
  playtest.releaseDashCharge=()=>{F.releaseDashCharge();return playtest.snapshot()};
  playtest.snapshot=()=>{const snap=base();return{...snap,version:VERSION,engineVersion:VERSION,presentationVersion:PRESENTATION,kinetics:window.SylvariaKinetics?.snapshot?.()||null,kineticAI:window.SylvariaKineticAI?.snapshot?.()||null,kineticPresentation:window.SylvariaKineticPresentation?.snapshot?.()||null,replay:window.SylvariaReplay?.snapshot?.()||null,coach:window.SylvariaCoach?.snapshot?.()||null,enemies:snap.enemies?.map(e=>{const live=state.enemies.find(x=>x.id===e.id);return{...e,kineticType:live?.kineticType||null,kineticState:live?.state||e.pattern}}),visual:{...(snap.visual||{}),version:VERSION,presentationVersion:PRESENTATION,continuousGlide:true,chargedOmniDash:true,kineticTongueArc:true,tangentReflection:true,predictiveArcEvasion:true,expandedEnemyRoster:true,currentStreams:true}}};
}
const visual=window.SylvariaVisualSystem;
if(visual){const base=visual.snapshot.bind(visual);visual.version=VERSION;visual.presentationVersion=PRESENTATION;visual.snapshot=()=>({...base(),version:VERSION,presentationVersion:PRESENTATION,continuousGlide:true,chargedOmniDash:true,kineticTongueArc:true,tangentReflection:true,predictiveArcEvasion:true,expandedEnemyRoster:true,currentStreams:true})}
window.Sylvararia013=G;
window.Sylvaria013=G;
window.SylvariaCombat013=Object.freeze({version:VERSION,presentationVersion:PRESENTATION,kinetics:window.SylvariaKinetics,ai:window.SylvariaKineticAI,replay:window.SylvariaReplay});
