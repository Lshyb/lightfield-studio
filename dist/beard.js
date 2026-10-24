import * as THREE from './vendor/three.module.js';
import { decodeFibers, fiberGeometry } from './hair-fibers.js';

export function decodeBeard(buffer) {
  if (buffer.byteLength < 32) throw new Error('胡须文件不完整');
  const header=new DataView(buffer),length=header.getUint32(8,true),count=header.getUint32(12,true);
  if (header.getUint32(0,true)!==0x47424648 || header.getUint32(4,true)!==1 || count>100000 || length%4 || buffer.byteLength!==16+length+count*12) throw new Error('胡须数据格式错误');
  const fibers=decodeFibers(buffer.slice(16,16+length));
  if (fibers.curves!==count) throw new Error('胡须颜色数量错误');
  const colors=new Float32Array(buffer,16+length,count*3);
  if (!colors.every(x=>Number.isFinite(x)&&x>=0&&x<=1)) throw new Error('胡须颜色数据错误');
  return {fibers,colors};
}

export function beardGeometry({fibers,colors}) {
  const geometry=fiberGeometry(fibers),color=geometry.getAttribute('color');
  const roots=new Float32Array(geometry.getAttribute('position').count*3);
  for (let c=0;c<fibers.curves;c++) {
    const first=fibers.offsets[c],end=fibers.offsets[c+1];
    for(let p=first;p<end;p++)for(let side=0;side<3;side++) {
      const v=p*3+side;
      color.setXYZ(v,...colors.subarray(c*3,c*3+3));
      roots.set(fibers.positions.subarray(first*3,first*3+3),v*3);
    }
  }
  // The whole strand follows its follicle's joints, including tips below the jaw.
  geometry.setAttribute('_beard_root',new THREE.BufferAttribute(roots,3));
  return geometry;
}

export async function loadBeard() {
  const response=await fetch(new URL('./assets/male-beard.bin',import.meta.url));
  if(!response.ok)throw new Error('胡须文件未找到');
  const geometry=beardGeometry(decodeBeard(await response.arrayBuffer()));
  const material=new THREE.MeshPhysicalMaterial({name:'Beard',color:0xffffff,vertexColors:true,
    roughness:.55,metalness:0,specularIntensity:.35,anisotropy:.65,
    sheen:.12,sheenRoughness:.65,sheenColor:'#887564'});
  return {geometry,material};
}
