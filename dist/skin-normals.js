import * as THREE from './vendor/three.module.js';

// LBS position derivatives contain the spatial derivatives of the weights.
// Transforming normals by the weighted rotations alone misses that term.
// Gradients are baked once; only the cervical blend region updates on a pose.
export function createSkinNormalUpdater(geometry,weightAt){
 const p=geometry.attributes.position,n=geometry.attributes.normal,t=geometry.attributes.tangent,w=geometry.attributes.skinWeight;
 const stats={vertices:0,minJacobian:1,singular:0,worstVertex:{index:-1,position:[0,0,0]}};
 if(!n)return {update(){return stats;},stats};
 const ids=[],gradients=[],normals=[],tangents=[],epsilon=.00025;
 for(let i=0;i<p.count;i++){
  if(Math.max(...w.array.subarray(i*4,i*4+3))>1-1e-7)continue;
  const point=[p.getX(i),p.getY(i),p.getZ(i)];ids.push(i);normals.push(n.getX(i),n.getY(i),n.getZ(i));
  if(t)tangents.push(t.getX(i),t.getY(i),t.getZ(i));
  for(let c=0;c<3;c++){const a=point.slice(),b=point.slice();a[c]+=epsilon;b[c]-=epsilon;const hi=weightAt(...a),lo=weightAt(...b);for(let bone=0;bone<3;bone++)gradients.push((hi[bone]-lo[bone])/(2*epsilon));}
 }
 const gradient=new Float32Array(gradients),sourceNormals=new Float32Array(normals),sourceTangents=new Float32Array(tangents);
 const S=new THREE.Matrix3(),J=new THREE.Matrix3(),inverseS=new THREE.Matrix3(),normalMatrix=new THREE.Matrix3(),q=new Float64Array(9),v=new THREE.Vector3();
 stats.vertices=ids.length;n.setUsage(THREE.DynamicDrawUsage);if(t)t.setUsage(THREE.DynamicDrawUsage);
 return {stats,update(matrices){
  stats.minJacobian=1;stats.singular=0;
  for(let k=0;k<ids.length;k++){
   const i=ids[k],x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=S.elements,j=J.elements;s.fill(0);
   for(let bone=0;bone<3;bone++){const m=matrices[bone].elements,weight=w.array[i*4+bone];
    for(let c=0;c<3;c++)for(let r=0;r<3;r++)s[c*3+r]+=weight*m[c*4+r];
    q[bone*3]=m[0]*x+m[4]*y+m[8]*z+m[12];q[bone*3+1]=m[1]*x+m[5]*y+m[9]*z+m[13];q[bone*3+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
   for(let c=0;c<3;c++)for(let r=0;r<3;r++){let value=s[c*3+r];for(let bone=0;bone<3;bone++)value+=q[bone*3+r]*gradient[k*9+c*3+bone];j[c*3+r]=value;}
   const determinant=J.determinant();if(determinant<stats.minJacobian){stats.minJacobian=determinant;stats.worstVertex.index=i;stats.worstVertex.position[0]=x;stats.worstVertex.position[1]=y;stats.worstVertex.position[2]=z;}
   if(Math.abs(determinant)<1e-7||Math.abs(S.determinant())<1e-7){stats.singular++;continue;}
   inverseS.copy(S).invert();normalMatrix.copy(J).invert().transpose();
   v.fromArray(sourceNormals,k*3).applyMatrix3(normalMatrix).normalize().applyMatrix3(inverseS).normalize();n.setXYZ(i,v.x,v.y,v.z);
   if(t){v.fromArray(sourceTangents,k*3).applyMatrix3(J).normalize().applyMatrix3(inverseS).normalize();t.setXYZ(i,v.x,v.y,v.z);}
  }
  if(ids.length){n.needsUpdate=true;if(t)t.needsUpdate=true;}return stats;
 }};
}
