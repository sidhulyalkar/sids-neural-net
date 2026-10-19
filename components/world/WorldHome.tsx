"use client";
import {worldGameSession} from "@/lib/world/gameMode";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MEMORY_POINTS,
  WILDLIFE_DISCOVERIES,
  REGIONS,
  type RegionId,
  type WorldCommand,
  type WorldContent,
} from "@/lib/world/model";
import { ACTIVITIES, activityConfig, type Activity, type AquaticMode } from "@/lib/world/activities";
import { COASTAL_FLORA, MARINE_LIFE } from "@/lib/world/ecology";
import { UNDERWATER_TRIDENTS } from "@/lib/world/artifacts";
import { JOSHUA_TRIAL, JOSHUA_GATES, type TrialState } from "@/lib/world/trials";
import { JOSHUA_GHOSTS } from "@/lib/world/joshuaGhostRace";
import { WorldDiscGolfHUD } from "./WorldDiscGolfHUD";
import { idleDiscGolf,type DiscShot,type DiscGolfState,type DiscGolfSwingStage } from "@/lib/world/discGolf";
import {emptyDiscGolfRound,loadDiscGolfRound,persistDiscGolfRound,recordDiscGolfHole,nextUnplayedDiscGolfHole,discGolfRoundSummary} from "@/lib/world/discGolfRound";
import {newDiscGolfNameSeed} from "@/lib/world/discGolfNames";
import { idleSkimHeat, SKIM_BOARDS, type SkimHeat } from "@/lib/world/skimboarding";
import {
  BIG_AIR,bigAirBirdCallout,mountainJumpOutwardGain,idleBigAir,type BigAirState,
} from "@/lib/world/bigAir";
import styles from "./world.module.css";

const WorldScene = dynamic(() => import("./WorldScene"), { ssr: false });
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const LINKS = [
  ["About", "/about"],
  ["Projects", "/projects"],
  ["Research", "/ideas"],
  ["Photography", "/photography"],
  ["Games", "/arcade"],
  ["Frontier", "/frontier"],
  ["Publications", "/publications"],
  ["Resume", "/resume"],
  ["Contact", "/contact"],
];
const INTRO: Record<RegionId, { title: string; text: string }> = {
  waterfall: { title: "Fern falls.", text: "Snowmelt from Granite ridge." },
  canyon: { title: "Moss canyon.", text: "" },
  desert: {title:"Joshua basin.",text:"Warm granite, open washes and desert trails."},
  rainforest: {title:"Rainforest.",text:"A shaded path from canopy to coast."},
  cavern: { title: "Arcade cavern.", text: "Playable games carved into stone." },
  grove: { title: "Redwood grove.", text: "Neuroscience · engineering · Shasta." },
  mountain: { title: "Granite ridge.", text: "Selected builds." },
  neural: { title: "Mystic grove.", text: "Research questions." },
  coast: { title: "Wild coast.", text: "Cold water · trails · photographs." },
  lagoon: { title: "Lagoon reef.", text: "Bora Bora · Tahiti · Mo’orea." },
  "north-shore": { title: "North shore.", text: "Skim the shorebreak." },
};

// Reuse archive records, keeping regional discoveries relevant to their surroundings.
const REGION_PHOTOS: Partial<Record<RegionId, readonly string[]>> = {
  mountain: ["lake", "shasta-lake"],
  grove: ["shasta-trail", "shasta-stream"],
  waterfall: ["shasta-water", "shasta-stream"],
  canyon: ["shasta-field"],
  desert: ["desert-ridges"],
  rainforest: ["rainforest-leaves"],
  lagoon: ["lagoon-shore"],
};
const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  LINKS.map(([label, href]) => [href, label]),
);

export function WorldHome({ content }: { content: WorldContent }) {
  const [enabled, setEnabled] = useState(false);
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activity, setActivity] = useState<Activity>("run");
  const [skim, setSkim] = useState<SkimHeat>(idleSkimHeat);
  const [skimNearby, setSkimNearby] = useState<number|null>(null);
  const [skimCommand, setSkimCommand] = useState<"pickup"|"drop"|"pop"|"shuvit"|"big-spin"|"three-sixty"|"wrap"|"exit"|"restart">("pickup");
  const [skimCommandSerial, setSkimCommandSerial] = useState(0);
  const [skimBoardIndex, setSkimBoardIndex] = useState(0);
  const [skimBest, setSkimBest] = useState<number|null>(()=>{
    if(typeof window==="undefined")return null;
    try { const v=Number(window.localStorage.getItem("sid-world:skim-heat-v2")); return v>0&&Number.isFinite(v)?v:null; }
    catch {return null;}
  });
  const onSkim=useCallback((heat:SkimHeat)=>{
    setSkim(heat);
    if(heat.phase==="ready")setActivity("run");
    if(heat.phase==="finished" && heat.score>0){
      setSkimBest(current=>current===null?heat.score:Math.max(current,heat.score));
      try{
        const stored=Number(window.localStorage.getItem("sid-world:skim-heat-v2"))||0;
        if(heat.score>stored)
          window.localStorage.setItem("sid-world:skim-heat-v2",String(heat.score));
      }catch{/* private browsing or storage unavailable */}
    }
  },[setSkim,setSkimBest,setActivity]);
  const issueSkim=(action:typeof skimCommand,board=0)=>{
    if(action==="pickup")setActivity("run");
    setSkimCommand(action);setSkimBoardIndex(board);setSkimCommandSerial(n=>n+1);
    requestAnimationFrame(()=>worldRoot.current?.querySelector("canvas")?.focus({preventScroll:true}));
  };
  const [actionSerial, setActionSerial] = useState(0);
  const [challengeSerial,setChallengeSerial]=useState(0);
  const [bigAirSerial,setBigAirSerial]=useState(0);
  const [sessionExitSerial,setSessionExitSerial]=useState(0);
  const [discGolf,setDiscGolf]=useState<DiscGolfState>(idleDiscGolf);
  const [discGolfRound,setDiscGolfRound]=useState(loadDiscGolfRound);
  const [discGolfScorecardOpen,setDiscGolfScorecardOpen]=useState(false);
  useEffect(()=>{persistDiscGolfRound(discGolfRound);},[discGolfRound]);
  const [discPreviewShot,setDiscPreviewShot]=useState<DiscShot|null>(null);
  const onDiscPreview=useCallback((shot:DiscShot|null)=>setDiscPreviewShot(shot),[]);
  const [discGolfStage,setDiscGolfStage]=useState<DiscGolfSwingStage>("idle");
  const [discGolfSwingAmount,setDiscGolfSwingAmount]=useState(0);
  const onDiscSwing=useCallback((progress:number)=>setDiscGolfSwingAmount(progress),[]);
  const [discGolfStartSerial,setDiscGolfStartSerial]=useState(0);
  const [discGolfHoleIndex,setDiscGolfHoleIndex]=useState(0);
  const [discGolfShotSerial,setDiscGolfShotSerial]=useState(0);
  const [discGolfShot,setDiscGolfShot]=useState<DiscShot|null>(null);
  const [discGolfExitSerial,setDiscGolfExitSerial]=useState(0);
  const lastDiscGolfPhase=useRef<DiscGolfState["phase"]>("off");
  const previousFetchPending=useRef(false);
  const onDiscGolf=useCallback((g:DiscGolfState)=>{
    setDiscGolf(g);
    const wasPending=previousFetchPending.current;
    previousFetchPending.current=!!g.presentationPending;
    // Scoring commits as soon as chains catch, but the scorecard should not
    // hide the fetch POV. Show it when Shasta's animation has finished.
    if(wasPending&&!g.presentationPending&&g.phase==="holed")
      setDiscGolfScorecardOpen(true);
    const changed=g.phase!==lastDiscGolfPhase.current;
    lastDiscGolfPhase.current=g.phase;
    if(!changed)return;
    if(g.phase==="holed"){
      setDiscGolfRound(previous=>recordDiscGolfHole(previous,g.holeIndex,g.strokes));
      if(!g.presentationPending)setDiscGolfScorecardOpen(true);
    }
    if(g.phase==="landed"||g.phase==="water"||g.phase==="holed"||g.phase==="off"){
      setDiscGolfStage("idle");setDiscGolfSwingAmount(0);
    }
    if((g.phase==="landed"||g.phase==="water"||g.phase==="ready")&&
       !g.presentationPending)
      setDiscPreviewShot({power:65,accuracy:0,loft:22,aimOffset:0});
    if(g.presentationPending||g.phase==="off"||g.phase==="flying"||
       g.phase==="holed")setDiscPreviewShot(null);
  },[setDiscGolf,setDiscGolfStage,setDiscPreviewShot,setDiscGolfSwingAmount]);
  const startDiscHole=(index:number)=>{
    if(skim.phase!=="off")return;
    // Start commands and throws carry separate serials. Do not carry a stale
    // shot payload across a hole transition.
    setDiscGolfShot(null);
    setDiscGolfScorecardOpen(false);
    setDiscGolfStage("idle");setDiscGolfSwingAmount(0);setDiscGolfHoleIndex(index);
    setDiscPreviewShot({power:65,accuracy:0,loft:22,aimOffset:0});
    setBigAir(idleBigAir());
    setTrial({phase:"idle",nextGate:0,elapsedMs:0,splitsMs:[]});
    setActivity("run");
    setDiscGolfStartSerial(n=>n+1);
  };
  const restartDiscRound=()=>{
    setDiscGolfRound(current=>emptyDiscGolfRound(current.bestTotal,newDiscGolfNameSeed()));
    startDiscHole(0);
  };
  const takeDiscShot=(shot:DiscShot)=>{
    if(discGolf.presentationPending)return;
    // Never let the optional course overlay obscure an active flight.
    setDiscGolfScorecardOpen(false);
    setDiscGolfShot(shot);
    setDiscGolfShotSerial(n=>n+1);
  };
  const exitDiscGolf=()=>{
    setDiscGolfStage("idle");setDiscGolfSwingAmount(0);setDiscGolf(idleDiscGolf());
    setDiscPreviewShot(null);
    setDiscGolfExitSerial(n=>n+1);
  };
  const [bigAir,setBigAir]=useState<BigAirState>(idleBigAir);
  const [jetActive,setJetActive]=useState(false);
  const [bestFlight,setBestFlight]=useState<number|null>(()=>{
    if(typeof window==="undefined")return null;
    try{
      const raw=window.localStorage.getItem("sid-world:big-air:"+BIG_AIR.version);
      const value=raw?JSON.parse(raw) as {distance?:number}:null;
      return value&&typeof value.distance==="number"&&Number.isFinite(value.distance)&&
        value.distance>=0&&value.distance<300?value.distance:null;
    }catch{return null;}
  });
  const bestFlightRef=useRef(bestFlight);
  const [birdVoice,setBirdVoice]=useState(false);
  const birdVoiceRef=useRef(false);
  const lastSpokenFlightMarker=useRef(0);
  const toggleBirdVoice=()=>{
    if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){
      setBirdVoice(false);
      birdVoiceRef.current=false;
      return;
    }
    const next=!birdVoiceRef.current;
    birdVoiceRef.current=next;
    setBirdVoice(next);
    if(!next)window.speechSynthesis.cancel();
  };
  const [trial,setTrial]=useState<TrialState>({
    phase:"idle",nextGate:0,elapsedMs:0,splitsMs:[],
  });
  const [personalBest,setPersonalBest]=useState<number|null>(()=>{
    if(typeof window==="undefined")return null;
    try {
      const raw=window.localStorage.getItem("sid-world:trial:"+JOSHUA_TRIAL.version);
      if(!raw)return null;
      const best=JSON.parse(raw) as {elapsedMs?:number};
      return typeof best.elapsedMs==="number"&&Number.isFinite(best.elapsedMs)&&
        best.elapsedMs>0&&best.elapsedMs<3600000 ? best.elapsedMs : null;
    } catch {return null;}
  });
  const bestRef=useRef<number|null>(personalBest);
  const [aquatic, setAquatic] = useState<AquaticMode>("land");
  const [waterAction, setWaterAction] = useState<"dive" | "deeper" | "shallower" | "surface">("dive");
  const [waterActionSerial, setWaterActionSerial] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const [region, setRegion] = useState<RegionId>("grove");
  const [nearby, setNearby] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [command, setCommand] = useState<WorldCommand | null>(null);
  const worldRoot = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const onError = useCallback(() => {
    setFailed(true);
    setEnabled(false);
    setReady(false);
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const onChallenge=useCallback((next:TrialState)=>{
    setTrial(next);
    if(next.phase==="complete" && Number.isFinite(next.elapsedMs) &&
      next.elapsedMs>0 && (!bestRef.current || next.elapsedMs<bestRef.current)){
      bestRef.current=next.elapsedMs;
      setPersonalBest(next.elapsedMs);
      try {
        window.localStorage.setItem("sid-world:trial:"+JOSHUA_TRIAL.version,
          JSON.stringify({version:JOSHUA_TRIAL.version,elapsedMs:next.elapsedMs}));
      } catch { /* A best remains visible during this session. */ }
    }
  },[setTrial,setPersonalBest]);
  const onBigAir=useCallback((next:BigAirState)=>{
    setBigAir(next);
    if(next.phase==="armed")lastSpokenFlightMarker.current=0;
    if(next.phase==="flying"){
      const milestone=Math.floor(next.distance/10)*10;
      if(milestone>=10&&milestone>lastSpokenFlightMarker.current){
        lastSpokenFlightMarker.current=milestone;
        if(birdVoiceRef.current&&"speechSynthesis" in window &&
          "SpeechSynthesisUtterance" in window){
          // Opt-in device speech, not a downloaded voice or automatically
          // playing audio. Discard queued old calls at each distance marker.
          const call=new SpeechSynthesisUtterance(milestone+" meters");
          call.rate=1.1;call.pitch=1.14;call.volume=.48;
          try{
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(call);
          }catch{/* Text labels always remain authoritative. */}
        }
      }
    }
    if(next.phase==="landed"&&
      (!bestFlightRef.current||(next.radialDistance??next.distance)>bestFlightRef.current)){
      bestFlightRef.current=next.radialDistance??next.distance;
      setBestFlight(next.radialDistance??next.distance);
      try{
        window.localStorage.setItem("sid-world:big-air:"+BIG_AIR.version,
          JSON.stringify({version:BIG_AIR.version,distance:next.radialDistance??next.distance}));
      }catch{/* Session results still work when storage is unavailable. */}
    }
  },[setBigAir,setBestFlight]);
  const onLocation = useCallback((r: RegionId, discovery: string | null) => {
    setRegion(r);
    setNearby(discovery);
  }, []);
  const open = useCallback((value: string) => {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPanel(value);
  }, [setPanel]);
  const close = useCallback(() => {
    setPanel(null);
    // Return keyboard users to the action that opened the dialog.
    requestAnimationFrame(() => trigger.current?.focus());
  }, [setPanel]);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 760px), (pointer: coarse)");
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const frame = requestAnimationFrame(() => {
      if (!motion.matches && !small.matches && !connection?.saveData)
        setEnabled(true);
    });
    const change = () => {
      if (motion.matches) {
        setEnabled(false);
        setEntered(false);
        setReady(false);
      }
    };
    motion.addEventListener("change", change);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", change);
    };
  }, []);
  useEffect(() => {
    if (!enabled || ready || failed) return;
    const timeout = window.setTimeout(onError, 15000);
    return () => window.clearTimeout(timeout);
  }, [enabled, ready, failed, onError]);
  useEffect(() => {
    if (panel && !dialog.current?.open) dialog.current?.showModal();
    if (!panel && dialog.current?.open) dialog.current?.close();
    if (panel) dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [panel]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
        return;
      if (event.key.toLowerCase() === "m" && !panel) {
        event.preventDefault();
        open("menu");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, panel]);
  function exploreWorld(){
    setSessionExitSerial(n=>n+1);
    setActivity("run");
    requestAnimationFrame(()=>worldRoot.current?.querySelector("canvas")?.focus({preventScroll:true}));
  }
  function chooseActivity(next: Activity) {
    if(!worldGameSession({jet:jetActive,ski:bigAir.phase,disc:discGolf.phase,
      trial:trial.phase,skim:skim.phase}).canChangeMovement)return;
    setSessionExitSerial(n=>n+1);
    setActivity(next);
    // A selected mode can be activated again without a React state change.
    // Restore movement focus on every activation, including that case.
    requestAnimationFrame(() => worldRoot.current?.querySelector("canvas")?.focus({ preventScroll: true }));
    if (next === "ski" || next === "boulder") {
      setCommand(previous => ({ region: "mountain", serial: (previous?.serial ?? 0) + 1, activity: next }));
    }
  }
  function waterControl(next: "dive" | "deeper" | "shallower" | "surface") {
    setWaterAction(next);
    setWaterActionSerial(n => n + 1);
    requestAnimationFrame(() => worldRoot.current?.querySelector("canvas")?.focus({ preventScroll: true }));
  }
  function enter() {
    setEnabled(true);
    setEntered(true);
    setFailed(false);
  }
  function jump(id: RegionId) {
    setEnabled(true);
    setEntered(true);
    setQuiet(false);
    setFailed(false);
    setCommand((previous) => ({
      region: id,
      serial: (previous?.serial ?? 0) + 1,
    }));
    // A world jump is not a dialog dismissal: do not return focus to the
    // menu trigger. The renderer/canvas becomes the next interaction target.
    trigger.current = null;
    close();
    requestAnimationFrame(() =>
      worldRoot.current?.querySelector("canvas")?.focus({ preventScroll: true }),
    );
  }
  const nearbyGameIndex = nearby?.startsWith("game:") ? Number(nearby.slice(5)) : -1;
  const nearbyGame = Number.isInteger(nearbyGameIndex) ? content.games[nearbyGameIndex] : undefined;
  const discoveryTitle =
    nearby === "paper-archive" ? "Paper Archive" : nearby === "secret"
      ? "Shasta"
      : (nearbyGame?.title ??
        content.videos.find((item) => item.id === nearby)?.title ??
        MEMORY_POINTS.find((m) => m.id === nearby)?.title ??
        REGIONS.find((r) => r.id === nearby)?.name ??
        UNDERWATER_TRIDENTS.find((a) => a.id === nearby)?.title ??
        WILDLIFE_DISCOVERIES.find((a)=>a.id===nearby)?.title);
  const current = REGIONS.find((r) => r.id === region)!;
  const selected = REGIONS.find((r) => r.id === panel);
  const carvedGameIndex = panel?.startsWith("game:") ? Number(panel.slice(5)) : -1;
  const carvedGame = Number.isInteger(carvedGameIndex) ? content.games[carvedGameIndex] : undefined;
  const photo = content.photos.find((p) => p.id === panel ||
    (panel === "sloth-portrait" && p.id === "photo-050"));
  const video = content.videos.find((item) => item.id === panel);
  const caption = MEMORY_POINTS.find((m) => m.id === panel);
  const trident = UNDERWATER_TRIDENTS.find((a) => a.id === panel);
  const session=worldGameSession({jet:jetActive,ski:bigAir.phase,
    disc:discGolf.phase,trial:trial.phase,skim:skim.phase});
  const worldGameActive=!session.canChangeMovement;

  return (
    <div
      ref={worldRoot}
      className={styles.world}
      data-world-session={session.phase}
      data-world-game={session.active??"none"}
      data-world-state={failed ? "fallback" : entered ? "exploring" : "welcome"}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      {enabled && !failed && (
        <SceneBoundary key={failed ? "retry" : "scene"} onError={onError}>
          <WorldScene
            entered={entered}
            paused={!!panel || quiet}
            command={command}
            activity={activity}
            actionSerial={actionSerial}
            challengeSerial={challengeSerial}
            bigAirSerial={bigAirSerial}
            sessionExitSerial={sessionExitSerial}
            discGolfStartSerial={discGolfStartSerial}
            discGolfHoleIndex={discGolfHoleIndex}
            discGolfShotSerial={discGolfShotSerial}
            discGolfShot={discGolfShot}
            discGolfPreview={discPreviewShot}
            discGolfExitSerial={discGolfExitSerial}
            discGolfSwingStage={discGolfStage}
            discGolfSwingAmount={discGolfSwingAmount}
            skimCommandSerial={skimCommandSerial}
            skimCommand={skimCommand}
            skimBoardIndex={skimBoardIndex}
            waterAction={waterAction}
            waterActionSerial={waterActionSerial}
            gameTitles={content.games.map(game => game.title)}
            onAquatic={setAquatic}
            onReady={onReady}
            onError={onError}
            onLocation={onLocation}
            onInteract={open}
            onChallenge={onChallenge}
            onBigAir={onBigAir}
            onDiscGolf={onDiscGolf}
            onJetSkiMode={setJetActive}
            onSkim={onSkim}
            onSkimNearby={setSkimNearby}
          />
        </SceneBoundary>
      )}
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} prefetch={false}>
          SID HULYALKAR<span> Neuroscience & engineering</span>
        </Link>
        <button
          className={styles.menuButton}
          onClick={() => open("menu")}
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
        >
          <span>Menu</span>
          <span aria-hidden="true">☰</span>
        </button>
      </header>
      {!entered || failed ? (
        <section className={styles.welcome} aria-labelledby="world-title">
          <p className={styles.eyebrow}>CALIFORNIA, IN MIND</p>
          <h1 id="world-title">Brains, machines,<br /><em>open trails.</em></h1>
          <p className={styles.introduction}>I’m Sid. Engineer, neuroscience researcher, usually outside.</p>
          <div className={styles.actions}>
            <Link href="/atlas" prefetch={false} className={styles.primary}>
              View site <span aria-hidden="true">↗</span>
            </Link>
            {!failed && (
              <button ref={enterButton} className={styles.exploreButton} onClick={enter}>
                Explore world <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          {failed && (
            <p role="status" className={styles.fallbackText}>
              The 3D world couldn’t open on this device. All of my work is
              available in the menu.
            </p>
          )}

        </section>
      ) : (
        <>
          {!ready && (
            <div className={styles.loading} role="status">
              Loading world…{" "}
              <button onClick={() => open("menu")}>Browse the site</button>
            </div>
          )}
          <div className={styles.location} style={{display:!worldGameActive&&skim.phase==="off"?undefined:"none"}}>
            <span className={styles.eyebrow}>
              {String(REGIONS.indexOf(current) + 1).padStart(2, "0")} / {String(REGIONS.length).padStart(2, "0")}
            </span>
            <p>{current.name}</p>
          </div>
          {nearby && ready && !worldGameActive && skim.phase==="off" && (
            <button className={styles.discovery} onClick={() => open(nearby)}>
              <span>{discoveryTitle}</span>
              <span className={styles.key}>Enter</span>
            </button>
          )}
          {aquatic === "land" && (
            <div className={styles.activityDock} style={{display:worldGameActive||skim.phase!=="off"?"none":undefined}}>
              <div className={styles.activityButtons} role="group" aria-label="Movement activity">
                {ACTIVITIES.map(item => (
                  <button key={item.id} aria-label={item.name} aria-pressed={activity === item.id}
                    disabled={bigAir.phase==="armed"||bigAir.phase==="flying"||
                      trial.phase==="armed"||trial.phase==="running"}
                    onClick={() => chooseActivity(item.id)}>{item.label}</button>
                ))}
                <button className={styles.actionButton} disabled={!ready || quiet} onClick={() => setActionSerial(n => n + 1)}>
                  {activityConfig(activity).action}
                </button>
              </div>
              <p aria-live="polite">{activityConfig(activity).hint}</p>
              <button className={styles.trialLaunch} disabled={!ready||quiet||
                bigAir.phase==="armed"||bigAir.phase==="flying"||
                trial.phase==="armed"||trial.phase==="running"}
                onClick={()=>{
                    const next=nextUnplayedDiscGolfHole(discGolfRound);
                    startDiscHole(next??0);
                    if(next===null)setDiscGolfScorecardOpen(true);
                  }}>Disc golf · {discGolfRoundSummary(discGolfRound).complete?"scorecard":
                   discGolfRoundSummary(discGolfRound).holesPlayed>0?"resume":"play"}</button>
              {activity==="skate" && !worldGameActive && (
                <button className={styles.trialLaunch} disabled={!ready||quiet}
                  onClick={()=>{
                    setCommand(previous=>({region:"grove",
                      serial:(previous?.serial??0)+1,activity:"skate"}));
                    requestAnimationFrame(()=>worldRoot.current?.querySelector("canvas")?.focus({preventScroll:true}));
                  }}>
                  Skatepark · south meadow
                </button>
              )}
              {activity==="skate" && !worldGameActive && (
                <button className={styles.trialLaunch} disabled={!ready||quiet}
                  onClick={()=>{
                    setCommand(previous=>({region:"canyon",
                      serial:(previous?.serial??0)+1,activity:"skate",
                      skateDestination:"canyon-flow"}));
                    requestAnimationFrame(()=>worldRoot.current?.querySelector("canvas")?.focus({preventScroll:true}));
                  }}>
                  Meadow trail · rails & bridge
                </button>
              )}
              {activity==="skate" && !worldGameActive && (
                <button className={styles.trialLaunch} disabled={!ready||quiet}
                  onClick={()=>{
                    setCommand(previous=>({region:"grove",
                      serial:(previous?.serial??0)+1,activity:"skate",
                      skateDestination:"loop-rollin"}));
                    requestAnimationFrame(()=>worldRoot.current?.querySelector("canvas")?.focus({preventScroll:true}));
                  }}>Loop · downhill roll-in</button>
              )}
              {activity==="ski" && bigAir.phase!=="armed" && bigAir.phase!=="flying" &&
                trial.phase!=="armed"&&trial.phase!=="running" && (
                <button className={styles.trialLaunch} disabled={!ready||quiet}
                  onClick={()=>setBigAirSerial(n=>n+1)}>
                  Mountain ski jump · summit start
                </button>
              )}
              {activity==="bike" && bigAir.phase!=="armed"&&bigAir.phase!=="flying"&&
                trial.phase!=="armed" &&
                trial.phase!=="running" && (
                <button className={styles.trialLaunch} disabled={!ready||quiet}
                  onClick={()=>setChallengeSerial(n=>n+1)}>
                  Joshua circuit · race Lucas & Ness
                </button>
              )}
            </div>
          )}
          {skim.phase==="off" && skimNearby!==null && aquatic==="land" &&
            discGolf.phase==="off" && bigAir.phase!=="armed" && bigAir.phase!=="flying" &&
            trial.phase!=="armed" && trial.phase!=="running" && (
             <button className={styles.skimPickup} onClick={()=>issueSkim("pickup",skimNearby)}>
               Pick up {SKIM_BOARDS[skimNearby].label.toLowerCase()} skimboard · Enter
             </button>
           )}
           {skim.phase!=="off" && (
             <aside className={styles.skimHud} aria-label="North shore skimboarding heat" aria-live="polite">
               <div className={styles.skimHeader}><span>NORTH SHORE · SKIM HEAT</span><button onClick={()=>issueSkim("exit")}>Exit</button></div>
               {skim.trickCalloutTime>0&&skim.trickCallout&&(
                 <div className={styles.skimTrickCallout} role="status">{skim.trickCallout}</div>
               )}
               <div className={styles.skimReadout}><strong>{skim.score.toLocaleString()} <small>PTS</small></strong><strong>{skim.remaining.toFixed(0)} <small>SEC</small></strong></div>
               <div className={styles.skimMeter}><span style={{width:`${100*skim.remaining/90}%`}} /></div>
               <p>{skim.phase==="ready"?"Sprint toward the wet sand, then drop your board.":skim.phase==="riding"?
                 `Ride ${skim.rides+1} · ${Math.round(skim.ridePoints)} pending · ${skim.air>.1?"Airborne — Q / E / F":skim.waveRideSeconds>.2?"Riding the face":skim.lastTrick||"Build speed toward a breaking crest"}`:
                 skim.phase==="recovering"?skim.lastTrick: `Heat complete · ${skim.rides} rides`}</p>
               {skimBest!==null&&<small>Personal best {skimBest.toLocaleString()}</small>}
               <div className={styles.skimActions}>
                 {skim.phase==="ready"&&<button onClick={()=>issueSkim("drop")}>Drop board · Space</button>}
                 {skim.phase==="riding"&&<>
                   <button onClick={()=>issueSkim("pop")}>Pop · Space</button>
                   <button onClick={()=>issueSkim("shuvit")}>Shuv-it · Q</button>
                   <button onClick={()=>issueSkim("big-spin")}>Big spin · E</button>
                   <button onClick={()=>issueSkim("three-sixty")}>360 · F</button>
                   <button onClick={()=>issueSkim("wrap")}>Wrap · R</button>
                 </>}
                 {skim.phase==="finished"&&<button onClick={()=>issueSkim("restart")}>New heat</button>}
               </div>
               <small>{skim.phase==="riding"?"A/D carve · R wrap a wave · Hit a crest fast for air · Q/E/F tricks":
                 "WASD move · Shift sprint · Run, drop and ride incoming waves"}</small>
             </aside>
           )}
           {discGolf.phase!=="off" && (
            <WorldDiscGolfHUD
              key={discGolfStartSerial+"-"+discGolf.holeIndex}
              game={discGolf}
              round={discGolfRound}
              scorecardOpen={discGolfScorecardOpen}
              onToggleScorecard={()=>setDiscGolfScorecardOpen(v=>!v)}
              onNewRound={restartDiscRound}
              onShot={takeDiscShot}
              onChangeHole={startDiscHole}
              onExit={exitDiscGolf}
              onStage={setDiscGolfStage}
              onPreview={onDiscPreview}
              onSwing={onDiscSwing}
            />
          )}
          {skim.phase==="off" && (trial.phase==="armed"||trial.phase==="running"||
              trial.phase==="complete"||trial.phase==="invalidated") && (
            <aside className={styles.trialHud} aria-label="Joshua dirt-bike ghost race"
              aria-live={trial.phase==="complete"||trial.phase==="invalidated"?"polite":"off"}>
              <span className={styles.eyebrow}>JOSHUA · GHOST RACE</span>
              <strong>{(trial.elapsedMs/1000).toFixed(1)} s</strong>
              <small>Position {trial.ghostPlace??1}/3 · vs {JOSHUA_GHOSTS.map(ghost=>ghost.name).join(" + ")}</small>
              <p>{trial.phase==="armed"?"Cross the starting line":
                trial.phase==="running" ?
                  `Gate ${Math.min(trial.nextGate,JOSHUA_GATES.length)} / ${JOSHUA_GATES.length}`:
                trial.phase==="complete"?"Lap complete":
                trial.reason??"Run interrupted"}</p>
              {personalBest!==null && (
                <small>Personal best {(personalBest/1000).toFixed(1)} s</small>
              )}
              {(trial.phase==="armed"||trial.phase==="running")&&<button onClick={exploreWorld}>Exit race</button>}
              {(trial.phase==="complete"||trial.phase==="invalidated") && (
                <div className={styles.trialActions}>
                  <button onClick={()=>{
                    setActivity("bike");setChallengeSerial(n=>n+1);
                  }}>Retry</button>
                  <button onClick={exploreWorld}>Explore</button>
                </div>
              )}
            </aside>
          )}
          {skim.phase==="off" && (bigAir.phase==="armed"||bigAir.phase==="flying"||
            bigAir.phase==="landed"||bigAir.phase==="missed") && (
            <aside className={styles.bigAirHud} aria-label="Alpine Big Air flight"
              aria-live={bigAir.phase==="landed"||bigAir.phase==="missed"?"polite":"off"}>
              <span className={styles.eyebrow}>MOUNTAIN · FREE JUMP</span>
              <strong>{(bigAir.radialDistance??0).toFixed(1)} m from center</strong>
              <p>{bigAir.phase==="armed"?"Build speed and jump from any mountain slope":
                bigAir.phase==="flying"?
                  (bigAirBirdCallout(bigAir.distance)??"Macaws joining your flight"):
                bigAir.phase==="landed"?"Clean landing":
                  bigAir.reason??"Flight ended"}</p>
              {bigAir.phase==="flying"&&(
                <small>Flight {bigAir.distance.toFixed(1)} m · {mountainJumpOutwardGain(bigAir)>=0?"+":""}{mountainJumpOutwardGain(bigAir).toFixed(1)} m outward · {bigAir.airtime.toFixed(1)} s airborne</small>
              )}
              {(bigAir.phase==="landed"||bigAir.phase==="missed")&&(
                <small>Traveled {bigAir.distance.toFixed(1)} m · {mountainJumpOutwardGain(bigAir)>=0?"+":""}{mountainJumpOutwardGain(bigAir).toFixed(1)} m outward · Peak clearance {(bigAir.maxClearance??0).toFixed(1)} m</small>
              )}
              {bestFlight!==null&&(
                <small>Furthest from mountain center {bestFlight.toFixed(1)} m</small>
              )}
              {(bigAir.phase==="armed"||bigAir.phase==="flying")&&<button onClick={exploreWorld}>Exit jump</button>}
              {(bigAir.phase==="armed"||bigAir.phase==="flying")&&(
                <button className={styles.birdVoiceToggle} aria-pressed={birdVoice}
                  onClick={toggleBirdVoice}>
                  Bird distance voice · {birdVoice?"On":"Off"}
                </button>
              )}
              {(bigAir.phase==="landed"||bigAir.phase==="missed")&&(
                <div className={styles.trialActions}>
                  <button onClick={()=>{
                    setActivity("ski");setBigAirSerial(n=>n+1);
                  }}>Retry jump</button>
                  <button onClick={exploreWorld}>Explore</button>
                </div>
              )}
            </aside>
          )}
          {aquatic !== "land" && skim.phase==="off" && (
            <div className={styles.waterDock} role="group" aria-label="Swimming depth controls">
              <span className={styles.waterMode}>{aquatic === "surface" ? "Snorkeling" : "Diving"}</span>
              {aquatic === "surface" ? (
                <button onClick={() => waterControl("dive")}>Dive</button>
              ) : (
                <>
                  <button onClick={() => waterControl("deeper")}>Deeper</button>
                  <button onClick={() => waterControl("shallower")}>Shallower</button>
                  <button className={styles.surfaceButton} onClick={() => waterControl("surface")}>Surface</button>
                </>
              )}
            </div>
          )}
          <p className={styles.controls} style={{display:!worldGameActive&&skim.phase==="off"?undefined:"none"}}>
            {aquatic === "land" ? (
              <>WASD / arrows to move <span>·</span> Drag to look <span>·</span>{" "}
                Space to {activityConfig(activity).action.toLowerCase()} <span>·</span> M for menu</>
            ) : aquatic === "surface" ? (
              <>WASD / arrows to swim <span>·</span> Drag to look <span>·</span> V to dive <span>·</span> M for menu</>
            ) : (
              <>WASD / arrows to swim <span>·</span> Q / E for depth <span>·</span> V to surface <span>·</span> M for menu</>
            )}
          </p>
          <div className={styles.touchHelp} style={{display:!worldGameActive&&skim.phase==="off"?undefined:"none"}}>
            {aquatic === "land" ? "Tap ground to move · Drag to look" : "Tap water to swim · Drag to look"}
          </div>
        </>
      )}
      {!entered && (
        <footer className={styles.homeFooter}>
          <span>Sid Hulyalkar · Portfolio</span>
          <Link href="/about" prefetch={false}>
            Get to know me
          </Link>
        </footer>
      )}
      <dialog
        ref={dialog}
        className={`${styles.dialog} ${photo ? styles.photoDialog : ""}`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        aria-labelledby="world-panel-title"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button, a[href]",
            ),
          ).filter((el) => el.offsetParent !== null);
          const first = items[0],
            last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className={styles.dialogBody}>
          <button
            className={styles.close}
            onClick={close}
            aria-label="Close panel"
          >
            ×
          </button>
          {panel === "menu" && (
            <>
              <p className={styles.eyebrow}>NAVIGATION</p>
              <h2 id="world-panel-title">Where to?</h2>
              <div className={styles.menuColumns}>
                <section>
                  <h3>Explore the world</h3>
                  <div className={styles.destinations}>
                    {REGIONS.map((r, i) => (
                      <button key={r.id} onClick={() => jump(r.id)}>
                        <span className={styles.destinationNumber}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>
                          {r.name}
                          <small>{r.meaning}</small>
                        </span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </section>
                <nav aria-label="Portfolio">
                  <h3>Browse the site</h3>
                  <div className={styles.siteLinks}>
                    {LINKS.map(([label, href]) => (
                      <Link prefetch={false} key={href} href={href}>
                        {label}
                      </Link>
                    ))}
                  </div>
                </nav>
              </div>
              <div className={styles.menuFooter}>
                <button onClick={() => setPanel("field-notes")}>Field notes</button>
                <a href="https://github.com/sidhulyalkar">GitHub</a>
                <Link href="/atlas" prefetch={false}>
                  View site · Fractal menu
                </Link>
                {enabled && (
                  <button
                    onClick={() => {
                      setQuiet(!quiet);
                      close();
                    }}
                  >
                    {quiet ? "Resume world" : "Pause world"}
                  </button>
                )}
              </div>
              <p className={styles.menuHint}>
                Move with WASD, arrows, or a tap. Drag to look. Space uses the equipped land action; V dives or surfaces in the ocean. Ski and Boulder take you to their terrain. Escape closes panels.
              </p>
            </>
          )}
          {panel === "field-notes" && (
            <>
              <p className={styles.eyebrow}>CALIFORNIA COAST</p>
              <h2 id="world-panel-title">Field notes</h2>
              <p className={styles.panelIntro}>California kelp coast · South Pacific lagoon · alpine ridge.</p>
              <div className={styles.projectList}>
                {COASTAL_FLORA.map(plant => <a key={plant.scientific} href={plant.source} target="_blank" rel="noreferrer">
                  <h3>{plant.common}</h3><p><i>{plant.scientific}</i> · {plant.habitat}</p><span>National Park Service ↗</span>
                </a>)}
                {MARINE_LIFE.map(animal => <a key={animal.common} href={animal.source} target="_blank" rel="noreferrer">
                  <h3>{animal.common}</h3><p>{animal.note}</p><span>Monterey Bay Aquarium ↗</span>
                </a>)}
              </div>
            </>
          )}
          {carvedGame && (
            <>
              <p className={styles.eyebrow}>ARCADE CAVERN · CARVED GAME</p>
              <h2 id="world-panel-title">{carvedGame.title}</h2>
              <p className={styles.panelIntro}>{carvedGame.subtitle}</p>
              <div className={styles.panelLinks}>
                <Link href={carvedGame.href} prefetch={false}>
                  Play {carvedGame.title}
                </Link>
                <button onClick={() => setPanel("cavern")}>All games</button>
              </div>
            </>
          )}
          {selected && (
            <>
              <p className={styles.eyebrow}>{selected.name}</p>
              <h2 id="world-panel-title">{INTRO[selected.id].title}</h2>
              {INTRO[selected.id].text && <p className={styles.panelIntro}>{INTRO[selected.id].text}</p>}
              {selected.id === "cavern" && <div className={styles.projectList}>
                {content.games.map((game, index) => <Link key={game.href} href={game.href} prefetch={false}>
                  {index === 0 && <span>FEATURED GAME</span>}
                  <h3>{game.title}</h3><p>{game.subtitle}</p><span>Play game ↗</span>
                </Link>)}
              </div>}
              <div className={styles.projectList}>
                {content.projects
                  .filter((p) => p.region === selected.id)
                  .map((p) => (
                    <Link prefetch={false} href={p.href} key={p.href}>
                      <h3>{p.title}</h3>
                      <p>{p.summary}</p>
                      <span>View project ↗</span>
                    </Link>
                  ))}
              </div>
              {(selected.id === "coast" || REGION_PHOTOS[selected.id]) && (
                <div className={styles.memoryList}>
                  {content.photos.filter((p) => selected.id === "coast" || REGION_PHOTOS[selected.id]?.includes(p.id)).map((p) => {
                    const memory = MEMORY_POINTS.find((m) => m.id === p.id);
                    return (
                      <button
                        key={p.id}
                        aria-label={memory?.title ?? p.alt}
                        onClick={() => setPanel(p.id)}
                      >
                        <Image
                          src={p.src}
                          alt={p.alt}
                          width={240}
                          height={150}
                          sizes="(max-width: 600px) 80vw, 240px"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
              <div className={styles.panelLinks}>
                <Link href={selected.href} prefetch={false}>
                  {ROUTE_LABELS[selected.href]}
                </Link>
                {selected.id === "neural" && (
                  <Link prefetch={false} href="/frontier">
                    Frontier
                  </Link>
                )}
                {selected.id === "grove" && (
                  <Link prefetch={false} href="/resume">
                    Resume
                  </Link>
                )}
              </div>
            </>
          )}
          {video && (
            <>
              <h2 id="world-panel-title">{video.title}</h2>
              <video
                className={styles.memoryVideo}
                src={video.src}
                poster={video.posterSrc}
                controls
                playsInline
                preload="metadata"
              />
              <p className={styles.photoCaption}>{video.detail}</p>
              <button onClick={close}>Back to reef</button>
            </>
          )}
          {photo && (
            <>
              <h2 id="world-panel-title">{caption?.title ?? "Sloth · rainforest"}</h2>
              <Image
                className={styles.memoryPhoto}
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes="(max-width: 900px) 92vw, 1000px"
              />
              <p className={styles.photoCaption}>{caption?.detail ?? photo.alt}</p>
              <Link prefetch={false} href="/photography">
                Photography
              </Link>
            </>
          )}

          {panel === "sloth-portrait" && !photo && (
            <>
              <h2 id="world-panel-title">A sloth in the canopy.</h2>
              <p className={styles.panelIntro}>
                Inspired by a real sloth photograph: a pale face with a dark
                eye mask, long gray-beige fur, and one extended forelimb
                wrapped around a rainforest trunk.
              </p>
              <Link href="/photography" prefetch={false}>My photography</Link>
              <button onClick={close}>Return to the forest</button>
            </>
          )}
          {trident && (
            <>
              <h2 id="world-panel-title">{trident.title}.</h2>
              <p className={styles.panelIntro}>
                A carved navy-and-gold trident inspired by UC San Diego,
                celebrating Bioengineering and scientific exploration.
                This sculpture is not an official university emblem.
              </p>
              <div className={styles.panelLinks}>
                <Link href={trident.href} prefetch={false}>Explore this connection</Link>
                <button onClick={close}>Continue diving</button>
              </div>
            </>
          )}
          {panel === "paper-archive" && <><h2 id="world-panel-title">Paper Archive.</h2><div className={styles.projectList}>{content.publications.map(p=><Link key={p.id} href={p.href} prefetch={false}><h3>{p.title}</h3>{p.year && <span>{p.year}</span>}</Link>)}</div><Link prefetch={false} href="/publications">Explore publications</Link></>}
          {panel === "secret" && (
            <>
              <h2 id="world-panel-title">Shasta.</h2>
              <p className={styles.panelIntro}>Sunset overlook.</p>
              <Image
                className={styles.secretPhoto}
                src="/visual-archive/web/photo-042.webp"
                alt="White dog sitting at a sunset overlook above dark hills and coastline."
                width={1800}
                height={1350}
                sizes="(max-width: 600px) 85vw, 400px"
              />
              <Link prefetch={false} href="/photography">
                Photography
              </Link>
            </>
          )}
        </div>
      </dialog>
      <noscript>
        <nav className={styles.noScript} aria-label="Browse without JavaScript">
          <p>
            Sidharth Hulyalkar · neuroscience, engineering, and the outdoors.
          </p>
          {LINKS.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </noscript>
    </div>
  );
}
