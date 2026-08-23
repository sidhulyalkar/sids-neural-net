// v0.15 intentionally changes the primary player verb. It inherits the deterministic
// v0.14 combat substrate, then replaces charged dash / directional tongue control with
// independent aim + immediate Cutstep geometry. Ranking stays quarantined.
window.SylvariaRankedDisabledReason='v0.15 Cutstep alpha · verifier migration required';

await import('./v014-entry.js');
await import('./v015/cutstep-v015.js');
await import('./v015/encounter-director-v015.js');
await import('./v015/forest-world-v015.js');
await import('./v015/discoveries-v015.js');
await import('./v015/forest-actors-v015.js');
await import('./v015/cutstep-presentation-v015.js');

const G=window.Sylvaria091,F=G.fn,state=G.state,$=G.$;
const VERSION='0.15.0',PRESENTATION='0.15.0';

function roomInstruction(){
  const cut=window.SylvariaCutstep?.snapshot?.(),forest=window.SylvariaForestTheme?.snapshot?.(),encounter=window.SylvariaEncounterDirector?.snapshot?.(),discoveries=window.SylvariaDiscoveries?.snapshot?.();
  if(state.boss&&!state.boss.dead)return'Break the Walking Sawmill’s guard with returned fire and environmental lines. Keep one Cutstep for the exposed core.';
  if((cut?.segments||0)<1)return'Rooted. Keep drifting, carve understory for micro-refill, or return a projectile to earn movement immediately.';
  const live=encounter?.alive||[],precision=live.some(e=>e.role==='precision'),control=live.some(e=>e.role==='control'),heavy=live.some(e=>e.role==='heavy');
  if(control)return'Route first. Cable and spore control can turn a safe Cutstep into a dead end. Break the control role before chasing damage.';
  if(heavy&&precision)return'Priority check: read the ranged line, then flank the heavy. Front armor is a trap for impatient Cutsteps.';
  if(precision)return'Watch the warm aiming line. Cut through the projectile path, return it, then spend the refill on the shooter.';
  if((discoveries?.discoveries||[]).some(d=>!d.collected&&!d.expired))return'A discovery is alive in the mist. Decide whether the safer route is worth abandoning before it disappears.';
  if((forest?.cutFoliage||0)<8)return'Carve one sightline, not the whole forest. Visibility is temporary and the clearing will grow shut behind you.';
  return'Chain geometry. Straight lines THRUST, right angles CROSSCUT, hard reversals burst nearby projectiles back into the fight.';
}
const inheritedHud=F.updateHud;
F.updateHud=(force=false)=>{
  inheritedHud?.(force);
  if(state.mode!=='playing')return;
  const task=$('roomTask');if(task)task.textContent=roomInstruction();
  const treeLabel=document.querySelector('#runRail>div:first-child b');if(treeLabel)treeLabel.textContent='canopy';
  const field=$('fieldState'),alive=state.enemies.filter(e=>!e.dead).length;if(field){const elite=state.enemies.filter(e=>!e.dead&&['shield','harvester'].includes(e.v015Archetype)).length;field.textContent=alive?`${alive} threats${elite?` · ${elite} heavy`:''}`:state.boss&&!state.boss.dead?'boss engaged':'quiet'}
};

const eyebrow=document.querySelector('#title .eyebrow');if(eyebrow)eyebrow.textContent='v0.15 · POLISHED FOREST COMBAT ALPHA';
const lede=document.querySelector('#title .lede');if(lede)lede.textContent='Carve survival lines through a dark living forest under industrial attack. WASD moves the guardian. Arrow keys or mouse aim independently. SPACE or click instantly Cutsteps through brush, projectiles, enemies, traps, and openings.';
const micro=document.querySelector('#title .microcopy');if(micro)micro.textContent='Twelve curated escalating clearings teach interception, route control, flanking, target priority, machinery pressure, discoveries, a miniboss, and the Walking Sawmill. Endless depths continue scaling cadence and composition without flooding the screen.';
const season=$('rankSeason');if(season)season.textContent='v0.15 alpha · unranked';
const rankPanel=$('rankPanel');if(rankPanel)rankPanel.hidden=true;

const howTitle=document.querySelector('#howScreen h2');if(howTitle)howTitle.textContent='Move freely. Aim independently. Draw the next survival line.';
const how=document.querySelector('#howScreen .howGrid');if(how)how.innerHTML=`
  <div><b>Move</b><p>WASD controls body movement only. Drift continuously while reading the next threat.</p></div>
  <div><b>Aim</b><p>Arrow-key chords give crisp 8-way aim. The mouse gives free-angle aim anywhere in the clearing.</p></div>
  <div><b>Cutstep</b><p>SPACE or left click fires immediately. The movement segment itself is the blade, counter, traversal line, and environmental cut.</p></div>
  <div><b>Chain geometry</b><p>Continue nearly straight for THRUST, turn about ninety degrees for CROSSCUT, or reverse hard for a projectile-clearing REVERSAL.</p></div>
  <div><b>Three segments</b><p>Segments refill slowly. Returned projectiles, kills, and carved understory sustain aggressive chains much faster.</p></div>
  <div><b>Read enemy jobs</b><p>Loggers engage, nailguns and surveyors define lanes, trappers and spores deny routes, shield crews demand flanks, and Harvesters punish passive play.</p></div>
  <div><b>Carve visibility</b><p>Dense forest obscures minor threats. Cutstep opens temporary sightlines, then deterministic regrowth closes them again.</p></div>
  <div><b>Risk discoveries</b><p>Moonflowers restore survival resources, Spirit Stags strengthen projectile returns, and Root Shrines let your Cutstep angle choose a lasting blessing.</p></div>`;
const controlsTitle=document.querySelector('#controlsScreen h2');if(controlsTitle)controlsTitle.textContent='Movement and aim are independent.';
const bindings=document.querySelector('#controlsScreen .bindingGrid');if(bindings)bindings.innerHTML=`
  <div><span>move north</span><b>W</b></div><div><span>aim north</span><b>↑</b></div>
  <div><span>move south</span><b>S</b></div><div><span>aim south</span><b>↓</b></div>
  <div><span>move west</span><b>A</b></div><div><span>aim west</span><b>←</b></div>
  <div><span>move east</span><b>D</b></div><div><span>aim east</span><b>→</b></div>
  <div><span>instant Cutstep</span><b>SPACE</b></div><div><span>free aim / Cutstep</span><b>mouse</b></div>
  <div><span>pause</span><b>P</b></div><div><span>mute</span><b>M</b></div>`;
const controlsMicro=document.querySelector('#controlsScreen .microcopy');if(controlsMicro)controlsMicro.textContent='Aim is a promise. WASD cannot bend a committed Cutstep. Survive by choosing the line before you press, then earning the next segment through good geometry.';

for(const id of['start','explore'])$(id)?.addEventListener('click',()=>queueMicrotask(()=>{const t=$('toast');if(t)t.textContent='WASD move · arrows/mouse aim · SPACE/click CUTSTEP · carve · counter · chain'}));

const playtest=window.__MOSSLIGHT_PLAYTEST__;
if(playtest){
  const base=playtest.snapshot.bind(playtest);playtest.version=VERSION;playtest.engineVersion=VERSION;playtest.presentationVersion=PRESENTATION;
  playtest.cutstep=(x=1,y=0)=>{window.SylvariaCutstep?.launch?.({x,y,source:'playtest'});return playtest.snapshot()};
  playtest.snapshot=()=>{const snap=base();return{...snap,version:VERSION,engineVersion:VERSION,presentationVersion:PRESENTATION,cutstep:window.SylvariaCutstep?.snapshot?.()||null,forest:window.SylvariaForestTheme?.snapshot?.()||null,encounter:window.SylvariaEncounterDirector?.snapshot?.()||null,discoveries:window.SylvariaDiscoveries?.snapshot?.()||null,actors:window.SylvariaForestActors?.snapshot?.()||null,cutstepPresentation:window.SylvariaCutstepPresentation?.snapshot?.()||null,visual:{...(snap.visual||{}),version:VERSION,presentationVersion:PRESENTATION,cutstep:true,instantCutstep:true,independentAim:true,mouseAim:true,arrowAim:true,segmentedMovement:true,geometryTechniques:true,denseForest:true,regrowingUndergrowth:true,forestFog:true,curatedEncounters:true,professionalForestActors:true,meaningfulDiscoveries:true,escalatingDifficulty:true,ranked:false}}};
}
const visual=window.SylvariaVisualSystem;
if(visual){const base=visual.snapshot.bind(visual);visual.version=VERSION;visual.presentationVersion=PRESENTATION;visual.snapshot=()=>({...base(),version:VERSION,presentationVersion:PRESENTATION,cutstep:true,instantCutstep:true,independentAim:true,denseForest:true,regrowingUndergrowth:true,forestFog:true,curatedEncounters:true,professionalForestActors:true,meaningfulDiscoveries:true,ranked:false})}

window.Sylvaria015=G;
window.SylvariaCombat015=Object.freeze({version:VERSION,presentationVersion:PRESENTATION,ranked:false,cutstep:window.SylvariaCutstep,forest:window.SylvariaForestTheme,encounter:window.SylvariaEncounterDirector,discoveries:window.SylvariaDiscoveries,actors:window.SylvariaForestActors,presentation:window.SylvariaCutstepPresentation});
