const G=window.Sylvaria091,F=G.fn,state=G.state;
const $=G.$,VERSION='0.13.0',SEEN_KEY='sid.sylvaria.controls.v013';
let enabled=false,practice=false,stage=0,lastPrompt=-99,lastSerial=-1,startPoint=null;
function hasSeen(){try{return localStorage.getItem(SEEN_KEY)==='1'}catch{return false}}
function remember(){try{localStorage.setItem(SEEN_KEY,'1')}catch{}}
function canPrompt(){return state.roomTime-lastPrompt>=.48}
function prompt(text){lastPrompt=state.roomTime;F.toast?.(text)}
function begin(force=false){const replay=window.SylvariaReplay?.snapshot?.();lastSerial=replay?.runSerial??lastSerial+1;practice=force;enabled=force||!hasSeen();stage=0;lastPrompt=-99;startPoint=state.player?{x:state.player.x,y:state.player.y}:null;if(enabled)queueMicrotask(()=>prompt('WASD · glide freely'))}
const baseHud=F.updateHud;F.updateHud=(force=false)=>{baseHud?.(force);if(!enabled||state.mode!=='playing'||!state.player)return;const p=state.player,stats=state.stats;if(stage===0&&startPoint&&Math.hypot(p.x-startPoint.x,p.y-startPoint.y)>38&&canPrompt()){stage=1;prompt('hold SPACE · charge · release to dash');return}if(stage===1&&stats.dashes>0&&canPrompt()){stage=2;prompt('arrow key · sweep the tongue');return}if(stage===2&&stats.cuts>0&&canPrompt()){stage=3;prompt('meet a projectile near mid-swing · reflect');return}if(stage===3&&stats.counters>0&&canPrompt()){stage=4;prompt('good · reflected shots become your offense');remember();if(!practice)enabled=false}};
const baseEnd=F.endRun;F.endRun=reason=>{if(practice&&enabled&&stage<4&&state.mode==='playing'){const p=state.player;if(p){p.hp=p.maxHp;p.invuln=Math.max(p.invuln||0,1.1);p.vx=0;p.vy=0;p.dash=null;p.dashCharging=false}for(const tree of state.trees){tree.alive=true;tree.hp=tree.maxHp}state.roomClearTimer=0;state.flash=0;state.shake=0;prompt(stage>=3?'practice · time one clean reflect':'practice · keep moving');return}return baseEnd?.(reason)};
$('start')?.addEventListener('click',()=>queueMicrotask(()=>begin(false)));
$('restartRun')?.addEventListener('click',()=>queueMicrotask(()=>begin(false)));
$('explore')?.addEventListener('click',()=>queueMicrotask(()=>begin(true)));
document.addEventListener('keydown',event=>{if(event.repeat||String(event.key).toLowerCase()!=='enter')return;queueMicrotask(()=>{const serial=window.SylvariaReplay?.snapshot?.().runSerial;if(state.mode==='playing'&&state.runMode==='run'&&serial!==lastSerial)begin(false)})});
window.SylvariaCoach=Object.freeze({version:VERSION,snapshot:()=>({version:VERSION,enabled,practice,stage,forgiving:practice&&enabled&&stage<4})});
