const G=window.Sylvaria091;
const {W,H,canvas}=G,F=G.fn;

export const PRESENTATION_SPACE_VERSION='0.14.0';
const OVERLAY_IDS=Object.freeze(['kineticCanvas','flowCanvas']);
const finiteScale=()=>{const value=Number(window.SylvariaDisplayScale?.scale||1);return Number.isFinite(value)&&value>0?value:1};

function syncOverlay(overlay){
  if(!overlay)return null;
  if(overlay.width!==canvas.width||overlay.height!==canvas.height){overlay.width=canvas.width;overlay.height=canvas.height}
  const ctx=overlay.getContext('2d'),scale=finiteScale();
  ctx?.setTransform(scale,0,0,scale,0,0);
  overlay.dataset.logicalWidth=String(W);
  overlay.dataset.logicalHeight=String(H);
  overlay.dataset.logicalScale=String(scale);
  return{overlay,ctx,scale};
}
function syncAll(){return OVERLAY_IDS.map(id=>syncOverlay(document.getElementById(id))).filter(Boolean)}
function logicalToClient(x,y,element=document.getElementById('pondCanvas')||canvas){
  const rect=element.getBoundingClientRect();
  return{x:rect.left+x/W*rect.width,y:rect.top+y/H*rect.height};
}
function clientToLogical(x,y,element=document.getElementById('pondCanvas')||canvas){
  const rect=element.getBoundingClientRect();
  return{x:(x-rect.left)/Math.max(1,rect.width)*W,y:(y-rect.top)/Math.max(1,rect.height)*H};
}

const inheritedRender=F.render;
F.render=()=>{syncAll();return inheritedRender?.()};
syncAll();

window.SylvariaPresentationSpace=Object.freeze({
  version:PRESENTATION_SPACE_VERSION,
  syncAll,
  logicalToClient,
  clientToLogical,
  snapshot:()=>({
    version:PRESENTATION_SPACE_VERSION,
    scale:finiteScale(),
    logicalWidth:W,
    logicalHeight:H,
    overlays:OVERLAY_IDS.map(id=>{const overlay=document.getElementById(id),ctx=overlay?.getContext?.('2d'),transform=ctx?.getTransform?.();return{id,exists:Boolean(overlay),width:overlay?.width||0,height:overlay?.height||0,transform:transform?{a:transform.a,d:transform.d,e:transform.e,f:transform.f}:null}}),
  }),
});
