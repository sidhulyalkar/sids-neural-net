import {Vector3} from "three";
import {bank,bankOffset,createTrial,inside,trialInput} from "./fiveCarve";
import {tuning,type SkiInput,type SkiSimulation} from "@/lib/world/ski/simulation";
import {MOUNTAIN_HALFPIPE as pipe} from "@/lib/world/mountainHalfpipe";

/** Diagnostic controller only. It cannot alter the skier's state or the mountain. */
export class EarlyEdgeController {
 readonly leadDistance:number;
 requestedBank=1;
 steeringBank=1;
 visits=0;
 private issued=false;
 readonly reversals:{tick:number;x:number;z:number;distanceToBank:number;early:boolean}[]=[];
 readonly bankVisits:{tick:number;bank:number;x:number;z:number;speed:number}[]=[];
 constructor(leadDistance=0){
  if(!Number.isFinite(leadDistance)||leadDistance<0||leadDistance>=bankOffset)
   throw Error("leadDistance must be finite and between zero and the existing bank threshold");
  this.leadDistance=leadDistance;
 }
 input(sim:SkiSimulation):SkiInput{
  if(this.leadDistance>0&&!this.issued&&sim.phase==="riding"&&inside(sim.position.x,sim.position.z)){
   const progress=this.requestedBank*(sim.position.x-pipe.centerX);
   // Act before touching the target bank, but only when moving outward.
   // This compares input timing alone; neither target position nor physics changes.
   if(progress>=bankOffset-this.leadDistance&&
      progress<bankOffset&&this.requestedBank*sim.velocity.x>0){
    this.issued=true;
    this.steeringBank=-this.requestedBank;
    this.reversals.push({tick:sim.tick,x:sim.position.x,z:sim.position.z,
     distanceToBank:bankOffset-progress,early:true});
   }
  }
  return trialInput(sim,this.steeringBank);
 }
 observe(sim:SkiSimulation){
  const b=bank(sim.position.x,sim.position.z,
   sim.phase==="riding"&&sim.contact.some(Boolean));
  if(b!==this.requestedBank)return;
  this.visits++;
  this.bankVisits.push({tick:sim.tick,bank:b,x:sim.position.x,z:sim.position.z,
   speed:sim.velocity.length()});
  if(!this.issued){
   const progress=b*(sim.position.x-pipe.centerX);
   this.reversals.push({tick:sim.tick,x:sim.position.x,z:sim.position.z,
    distanceToBank:bankOffset-progress,early:false});
  }
  this.requestedBank=-b;
  this.steeringBank=this.requestedBank;
  this.issued=false;
 }
}

export type EarlyEdgeFrame={
 tick:number; t:number; x:number; y:number; z:number;
 vx:number; vy:number; vz:number; speed:number; heading:number;
 signedSlip:number; edge:number; grip:number; steer:number;
 requestedBank:number; steeringBank:number; visits:number; phase:string;
 leftContact:boolean; rightContact:boolean;
};
export type EarlyEdgeResult={
 leadDistance:number; tuningVersion:number;
 visited:number; traversals:number; ticks:number; seconds:number;
 exit:"five-traversals"|"footprint"|"time-limit";
 reversals:EarlyEdgeController["reversals"];
 bankVisits:EarlyEdgeController["bankVisits"];
 maxStep:number; initial:{x:number;z:number;vx:number;vz:number};
 inputs:SkiInput[]; frames:EarlyEdgeFrame[];
};

/** Per-physics-tick experiment; render FPS cannot change the generated inputs. */
export function runEarlyEdge(leadDistance:number,maxTicks=3600):EarlyEdgeResult{
 const sim=createTrial();
 const controller=new EarlyEdgeController(leadDistance);
 const inputs:SkiInput[]=[];
 const frames:EarlyEdgeFrame[]=[];
 const forward=new Vector3();
 const right=new Vector3();
 const initial={x:sim.position.x,z:sim.position.z,vx:sim.velocity.x,vz:sim.velocity.z};
 let maxStep=0;
 let exit:EarlyEdgeResult["exit"]="time-limit";
 for(let i=0;i<maxTicks;i++){
  const x=sim.position.x,y=sim.position.y,z=sim.position.z;
  const input=controller.input(sim);
  inputs.push({...input});
  sim.advance(tuning.dt,()=>input);
  maxStep=Math.max(maxStep,Math.hypot(sim.position.x-x,sim.position.y-y,sim.position.z-z));
  controller.observe(sim);
  forward.set(0,0,1).applyQuaternion(sim.rotation);
  right.set(1,0,0).applyQuaternion(sim.rotation);
  frames.push({tick:sim.tick,t:sim.tick*tuning.dt,x:sim.position.x,
   y:sim.position.y,z:sim.position.z,vx:sim.velocity.x,vy:sim.velocity.y,
   vz:sim.velocity.z,speed:sim.velocity.length(),
   heading:Math.atan2(forward.x,forward.z),signedSlip:sim.velocity.dot(right),
   edge:sim.edge,grip:sim.grip,steer:input.steer,
   requestedBank:controller.requestedBank,steeringBank:controller.steeringBank,
   visits:controller.visits,phase:sim.phase,
   leftContact:sim.contact[0],rightContact:sim.contact[1]});
  if(controller.visits>=6){exit="five-traversals";break;}
  if(!inside(sim.position.x,sim.position.z)){exit="footprint";break;}
 }
 return {leadDistance,tuningVersion:tuning.version,visited:controller.visits,
  traversals:Math.max(0,controller.visits-1),ticks:sim.tick,
  seconds:sim.tick*tuning.dt,exit,reversals:controller.reversals,
  bankVisits:controller.bankVisits,maxStep,initial,inputs,frames};
}

export const EARLY_EDGE_LEADS=[0,.5,1,1.5,2,2.5,3] as const;
export function sweepEarlyEdge(){
 return EARLY_EDGE_LEADS.map(distance=>runEarlyEdge(distance));
}
