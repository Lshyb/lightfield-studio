import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {auditGeometry,properIntersection} from '../dist/mesh-diagnostics.js';
import {readPortrait} from '../tools/read-portrait.mjs';
import {createNeckRig,neckWeights} from '../dist/neck.js';
import {createCollisionProfile} from '../dist/hair-motion.js';
import {poseGeometry} from '../tools/posed-geometry.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('geometry diagnostics distinguish UV seams, crop holes and proper crossings',()=>{
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0, 0,0,0,0,1,0,-1,0,0],3));
 const r=auditGeometry(g,{region:()=>true});assert.equal(r.weldedVertices,4);assert.equal(r.boundaryEdges,4);assert.equal(r.nonManifoldEdges,0);assert.equal(r.properIntersections,0);
 assert.equal(properIntersection([[0,0,0],[1,0,0],[0,1,0]],[[.2,.2,-1],[.2,.2,1],[.8,.2,0]]),true);
 g.attributes.position.setXYZ(0,NaN,0,0);assert.equal(auditGeometry(g,{intersections:false}).nonFiniteVertices,1);
});
for(const subject of ['male','female'])test(`${subject}: neck, shoulder and base are connected through difficult poses`,async()=>{
 const {geometry}=await readPortrait(new URL(`../dist/assets/${subject}-portrait.glb`,import.meta.url)),rig=createNeckRig(geometry,new THREE.MeshBasicMaterial(),{subject}),rest=geometry.attributes.position;
 for(const pose of [[0,0,0],[60,15,15],[-60,-15,-15],[35,-15,15]]){
  rig.setPose(...pose);const posed=poseGeometry(geometry,rig),p=posed.attributes.position,point=new THREE.Vector3();
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(rest,i);rig.mesh.applyBoneTransform(i,point);p.setXYZ(i,point.x,point.y,point.z);
   if(Math.abs(rest.getX(i))>.30&&rest.getY(i)<-.12)assert.ok(point.distanceTo(new THREE.Vector3().fromBufferAttribute(rest,i))<1e-6);}
  const r=auditGeometry(posed,{region:(_p,i)=>rest.getY(i)<-.04});
  for(const key of ['nonFiniteVertices','invalidNormals','degenerateTriangles','duplicateFaces','openRegionEdges','nonManifoldEdges','properIntersections','regionNormalDisagreements'])assert.equal(r[key],0,`${key} in ${pose}`);
  assert.ok(rig.normalDiagnostics.minJacobian>.05,'local deformation must retain its orientation');
  posed.dispose();
 }
 geometry.dispose();rig.mesh.geometry.dispose();
});
test('posterior thorax stays fixed while the jaw is rigidly attached to the skull',()=>{
 for(const s of ['male','female']){
  assert.deepEqual(neckWeights(.34,-.15,-.21,s),[1,0,0,0]);
  assert.deepEqual(neckWeights(.06,.05,.19,s),[0,0,1,0]);
  for(let y=-.37;y<.46;y+=.03)for(let x=-.5;x<.5;x+=.07)for(let z=-.35;z<.26;z+=.06){const w=neckWeights(x,y,z,s);assert.ok(w.every(Number.isFinite));assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-8);}
 }
});
test('collision updates reuse their texture and typed buffer',()=>{
 const g=new THREE.BoxGeometry(.3,.5,.2),a=createCollisionProfile(g,24),texture=a.texture,data=a.data;
 const b=createCollisionProfile(g,24,(_i,p)=>{p.y+=.02;},a);assert.equal(b.texture,texture);assert.equal(b.data,data);assert.ok(Math.abs(b.low-a.low-.02)<1e-7);texture.dispose();g.dispose();
});
test('the original facial feature geometry is unchanged and normal corrections cache equal poses',async()=>{
 const reference=JSON.parse(await readFile(new URL('../tools/portrait-reference.json',import.meta.url),'utf8'));
 for(const subject of ['male','female']){
  const {geometry}=await readPortrait(new URL(`../dist/assets/${subject}-portrait.glb`,import.meta.url)),p=geometry.attributes.position,points=new Set();
  for(let i=0;i<p.count;i++)if(p.getZ(i)>.08&&p.getY(i)>-.13)points.add([p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(6)).join(','));
  assert.equal(points.size,reference[subject].points);
  assert.equal(createHash('sha256').update([...points].sort().join('\n')).digest('hex'),reference[subject].sha256);
  const rig=createNeckRig(geometry,new THREE.MeshBasicMaterial(),{subject});rig.setPose(60,15,15);
  const version=rig.mesh.geometry.attributes.normal.version;rig.setPose(60,15,15);assert.equal(rig.mesh.geometry.attributes.normal.version,version);
  assert.ok(rig.normalDiagnostics.vertices>0);assert.equal(rig.normalDiagnostics.singular,0);assert.ok(rig.normalDiagnostics.minJacobian>.05);
 }
});
