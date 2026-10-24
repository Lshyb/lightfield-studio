import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudioServer } from '../server.mjs';

test('offline distribution serves HTML, model and modules without relying on cwd', async t => {
  const server = createStudioServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(origin + '/health.json');
  assert.deepEqual(await health.json(), { app:'lightfield-studio', version:'1.1.0', offline:true });
  const home = await fetch(origin);
  assert.equal(home.status, 200); assert.match(await home.text(), /LIGHTFIELD/);
  for(const subject of ['male','female']){
    const model=await fetch(origin + `/assets/${subject}-portrait.glb`);
    assert.equal(model.headers.get('content-type'),'model/gltf-binary');
    const data=Buffer.from(await model.arrayBuffer());
    assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(8),data.length);
  }
  for (const path of ['/app.js','/male.js','/female.js','/portrait.js','/beard.js', '/vendor/three.module.js', '/vendor/loaders/GLTFLoader.js', '/vendor/utils/BufferGeometryUtils.js', '/vendor/controls/OrbitControls.js','/assets/male-beard.bin']) {
    const response = await fetch(origin + path); assert.equal(response.status, 200, path); await response.arrayBuffer();
  }
  const head = await fetch(origin, { method:'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  for (const id of ['short', 'bob', 'curly']) {
    const response = await fetch(origin + `/assets/hair/${id}.bin`);
    assert.equal(response.status, 200);
    const data = Buffer.from(await response.arrayBuffer());
    assert.equal(data.toString('ascii', 0, 4), 'HFBR');
  }
  assert.equal((await fetch(origin + '/missing')).status, 404);
  assert.equal((await fetch(origin, { method:'POST' })).status, 405);
  assert.equal((await fetch(origin + '/%00')).status, 400);
  assert.equal((await fetch(origin + '/..%5cLICENSE')).status, 403);
});
