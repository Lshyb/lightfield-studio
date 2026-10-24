import test from 'node:test';
import assert from 'node:assert/strict';
import {hairCuts,fitHairPoint} from '../dist/hair-cuts.js';
import {hairPreviews} from '../dist/hair-previews.js';
import fs from 'node:fs';
import crypto from 'node:crypto';

test('male and female catalogs use distinct hair silhouettes and preserve roots',()=>{
 for(const subject of ['male','female'])for(const [style,cut] of Object.entries(hairCuts[subject])){
   if(style==='none')continue;
   assert.deepEqual(fitHairPoint(.1,-.15,-.12,0,cut.cut),[.1,-.15,-.12]);
   const point=fitHairPoint(.1,-.4,-.12,1,cut.cut);
   assert.ok(point.every(Number.isFinite));assert.equal(point[0],.1);assert.equal(point[2],-.12);
 }
 assert.notEqual(hairCuts.female.short.source,hairCuts.male.short.source);
 assert.ok(fitHairPoint(0,-.4,0,1,hairCuts.female.short.cut)[1] > fitHairPoint(0,-.4,0,1,hairCuts.female.bob.cut)[1]+.2);
 assert.ok(fitHairPoint(0,-.4,0,1,hairCuts.male.curly.cut)[1] > fitHairPoint(0,-.4,0,1,hairCuts.female.curly.cut)[1]+.2);
});

test('reviewed preview images have valid hashes; female hair cards use live preview without distributing composites',()=>{
 for(const subject of ['male'])assert.equal(new Set(Object.values(hairPreviews[subject]).map(path=>path.split('.').at(-2))).size,4,'every haircut needs a different actual render');
 for(const subject of ['male','female'])for(const style of Object.keys(hairCuts[subject])){
   const path=hairPreviews[subject][style];if(!path){assert.equal(subject,'female');assert.notEqual(style,'none');continue;}assert.ok(path.startsWith(`./assets/previews/${subject}-${style}.`));
   const bytes=fs.readFileSync(new URL('../dist/'+path.slice(2),import.meta.url));
   assert.equal(bytes[0],255);assert.equal(bytes[1],216);
   assert.equal(bytes.at(-2),255);assert.equal(bytes.at(-1),217,'preview must contain the complete JPEG, including its end marker');
   const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);assert.ok(path.endsWith(`.${hash}.jpg`));
   assert.notEqual(path.split('.').at(-2),(hairPreviews[subject==='male'?'female':'male'][style]||'unpictured').split('.').at(-2));
 }
});
