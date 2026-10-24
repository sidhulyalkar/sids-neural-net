import * as THREE from 'three/src/Three.Core.js';
import {RESEARCH_GALLERY} from '@/lib/world/researchGallery';
import {paperCaveFloorHeight} from '@/lib/world/model';
export function createResearchGallery(){
 const root=new THREE.Group(),targets:THREE.Mesh[]=[],textures:THREE.Texture[]=[];const loader=new THREE.TextureLoader();let disposed=false;
 for(const entry of RESEARCH_GALLERY){
  const group=new THREE.Group();group.position.set(entry.position.x,paperCaveFloorHeight(entry.position)+3.15,entry.position.z);group.rotation.y=entry.yaw;root.add(group);
  const height=entry.width/entry.aspect;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(entry.width+.22,height+.22,.12),new THREE.MeshStandardMaterial({color:'#5c4834',roughness:.9})));
  const material=new THREE.MeshBasicMaterial({color:'#f3f0e9'}),panel=new THREE.Mesh(new THREE.PlaneGeometry(entry.width,height),material);panel.position.z=.075;panel.userData.paperHref=entry.href;group.add(panel);targets.push(panel);
  const texture=loader.load(entry.image,()=>{if(disposed){texture.dispose();return;}material.map=texture;material.needsUpdate=true;});texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
  const label=document.createElement('canvas');label.width=1200;label.height=130;const ctx=label.getContext('2d')!;ctx.fillStyle='#19312e';ctx.fillRect(0,0,1200,130);ctx.fillStyle='#f5e8c8';ctx.textAlign='center';ctx.font='500 43px Georgia';ctx.fillText(entry.title,600,52);ctx.font='23px sans-serif';ctx.fillText(entry.credit+' · Open paper ↗',600,99);
  const labelTexture=new THREE.CanvasTexture(label);labelTexture.colorSpace=THREE.SRGBColorSpace;textures.push(labelTexture);
  const plaque=new THREE.Mesh(new THREE.PlaneGeometry(entry.width,.65),new THREE.MeshBasicMaterial({map:labelTexture}));plaque.position.set(0,-height/2-.43,.08);plaque.userData.paperHref=entry.href;group.add(plaque);targets.push(plaque);
 }
 return {root,targets,dispose(){disposed=true;textures.forEach(t=>t.dispose());root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});}};
}
