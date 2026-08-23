import{SylvariaRenderer as MotionRenderer}from'./render-motion-v3.js';
import{VIEW,TAU,COLORS,MOVE}from'./config-v3.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const norm=(x,y)=>{const m=Math.hypot(x,y)||1;return{x:x/m,y:y/m}};

export class SylvariaRenderer extends MotionRenderer{
  drawPlatform(platform){
    if(platform.broken)return;
    const ctx=this.ctx,flex=(platform.flex||0)*16,w=platform.w,h=platform.h;
    ctx.save();ctx.translate(platform.x,platform.y+flex);
    if(platform.type==='industrial'){
      ctx.fillStyle='#111817';ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,3);ctx.fill();
      ctx.strokeStyle='#a37a46';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-w/2+7,-h/2+4);ctx.lineTo(w/2-8,-h/2+4);ctx.stroke();
      for(let x=-w/2+17;x<w/2-8;x+=27){ctx.fillStyle='#27302c';ctx.fillRect(x,-h/2+1,5,h-2)}ctx.restore();return;
    }
    const dead=platform.type==='dead',heart=platform.type==='heartwood',sap=platform.type==='sap'&&platform.sapCharged;
    const curve=platform.type==='spring'?(platform.flex||0)*8:2;
    ctx.lineCap='round';
    ctx.strokeStyle='#080c08';ctx.lineWidth=h+10;ctx.beginPath();ctx.moveTo(-w/2+6,4);ctx.quadraticCurveTo(-w*.08,curve+4,w/2-7,-3);ctx.stroke();
    ctx.strokeStyle=dead?'#4b3827':heart?'#594a2d':'#354127';ctx.lineWidth=h;ctx.beginPath();ctx.moveTo(-w/2+7,4);ctx.quadraticCurveTo(-w*.08,curve+3,w/2-8,-3);ctx.stroke();
    ctx.strokeStyle=sap?COLORS.spirit:'#758a4e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-w/2+12,-4);ctx.quadraticCurveTo(0,-8,w/2-14,-8);ctx.stroke();
    for(let i=0;i<Math.max(2,Math.floor(w/52));i++){
      const x=-w*.34+i*w*.27,side=i%2?1:-1;
      ctx.strokeStyle=dead?'rgba(117,87,55,.6)':'rgba(53,75,39,.78)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,6);ctx.lineTo(x+side*9,15+(i%3)*2);ctx.stroke();
    }
    if(sap){ctx.fillStyle='rgba(184,243,212,.26)';ctx.beginPath();ctx.arc(0,-4,10,0,TAU);ctx.fill()}
    ctx.restore();
  }

  drawBarkRail(rail){
    const ctx=this.ctx,dx=rail.bx-rail.ax,dy=rail.by-rail.ay,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,t=rail.thickness||18;
    ctx.save();ctx.lineCap='round';
    ctx.strokeStyle='rgba(5,9,6,.96)';ctx.lineWidth=t+10;ctx.beginPath();ctx.moveTo(rail.ax,rail.ay);ctx.lineTo(rail.bx,rail.by);ctx.stroke();
    ctx.strokeStyle='#3d3523';ctx.lineWidth=t;ctx.beginPath();ctx.moveTo(rail.ax,rail.ay);ctx.quadraticCurveTo((rail.ax+rail.bx)/2+nx*5,(rail.ay+rail.by)/2+ny*5,rail.bx,rail.by);ctx.stroke();
    const mossSign=ny<0?1:-1;ctx.strokeStyle='#769153';ctx.lineWidth=3.2;ctx.beginPath();ctx.moveTo(rail.ax+nx*mossSign*t*.38,rail.ay+ny*mossSign*t*.38);ctx.lineTo(rail.bx+nx*mossSign*t*.38,rail.by+ny*mossSign*t*.38);ctx.stroke();
    for(let i=1;i<4;i++){const k=i/4,x=lerp(rail.ax,rail.bx,k),y=lerp(rail.ay,rail.by,k);ctx.strokeStyle='rgba(111,89,52,.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-nx*t*.25,y-ny*t*.25);ctx.lineTo(x+nx*t*.25,y+ny*t*.25);ctx.stroke()}
    ctx.restore();
  }

  tangentForAnchor(anchor,pos){
    const p=this.engine.state.player;if(!pos)return{x:1,y:0};
    if(p.sapline?.anchorId===anchor.id&&p.sapline.tangent)return p.sapline.tangent;
    if(p.saplineCandidate===anchor.id&&p.saplineCandidateTangent)return p.saplineCandidateTangent;
    const radial=norm(pos.x-p.x,pos.y-p.y),a={x:-radial.y,y:radial.x},b={x:radial.y,y:-radial.x};
    const guide=Math.hypot(p.vx,p.vy)>70?norm(p.vx,p.vy):norm(p.facing*.7,-.45);
    return a.x*guide.x+a.y*guide.y>=b.x*guide.x+b.y*guide.y?a:b;
  }

  drawSapAnchor(anchor){
    const pos=this.engine.anchorPosition?.(anchor);if(!pos)return;
    const ctx=this.ctx,p=this.engine.state.player,active=p.sapline?.anchorId===anchor.id,candidate=p.saplineCandidate===anchor.id;
    const energy=active?(p.sapline?.energy||0):0,load=clamp(energy/120000,0,1),pulse=1+Math.sin(this.engine.state.time*(4.2+load*5)+pos.x*.01)*(.06+load*.06);
    ctx.save();ctx.translate(pos.x,pos.y);ctx.scale(pulse,pulse);
    ctx.fillStyle=active?'rgba(156,240,184,.24)':candidate?'rgba(215,245,183,.18)':'rgba(146,184,112,.09)';ctx.beginPath();ctx.arc(0,0,active?18+load*4:candidate?15:10,0,TAU);ctx.fill();
    ctx.strokeStyle=active?COLORS.sapline:candidate?COLORS.resin:'rgba(177,205,135,.35)';ctx.lineWidth=active?3:2;ctx.beginPath();ctx.arc(0,0,active?9:7,0,TAU);ctx.stroke();
    ctx.fillStyle=active?COLORS.resin:'#88a56a';ctx.beginPath();ctx.ellipse(0,1,4.5,6,-.25,0,TAU);ctx.fill();
    if(active||candidate){
      const tangent=this.tangentForAnchor(anchor,pos),length=candidate?23:25+load*24;
      ctx.strokeStyle=active?`rgba(215,245,183,${.42+load*.4})`:'rgba(215,245,183,.46)';ctx.lineWidth=2+load*1.5;ctx.beginPath();ctx.moveTo(tangent.x*9,tangent.y*9);ctx.quadraticCurveTo(tangent.x*length*.55-tangent.y*3,tangent.y*length*.55+tangent.x*3,tangent.x*length,tangent.y*length);ctx.stroke();
      ctx.beginPath();ctx.moveTo(tangent.x*length,tangent.y*length);ctx.lineTo(tangent.x*(length-7)-tangent.y*4,tangent.y*(length-7)+tangent.x*4);ctx.moveTo(tangent.x*length,tangent.y*length);ctx.lineTo(tangent.x*(length-7)+tangent.y*4,tangent.y*(length-7)-tangent.x*4);ctx.stroke();
    }
    ctx.restore();
  }

  drawSapline(player){
    const tether=player.sapline;if(!tether)return;
    const anchor=(this.engine.world.anchors||[]).find(item=>item.id===tether.anchorId),pos=this.engine.anchorPosition?.(anchor);if(!pos)return;
    const ctx=this.ctx,dx=pos.x-player.x,dy=pos.y-player.y,dist=Math.hypot(dx,dy)||1,extension=Math.max(0,dist-tether.rest),tension=clamp(extension/115,0,1),energy=clamp((tether.energy||0)/120000,0,1);
    const handX=player.x+player.facing*10,handY=player.y-11,sag=(1-tension)*18;
    ctx.save();ctx.lineCap='round';
    ctx.strokeStyle='rgba(7,18,12,.88)';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(handX,handY);ctx.quadraticCurveTo((handX+pos.x)/2,(handY+pos.y)/2+sag,pos.x,pos.y);ctx.stroke();
    ctx.strokeStyle=`rgba(156,240,184,${.68+energy*.28})`;ctx.lineWidth=2.5+tension*1.8;ctx.beginPath();ctx.moveTo(handX,handY);ctx.quadraticCurveTo((handX+pos.x)/2,(handY+pos.y)/2+sag,pos.x,pos.y);ctx.stroke();
    ctx.restore();
  }

  drawGuardian(p){
    const ctx=this.ctx,time=this.engine.state.time,attack=p.attack,air=!p.onGround,wall=p.wallDir&&!p.onGround,tether=!!p.sapline;
    const rawSpeed=Math.hypot(p.vx,p.vy),speed=clamp(rawSpeed/850,0,1),runSpeed=clamp(Math.abs(p.vx)/MOVE.runSpeed,0,1),runPhase=time*(9+runSpeed*13),stride=p.onGround?Math.sin(runPhase)*7:0;
    const vel=rawSpeed>15?norm(p.vx*p.facing,p.vy):{x:0,y:1},tailX=-vel.x*(15+speed*20),tailY=-vel.y*(8+speed*14)+9;
    const blink=p.invuln>0&&Math.floor(time*28)%2===0,lean=wall?-p.wallDir*.12:clamp(p.vx/1050,-.22,.22);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.facing*1.18,1.18);ctx.globalAlpha=blink ? .38 : 1;ctx.rotate(lean);
    ctx.fillStyle='#08150e';ctx.beginPath();ctx.moveTo(-7,-12);ctx.quadraticCurveTo(tailX*.45-14,tailY*.45-4,tailX-7,tailY+12);ctx.quadraticCurveTo(-1,18,9,17);ctx.lineTo(9,-10);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(127,174,105,.38)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-7,-9);ctx.quadraticCurveTo(tailX*.52-8,tailY*.55+2,tailX-4,tailY+9);ctx.stroke();
    ctx.strokeStyle='#6b8a61';ctx.lineWidth=4.2;ctx.lineCap='round';ctx.beginPath();
    if(wall){ctx.moveTo(-5,14);ctx.lineTo(-12,24);ctx.moveTo(6,14);ctx.lineTo(12,19)}else if(air){const tuck=clamp(Math.abs(p.vy)/750,0,1);ctx.moveTo(-6,14);ctx.lineTo(-10,22-tuck*4);ctx.moveTo(6,14);ctx.lineTo(11,22+tuck*2)}else{ctx.moveTo(-6,14);ctx.lineTo(-8+stride,27);ctx.moveTo(6,14);ctx.lineTo(8-stride,27)}ctx.stroke();
    ctx.fillStyle='#203b28';ctx.beginPath();ctx.moveTo(-10,-10);ctx.quadraticCurveTo(-8,-22,1,-25);ctx.quadraticCurveTo(11,-20,11,-7);ctx.lineTo(8,16);ctx.quadraticCurveTo(0,20,-8,15);ctx.closePath();ctx.fill();
    ctx.fillStyle='#55754e';ctx.beginPath();ctx.moveTo(-8,-13);ctx.lineTo(-3,-29);ctx.lineTo(2,-16);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(6,-14);ctx.lineTo(12,-28);ctx.lineTo(13,-8);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e7f7d1';ctx.fillRect(4,-13,2.5,2.5);ctx.fillRect(9,-12,2.5,2.5);
    ctx.strokeStyle='#7b956c';ctx.lineWidth=3.8;ctx.beginPath();
    if(tether){const a=(this.engine.world.anchors||[]).find(item=>item.id===p.sapline.anchorId),pos=this.engine.anchorPosition?.(a);let ang=-1.1;if(pos){const localX=(pos.x-p.x)*p.facing,localY=pos.y-p.y;ang=Math.atan2(localY,localX)}ctx.moveTo(6,-4);ctx.lineTo(6+Math.cos(ang)*19,-4+Math.sin(ang)*19);ctx.moveTo(-6,-3);ctx.lineTo(-11,7)}else if(attack){ctx.moveTo(6,-4);ctx.lineTo(15,-2);ctx.moveTo(-6,-3);ctx.lineTo(-10,5)}else{const armSwing=p.onGround?Math.sin(runPhase+Math.PI)*5:clamp(-p.vy/700,-1,1)*4;ctx.moveTo(6,-4);ctx.lineTo(10+armSwing,7);ctx.moveTo(-6,-3);ctx.lineTo(-10-armSwing,7)}ctx.stroke();
    if(!attack){ctx.strokeStyle='rgba(55,43,29,.95)';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(-8,8);ctx.lineTo(-15,19);ctx.stroke();ctx.fillStyle='#8b7350';ctx.fillRect(-10,6,3,5)}
    if(attack){
      const phase=smooth(clamp(attack.time/(attack.duration||.2),0,1));let angle=-.75;
      if(attack.type==='side')angle=lerp(-1,.6,phase);else if(attack.type==='up')angle=lerp(.22,-1.62,phase);else if(attack.type==='down')angle=lerp(-.42,1.38,phase);else if(attack.type==='plunge')angle=1.34;else if(attack.type==='dash')angle=lerp(-.25,.1,phase);else if(attack.type==='wall')angle=lerp(-.75,.48,phase);
      let bladeFacing=1;if(attack.type==='wall'&&p.wallDir)bladeFacing=-p.wallDir*p.facing;
      if(attack.time<=1/120*1.6){const flash=ctx.createRadialGradient(12,-2,0,12,-2,25);flash.addColorStop(0,'rgba(238,251,212,.8)');flash.addColorStop(1,'rgba(238,251,212,0)');ctx.fillStyle=flash;ctx.beginPath();ctx.arc(12,-2,25,0,TAU);ctx.fill()}
      ctx.save();ctx.scale(bladeFacing,1);ctx.rotate(angle);ctx.strokeStyle='#48341f';ctx.lineWidth=4.8;ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(14,0);ctx.stroke();ctx.strokeStyle='#ba9b69';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(13,-3.5);ctx.lineTo(13,3.5);ctx.stroke();ctx.fillStyle=COLORS.blade;ctx.beginPath();ctx.moveTo(14,-3.2);ctx.lineTo(39,-4);ctx.lineTo(46,-.8);ctx.lineTo(41,3.8);ctx.lineTo(14,3.2);ctx.closePath();ctx.fill();ctx.restore();
    }
    ctx.restore();if(wall){ctx.fillStyle='rgba(177,214,156,.34)';ctx.fillRect(p.x+p.wallDir*17,p.y-15,2.5,30)}
  }

  drawBoss(b){
    if(!this.engine.state.bossActive||b.dead)return;
    const ctx=this.ctx,t=this.engine.state.time,open=b.guard<=0;
    ctx.save();ctx.translate(b.x,b.y);ctx.globalAlpha=b.hitFlash>0 ? .58 : 1;
    ctx.strokeStyle='#0b100e';ctx.lineWidth=32;ctx.beginPath();ctx.arc(0,0,78,-2.75,.45);ctx.stroke();ctx.strokeStyle='#39423e';ctx.lineWidth=22;ctx.beginPath();ctx.arc(0,0,78,-2.75,.45);ctx.stroke();ctx.strokeStyle='#b7793c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,79,-2.7,.4);ctx.stroke();
    for(let i=0;i<3;i++){const a=-2.42+i*.95,intact=i<b.guard,px=Math.cos(a)*76,py=Math.sin(a)*76;ctx.save();ctx.translate(px,py);ctx.rotate(a+Math.PI/2);ctx.fillStyle=intact?'#2e3935':'#151b19';ctx.fillRect(-17,-12,34,24);ctx.strokeStyle=intact?COLORS.danger:'rgba(120,98,72,.35)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-14,8);ctx.lineTo(-28,22);ctx.moveTo(14,8);ctx.lineTo(28,22);ctx.stroke();if(intact){ctx.fillStyle='#d68f47';ctx.beginPath();ctx.arc(0,-2,4+Math.sin(t*5+i)*.7,0,TAU);ctx.fill()}ctx.restore()}
    ctx.save();ctx.rotate(t*(1.2+b.phase*.55));ctx.strokeStyle='#8b8e84';ctx.lineWidth=5;for(let i=0;i<12;i++){const a=i/12*TAU,x=Math.cos(a)*52,y=Math.sin(a)*52;ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(7,-5);ctx.lineTo(7,5);ctx.closePath();ctx.stroke();ctx.restore()}ctx.restore();
    const core=ctx.createRadialGradient(0,0,2,0,0,28);core.addColorStop(0,open?'rgba(224,255,198,.92)':'rgba(214,147,70,.72)');core.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,28,0,TAU);ctx.fill();ctx.fillStyle=open?COLORS.spirit:'#1a2521';ctx.beginPath();ctx.arc(0,0,10,0,TAU);ctx.fill();
    for(const side of[-1,1]){ctx.save();ctx.translate(side*105,8);ctx.fillStyle='#202a27';ctx.beginPath();ctx.roundRect(-23,-31,46,62,8);ctx.fill();ctx.strokeStyle='#67726c';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-side*14,-16);ctx.lineTo(-side*47,-4);ctx.moveTo(-side*14,16);ctx.lineTo(-side*47,5);ctx.stroke();ctx.restore()}
    ctx.restore();
  }

  drawWorld(){
    const ctx=this.ctx,e=this.engine;ctx.save();this.worldTransform();
    for(const wall of e.world.walls)this.drawBarkWall(wall);for(const rail of e.world.rails||[])this.drawBarkRail(rail);for(const platform of e.world.platforms)this.drawPlatform(platform);for(const anchor of e.world.anchors||[])this.drawSapAnchor(anchor);for(const vine of e.world.vines)this.drawVine(vine);for(const hazard of e.world.hazards)this.drawHazard(hazard);e.world.checkpoints.forEach((cp,index)=>this.drawCheckpoint(cp,index));for(const trap of e.state.traps)this.drawTrap(trap);
    for(const enemy of e.world.enemies){if(enemy.dead)continue;if(enemy.kind==='logger')this.drawLogger(enemy);else if(enemy.kind==='ranger')this.drawRanger(enemy);else if(enemy.kind==='climber')this.drawClimber(enemy);else if(enemy.kind==='drone')this.drawDrone(enemy);else this.drawTrapper(enemy)}
    this.drawBoss(e.world.boss);for(const shot of e.state.projectiles)this.drawProjectile(shot);this.drawSapline(e.state.player);this.drawGuardian(e.state.player);for(const f of e.state.fx){ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(f.x,f.y,f.size,0,TAU);ctx.fill()}ctx.globalAlpha=1;for(const mote of this.fireflies){if(Math.abs(mote.y-e.state.camera.y)>VIEW.h*.7)continue;ctx.fillStyle='rgba(214,235,174,.28)';ctx.beginPath();ctx.arc(mote.x,mote.y+Math.sin(e.state.time*mote.s+mote.p)*7,1.4,0,TAU);ctx.fill()}ctx.restore();
  }
}
