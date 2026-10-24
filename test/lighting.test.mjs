import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clone, defaults, recipes, recipeSetup, validateSetup, setRatio, lightRatio, histogram } from '../dist/lighting.js';

test('every recipe is valid and independent, including light below the face', () => {
  assert.equal(Object.keys(recipes).length, 11);
  for (const id of Object.keys(recipes)) {
    const setup = recipeSetup(id);
    assert.deepEqual(validateSetup(setup), setup, id);
    setup.lights.key.power = 0;
    assert.ok(defaults.lights.key.power > 0);
  }
  assert.ok(recipeSetup('clamshell').lights.fill.elevation < 0);
  assert.equal(recipeSetup('broad').headYaw, recipeSetup('short').headYaw);
  assert.notEqual(recipeSetup('broad').lights.key.azimuth, recipeSetup('short').lights.key.azimuth);
  assert.equal(recipeSetup('lowkey').environment.ambient, 0);
});
test('v1 JSON migrates with new defaults and malformed values are rejected', () => {
  const old = clone(defaults); old.version = 1;
  for (const key of ['environment', 'framing', 'headPitch', 'headRoll', 'solo', 'hair']) delete old[key];
  assert.deepEqual(validateSetup(old), defaults);
  for (const value of [NaN, Infinity, -21, 76]) {
    const bad = clone(defaults); bad.lights.fill.elevation = value;
    assert.throws(() => validateSetup(bad));
  }
  const bad = clone(defaults); bad.framing.shiftX = 31;
  assert.throws(() => validateSetup(bad));
  bad.framing.shiftX = 0; bad.environment.ambient = '10';
  assert.throws(() => validateSetup(bad));
});
test('hair survives lighting recipe changes and JSON round trips', () => {
  const input = recipeSetup('loop'); input.hair = { style:'curly', color:'light' };
  const changed = recipeSetup('rim', input);
  assert.deepEqual(changed.hair, input.hair);
  assert.deepEqual(validateSetup(JSON.parse(JSON.stringify(changed))).hair, input.hair);
  const bad = clone(changed); bad.hair.style = 'unknown'; assert.throws(() => validateSetup(bad));
});
test('incident-ratio buttons compensate for unequal distances and bounded power', () => {
  for (const keyDistance of [.8, 2, 4]) for (const fillDistance of [.8, 2.6, 4]) for (const ratio of [1, 2, 4, 8]) {
    const input = clone(defaults); input.lights.key.distance = keyDistance; input.lights.fill.distance = fillDistance;
    const output = setRatio(input, ratio);
    assert.ok(Math.abs(lightRatio(output.lights).ratio - ratio) < 1e-10);
    assert.ok(output.lights.key.power <= 100 && output.lights.fill.power <= 100);
    assert.equal(input.lights.fill.enabled, false);
    assert.doesNotThrow(() => validateSetup(output));
  }
  assert.equal(lightRatio(defaults.lights), null);
});
test('histogram counts black, white, midpoint and empty pixels correctly', () => {
  const result = histogram(new Uint8ClampedArray([0,0,0,255, 255,255,255,255, 128,128,128,255, 128,128,128,255]));
  assert.equal(result.shadows, 25); assert.equal(result.highlights, 25);
  assert.equal(result.bins.reduce((a, b) => a + b), 4);
  assert.equal(histogram(new Uint8Array()).shadows, 0);
});
