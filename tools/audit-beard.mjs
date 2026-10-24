import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import {createNeckRig} from '../dist/neck.js';
import {decodeBeard} from '../dist/beard.js';
const root=new URL('../dist/assets/',import.meta.url);
const b=await readFile(new URL('hair/male-collision.bin',root)),array=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),header=new DataView(array),count=header.getUint32(8,true),indexCount=header.getUint32(12,true);
const skin=new THREE.BufferGeometry();skin.setAttribute('position',new THREE.BufferAttribute(new Float32Array(array,16,count*3),3));skin.setIndex(new THREE.BufferAttribute(new Uint32Array(array,16+count*36,indexCount),1));
const file=await readFile(new URL('male-beard.bin',root)),{fibers}=decodeBeard(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength));
const samplePositions=[],sampleRoots=[];
for(let c=0;c<fibers.curves;c+=3){const start=fibers.offsets[c],end=fibers.offsets[c+1];for(let p=start;p<end;p++){samplePositions.push(...fibers.positions.subarray(p*3,p*3+3));sampleRoots.push(...fibers.positions.subarray(start*3,start*3+3));}}
const beard=new THREE.BufferGeometry();beard.setAttribute('position',new THREE.Float32BufferAttribute(samplePositions,3));beard.setAttribute('_beard_root',new THREE.Float32BufferAttribute(sampleRoots,3));const rig=createNeckRig(skin,new THREE.MeshBasicMaterial()),surface=rig.attachSurface(beard,new THREE.MeshBasicMaterial(),{rootAttribute:'_beard_root'});
const source=skin.attributes.position,idx=skin.index.array;let rayCandidates=0,rayFalsePositives=0;
function posedGrid(){
 const vertices=Array.from({length:source.count},(_,i)=>{const p=new THREE.Vector3().fromBufferAttribute(source,i);return rig.mesh.applyBoneTransform(i,p);});const cells=new Map(),cell=.025;
 for(let t=0;t<idx.length;t+=3){const a=vertices[idx[t]],b=vertices[idx[t+1]],c=vertices[idx[t+2]];for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/cell);x++)for(let y=Math.floor(Math.min(a.y,b.y,c.y)/cell);y<=Math.floor(Math.max(a.y,b.y,c.y)/cell);y++){const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([a,b,c]);}}
 return p=>{const triangles=cells.get(Math.floor(p.x/cell)+','+Math.floor(p.y/cell))||[],hits=[];for(const[a,b,c]of triangles){const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(det)<1e-10)continue;const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/det,v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/det;if(u>=0&&v>=0&&u+v<=1)hits.push(u*a.z+v*b.z+(1-u-v)*c.z);}hits.sort((a,b)=>a-b);const unique=hits.filter((z,i)=>!i||z-hits[i-1]>.00001);if(!unique.length||p.z<=unique[0]||p.z>=unique.at(-1))return false;let inside=false;for(const z of unique)if(z<p.z)inside=!inside;if(!inside||Math.min(...unique.map(z=>Math.abs(z-p.z)))<=.001)return false;
 // Cropped eye/ear apertures can make ray parity ambiguous. Confirm every
 // candidate with the nearest actual triangle and its outward winding.
 rayCandidates++;const tri=new THREE.Triangle(),near=new THREE.Vector3(),normal=new THREE.Vector3();let minimum=Infinity,signed=0;
 for(let t=0;t<idx.length;t+=3){tri.set(vertices[idx[t]],vertices[idx[t+1]],vertices[idx[t+2]]);tri.closestPointToPoint(p,near);const distance=near.distanceTo(p);if(distance<minimum){minimum=distance;tri.getNormal(normal);signed=p.clone().sub(near).dot(normal);}}
 if(signed>=-.001){rayFalsePositives++;return false;}return true;};
}
const poses=[-60,0,60].flatMap(y=>[-15,0,15].flatMap(p=>[-15,0,15].map(r=>[y,p,r]))),results=[];
for(const pose of poses){rig.setPose(...pose);const inside=posedGrid();let penetrations=0;const examples=[];for(let i=0;i<beard.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(beard.attributes.position,i);surface.applyBoneTransform(i,p);if(inside(p)){penetrations++;if(examples.length<8)examples.push({posed:p.toArray(),index:i,neutral:new THREE.Vector3().fromBufferAttribute(beard.attributes.position,i).toArray(),root:new THREE.Vector3().fromBufferAttribute(beard.attributes._beard_root,i).toArray()});}}results.push({pose,checked:beard.attributes.position.count,penetrations,examples});}
const report={checked:results.reduce((n,r)=>n+r.checked,0),penetrations:results.reduce((n,r)=>n+r.penetrations,0),tolerance:.001,strands:fibers.curves,rayCandidates,rayFalsePositives,results};await writeFile(new URL('../diagnostics-results/beard.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined}));


if(report.penetrations)process.exitCode=1;
