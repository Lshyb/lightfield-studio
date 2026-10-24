import * as THREE from '../dist/vendor/three.module.js';
// Match the actual Three.js skinning path, including its normal transform.
export function poseGeometry(geometry,rig){
 const posed=geometry.clone(),p=posed.attributes.position,n=posed.attributes.normal;
 const indices=rig.mesh.geometry.attributes.skinIndex,weights=rig.mesh.geometry.attributes.skinWeight;
 const matrices=rig.mesh.skeleton.bones.map((bone,i)=>new THREE.Matrix4().copy(rig.mesh.bindMatrixInverse).multiply(bone.matrixWorld).multiply(rig.mesh.skeleton.boneInverses[i]).multiply(rig.mesh.bindMatrix));
 const directions=matrices.map(m=>new THREE.Matrix3().setFromMatrix4(m));
 const v=new THREE.Vector3(),sum=new THREE.Vector3(),direction=new THREE.Vector3();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(geometry.attributes.position,i);rig.mesh.applyBoneTransform(i,v);p.setXYZ(i,v.x,v.y,v.z);
  if(n){sum.set(0,0,0);for(let k=0;k<4;k++){const w=weights.array[i*4+k];if(w){direction.fromBufferAttribute(rig.mesh.geometry.attributes.normal,i).applyMatrix3(directions[indices.array[i*4+k]]);sum.addScaledVector(direction,w);}}sum.normalize();n.setXYZ(i,sum.x,sum.y,sum.z);}
 }
 return posed;
}
