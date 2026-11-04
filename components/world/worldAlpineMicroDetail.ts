import * as THREE from "three/src/Three.Core.js";
import {GeometryBatch} from "./worldGeometry";
import {terrainHeight,isWater} from "@/lib/world/model";
import {sportClearance} from "@/lib/world/activities";
import {discGolfCourseClearance,discGolfOpeningClearance} from "@/lib/world/discGolf";
import {SKATE_GROVE_FRAME_TREES} from "@/lib/world/skatepark";
import {
  ALPINE_HALFPIPE,GLACIER_PASSAGE,ALPINE_PARK_RAILS,ALPINE_KICKERS,
  ALPINE_ROCK_RIBS,alpineHalfpipeStrength,alpineSportClearance,
  glacierVaultHeight,
} from "@/lib/world/alpineTerrainPark";

const P=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);

/** The surfaces here are entirely decorative. Every point is planted on a
 * real authored contact surface or a mature tree whose collider already
 * exists. The actual controls and support stay in the pure world modules. */
export function createWorldAlpineMicroDetail(scene:THREE.Scene){
  const batch=new GeometryBatch();
  const groveBatch=new GeometryBatch();
  const slender=new THREE.CylinderGeometry(1,1,1,6);
  const cone=new THREE.ConeGeometry(1,1,6);
  const pebble=new THREE.IcosahedronGeometry(1,0);
  let corduroy=0,iceBands=0,fixtures=0,sequoiaDetails=0,rockLayers=0;

  const rod=(a:THREE.Vector3,b:THREE.Vector3,r:number,color:string,
    target:GeometryBatch=batch)=>{
    const axis=b.clone().sub(a);
    if(axis.lengthSq()<.000001)return;
    const mid=a.clone().add(b).multiplyScalar(.5);
    const rotation=new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0,1,0),axis.clone().normalize()));
    target.add(slender,color,mid,new THREE.Vector3(r,axis.length(),r),rotation);
  };

  // 1. GROOMED SNOW. The micro-ridges follow the actual C1 halfpipe bank
  // longitudinally. They're shallow enough to stay within the visual snow
  // crust without creating a second invisible support surface.
  const h=ALPINE_HALFPIPE;
  for(let i=-13;i<=13;i++){
    const x=h.centerX+i*.42;
    for(let j=0;j<32;j++){
      const z0=h.startZ+.85+(h.endZ-h.startZ-1.7)*j/32;
      const z1=h.startZ+.85+(h.endZ-h.startZ-1.7)*(j+1)/32;
      if(alpineHalfpipeStrength({x,z:(z0+z1)/2})<.3)continue;
      const y0=terrainHeight(x,z0)+.072,y1=terrainHeight(x,z1)+.072;
      rod(P(x,y0,z0),P(x,y1,z1),
        i%4===0?.018:.011,i%5===0?"#c9dfe8":"#f3fbfc");
      corduroy++;
    }
  }
  // A little wind-etched shadow beneath both coping shoulders; each stroke
  // is safely above its mapped bank and does not affect an edge contact.
  for(const side of [-1,1]){
    for(let i=0;i<24;i++){
      const z=h.startZ+1+(h.endZ-h.startZ-2)*i/24;
      const x=h.centerX+side*(h.rimHalfWidth-.34);
      const y=terrainHeight(x,z)+.085;
      rod(P(x,y,z),P(x+side*.22,y+.015,z+.15),.025,"#aecbd6");
    }
  }

  // 2. BLUE GLACIER. Layered, scalloped compression bands trace the SAME
  // vault function that caps player headroom. Never hang decorations below
  // the interior ceiling into the skiable route.
  const g=GLACIER_PASSAGE;
  for(let ix=0;ix<17;ix++){
    const x=g.westX+.42+(g.eastX-g.westX-.84)*ix/16;
    const floor=terrainHeight(x,g.centerZ);
    for(let j=1;j<=22;j++){
      const a=Math.PI*(j-1)/23,b=Math.PI*j/23;
      const point=(theta:number)=>{
        const z=g.centerZ+g.innerHalfWidth*Math.cos(theta);
        const y=glacierVaultHeight({x,z},floor);
        return y===null?null:P(x,y+.062,z);
      };
      const start=point(a),end=point(b);
      if(!start||!end)continue;
      rod(start,end,ix%4===0?.046:.019,
        ix%5===0?"#5b9bb9":ix%3===0?"#b6e4ef":"#8dcee3");
      iceBands++;
    }
  }
  // Fine directional ice veins follow the tunnel axis, break at bands and
  // subtly vary with depth. No random shaders, lights, textures or timers.
  for(const angle of [.34,.63,.88,1.13,1.51,1.82,2.23,2.48,2.83]){
    const z=g.centerZ+g.innerHalfWidth*Math.cos(angle);
    for(let k=0;k<38;k++){
      const xa=g.westX+.4+(g.eastX-g.westX-.8)*k/38;
      const xb=g.westX+.4+(g.eastX-g.westX-.8)*(k+1)/38;
      const ya=glacierVaultHeight({x:xa,z},terrainHeight(xa,g.centerZ));
      const yb=glacierVaultHeight({x:xb,z},terrainHeight(xb,g.centerZ));
      if(ya===null||yb===null)continue;
      const offset=.068+.007*Math.sin(k*1.37+angle*6);
      rod(P(xa,ya+offset,z),P(xb,yb+offset,z),
        .010,angle>1.5?"#b2e2ee":"#73afca");
      iceBands++;
    }
  }
  // Rock-anchored glacier mouth ridges, far outside the rider's centerline,
  // give the entrances natural layered buttresses rather than metal portals.
  for(const x of [g.westX,g.eastX]){
    for(const side of [-1,1]){
      for(let k=0;k<4;k++){
        const z=g.centerZ+side*(g.innerHalfWidth+.35+k*.36);
        const y=terrainHeight(x,z);
        const tip=P(x+side*.13,y+.70+k*.20,z);
        const foot=P(x+(x===g.westX?-1:1)*.68,y+.02,z+side*.16);
        rod(foot,tip,.13-k*.015,k%2?"#8ac0d5":"#b1dce8");
        fixtures++;
      }
    }
  }

  // 3. RAIL CONSTRUCTION. A subtle welded collar at each control point,
  // support-foot brackets, and ice-flecked footings. The rail centerline
  // remains the existing deterministic grind chain, never a new magnet.
  const unique=new Set<string>();
  for(const rail of ALPINE_PARK_RAILS){
    if(rail.chainId==="alpine-box-spine")continue;
    for(const [p,lift] of [[rail.a,rail.lift],[rail.b,rail.liftEnd]] as const){
      const id=rail.chainId+":"+p.x.toFixed(3)+":"+p.z.toFixed(3);
      if(unique.has(id))continue;
      unique.add(id);
      const floor=terrainHeight(p.x,p.z);
      const top=floor+lift+.16;
      rod(P(p.x-.135,top,p.z),P(p.x+.135,top,p.z),
        .025,"#d4e2e4");
      // Low-profile rock-set footings belong to the visible support.
      batch.add(pebble,"#a1b6bc",P(p.x,floor+.04,p.z),
        new THREE.Vector3(.19,.08,.19));
      fixtures+=2;
    }
  }

  // 4. LARGE SNOW KICKERS. Compression lines sit exactly on the rendered
  // contact deck, revealing roll-in and takeoff without brightly lit signage.
  for(const jump of ALPINE_KICKERS){
    const m=Math.hypot(jump.heading.x,jump.heading.z)||1;
    const fx=jump.heading.x/m,fz=jump.heading.z/m;
    const sx=fz,sz=-fx;
    for(const side of [-.92,0,.92]){
      for(let i=0;i<15;i++){
        const s0=-3.36+i*3.1/15,s1=-3.36+(i+1)*3.1/15;
        const a={x:jump.point.x+fx*s0+sx*side,z:jump.point.z+fz*s0+sz*side};
        const b={x:jump.point.x+fx*s1+sx*side,z:jump.point.z+fz*s1+sz*side};
        const y0=terrainHeight(a.x,a.z)+.08,y1=terrainHeight(b.x,b.z)+.08;
        rod(P(a.x,y0,a.z),P(b.x,y1,b.z),
          .014,side===0?"#e4f0f5":"#bdd9e4");
        fixtures++;
      }
    }
  }

  // 5. LAYERED GRANITE / GNEISS. Additional bedding planes are embedded in
  // existing authored skyline ribs outside any reserved ride path.
  for(const [x,z,size] of ALPINE_ROCK_RIBS){
    if(alpineSportClearance({x,z}))continue;
    const floor=terrainHeight(x,z);
    for(let layer=0;layer<5;layer++){
      const y=floor+size*(.22+layer*.115);
      const width=(1.2+size*.11)*(.83-layer*.09);
      const faceZ=z+(1.1-layer*.06);
      rod(P(x-width,y,faceZ),P(x+width,y+.10*Math.sin(layer*2.4),faceZ),
        .035,layer%2===0?"#abbec8":"#485c68");
      rockLayers++;
    }
  }

  // 6. OLD-GROWTH REDWOODS. Deep vertical bark furrows, broad low buttress
  // roots and short upper branchlets make the mature sequoias materially
  // different from the much smaller alpine conifers.
  SKATE_GROVE_FRAME_TREES.forEach((tree,index)=>{
    if(index<6||tree.h<29||isWater(tree)||
      sportClearance(tree)||discGolfOpeningClearance(tree,2)||
      discGolfCourseClearance(tree,2))return;
    const base=terrainHeight(tree.x,tree.z);
    for(let j=0;j<9;j++){
      const a=j*Math.PI*2/9+index*.24;
      const r=tree.r*.92;
      const px=tree.x+Math.cos(a)*r,pz=tree.z+Math.sin(a)*r;
      for(let part=0;part<5;part++){
        const y0=base+.8+tree.h*.14*part;
        const y1=base+.8+tree.h*.14*(part+1);
        const taper0=1-part*.075,taper1=1-(part+1)*.075;
        rod(P(tree.x+(px-tree.x)*taper0,y0,tree.z+(pz-tree.z)*taper0),
          P(tree.x+(px-tree.x)*taper1,y1,tree.z+(pz-tree.z)*taper1),
          .034,part%2?"#5c3025":"#985438",groveBatch);
        sequoiaDetails++;
      }
    }
    for(let j=0;j<7;j++){
      const a=2*Math.PI*j/7+index*.21;
      const outward=tree.r*(1.45+.26*Math.sin(j*3.1));
      const x=tree.x+outward*Math.cos(a),z=tree.z+outward*Math.sin(a);
      rod(P(tree.x+Math.cos(a)*tree.r*.66,base+1.5,tree.z+Math.sin(a)*tree.r*.66),
        P(x,terrainHeight(x,z)+.12,z),.16,"#74412e",groveBatch);
      sequoiaDetails++;
    }
    // A few layered limb stems live inside the established tree crown,
    // never as crossing collision cylinders over the footpath.
    for(let k=0;k<7;k++){
      const angle=k*2.399+index;
      const y=base+tree.h*(.65+.033*k);
      const reach=tree.r*(2.0+.12*k);
      rod(P(tree.x,y,tree.z),
        P(tree.x+Math.cos(angle)*reach,y+tree.h*.025,
          tree.z+Math.sin(angle)*reach),
        tree.r*.085,"#6d3b2d",groveBatch);
      const tip=P(tree.x+Math.cos(angle)*reach,y+tree.h*.08,
        tree.z+Math.sin(angle)*reach);
      groveBatch.add(cone,k%3===0?"#56745b":"#4b6956",tip,
        new THREE.Vector3(reach*.34,tree.h*.06,reach*.34));
      sequoiaDetails+=2;
    }
  });
  // Keep the two distant biomes in different frustum-cullable draw batches.
  // A beach visitor must not render mountain ice and old-growth bark together.
  const geometry=batch.finish(),groveGeometry=groveBatch.finish();
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.82,metalness:.035,side:THREE.DoubleSide,
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name="alpine-batched-snow-ice-rails-geological-strata";
  mesh.receiveShadow=true;scene.add(mesh);
  const groveMesh=new THREE.Mesh(groveGeometry,material);
  groveMesh.name="grove-batched-old-growth-bark-buttress-roots";
  groveMesh.receiveShadow=true;scene.add(groveMesh);
  slender.dispose();cone.dispose();pebble.dispose();
  return {
    mesh,groveMesh,statistics:{corduroy,iceBands,fixtures,sequoiaDetails,rockLayers},
    dispose(){
      scene.remove(mesh);scene.remove(groveMesh);
      geometry.dispose();groveGeometry.dispose();material.dispose();
    },
  };
}
