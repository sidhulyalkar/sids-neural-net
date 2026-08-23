import{VERSION,FIXED_DT,WORLD}from'./config-v3.js';
import{InputController,prettyKey}from'./input-v3.js';
import{SylvariaEngine}from'./engine-v3.js';
import{SylvariaRenderer}from'./render-v3.js';

const canvas=document.getElementById('game');
const input=new InputController();
const ui={
  intro:document.getElementById('intro'),complete:document.getElementById('complete'),dead:document.getElementById('dead'),pause:document.getElementById('pausePanel'),settings:document.getElementById('settingsPanel'),
  health:document.getElementById('health'),objective:document.getElementById('objective'),zone:document.getElementById('zone'),altitude:document.getElementById('altitude'),airStep:document.getElementById('airStep'),
  boss:document.getElementById('bossHud'),bossName:document.getElementById('bossName'),bossBar:document.getElementById('bossBar'),bossGuard:document.getElementById('bossGuard'),stats:document.getElementById('completeStats'),
  bindList:document.getElementById('bindList'),settingsButton:document.getElementById('settingsButton'),closeSettings:document.getElementById('closeSettings'),resetBindings:document.getElementById('resetBindings'),start:document.getElementById('start'),restart:document.getElementById('restart'),retry:document.getElementById('retry'),resume:document.getElementById('resume'),
};

let audioCtx=null;
function tone(freq=300,duration=.05,gain=.022,type='triangle'){
  try{audioCtx??=new AudioContext();const o=audioCtx.createOscillator(),a=audioCtx.createGain();o.type=type;o.frequency.value=freq;a.gain.setValueAtTime(gain,audioCtx.currentTime);a.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);o.connect(a).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch{}
}
function feedback(event){
  const tones={jump:[350,.04,.018],wallLaunch:[410,.04,.02],vineGrab:[285,.035,.018],vineRelease:[430,.05,.02],dash:[525,.04,.022],reflect:[760,.05,.032,'square'],hurt:[92,.12,.05,'sawtooth'],kill:[125,.07,.028,'square'],checkpoint:[650,.09,.024],guardBreak:[185,.08,.035,'square'],bossStart:[72,.28,.035,'sawtooth'],bossPhase:[105,.13,.035,'square'],bossDead:[82,.28,.045,'sawtooth']};
  if(event.type==='attack'){const map={side:340,up:395,down:285,plunge:230,dash:520,wall:365};tone(map[event.attack]||330,.04,.023);return}
  if(event.type==='impact'){if(event.kind==='heavy')tone(175,.045,.02);return}
  const spec=tones[event.type];if(spec)tone(spec[0],spec[1],spec[2],spec[3]);
  if(event.type==='dead')ui.dead?.classList.remove('hidden');
  if(event.type==='complete'){ui.complete?.classList.remove('hidden');const s=event.stats;ui.stats.textContent=`${Math.round(s.maxHeight/10)}m ascended · ${s.kills} threats cleared · ${s.reflects} redirects · ${s.downslashes+s.plunges} downward strikes`}
}

const engine=new SylvariaEngine(input,feedback);
const renderer=new SylvariaRenderer(canvas,engine);
let modeBeforeOverlay='menu';

function updateHud(){
  const p=engine.state.player,zone=engine.zone(),boss=engine.world.boss;if(!p)return;
  const remaining=engine.world.enemies.filter(e=>!e.dead&&e.y>=zone.top&&e.y<zone.bottom).length;
  ui.health.textContent=`BARK ${'●'.repeat(Math.max(0,p.hp))}${'○'.repeat(Math.max(0,p.maxHp-p.hp))}`;
  ui.zone.textContent=zone.name;ui.altitude.textContent=`${Math.max(0,Math.round((WORLD.h-p.y)/10))} M`;
  ui.objective.textContent=engine.state.bossActive&&!boss.dead?'BREAK THE CROWN FELLER · DOWNSTRIKE OR DASH THROUGH ITS GUARD':boss.dead?'THE CROWN IS OPEN · ASCEND':`${remaining} THREAT${remaining===1?'':'S'} IN THIS BAND · CLIMB`;
  ui.airStep.textContent=`AIR STEP ${p.airDash?'●':'○'}`;
  if(engine.state.bossActive&&!boss.dead){ui.boss?.classList.remove('hidden');ui.bossName.textContent=`${boss.name} · PHASE ${boss.phase}`;ui.bossBar.style.width=`${Math.max(0,Math.min(1,boss.hp/boss.maxHp))*100}%`;ui.bossGuard.textContent=boss.guard>0?`GUARD ${boss.guard}/${boss.maxGuard}`:`CORE OPEN ${engine.state.bossOpenTimer.toFixed(1)}s`}else ui.boss?.classList.add('hidden');
}

const bindLabels={left:'Move left',right:'Move right',up:'Aim up / grab vine',down:'Aim down / drop',jump:'Jump',attack:'Machete attack',dash:'Aerial dash',interact:'Vine interact',pause:'Pause',restart:'Restart'};
function renderBindings(snapshot){if(!ui.bindList)return;ui.bindList.innerHTML='';for(const action of Object.keys(bindLabels)){const row=document.createElement('button');row.type='button';row.className='bindRow';const listening=snapshot.captureAction===action;row.innerHTML=`<span>${bindLabels[action]}</span><b>${listening?'PRESS A KEY':prettyKey(snapshot.bindings[action])}</b>`;row.addEventListener('click',()=>input.beginCapture(action));ui.bindList.append(row)}}
input.subscribe(renderBindings);

function openSettings(){modeBeforeOverlay=engine.state.mode;if(engine.state.mode==='playing')engine.setMode('paused');ui.settings?.classList.remove('hidden')}
function closeSettings(){ui.settings?.classList.add('hidden');input.cancelCapture();if(engine.state.mode==='paused'&&modeBeforeOverlay==='playing')engine.setMode('playing')}
function startGame(){audioCtx??=new AudioContext();engine.reset(true);ui.intro?.classList.add('hidden');ui.dead?.classList.add('hidden');ui.complete?.classList.add('hidden');ui.pause?.classList.add('hidden');updateHud()}
function togglePause(){if(engine.state.mode==='playing'){engine.setMode('paused');ui.pause?.classList.remove('hidden')}else if(engine.state.mode==='paused'&&ui.settings?.classList.contains('hidden')){engine.setMode('playing');ui.pause?.classList.add('hidden')}}

ui.start?.addEventListener('click',startGame);ui.restart?.addEventListener('click',startGame);ui.retry?.addEventListener('click',startGame);ui.resume?.addEventListener('click',togglePause);ui.settingsButton?.addEventListener('click',openSettings);ui.closeSettings?.addEventListener('click',closeSettings);ui.resetBindings?.addEventListener('click',()=>input.reset());

let last=performance.now(),acc=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;acc+=dt;let steps=0;
  while(acc>=FIXED_DT&&steps<8){if(input.take('pause')&&!input.captureAction)togglePause();if(input.take('restart')&&(engine.state.mode==='dead'||engine.state.mode==='complete'))startGame();engine.update(FIXED_DT);acc-=FIXED_DT;steps++}
  if(engine.state.visualHold>0)engine.state.visualHold--;else renderer.render();updateHud();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__SYLVARIA_V3__={version:VERSION,fixedDt:FIXED_DT,engine,input,get state(){return engine.state},get world(){return engine.world},reset:startGame,step:(ticks=1)=>{for(let i=0;i<ticks;i++)engine.update(FIXED_DT);updateHud();return engine.snapshot()},snapshot:()=>engine.snapshot()};
updateHud();
