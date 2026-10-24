import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural scalp shells and solid locks. All parts participate in shadow maps.
export function createHair(headGeometry) {
  const root = new THREE.Group(), styles = {};
  const textureCanvas = document.createElement('canvas'); textureCanvas.width = 128; textureCanvas.height = 256;
  const textureContext = textureCanvas.getContext('2d'), pixels = textureContext.createImageData(128, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
    const v = Math.round(130 + 55 * Math.sin(x * 2.9 + Math.sin(y * .025) * .65) + 15 * Math.sin(x * 9.1 + y * .2)), i = (y * 128 + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v; pixels.data[i + 3] = 255;
  }
  textureContext.putImageData(pixels, 0, 0);
  const strandTexture = new THREE.CanvasTexture(textureCanvas); strandTexture.wrapS = strandTexture.wrapT = THREE.RepeatWrapping; strandTexture.repeat.set(5, 3);
  const material = new THREE.MeshStandardMaterial({ color: '#21170f', roughness: .8, metalness: 0, bumpMap: strandTexture, bumpScale: .0015 });
  const pos = headGeometry.attributes.position, normal = headGeometry.attributes.normal;
  const hairline = p => .12 + .14 * Math.max(0, p.z / .25) - .17 * Math.max(0, -p.z / .25);
  const above = i => { const p = new THREE.Vector3().fromBufferAttribute(pos, i); return p.y > hairline(p); };
  const faces = [], eligible = new Set();
  const indices = headGeometry.index;
  for (let i = 0; i < indices.count; i += 3) {
    const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    if (triangle.every(above)) { faces.push(...triangle); triangle.forEach(n => eligible.add(n)); }
  }
  const candidates = [...eligible];
  function mesh(geometry, parent) {
    const m = new THREE.Mesh(geometry, material); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function cap(offset, parent) {
    const g = headGeometry.clone(); g.setIndex(faces);
    const p = g.attributes.position;
    for (const i of candidates) {
      const n = new THREE.Vector3().fromBufferAttribute(normal, i), v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const variation = 1 + .12 * Math.sin(v.x * 140 + v.y * 80) * Math.cos(v.z * 120);
      v.addScaledVector(n, offset * variation); p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true; g.computeVertexNormals(); mesh(g, parent);
  }
  let seed = 19;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function makeStyle(id) { const group = new THREE.Group(); group.visible = false; root.add(group); styles[id] = group; return group; }
  function tubes(curves, parent) {
    const geometries = curves.map(([points, radius]) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(5, points.length * 2), radius, 4, false));
    if (!geometries.length) return;
    const merged = mergeGeometries(geometries, false); mesh(merged, parent); geometries.forEach(g => g.dispose());
  }
  const short = makeStyle('short'); cap(.009, short);
  const shortCurves = [];
  for (let i = 0; i < 380; i++) {
    const index = candidates[Math.floor(random() * candidates.length)], p = new THREE.Vector3().fromBufferAttribute(pos, index), n = new THREE.Vector3().fromBufferAttribute(normal, index);
    p.addScaledVector(n, .008);
    const tip = p.clone().addScaledVector(n, .004 + random() * .007).add(new THREE.Vector3(.004, .002, -.006));
    shortCurves.push([[p, p.clone().lerp(tip, .6).add(new THREE.Vector3(.002, .002, 0)), tip], .0012 + random() * .001]);
  }
  tubes(shortCurves, short);
  const bob = makeStyle('bob'); cap(.017, bob);
  const bobCurves = [];
  for (let i = 0; i < 110; i++) {
    const angle = THREE.MathUtils.degToRad(53 + i / 109 * 254), sin = Math.sin(angle), cos = Math.cos(angle), jitter = (random() - .5) * .018;
    const points = [
      new THREE.Vector3(sin * .128, .365, cos * .144 - .025),
      new THREE.Vector3(sin * (.183 + jitter), .23, cos * .215 - .025),
      new THREE.Vector3(sin * (.211 + jitter), .01, cos * .24 - .025),
      new THREE.Vector3(sin * (.205 + jitter), -.235 - random() * .06, cos * .231 - .025),
      new THREE.Vector3(sin * .19, -.285 - random() * .025, cos * .21 - .025)
    ];
    bobCurves.push([points, .012 + random() * .005]);
  }
  tubes(bobCurves, bob);
  const curls = makeStyle('curly'); cap(.027, curls);
  const curlCurves = [];
  for (let i = 0; i < 240; i++) {
    const index = candidates[Math.floor(random() * candidates.length)], p = new THREE.Vector3().fromBufferAttribute(pos, index), n = new THREE.Vector3().fromBufferAttribute(normal, index);
    p.addScaledVector(n, .025);
    const tangent = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 0, 1));
    if (tangent.lengthSq() < .01) tangent.set(1, 0, 0); tangent.normalize();
    const bitangent = new THREE.Vector3().crossVectors(n, tangent).normalize(), radius = .011 + random() * .009, points = [];
    for (let j = 0; j <= 12; j++) {
      const a = j / 12 * Math.PI * (2.5 + random() * .25);
      points.push(p.clone().addScaledVector(tangent, Math.sin(a) * radius).addScaledVector(bitangent, Math.cos(a) * radius).addScaledVector(n, .008 + j / 12 * .027));
    }
    curlCurves.push([points, .005 + random() * .003]);
  }
  tubes(curlCurves, curls);
  return {
    root,
    update(hair) {
      root.visible = hair.style !== 'none';
      for (const [id, group] of Object.entries(styles)) group.visible = id === hair.style;
      material.color.set(hair.color === 'light' ? '#b98b4e' : '#21170f');
      material.roughness = hair.color === 'light' ? .82 : .76;
    }
  };
}
