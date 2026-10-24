import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeBeard,beardGeometry} from '../dist/beard.js';

test('male portrait contains only a normalized shoulder-line crop with embedded skin and eyes',()=>{
  const file=fs.readFileSync(new URL('../dist/assets/male-portrait.glb',import.meta.url));
  assert.equal(file.toString('ascii',0,4),'glTF');assert.equal(file.readUInt32LE(8),file.length);
  const text=file.toString('utf8',20,20+file.readUInt32LE(12)),gltf=JSON.parse(text);
  assert.ok(!/\b[A-Z]:[\\/]|Users[\\/]|file:|@/i.test(text));
  assert.ok(gltf.images.length>=3&&gltf.images.every(i=>Number.isInteger(i.bufferView)&&!i.uri));
  assert.ok(gltf.buffers.every(b=>!b.uri));
  assert.deepEqual(gltf.materials.map(m=>m.name),['Skin','Eyes']);
  assert.match(gltf.asset.copyright,/BlakkMato; CC BY 4.0/);
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
    const p=gltf.accessors[primitive.attributes.POSITION];
    assert.ok(p.min[1]>=-.371&&p.max[1]<=.466);
    assert.ok(p.min[0]>=-.490&&p.max[0]<=.490,'shoulder closure stays within the deltoid crop; no arms');
  }
});

test('fine beard fibers have complete data, distinct follicle roots and clear lips',()=>{
  const file=fs.readFileSync(new URL('../dist/assets/male-beard.bin',import.meta.url));
  const buffer=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const data=decodeBeard(buffer),{fibers}=data;assert.ok(fibers.curves>=18000);
  assert.ok(fibers.positions.every(Number.isFinite));
  assert.ok(fibers.radii.every(r=>Number.isFinite(r)&&r>0&&r<.001));
  for(let c=0;c<fibers.curves;c++){
    const start=fibers.offsets[c]*3,[x,y,z]=fibers.positions.subarray(start,start+3);
    assert.ok(y>=-.146&&y<=.181,'beard belongs to the lower face');
    assert.ok(z<=.115||(x/.065)**2+((y+.007)/.030)**2>=1.09,'no follicle grows through the lips');
  }
  const geometry=beardGeometry(data),roots=geometry.getAttribute('_beard_root');
  assert.equal(roots.count,geometry.attributes.position.count);
  for(let c=0;c<fibers.curves;c+=113){
    const a=fibers.offsets[c],b=fibers.offsets[c+1]-1;
    for(const p of [a,b])assert.deepEqual([roots.getX(p*3),roots.getY(p*3),roots.getZ(p*3)],Array.from(fibers.positions.subarray(a*3,a*3+3)));
  }
  geometry.dispose();assert.throws(()=>decodeBeard(buffer.slice(0,100)),/格式/);
});
