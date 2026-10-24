import test from 'node:test';
import assert from 'node:assert/strict';
import { withImageAttribution } from '../dist/image-rights.js';

test('JPEG attribution preserves image bytes and escapes metadata', () => {
  const source = Buffer.from([255,216,255,219,0,4,1,2,255,217]);
  const url = 'data:image/jpeg;base64,' + source.toString('base64');
  const result = Buffer.from(withImageAttribution(url, ['A & B <test> · 署名']).split(',')[1], 'base64');
  assert.deepEqual([...result.subarray(0,4)], [255,216,255,225]);
  const length = result.readUInt16BE(4);
  assert.deepEqual(result.subarray(4+length), source.subarray(2));
  const xmp = result.subarray(6,4+length).toString('utf8');
  assert.ok(xmp.startsWith('http://ns.adobe.com/xap/1.0/\0'));
  assert.ok(xmp.includes('A &amp; B &lt;test&gt; · 署名'));
});

test('empty credits leave images untouched; bad or oversized JPEG data fails safely', () => {
  assert.equal(withImageAttribution('data:image/png;base64,AAAA', ['credit']), 'data:image/png;base64,AAAA');
  assert.equal(withImageAttribution('data:image/jpeg;base64,AAAA', []), 'data:image/jpeg;base64,AAAA');
  assert.throws(() => withImageAttribution('data:image/jpeg;base64,AAAA', ['credit']), /Invalid JPEG/);
  assert.throws(() => withImageAttribution('data:image/jpeg;base64,AAAA', ['a'.repeat(65536)]), /too large/);
});
