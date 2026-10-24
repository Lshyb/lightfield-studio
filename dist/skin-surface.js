import * as THREE from './vendor/three.module.js';

// Fine surface normals are procedural and contain no baked lighting.
function poreNormals() {
  const size = 256, heights = new Float32Array(size*size), pixels = new Uint8Array(size*size*4);
  let seed = 71937;
  const random = () => ((seed = Math.imul(1664525,seed) + 1013904223 | 0) >>> 0) / 4294967296;
  for (let i=0;i<2200;i++) {
    const x = random()*size, y = random()*size, radius = .8+random()*1.2, depth = .3+random()*.7;
    for (let dy=-4;dy<=4;dy++) for (let dx=-4;dx<=4;dx++) {
      const px=Math.floor(x)+dx,py=Math.floor(y)+dy,d2=((px-x)**2+(py-y)**2)/(radius*radius);
      heights[((py+size)%size)*size+(px+size)%size] -= Math.exp(-d2*1.8)*depth;
    }
  }
  const h=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const n=new THREE.Vector3((h(x-1,y)-h(x+1,y))*.65,(h(x,y-1)-h(x,y+1))*.65,1).normalize(),i=(y*size+x)*4;
    pixels[i]=(n.x*.5+.5)*255; pixels[i+1]=(n.y*.5+.5)*255; pixels[i+2]=(n.z*.5+.5)*255; pixels[i+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.repeat.set(54,54);
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

export function refineSkin(source) {
  const material = new THREE.MeshPhysicalMaterial(); THREE.MeshStandardMaterial.prototype.copy.call(material,source);
  material.name = 'Skin'; material.roughness = .58; material.specularIntensity = .3;
  // Preserve the UV-baked skin relief; tiled pores are only a legacy fallback.
  material.normalMap = source.normalMap || poreNormals();
  material.normalScale.setScalar(source.normalMap ? .55 : .16);
  material.color.setRGB(1, .98, .97);
  material.onBeforeCompile = shader => {
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 skinPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nskinPosition = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 skinPosition;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float noseZone = exp(-pow(skinPosition.x/.034,2.0)-pow((skinPosition.y-.07)/.062,2.0));
      float foreheadZone = exp(-pow(skinPosition.x/.115,2.0)-pow((skinPosition.y-.27)/.05,2.0));
      roughnessFactor = clamp(roughnessFactor - .13*noseZone - .07*foreheadZone,.4,.7);
    `);
  };
  material.customProgramCacheKey=()=> 'lightfield-skin-surface-v2';
  return material;
}
