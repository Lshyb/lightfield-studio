import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import { createNeckRig } from '../dist/neck.js';
import { createCollisionProfile, createNeckCollisionProxy, springStep } from '../dist/hair-motion.js';
import { decodeHeadCollider,sampleHeadCollider } from '../dist/head-collider.js';
import { decodeFibers } from '../dist/hair-fibers.js';
import { hairCuts, fitHairPoint } from '../dist/hair-cuts.js';
const root = new URL('../',import.meta.url);
const geometry = new THREE.BufferGeometry();
const subject=process.argv[2] === 'female' ? 'female' : 'male';
{
  const file=await readFile(new URL(`dist/assets/hair/${subject}-collision.bin`,root));
  const buffer=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),header=new DataView(buffer),vertices=header.getUint32(8,true),indices=header.getUint32(12,true);
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,16,vertices*3),3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,16+vertices*36,indices),1));
}
const profile=createCollisionProfile(geometry),rig=createNeckRig(geometry,new THREE.MeshBasicMaterial(),{subject}),hairRoot=new THREE.Group(); rig.attachHair(hairRoot);
const sdfFile=await readFile(new URL(`dist/assets/hair/${subject}-head.sdf`,root)),collider=decodeHeadCollider(sdfFile.buffer.slice(sdfFile.byteOffset,sdfFile.byteOffset+sdfFile.byteLength));
const proxy=createNeckCollisionProxy(geometry);
let posedProfile=profile;
const idx=geometry.index.array, source=geometry.attributes.position;
function section(y, map) {
  const f=Math.min(map.count-1,Math.max(0,(y-map.low)/(map.high-map.low)*(map.count-1))),i=Math.floor(f),t=f-i;
  return [0,1,2,3].map(k=>map.data[i*4+k]*(1-t)+map.data[Math.min(i+1,map.count-1)*4+k]*t);
}
function outside(p,low,high,rear) {
  if(p.y<low||p.y>high)return p;
  const [rx,rz,cx,cz]=section(p.y,rear?posedProfile:profile),qx=(p.x-cx)/rx,qz=(p.z-cz)/rz,d=Math.hypot(qx,qz);
  if(d<1) { if(rear)p.z=cz-rz*Math.sqrt(Math.max(0,1-qx*qx))-.002; else {p.x=cx+(d<.0001?0:qx/d)*rx;p.z=cz+(d<.0001?-1:qz/d)*rz;} }
  return p;
}
const point=new THREE.Vector3(),body=new THREE.Vector3(),axis=new THREE.Vector3(),center=new THREE.Vector3(),q=new THREE.Vector3();
function project(p,toBody,toHair) {
  const a=new THREE.Vector3(0,-.09,-.025).applyMatrix4(toBody),b=new THREE.Vector3(0,-.2,-.045);axis.copy(b).sub(a);
  for(let i=0;i<3;i++) {
    if(p.y>=-.12&&p.toArray().every((v,k)=>v>=collider.low[k]&&v<=collider.high[k])) {
      const contact=sampleHeadCollider(collider,p.toArray());if(contact.distance<-.008)outside(p,-.12,profile.high,false);else if(contact.distance<.0035)p.addScaledVector(new THREE.Vector3(...contact.normal),.0035-contact.distance);
    }
    if(Math.abs(p.x)>.14&&Math.abs(p.z)<.075)outside(p,.075,.245,false);
    body.copy(p).applyMatrix4(toBody);outside(body,posedProfile.low,posedProfile.high,true);
    const t=THREE.MathUtils.clamp(q.copy(body).sub(a).dot(axis)/Math.max(axis.lengthSq(),.000001),0,1);center.copy(a).addScaledVector(axis,t);
    q.copy(body).sub(center).divide(new THREE.Vector3(.158,.16,.20));
    if(q.length()<1)body.z=center.z-.20*Math.sqrt(Math.max(0,1-q.x*q.x-q.y*q.y))-.002;
    p.copy(body).applyMatrix4(toHair);
  }return p;
}
function posedGrid() {
  const vertices=[];
  for(let i=0;i<source.count;i++) { const p=new THREE.Vector3().fromBufferAttribute(source,i);rig.mesh.applyBoneTransform(i,p);vertices.push(p); }
  const cells=new Map(),cell=.025;
  for(let t=0;t<idx.length;t+=3){const a=vertices[idx[t]],b=vertices[idx[t+1]],c=vertices[idx[t+2]];
    for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/cell);x++) for(let y=Math.floor(Math.min(a.y,b.y,c.y)/cell);y<=Math.floor(Math.max(a.y,b.y,c.y)/cell);y++) {
      const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([a,b,c]);
    }
  }
  return p=>{
    const triangles=cells.get(Math.floor(p.x/cell)+','+Math.floor(p.y/cell))||[],hits=[];
    for(const [a,b,c] of triangles){const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(det)<1e-10)continue;
      const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/det,v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/det;
      if(u>=0&&v>=0&&u+v<=1)hits.push(u*a.z+v*b.z+(1-u-v)*c.z);
    }
    hits.sort((a,b)=>a-b);const unique=hits.filter((z,i)=>!i||z-hits[i-1]>.00001);
    // A cropped/open bust can produce an odd number of crossings. A point
    // beyond the foremost or rearmost surface is outside regardless of parity.
    if(!unique.length || p.z<=unique[0] || p.z>=unique.at(-1)) return false;
    let inside=false;for(const z of unique)if(z<p.z)inside=!inside;
    const distance=Math.min(...unique.map(z=>Math.abs(z-p.z)));
    return inside&&distance>.001;
  };
}
const fibers={};for(const id of ['short','bob','curly']){const b=await readFile(new URL(`dist/assets/hair/${id}.bin`,root));fibers[id]=decodeFibers(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const results=[];const sways=process.argv.includes("--motion")?[[.036,0,.012],[-.036,0,-.012],[0,-.036,0],[0,.036,0],[0,0,.036],[0,0,-.036]]:[[.036,0,.012]];
for(const pose of [-60,0,60].flatMap(y=>[-15,0,15].flatMap(p=>[-15,0,15].map(r=>[y,p,r])))) {
  rig.setPose(...pose);const toBody=new THREE.Matrix4().copy(rig.mesh.matrixWorld).invert().multiply(hairRoot.matrixWorld),toHair=toBody.clone().invert(),inside=posedGrid();
  posedProfile=createCollisionProfile(proxy.geometry,96,(i,p)=>rig.mesh.applyBoneTransform(proxy.sourceIndices[i],p));
  for(const [id,cut] of Object.entries(hairCuts[subject])) {
    if(id==='none')continue;
    for(const sway of sways){
    const f=fibers[cut.source];
    let checked=0,penetrations=0;const examples=[];
    for(let c=0;c<f.curves;c+=11){const start=f.offsets[c],end=f.offsets[c+1],distances=[0];let length=0;
      for(let i=start+1;i<end;i++){length+=Math.hypot(...[0,1,2].map(k=>f.positions[i*3+k]-f.positions[(i-1)*3+k]));distances.push(length);}
      for(let i=start;i<end;i+=2) {
      const mobility=Math.pow(distances[i-start]/Math.max(length,.00001),1.8)*Math.min(1.7,length/.42);
      point.fromArray(fitHairPoint(...f.positions.subarray(i*3,i*3+3),mobility,cut.cut));point.x+=sway[0]*mobility;point.y+=sway[1]*mobility;point.z+=sway[2]*mobility;
      project(point,toBody,toHair).applyMatrix4(toBody);checked++;if(inside(point)){penetrations++;if(examples.length<8){const local=point.clone().applyMatrix4(toHair);examples.push({body:point.toArray(),local:local.toArray(),contact:sampleHeadCollider(collider,local.toArray())});}}
    }}
    results.push({pose,style:id,sway,checked,penetrations,examples});
    }
  }
}
const offset=new THREE.Vector3(),velocity=new THREE.Vector3(.19,-.025,.055);let peak=0;
for(let i=0;i<360;i++){springStep(offset,velocity,1/60);peak=Math.max(peak,offset.length());}
const report={subject,checked:results.reduce((n,r)=>n+r.checked,0),penetrations:results.reduce((n,r)=>n+r.penetrations,0),poseCount:27,styles:3,swayCount:sways.length,clearanceTolerance:.001,peakSway:peak,finalSway:offset.length(),results};
await writeFile(new URL(`../diagnostics-results/hair-${subject}${sways.length>1?"-motion":""}.json`,import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined}));

if(report.penetrations)process.exitCode=1;
