"use client";
import {useEffect,useRef,useState} from "react";
import {
 DISC_GOLF_HOLES,discGolfRemaining,discGolfScoreName,discGolfWind,
 type DiscGolfState,type DiscShot,type DiscGolfSwingStage,
} from "@/lib/world/discGolf";
import styles from "./world.module.css";

type Stage=DiscGolfSwingStage;
export function WorldDiscGolfHUD({game,onShot,onChangeHole,onExit,onStage}:{
 game:DiscGolfState;
 onShot:(shot:DiscShot)=>void;
 onChangeHole:(hole:number)=>void;
 onExit:()=>void;
 onStage:(stage:DiscGolfSwingStage)=>void;
}){
 const hole=DISC_GOLF_HOLES[game.holeIndex];
 const [stage,setStage]=useState<Stage>("idle");
 const [cursor,setCursor]=useState(0);
 const [power,setPower]=useState(65);
 const [loft,setLoft]=useState(22);
 const [aim,setAim]=useState(0);
 const started=useRef(0);
 useEffect(()=>{
  if(stage!=="power"&&stage!=="accuracy")return;
  let raf=0;
  const run=(now:number)=>{
   const period=stage==="power"?1850:1160;
   const cycle=((now-started.current)%period)/period;
   const t=cycle<.5?cycle*2:(1-cycle)*2;
   setCursor(t);
   raf=requestAnimationFrame(run);
  };
  raf=requestAnimationFrame(run);
  return ()=>cancelAnimationFrame(raf);
 },[stage]);
 const act=()=>{
  if(game.phase==="flying"||game.phase==="holed"||stage==="released")return;
  if(stage==="idle"){
   started.current=performance.now();setCursor(0);setStage("power");onStage("power");
  }else if(stage==="power"){
   setPower(Math.max(8,Math.round(cursor*100)));
   started.current=performance.now();setCursor(0);setStage("accuracy");onStage("accuracy");
  }else{
   const accuracy=(cursor-.5)*2;
   setStage("released");onStage("released");
   onShot({power,accuracy,loft,aimOffset:aim});
  }
 };
 const liveWind=game.phase==="flying"?game.lockedWind:discGolfWind(game.holeIndex,game.clock);
 const bearing=Math.atan2(liveWind.x,liveWind.z)*180/Math.PI;
 const windArrow=["↑","↗","→","↘","↓","↙","←","↖"][((Math.round((bearing+360)/45)%8)+8)%8];
 const disabled=game.phase==="flying"||game.phase==="holed";
 const buttonLabel=stage==="idle"?"Start pullback":stage==="power"?"Lock power":
   stage==="accuracy"?"Release disc":"Disc airborne";
 return (
  <aside className={styles.discGolfHud} aria-label="Island disc golf controls">
   <div className={styles.discGolfHeading}>
    <div>
     <span className={styles.eyebrow}>ISLAND DISC GOLF · {game.holeIndex+1}/{DISC_GOLF_HOLES.length}</span>
     <h2>{hole.name}</h2>
    </div>
    <button type="button" onClick={onExit} aria-label="Leave disc golf">Exit</button>
   </div>
   <div className={styles.discGolfStats} aria-live="polite">
    <span>Par {hole.par}</span><span>Throws {game.strokes}</span>
    <span>{discGolfRemaining(game).toFixed(0)} m to basket</span>
    <span title="Wind is sampled at release">Wind {windArrow} {liveWind.speed.toFixed(1)}</span>
   </div>
   <p className={styles.discGolfNote}>
    {game.phase==="holed"?`Chains! ${discGolfScoreName(game.strokes,hole.par)}`:
     game.phase==="water"?"Water shot. Free redo from your last lie.":
     game.phase==="landed"?"Follow the gold beam to your next shot.":
     game.phase==="flying"?"Watch the disc bend in the wind…":
     "Aim, choose loft, then tap three times to swing and release."}
   </p>
   {game.phase==="holed"?(
    <button type="button" className={styles.discGolfMainButton}
      onClick={()=>onChangeHole((game.holeIndex+1)%DISC_GOLF_HOLES.length)}>
      Next moving basket
    </button>
   ):(
    <>
     <div className={styles.discGolfControlRow}>
      <label>Throw angle <strong>{loft}°</strong>
       <input type="range" min="6" max="42" step="1" value={loft}
        disabled={disabled||stage==="released"} onChange={e=>setLoft(Number(e.target.value))}/>
      </label>
      <label>Aim offset <strong>{aim>0?"+":""}{aim}°</strong>
       <input type="range" min="-55" max="55" step="1" value={aim}
        disabled={disabled||stage==="released"} onChange={e=>setAim(Number(e.target.value))}/>
      </label>
     </div>
     <div className={styles.discGolfMeters} aria-label="Two-phase throw timing meters">
      <div>
       <div className={styles.discGolfMeterHeader}><span>1 · Pullback / power</span><strong>{stage==="power"?Math.round(cursor*100):power}%</strong></div>
       <div className={styles.discGolfMeter} role="progressbar"
         aria-label="Power pullback" aria-valuemin={0} aria-valuemax={100}
         aria-valuenow={stage==="power"?Math.round(cursor*100):power}>
        <span className={styles.discGolfPowerFill} style={{width:`${stage==="power"?cursor*100:power}%`}}/>
        <span className={styles.discGolfNeedle} style={{left:`${stage==="power"?cursor*100:power}%`}}/>
       </div>
      </div>
      <div>
       <div className={styles.discGolfMeterHeader}><span>2 · Release / accuracy</span><strong>{stage==="accuracy"?`${Math.round(Math.abs(cursor-.5)*200)}% off`:"Center = clean"}</strong></div>
       <div className={styles.discGolfMeter} role="progressbar"
         aria-label="Release accuracy" aria-valuemin={0} aria-valuemax={100}
         aria-valuenow={Math.round((stage==="accuracy"?cursor:.5)*100)}>
        <span className={styles.discGolfSweetSpot}/>
        <span className={styles.discGolfNeedle} style={{left:`${(stage==="accuracy"?cursor:.5)*100}%`}}/>
       </div>
      </div>
     </div>
     <button className={styles.discGolfMainButton} disabled={disabled||stage==="released"}
       type="button" onClick={act}>{buttonLabel}</button>
     <span className={styles.discGolfHint}>Three taps: pull back → power → release. Wind shifts your throw; the basket moves while it flies.</span>
    </>
   )}
   <div className={styles.discGolfHoles} role="group" aria-label="Choose course">
     {DISC_GOLF_HOLES.map((h,i)=>(
      <button key={h.id} type="button" aria-pressed={i===game.holeIndex}
       disabled={game.phase==="flying"} onClick={()=>onChangeHole(i)}>
       {i+1}
      </button>
     ))}
   </div>
  </aside>
 );
}
