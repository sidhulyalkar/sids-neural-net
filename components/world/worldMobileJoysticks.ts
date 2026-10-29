import {sampleMobileJoystick,type JoystickVector} from "@/lib/world/mobileJoystick";
import styles from "./world.module.css";
type Axis="movement"|"look";
const ZERO:JoystickVector={x:0,y:0};
export type MobileJoysticks={
  readonly enabled:boolean;
  movement:JoystickVector;
  look:JoystickVector;
  setVisible:(visible:boolean)=>void;
  clear:()=>void;
  dispose:()=>void;
};
/** Independent pointer captures allow simultaneous move/look without React renders. */
export function createMobileJoysticks(host:HTMLElement):MobileJoysticks {
  const enabled=window.matchMedia("(pointer: coarse)").matches;
  if(!enabled)return {enabled:false,movement:ZERO,look:ZERO,
    setVisible:()=>{},clear:()=>{},dispose:()=>{}};
  const root=document.createElement("div");
  root.className=styles.mobileJoysticks;
  root.hidden=true;
  root.setAttribute("role","group");
  root.setAttribute("aria-label","Movement and camera touch controls");
  host.appendChild(root);
  let visible=false;
  const buttons:Array<{reset:()=>void}>=[];
  const controls:MobileJoysticks={
    enabled:true,movement:ZERO,look:ZERO,
    setVisible(value){
      if(visible===value)return;
      visible=value;root.hidden=!value;
      if(!value)controls.clear();
    },
    clear(){buttons.forEach(b=>b.reset());controls.movement=ZERO;controls.look=ZERO;},
    dispose(){window.removeEventListener("blur",controls.clear);controls.clear();root.remove();},
  };
  function makeStick(axis:Axis,name:string,hint:string){
    const button=document.createElement("button");
    button.type="button";
    button.className=styles.mobileJoystick;
    button.dataset.axis=axis;button.dataset.label=name;
    button.setAttribute("aria-label",hint);
    button.setAttribute("title",hint);
    const thumb=document.createElement("span");
    thumb.className=styles.mobileJoystickThumb;
    thumb.setAttribute("aria-hidden","true");
    button.appendChild(thumb);root.appendChild(button);
    let pointerId:number|null=null;
    const center=()=>{
      controls[axis]=ZERO;thumb.style.transform="translate(-50%, -50%)";
    };
    const update=(x:number,y:number)=>{
      const rect=button.getBoundingClientRect();
      const value=sampleMobileJoystick(x,y,rect.left+rect.width/2,
        rect.top+rect.height/2,Math.min(rect.width,rect.height)/2);
      controls[axis]=value;
      thumb.style.transform="translate(calc(-50% + "+(value.x*rect.width*.25).toFixed(1)+
        "px), calc(-50% - "+(value.y*rect.height*.25).toFixed(1)+"px))";
    };
    const reset=()=>{
      const old=pointerId;pointerId=null;center();
      if(old!==null&&button.hasPointerCapture(old))button.releasePointerCapture(old);
    };
    button.addEventListener("pointerdown",e=>{
      if(!visible||pointerId!==null)return;
      e.preventDefault();e.stopPropagation();
      pointerId=e.pointerId;button.setPointerCapture(e.pointerId);update(e.clientX,e.clientY);
    });
    button.addEventListener("pointermove",e=>{
      if(pointerId!==e.pointerId)return;
      e.preventDefault();update(e.clientX,e.clientY);
    });
    button.addEventListener("pointerup",e=>{if(pointerId===e.pointerId)reset();});
    button.addEventListener("pointercancel",e=>{if(pointerId===e.pointerId)reset();});
    button.addEventListener("lostpointercapture",e=>{if(pointerId===e.pointerId)reset();});
    // Switch/keyboard alternative for the focusable controls.
    button.addEventListener("keydown",e=>{
      const map:Record<string,JoystickVector>={
        ArrowUp:{x:0,y:1},ArrowDown:{x:0,y:-1},
        ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
      };
      const value=map[e.key];if(!value)return;
      e.preventDefault();controls[axis]=value;
      thumb.style.transform="translate(calc(-50% + "+(value.x*24)+
        "px), calc(-50% - "+(value.y*24)+"px))";
    });
    button.addEventListener("keyup",e=>{
      if(e.key.startsWith("Arrow")){e.preventDefault();center();}
    });
    button.addEventListener("blur",reset);
    buttons.push({reset});
  }
  makeStick("movement","MOVE","Movement joystick, drag to move in any direction");
  makeStick("look","LOOK","Camera joystick, drag to turn or tilt your view");
  window.addEventListener("blur",controls.clear);
  return controls;
}
