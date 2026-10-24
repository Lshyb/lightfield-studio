import test from 'node:test';
import assert from 'node:assert/strict';
import {linearShadowDepth,penumbraUV,createStudioShadows} from '../dist/studio-shadows.js';
import * as THREE from '../dist/vendor/three.module.js';

test('shadow projection recovers real distances and contact shadows widen with blocker separation',()=>{
 for(const [near,far] of [[.1,3],[.9,3.3],[2.9,5.3]])for(const distance of [near,(near+far)/2,far]){
  const depth=(far-near*far/distance)/(far-near);
  assert.ok(Math.abs(linearShadowDepth(depth,near,far)-distance)<1e-8);
 }
 assert.equal(penumbraUV(.5,2,2,.4),0);
 assert.ok(penumbraUV(.5,2,1.5,.4)>penumbraUV(.5,2,1.9,.4));
 assert.ok(penumbraUV(.5,2,1.5,.4)>penumbraUV(.05,2,1.5,.4));
});

test('soft shadow hook preserves material customizations and handles soloed lights in renderer order',()=>{
 const shadows=createStudioShadows(),material=new THREE.MeshStandardMaterial();
 material.onBeforeCompile=shader=>{shader.uniforms.preserved={value:1};};
 material.customProgramCacheKey=()=> 'original-material';shadows.material(material);
 const lights=[0,1,2].map(i=>{const light=new THREE.SpotLight();light.castShadow=true;light.shadow.camera.near=.5+i;light.shadow.camera.far=4+i;light.userData.emitterRadius=.1+i;return light;});
 lights[0].visible=false;shadows.update(lights);
 const shader={uniforms:{},fragmentShader:'#include <shadowmap_pars_fragment>\n#include <lights_fragment_begin>'};material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.preserved.value,1);
 assert.equal(shader.uniforms.studioShadowFrustum.value[0].x,1.5);
 assert.equal(shader.uniforms.studioShadowFrustum.value[1].z,2.1);
 assert.ok(shader.fragmentShader.includes('getStudioShadow( spotShadowMap'));
 assert.ok(!shader.fragmentShader.includes('( directLight.visible && receiveShadow ) ? getStudioShadow'));
 assert.ok(material.customProgramCacheKey().startsWith('original-material-'));
});
