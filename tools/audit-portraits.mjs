import {writeFile,mkdir} from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import {readPortrait} from './read-portrait.mjs';
import {auditGeometry} from '../dist/mesh-diagnostics.js';
import {createNeckRig} from '../dist/neck.js';
import {poseGeometry} from './posed-geometry.mjs';
const poses=[...[-60,0,60].flatMap(y=>[-15,0,15].flatMap(p=>[-15,0,15].map(r=>[y,p,r]))),[35,-15,15],[-35,15,-15]];
const out=new URL('../diagnostics-results/',import.meta.url);await mkdir(out,{recursive:true});const report={};
for(const subject of ['male','female']){
 const {geometry}=await readPortrait(new URL(`../dist/assets/${subject}-portrait.glb`,import.meta.url)),rig=createNeckRig(geometry,new THREE.MeshBasicMaterial(),{subject}),rest=geometry.attributes.position,results=[];
 for(const pose of poses){rig.setPose(...pose);const posed=poseGeometry(geometry,rig),p=posed.attributes.position,v=new THREE.Vector3();let maxShoulderDisplacement=0;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);
   if(Math.abs(rest.getX(i))>.30&&rest.getY(i)<-.12)maxShoulderDisplacement=Math.max(maxShoulderDisplacement,v.distanceTo(new THREE.Vector3().fromBufferAttribute(rest,i)));}
  const a=auditGeometry(posed,{region:(_p,i)=>rest.getY(i)<-.04});results.push({pose,maxShoulderDisplacement,normalDeformation:structuredClone(rig.normalDiagnostics),...a});console.log(subject,pose.join(','),'intersections',a.properIntersections,'shoulder',maxShoulderDisplacement.toFixed(6),'normal',a.normalDisagreements,'J',rig.normalDiagnostics.minJacobian.toFixed(4));posed.dispose();
 }
 report[subject]=results;geometry.dispose();rig.mesh.geometry.dispose();}
await writeFile(new URL('portraits.json',out),JSON.stringify(report,null,2));
if(Object.values(report).flat().some(r=>r.nonFiniteVertices||r.degenerateTriangles||r.duplicateFaces||r.nonManifoldEdges||r.openRegionEdges||r.properIntersections||r.regionNormalDisagreements||r.normalDeformation.minJacobian<=.05||r.normalDeformation.singular||r.maxShoulderDisplacement>1e-6))process.exitCode=1;
