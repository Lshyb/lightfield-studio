import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createNeckRig, neckWeights } from '../dist/neck.js';

test('weights keep shoulders still, blend the neck, and bind the face to the upper joint', () => {
  assert.deepEqual(neckWeights(.3,-.4),[1,0,0,0]);
  assert.deepEqual(neckWeights(0,.2),[0,0,1,0]);
  assert.ok(neckWeights(0,-.3)[0] > 0 && neckWeights(0,-.3)[1] > 0);
  assert.ok(Math.abs(neckWeights(.24,-.18001)[0]-neckWeights(.24,-.17999)[0])<.001);
  for(let y=-.5;y<.5;y+=.02) for(let x=-.5;x<.5;x+=.1) {
    const weights=neckWeights(x,y); assert.ok(Math.abs(weights.reduce((a,b)=>a+b)-1)<1e-10); assert.ok(weights.every(x=>x>=0 && x<=1));
  }
});
test('head moves around the neck while shoulder vertices stay put and hair follows', () => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute([.3,-.4,0, 0,.3,.1, 0,-.3,0],3));
  const rig=createNeckRig(g,new THREE.MeshBasicMaterial());
  const hair=new THREE.Group(); hair.position.set(0,0,0); rig.attachHair(hair); rig.setPose(0,0,0);
  const neutralHair=new THREE.Vector3(); hair.getWorldPosition(neutralHair);
  assert.ok(neutralHair.length()<1e-7);
  rig.setPose(40,15,10);
  const shoulder=new THREE.Vector3(.3,-.4,0); rig.mesh.applyBoneTransform(0,shoulder); assert.ok(shoulder.distanceTo(new THREE.Vector3(.3,-.4,0))<1e-7);
  const face=new THREE.Vector3(0,.3,.1); rig.mesh.applyBoneTransform(1,face); assert.ok(face.distanceTo(new THREE.Vector3(0,.3,.1))>.03);
  const changedHair=new THREE.Vector3(); hair.getWorldPosition(changedHair); assert.ok(changedHair.distanceTo(neutralHair)>.01);
});

test('separate eye and brow surfaces share the head pose and inherit visibility',()=>{
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([.08,.17,.2],3));
  const rig=createNeckRig(geometry,new THREE.MeshBasicMaterial()),surface=rig.attachSurface(geometry,new THREE.MeshBasicMaterial());
  rig.mesh.position.y=1.42;rig.setPose(-45,-12,9);
  const bodyPoint=new THREE.Vector3(.08,.17,.2),surfacePoint=bodyPoint.clone();
  rig.mesh.applyBoneTransform(0,bodyPoint);surface.applyBoneTransform(0,surfacePoint);
  bodyPoint.applyMatrix4(rig.mesh.matrixWorld);surfacePoint.applyMatrix4(surface.matrixWorld);
  assert.ok(bodyPoint.distanceTo(surfacePoint)<1e-6,'parts must follow the same skull joints without a second transform');
  assert.equal(surface.castShadow,false);assert.equal(surface.receiveShadow,false);
  assert.equal(surface.parent,rig.mesh);
});

test('beard tips below the jaw follow their follicle rather than the neck at the tip position',()=>{
  const skin=new THREE.BufferGeometry();skin.setAttribute('position',new THREE.Float32BufferAttribute([.06,.03,.18],3));
  const beard=new THREE.BufferGeometry();beard.setAttribute('position',new THREE.Float32BufferAttribute([.06,.03,.18,.06,-.23,.20],3));
  beard.setAttribute('_beard_root',new THREE.Float32BufferAttribute([.06,.03,.18,.06,.03,.18],3));
  const rig=createNeckRig(skin,new THREE.MeshBasicMaterial());
  const surface=rig.attachSurface(beard,new THREE.MeshBasicMaterial(),{rootAttribute:'_beard_root'});
  rig.setPose(55,15,-15);
  const root=new THREE.Vector3(.06,.03,.18),tip=new THREE.Vector3(.06,-.23,.20),bodyRoot=root.clone();
  surface.applyBoneTransform(0,root);surface.applyBoneTransform(1,tip);rig.mesh.applyBoneTransform(0,bodyRoot);
  assert.ok(root.distanceTo(bodyRoot)<1e-7);
  assert.ok(Math.abs(root.distanceTo(tip)-Math.hypot(.26,.02))<1e-6);
});
