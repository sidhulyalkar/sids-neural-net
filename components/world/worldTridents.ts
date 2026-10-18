import * as THREE from "three/src/Three.Core.js";
import {GeometryBatch} from "./worldGeometry";
import {UNDERWATER_TRIDENTS,tridentBaseY,type UnderwaterTrident} from "@/lib/world/artifacts";
import {SEA_SURFACE} from "@/lib/world/model";

/**
 * Sculpted in-world tridents, inspired by the navy/gold UC San Diego palette,
 * rather than a reproduction of an official athletics logo.
 *
 * Three materials per marine zone, regardless of artifact count:
 *   1. gold perimeter, 2. inset midnight-blue metal, 3. warm inlaid detail.
 * No lights, animated particles, bloom, new colliders, or collection changes.
 */
export const TRIDENT_VISUAL={
 height:3.5,
 halfWidth:.84,
 waterClearance:.68,
 minScale:.25,
} as const;

/** Keep the entire sculpture underwater, including its crown and bevel.
 * The lagoon shelf can be much shallower than the California kelp canyon. */
export function tridentVisualScale(t:UnderwaterTrident){
 const available=SEA_SURFACE-TRIDENT_VISUAL.waterClearance-tridentBaseY(t);
 return Math.max(0,Math.min(1,available/(TRIDENT_VISUAL.height+.06)));
}

function silhouette(){
 // Broad, distinctive three-prong outline with swept arms. Side blades rise
 // almost as high as the central spear, so it reads at gameplay distance.
 const points:[number,number][]=[
  [-.115,.18],[-.115,1.46],[-.37,1.68],[-.66,1.99],
  [-.67,2.47],[-.84,2.42],[-.78,3.02],[-.49,2.67],
  [-.51,2.22],[-.24,1.97],[-.145,2.15],[-.145,2.86],
  [0,3.5],[.145,2.86],[.145,2.15],[.24,1.97],
  [.51,2.22],[.49,2.67],[.78,3.02],[.84,2.42],
  [.67,2.47],[.66,1.99],[.37,1.68],[.115,1.46],
  [.115,.18],
 ];
 const shape=new THREE.Shape();
 shape.moveTo(...points[0]);
 for(const p of points.slice(1))shape.lineTo(...p);
 shape.closePath();
 return shape;
}

function inlayBetween(
 a:[number,number],b:[number,number],r:number,z:number,
):THREE.CylinderGeometry{
 const dy=b[1]-a[1],dx=b[0]-a[0],len=Math.hypot(dx,dy);
 const g=new THREE.CylinderGeometry(r,r,len,6);
 const q=new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0,1,0),new THREE.Vector3(dx/len,dy/len,0));
 g.applyQuaternion(q);
 g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,z);
 return g;
}

export function createWorldTridents(kelpRoot:THREE.Group,lagoonRoot:THREE.Group){
 const golden=new THREE.ExtrudeGeometry(silhouette(),{
  depth:.16,steps:1,bevelEnabled:true,bevelThickness:.024,
  bevelSize:.023,bevelSegments:1,curveSegments:1,
 });
 golden.translate(0,0,-.08);
 // A smaller raised navy plate leaves a genuine gold silhouette, not a
 // luminous sticker on the front of the ocean.
 const plate=new THREE.ExtrudeGeometry(silhouette(),{
  depth:.035,steps:1,bevelEnabled:false,curveSegments:1,
 });
 plate.scale(.88,.951,1);
 plate.translate(0,.065,.116);
 const base=new THREE.CylinderGeometry(.38,.52,.24,10,1);
 base.translate(0,.13,0);
 const foot=new THREE.CylinderGeometry(.43,.48,.07,10,1);
 foot.translate(0,.28,0);
 const footRing=new THREE.TorusGeometry(.435,.022,6,22);
 footRing.rotateX(Math.PI/2);
 footRing.translate(0,.31,0);
 const highlightParts=[
  inlayBetween([0,.38],[0,1.48],.018,.165),
  inlayBetween([0,2.29],[0,3.15],.022,.165),
  inlayBetween([-.39,1.98],[-.58,2.21],.019,.165),
  inlayBetween([.39,1.98],[.58,2.21],.019,.165),
  inlayBetween([-.65,2.53],[-.70,2.85],.014,.165),
  inlayBetween([.65,2.53],[.70,2.85],.014,.165),
 ];
 const materialGold=new THREE.MeshStandardMaterial({
  vertexColors:true,metalness:.78,roughness:.27,
  side:THREE.DoubleSide,
 });
 const materialNavy=new THREE.MeshStandardMaterial({
  vertexColors:true,metalness:.35,roughness:.41,
  side:THREE.DoubleSide,
 });
 const materialLight=new THREE.MeshStandardMaterial({
  vertexColors:true,metalness:.46,roughness:.30,
  emissive:"#574015",emissiveIntensity:.26,
  side:THREE.DoubleSide,
 });
 const resources=[golden,plate,base,foot,footRing,...highlightParts];
 const materials=[materialGold,materialNavy,materialLight];
 const assembled:THREE.Mesh[]=[];
 const createZone=(root:THREE.Group,zone:"kelp"|"lagoon")=>{
  const batches=[new GeometryBatch(),new GeometryBatch(),new GeometryBatch()];
  for(const t of UNDERWATER_TRIDENTS.filter(t=>t.zone===zone)){
   const scale=tridentVisualScale(t);
   if(scale<TRIDENT_VISUAL.minScale)continue;
   const {x,z}=t.point,y=tridentBaseY(t);
   // The two lagoons have different approach angles. A second face gives
   // the flat faceted design legibility from either side of the sculpture.
   const facing=t.id==="trident-kelp"?.28:t.id==="trident-lagoon"?-.39:.58;
   const p=new THREE.Vector3(x,y,z),s=new THREE.Vector3(scale,scale,scale);
   const add=(batch:number,g:THREE.BufferGeometry,color:string,back=false)=>{
    batches[batch].add(g,color,p,s,new THREE.Euler(0,facing+(back?Math.PI:0),0));
   };
   add(0,golden,"#e5b52d");
   add(0,foot,"#b89037");
   add(1,base,"#1c3557");
   add(1,plate,"#142b50");
   add(1,plate,"#142b50",true);
   add(2,footRing,"#ffe07a");
   for(const g of highlightParts){
    add(2,g,"#f5d16d");
    add(2,g,"#f5d16d",true);
   }
  }
  const zoneLabel=zone==="kelp"?"kelp":"lagoon";
  const labels=[
   zone==="kelp"?"ucsd-inspired-kelp-trident":"ucsd-inspired-lagoon-tridents",
   zoneLabel+"-trident-navy-face",
   zoneLabel+"-trident-gold-inlays",
  ];
  for(let i=0;i<batches.length;i++){
   const mesh=new THREE.Mesh(batches[i].finish(),materials[i]);
   mesh.name=labels[i];
   mesh.castShadow=false;mesh.receiveShadow=true;
   root.add(mesh);assembled.push(mesh);
  }
 };
 createZone(kelpRoot,"kelp");
 createZone(lagoonRoot,"lagoon");
 return {count:UNDERWATER_TRIDENTS.length,dispose(){
  for(const mesh of assembled){
   mesh.removeFromParent();mesh.geometry.dispose();
  }
  for(const geometry of resources)geometry.dispose();
  for(const material of materials)material.dispose();
 }};
}
