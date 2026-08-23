import{SylvariaEngine as BaseEngine}from'./engine-v3.js';
import{COMBAT}from'./config-v3.js';

const overlap=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
const shotRect=(shot)=>({l:shot.x-shot.r,r:shot.x+shot.r,t:shot.y-shot.r,b:shot.y+shot.r});

// Feel qualification layer. Kept separate while v3 is draft so each change can be
// compared against the original deterministic ascent substrate before we squash it.
export class SylvariaEngine extends BaseEngine{
  startAttack(){
    const p=this.state.player;if(p.attackCooldown>0||this.state.mode!=='playing')return;
    let type='side';
    if(p.dashTime>0||p.dashRecover>0)type='dash';
    else if(p.wallDir&&!p.onGround)type='wall';
    else if(this.input.is('down')&&!p.onGround)type=p.vy>480?'plunge':'down';
    else if(this.input.is('up'))type='up';
    const profile=this.attackProfile(type);
    p.attack={type,time:0,duration:profile.duration,hit:new Set(),deflected:new Set()};
    p.attackCooldown=COMBAT.attackCooldown;
    if(type==='side'){p.combo=p.comboWindow>0?(p.combo%3)+1:1;p.comboWindow=COMBAT.comboWindow}else p.combo=1;
    this.state.stats.slashes++;
    if(type==='up')this.state.stats.upslashes++;
    if(type==='down')this.state.stats.downslashes++;
    if(type==='plunge')this.state.stats.plunges++;
    if(type==='dash')this.state.stats.dashSlashes++;
    this.deflectNearbyProjectiles();
    this.emit('attack',{attack:type,combo:p.combo});
  }

  deflectNearbyProjectiles(){
    const p=this.state.player,box=this.attackBox(true);if(!box||!p.attack)return;
    for(const shot of this.state.projectiles){
      if(shot.dead||shot.friendly||p.attack.deflected.has(shot))continue;
      if(!overlap(box,shotRect(shot)))continue;
      p.attack.deflected.add(shot);
      this.reflectProjectile(shot);
    }
  }

  updatePlayer(dt){
    const p=this.state.player;
    const preserveMomentum=!p.onGround&&!p.vineId&&p.dashTime<=0&&this.input.axisX()===0;
    const incomingVx=p.vx;
    super.updatePlayer(dt);
    if(!preserveMomentum||p.onGround||p.vineId||p.dashTime>0||p.wallDir)return;
    if(Math.abs(incomingVx)<1)return;
    const sameDirection=Math.sign(p.vx)===Math.sign(incomingVx)||Math.abs(p.vx)<1;
    if(!sameDirection)return;
    const retained=Math.abs(incomingVx)*0.995;
    if(Math.abs(p.vx)<retained)p.vx=Math.sign(incomingVx)*retained;
  }

  updateProjectiles(dt){
    const boss=this.world.boss,beforeGuard=boss.guard,beforeHp=boss.hp;
    super.updateProjectiles(dt);
    if(!this.state.bossActive||boss.dead)return;
    if(beforeGuard>0&&boss.guard===0){this.state.bossOpenTimer=Math.max(this.state.bossOpenTimer,2.6);boss.state='stagger';boss.recover=Math.max(boss.recover||0,.55);this.emit('guardBreak')}
    if(beforeHp>0&&boss.hp<=0){boss.hp=0;boss.dead=true;boss.state='dead';this.state.stats.kills++;this.spawnFx(boss.x,boss.y,'#b8f3d4',42,240);this.emit('bossDead')}
  }

  respawnFromFall(){
    super.respawnFromFall();
    const p=this.state.player;p.onGround=false;p.groundId=null;p.wallDir=0;p.wallId=null;p.wallTime=0;p.dropTimer=0;p.attack=null;p.attackCooldown=0;
  }
}
