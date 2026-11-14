import {MOUNTAIN_HALFPIPE,withinMountainHalfpipe} from "../mountainHalfpipe";

export type HalfpipeSample={
  tick:number;x:number;z:number;vx:number;speed:number;grounded:boolean;
};
export type HalfpipeMetrics={
  leftVisits:number;rightVisits:number;bankCrossings:number;lateralReversals:number;
  lastBank:"left"|"right"|null;lastTick:number;lastZ:number;
};

/** Conservative *observed* traverse counter, not an autoplay controller.
 * A bank visit requires a real central-channel approach, speed and grounded
 * contact; a crossing needs the opposite bank on a later downhill sample.
 * Render-frame sampling may undercount fast motion; it never manufactures it. */
export class SkiHalfpipeQualification{
  readonly metrics:HalfpipeMetrics={
    leftVisits:0,rightVisits:0,bankCrossings:0,lateralReversals:0,
    lastBank:null,lastTick:-1,lastZ:MOUNTAIN_HALFPIPE.startZ,
  };
  private passedCenter=false;
  private lastLateral: -1|0|1=0;
  observe(s:HalfpipeSample):HalfpipeMetrics{
    const h=MOUNTAIN_HALFPIPE;
    if(!Number.isFinite(s.tick)||!Number.isFinite(s.speed)||!Number.isFinite(s.vx)||
       !Number.isFinite(s.x)||!Number.isFinite(s.z)||!s.grounded||s.speed<2||
       !withinMountainHalfpipe({x:s.x,z:s.z}))return this.metrics;
    if(s.tick<=this.metrics.lastTick)return this.metrics;
    const lateral=s.vx>.5?1:s.vx<-.5?-1:0;
    if(lateral!==0){
      if(this.lastLateral!==0&&this.lastLateral!==lateral)
        this.metrics.lateralReversals++;
      this.lastLateral=lateral;
    }
    const offset=s.x-h.centerX;
    if(Math.abs(offset)<=h.floorHalfWidth-.1){
      this.passedCenter=true;
      return this.metrics;
    }
    if(Math.abs(offset)<h.floorHalfWidth+.8||!this.passedCenter)return this.metrics;
    const bank=offset<0?"left":"right";
    const last=this.metrics.lastBank;
    if(last===bank){this.passedCenter=false;return this.metrics;}
    if(last && (s.tick-this.metrics.lastTick<12||s.z-this.metrics.lastZ<.35)){
      // A premature bank arrival cannot become a valid visit merely by
      // standing still: a new, real center traverse is required.
      this.passedCenter=false;
      return this.metrics;
    }
    if(bank==="left")this.metrics.leftVisits++;
    else this.metrics.rightVisits++;
    if(last)this.metrics.bankCrossings++;
    this.metrics.lastBank=bank;
    this.metrics.lastTick=s.tick;
    this.metrics.lastZ=s.z;
    this.passedCenter=false;
    return this.metrics;
  }
}
