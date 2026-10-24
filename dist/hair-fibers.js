import * as THREE from './vendor/three.module.js';
import { createHairMotion } from './hair-motion.js';
import { hairCuts } from './hair-cuts.js';
import { studioShadows } from './studio-shadows.js';
const geometryCache = new Map();
export {loadGeometry as loadHairGeometry};
function loadGeometry(id) {
  if (!geometryCache.has(id)) geometryCache.set(id, fetch(new URL(`./assets/hair/${id}.bin`,import.meta.url)).then(response=>{
    if (!response.ok) throw new Error('发型文件未找到'); return response.arrayBuffer();
  }).then(buffer=>fiberGeometry(decodeFibers(buffer))).catch(error=>{geometryCache.delete(id);throw error;}));
  return geometryCache.get(id);
}

// Local trial of Daniel Bystedt's Blender Hair Styles (CC BY-SA).
// Each fiber follows sampled, evaluated curves from the original groom.
export function decodeFibers(buffer) {
  if (buffer.byteLength < 20) throw new Error('发丝数据格式错误');
  const header = new DataView(buffer);
  if (header.getUint32(0, true) !== 0x52424648 || header.getUint32(4, true) !== 1) throw new Error('发丝数据格式错误');
  const curves = header.getUint32(8, true), points = header.getUint32(12, true);
  const offsetBytes = (curves + 1) * 4, expected = 16 + offsetBytes + points * 16;
  if (curves > 100000 || points > 3000000 || buffer.byteLength !== expected) throw new Error('发丝数据长度错误');
  const offsets = new Uint32Array(buffer, 16, curves + 1);
  if (offsets[0] !== 0 || offsets[curves] !== points) throw new Error('发丝索引错误');
  for (let c = 0; c < curves; c++) if (offsets[c + 1] - offsets[c] < 2 || offsets[c + 1] > points) throw new Error('发丝索引错误');
  return { curves, points, offsets, positions: new Float32Array(buffer, 16 + offsetBytes, points * 3), radii: new Float32Array(buffer, 16 + offsetBytes + points * 12, points) };
}

export function fiberGeometry(fibers) {
  const { curves, points, offsets, positions: source, radii } = fibers;
  const sides = 3, vertices = points * sides;
  const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3);
  const tangents = new Float32Array(vertices * 4), colors = new Float32Array(vertices * 3);
  const mobility = new Float32Array(vertices);
  const indices = new Uint32Array((points - curves) * sides * 6);
  const p = new THREE.Vector3(), direction = new THREE.Vector3(), side = new THREE.Vector3(), other = new THREE.Vector3(), radial = new THREE.Vector3();
  let index = 0;
  for (let c = 0; c < curves; c++) {
    const start = offsets[c], end = offsets[c + 1], tone = .68 + ((c * 16807) % 997) / 997 * .52;
    let length = 0, traveled = 0;
    for (let i = start + 1; i < end; i++) length += Math.hypot(source[i*3]-source[(i-1)*3],source[i*3+1]-source[(i-1)*3+1],source[i*3+2]-source[(i-1)*3+2]);
    for (let i = start; i < end; i++) {
      if (i > start) traveled += Math.hypot(source[i*3]-source[(i-1)*3],source[i*3+1]-source[(i-1)*3+1],source[i*3+2]-source[(i-1)*3+2]);
      p.fromArray(source, i * 3);
      direction.fromArray(source, Math.min(i + 1, end - 1) * 3).sub(other.fromArray(source, Math.max(start, i - 1) * 3)).normalize();
      side.set(0, 1, 0); if (Math.abs(direction.y) > .92) side.set(1, 0, 0);
      side.cross(direction).normalize(); other.crossVectors(direction, side).normalize();
      const u = (i - start) / (end - start - 1), taper = Math.max(.06, Math.min(1, (1 - u) * 7));
      const radius = radii[i] * .55 * taper;
      for (let s = 0; s < sides; s++) {
        const angle = s / sides * Math.PI * 2, v = i * sides + s;
        mobility[v] = Math.pow(traveled / Math.max(length,.00001),1.8) * Math.min(1.7,length/.42);
        radial.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(other, Math.sin(angle));
        positions[v * 3] = p.x + radial.x * radius; positions[v * 3 + 1] = p.y + radial.y * radius; positions[v * 3 + 2] = p.z + radial.z * radius;
        radial.toArray(normals, v * 3); direction.toArray(tangents, v * 4); tangents[v * 4 + 3] = 1;
        colors[v * 3] = tone; colors[v * 3 + 1] = tone; colors[v * 3 + 2] = tone;
        if (i < end - 1) {
          const a = v, b = i * sides + (s + 1) % sides, d = v + sides, e = b + sides;
          indices[index++] = a; indices[index++] = b; indices[index++] = d;
          indices[index++] = b; indices[index++] = e; indices[index++] = d;
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('tangent', new THREE.BufferAttribute(tangents, 4));
  geometry.setAttribute('fiberMobility', new THREE.BufferAttribute(mobility, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere(); return geometry;
}

export function createHair(headGeometry, onStatus = () => {}, subject = 'male', collider) {
  const root = new THREE.Group(), styles = new Map(), loading = new Map(), errors = new Set();
  const motion = createHairMotion(root, headGeometry, collider);
  let selected = 'none';
  const material = studioShadows.material(motion.shader(new THREE.MeshPhysicalMaterial({ color: '#21140d', roughness: .53, metalness: 0, vertexColors: true, anisotropy: .55, specularIntensity: .5, sheen: .22, sheenRoughness: .6, sheenColor: '#8f7964' })));
  const depthMaterial = motion.shader(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const status = () => onStatus({ style: selected, ready: selected === 'none' || styles.has(selected), loading: loading.has(selected), error: errors.has(selected) });
  const show = () => { root.visible = selected !== 'none'; for (const [id, mesh] of styles) mesh.visible = id === selected; };
  function load(id) {
    loading.set(id, true); status();
    loadGeometry(hairCuts[subject][id].source).then(geometry => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.customDepthMaterial = depthMaterial;
      mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); styles.set(id, mesh); loading.delete(id); show(); status();
    }).catch(error => { console.error('Hair trial:', error); loading.delete(id); errors.add(id); status(); });
  }
  return {
    root,
    step: (time) => motion.step(time, selected),
    setMotion: value => motion.setEnabled(value),
    nudge: () => motion.nudge(),
    isReady() { return selected === 'none' || styles.has(selected); },
    update(hair) {
      selected = hair.style;
      motion.setCut(hairCuts[subject][selected].cut || [0,1]);
      material.color.set(hair.color === 'light' ? '#bc8550' : '#21140d'); material.roughness = hair.color === 'light' ? .55 : .48;
      material.sheenColor.set(hair.color === 'light' ? '#dfbb8a' : '#8f7964');
      show();
      if (selected !== 'none' && !styles.has(selected) && !loading.has(selected) && !errors.has(selected)) load(selected);
    }
  };
}
