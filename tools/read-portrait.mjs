import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
export async function readPortrait(path){
 const file=await readFile(path),json=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12))),start=28+file.readUInt32LE(12);
 function attribute(index){const a=json.accessors[index],v=json.bufferViews[a.bufferView],dim={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array},Type=types[a.componentType],size=Type.BYTES_PER_ELEMENT,values=new Type(a.count*dim),stride=v.byteStride||dim*size,view=new DataView(file.buffer,file.byteOffset,file.byteLength),read={5126:'getFloat32',5125:'getUint32',5123:'getUint16'}[a.componentType];
  for(let i=0;i<a.count;i++)for(let k=0;k<dim;k++)values[i*dim+k]=view[read](start+(v.byteOffset||0)+(a.byteOffset||0)+i*stride+k*size,true);return new THREE.BufferAttribute(values,dim);}
 const parents=new Map();json.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
 function world(i){const n=json.nodes[i],m=n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));return parents.has(i)?world(parents.get(i)).multiply(m):m;}
 const ni=json.nodes.findIndex(n=>n.name==='Skin'),node=json.nodes[ni],primitive=json.meshes[node.mesh].primitives[0],geometry=new THREE.BufferGeometry();
 for(const [k,v] of Object.entries(primitive.attributes)){const name={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TANGENT:'tangent'}[k];if(name)geometry.setAttribute(name,attribute(v));}
 geometry.setIndex(attribute(primitive.indices));geometry.applyMatrix4(world(ni));geometry.userData.subject=path.toString().includes('female')?'female':'male';return {geometry,json};
}
