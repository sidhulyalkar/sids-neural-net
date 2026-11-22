import * as THREE from "three/src/Three.Core.js";
import {northShoreZ,skimWaterHeight,skimWaveAt,skimBreakAmountAt,
  skimWashDepthAt,skimSurfEnvelope,waveCrestAtX,type SkimPoint} from "@/lib/world/skimboarding";

/** One coherent water skin, five narrow curling lips and sparse whitewater.
 * No stacked full-width translucent foam planes. The skin samples the same
 * elevation as planing contact; lip overhang/spray are non-supporting water. */
export function createWorldSkimSurf(scene:THREE.Scene,sea:number,floorAt:(p:SkimPoint)=>number){
  const root=new THREE.Group();root.name="North Shore breaking surf";scene.add(root);
  const nx=80,nz=144;
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const keep=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
  function grid(columns:number,rows:number,name:string,m:THREE.Material){
    const g=keep(new THREE.BufferGeometry());
    const p=new THREE.BufferAttribute(new Float32Array((columns+1)*(rows+1)*3),3);
    const c=new THREE.BufferAttribute(new Float32Array((columns+1)*(rows+1)*4),4);
    p.setUsage(THREE.DynamicDrawUsage);c.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position",p);g.setAttribute("color",c);
    const indices:number[]=[];
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
      const a=j*(columns+1)+i,b=a+columns+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    g.setIndex(indices);
    const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.frustumCulled=false;
    mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);
    return {g,p,c,mesh};
  }
  const waterMaterial=new THREE.MeshStandardMaterial({color:"#ffffff",vertexColors:true,
    transparent:true,opacity:1,depthWrite:false,roughness:.24,metalness:.08,side:THREE.DoubleSide});
  const lipMaterial=new THREE.MeshStandardMaterial({color:"#ffffff",vertexColors:true,
    transparent:true,depthWrite:false,roughness:.38,side:THREE.DoubleSide});
  const foamMaterial=new THREE.MeshBasicMaterial({color:"#e8fff5",transparent:true,
    opacity:.62,depthWrite:false,side:THREE.DoubleSide});
  materials.push(waterMaterial,lipMaterial,foamMaterial);
  const skin=grid(nx,nz,"skim-shared-water-skin",waterMaterial);
  const lips=Array.from({length:5},(_,i)=>grid(64,6,`skim-curl-${i}`,lipMaterial));
  const foam=new THREE.InstancedMesh(keep(new THREE.CircleGeometry(1,7)),foamMaterial,160);
  foam.name="skim-broken-foam-cells";foam.frustumCulled=false;root.add(foam);
  const dummy=new THREE.Object3D(),p={x:0,z:0};
  const trough=new THREE.Color("#2996aa"),face=new THREE.Color("#64d3cb"),
    pale=new THREE.Color("#e2fff0"),color=new THREE.Color();
  // Geography and bottom sampling are static; only the water is animated.
  const floors=new Float32Array((nx+1)*(nz+1));
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    p.x=-31+62*i/nx;p.z=northShoreZ(p.x)-3.5+43.5*j/nz;
    floors[j*(nx+1)+i]=floorAt(p);
  }
  let last=-Infinity;
  function update(t:number,visible=true){
    root.visible=visible;
    if(!visible||t-last<1/30&&t>=last)return;
    last=t;
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const k=j*(nx+1)+i,offshore=-3.5+43.5*j/nz;
      p.x=-31+62*i/nx;p.z=northShoreZ(p.x)+offshore;
      const height=skimWaterHeight(p,t,sea),wave=skimWaveAt(p,t);
      const wash=skimWashDepthAt(p,t),floor=floors[k];
      const y=offshore<-.8?Math.min(height,floor+wash):height;
      skin.p.setXYZ(k,p.x,Math.max(floor+.012,y),p.z);
      color.copy(trough).lerp(face,wave*.88);
      const edge=skimSurfEnvelope(p.x)*THREE.MathUtils.smoothstep(offshore,-3.5,-1.5)*
        (1-THREE.MathUtils.smoothstep(offshore,34,40));
      // A near-transparent trough preserves fish/sand visibility; the face
      // gains depth and specular shape without painting pale bands on the sea.
      const alpha=edge*(offshore<0?.10+wash*.55:.07+wave*.44);
      skin.c.setXYZW(k,color.r,color.g,color.b,alpha);
    }
    skin.p.needsUpdate=true;skin.c.needsUpdate=true;skin.g.computeVertexNormals();
    for(let n=0;n<5;n++){
      const lip=lips[n];
      for(let j=0;j<=6;j++)for(let i=0;i<=64;i++){
        const u=j/6,k=j*65+i,x=-31+62*i/64;
        const crest=waveCrestAtX(n,x,t);
        p.x=x;p.z=northShoreZ(x)+crest;
        const strength=skimBreakAmountAt({x,z:p.z-.9},t);
        // Curl tips spill forward in short sections. The translucent underside
        // stays aqua; only the very tip is bright, so it reads as falling water.
        const peel=.45+.55*(.5+.5*Math.sin(x*.31+t*.9+n*1.8));
        const amount=strength*peel;
        const z=p.z-.14-u*.68*amount;
        const y=skimWaterHeight(p,t,sea)+Math.sin(u*Math.PI)*.36*amount-u*u*.38*amount;
        lip.p.setXYZ(k,x,y,z);
        color.copy(face).lerp(pale,Math.pow(u,4));
        const edge=Math.sin(Math.PI*u)*skimSurfEnvelope(x);
        lip.c.setXYZW(k,color.r,color.g,color.b,amount*edge*(.25+.55*u));
      }
      lip.p.needsUpdate=true;lip.c.needsUpdate=true;lip.g.computeVertexNormals();
      for(let i=0;i<32;i++){
        p.x=-29+58*(i+.5)/32;
        p.z=northShoreZ(p.x)+waveCrestAtX(n,p.x,t)-.55-(i%7)*.39;
        const amount=skimBreakAmountAt(p,t);
        const patch=.35+.65*Math.pow(.5+.5*Math.sin(i*2.39+t*1.4+n),2);
        const size=amount*patch*(.09+(i%4)*.075);
        dummy.position.set(p.x,skimWaterHeight(p,t,sea)+.025,p.z);
        dummy.rotation.set(-Math.PI/2,0,i*1.7+t*.1);
        dummy.scale.set(size*1.7,size,1);dummy.updateMatrix();
        foam.setMatrixAt(n*32+i,dummy.matrix);
      }
    }
    foam.instanceMatrix.needsUpdate=true;
  }
  update(0);
  return {root,update,dispose(){root.removeFromParent();foam.dispose();
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
