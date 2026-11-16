/** Deterministic photo upload policy independent of Three.js and the DOM.
 * A focused photograph always gets first residency, including when it is
 * farther away than two nearer wall frames in the same chamber.
 */
export type StreamingGallerySlot={id:string;x:number;z:number};
export type StreamingPoint={x:number;z:number};
export function galleryHighResPriority(
 slots:readonly StreamingGallerySlot[],point:StreamingPoint,limit:number,
 focusId:string|null=null,
):number[]{
 const cap=Number.isFinite(limit)?Math.max(0,Math.min(slots.length,Math.floor(limit))):0;
 if(cap===0)return [];
 const focus=focusId===null?-1:slots.findIndex(s=>s.id===focusId);
 const near=slots.map((s,i)=>({i,d:Math.hypot(s.x-point.x,s.z-point.z)}))
   .filter(e=>e.d<14||e.i===focus)
   .sort((a,b)=>a.d-b.d||a.i-b.i)
   .map(e=>e.i);
 if(focus>=0){
  return [focus,...near.filter(i=>i!==focus)].slice(0,cap);
 }
 return near.slice(0,cap);
}
/** Desktop's 7x7 photo atlas is 2688²; mobile only needs 1792².
 * This saves ~56% of atlas VRAM without lowering native focused photos.
 */
export function galleryAtlasTileSize(smallScreen:boolean):number{
 return smallScreen?256:384;
}
export function galleryAtlasGpuBytes(tile:number,columns=7):number{
 const edge=tile*columns;
 // RGBA8 and a full mip chain (upper bound includes the 1/3 pyramid).
 return Math.ceil(edge*edge*4*4/3);
}

/**
 * Fill only available decoder slots. Keeping this separate from the GPU
 * residency limit prevents fast camera movement from launching dozens of
 * simultaneous high-resolution image.decode() operations on mobile.
 * Selection is already ordered with the inspected photograph first.
 */
export function galleryDecodeQueue(
 desired:readonly number[],
 resident:ReadonlySet<number>,
 inflight:ReadonlySet<number>,
 maxInflight:number,
):number[]{
 const slots=Number.isFinite(maxInflight)
   ?Math.max(0,Math.floor(maxInflight)-inflight.size):0;
 if(slots===0)return [];
 const seen=new Set<number>();
 const requests:number[]=[];
 for(const i of desired){
  if(!Number.isInteger(i)||i<0||resident.has(i)||inflight.has(i)||seen.has(i))
   continue;
  seen.add(i);requests.push(i);
  if(requests.length>=slots)break;
 }
 return requests;
}
