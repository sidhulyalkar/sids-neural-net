import type {MeshStandardMaterial} from "three/src/Three.Core.js";
/** Single terrain draw call with matte powder and smoother dense/icy patches.
 * Four snow layer scalars and a snow mask are shared with the ski solver.
 * Never alter terrain height or create overlapping snow planes. */
export function applySnowpackMaterial(material:MeshStandardMaterial){
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace("#include <common>",`#include <common>
attribute vec4 snowLayers;
attribute float snowCoverage;
varying vec4 vSnowLayers;
varying float vSnowCoverage;`)
      .replace("#include <begin_vertex>",`#include <begin_vertex>
vSnowLayers=snowLayers;
vSnowCoverage=snowCoverage;`);
    shader.fragmentShader=shader.fragmentShader
      .replace("#include <common>",`#include <common>
varying vec4 vSnowLayers;
varying float vSnowCoverage;`)
      .replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
float snowMask=clamp(vSnowCoverage,0.0,1.0);
float surfacePowder=clamp(vSnowLayers.x/.45,0.0,1.0);
float snowGlaze=clamp(vSnowLayers.w,0.0,1.0);
float snowCrust=clamp(vSnowLayers.z,0.0,1.0);
float snowRoughness=clamp(.64+.32*surfacePowder-.28*snowGlaze-.10*snowCrust,.32,1.);
roughnessFactor=mix(roughnessFactor,snowRoughness,snowMask*.88);`);
  };
  material.customProgramCacheKey=()=>"sid-snowpack-surface-v1";
  material.needsUpdate=true;
  return material;
}
