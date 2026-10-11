"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {
 DISC_GOLF_HOLES,discGolfRemaining,discGolfScoreName,discGolfWind,
 recommendDiscGolfPower,discGolfPullback,DISC_GOLF_MAX_BANK,type DiscGolfState,type DiscShot,type DiscGolfSwingStage,
} from "@/lib/world/discGolf";
import {terrainHeight,isWater,SEA_SURFACE} from "@/lib/world/model";
import {DISC_GOLF_SPIN_MIN_RPM,DISC_GOLF_SPIN_MAX_RPM,
 DISC_GOLF_NOSE_MAX_DEGREES} from "@/lib/world/discGolfAerodynamics";
import type {DiscGolfFlightStyle,DiscGolfReleaseStyle} from "@/lib/world/discGolf";
import {discGolfName} from "@/lib/world/discGolfNames";
import {discGolfRoundSummary,nextUnplayedDiscGolfHole,type DiscGolfRound} from "@/lib/world/discGolfRound";
import styles from "./world.module.css";
import {discGolfRailPower,discGolfRailIdeal,discGolfRailStatus,
 clampDiscGolfRail} from "@/lib/world/discGolfPowerRail";

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const ground=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);

export function WorldDiscGolfHUD({game,round,scorecardOpen,onToggleScorecard,onNewRound,onShot,onChangeHole,onExit,onStage,onPreview,onSwing}:{
 game:DiscGolfState;
 round:DiscGolfRound;
 scorecardOpen:boolean;
 onToggleScorecard:()=>void;
 onNewRound:()=>void;
 onShot:(shot:DiscShot)=>void;
 onChangeHole:(hole:number)=>void;
 onExit:()=>void;
 onStage:(stage:DiscGolfSwingStage)=>void;
 onPreview:(shot:DiscShot|null)=>void;
 onSwing:(amount:number)=>void;
}){
 const hole=DISC_GOLF_HOLES[game.holeIndex];
 const roundSummary=discGolfRoundSummary(round);
 const nextHole=nextUnplayedDiscGolfHole(round,game.holeIndex);
 const [restartConfirm,setRestartConfirm]=useState(false);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [loft,setLoft]=useState(24);
 const [aim,setAim]=useState(0);
 const [bankAngle,setBankAngle]=useState(0);
 const [noseAngle,setNoseAngle]=useState(0);
 const [spinRpm,setSpinRpm]=useState(650);
 const [discStyle,setDiscStyle]=useState<DiscGolfFlightStyle>("midrange");
 const [releaseStyle,setReleaseStyle]=useState<DiscGolfReleaseStyle>("backhand");
 const [charging,setCharging]=useState(false);
 const [chargePower,setChargePower]=useState(65);
 const [railDragging,setRailDragging]=useState(false);
 const [railKeyPower,setRailKeyPower]=useState<number|null>(null);
 const [lastReleasePower,setLastReleasePower]=useState<number|null>(null);
 const held=useRef(false);
 const railDraggingRef=useRef(false);
 const fired=useRef(false);
 const pendingReset=useRef<ReturnType<typeof setTimeout>|null>(null);
 const chargeAt=useRef(0);
 const powerBucket=useRef(-1);
 const swingTick=useRef(-1);
 const locked=game.phase==="flying"||game.phase==="holed"||!!game.presentationPending;
 const available=!locked&&game.phase!=="off";
 // Re-solve on a new lie or a changed aim, not on every animation frame.
 const suggested=useMemo(()=>recommendDiscGolfPower(game,loft,aim,ground,isWater,SEA_SURFACE,[],bankAngle,
  {noseAngle,spinRpm,discStyle,releaseStyle}),
  // The wind varies slowly; the preview itself refreshes during aiming.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [game.holeIndex,game.gatesCleared,game.lie.x,game.lie.z,game.phase,loft,aim,bankAngle,noseAngle,spinRpm,discStyle,releaseStyle]);
 const shotAtPower=useCallback((power:number):DiscShot=>({
  power,accuracy:0,loft,aimOffset:aim,bankAngle,
  noseAngle,spinRpm,discStyle,releaseStyle,
 }),[loft,aim,bankAngle,noseAngle,spinRpm,discStyle,releaseStyle]);
 const preview=useCallback((power:number)=>{
  onPreview({power,accuracy:0,loft,aimOffset:aim,bankAngle,
   noseAngle,spinRpm,discStyle,releaseStyle});
 },[onPreview,loft,aim,bankAngle,noseAngle,spinRpm,discStyle,releaseStyle]);
 const queueShot=useCallback((shot:DiscShot)=>{
  if(fired.current)return;
  fired.current=true;
  setRailKeyPower(null);setLastReleasePower(shot.power);
  if(pendingReset.current!==null)clearTimeout(pendingReset.current);
  // If the renderer rejects a request while changing holes, don't deadlock
  // the Space key forever. A successful transition clears this immediately.
  pendingReset.current=setTimeout(()=>{
   fired.current=false;pendingReset.current=null;
  },900);
  setSettingsOpen(false);
  onStage("released");onSwing(1);onPreview(null);
  onShot(shot);
 },[onShot,onPreview,onStage,onSwing]);
 useEffect(()=>{
  if(game.phase!=="ready"&&game.phase!=="landed"&&game.phase!=="water"){
   if(pendingReset.current!==null)clearTimeout(pendingReset.current);
   pendingReset.current=null;
   fired.current=false;
  }
 },[game.phase]);
 useEffect(()=>()=>{if(pendingReset.current!==null)clearTimeout(pendingReset.current);},[]);
 useEffect(()=>{
  if(!available||charging||railDraggingRef.current||fired.current)return;
  preview(railKeyPower??suggested);
  onSwing(0);onStage("idle");
 },[available,charging,suggested,railKeyPower,preview,onSwing,onStage]);
 const begin=useCallback(()=>{
  if(!available||held.current||railDraggingRef.current||fired.current)return;
  held.current=true;chargeAt.current=performance.now();
  powerBucket.current=-1;swingTick.current=-1;
  setCharging(true);setChargePower(suggested);
  onStage("power");
 },[available,onStage,suggested]);
 const finish=useCallback(()=>{
  if(!held.current||fired.current)return;
  held.current=false;
  const ms=performance.now()-chargeAt.current;
  // The elastic meter starts at recommended strength, so a slightly
  // longer press cannot accidentally turn a drive into a tiny putt.
  const power=discGolfPullback(ms,suggested).power;
  setCharging(false);setChargePower(power);
  queueShot(shotAtPower(power));
 },[suggested,queueShot,shotAtPower]);
 const tap=useCallback(()=>{
  if(!available||held.current||railDraggingRef.current||fired.current)return;
  queueShot(shotAtPower(suggested));
 },[available,suggested,queueShot,shotAtPower]);
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
   if(key==="a"||key==="d"||key==="w"||key==="s"||key==="q"||key==="e"||
      key==="arrowleft"||key==="arrowright"||key==="arrowup"||key==="arrowdown"){
    e.preventDefault();
    if(key==="a"||key==="arrowleft")setAim(v=>clamp(v-2,-55,55));
    else if(key==="d"||key==="arrowright")setAim(v=>clamp(v+2,-55,55));
    else if(key==="w"||key==="arrowup")setLoft(v=>clamp(v+2,6,42));
    else if(key==="s"||key==="arrowdown")setLoft(v=>clamp(v-2,6,42));
    else if(key==="q")setBankAngle(v=>clamp(v-5,-DISC_GOLF_MAX_BANK,DISC_GOLF_MAX_BANK));
    else if(key==="e")setBankAngle(v=>clamp(v+5,-DISC_GOLF_MAX_BANK,DISC_GOLF_MAX_BANK));
   }else if(e.code==="Space"){
    e.preventDefault();
    if(!e.repeat)begin();
   }
  };
  const up=(e:KeyboardEvent)=>{
   if(e.code!=="Space"||e.altKey||e.ctrlKey||e.metaKey||isTextEntry(e.target))return;
   if(held.current){e.preventDefault();finish();}
   else if(available&&!fired.current){
    // Keydown may have happened during the flyover or before HUD mount.
    // Never eat the opening keyup without performing the first throw.
    e.preventDefault();tap();
   }
  };
  const cancel=()=>{
   if(held.current||railDraggingRef.current){
    held.current=false;railDraggingRef.current=false;
    setCharging(false);setRailDragging(false);
    onStage("idle");onSwing(0);
   }
  };
  window.addEventListener("keydown",down);
  window.addEventListener("keyup",up);
  window.addEventListener("blur",cancel);
  return ()=>{
   window.removeEventListener("keydown",down);
   window.removeEventListener("keyup",up);
   window.removeEventListener("blur",cancel);
  };
 },[available,begin,finish,tap,onStage,onSwing]);
 const liveWind=game.phase==="flying"?game.lockedWind:discGolfWind(game.holeIndex,game.clock);
 const bearing=Math.atan2(liveWind.x,liveWind.z)*180/Math.PI;
 const windArrow=["↑","↗","→","↘","↓","↙","←","↖"][((Math.round((bearing+360)/45)%8)+8)%8];
 const shownPower=charging||railDragging?chargePower:
  (game.presentationPending||fired.current)&&lastReleasePower!==null?lastReleasePower:
  railKeyPower??suggested;
 const ideal=discGolfRailIdeal(suggested);
 const powerStatus=discGolfRailStatus(shownPower,suggested);
 const sampleRail=(clientX:number,left:number,width:number)=>{
  const value=discGolfRailPower(clientX,left,width);
  setChargePower(value);
  const bucket=Math.round(value/3);
  if(bucket!==powerBucket.current){
   powerBucket.current=bucket;preview(value);
  }
  onSwing(.18+.72*value/100);
  return value;
 };
 const beginRail=(element:HTMLDivElement,pointerId:number,clientX:number)=>{
  if(!available||held.current||railDraggingRef.current||fired.current)return;
  railDraggingRef.current=true;
  powerBucket.current=-1;
  const rect=element.getBoundingClientRect();
  sampleRail(clientX,rect.left,rect.width);
  setRailDragging(true);
  onStage("power");
  element.setPointerCapture(pointerId);
 };
 const moveRail=(element:HTMLDivElement,clientX:number)=>{
  if(!railDraggingRef.current)return;
  const rect=element.getBoundingClientRect();
  sampleRail(clientX,rect.left,rect.width);
 };
 const finishRail=(element:HTMLDivElement,pointerId:number,clientX:number)=>{
  if(!railDraggingRef.current)return;
  const rect=element.getBoundingClientRect();
  const power=discGolfRailPower(clientX,rect.left,rect.width);
  railDraggingRef.current=false;
  setRailDragging(false);
  setChargePower(power);
  if(element.hasPointerCapture(pointerId))element.releasePointerCapture(pointerId);
  queueShot(shotAtPower(power));
 };
 const cancelRail=()=>{
  if(!railDraggingRef.current)return;
  railDraggingRef.current=false;setRailDragging(false);
  onSwing(0);onStage("idle");
  if(available)preview(railKeyPower??suggested);
 };
 const railKeyDown=(key:string)=>{
  if(!available)return false;
  if(key==="Enter"){
   queueShot(shotAtPower(railKeyPower??suggested));
   return true;
  }
  if(key==="Escape"){
   setRailKeyPower(null);preview(suggested);
   return true;
  }
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(key))return false;
  const start=railKeyPower??suggested;
  const next=clampDiscGolfRail(key==="Home"?4:key==="End"?100:
   start+(key==="ArrowRight"||key==="ArrowUp"?1:
     key==="ArrowLeft"||key==="ArrowDown"?-1:key==="PageUp"?10:-10));
  setRailKeyPower(next);
  preview(next);
  return true;
 };
 const remaining=discGolfRemaining(game);
 const gatePending=game.gatesCleared<hole.gates.length;

 return (
  <aside className={styles.discGolfHud} aria-label="Disc golf controls">
   <div className={styles.discGolfBar}>
    <div className={styles.discGolfBarHole}>
     <span className={styles.discGolfBarEyebrow}>DISC GOLF · {game.holeIndex+1}/9 · PAR {hole.par}</span>
     <strong title={discGolfName(game.holeIndex,round.nameSeed)}>{discGolfName(game.holeIndex,round.nameSeed)}</strong>
    </div>
    <div className={styles.discGolfBarStatus} aria-live="polite">
     <span>{game.strokes} {game.strokes===1?"throw":"throws"} · {gatePending?"Gate "+(game.gatesCleared+1)+"/"+hole.gates.length:"Basket"} · {remaining.toFixed(0)} m</span>
     <span>{game.presentationPending?(game.phase==="flying"?"Disc in flight":"Shasta fetching"):
       game.phase==="holed"?discGolfScoreName(game.strokes,hole.par):
       game.phase==="water"?"Water · free retry":"Wind "+windArrow+" "+liveWind.speed.toFixed(1)}</span>
    </div>
    <div className={styles.discGolfQuickReadout} aria-label="Current throw settings">
     <span title="A/D adjust aim">Aim <strong>{aim>0?"+":""}{aim}°</strong></span>
     <span title="W/S adjust loft">Loft <strong>{loft}°</strong></span>
     <span title="Q/E adjust curve">Curve <strong>{bankAngle>0?"+":""}{bankAngle}°</strong></span>
    </div>
    <div className={styles.discGolfBarPower}>
     <div className={styles.discGolfMeterHeader}>
      <span>{charging||railDragging?"PULL · RELEASE":"THROW POWER"}</span>
      <strong aria-live="off">{shownPower}% <span className={styles.discGolfSuggested}>/ {ideal.ideal}% target</span></strong>
     </div>
     <div className={styles.discGolfMeterRail}>
      <div className={[
       styles.discGolfMeter,
       charging||railDragging?styles.discGolfMeterActive:"",
       !available?styles.discGolfMeterLocked:"",
      ].filter(Boolean).join(" ")}
       role="slider" tabIndex={available?0:-1}
       aria-disabled={!available}
       aria-label="Throw power. Drag and release to throw, or use arrow keys and Enter."
       aria-valuemin={4} aria-valuemax={100} aria-valuenow={shownPower}
       aria-valuetext={shownPower+" percent; suggested "+ideal.ideal+" percent"}
       data-power={shownPower} data-quality={powerStatus}
       data-dragging={String(railDragging)}
       onPointerDown={e=>{
        if(e.pointerType==="mouse"&&e.button!==0)return;
        e.preventDefault();beginRail(e.currentTarget,e.pointerId,e.clientX);
       }}
       onPointerMove={e=>moveRail(e.currentTarget,e.clientX)}
       onPointerUp={e=>finishRail(e.currentTarget,e.pointerId,e.clientX)}
       onPointerCancel={cancelRail}
       onLostPointerCapture={cancelRail}
       onKeyDown={e=>{if(railKeyDown(e.key)){e.preventDefault();e.stopPropagation();}}}>
       <span className={styles.discGolfTrackTicks} aria-hidden="true"/>
       <span className={styles.discGolfPowerFill}
        style={{width:shownPower+"%"}} aria-hidden="true"/>
       <span className={styles.discGolfSweetBand}
        style={{left:ideal.low+"%",width:ideal.high-ideal.low+"%"}}
        aria-hidden="true"/>
       <span className={styles.discGolfBestMarker}
        style={{left:ideal.ideal+"%"}} aria-hidden="true"/>
       <span className={styles.discGolfPowerHandle}
        style={{left:shownPower+"%"}} aria-hidden="true">
        <span className={styles.discGolfPowerGrip}/>
       </span>
      </div>
     </div>
     <div className={styles.discGolfMeterFooter} aria-hidden="true">
      <span>SOFT</span>
      <span>{charging?"HOLD SPACE":railDragging?"RELEASE TO THROW":"DRAG TO THROW"}</span>
      <span>FULL</span>
     </div>
    </div>
    <div className={styles.discGolfBarPrimary}>
     {game.presentationPending?(
      <button type="button" className={styles.discGolfMainButton} disabled>
       {game.phase==="flying"?"In flight":"Shasta fetching"}
      </button>
     ):game.phase==="holed"?(
      roundSummary.complete?(
       <button type="button" className={styles.discGolfMainButton}
        onClick={onNewRound}>New round</button>
      ):(
       <button type="button" className={styles.discGolfMainButton}
        disabled={nextHole===null}
        onClick={()=>{if(nextHole!==null)onChangeHole(nextHole);}}>
        Next · {nextHole===null?"Scorecard":nextHole+1}
       </button>
      )
     ):(
      <button type="button" className={styles.discGolfMainButton}
       disabled={!available}
       onPointerDown={e=>{if(e.pointerType!=="mouse"||e.button===0){
        e.currentTarget.setPointerCapture(e.pointerId);begin();
       }}}
       onPointerUp={finish}
       onPointerCancel={()=>{held.current=false;setCharging(false);onStage("idle");}}
       onClick={()=>{if(held.current)finish();else tap();}}>
       {charging?"Release to throw":"Space · Throw"}
      </button>
     )}
    </div>
    <div className={styles.discGolfBarActions}>
     <button type="button" aria-expanded={settingsOpen}
      aria-controls="disc-golf-settings"
      onClick={()=>{
       if(!settingsOpen&&scorecardOpen)onToggleScorecard();
       setSettingsOpen(v=>!v);
      }}>Tune</button>
     <button type="button" aria-expanded={scorecardOpen}
      aria-controls="disc-golf-course"
      onClick={()=>{
       setSettingsOpen(false);
       onToggleScorecard();
      }}>Course</button>
     <button type="button" aria-label="Leave disc golf" onClick={()=>{
      onExit();
      requestAnimationFrame(()=>document.querySelector<HTMLCanvasElement>('canvas[role="application"]')?.focus({preventScroll:true}));
     }}>Exit</button>
    </div>
   </div>

   {settingsOpen&&(
    <section id="disc-golf-settings" className={styles.discGolfPanel}
     aria-label="Disc throw tuning">
     <div className={styles.discGolfPanelHeading}>
      <strong>Shape your throw</strong>
      <button type="button" onClick={()=>setSettingsOpen(false)}>Close</button>
     </div>
     <div className={styles.discGolfTuneGrid}>
      <label className={styles.discGolfTuneItem} htmlFor="disc-golf-aim">
       <span>Aim · {aim>0?"+":""}{aim}° <small>A / D</small></span>
       <input id="disc-golf-aim" type="range" min={-55} max={55} step={1}
        value={aim} disabled={!available||charging}
        onChange={e=>setAim(Number(e.currentTarget.value))}/>
      </label>
      <label className={styles.discGolfTuneItem} htmlFor="disc-golf-loft">
       <span>Loft · {loft}° <small>W / S</small></span>
       <input id="disc-golf-loft" type="range" min={6} max={42} step={1}
        value={loft} disabled={!available||charging}
        onChange={e=>setLoft(Number(e.currentTarget.value))}/>
      </label>
      <label className={styles.discGolfTuneItem} htmlFor="disc-golf-bank">
       <span>Curve · {bankAngle>0?"+":""}{bankAngle}° <small>Q / E</small></span>
       <input id="disc-golf-bank" type="range"
        min={-DISC_GOLF_MAX_BANK} max={DISC_GOLF_MAX_BANK} step={5}
        value={bankAngle} disabled={!available||charging}
        onChange={e=>setBankAngle(Number(e.currentTarget.value))}
        aria-label="Curve disc left or right" aria-valuetext={
         bankAngle===0?"Flat":Math.abs(bankAngle)+" degrees "+(bankAngle<0?"left":"right")
        }/>
      </label>
      <label className={styles.discGolfTuneItem} htmlFor="disc-golf-nose">
       <span>Nose · {noseAngle>0?"+":""}{noseAngle}°</span>
       <input id="disc-golf-nose" type="range" min={-DISC_GOLF_NOSE_MAX_DEGREES}
        max={DISC_GOLF_NOSE_MAX_DEGREES} step={1} value={noseAngle}
        disabled={!available||charging} onChange={e=>setNoseAngle(Number(e.currentTarget.value))}/>
      </label>
      <label className={styles.discGolfTuneItem} htmlFor="disc-golf-spin">
       <span>Flick · {spinRpm} rpm</span>
       <input id="disc-golf-spin" type="range" min={DISC_GOLF_SPIN_MIN_RPM}
        max={DISC_GOLF_SPIN_MAX_RPM} step={50} value={spinRpm}
        disabled={!available||charging} onChange={e=>setSpinRpm(Number(e.currentTarget.value))}/>
      </label>
      <label className={styles.discGolfTuneItem} htmlFor="disc-golf-disc-type">
       <span>Disc profile</span>
       <select id="disc-golf-disc-type" value={discStyle} disabled={!available||charging}
        onChange={e=>setDiscStyle(e.currentTarget.value as DiscGolfFlightStyle)}>
        <option value="putter">Putter</option><option value="midrange">Midrange</option>
        <option value="fairway">Fairway</option><option value="driver">Driver</option>
       </select>
      </label>
      <label className={styles.discGolfTuneItem} htmlFor="disc-golf-release-style">
       <span>Release</span>
       <select id="disc-golf-release-style" value={releaseStyle} disabled={!available||charging}
        onChange={e=>setReleaseStyle(e.currentTarget.value as DiscGolfReleaseStyle)}>
        <option value="backhand">Backhand</option><option value="forehand">Forehand</option>
       </select>
      </label>
      <div className={styles.discGolfTuneActions}>
       <button type="button" onClick={()=>setBankAngle(0)}
        disabled={!available||charging||bankAngle===0}>Flat curve</button>
       <span>Tap Space for suggested power. Hold to charge.</span>
      </div>
     </div>
    </section>
   )}
   {scorecardOpen&&(
    <section id="disc-golf-course" className={styles.discGolfPanel}
     aria-label="Nine-hole course and scorecard">
     <div className={styles.discGolfPanelHeading}>
      <strong>Course · {roundSummary.holesPlayed}/9 played</strong>
      <span>{roundSummary.strokes} strokes · {roundSummary.toPar>0?"+":""}{roundSummary.toPar} to par</span>
      <button type="button" onClick={onToggleScorecard}>Close</button>
     </div>
     <div className={styles.discGolfHoles} role="group" aria-label="Choose hole">
      {DISC_GOLF_HOLES.map((h,i)=>(
       <button key={h.id} type="button" aria-pressed={i===game.holeIndex}
        className={round.scores[i]!==null?styles.discGolfRecordedHole:undefined}
        disabled={game.phase==="flying"||!!game.presentationPending}
        title={round.scores[i]===null?"Hole not yet completed":"Recorded: "+round.scores[i]+" strokes. Replay is practice."}
        aria-label={"Play hole "+(i+1)+": "+discGolfName(i,round.nameSeed)+
         (round.scores[i]===null?"":", scored "+round.scores[i]+" (practice replay)")}
        onClick={()=>onChangeHole(i)}>
        {i+1}{round.scores[i]!==null?" ✓":""}
       </button>
      ))}
     </div>
     <div className={styles.discGolfScorecard}>
      <div className={styles.discGolfScorecardHeading}>
       <strong>{roundSummary.complete?"Round finished":"Round progress"}</strong>
       {round.bestTotal!==null&&<span>Best: {round.bestTotal} strokes</span>}
      </div>
      <table>
       <thead><tr><th scope="col">Hole</th><th scope="col">Par</th>
        <th scope="col">Score</th><th scope="col">±</th></tr></thead>
       <tbody>
        {DISC_GOLF_HOLES.map((h,i)=>{
         const score=round.scores[i];
         const delta=score===null?null:score-h.par;
         return <tr key={h.id} aria-current={i===game.holeIndex?"true":undefined}>
          <th scope="row">{i+1}. {discGolfName(i,round.nameSeed)}</th>
          <td>{h.par}</td><td>{score??"·"}</td>
          <td>{delta===null?"·":delta>0?"+"+delta:delta}</td>
         </tr>;
        })}
       </tbody>
       <tfoot><tr><th scope="row">Total</th><td>{roundSummary.coursePar}</td>
        <td>{roundSummary.strokes}</td>
        <td>{roundSummary.toPar>0?"+"+roundSummary.toPar:roundSummary.toPar}</td>
       </tr></tfoot>
      </table>
      {round.scores[game.holeIndex]!==null&&game.phase!=="holed"&&(
       <p className={styles.discGolfPracticeNote}>Practice · saved {round.scores[game.holeIndex]}</p>
      )}
      {restartConfirm?(
       <div className={styles.discGolfRestartActions}>
        <button type="button" onClick={()=>{onNewRound();setRestartConfirm(false);}}>Confirm new round</button>
        <button type="button" onClick={()=>setRestartConfirm(false)}>Cancel</button>
       </div>
      ):(
       <button type="button" className={styles.discGolfResetButton}
        disabled={!!game.presentationPending||game.phase==="flying"}
        onClick={()=>roundSummary.holesPlayed>0?setRestartConfirm(true):onNewRound()}>
        Start a fresh round
       </button>
      )}
     </div>
    </section>
   )}
  </aside>
 );
}
