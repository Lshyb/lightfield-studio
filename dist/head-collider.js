import * as THREE from './vendor/three.module.js';

export function decodeHeadCollider(buffer) {
  if (buffer.byteLength < 48) throw new Error('头部碰撞数据不完整');
  const view = new DataView(buffer);
  if (view.getUint32(0,true)!==0x44534648 || view.getUint32(4,true)!==1) throw new Error('头部碰撞数据格式错误');
  const dimensions=[8,12,16].map(i=>view.getUint32(i,true));
  const low=[20,24,28].map(i=>view.getFloat32(i,true));
  const high=[32,36,40].map(i=>view.getFloat32(i,true)), range=view.getFloat32(44,true);
  if (dimensions.some(n=>n<2||n>192) || dimensions.reduce((a,b)=>a*b,4)+48!==buffer.byteLength || !low.every((n,i)=>Number.isFinite(n)&&high[i]>n) || !(range>0&&range<.2)) throw new Error('头部碰撞数据范围错误');
  return {dimensions,low,high,range,data:new Uint8Array(buffer,48)};
}
export async function loadHeadCollider(subject) {
  const response=await fetch(new URL(`./assets/hair/${subject}-head.sdf`,import.meta.url));
  if(!response.ok) throw new Error('头部碰撞文件未找到');
  const collider=decodeHeadCollider(await response.arrayBuffer());
  const texture=new THREE.Data3DTexture(collider.data,...collider.dimensions);
  texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;
  return {...collider,texture};
}

// Mirrors trilinear GPU sampling for the offline geometry audit.
export function sampleHeadCollider(collider,p) {
  const {dimensions:d,low,high,data}=collider,coords=p.map((v,k)=>Math.max(0,Math.min(d[k]-1,(v-low[k])/(high[k]-low[k])*d[k]-.5))),out=[0,0,0,0];
  const base=coords.map(Math.floor),mix=coords.map((v,k)=>v-base[k]);
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++) {
    const a=Math.min(d[0]-1,base[0]+x),b=Math.min(d[1]-1,base[1]+y),c=Math.min(d[2]-1,base[2]+z),i=((c*d[1]+b)*d[0]+a)*4;
    const weight=(x?mix[0]:1-mix[0])*(y?mix[1]:1-mix[1])*(z?mix[2]:1-mix[2]);
    for(let k=0;k<4;k++)out[k]+=data[i+k]/255*weight;
  }
  const n=out.slice(0,3).map(v=>v*2-1),length=Math.hypot(...n)||1;
  return {normal:n.map(v=>v/length),distance:(out[3]*2-1)*collider.range};
}
