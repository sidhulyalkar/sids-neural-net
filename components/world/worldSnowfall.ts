import * as THREE from "three/src/Three.Core.js";

/** A bounded, camera-local GPU point volume. No weather particles, GPU
 * buffers or animation work exist until the winter environment requests it.
 * Flakes are cosmetic and NEVER qualify terrain as snow for ski contact.
 */
export function createWorldSnowfall(scene: THREE.Scene, mobile=false) {
  const count=mobile?250:700;
  const positions=new Float32Array(count*3);
  const sizes=new Float32Array(count);
  const speed=new Float32Array(count);
  // Deterministic allocation. Animation uses no Math.random and allocates
  // no new buffer or geometry on each frame.
  let seed=0x51d5a;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const halfWidth=17,halfHeight=11;
  for(let i=0;i<count;i++){
    positions[i*3]=(random()*2-1)*halfWidth;
    positions[i*3+1]=(random()*2-1)*halfHeight;
    positions[i*3+2]=(random()*2-1)*halfWidth;
    sizes[i]=.55+random()*1.25;
    speed[i]=.65+random()*1.35;
  }
  const geometry=new THREE.BufferGeometry();
  const attribute=new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position",attribute);
  geometry.setAttribute("flakeSize",new THREE.BufferAttribute(sizes,1));
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,
    uniforms:{opacity:{value:0}},
    vertexShader:`attribute float flakeSize;
      varying float vBrightness;
      void main(){
        vec4 view=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(flakeSize*75.0/max(1.0,-view.z),1.0,8.0);
        vBrightness=0.75+0.25*flakeSize/1.8;
      }`,
    fragmentShader:`uniform float opacity;
      varying float vBrightness;
      void main(){
        vec2 p=gl_PointCoord-vec2(.5);
        float alpha=1.0-smoothstep(.18,.48,length(p));
        gl_FragColor=vec4(.91,.96,1.0,alpha*opacity*vBrightness);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points=new THREE.Points(geometry,material);
  points.frustumCulled=false;
  points.visible=false;
  scene.add(points);
  let centered=false;
  return {
    update(dt:number,camera:THREE.Camera,intensity:number){
      const opacity=Math.max(0,Math.min(1,intensity));
      points.visible=opacity>.015;
      material.uniforms.opacity.value=.73*opacity;
      if(!points.visible)return;
      if(!centered){points.position.copy(camera.position);centered=true;}
      // Camera follows through the volume; particles retain their own wind
      // and vertical motion. The volume is intentionally not global.
      const d=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.05));
      points.position.lerp(camera.position,Math.min(1,d*1.8));
      for(let i=0;i<count;i++){
        const n=i*3;
        positions[n]+=(.12+speed[i]*.13)*d;
        positions[n+1]-=speed[i]*d;
        positions[n+2]+=.07*d;
        if(positions[n+1]<-halfHeight)positions[n+1]+=2*halfHeight;
        if(positions[n]>halfWidth)positions[n]-=2*halfWidth;
        if(positions[n+2]>halfWidth)positions[n+2]-=2*halfWidth;
      }
      attribute.needsUpdate=true;
    },
    dispose(){
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
    get particleCount(){return count;},
  };
}
