import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

export async function loadPortraitGeometry(file, manager) {
  const gltf = await new GLTFLoader(manager).loadAsync(`./assets/${file}`);
  const parts = []; let geometry, material;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(obj => {
    if (!obj.isMesh) return;
    const meshGeometry = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
    meshGeometry.userData.subject=file.startsWith('female-')?'female':'male';
    let surfaceMaterial = obj.material;
    if (surfaceMaterial.name === 'Skin' || (file.startsWith('male-') && surfaceMaterial.name === 'Eyes')) {
      surfaceMaterial = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(surfaceMaterial,obj.material);
      surfaceMaterial.specularIntensity = .35;
      if (surfaceMaterial.name === 'Eyes') {
        surfaceMaterial.specularIntensity = .45; surfaceMaterial.clearcoat = .2;
        surfaceMaterial.clearcoatRoughness = .15;
      }
    }
    if (surfaceMaterial.name === 'Skin') { geometry = meshGeometry; material = surfaceMaterial; }
    else {
      if (surfaceMaterial.name === 'Lashes') {
        surfaceMaterial.alphaTest = .32; surfaceMaterial.depthWrite = true;
        surfaceMaterial.transparent = false; surfaceMaterial.alphaToCoverage = true;
      }
      parts.push({geometry:meshGeometry, material:surfaceMaterial});
    }
  });
  if (!geometry) throw new Error('人像模型没有可用的皮肤几何体');
  return {geometry, material, parts};
}
