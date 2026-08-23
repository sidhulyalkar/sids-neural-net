import{SylvariaRenderer as BaseRenderer}from'./render-v3.js';
import{VIEW,TAU,COLORS,MOVE}from'./config-v3.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);

export class SylvariaRenderer extends BaseRenderer{
  drawSapAnchor(anchor){
    const pos=this.engine.anchorPosition?.(anchor);if(!pos)return;
    const ctx=this.ctx,p=this.engine.state.player,active=p.sapline?.anchorId===anchor.id,candidate=p.saplineCandidate===anchor.id;
    const pulse=1+Math.sin(this.engine.state.time*4.2+pos.x*.01)*.08;
    ctx.save();ctx.translate(pos.x,pos.y);ctx.scale(pulse,pulse);
    ctx.fillStyle=active?'rgba(156,240,184,.22)':candidate?'rgba(215,245,183,.18)':'rgba(146,184,112,.10)';
    ctx.beginPath();ctx.arc(0,0,active?18:candidate?15:10,0,TAU);ctx.fill();
    ctx.strokeStyle=active?COLORS.sapline:candidate?COLORS.resin:'rgba(177,205,135,.38)';ctx.lineWidth=active?3:2;
    ctx.beginPath();ctx.arc(0,0,active?9:7,0,TAU);ctx.stroke();
    ctx.fillStyle=active?COLORS.resin:'#88a56a';ctx.beginPath();ctx.ellipse(0,1,4.5,6,-.25,0,TAU);ctx.fill();
    ctx.restore();
  }

  drawSapline(player){
    const tether=player.sapline;if(!tether)return;
    const anchor=(this.engine.world.anchors||[]).find(item=>item.id===tether.anchorId),pos=this.engine.anchorPosition?.(anchor);if(!pos)return;
    const ctx=this.ctx,dx=pos.x-player.x,dy=pos.y-player.y,dist=Math.hypot(dx,dy)||1,tension=clamp((dist-tether.rest)/120,0,1);
    const handX=player.x+player.facing*7,handY=player.y-8;
    ctx.save();ctx.lineCap='round';
    ctx.strokeStyle='rgba(12,31,20,.8)';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(handX,handY);ctx.quadraticCurveTo((handX+pos.x)/2+Math.sin(this.engine.state.time*11)*4,(handY+pos.y)/2,pos.x,pos.y);ctx.stroke();
    ctx.strokeStyle=`rgba(156,240,184,${.62+tension*.28})`;ctx.lineWidth=2.4+tension*1.5;ctx.beginPath();ctx.moveTo(handX,handY);ctx.quadraticCurveTo((handX+pos.x)/2+Math.sin(this.engine.state.time*11)*4,(handY+pos.y)/2,pos.x,pos.y);ctx.stroke();
    for(let i=1;i<5;i++){const k=i/5,x=lerp(handX,pos.x,k),y=lerp(handY,pos.y,k);ctx.fillStyle='rgba(215,245,183,.55)';ctx.beginPath();ctx.arc(x,y,1.4+tension*.7,0,TAU);ctx.fill()}
    ctx.restore();
  }

  drawGuardian(p){
    const ctx=this.ctx,time=this.engine.state.time,attack=p.attack,air=!p.onGround,wall=p.wallDir&&!p.onGround,tether=!!p.sapline;
    const speed=Math.min(1,Math.abs(p.vx)/MOVE.runSpeed),runPhase=time*(9+speed*13),stride=p.onGround?Math.sin(runPhase)*7:0;
    const rise=clamp(-p.vy/800,-1,1),blink=p.invuln>0&&Math.floor(time*28)%2===0;
    let lean=clamp(p.vx/920,-.2,.2);if(wall)lean=-p.wallDir*.12;if(tether)lean=clamp(p.vx/1100,-.25,.25);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.facing,1);ctx.globalAlpha=blink?.38:1;ctx.rotate(lean);

    // Trailing leaf-cloak. Its shape responds to speed rather than using a rigid sprite.
    const trail=clamp(Math.abs(p.vx)/420,0,1),cloakLift=air?clamp(-p.vy/500,-.5,1):0;
    ctx.fillStyle='#0a1710';ctx.beginPath();ctx.moveTo(-7,-12);ctx.quadraticCurveTo(-22-trail*9,-2-cloakLift*5,-14-trail*12,18);ctx.quadraticCurveTo(-2,13,8,18);ctx.lineTo(9,-10);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(121,164,100,.32)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-7,-8);ctx.quadraticCurveTo(-18-trail*8,4,-9-trail*12,15);ctx.stroke();

    // Legs lead the silhouette during movement. Air poses tuck rather than dangling.
    ctx.strokeStyle='#68855f';ctx.lineWidth=4.5;ctx.lineCap='round';ctx.beginPath();
    if(wall){ctx.moveTo(-5,15);ctx.lineTo(-12,24);ctx.moveTo(6,15);ctx.lineTo(12,20)}
    else if(air){const tuck=clamp(Math.abs(p.vy)/700,0,1);ctx.moveTo(-6,15);ctx.lineTo(-10-stride*.15,22-tuck*3);ctx.moveTo(6,15);ctx.lineTo(11+stride*.15,22+tuck*2)}
    else{ctx.moveTo(-6,15);ctx.lineTo(-8+stride,27);ctx.moveTo(6,15);ctx.lineTo(8-stride,27)}ctx.stroke();

    // Compact torso and hood keep the character fast-looking rather than armored.
    ctx.fillStyle='#203b28';ctx.beginPath();ctx.moveTo(-10,-10);ctx.quadraticCurveTo(-8,-21,1,-24);ctx.quadraticCurveTo(11,-19,11,-7);ctx.lineTo(8,16);ctx.quadraticCurveTo(0,20,-8,15);ctx.closePath();ctx.fill();
    ctx.fillStyle='#52704d';ctx.beginPath();ctx.moveTo(-8,-13);ctx.lineTo(-3,-28);ctx.lineTo(2,-16);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(6,-14);ctx.lineTo(12,-27);ctx.lineTo(13,-8);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e5f5ce';ctx.fillRect(4,-13,2.6,2.6);ctx.fillRect(9,-12,2.6,2.6);

    // Arms are stateful. Tethering visibly reaches for the line; locomotion keeps hands free.
    ctx.strokeStyle='#78916a';ctx.lineWidth=4;ctx.beginPath();
    if(tether){
      const a=(this.engine.world.anchors||[]).find(item=>item.id===p.sapline.anchorId),pos=this.engine.anchorPosition?.(a);let ang=-1.15;
      if(pos){const dx=(pos.x-p.x)*p.facing,dy=pos.y-p.y;ang=Math.atan2(dy,dx)}
      ctx.moveTo(6,-4);ctx.lineTo(6+Math.cos(ang)*17,-4+Math.sin(ang)*17);ctx.moveTo(-6,-3);ctx.lineTo(-11,7);
    }else if(attack){ctx.moveTo(6,-4);ctx.lineTo(16,-2);ctx.moveTo(-6,-3);ctx.lineTo(-11,5)}
    else{const armSwing=p.onGround?Math.sin(runPhase+Math.PI)*5:rise*4;ctx.moveTo(6,-4);ctx.lineTo(10+armSwing,7);ctx.moveTo(-6,-3);ctx.lineTo(-10-armSwing,7)}ctx.stroke();

    // The machete is sheathed during locomotion. Only the small dark scabbard remains.
    if(!attack){ctx.strokeStyle='rgba(59,46,31,.9)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-8,7);ctx.lineTo(-16,20);ctx.stroke()}

    if(attack){
      const phase=smooth(clamp(attack.time/(attack.duration||.2),0,1));let angle=-.8;
      if(attack.type==='side')angle=lerp(-1.05,.62,phase);
      else if(attack.type==='up')angle=lerp(.25,-1.65,phase);
      else if(attack.type==='down')angle=lerp(-.45,1.42,phase);
      else if(attack.type==='plunge')angle=1.35+Math.sin(phase*Math.PI)*.12;
      else if(attack.type==='dash')angle=lerp(-.28,.12,phase);
      else if(attack.type==='wall')angle=lerp(-.8,.5,phase);
      let bladeFacing=1;if(attack.type==='wall'&&p.wallDir)bladeFacing=-p.wallDir*p.facing;
      ctx.save();ctx.scale(bladeFacing,1);ctx.rotate(angle);
      ctx.strokeStyle='#49351f';ctx.lineWidth=5.5;ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(16,0);ctx.stroke();
      ctx.strokeStyle='#b99b6b';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(15,-4);ctx.lineTo(15,4);ctx.stroke();
      ctx.fillStyle=COLORS.blade;ctx.beginPath();ctx.moveTo(16,-3.8);ctx.lineTo(45,-4.8);ctx.lineTo(53,-1);ctx.lineTo(47,4.6);ctx.lineTo(16,3.8);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,255,235,.8)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(21,-2);ctx.lineTo(47,-2);ctx.stroke();ctx.restore();
      const box=this.engine.attackBox(false);if(box){ctx.globalAlpha=.16;ctx.strokeStyle=COLORS.blade;ctx.lineWidth=5;ctx.beginPath();if(attack.type==='up')ctx.arc(0,-15,39,Math.PI,TAU);else if(attack.type==='down'||attack.type==='plunge')ctx.arc(0,17,42,0,Math.PI);else ctx.arc(8,-2,42,-.95,.9);ctx.stroke()}
    }

    ctx.restore();
    if(wall){ctx.fillStyle='rgba(177,214,156,.35)';ctx.fillRect(p.x+p.wallDir*17,p.y-15,2.5,30)}
  }

  drawLogger(e){
    const ctx=this.ctx,t=this.engine.state.time,w=e.state==='windup'?1:0;ctx.save();ctx.translate(e.x,e.y+(e.visualLift||0));ctx.scale(e.facing,1);ctx.globalAlpha=e.hitFlash>0?.55:1;
    ctx.fillStyle='#3a3029';ctx.beginPath();ctx.ellipse(0,5,16,25,0,0,TAU);ctx.fill();ctx.fillStyle='#76513a';ctx.beginPath();ctx.arc(0,-24,10,0,TAU);ctx.fill();ctx.fillStyle='#cf8240';ctx.beginPath();ctx.moveTo(-13,-31);ctx.lineTo(12,-31);ctx.lineTo(8,-37);ctx.lineTo(-9,-36);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#343c37';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-7,23);ctx.lineTo(-10,37);ctx.moveTo(7,23);ctx.lineTo(10,37);ctx.stroke();
    const a=w?-.95+Math.sin(t*8)*.03:-.25;ctx.save();ctx.translate(10,-4);ctx.rotate(a);ctx.strokeStyle='#6d5033';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(31,0);ctx.stroke();ctx.fillStyle=e.state==='windup'?COLORS.danger:'#b9b4a7';ctx.beginPath();ctx.moveTo(28,-9);ctx.lineTo(41,-5);ctx.lineTo(39,8);ctx.lineTo(27,8);ctx.closePath();ctx.fill();ctx.restore();ctx.restore();
  }

  drawRanger(e){
    const ctx=this.ctx;ctx.save();ctx.translate(e.x,e.y+(e.visualLift||0));ctx.scale(e.facing,1);ctx.globalAlpha=e.hitFlash>0?.55:1;ctx.fillStyle='#2a3732';ctx.beginPath();ctx.ellipse(0,5,15,24,0,0,TAU);ctx.fill();ctx.fillStyle='#9e704b';ctx.beginPath();ctx.arc(0,-24,9.5,0,TAU);ctx.fill();ctx.fillStyle='#cc843f';ctx.fillRect(-11,-34,22,5);ctx.strokeStyle='#66706b';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(6,-5);ctx.lineTo(38,-6);ctx.stroke();ctx.fillStyle=COLORS.danger;ctx.beginPath();ctx.arc(40,-6,4,0,TAU);ctx.fill();ctx.restore();
    if(e.state==='aim'){ctx.globalAlpha=.22;ctx.strokeStyle=COLORS.danger;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(e.x,e.y-6);ctx.lineTo(this.engine.state.player.x,this.engine.state.player.y);ctx.stroke();ctx.globalAlpha=1}
  }

  drawClimber(e){
    const ctx=this.ctx;ctx.save();ctx.translate(e.x,e.y+(e.visualLift||0));ctx.scale(e.side||1,1);ctx.fillStyle='#303a30';ctx.beginPath();ctx.ellipse(0,0,14,21,0,0,TAU);ctx.fill();ctx.strokeStyle='#b07a47';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-11,-8);ctx.lineTo(11,12);ctx.moveTo(11,-8);ctx.lineTo(-11,12);ctx.stroke();ctx.strokeStyle='#9eaa92';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(9,-4);ctx.lineTo(22,-12);ctx.moveTo(8,8);ctx.lineTo(22,15);ctx.stroke();ctx.fillStyle=COLORS.danger;ctx.beginPath();ctx.arc(0,-19,4,0,TAU);ctx.fill();ctx.restore();
  }

  drawDrone(e){
    const ctx=this.ctx;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.sin(this.engine.state.time*3+e.x)*.08);ctx.fillStyle='#202b27';ctx.beginPath();ctx.ellipse(0,2,21,12,0,0,TAU);ctx.fill();ctx.strokeStyle='#9f7d4d';ctx.lineWidth=3;for(const side of[-1,1]){ctx.beginPath();ctx.moveTo(side*16,-2);ctx.lineTo(side*31,-10);ctx.stroke();ctx.save();ctx.translate(side*31,-10);ctx.rotate(this.engine.state.time*13*side);ctx.strokeStyle='#707973';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.moveTo(0,-11);ctx.lineTo(0,11);ctx.stroke();ctx.restore()}ctx.fillStyle=COLORS.danger;ctx.beginPath();ctx.arc(0,4,4,0,TAU);ctx.fill();ctx.restore();
  }

  drawTrapper(e){
    const ctx=this.ctx;ctx.save();ctx.translate(e.x,e.y);ctx.scale(e.facing,1);ctx.fillStyle='#3a322b';ctx.beginPath();ctx.ellipse(0,5,15,24,0,0,TAU);ctx.fill();ctx.fillStyle='#a57349';ctx.beginPath();ctx.arc(0,-23,9,0,TAU);ctx.fill();ctx.strokeStyle='#a68a5f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(17,1,11,0,TAU);ctx.stroke();for(let i=0;i<4;i++){const a=i/4*TAU;ctx.beginPath();ctx.moveTo(17+Math.cos(a)*4,1+Math.sin(a)*4);ctx.lineTo(17+Math.cos(a)*10,1+Math.sin(a)*10);ctx.stroke()}if(e.state==='aim'){ctx.strokeStyle=COLORS.danger;ctx.beginPath();ctx.arc(17,1,17,0,TAU);ctx.stroke()}ctx.restore();
  }

  drawBoss(b){
    if(!this.engine.state.bossActive||b.dead)return;const ctx=this.ctx,w=b.state==='axeWindup'?1:0;ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.facing,1);ctx.globalAlpha=b.hitFlash>0?.55:1;
    ctx.fillStyle='#1d2521';ctx.beginPath();ctx.ellipse(0,8,40,52,0,0,TAU);ctx.fill();ctx.fillStyle='#644b37';ctx.beginPath();ctx.ellipse(0,4,29,43,0,0,TAU);ctx.fill();ctx.fillStyle='#bd783d';ctx.beginPath();ctx.arc(0,-45,18,0,TAU);ctx.fill();ctx.fillStyle='#d38c45';ctx.fillRect(-24,-59,48,7);
    ctx.strokeStyle='#3c4742';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(-23,44);ctx.lineTo(-27,70);ctx.moveTo(23,44);ctx.lineTo(27,70);ctx.stroke();
    ctx.save();ctx.translate(25,-5);ctx.rotate(w?-.92:-.25);ctx.strokeStyle='#6e5135';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(48,0);ctx.stroke();ctx.fillStyle=w?COLORS.danger:'#aaa89d';ctx.beginPath();ctx.moveTo(43,-14);ctx.lineTo(62,-8);ctx.lineTo(59,13);ctx.lineTo(42,11);ctx.closePath();ctx.fill();ctx.restore();
    if(b.guard>0){ctx.strokeStyle='rgba(220,169,92,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,61+Math.sin(this.engine.state.time*4)*2,0,TAU);ctx.stroke()}ctx.restore();
  }

  drawWorld(){
    const ctx=this.ctx,e=this.engine;ctx.save();this.worldTransform();
    for(const wall of e.world.walls)this.drawBarkWall(wall);
    for(const platform of e.world.platforms)this.drawPlatform(platform);
    for(const anchor of e.world.anchors||[])this.drawSapAnchor(anchor);
    for(const vine of e.world.vines)this.drawVine(vine);
    for(const hazard of e.world.hazards)this.drawHazard(hazard);
    e.world.checkpoints.forEach((cp,index)=>this.drawCheckpoint(cp,index));
    for(const trap of e.state.traps)this.drawTrap(trap);
    for(const enemy of e.world.enemies){if(enemy.dead)continue;if(enemy.kind==='logger')this.drawLogger(enemy);else if(enemy.kind==='ranger')this.drawRanger(enemy);else if(enemy.kind==='climber')this.drawClimber(enemy);else if(enemy.kind==='drone')this.drawDrone(enemy);else this.drawTrapper(enemy)}
    this.drawBoss(e.world.boss);for(const shot of e.state.projectiles)this.drawProjectile(shot);this.drawSapline(e.state.player);this.drawGuardian(e.state.player);
    for(const f of e.state.fx){ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(f.x,f.y,f.size,0,TAU);ctx.fill()}ctx.globalAlpha=1;
    for(const mote of this.fireflies){if(Math.abs(mote.y-e.state.camera.y)>VIEW.h*.7)continue;ctx.fillStyle='rgba(214,235,174,.28)';ctx.beginPath();ctx.arc(mote.x,mote.y+Math.sin(e.state.time*mote.s+mote.p)*7,1.4,0,TAU);ctx.fill()}ctx.restore();
  }
}
