"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {
 DISC_GOLF_HOLES,discGolfRemaining,discGolfScoreName,discGolfWind,
 recommendDiscGolfPower,discGolfPullback,type DiscGolfState,type DiscShot,type DiscGolfSwingStage,
} from "@/lib/world/discGolf";
import {terrainHeight,isWater,SEA_SURFACE} from "@/lib/world/model";
import styles from "./world.module.css";

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const ground=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);

export function WorldDiscGolfHUD({game,onShot,onChangeHole,onExit,onStage,onPreview,onSwing}:{
 game:DiscGolfState;
 onShot:(shot:DiscShot)=>void;
 onChangeHole:(hole:number)=>void;
 onExit:()=>void;
 onStage:(stage:DiscGolfSwingStage)=>void;
 onPreview:(shot:DiscShot|null)=>void;
 onSwing:(amount:number)=>void;
}){
 const hole=DISC_GOLF_HOLES[game.holeIndex];
 const [loft,setLoft]=useState(24);
 const [aim,setAim]=useState(0);
 const [charging,setCharging]=useState(false);
 const [chargePower,setChargePower]=useState(65);
 const held=useRef(false);
 const fired=useRef(false);
 const chargeAt=useRef(0);
 const powerBucket=useRef(-1);
 const swingTick=useRef(-1);
 const locked=game.phase==="flying"||game.phase==="holed";
 const available=!locked&&game.phase!=="off";
 // Re-solve on a new lie or a changed aim, not on every animation frame.
 const suggested=useMemo(()=>recommendDiscGolfPower(game,loft,aim,ground,isWater,SEA_SURFACE),
  // The wind varies slowly; the preview itself refreshes during aiming.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [game.holeIndex,game.lie.x,game.lie.z,game.phase,loft,aim]);
 const preview=useCallback((power:number)=>{
  onPreview({power,accuracy:0,loft,aimOffset:aim});
 },[onPreview,loft,aim]);
 useEffect(()=>{
  if(!available||charging||fired.current)return;
  preview(suggested);
  onSwing(0);onStage("idle");
 },[available,charging,suggested,preview,onSwing,onStage]);
 const begin=useCallback(()=>{
  if(!available||held.current||fired.current)return;
  held.current=true;chargeAt.current=performance.now();
  powerBucket.current=-1;swingTick.current=-1;
  setCharging(true);setChargePower(suggested);
  onStage("power");
 },[available,onStage,suggested]);
 const finish=useCallback(()=>{
  if(!held.current||fired.current)return;
  held.current=false;fired.current=true;
  const ms=performance.now()-chargeAt.current;
  // The elastic meter starts at recommended strength, so a slightly
  // longer press cannot accidentally turn a drive into a tiny putt.
  const power=discGolfPullback(ms,suggested).power;
  setCharging(false);setChargePower(power);
  onStage("released");onSwing(1);onPreview(null);
  onShot({power,loft,aimOffset:aim,accuracy:0});
 },[suggested,onStage,onSwing,onPreview,onShot,loft,aim]);
 const tap=useCallback(()=>{
  if(!available||held.current||fired.current)return;
  fired.current=true;onStage("released");onSwing(1);onPreview(null);
  onShot({power:suggested,loft,aimOffset:aim,accuracy:0});
 },[available,suggested,onStage,onSwing,onPreview,onShot,loft,aim]);
 useEffect(()=>{
  if(!charging)return;
  let frame=0;
  const tick=()=>{
   if(!held.current)return;
   const ms=performance.now()-chargeAt.current;
   const sample=discGolfPullback(ms,suggested);
   // Animate the actual arm throughout the windup at a bounded 20 Hz;
   // recompute the predictive trajectory only on meaningful power changes.
   const frameBucket=Math.floor(ms/50);
   if(frameBucket!==swingTick.current){
    swingTick.current=frameBucket;onSwing(sample.windup);
   }
   const bucket=Math.round(sample.power/4);
   if(bucket!==powerBucket.current){
    powerBucket.current=bucket;
    setChargePower(sample.power);
    preview(sample.power);
   }
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return ()=>cancelAnimationFrame(frame);
 },[charging,preview,onSwing,suggested]);
 useEffect(()=>{
  const isTextEntry=(target:EventTarget|null)=>target instanceof HTMLElement &&
   !!target.closest("input,textarea,select,[contenteditable='true']");
  const down=(e:KeyboardEvent)=>{
   if(!available||e.altKey||e.ctrlKey||e.metaKey||isTextEntry(e.target))return;
   const key=e.key.toLowerCase();
   if(key==="a"||key==="d"||key==="w"||key==="s"||
      key==="arrowleft"||key==="arrowright"||key==="arrowup"||key==="arrowdown"){
    e.preventDefault();
    if(key==="a"||key==="arrowleft")setAim(v=>clamp(v-2,-55,55));
    else if(key==="d"||key==="arrowright")setAim(v=>clamp(v+2,-55,55));
    else if(key==="w"||key==="arrowup")setLoft(v=>clamp(v+2,6,42));
    else setLoft(v=>clamp(v-2,6,42));
   }else if(e.code==="Space"){
    e.preventDefault();
    if(!e.repeat)begin();
   }
  };
  const up=(e:KeyboardEvent)=>{
   if(e.code==="Space"&&held.current){e.preventDefault();finish();}
  };
  const cancel=()=>{if(held.current){held.current=false;setCharging(false);onStage("idle");onSwing(0);}};
  window.addEventListener("keydown",down);
  window.addEventListener("keyup",up);
  window.addEventListener("blur",cancel);
  return ()=>{
   window.removeEventListener("keydown",down);
   window.removeEventListener("keyup",up);
   window.removeEventListener("blur",cancel);
  };
 },[available,begin,finish,onStage,onSwing]);
 const liveWind=game.phase==="flying"?game.lockedWind:discGolfWind(game.holeIndex,game.clock);
 const bearing=Math.atan2(liveWind.x,liveWind.z)*180/Math.PI;
 const windArrow=["↑","↗","→","↘","↓","↙","←","↖"][((Math.round((bearing+360)/45)%8)+8)%8];
 const shownPower=charging?chargePower:suggested;
 const remaining=discGolfRemaining(game);
 return (
  <aside className={styles.discGolfHud} aria-label="Island disc golf controls">
   <div className={styles.discGolfHeading}>
    <div>
     <span className={styles.eyebrow}>ISLAND DISC GOLF · {game.holeIndex+1}/{DISC_GOLF_HOLES.length}</span>
     <h2>{hole.name}</h2>
    </div>
    <button type="button" onClick={()=>{
     onExit();
     requestAnimationFrame(()=>document.querySelector<HTMLCanvasElement>('canvas[role="application"]')?.focus({preventScroll:true}));
    }} aria-label="Leave disc golf">Exit</button>
   </div>
   <div className={styles.discGolfStats} aria-live="polite">
    <span>Par {hole.par}</span><span>Throws {game.strokes}</span>
    <span>{remaining.toFixed(0)} m to basket</span>
    <span title="Wind at release">{ "Wind "+windArrow+" "+liveWind.speed.toFixed(1) }</span>
   </div>
   <p className={styles.discGolfNote}>
    {game.phase==="holed"?"Chains! "+discGolfScoreName(game.strokes,hole.par):
     game.phase==="water"?(game.reason??"Water shot: free retry."):
     game.phase==="landed"?(game.reason??"Shoot from the gold light."):
     game.phase==="flying"?"Watch the disc fly…":
     "Fixed basket across the island. Advance from each landing."}
   </p>
   {game.phase==="holed"?(
    <button className={styles.discGolfMainButton} type="button"
      onClick={()=>onChangeHole((game.holeIndex+1)%DISC_GOLF_HOLES.length)}>
      Next island hole
    </button>
   ):(
    <>
     <div className={styles.discGolfKeyGuide}>
      <div><kbd>A</kbd> <kbd>D</kbd><span>Aim left / right <strong>{aim>0?"+":""}{aim}°</strong></span></div>
      <div><kbd>W</kbd> <kbd>S</kbd><span>Throw higher / lower <strong>{loft}°</strong></span></div>
     </div>
     <div className={styles.discGolfMeters}>
      <div className={styles.discGolfMeterHeader}>
       <span>{charging?"Release inside the sweet spot":"Recommended power"}</span>
       <strong>{charging?
        (Math.abs(shownPower-suggested)<=6?"Clean release":
         shownPower>suggested?"Power drive":"Soft touch"):
        suggested+"% ideal"}</strong>
      </div>
      <div className={styles.discGolfMeter} role="progressbar" aria-label="Disc throw power"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={shownPower}>
       <span className={styles.discGolfPowerFill} style={{width:shownPower+"%"}}/>
       <span className={styles.discGolfSweetBand}
        style={{left:clamp(suggested-6,0,100)+"%",
         width:(clamp(suggested+6,0,100)-clamp(suggested-6,0,100))+"%"}}/>
       <span className={styles.discGolfBestMarker} style={{left:suggested+"%"}}/>
      </div>
     </div>
     <button className={styles.discGolfMainButton} disabled={!available}
       type="button"
       onPointerDown={e=>{if(e.pointerType!=="mouse"||e.button===0){
        e.currentTarget.setPointerCapture(e.pointerId);begin();
       }}}
       onPointerUp={finish}
       onPointerCancel={()=>{held.current=false;setCharging(false);onStage("idle");}}
       onClick={e=>{if(e.detail===0)tap();}}>
       {game.phase==="flying"?"Disc airborne":
        charging?"Release Space to throw":"Tap Space · hold to pull back"}
     </button>
     <span className={styles.discGolfHint}>
      Tap Space for an easy clean release. Hold Space to pull back: the
      power sweeps around the highlighted sweet spot. Release to throw.
      One meter, no separate accuracy timing. Wind and trees still matter.
     </span>
    </>
   )}
   <div className={styles.discGolfHoles} role="group" aria-label="Choose hole">
    {DISC_GOLF_HOLES.map((h,i)=>(
     <button key={h.id} type="button" aria-pressed={i===game.holeIndex}
       disabled={game.phase==="flying"} aria-label={"Play hole "+(i+1)+": "+h.name}
       onClick={()=>onChangeHole(i)}>
       {i+1}
     </button>
    ))}
   </div>
  </aside>
 );
}
