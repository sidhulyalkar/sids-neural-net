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
 const [loft,setLoft]=useState(24);
 const [aim,setAim]=useState(0);
 const [bankAngle,setBankAngle]=useState(0);
 const [noseAngle,setNoseAngle]=useState(0);
 const [spinRpm,setSpinRpm]=useState(650);
 const [discStyle,setDiscStyle]=useState<DiscGolfFlightStyle>("midrange");
 const [releaseStyle,setReleaseStyle]=useState<DiscGolfReleaseStyle>("backhand");
 const [charging,setCharging]=useState(false);
 const [chargePower,setChargePower]=useState(65);
 const held=useRef(false);
 const fired=useRef(false);
 const pendingReset=useRef<ReturnType<typeof setTimeout>|null>(null);
 const chargeAt=useRef(0);
 const powerBucket=useRef(-1);
 const swingTick=useRef(-1);
 const locked=game.phase==="flying"||game.phase==="holed";
 const available=!locked&&game.phase!=="off";
 // Re-solve on a new lie or a changed aim, not on every animation frame.
 const suggested=useMemo(()=>recommendDiscGolfPower(game,loft,aim,ground,isWater,SEA_SURFACE,[],bankAngle,
  {noseAngle,spinRpm,discStyle,releaseStyle}),
  // The wind varies slowly; the preview itself refreshes during aiming.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [game.holeIndex,game.gatesCleared,game.lie.x,game.lie.z,game.phase,loft,aim,bankAngle,noseAngle,spinRpm,discStyle,releaseStyle]);
 const preview=useCallback((power:number)=>{
  onPreview({power,accuracy:0,loft,aimOffset:aim,bankAngle,
   noseAngle,spinRpm,discStyle,releaseStyle});
 },[onPreview,loft,aim,bankAngle,noseAngle,spinRpm,discStyle,releaseStyle]);
 const queueShot=useCallback((shot:DiscShot)=>{
  if(fired.current)return;
  fired.current=true;
  if(pendingReset.current!==null)clearTimeout(pendingReset.current);
  // If the renderer rejects a request while changing holes, don't deadlock
  // the Space key forever. A successful transition clears this immediately.
  pendingReset.current=setTimeout(()=>{
   fired.current=false;pendingReset.current=null;
  },900);
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
  held.current=false;
  const ms=performance.now()-chargeAt.current;
  // The elastic meter starts at recommended strength, so a slightly
  // longer press cannot accidentally turn a drive into a tiny putt.
  const power=discGolfPullback(ms,suggested).power;
  setCharging(false);setChargePower(power);
  queueShot({power,loft,aimOffset:aim,accuracy:0,bankAngle,
   noseAngle,spinRpm,discStyle,releaseStyle});
 },[suggested,queueShot,loft,aim,bankAngle,noseAngle,spinRpm,discStyle,releaseStyle]);
 const tap=useCallback(()=>{
  if(!available||held.current||fired.current)return;
  queueShot({power:suggested,loft,aimOffset:aim,accuracy:0,bankAngle,
   noseAngle,spinRpm,discStyle,releaseStyle});
 },[available,suggested,queueShot,loft,aim,bankAngle,noseAngle,spinRpm,discStyle,releaseStyle]);
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
  const cancel=()=>{if(held.current){held.current=false;setCharging(false);onStage("idle");onSwing(0);}};
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
 const shownPower=charging?chargePower:suggested;
 const remaining=discGolfRemaining(game);
 const gatePending=game.gatesCleared<hole.gates.length;
 return (
  <aside className={styles.discGolfHud} aria-label="Disc golf controls">
   <div className={styles.discGolfHeading}>
    <div>
     <span className={styles.eyebrow}>DISC GOLF · {game.holeIndex+1}/{DISC_GOLF_HOLES.length}</span>
     <h2>{discGolfName(game.holeIndex,round.nameSeed)}</h2>
    </div>
    <div className={styles.discGolfHeaderActions}>
     <button type="button" aria-expanded={scorecardOpen} aria-controls="disc-golf-scorecard"
       onClick={onToggleScorecard}>Scorecard</button>
    <button type="button" onClick={()=>{
     onExit();
     requestAnimationFrame(()=>document.querySelector<HTMLCanvasElement>('canvas[role="application"]')?.focus({preventScroll:true}));
    }} aria-label="Leave disc golf">Exit</button>
    </div>
   </div>
   <div className={styles.discGolfStats} aria-live="polite">
    <span>Par {hole.par}</span><span>{game.strokes} throws</span>
    <span>{gatePending?"Gate "+(game.gatesCleared+1)+"/"+hole.gates.length:"Basket"} · {remaining.toFixed(0)} m</span>
    <span title="Wind">{ "Wind "+windArrow+" "+liveWind.speed.toFixed(1) }</span>
   </div>
   <p className={styles.discGolfNote}>
    {game.phase==="holed"?discGolfScoreName(game.strokes,hole.par)+"!":
     game.phase==="water"?"Water · free retry":
     game.phase==="landed"?(gatePending?"Next gate":"Next throw"):
     game.phase==="flying"?"Shasta, fetch!":""}
   </p>
   {game.phase==="holed"?(
    roundSummary.complete?(
     <div className={styles.discGolfRoundComplete} aria-live="polite">
      <strong>Round complete · {roundSummary.strokes} strokes</strong>
      <span>Par {roundSummary.coursePar} · {roundSummary.toPar>0?"+":""}{roundSummary.toPar} overall</span>
      <button className={styles.discGolfMainButton} type="button" onClick={onNewRound}>Play another round</button>
     </div>
    ):(
     <button type="button" className={styles.discGolfMainButton}
       onClick={()=>{if(nextHole!==null)onChangeHole(nextHole);}}>
       {nextHole===null?"See scorecard":"Next · "+(nextHole+1)}
     </button>
    )
   ):(

    <>
     <div className={styles.discGolfKeyGuide}>
      <div><kbd>A</kbd> <kbd>D</kbd><span>Aim <strong>{aim>0?"+":""}{aim}°</strong></span></div>
      <div><kbd>W</kbd> <kbd>S</kbd><span>Loft <strong>{loft}°</strong></span></div>
      <div><kbd>Q</kbd> <kbd>E</kbd><span>Curve <strong>{bankAngle<0?"↶ Left":bankAngle>0?"Right ↷":"Flat"} {Math.abs(bankAngle)}°</strong></span></div>
     </div>
     <div className={styles.discGolfCurve}>
      <label htmlFor="disc-golf-bank">Disc tilt</label>
      <div className={styles.discGolfCurveRow}>
       <span aria-hidden="true">↶</span>
       <input id="disc-golf-bank" type="range" min={-DISC_GOLF_MAX_BANK}
        max={DISC_GOLF_MAX_BANK} step={5} value={bankAngle}
        disabled={!available||charging}
        onChange={e=>setBankAngle(Number(e.currentTarget.value))}
        aria-label="Curve disc left or right" aria-valuetext={
         bankAngle===0?"Flat":Math.abs(bankAngle)+" degrees "+(bankAngle<0?"left":"right")
        }/>
       <span aria-hidden="true">↷</span>
       <button type="button" onClick={()=>setBankAngle(0)}
        disabled={!available||charging||bankAngle===0} aria-label="Reset disc curve to flat">
        Flat
       </button>
      </div>
     </div>
     <section className={styles.discGolfFlightControls} aria-label="Disc aerodynamics">
      <div className={styles.discGolfFlightTop}>
       <label htmlFor="disc-golf-disc-type">Disc</label>
       <select id="disc-golf-disc-type" value={discStyle} disabled={!available||charging}
        onChange={e=>setDiscStyle(e.currentTarget.value as DiscGolfFlightStyle)}>
        <option value="putter">Putter</option><option value="midrange">Midrange</option>
        <option value="fairway">Fairway</option><option value="driver">Driver</option>
       </select>
       <label htmlFor="disc-golf-release-style">Throw</label>
       <select id="disc-golf-release-style" value={releaseStyle} disabled={!available||charging}
        onChange={e=>setReleaseStyle(e.currentTarget.value as DiscGolfReleaseStyle)}>
        <option value="backhand">Backhand</option><option value="forehand">Forehand</option>
       </select>
      </div>
      <div className={styles.discGolfFlightSliders}>
       <label htmlFor="disc-golf-spin">Flick · {spinRpm} rpm</label>
       <input id="disc-golf-spin" type="range" min={DISC_GOLF_SPIN_MIN_RPM}
        max={DISC_GOLF_SPIN_MAX_RPM} step={50} value={spinRpm}
        disabled={!available||charging} onChange={e=>setSpinRpm(Number(e.currentTarget.value))}/>
       <label htmlFor="disc-golf-nose">Nose · {noseAngle>0?"+":""}{noseAngle}°</label>
       <input id="disc-golf-nose" type="range" min={-DISC_GOLF_NOSE_MAX_DEGREES}
        max={DISC_GOLF_NOSE_MAX_DEGREES} step={1} value={noseAngle}
        disabled={!available||charging} onChange={e=>setNoseAngle(Number(e.currentTarget.value))}/>
      </div>
     </section>
     <div className={styles.discGolfMeters}>
      <div className={styles.discGolfMeterHeader}>
       <span>{charging?"Release":"Power"}</span>
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
       onClick={()=>{if(held.current)finish();else tap();}}>
       {game.phase==="flying"?"Disc airborne":
        charging?"Release to throw":"Space · Throw"}
     </button>
     <span className={styles.discGolfHint}>
      Hold Space for power.
     </span>
    </>
   )}
   <div className={styles.discGolfRoundStrip} aria-live="polite">
    <span>{roundSummary.holesPlayed}/{roundSummary.holesTotal} holes</span>
    <strong>{roundSummary.strokes} strokes · {roundSummary.toPar>0?"+":""}{roundSummary.toPar}</strong>
   </div>
   <div className={styles.discGolfHoles} role="group" aria-label="Choose hole">
    {DISC_GOLF_HOLES.map((h,i)=>(
     <button key={h.id} type="button" aria-pressed={i===game.holeIndex}
       className={round.scores[i]!==null?styles.discGolfRecordedHole:undefined}
       disabled={game.phase==="flying"}
       title={round.scores[i]===null?"Hole not yet completed":"Recorded: "+round.scores[i]+" strokes. Replay is practice."}
       aria-label={"Play hole "+(i+1)+": "+discGolfName(i,round.nameSeed)+
        (round.scores[i]===null?"":", scored "+round.scores[i]+" (practice replay)")}
       onClick={()=>onChangeHole(i)}>
       {i+1}{round.scores[i]!==null?" ✓":""}
     </button>
    ))}
   </div>
   {round.scores[game.holeIndex]!==null&&game.phase!=="holed"&&
    <p className={styles.discGolfPracticeNote}>
     Practice · saved score {round.scores[game.holeIndex]}
    </p>}
   <section id="disc-golf-scorecard" className={styles.discGolfScorecard}
     hidden={!scorecardOpen} aria-label="Nine-hole scorecard">
    <div className={styles.discGolfScorecardHeading}>
     <strong>{roundSummary.complete?"Round finished":"Round progress"}</strong>
     {round.bestTotal!==null&&<span>Best round: {round.bestTotal} strokes</span>}
    </div>
    <table>
     <thead><tr><th scope="col">Hole</th><th scope="col">Par</th><th scope="col">Score</th><th scope="col">±</th></tr></thead>
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
    {!roundSummary.complete&&
     <p className={styles.discGolfHint}>Completed holes count.</p>}
    {restartConfirm?(
     <div className={styles.discGolfRestartActions}>
      <button type="button" onClick={()=>{onNewRound();setRestartConfirm(false);}}>
       Confirm new round
      </button>
      <button type="button" onClick={()=>setRestartConfirm(false)}>Cancel</button>
     </div>
    ):(
     <button className={styles.discGolfResetButton} type="button"
       onClick={()=>roundSummary.holesPlayed>0?setRestartConfirm(true):onNewRound()}>
       Start a fresh round
     </button>
    )}
   </section>
  </aside>
 );
}
