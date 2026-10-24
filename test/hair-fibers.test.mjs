import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeFibers, fiberGeometry } from '../dist/hair-fibers.js';

test('all three converted grooms contain finite fitted fibers with matching mesh topology', async () => {
  for (const id of ['short', 'bob', 'curly']) {
    const file = await readFile(new URL(`../dist/assets/hair/${id}.bin`, import.meta.url));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const fibers = decodeFibers(buffer);
    assert.ok(fibers.curves >= 10000);
    assert.ok(fibers.positions.every(Number.isFinite));
    assert.ok(fibers.radii.every(r => r > 0 && r < .002));
    const geometry = fiberGeometry(fibers);
    assert.equal(geometry.attributes.position.count, fibers.points * 3);
    assert.equal(geometry.index.count, (fibers.points - fibers.curves) * 18);
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
    assert.ok(geometry.boundingSphere.radius < 1);
    geometry.dispose();
  }
});

test('fiber decoder rejects truncated and invalid headers before allocation', () => {
  assert.throws(() => decodeFibers(new ArrayBuffer(8)), /格式/);
  assert.throws(() => decodeFibers(new ArrayBuffer(20)), /格式/);
  const buffer = new ArrayBuffer(20), data = new DataView(buffer);
  data.setUint32(0, 0x52424648, true); data.setUint32(4, 1, true);
  data.setUint32(8, 1000000, true); data.setUint32(12, 30000000, true);
  assert.throws(() => decodeFibers(buffer), /长度/);
});
