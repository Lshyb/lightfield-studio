import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaults,validateSetup,recipeSetup} from '../dist/lighting.js';

test('female shoulder-line crop keeps embedded skin detail, eyes and lashes without local paths',()=>{
 const file=fs.readFileSync(new URL('../dist/assets/female-portrait.glb',import.meta.url));
 assert.equal(file.toString('ascii',0,4),'glTF');assert.equal(file.readUInt32LE(8),file.length);
 const jsonText=file.toString('utf8',20,20+file.readUInt32LE(12)),gltf=JSON.parse(jsonText);
 assert.ok(gltf.images.length>=2 && gltf.images.every(image=>Number.isInteger(image.bufferView)&&!image.uri));
 assert.ok(gltf.buffers.every(buffer=>!buffer.uri));
 assert.ok(!/\b[A-Z]:[\\/]|Users[\\/]|file:|@/i.test(jsonText));
 const names=gltf.materials.map(material=>material.name);
 assert.deepEqual([...names].sort(),['Eyes','Lashes','Skin','TearLine']);
 assert.ok(gltf.materials.find(m=>m.name==='Skin').normalTexture,'skin relief is embedded in the offline model');
 assert.ok(gltf.materials.find(m=>m.name==='Skin').pbrMetallicRoughness.metallicRoughnessTexture);
 assert.match(gltf.asset.copyright,/patrix; CC BY-NC-SA 4.0/);
 for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
   const a=gltf.accessors[primitive.attributes.POSITION];assert.ok(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite));
   // glTF nodes rotate the Blender-space data to the app axes; the body
   // positions are already Y-up in this export.
   assert.ok(a.min[1]>=-.371&&a.max[1]<=.466,'only the head, neck and shoulder line should be in the asset');
 }
});

test('female identity and hairstyle survive method changes and offline JSON round trips',()=>{
 const setup=validateSetup({...structuredClone(defaults),subject:'female',hair:{style:'curly',color:'light'}});
 const next=recipeSetup('window',setup);
 assert.equal(next.subject,'female');assert.deepEqual(next.hair,setup.hair);
 assert.deepEqual(validateSetup(JSON.parse(JSON.stringify(next))),next);
 assert.throws(()=>validateSetup({...setup,subject:'unexpected'}),/人像模型无效/);
});
