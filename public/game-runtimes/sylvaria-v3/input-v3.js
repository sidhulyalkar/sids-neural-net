import{DEFAULT_BINDINGS}from'./config-v3.js';

const STORAGE_KEY='sylvaria-v3-bindings';
const PREVENT_DEFAULT=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space']);

export class InputController{
  constructor(){
    this.bindings={...DEFAULT_BINDINGS};
    this.held=new Set();
    this.pressed=new Set();
    this.captureAction=null;
    this.listeners=[];
    this.load();
    this.onDown=this.onDown.bind(this);
    this.onUp=this.onUp.bind(this);
    addEventListener('keydown',this.onDown,{passive:false});
    addEventListener('keyup',this.onUp,{passive:false});
    addEventListener('blur',()=>this.clear());
  }
  load(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw)return;
      const parsed=JSON.parse(raw);
      for(const action of Object.keys(DEFAULT_BINDINGS))if(typeof parsed?.[action]==='string')this.bindings[action]=parsed[action];
    }catch{}
  }
  save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.bindings))}catch{}}
  clear(){this.held.clear();this.pressed.clear()}
  code(action){return this.bindings[action]}
  is(action){return this.held.has(this.code(action))}
  take(action){const code=this.code(action),had=this.pressed.has(code);this.pressed.delete(code);return had}
  axisX(){return(this.is('right')?1:0)-(this.is('left')?1:0)}
  axisY(){return(this.is('down')?1:0)-(this.is('up')?1:0)}
  direction(){const x=this.axisX(),y=this.axisY();const m=Math.hypot(x,y);return m?{x:x/m,y:y/m}:{x:0,y:0}}
  beginCapture(action){if(!(action in this.bindings))return;this.captureAction=action;this.emit()}
  cancelCapture(){this.captureAction=null;this.emit()}
  reset(){this.bindings={...DEFAULT_BINDINGS};this.captureAction=null;this.save();this.emit()}
  bind(action,code){
    if(!(action in this.bindings)||!code)return;
    for(const [other,otherCode]of Object.entries(this.bindings))if(other!==action&&otherCode===code)this.bindings[other]=DEFAULT_BINDINGS[other];
    this.bindings[action]=code;
    this.captureAction=null;
    this.clear();
    this.save();
    this.emit();
  }
  onDown(event){
    if(this.captureAction){event.preventDefault();this.bind(this.captureAction,event.code);return}
    if(PREVENT_DEFAULT.has(event.code)||Object.values(this.bindings).includes(event.code))event.preventDefault();
    if(!this.held.has(event.code))this.pressed.add(event.code);
    this.held.add(event.code);
  }
  onUp(event){if(PREVENT_DEFAULT.has(event.code)||Object.values(this.bindings).includes(event.code))event.preventDefault();this.held.delete(event.code)}
  subscribe(listener){this.listeners.push(listener);listener(this.snapshot());return()=>{this.listeners=this.listeners.filter(item=>item!==listener)}}
  emit(){const value=this.snapshot();for(const listener of this.listeners)listener(value)}
  snapshot(){return{bindings:{...this.bindings},captureAction:this.captureAction}}
  destroy(){removeEventListener('keydown',this.onDown);removeEventListener('keyup',this.onUp);this.listeners=[]}
}

export function prettyKey(code){
  const map={ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'SPACE',ShiftLeft:'L SHIFT',ShiftRight:'R SHIFT',Escape:'ESC'};
  if(map[code])return map[code];
  if(code.startsWith('Key'))return code.slice(3);
  if(code.startsWith('Digit'))return code.slice(5);
  return code.replace('Left',' L').replace('Right',' R').toUpperCase();
}
