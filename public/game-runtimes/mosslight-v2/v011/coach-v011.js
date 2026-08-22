const G=window.Sylvaria091,F=G.fn,state=G.state,$=G.$;
const SEEN_KEY='sid.sylvaria.controls.v011';
let enabled=false,practice=false,stage=0,lastPrompt=-99,lastSerial=-1;
function hasSeen(){try{return localStorage.getItem(SEEN_KEY)==='1'}catch{return false}}
function remember(){try{localStorage.setItem(SEEN_KEY,'1')}catch{}}
function canPrompt(){return state.roomTime-lastPrompt>=.55}
function prompt(text){lastPrompt=state.roomTime;F.toast?.(text)}
function begin(force=false){const replay=window.SylvariaReplay?.snapshot?.();lastSerial=replay?.runSerial??lastSerial+1;practice=force;enabled=force||!hasSeen();stage=0;lastPrompt=-99;if(enabled)queueMicrotask(()=>prompt('WASD · move'))}
const baseHud=F.updateHud;F.updateHud=(force=false)=>{baseHud?.(force);if(!enabled||state.mode!=='playing')return;const stats=state.stats;if(stage===0&&stats.dashes>0&&canPrompt()){stage=1;prompt('arrow keys · cut');return}if(stage===1&&stats.cuts>0&&canPrompt()){stage=2;prompt(state.worldDepth<2?'good · room 2 adds incoming shots':'cut toward incoming shots · reflect');return}if(stage===2&&state.worldDepth>=2&&state.roomTime>.7&&canPrompt()){stage=3;prompt('cut toward incoming shots · reflect');return}if(stage>=2&&stats.counters>0&&canPrompt()){stage=4;prompt('good · returns damage enemies');remember();if(!practice)enabled=false}};
const baseSetup=F.setupRoom;F.setupRoom=(depth,...rest)=>{const result=baseSetup(depth,...rest);if(enabled&&depth===2&&stage>=2){lastPrompt=-99;queueMicrotask(()=>{if(enabled&&state.mode==='playing'){stage=Math.max(stage,3);prompt('cut toward incoming shots · reflect')}})}return result};
// Learn Controls is explicitly non-ranked. Until the player demonstrates the
// core move + cut + reflect grammar, a failure restores the practice field
// instead of ending the session. Normal and ranked runs never enter this path.
const baseEnd=F.endRun;F.endRun=reason=>{if(practice&&enabled&&stage<4&&state.mode==='playing'){const p=state.player;if(p){p.hp=p.maxHp;p.invuln=Math.max(p.invuln||0,1.25)}for(const tree of state.trees){tree.alive=true;tree.hp=tree.maxHp}state.roomClearTimer=0;state.flash=0;state.shake=0;prompt(stage>=2?'practice · land one reflect':'practice · keep going');return}return baseEnd?.(reason)};
$('start')?.addEventListener('click',()=>begin(false));
$('restartRun')?.addEventListener('click',()=>begin(false));
$('explore')?.addEventListener('click',()=>begin(true));
document.addEventListener('keydown',event=>{if(event.repeat||String(event.key).toLowerCase()!=='enter')return;queueMicrotask(()=>{const serial=window.SylvariaReplay?.snapshot?.().runSerial;if(state.mode==='playing'&&state.runMode==='run'&&serial!==lastSerial)begin(false)})});
window.SylvariaCoach=Object.freeze({version:'0.11.1',snapshot:()=>({enabled,practice,stage,forgiving:practice&&enabled&&stage<4})});
