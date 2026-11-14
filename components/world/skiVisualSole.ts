import {BufferAttribute,BufferGeometry,DynamicDrawUsage,Vector3} from "three/src/Three.Core.js";
import {SKI_HALF_LENGTH,SKI_HALF_WIDTH,SKI_SOLE_Y,type SkiContact} from "../worldSkiContact";

// Presentation-only deformation: the collision solver and ski bindings remain
// authoritative. The limit is deliberately conservative, not a fitted ski
// stiffness model. Overhanging tips must not be stretched into nearby terrain.
export const SKI_VISUAL_BEND_LIMIT=.18;
const SECTIONS=32,STRIDE=4,CLEARANCE=.008,THICKNESS=.065;
export type SkiVisualSoleMetrics={
  active:boolean;min:number;max:number;rigidMax:number;maxBend:number;
};
const blank=():SkiVisualSoleMetrics=>({active:false,min:0,max:0,rigidMax:0,maxBend:0});

export class SkiVisualSole {
  readonly geometry:BufferGeometry;
  readonly metrics:SkiVisualSoleMetrics=blank();
  private readonly sample=new Vector3();
  private readonly raw=new Float32Array(SECTIONS+1);
  private readonly bend=new Float32Array(SECTIONS+1);

  constructor(){
    const geometry=new BufferGeometry();
    const positions=new BufferAttribute(new Float32Array((SECTIONS+1)*STRIDE*3),3);
    positions.setUsage(DynamicDrawUsage);
    geometry.setAttribute("position",positions);
    const indices:number[]=[];
    for(let j=0;j<SECTIONS;j++){
      for(const [a,b] of [[0,1],[2,3],[0,2],[1,3]]){
        const lo=j*STRIDE,hi=(j+1)*STRIDE;
        indices.push(lo+a,hi+a,lo+b,hi+a,hi+b,lo+b);
      }
    }
    const last=SECTIONS*STRIDE;
    indices.push(0,1,2,1,3,2,last,last+2,last+1,last+1,last+2,last+3);
    geometry.setIndex(indices);
    this.geometry=geometry;
  }

  private gap(pose:SkiContact,x:number,z:number,bend:number,
    height:(x:number,z:number)=>number){
    this.sample.set(x,SKI_SOLE_Y-bend,z).applyQuaternion(pose.rotation).add(pose.position);
    return this.sample.y-height(this.sample.x,this.sample.z);
  }

  update(pose:SkiContact,height:(x:number,z:number)=>number,load:number,
    supported:boolean):SkiVisualSoleMetrics{
    const attribute=this.geometry.getAttribute("position") as BufferAttribute;
    const active=supported&&Number.isFinite(load)&&load>.05;
    let rigidMax=-Infinity;
    // The support interval is measured from the actual rendered triangles.
    // Allow small elastic response near loaded snow, but not a fictitious
    // extension of the tail across a lip that no longer supports the skier.
    for(let j=0;j<=SECTIONS;j++){
      const along=(j/SECTIONS*2-1)*SKI_HALF_LENGTH;
      const gap=Math.min(this.gap(pose,-SKI_HALF_WIDTH,along,0,height),
        this.gap(pose,SKI_HALF_WIDTH,along,0,height));
      rigidMax=Math.max(rigidMax,gap);
      const outside=Math.max(0,pose.supportStart-along,along-pose.supportEnd);
      const supportWeight=Math.max(0,1-outside/.55);
      const bindingWeight=Math.min(1,Math.abs(along)/.25);
      const requested=active?
        SKI_VISUAL_BEND_LIMIT*Math.sqrt(Math.min(1,load))*supportWeight*bindingWeight:0;
      // A short bisection resolves the world-space movement along the bank
      // normal. Never push a vertex beneath the actual terrain height.
      let low=0,high=requested;
      for(let k=0;k<7;k++){
        const mid=(low+high)*.5;
        const left=this.gap(pose,-SKI_HALF_WIDTH,along,mid,height);
        const right=this.gap(pose,SKI_HALF_WIDTH,along,mid,height);
        if(Math.min(left,right)>=CLEARANCE)low=mid;else high=mid;
      }
      this.raw[j]=low;
    }
    let min=Infinity,max=-Infinity,maxBend=0;
    for(let j=0;j<=SECTIONS;j++){
      // Convex smoothing can only reduce an already safe downward bend.
      // It avoids a sawtooth across the longitudinal strip.
      const bend=Math.min(this.raw[j],
        ((this.raw[Math.max(0,j-1)]+2*this.raw[j]+
          this.raw[Math.min(SECTIONS,j+1)])/4));
      this.bend[j]=bend;
      maxBend=Math.max(maxBend,bend);
      const along=(j/SECTIONS*2-1)*SKI_HALF_LENGTH;
      const tip=Math.max(0,(along/SKI_HALF_LENGTH-.82)/.18);
      const tipLift=.10*tip*tip;
      for(let w=0;w<2;w++){
        const x=(2*w-1)*SKI_HALF_WIDTH;
        for(let face=0;face<2;face++){
          const y=SKI_SOLE_Y-bend+tipLift+face*THICKNESS;
          attribute.setXYZ(j*STRIDE+face*2+w,x,y,along);
        }
        const gap=this.gap(pose,x,along,bend-tipLift,height);
        min=Math.min(min,gap);max=Math.max(max,gap);
      }
    }
    attribute.needsUpdate=true;
    this.geometry.computeVertexNormals();
    Object.assign(this.metrics,{active,min,max,rigidMax,maxBend});
    return this.metrics;
  }

  dispose(){this.geometry.dispose();}
}
