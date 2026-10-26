import * as THREE from 'three/src/Three.Core.js';
import {NORTHEAST_SANDBARS} from '@/lib/world/northeastSandbars';
/** Sand pigment follows the real seabed; no decal sheet or z-fighting. */
export function applyLagoonSand(material:THREE.MeshStandardMaterial){
 material.onBeforeCompile=shader=>{
  shader.uniforms.sandBanks={value:NORTHEAST_SANDBARS.map(b=>new THREE.Vector3(b.x,b.z,b.radius))};
  shader.vertexShader='varying vec2 sandWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nsandWorld=(modelMatrix*vec4(transformed,1.0)).xz;');
  shader.fragmentShader='varying vec2 sandWorld;\nuniform vec3 sandBanks[4];\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float sandMask=0.0;
   for(int b=0;b<4;b++) sandMask=max(sandMask,1.0-smoothstep(0.55,1.0,distance(sandWorld,sandBanks[b].xy)/sandBanks[b].z));
   float phase=sandWorld.x*8.0+sin(sandWorld.y*.48)*1.8+sin(sandWorld.y*1.1)*.25;
   float aa=max(fwidth(phase),.001);
   float ridge=sin(phase)*exp(-aa*aa*.3);
   float grain=sin(sandWorld.x*91.0)*sin(sandWorld.y*83.0)*.012/(1.0+aa*8.0);
   vec3 sand=vec3(.82,.77,.63)*(.94+ridge*.075+grain);
   diffuseColor.rgb=mix(diffuseColor.rgb,sand,sandMask*.96);
  `);
 };
 material.customProgramCacheKey=()=> 'lagoon-sand-v1';
 return material;
}
