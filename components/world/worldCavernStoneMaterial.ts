import type {MeshStandardMaterial} from "three/src/Three.Core.js";

/** World-space mineral layers avoid stretched UVs on the angular cave shell.
 * Retains standard lighting and requires neither image downloads nor more draws. */
export function detailCavernStone(material:MeshStandardMaterial){
 material.roughness=.94;
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace("#include <common>",
   "#include <common>\nvarying vec3 vCavernStone;")
   .replace("#include <begin_vertex>",
    "#include <begin_vertex>\nvCavernStone = (modelMatrix * vec4(position, 1.0)).xyz;");
  shader.fragmentShader=shader.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vCavernStone;
float caveHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float caveNoise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(caveHash(i),caveHash(i+vec3(1,0,0)),f.x),
 mix(caveHash(i+vec3(0,1,0)),caveHash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(caveHash(i+vec3(0,0,1)),caveHash(i+vec3(1,0,1)),f.x),
 mix(caveHash(i+vec3(0,1,1)),caveHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`)
   .replace("#include <color_fragment>",`#include <color_fragment>
 vec3 stoneP=vCavernStone;
 float broad=caveNoise(stoneP*1.8);
 float grain=caveNoise(stoneP*22.0);
 float strata=abs(sin(stoneP.y*14.0+stoneP.x*1.3+broad*6.0));
 float seam=smoothstep(.04,.19,strata);
 vec3 mineral=mix(vec3(.47,.44,.38),vec3(.84,.79,.68),broad);
 diffuseColor.rgb *= mineral*(.76+.32*grain)*mix(.91,1.0,seam);
`);
 };
 material.customProgramCacheKey=()=>"cavern-mineral-strata-v1";
 return material;
}
