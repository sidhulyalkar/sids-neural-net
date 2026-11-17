import type {MeshStandardMaterial} from "three/src/Three.Core.js";
/** One snow mesh, no overlapping surface. Its winter material only exists
 * while Skiing is selected. The shared uniform fades original alpine pigment
 * to winter snow without rebuilding meshes or changing collision during fade.
 */
export function applySnowpackMaterial(
  material:MeshStandardMaterial,
  winterBlend:{value:number}={value:1},
){
  material.onBeforeCompile=shader=>{
    shader.uniforms.snowWinterBlend=winterBlend;
    shader.vertexShader=shader.vertexShader
      .replace("#include <common>",`#include <common>
attribute vec4 snowLayers;
attribute float snowCoverage;
attribute vec3 baseColor;
uniform float snowWinterBlend;
varying vec4 vSnowLayers;
varying float vSnowCoverage;`)
      .replace("#include <color_vertex>",`#include <color_vertex>
#ifdef USE_COLOR
vColor.xyz=mix(baseColor,vColor.xyz,clamp(snowWinterBlend,0.0,1.0));
#endif`)
      .replace("#include <begin_vertex>",`#include <begin_vertex>
vSnowLayers=snowLayers;
vSnowCoverage=snowCoverage;`);
    shader.fragmentShader=shader.fragmentShader
      .replace("#include <common>",`#include <common>
uniform float snowWinterBlend;
varying vec4 vSnowLayers;
varying float vSnowCoverage;`)
      .replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
float snowMask=clamp(vSnowCoverage,0.0,1.0)*clamp(snowWinterBlend,0.0,1.0);
float surfacePowder=clamp(vSnowLayers.x/.45,0.0,1.0);
float snowGlaze=clamp(vSnowLayers.w,0.0,1.0);
float snowCrust=clamp(vSnowLayers.z,0.0,1.0);
float snowRoughness=clamp(.64+.32*surfacePowder-.28*snowGlaze-.10*snowCrust,.32,1.);
roughnessFactor=mix(roughnessFactor,snowRoughness,snowMask*.88);`);
  };
  material.customProgramCacheKey=()=>"sid-snowpack-surface-winter-v2";
  material.needsUpdate=true;
  return material;
}
