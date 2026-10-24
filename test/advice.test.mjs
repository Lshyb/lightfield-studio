import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAdvice } from '../dist/advice.js';
import { recipeSetup } from '../dist/lighting.js';
test('advice changes with requirements, live settings and explicit concerns', () => {
  const setup = recipeSetup('rembrandt');
  assert.notEqual(evaluateAdvice(setup,'lowkey').title, evaluateAdvice(setup,'highkey').title);
  setup.environment.ambient = 20;
  assert.match(evaluateAdvice(setup,'lowkey').title, /环境光/);
  setup.environment.ambient = 0;
  assert.doesNotMatch(evaluateAdvice(setup,'lowkey').title, /收住环境光/);
  setup.lights.key.size = 20;
  assert.match(evaluateAdvice(setup,'soft').title, /光源/);
  setup.lights.key.size = 120;
  assert.match(evaluateAdvice(setup,'soft').title, /相对较大/);
  setup.lights.key.elevation = 65;
  assert.match(evaluateAdvice(setup,'soft','eyes').title, /降低主光高度/);
  setup.environment.exposureEV = 2;
  assert.match(evaluateAdvice(setup,'soft','detail').title, /曝光/);
});
test('disabled solo and absence of lights take priority over goals', () => {
  const setup = recipeSetup('loop'); setup.solo='rim';
  assert.match(evaluateAdvice(setup,'highkey').title, /没有发光/);
  setup.solo='none'; for(const l of Object.values(setup.lights)) l.enabled=false;
  assert.match(evaluateAdvice(setup,'soft').title, /没有有效/);
});
