import * as THREE from "three/src/Three.Core.js";
import {GeometryBatch} from "./worldGeometry";
import {
  REEF_CANYON,REEF_CANYON_ROCKS,
} from "@/lib/world/reefCanyon";
import {SEA_SURFACE} from "@/lib/world/model";

/** An open, submerged, temperate reef passage, never a height-field wall.
 * All details sit on physical rock instances and stay below the sea surface.
 * Batches are static and share the existing kelp visibility gate.
 */
export function createMossCanyonReef(parent:THREE.Group){
  const root=new THREE.Group();
  root.name="submerged-moss-canyon-reef";
  parent.add(root);
  const rockShape=new THREE.IcosahedronGeometry(1,1);
  const bulbShape=new THREE.IcosahedronGeometry(1,1);
  const coralShape=new THREE.CylinderGeometry(.58,.87,1,6);
  const tentacleShape=new THREE.ConeGeometry(1,1,5);
  const discShape=new THREE.CylinderGeometry(1,1,1,10);
  const shapes=[rockShape,bulbShape,coralShape,tentacleShape,discShape];
  const rockBatch=new GeometryBatch();
  const coralBatch=new GeometryBatch();
  const anemoneBatch=new GeometryBatch();
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const dim=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const noRotation=new THREE.Euler();
  const palette=["#cf806f","#e8ac8b","#bd778d","#d6b5a0",
    "#a8788d","#e2aa72","#cf8c99"] as const;
  const stonePalette=["#586f6c","#4c6567","#788880","#5c7271"] as const;
  const axis=v(0,1,0);
  let coralCount=0,anemoneCount=0;
  let minTop=Infinity,maxTop=-Infinity;

  for(const rock of REEF_CANYON_ROCKS){
    const {x,z}=rock.point;
    const y=rock.floorY,top=rock.topY;
    minTop=Math.min(minTop,top);
    maxTop=Math.max(maxTop,top);
    const side=rock.side;
    const k=rock.index+(side===-1?0:8);
    rockBatch.add(rockShape,stonePalette[k%stonePalette.length],
      v(x,y+rock.height*.49,z),
      dim(rock.radius*1.04,rock.height*.53,rock.radius*1.03),
      new THREE.Euler(.06*Math.sin(k),k*.19,.05*Math.cos(k)));
    // Patches grow on outward-facing shoulders, never the swim lane.
    const outward=side*(rock.radius*.51);
    const sideX=x+outward;
    const baseY=Math.min(top-.23,SEA_SURFACE-1.2);
    for(let i=0;i<4;i++){
      const az=i*1.76+k*.41;
      const localX=sideX+side*.12*Math.cos(az);
      const localZ=z+.42*Math.sin(az);
      const localY=baseY-.32-(i%2)*.40;
      const color=palette[(k*3+i)%palette.length];
      const radius=.28+.07*((k+i)%3);
      coralBatch.add(bulbShape,color,v(localX,localY,localZ),
        dim(radius,.16+.05*(i%2),radius*.90),noRotation);
      // A rough-edged fan gives each colony recognizable reef relief.
      for(let b=0;b<3;b++){
        const theta=az+(b-1)*.52;
        const horizontal=side*.14*Math.cos(theta);
        const offsetZ=.17*Math.sin(theta);
        const start=v(localX,localY+.03,localZ);
        const end=v(localX+horizontal,localY+.19+.05*b,
          localZ+offsetZ);
        const delta=end.clone().sub(start);
        const length=delta.length();
        const rot=new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(axis,delta.normalize()));
        coralBatch.add(coralShape,color,start.add(end).multiplyScalar(.5),
          dim(.065,length,.065),rot);
      }
      coralCount++;
    }
    // One or two organic sea-anemone rosettes per side wall. Each receives
    // a visible oral disc and 9 curved-looking radial tentacles.
    for(let a=0;a<2;a++){
      const px=x+side*(rock.radius*.62);
      const pz=z+(a===0?-.34:.41);
      const py=Math.min(top-.28,SEA_SURFACE-1.25)-
        (a===0?.35:.83);
      const tone=(k+a)%2?"#d7abbb":"#e2b293";
      anemoneBatch.add(discShape,tone,v(px,py,pz),
        dim(.24,.07,.23),noRotation);
      anemoneBatch.add(bulbShape,"#a9788a",v(px,py+.055,pz),
        dim(.10,.035,.10),noRotation);
      for(let t=0;t<9;t++){
        const angle=t*Math.PI*2/9+a*.3;
        const dx=Math.cos(angle),dz=Math.sin(angle);
        const length=.23+.06*(1+Math.sin(t*1.8+k));
        const start=v(px+dx*.13,py+.04,pz+dz*.13);
        const end=v(px+dx*.24,py+.05+length,pz+dz*.24);
        const delta=end.clone().sub(start);
        const rotation=new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(axis,delta.normalize()));
        anemoneBatch.add(tentacleShape,t%3===0?"#edc3bd":tone,
          start.add(end).multiplyScalar(.5),
          dim(.047,delta.length(),.047),rotation);
      }
      anemoneCount++;
    }
  }

  const mats=[
    new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:.97,metalness:0,side:THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:.84,metalness:0,side:THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:.78,metalness:0,side:THREE.DoubleSide,
    }),
  ];
  const meshes=[
    new THREE.Mesh(rockBatch.finish(),mats[0]),
    new THREE.Mesh(coralBatch.finish(),mats[1]),
    new THREE.Mesh(anemoneBatch.finish(),mats[2]),
  ];
  for(const [i,mesh] of meshes.entries()){
    mesh.name=["moss-canyon-walls","moss-canyon-coral",
      "moss-canyon-anemones"][i];
    mesh.receiveShadow=true;
    mesh.castShadow=false;
    root.add(mesh);
  }
  root.userData.habitat="submerged-temperate-reef";
  root.userData.clearHalfWidth=REEF_CANYON.clearHalfWidth;
  return {root,rockCount:REEF_CANYON_ROCKS.length,
    coralCount,anemoneCount,minTop,maxTop,
    dispose(){
      root.removeFromParent();
      for(const mesh of meshes)mesh.geometry.dispose();
      for(const mat of mats)mat.dispose();
      for(const geo of shapes)geo.dispose();
    },
  };
}
