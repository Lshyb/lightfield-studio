import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeHeadCollider,sampleHeadCollider} from '../dist/head-collider.js';
import {createNeckCollisionProxy} from '../dist/hair-motion.js';
import * as THREE from '../dist/vendor/three.module.js';

test('both busts have local signed surface colliders with an interior, exterior and finite normals',async()=>{
 for(const subject of ['male','female']) {
  const bytes=await readFile(new URL(`../dist/assets/hair/${subject}-head.sdf`,import.meta.url));
  const sdf=decodeHeadCollider(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.ok(sampleHeadCollider(sdf,[0,.28,0]).distance<-.015);
  assert.ok(sampleHeadCollider(sdf,[0,.50,0]).distance>.02);
  for(const p of [[.16,.25,0],[0,.40,.10],[-.13,.12,.14]]) {
   const sample=sampleHeadCollider(sdf,p);assert.ok(sample.normal.every(Number.isFinite));
   assert.ok(Math.abs(Math.hypot(...sample.normal)-1)<.001);
  }
  assert.throws(()=>decodeHeadCollider(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+80)),/范围/);
 }
 assert.throws(()=>decodeHeadCollider(new ArrayBuffer(12)),/完整/);
});

test('neck collider keeps triangles crossing the collar and original skinning indices',()=>{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,.2,0,.1,.2,0,0,.3,0, 0,-.2,0,.1,-.2,0,0,.05,0],3));geometry.setIndex([0,1,2,3,4,5]);
 const proxy=createNeckCollisionProxy(geometry);
 assert.deepEqual(proxy.sourceIndices,[3,4,5]);assert.equal(proxy.geometry.index.count,3);
 assert.equal(proxy.geometry.attributes.position.getY(2),Math.fround(.05));
});
