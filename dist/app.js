import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clone = value => JSON.parse(JSON.stringify(value));
const radians = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const STORAGE = 'lightfield.setup.v1';
const SHOTS = 'lightfield.shots.v1';
const defaults = {
  version: 1, preset: 'rembrandt', selected: 'key',
  lights: {
    key: { enabled: true, azimuth: -50, elevation: 30, distance: 2, power: 70, size: 60, temperature: 5200 },
    fill: { enabled: false, azimuth: 35, elevation: 10, distance: 2.6, power: 18, size: 100, temperature: 5600 },
    rim: { enabled: false, azimuth: 135, elevation: 25, distance: 2, power: 50, size: 40, temperature: 6000 }
  },
  camera: { focalLength: 85, aperture: 5.6, iso: 100, shutterSpeed: 125 }, headYaw: 0, background: 'charcoal', material: 'skin'
};
const recipes = {
  rembrandt: { name: '伦勃朗光', azimuth: -50, elevation: 30, size: 60, title: '伦勃朗光的秘密，在暗侧。', tip: '让鼻影与脸颊阴影相连，在暗侧眼睛下方留下一小块三角亮区。试着微调灯光角度。' },
  loop: { name: '环形光', azimuth: -28, elevation: 24, size: 65, title: '鼻翼下，一小段温柔的影子。', tip: '将灯移近相机轴线，让鼻影向侧下方延伸，但不与脸颊暗部连接。适合自然、轻盈的人像。' },
  split: { name: '分割光', azimuth: -90, elevation: 12, size: 35, title: '把一半的故事，交给阴影。', tip: '把主光移到人像正侧方，让明暗交界落在面部中央。转动人像，可以继续调整明暗比例。' },
  butterfly: { name: '蝴蝶光', azimuth: 0, elevation: 40, size: 65, title: '鼻下的蝴蝶，来自正上方的光。', tip: '主光位于相机轴线上方，向下照射。观察鼻下是否出现对称的小阴影，留意眼窝不要过暗。' }
};
const palettes = { charcoal: ['#343b35', '#151b18'], olive: ['#535745', '#23291e'], warm: ['#776251', '#352a24'], slate: ['#4b6069', '#1d2c34'] };
const lightMeta = { key: { name: '八角柔光箱', desc: '主光 · KEY LIGHT', color: '#e9bb7b', short: '主光' }, fill: { name: '柔光补光灯', desc: '补光 · FILL LIGHT', color: '#94b7c4', short: '补光' }, rim: { name: '条形轮廓灯', desc: '轮廓光 · RIM LIGHT', color: '#ad9dbd', short: '轮廓' } };
let state = clone(defaults), shots = [], ready = false, view = 'camera', compare = false;
let renderer, scene, photoCamera, orbitCamera, controls, head, skinMaterial, clayMaterial;
let ambient, comparisonLight, backdrop, stageObjects, rigGroup;
let saveTimer, toastTimer, pendingRender = false, lastThumbState = '';
const rigs = {};
const FACE = new THREE.Vector3(0, 1.52, 0);
const host = $('#renderHost');

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

function validateSetup(input) {
  if (!input || typeof input !== 'object' || !input.lights || !input.camera) throw new Error('文件中缺少灯光或相机参数');
  const result = clone(defaults);
  const limits = { azimuth: [-150, 150], elevation: [0, 75], distance: [.8, 4], power: [0, 100], size: [10, 120], temperature: [2800, 8000] };
  for (const id of Object.keys(lightMeta)) {
    const light = input.lights[id];
    if (!light || typeof light.enabled !== 'boolean') throw new Error('灯光参数不完整');
    result.lights[id].enabled = light.enabled;
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (typeof light[key] !== 'number' || !Number.isFinite(light[key]) || light[key] < min || light[key] > max) throw new Error('灯光参数超出支持范围');
      result.lights[id][key] = light[key];
    }
  }
  const options = { focalLength: [50, 85, 105], aperture: [2.8, 4, 5.6, 8, 11], iso: [100, 200, 400, 800], shutterSpeed: [60, 125, 250] };
  for (const [key, values] of Object.entries(options)) {
    if (!values.includes(input.camera[key])) throw new Error('相机参数不受支持');
    result.camera[key] = input.camera[key];
  }
  if (typeof input.headYaw !== 'number' || !Number.isFinite(input.headYaw) || Math.abs(input.headYaw) > 60) throw new Error('人像转向参数无效');
  result.headYaw = input.headYaw;
  if (!palettes[input.background] || !['skin', 'clay'].includes(input.material)) throw new Error('场景参数无效');
  result.background = input.background; result.material = input.material;
  result.preset = recipes[input.preset] ? input.preset : 'custom';
  result.selected = lightMeta[input.selected] ? input.selected : 'key';
  return result;
}

try { const saved = localStorage.getItem(STORAGE); if (saved) state = validateSetup(JSON.parse(saved)); } catch { /* Storage is optional. */ }
try { const saved = JSON.parse(localStorage.getItem(SHOTS) || '[]'); if (Array.isArray(saved)) shots = saved.filter(s => typeof s.image === 'string' && s.image.startsWith('data:image/jpeg;base64,') && s.state).slice(0, 8); } catch { /* Storage is optional. */ }

function persist() {
  clearTimeout(saveTimer);
  $('#saveIndicator').innerHTML = '<i></i> 正在保存…';
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); $('#saveIndicator').innerHTML = '<i></i> 已自动保存'; }
    catch { $('#saveIndicator').textContent = '仅保留本次设置'; }
  }, 400);
}

function rangeStyle(input) { input.style.setProperty('--pct', ((input.value - input.min) / (input.max - input.min) * 100) + '%'); }
function syncUI() {
  const light = state.lights[state.selected], meta = lightMeta[state.selected];
  $$('.light-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.light === state.selected));
  $('#lightName').textContent = meta.name; $('#lightDesc').textContent = meta.desc;
  $('#lightToggle').classList.toggle('on', light.enabled); $('#lightToggle').setAttribute('aria-checked', light.enabled);
  $('#lightToggle').setAttribute('aria-label', `${light.enabled ? '关闭' : '开启'}${meta.short}`);
  $('#lightControls').classList.toggle('disabled', !light.enabled);
  for (const key of ['azimuth', 'elevation', 'distance', 'power', 'size', 'temperature']) {
    const input = $('#' + key); input.value = light[key]; rangeStyle(input);
    $('#' + key + 'Value').textContent = key === 'distance' ? light[key].toFixed(1) : light[key];
  }
  for (const [key, value] of Object.entries(state.camera)) $('#' + key).value = value;
  $('#headYaw').value = state.headYaw; $('#headYawValue').textContent = state.headYaw; rangeStyle($('#headYaw'));
  $('#isoBadge').textContent = state.camera.iso; $('#apertureBadge').textContent = state.camera.aperture;
  $('#shutterBadge').textContent = '1/' + state.camera.shutterSpeed;
  $('#lensBadge').textContent = `${state.camera.focalLength} MM / FULL FRAME`;
  $$('[data-bg]').forEach(b => b.classList.toggle('selected', b.dataset.bg === state.background));
  $$('[data-material]').forEach(b => b.classList.toggle('active', b.dataset.material === state.material));
  $$('[data-preset]').forEach(b => b.classList.toggle('active', b.dataset.preset === state.preset));
  const recipe = recipes[state.preset];
  $('#recipeTitle').textContent = recipe?.title || '你的布光，你来定义。';
  $('#recipeTip').textContent = recipe?.tip || '观察鼻影、颧骨和暗侧眼睛下的亮区。微调灯位和人像转向，找到你想要的明暗关系。';
  updateDiagram(); updateShotCount();
}

function positionFor(light) {
  const az = radians(light.azimuth), el = radians(light.elevation), d = light.distance;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el) * d, FACE.y + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
}

function temperatureColor(kelvin) {
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.6987 * Math.pow(t - 60, -.1332);
  const g = t <= 66 ? 99.4708 * Math.log(t) - 161.1196 : 288.1222 * Math.pow(t - 60, -.07551);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177 * Math.log(t - 10) - 305.0448;
  return new THREE.Color(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255).convertSRGBToLinear();
}

function makeRig(id) {
  const group = new THREE.Group();
  const emitter = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .08, 8), new THREE.MeshStandardMaterial({ color: '#15191a', roughness: .8 }));
  shell.rotation.x = Math.PI / 2;
  const diffuser = new THREE.Mesh(new THREE.CircleGeometry(.345, 8), new THREE.MeshBasicMaterial({ color: '#ead8b6', side: THREE.DoubleSide }));
  diffuser.position.z = -.045; diffuser.rotation.y = Math.PI;
  emitter.add(shell, diffuser); group.add(emitter);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(.013, .017, 1, 8), new THREE.MeshStandardMaterial({ color: '#353b3c', metalness: .7, roughness: .5 }));
  group.add(stand);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .48, 6), stand.material);
    const angle = i * Math.PI * 2 / 3;
    leg.position.set(Math.cos(angle) * .18, .085, Math.sin(angle) * .18);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(angle) * .4, .18, -Math.sin(angle) * .4).normalize());
    group.add(leg);
  }
  rigGroup.add(group);
  const samples = [];
  for (let i = 0; i < (id === 'key' ? 5 : 3); i++) {
    const light = new THREE.SpotLight(0xffffff, 1, 12, radians(40), .65, 2);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -.00013;
    light.shadow.normalBias = .0015;
    light.shadow.camera.near = .15; light.shadow.camera.far = 8;
    light.shadow.radius = 1.5;
    light.target.position.copy(FACE);
    scene.add(light, light.target); samples.push(light);
  }
  const beamGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), FACE]);
  const beam = new THREE.Line(beamGeometry, new THREE.LineDashedMaterial({ color: lightMeta[id].color, dashSize: .07, gapSize: .05, transparent: true, opacity: .35 }));
  beam.computeLineDistances(); rigGroup.add(beam);
  rigs[id] = { group, emitter, stand, diffuser, samples, beam };
}

function updateLighting() {
  if (!renderer) return;
  for (const [id, rig] of Object.entries(rigs)) {
    const data = state.lights[id], pos = positionFor(data), color = temperatureColor(data.temperature);
    const direction = FACE.clone().sub(pos).normalize();
    const horizontal = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    const vertical = new THREE.Vector3().crossVectors(horizontal, direction).normalize();
    const radius = data.size / 100 * .35;
    rig.samples.forEach((sample, i) => {
      const angle = (i - 1) / (rig.samples.length - 1) * Math.PI * 2;
      sample.position.copy(pos);
      if (i) sample.position.addScaledVector(horizontal, Math.cos(angle) * radius).addScaledVector(vertical, Math.sin(angle) * radius);
      sample.visible = data.enabled && !compare;
      const weight = rig.samples.length === 5 ? (i ? .15 : .4) : (i ? .25 : .5);
      sample.intensity = data.power / 100 * 48 * weight;
      sample.color.copy(color);
    });
    rig.group.position.set(pos.x, 0, pos.z);
    rig.emitter.position.set(0, pos.y, 0);
    rig.emitter.lookAt(FACE);
    rig.emitter.scale.setScalar(data.size / 70);
    rig.stand.scale.y = Math.max(.2, pos.y - .05); rig.stand.position.y = pos.y / 2;
    rig.diffuser.material.color.set(data.enabled ? '#ead8b6' : '#4c504c');
    rig.group.visible = data.enabled;
    rig.beam.visible = data.enabled;
    rig.beam.geometry.setFromPoints([pos, FACE]); rig.beam.computeLineDistances();
  }
  comparisonLight.intensity = compare ? 3.2 : 0;
  ambient.intensity = compare ? .65 : .035;
  const c = state.camera;
  renderer.toneMappingExposure = clamp(.88 * (c.iso / 100) * Math.pow(5.6 / c.aperture, 2) * (125 / c.shutterSpeed), .025, 15);
  if (head) { head.rotation.y = radians(state.headYaw); head.material = state.material === 'clay' ? clayMaterial : skinMaterial; }
  photoCamera.setFocalLength(c.focalLength);
  drawBackdrop(); requestRender();
}

let backdropKey = '';
function drawBackdrop() {
  if (!backdrop || backdropKey === state.background) return;
  backdropKey = state.background;
  const colors = palettes[state.background];
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(114, 106, 0, 128, 128, 170);
  gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  backdrop.material.map?.dispose(); backdrop.material.map = new THREE.CanvasTexture(canvas);
  backdrop.material.map.colorSpace = THREE.SRGBColorSpace; backdrop.material.needsUpdate = true;
  scene.background = new THREE.Color(colors[1]);
}

function resize() {
  if (!renderer) return;
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  photoCamera.aspect = w / h;
  photoCamera.setFocalLength(state.camera.focalLength);
  orbitCamera.aspect = w / h; orbitCamera.updateProjectionMatrix();
  requestRender();
}
function renderNow() {
  if (!ready || !renderer) return;
  const isScene = view === 'scene';
  stageObjects.visible = isScene; rigGroup.visible = isScene;
  renderer.render(scene, isScene ? orbitCamera : photoCamera);
}
function requestRender() {
  if (pendingRender) return;
  pendingRender = true;
  requestAnimationFrame(() => { pendingRender = false; renderNow(); });
}

async function initialize() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', '三维人像布光画面');
    host.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); ready = false; showError('图形上下文已暂停。关闭其他占用显卡的页面后，重新载入。'); });
    scene = new THREE.Scene();
    photoCamera = new THREE.PerspectiveCamera(25, 1, .05, 35);
    photoCamera.position.set(0, 1.47, 2.9); photoCamera.lookAt(0, 1.47, 0);
    orbitCamera = new THREE.PerspectiveCamera(42, 1, .05, 50);
    orbitCamera.position.set(6, 4.8, 4.5);
    controls = new OrbitControls(orbitCamera, renderer.domElement);
    controls.target.set(0, 1.35, 0); controls.minDistance = 1.5; controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI * .49; controls.enablePan = false; controls.enabled = false;
    controls.addEventListener('change', requestRender); controls.update();
    ambient = new THREE.AmbientLight(0xffffff, .035); scene.add(ambient);
    comparisonLight = new THREE.DirectionalLight(0xffffff, 0); comparisonLight.position.set(0, 1.8, 4); scene.add(comparisonLight);
    backdrop = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    backdrop.position.set(0, 3.7, -2); scene.add(backdrop);
    stageObjects = new THREE.Group(); scene.add(stageObjects);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#282f2b', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; stageObjects.add(floor);
    const grid = new THREE.GridHelper(12, 24, '#4c5a50', '#344038'); grid.position.y = .003; grid.material.transparent = true; grid.material.opacity = .45; stageObjects.add(grid);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.31, .34, .9, 48), new THREE.MeshStandardMaterial({ color: '#303a31', roughness: .8 }));
    pedestal.position.set(0, .45, 0); pedestal.castShadow = true; pedestal.receiveShadow = true; stageObjects.add(pedestal);
    const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(.28, .18, .15), new THREE.MeshStandardMaterial({ color: '#4a5653', roughness: .5, metalness: .4 }));
    cameraBody.position.set(0, 1.47, 2.9); stageObjects.add(cameraBody);
    const cameraLens = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .15, 20), cameraBody.material); cameraLens.rotation.x = Math.PI / 2; cameraLens.position.set(0, 1.47, 2.76); stageObjects.add(cameraLens);
    const tripod = new THREE.Mesh(new THREE.CylinderGeometry(.014, .018, 1.4, 8), cameraBody.material); tripod.position.set(0, .7, 2.9); stageObjects.add(tripod);
    rigGroup = new THREE.Group(); scene.add(rigGroup); Object.keys(lightMeta).forEach(makeRig);
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => { $('#loadProgress').textContent = `载入人像与材质 ${Math.round(loaded / total * 100)}%`; };
    const textures = new THREE.TextureLoader(manager);
    const [gltf, color, normal] = await Promise.all([
      new GLTFLoader(manager).loadAsync('./assets/head.glb'),
      textures.loadAsync('./assets/skin.jpg'), textures.loadAsync('./assets/normal.jpg')
    ]);
    let geometry;
    gltf.scene.traverse(obj => { if (obj.isMesh && !geometry) geometry = obj.geometry.clone(); });
    if (!geometry) throw new Error('没有找到人像几何体');
    geometry.center(); geometry.scale(.115, .115, .115); geometry.computeVertexNormals();
    color.colorSpace = THREE.SRGBColorSpace; color.flipY = true; normal.flipY = true;
    color.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    skinMaterial = new THREE.MeshStandardMaterial({ color: '#fff4e9', map: color, normalMap: normal, normalScale: new THREE.Vector2(.55, .55), roughness: .72, metalness: 0 });
    clayMaterial = new THREE.MeshStandardMaterial({ color: '#d5cbb6', normalMap: normal, normalScale: new THREE.Vector2(.35, .35), roughness: .88 });
    head = new THREE.Mesh(geometry, skinMaterial); head.position.y = 1.42;
    head.castShadow = true; head.receiveShadow = true; scene.add(head);
    ready = true; updateLighting(); resize(); renderNow();
    $('#loadingScreen').classList.add('hide'); $('#captureBtn').disabled = false;
    new ResizeObserver(resize).observe(host);
    requestAnimationFrame(() => makeThumbnails());
    window.__lightfield = { get state() { return clone(state); }, get ready() { return ready; }, get view() { return view; }, get shots() { return shots.length; }, render: renderNow };
  } catch (error) { console.error('Lightfield initialization:', error); showError('三维画面未能载入，请确认浏览器已启用硬件加速，再重试。'); }
}

function showError(message) {
  $('#loadingScreen').classList.remove('hide'); $('#loadingScreen').classList.add('error');
  $('#loadingScreen').replaceChildren();
  const title = document.createElement('strong'); title.textContent = '摄影棚暂时未能点亮';
  const text = document.createElement('span'); text.textContent = message;
  const button = document.createElement('button'); button.textContent = '重新载入'; button.onclick = () => location.reload();
  $('#loadingScreen').append(title, text, button); $('#captureBtn').disabled = true;
}

function updateDiagram() {
  const group = $('#diagramLights');
  group.innerHTML = Object.entries(state.lights).map(([id, light]) => {
    const a = radians(light.azimuth), r = light.distance * 33 * Math.cos(radians(light.elevation));
    const x = 140 + Math.sin(a) * r, y = 112 + Math.cos(a) * r;
    const meta = lightMeta[id], selected = state.selected === id;
    return `<g class="lamp-node ${selected ? 'active' : ''}" data-lamp="${id}" role="button" tabindex="0" aria-label="${meta.short}，左右方向键调整角度，上下方向键调整距离" style="opacity:${light.enabled ? 1 : .3}"><line class="lamp-beam" x1="${x}" y1="${y}" x2="140" y2="112" stroke="${meta.color}"/><g transform="translate(${x},${y})"><circle class="lamp-hit" r="18"/><g transform="rotate(${-light.azimuth})"><path class="lamp-outer" d="m-6-9 12 0 6 6v8l-6 6H-6l-6-6v-8Z" stroke="${meta.color}"/><path d="M-7 0H7M0-7v14" stroke="${meta.color}" stroke-width=".6" opacity=".5"/></g><text x="0" y="-17" text-anchor="middle" class="diagram-text" style="fill:${meta.color}">${meta.short}${light.enabled ? '' : ' · 关'}</text></g></g>`;
  }).join('');
}

function changed(custom = true) {
  if (custom) state.preset = 'custom';
  syncUI(); updateLighting(); persist();
}
function applyRecipe(id, announce = true) {
  const recipe = recipes[id]; if (!recipe) return;
  state.lights = clone(defaults.lights);
  Object.assign(state.lights.key, { azimuth: recipe.azimuth, elevation: recipe.elevation, size: recipe.size });
  state.headYaw = 0; state.preset = id; state.selected = 'key';
  changed(false);
  if (announce) toast(`已载入${recipe.name} · 试着移动主光观察阴影`);
}

function captureData(width = 1200, height = 1500, quality = .93) {
  const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio(), aspect = photoCamera.aspect;
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  photoCamera.aspect = width / height; photoCamera.setFocalLength(state.camera.focalLength);
  stageObjects.visible = false; rigGroup.visible = false;
  renderer.render(scene, photoCamera);
  const data = renderer.domElement.toDataURL('image/jpeg', quality);
  renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false);
  photoCamera.aspect = aspect; photoCamera.setFocalLength(state.camera.focalLength); renderNow();
  return data;
}

function makeThumbnails() {
  if (!ready) return;
  const key = state.material + state.background;
  if (key === lastThumbState) return;
  lastThumbState = key;
  const original = clone(state), originalCompare = compare;
  compare = false;
  for (const [id, recipe] of Object.entries(recipes)) {
    state.lights = clone(defaults.lights); Object.assign(state.lights.key, recipe);
    state.headYaw = 0; state.camera = clone(defaults.camera);
    updateLighting();
    const img = $('#thumb-' + id); img.src = captureData(240, 300, .82); img.classList.add('loaded');
  }
  state = original; compare = originalCompare; updateLighting(); renderNow();
}

function updateShotCount() {
  $('#shotCount').textContent = shots.length;
  const latest = $('#latestShot');
  latest.style.backgroundImage = shots.length ? `url("${shots[0].image}")` : '';
  latest.querySelector('svg').style.display = shots.length ? 'none' : '';
}
function shoot() {
  if (!ready) return;
  const button = $('#captureBtn'); button.disabled = true;
  if (compare) setCompare(false);
  $('#captureFlash').classList.remove('flash'); void $('#captureFlash').offsetWidth; $('#captureFlash').classList.add('flash');
  requestAnimationFrame(() => {
    try {
      const image = captureData();
      const now = new Date();
      const shot = { image, state: clone(state), time: now.toLocaleString('zh-CN', { hour12: false }), name: recipes[state.preset]?.name || '自定义布光', id: now.getTime() };
      shots.unshift(shot); shots = shots.slice(0, 8);
      try { localStorage.setItem(SHOTS, JSON.stringify(shots)); } catch { toast('已拍摄；浏览器存储已满，请下载保留这张照片'); }
      updateShotCount(); toast('已拍摄 · 在「我的拍摄」查看与下载');
    } catch (error) { console.error(error); toast('拍摄未成功，请重试'); }
    button.disabled = false;
  });
}

function download(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function exportSetup() {
  const data = JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'LIGHTFIELD' }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  download(url, 'lightfield-lighting.json'); setTimeout(() => URL.revokeObjectURL(url), 5000); toast('布光方案已导出 · 可随时导入继续练习');
}
function showGallery() {
  const grid = $('#galleryGrid'); grid.replaceChildren();
  if (!shots.length) {
    grid.innerHTML = '<div class="gallery-empty"><svg><use href="#i-camera"/></svg><strong>这里，等着你的第一束光。</strong><span>回到工作室，按下快门或空格键拍摄。</span></div>';
  }
  shots.forEach((shot, index) => {
    const card = document.createElement('article'); card.className = 'gallery-card';
    const img = document.createElement('img'); img.src = shot.image; img.alt = `${shot.name}人像照片`; img.loading = 'lazy';
    const content = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = shot.name;
    const date = document.createElement('small'); date.textContent = shot.time;
    const buttons = document.createElement('div'); buttons.className = 'shot-buttons';
    const dl = document.createElement('button'); dl.textContent = '下载 JPG'; dl.onclick = () => download(shot.image, `lightfield-${shot.id}.jpg`);
    const restore = document.createElement('button'); restore.textContent = '恢复布光'; restore.onclick = () => { try { state = validateSetup(shot.state); changed(false); $('#galleryModal').close(); toast('已恢复这张照片的布光与相机设置'); } catch { toast('这张照片的布光参数无法恢复'); } };
    const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', '移除这张照片');
    remove.onclick = () => { shots.splice(index, 1); try { localStorage.setItem(SHOTS, JSON.stringify(shots)); } catch {} updateShotCount(); showGallery(); };
    buttons.append(dl, restore, remove); content.append(title, date, buttons); card.append(img, content); grid.append(card);
  });
  if (!$('#galleryModal').open) $('#galleryModal').showModal();
}

function setView(next) {
  view = next; if (controls) controls.enabled = view === 'scene';
  $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#viewfinder').hidden = view !== 'camera';
  $('#viewHint').innerHTML = view === 'camera' ? '<span class="mouse-icon"></span>拖动旋转人像 · 滚轮调整焦距' : '<span class="mouse-icon"></span>拖动环绕摄影棚 · 滚轮缩放';
  $('#renderStatus').textContent = view === 'camera' ? '实时预览' : '3D 摄影棚';
  $('#lensBadge').style.visibility = view === 'camera' ? '' : 'hidden';
  requestRender();
}
function resetView() {
  if (view === 'scene' && controls) { orbitCamera.position.set(6, 4.8, 4.5); controls.target.set(0, 1.35, 0); controls.update(); }
  else { state.headYaw = 0; state.camera.focalLength = 85; changed(); }
  requestRender();
}
function setCompare(on) { compare = on; $('#compareLabel').hidden = !on; $('#compareBtn').classList.toggle('active', on); $('#compareBtn').setAttribute('aria-pressed', on); updateLighting(); }

for (const field of ['azimuth', 'elevation', 'distance', 'power', 'size', 'temperature']) {
  $('#' + field).addEventListener('input', event => { state.lights[state.selected][field] = +event.target.value; changed(); });
}
$$('[data-light]').forEach(b => b.onclick = () => { state.selected = b.dataset.light; syncUI(); persist(); });
$('#lightToggle').onclick = () => { const light = state.lights[state.selected]; light.enabled = !light.enabled; changed(); };
$$('[data-preset]').forEach(b => b.onclick = () => applyRecipe(b.dataset.preset));
for (const field of Object.keys(defaults.camera)) $('#' + field).onchange = event => { state.camera[field] = +event.target.value; changed(false); };
$('#headYaw').oninput = event => { state.headYaw = +event.target.value; changed(); };
$$('[data-bg]').forEach(b => b.onclick = () => { state.background = b.dataset.bg; changed(false); makeThumbnails(); });
$$('[data-material]').forEach(b => b.onclick = () => { state.material = b.dataset.material; changed(false); makeThumbnails(); });
$$('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#resetViewBtn').onclick = resetView;
$('#resetBtn').onclick = () => { const recipe = recipes[state.preset] ? state.preset : 'rembrandt'; applyRecipe(recipe, false); toast('灯光与人像转向已重置'); };
$('#exportBtn').onclick = exportSetup;
$('#importBtn').onclick = () => $('#importInput').click();
$('#importInput').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 100000) throw new Error('方案文件过大'); state = validateSetup(JSON.parse(await file.text())); changed(false); makeThumbnails(); toast('已导入布光方案'); }
  catch (error) { toast('导入失败：' + (error instanceof SyntaxError ? '请选择有效的 JSON 布光方案' : error.message)); }
  event.target.value = '';
};
$('#captureBtn').onclick = shoot; $('#captureBtn').disabled = true;
$('#galleryNav').onclick = showGallery; $('#latestShot').onclick = showGallery;
const openGuide = () => $('#guideModal').showModal();
$('#guideNav').onclick = openGuide; $('#learnMoreBtn').onclick = openGuide; $('#aboutBtn').onclick = openGuide;
$('#studioNav').onclick = () => $('.workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
$('#startRecipeBtn').onclick = () => { $('#guideModal').close(); applyRecipe('rembrandt', false); };
$$('.close-dialog').forEach(b => b.onclick = () => b.closest('dialog').close());
$$('dialog').forEach(d => d.addEventListener('click', event => { if (event.target === d) { const r = d.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) d.close(); } }));
$('#gridBtn').onclick = () => { $('#thirds').hidden = !$('#thirds').hidden; $('#gridBtn').classList.toggle('active', !$('#thirds').hidden); $('#gridBtn').setAttribute('aria-pressed', !$('#thirds').hidden); };
$('#hintBtn').onclick = () => { $('#triangleGuide').hidden = !$('#triangleGuide').hidden; $('#hintBtn').classList.toggle('active', !$('#triangleGuide').hidden); if (!$('#triangleGuide').hidden) toast('提示框是观察参考，亮区位置会随灯位和脸部转向改变'); };
$('#compareBtn').addEventListener('pointerdown', event => { event.preventDefault(); $('#compareBtn').setPointerCapture(event.pointerId); setCompare(true); });
$('#compareBtn').addEventListener('pointerup', () => setCompare(false));
$('#compareBtn').addEventListener('pointercancel', () => setCompare(false));
$('#compareBtn').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setCompare(true); } });
$('#compareBtn').addEventListener('keyup', () => setCompare(false));
$('#compareBtn').addEventListener('blur', () => { if (compare) setCompare(false); });
$('#fullscreenBtn').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('.stage-panel').requestFullscreen(); } catch { toast('当前浏览器不支持全屏，可使用浏览器缩放'); } };
document.addEventListener('fullscreenchange', () => requestAnimationFrame(resize));
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !event.repeat && !$('dialog[open]') && !['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); shoot(); }
});

let portraitDrag = null;
host.addEventListener('pointerdown', event => {
  if (!ready || view !== 'camera') return;
  portraitDrag = { x: event.clientX, yaw: state.headYaw }; host.setPointerCapture(event.pointerId);
});
host.addEventListener('pointermove', event => {
  if (!portraitDrag || view !== 'camera') return;
  state.headYaw = Math.round(clamp(portraitDrag.yaw + (event.clientX - portraitDrag.x) * .25, -60, 60)); changed();
});
host.addEventListener('pointerup', () => portraitDrag = null); host.addEventListener('pointercancel', () => portraitDrag = null);
host.addEventListener('wheel', event => {
  if (view !== 'camera') return;
  event.preventDefault(); const values = [50, 85, 105], index = values.indexOf(state.camera.focalLength);
  state.camera.focalLength = values[clamp(index + (event.deltaY < 0 ? 1 : -1), 0, 2)]; changed(false);
}, { passive: false });

let diagramDrag = null;
const diagram = $('#lightDiagram');
diagram.addEventListener('pointerdown', event => {
  const node = event.target.closest('[data-lamp]'); if (!node) return;
  event.preventDefault(); state.selected = node.dataset.lamp; diagramDrag = state.selected;
  diagram.setPointerCapture(event.pointerId); syncUI();
});
diagram.addEventListener('pointermove', event => {
  if (!diagramDrag) return;
  const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(diagram.getScreenCTM().inverse());
  const x = pt.x - 140, y = pt.y - 112, light = state.lights[diagramDrag];
  light.azimuth = Math.round(clamp(THREE.MathUtils.radToDeg(Math.atan2(x, y)), -150, 150));
  light.distance = Math.round(clamp(Math.hypot(x, y) / (33 * Math.cos(radians(light.elevation))), .8, 4) * 10) / 10;
  changed();
});
diagram.addEventListener('pointerup', () => diagramDrag = null); diagram.addEventListener('pointercancel', () => diagramDrag = null);
diagram.addEventListener('keydown', event => {
  const node = event.target.closest('[data-lamp]'); if (!node) return;
  const id = node.dataset.lamp;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); state.selected = id;
    const light = state.lights[id];
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') light.azimuth = clamp(light.azimuth + (event.key === 'ArrowRight' ? 2 : -2), -150, 150);
    else light.distance = Math.round(clamp(light.distance + (event.key === 'ArrowUp' ? -.1 : .1), .8, 4) * 10) / 10;
    changed(); diagram.querySelector(`[data-lamp="${id}"]`)?.focus();
  } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.selected = id; syncUI(); }
});

syncUI(); initialize();
