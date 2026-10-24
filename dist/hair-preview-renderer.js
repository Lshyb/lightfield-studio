import * as THREE from './vendor/three.module.js';
import {createNeckRig} from './neck.js';
import {createHairMotion} from './hair-motion.js';
import {loadHairGeometry} from './hair-fibers.js';
import {hairCuts} from './hair-cuts.js';
import {withImageAttribution} from './image-rights.js';

const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
// Uses the same neutral model, materials, strand geometry, style cuts and
// collision shader as the studio. Its private scene never changes user settings.
export async function renderFemaleHairPreviews(asset,collider,styles,onImage) {
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(1);renderer.setSize(240,300,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.8;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#29322e');
  const camera=new THREE.OrthographicCamera(-.408,.408,.51,-.51,.01,10);
  camera.position.set(0,.09,2.2);camera.lookAt(0,.09,0);
  scene.add(new THREE.HemisphereLight(0xf5f4ed,0x353f38,.9));
  const lights=[];
  for(const [position,power]of [[[-1.5,1.7,2.5],4.2],[[1,.4,2],1.4],[[1,1,-1],2.1]]){
    const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(...position);
    light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.left=-.8;light.shadow.camera.right=.8;light.shadow.camera.top=.8;light.shadow.camera.bottom=-.8;light.shadow.camera.near=.1;light.shadow.camera.far=7;
    light.shadow.bias=-.00008;light.shadow.normalBias=.002;scene.add(light);lights.push(light);
  }
  const materials=[asset.material.clone(),...asset.parts.map(part=>part.material.clone())];
  const rig=createNeckRig(asset.geometry,materials[0],{subject:'female'});scene.add(rig.mesh);
  rig.mesh.castShadow=true;rig.mesh.receiveShadow=true;
  asset.parts.forEach((part,i)=>rig.attachSurface(part.geometry,materials[i+1],{castShadow:part.material.name==='Lashes',receiveShadow:true}));
  const hairRoot=new THREE.Group();rig.attachHair(hairRoot);rig.setPose(0,0,0);
  const motion=createHairMotion(hairRoot,asset.geometry,collider);motion.setEnabled(false);
  const material=motion.shader(new THREE.MeshPhysicalMaterial({color:'#21140d',roughness:.48,metalness:0,vertexColors:true,anisotropy:.55,specularIntensity:.5,sheen:.22,sheenRoughness:.6,sheenColor:'#8f7964'}));
  const depth=motion.shader(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));
  const hair=new THREE.Mesh(new THREE.BufferGeometry(),material),empty=hair.geometry;
  hair.customDepthMaterial=depth;hair.castShadow=true;hair.receiveShadow=true;hair.frustumCulled=false;hairRoot.add(hair);
  try {
    for(const style of styles){
      const cut=hairCuts.female[style];
      hair.visible=style!=='none';
      if(cut.source)hair.geometry=await loadHairGeometry(cut.source);
      motion.setCut(cut.cut||[0,1]);scene.updateMatrixWorld(true);rig.mesh.skeleton.update();motion.step(performance.now(),style);
      renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
      const credits=['Female bust: Scifi Girl v.01 by patrix; CC BY-NC-SA 4.0; https://creativecommons.org/licenses/by-nc-sa/4.0/; https://sketchfab.com/3d-models/scifi-girl-v01-96340701c2ed4d37851c7d9109eee9c0; cropped and refined for LIGHTFIELD'];
      if(style!=='none')credits.push('Hair Styles: Daniel Bystedt; CC BY-SA; official-default-3.0 distribution basis documented at https://www.blender.org/about/website/; https://www.blender.org/download/demo-files/#hair; adapted for LIGHTFIELD. This combined preview is generated locally; public reuse requires separate compatibility review.');
      onImage(style,withImageAttribution(renderer.domElement.toDataURL('image/jpeg',.86),credits));
      await nextFrame();
    }
  } finally {
    // Shared portrait maps, collider and cached strand geometries belong to the
    // main studio. Only the temporary scene's own allocations are disposed.
    rig.mesh.traverse(ob=>{if(ob.isSkinnedMesh)ob.geometry.dispose();});
    rig.mesh.skeleton.dispose();materials.forEach(m=>m.dispose());material.dispose();depth.dispose();empty.dispose();motion.dispose();
    lights.forEach(light=>light.shadow.map?.dispose());renderer.dispose();renderer.forceContextLoss();
  }
}
