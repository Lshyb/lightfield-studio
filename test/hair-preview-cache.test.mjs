import test from 'node:test';
import assert from 'node:assert/strict';
import {localHairPreviewCache,PREVIEW_KEY}from '../dist/hair-preview-cache.js';
test('local portrait cache survives reload but rejects corrupt or unexpected entries',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 let c=localHairPreviewCache(storage);assert.equal(c.missing().length,4);
 c.save('short','data:image/jpeg;base64,/9j/2Q==');
 c=localHairPreviewCache(storage);assert.equal(c.missing().length,3);assert.ok(c.get('short'));
 memory.set(PREVIEW_KEY,JSON.stringify({short:'https://example.invalid/private.jpg',curly:12,unknown:'data:image/jpeg;base64,/9j/2Q=='}));
 assert.equal(localHairPreviewCache(storage).missing().length,4);
 assert.throws(()=>c.save('unknown','data:image/jpeg;base64,/9j/2Q=='));
});
test('blocked or full storage preserves in-memory photos and never needs a network fallback',()=>{
 const storage={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
 const c=localHairPreviewCache(storage);c.save('bob','data:image/jpeg;base64,/9j/2Q==');assert.ok(c.get('bob'));
 assert.equal(c.missing().length,3);
});
