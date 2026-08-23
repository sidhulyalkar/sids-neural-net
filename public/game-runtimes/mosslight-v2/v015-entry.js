// v0.15 intentionally changes the primary player verb. It inherits the deterministic
// v0.14 combat substrate, then replaces charged dash / directional tongue control with
// independent aim + immediate Cutstep geometry. Ranking stays quarantined.
window.SylvariaRankedDisabledReason='v0.15 Cutstep prototype · verifier migration required';

await import('./v014-entry.js');
await import('./v015/cutstep-v015.js');
await import('./v015/forest-theme-v015.js');
await import('./v015/cutstep-presentation-v015.js');

const G=window.Sylvaria091,F=G.fn,state=G.state,$=G.$;
const VERSION='0.15.0',PRESENTATION='0.15.0';

function roomInstruction(){
  const cut=window.SylvariaCutstep?.snapshot?.(),forest=window.SylvariaForestTheme?.snapshot?.();
  if(state.boss&&!state.boss.dead)return'Carve attack lines through incoming fire and the forest edge. Break the machine’s guard, then spend your next segment on the exposed core.';
  if((cut?.segments||0)<1)return'You are rooted. Keep moving, carve brush for micro-refill, or cut a projectile back to recover a segment.';
  if((forest?.cutFoliage||0)<8)return'Aim with Arrow keys or mouse. SPACE / click Cutsteps instantly. Carve one sightline before the forest closes around the fight.';
  return'Chain lines. Straight continuations THRUST, right-angle turns CROSSCUT, and hard reversals burst nearby projectiles back into the clearing.';
}
const inheritedHud=F.updateHud;
F.updateHud=(force=false)=>{
  inheritedHud?.(force);
  if(state.mode!=='playing')return;
  const task=$('roomTask');if(task)task.textContent=roomInstruction();
  const treeLabel=document.querySelector('#runRail>div:first-child b');if(treeLabel)treeLabel.textContent='canopy';
  const field=$('fieldState'),alive=state.enemies.filter(e=>!e.dead).length;if(field&&alive===0&&!state.boss)field.textContent='quiet';
};

const eyebrow=document.querySelector('#title .eyebrow');if(eyebrow)eyebrow.textContent='v0.15 · CUTSTEP CLEARING';
const lede=document.querySelector('#title .lede');if(lede)lede.textContent='A fast forest-survival prototype about drawing lethal movement lines through a living battlefield. WASD moves the guardian. Arrow keys or mouse aim independently. SPACE or click instantly Cutsteps through brush, attacks, projectiles, and openings.';
const micro=document.querySelector('#title .microcopy');if(micro)micro.textContent='This build deliberately scopes back to one question: is carving and chaining geometric survival lines fun enough to restart immediately? Dark forest biomes, regrowing visibility, readable enemy pressure, and ecological refills all serve that single verb.';
const season=$('rankSeason');if(season)season.textContent='v0.15 prototype';
const rankPanel=$('rankPanel');if(rankPanel)rankPanel.hidden=true;

const howTitle=document.querySelector('#howScreen h2');if(howTitle)howTitle.textContent='Move freely. Aim independently. Draw the next line.';
const how=document.querySelector('#howScreen .howGrid');if(how)how.innerHTML=`
  <div><b>Move</b><p>WASD controls body movement only. Keep drifting while you read the clearing.</p></div>
  <div><b>Aim</b><p>Hold Arrow-key chords for crisp 8-way aim, or point the mouse anywhere in the forest for a free-angle line.</p></div>
  <div><b>Cutstep</b><p>SPACE or left click fires immediately. There is no charge delay. The short movement segment itself is the blade.</p></div>
  <div><b>Chain geometry</b><p>Continue nearly straight for THRUST, turn roughly ninety degrees for CROSSCUT, or reverse hard for a projectile-clearing REVERSAL.</p></div>
  <div><b>Three segments</b><p>You carry three Cutstep segments. They refill slowly, but counters, kills, and cutting dense understory restore them much faster.</p></div>
  <div><b>Carve sightlines</b><p>Dense ferns and grass obscure the battlefield. Cutstep severs them instantly. The forest regrows, so safe visibility is temporary.</p></div>
  <div><b>No blanket invulnerability</b><p>A Cutstep protects the line your blade actually occupies. Bad angles can still get you hit.</p></div>
  <div><b>Explore through temptation</b><p>Useful discoveries glow through the mist. Leaving a safe line to reach them should be a deliberate survival decision.</p></div>`;
const controlsTitle=document.querySelector('#controlsScreen h2');if(controlsTitle)controlsTitle.textContent='Movement and aim are independent.';
const bindings=document.querySelector('#controlsScreen .bindingGrid');if(bindings)bindings.innerHTML=`
  <div><span>move north</span><b>W</b></div><div><span>aim north</span><b>↑</b></div>
  <div><span>move south</span><b>S</b></div><div><span>aim south</span><b>↓</b></div>
  <div><span>move west</span><b>A</b></div><div><span>aim west</span><b>←</b></div>
  <div><span>move east</span><b>D</b></div><div><span>aim east</span><b>→</b></div>
  <div><span>instant Cutstep</span><b>SPACE</b></div><div><span>free aim / Cutstep</span><b>mouse</b></div>
  <div><span>pause</span><b>P</b></div><div><span>mute</span><b>M</b></div>`;
const controlsMicro=document.querySelector('#controlsScreen .microcopy');if(controlsMicro)controlsMicro.textContent='WASD never changes your aim. Arrow chords or the mouse determine the Cutstep line. Chaining is about drawing geometry through the fight, not charging a dash meter.';

for(const id of['start','explore'])$(id)?.addEventListener('click',()=>queueMicrotask(()=>{const t=$('toast');if(t)t.textContent='WASD move · arrows/mouse aim · SPACE/click CUTSTEP · chain the line'}));

const playtest=window.__MOSSLIGHT_PLAYTEST__;
if(playtest){
  const base=playtest.snapshot.bind(playtest);playtest.version=VERSION;playtest.engineVersion=VERSION;playtest.presentationVersion=PRESENTATION;
  playtest.cutstep=(x=1,y=0)=>{window.SylvariaCutstep?.launch?.({x,y,source:'playtest'});return playtest.snapshot()};
  playtest.snapshot=()=>{const snap=base();return{...snap,version:VERSION,engineVersion:VERSION,presentationVersion:PRESENTATION,cutstep:window.SylvariaCutstep?.snapshot?.()||null,forest:window.SylvariaForestTheme?.snapshot?.()||null,cutstepPresentation:window.SylvariaCutstepPresentation?.snapshot?.()||null,visual:{...(snap.visual||{}),version:VERSION,presentationVersion:PRESENTATION,cutstep:true,instantCutstep:true,independentAim:true,mouseAim:true,arrowAim:true,segmentedMovement:true,geometryTechniques:true,denseForest:true,regrowingUndergrowth:true,forestFog:true,ranked:false}}};
}
const visual=window.SylvariaVisualSystem;
if(visual){const base=visual.snapshot.bind(visual);visual.version=VERSION;visual.presentationVersion=PRESENTATION;visual.snapshot=()=>({...base(),version:VERSION,presentationVersion:PRESENTATION,cutstep:true,instantCutstep:true,independentAim:true,denseForest:true,regrowingUndergrowth:true,forestFog:true,ranked:false})}

window.Sylvaria015=G;
window.SylvariaCombat015=Object.freeze({version:VERSION,presentationVersion:PRESENTATION,ranked:false,cutstep:window.SylvariaCutstep,forest:window.SylvariaForestTheme,presentation:window.SylvariaCutstepPresentation});
