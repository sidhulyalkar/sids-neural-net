const G=window.Sylvaria091;
const {state}=G,F=G.fn;

export const COMBAT_READABILITY_VERSION='0.14.0';
export const PROJECTILE_VISUALS=Object.freeze({
  nail:Object.freeze({radius:8.5,halo:15,color:'#ffc887'}),
  saw:Object.freeze({radius:11.5,halo:19,color:'#9beeff'}),
  survey:Object.freeze({radius:10,halo:17,color:'#8ffff0'}),
  tape:Object.freeze({radius:10,halo:17,color:'#e2b4ff'}),
  paper:Object.freeze({radius:9.5,halo:16,color:'#c7d2ff'}),
  boss:Object.freeze({radius:11,halo:19,color:'#ff9c8d'}),
  chip:Object.freeze({radius:10,halo:17,color:'#f2b878'}),
  coin:Object.freeze({radius:9.5,halo:16,color:'#ffe77e'}),
  reflected:Object.freeze({radius:12.5,halo:21,color:'#ecffb8'}),
});
const KINETIC_RING=Object.freeze({skimmer:'#8eeeff',strider:'#d9ffe8',sniper:'#ffe09a',shellback:'#e6efc9'});
const KINETIC_LABEL=Object.freeze({skimmer:'SKIMMER',strider:'LUNGE',sniper:'NEEDLE',shellback:'SHELL'});

function shotVisual(s){return s.friendly?PROJECTILE_VISUALS.reflected:PROJECTILE_VISUALS[s.kind]||PROJECTILE_VISUALS.nail}
function approachingPlayer(s){
  const p=state.player;if(!p||s.friendly)return false;
  const dx=p.x-s.x,dy=p.y-s.y,d=Math.hypot(dx,dy)||1,v=Math.hypot(s.vx,s.vy)||1;
  return d<250&&(dx*s.vx+dy*s.vy)/(d*v)>.12;
}
function drawProjectiles(ctx){
  const p=state.player;
  for(const s of state.shots){
    if(s.dead)continue;const style=shotVisual(s),hot=approachingPlayer(s),pulse=1+Math.sin((state.roomTime||0)*15+(s.age||0)*11)*.05;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=s.friendly?'rgba(220,255,174,.14)':hot?'rgba(255,225,158,.14)':'rgba(255,255,255,.055)';ctx.beginPath();ctx.arc(s.x,s.y,style.halo*pulse,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle=style.color;ctx.globalAlpha=s.friendly ? .95 : hot ? .92 : .68;ctx.lineWidth=s.friendly ? 2.6 : hot ? 2.2 : 1.6;ctx.beginPath();ctx.arc(s.x,s.y,style.radius,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=style.color;ctx.globalAlpha=s.friendly ? 1 : .86;ctx.beginPath();ctx.arc(s.x,s.y,Math.max(2.8,style.radius*.34),0,Math.PI*2);ctx.fill();
    if(hot&&p){ctx.globalAlpha=.35;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(s.x,s.y,style.halo+4,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}ctx.restore();
  }
}
function drawKineticThreats(ctx){
  for(const e of state.enemies){
    if(e.dead||!e.kineticType)continue;const color=KINETIC_RING[e.kineticType]||'#eaffcf',r=e.r+9,telegraph=e.state==='kinetic-telegraph',open=e.v014PunishTimer>0,label=open?'OPEN':KINETIC_LABEL[e.kineticType]||'ELITE';
    ctx.save();ctx.fillStyle=color;ctx.globalAlpha=open?.13:.055;ctx.beginPath();ctx.arc(e.x,e.y,e.r+5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=color;ctx.globalAlpha=open?.92:telegraph?.82:.34;ctx.lineWidth=open?2.8:telegraph?2.4:1.5;ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.stroke();
    if(e.kineticType==='sniper'&&telegraph&&state.player){ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(state.player.x,state.player.y);ctx.stroke();ctx.setLineDash([])}
    if(e.kineticType==='strider'&&telegraph){const a=e.facingAngle||0,side=Math.PI*.78;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r);ctx.lineTo(e.x+Math.cos(a+side)*(r+8),e.y+Math.sin(a+side)*(r+8));ctx.moveTo(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r);ctx.lineTo(e.x+Math.cos(a-side)*(r+8),e.y+Math.sin(a-side)*(r+8));ctx.stroke()}
    if(e.kineticType==='shellback'){const a=e.facingAngle||0;ctx.lineWidth=4;ctx.globalAlpha=.72;ctx.beginPath();ctx.arc(e.x,e.y,e.r+6,a-.72,a+.72);ctx.stroke()}
    ctx.globalAlpha=open?.95:.66;ctx.fillStyle=color;ctx.font='700 8px ui-sans-serif,system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(label,e.x,e.y-e.r-11);ctx.restore();
  }
}
function drawReadability(){
  if(state.mode!=='playing'||!state.player)return;const overlay=document.getElementById('flowCanvas'),ctx=overlay?.getContext?.('2d');if(!ctx)return;
  drawProjectiles(ctx);drawKineticThreats(ctx);
}

const inheritedRender=F.render;
F.render=()=>{const result=inheritedRender?.();drawReadability();return result};

const inheritedHud=F.updateHud;
F.updateHud=(force=false)=>{
  inheritedHud?.(force);const field=G.$('fieldState');if(!field||state.mode!=='playing')return;
  const alive=state.enemies.filter(e=>!e.dead),boss=state.boss&&!state.boss.dead?state.boss:null;
  if(boss){const guard=boss.v014GuardMax?`${boss.v014Guard??boss.v014GuardMax}/${boss.v014GuardMax}`:'active';field.textContent=boss.v014PunishTimer>0?'CORE OPEN':`boss guard ${guard}`}
  else if(alive.length){const kinetic=alive.filter(e=>e.kineticType).length;field.textContent=kinetic?`${alive.length} threats · ${kinetic} elite`:`${alive.length} threats`}
  else field.textContent='clear';
};

window.SylvariaCombatReadability=Object.freeze({
  version:COMBAT_READABILITY_VERSION,
  projectileVisuals:PROJECTILE_VISUALS,
  snapshot:()=>({version:COMBAT_READABILITY_VERSION,hostileProjectiles:state.shots.filter(s=>!s.dead&&!s.friendly).length,friendlyProjectiles:state.shots.filter(s=>!s.dead&&s.friendly).length,aliveThreats:state.enemies.filter(e=>!e.dead).length,kineticThreats:state.enemies.filter(e=>!e.dead&&e.kineticType).length}),
});
