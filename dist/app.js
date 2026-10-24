import {setupCameraUI} from './camera-ui.js';
import {projection,aspectRatio,outputDimensions,shutterLabel,METRES_PER_UNIT,distanceMetres} from './camera-system.js';
import { withImageAttribution } from './image-rights.js';
import { setupStudioUI } from './studio-ui.js';
import {renderFemaleHairPreviews} from './hair-preview-renderer.js';
import { hairCuts } from './hair-cuts.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone, defaults, recipes, palettes, lightMeta, recipeSetup, validateSetup, lightRatio, setRatio, histogram } from './lighting.js';
import { topics, mistakes } from './academy.js';
import { evaluateAdvice, goals, concerns } from './advice.js';
import { createHair } from './hair-fibers.js';
import { createNeckRig, neckWeights } from './neck.js';
import { loadFemaleGeometry } from './female.js';
import { loadMaleGeometry } from './male.js';
import { loadHeadCollider } from './head-collider.js';
import { studioShadows } from './studio-shadows.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const radians = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const STORAGE = 'lightfield.review.setup.v3';
const SHOTS = 'lightfield.review.shots.v3';
let state = clone(defaults), shots = [], ready = false, view = 'camera', compare = false;
let renderer, scene, photoCamera, orbitCamera, controls, head, skinMaterial, clayMaterial;
let previousHairMoving=false;
let ambient, comparisonLight, backdrop, stageObjects, rigGroup, hairModel, neckRig;
let saveTimer, toastTimer, pendingRender = false, lastThumbState = '';
const rigs = {};
const avatars = {};
const FACE = new THREE.Vector3(0, 1.52, 0);
const host = $('#renderHost');
const studioUI = setupStudioUI();
const cameraUI = setupCameraUI({getState:()=>state,getReference:referencePoint,onChange:()=>{changed(false);resize();},notify:toast});

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

try { const saved = localStorage.getItem(STORAGE); if (saved) state = validateSetup(JSON.parse(saved)); } catch { /* Storage is optional. */ }
const reviewView = new URLSearchParams(location.search).get('review');
if (['front','side','curls','male-front','male-side','male-detail','male-curls'].includes(reviewView)) {
  try { const response = await fetch(`./review/${reviewView}.json`); if (response.ok) state = validateSetup(await response.json()); } catch { /* Local review presets are optional. */ }
}
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
    $('#' + key + 'Value').textContent = ['distance', 'power'].includes(key) ? light[key].toFixed(1) : light[key];
  }
  for (const key of ['aperture','iso']) $('#' + key).value = state.camera[key];
  cameraUI.sync();
  $('#headYaw').value = state.headYaw; $('#headYawValue').textContent = state.headYaw; rangeStyle($('#headYaw'));
  $('#isoBadge').textContent = state.camera.iso; $('#apertureBadge').textContent = state.camera.aperture;
  $('#shutterBadge').textContent = shutterLabel(state.camera.shutterSeconds);
  $('#lensBadge').textContent = `${state.camera.focalLength} MM / FULL FRAME`;
  $$('[data-bg]').forEach(b => b.classList.toggle('selected', b.dataset.bg === state.background));
  $$('[data-material]').forEach(b => b.classList.toggle('active', b.dataset.material === state.material));
  $$('[data-preset]').forEach(b => b.classList.toggle('active', b.dataset.preset === state.preset));
  const recipe = recipes[state.preset];
  $('#recipeTitle').textContent = recipe?.title || '你的布光，你来定义。';
  $('#recipeTip').textContent = recipe?.tip || '观察鼻影、颧骨和暗侧眼睛下的亮区。微调灯位和人像转向，找到你想要的明暗关系。';
  syncExtendedUI(); studioUI.sync(state); updateDiagram(); updateShotCount();
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
  for (let i = 0; i < 1; i++) {
    const light = new THREE.SpotLight(0xffffff, 1, 12, radians(40), .65, 2);
    light.castShadow = true;
    const shadowSize=id==='key' && i===0 ? 2048 : 1024;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.bias = -.00008;
    light.shadow.normalBias = .002;
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
  renderer.shadowMap.needsUpdate=true;
  const avatar = avatars[state.subject];
  if (avatar && avatar.head !== head) {
    head.visible = false;
    ({head,neckRig,hairModel,skinMaterial,clayMaterial} = avatar);
    head.visible = true;
  }
  for (const [id, rig] of Object.entries(rigs)) {
    const data = state.lights[id], pos = positionFor(data), color = temperatureColor(data.temperature);
    rig.samples.forEach(sample => {
      sample.position.copy(pos);
      sample.visible = data.enabled && !compare && (state.solo === 'none' || state.solo === id);
      // Spend the shadow map on the bust, rather than the empty studio.
      sample.shadow.focus = clamp(.85 / (data.distance * Math.tan(sample.angle)),.25,1);
      sample.shadow.camera.near = Math.max(.1,data.distance-1.1);
      sample.shadow.camera.far = data.distance+1.3;
      sample.userData.emitterRadius=data.size/200;
      sample.intensity = data.power / 100 * 48;
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
  studioShadows.update(Object.values(rigs).flatMap(rig=>rig.samples));
  ambient.intensity = compare ? .65 : state.solo !== 'none' ? 0 : state.environment.ambient / 100;
  const c = state.camera;
  renderer.toneMappingExposure = clamp(.88 * Math.pow(2, state.environment.exposureEV) * (c.iso / 100) * Math.pow(5.6 / c.aperture, 2), .025, 15);
  if (head) {
    neckRig.setPose(state.headYaw, state.headPitch, state.headRoll); head.material = state.material === 'clay' ? clayMaterial : skinMaterial;
    for (const surface of avatars[state.subject]?.surfaces || []) {
      const original=surface.userData.skinMaterial;
      surface.visible=state.material!=='clay' || original.name==='Eyes';
      surface.material=state.material==='clay' ? clayMaterial : original;
    }
  }
  hairModel?.update(state.hair);
  hairModel?.setMotion($('#hairMotion').checked);
  if (ready && hairModel) {
    const loaded = hairModel.isReady();
    $('#captureBtn').disabled = !loaded; $('#saveABtn').disabled = !loaded; $('#compareABBtn').disabled = !loaded || !baselineA;
    if (loaded) $('#hairStatus').textContent = state.hair.style === 'none' ? `${hairCuts[state.subject].none.name} · 观察脸部与颈部阴影` : '头发参与实时照明与阴影';
  }
  configurePhotoCamera();
  drawBackdrop(); requestRender();
}

let backdropKey = '';
function drawBackdrop() {
  if (!backdrop || backdropKey === state.background + state.environment.backgroundEV) return;
  backdropKey = state.background + state.environment.backgroundEV;
  const colors = palettes[state.background];
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(114, 106, 0, 128, 128, 170);
  gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  backdrop.material.map?.dispose(); backdrop.material.map = new THREE.CanvasTexture(canvas);
  backdrop.material.map.colorSpace = THREE.SRGBColorSpace; backdrop.material.needsUpdate = true;
  backdrop.material.color.setScalar(Math.pow(2, state.environment.backgroundEV));
  scene.background = new THREE.Color(colors[1]).multiplyScalar(Math.pow(2, state.environment.backgroundEV));
}

function resize() {
  if (!renderer) return;
  layoutFrame();
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  photoCamera.aspect = aspectRatio(state.framing);
  configurePhotoCamera();
  orbitCamera.aspect = w / h; orbitCamera.updateProjectionMatrix();
  requestRender();
}
function renderNow() {
  if (!ready || !renderer) return;
  const isScene = view === 'scene';
  stageObjects.visible = isScene; rigGroup.visible = isScene;
  const hairMoving = hairModel?.step(performance.now());
  if(hairMoving||previousHairMoving)renderer.shadowMap.needsUpdate=true;
  previousHairMoving=hairMoving;
  renderer.render(scene, isScene ? orbitCamera : photoCamera);
  $('#hairMotionStatus').textContent = !$('#hairMotion').checked ? '摆动已关闭 · 碰撞避让仍启用' : hairMoving ? '发梢摆动中 · 发根固定' : '已稳定 · 转动人像可观察惯性';
  if (hairMoving) requestRender();
  queueAnalysis();
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
    renderer.shadowMap.autoUpdate=false;
    renderer.domElement.setAttribute('aria-label', '三维人像布光画面');
    host.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); ready = false; showError('图形上下文已暂停。关闭其他占用显卡的页面后，重新载入。'); });
    scene = new THREE.Scene();
    photoCamera = new THREE.PerspectiveCamera(25, 1, .01, 250);
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
    const [maleAsset, femaleAsset, maleCollider, femaleCollider] = await Promise.all([
      loadMaleGeometry(manager), loadFemaleGeometry(manager),
      loadHeadCollider('male'), loadHeadCollider('female')
    ]);
    const hairStatus = id => status => {
      if (state.subject !== id) return;
      $('#hairStatus').textContent = status.error ? '发型载入失败，请刷新重试，或切换无发。' : status.ready ? '头发参与实时照明与阴影' : '正在载入与生成发丝，请稍候…';
      $('#captureBtn').disabled = !ready || !status.ready;
      $('#saveABtn').disabled = !ready || !status.ready;
      $('#compareABBtn').disabled = !ready || !status.ready || !baselineA;
      if (status.ready) { renderer.shadowMap.needsUpdate=true;requestRender(); if (ready) requestAnimationFrame(makeThumbnails); }
    };
    studioUI.setPreviewProvider((styles,onImage)=>renderFemaleHairPreviews(femaleAsset,femaleCollider,styles,onImage));
    for (const [id,asset,collider] of [['male',maleAsset,maleCollider],['female',femaleAsset,femaleCollider]]) {
      const skin = studioShadows.material(asset.material);
      const clay = studioShadows.material(new THREE.MeshStandardMaterial({color:'#d5cbb6',roughness:.85}));
      const rig = createNeckRig(asset.geometry,skin,{subject:id});
      const surfaces=asset.parts.map(part=>{
        studioShadows.material(part.material);
        const surface=rig.attachSurface(part.geometry,part.material,{
          receiveShadow:true,castShadow:['Lashes','Beard'].includes(part.material.name),
          rootAttribute:part.material.name==='Beard' ? '_beard_root' : undefined
        });
        surface.userData.skinMaterial=part.material;return surface;
      });
      const hair = createHair(asset.geometry,hairStatus(id),id,collider);
      rig.attachHair(hair.root);rig.mesh.position.y=1.42;
      rig.mesh.castShadow=true;rig.mesh.receiveShadow=true;rig.mesh.visible=id===state.subject;scene.add(rig.mesh);
      const box=asset.geometry.boundingBox || (asset.geometry.computeBoundingBox(),asset.geometry.boundingBox);
      const eyesPart=asset.parts.find(part=>part.material.name==='Eyes');
      eyesPart?.geometry.computeBoundingBox();
      const eyes=eyesPart?.geometry.boundingBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3(0,.16,.15);
      const anchors={eyes:eyes.toArray(),face:[0,eyes.y-.06,eyes.z+.01],head:[0,box.max.y-.23,0],body:[0,(box.min.y-.12)/2,-.03]};
      avatars[id]={head:rig.mesh,neckRig:rig,hairModel:hair,skinMaterial:skin,clayMaterial:clay,surfaces,anchors};
    }
    ({head,neckRig,hairModel,skinMaterial,clayMaterial}=avatars[state.subject]);
    ready = true; syncUI(); updateLighting(); resize(); renderNow();
    $('#loadingScreen').classList.add('hide'); $('#captureBtn').disabled = !hairModel.isReady();
    new ResizeObserver(resize).observe(host);
    requestAnimationFrame(() => makeThumbnails());
    window.__lightfield = { get state() { return clone(state); }, get ready() { return ready; }, get view() { return view; }, get shots() { return shots.length; }, get camera() { return {position:photoCamera.position.toArray(),fov:photoCamera.fov,aspect:photoCamera.aspect,projection:photoCamera.projectionMatrix.toArray(),reference:referencePoint(state.camera.reference),metres:distanceMetres(photoCamera.position.toArray(),referencePoint(state.camera.reference)),avatarScale:head.scale.toArray(),bounds:head.geometry.boundingBox?.clone()}; }, render: renderNow };
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
  state = recipeSetup(id, state);
  changed(false); resize();
  if (announce) toast(`已载入${recipe.name} · 试着移动主光观察阴影`);
}

function captureData(width = 1200, height = 1500, quality = .93) {
  if (!hairModel.isReady()) throw new Error('发型尚未载入');
  const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio(), aspect = photoCamera.aspect;
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  photoCamera.aspect = width / height; configurePhotoCamera();
  stageObjects.visible = false; rigGroup.visible = false;
  hairModel.step(performance.now());
  renderer.render(scene, photoCamera);
  const data = renderer.domElement.toDataURL('image/jpeg', quality);
  renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false);
  photoCamera.aspect = aspect; configurePhotoCamera(); renderNow();
  return data;
}

function makeThumbnails() {
  if (!ready || !hairModel.isReady()) return;
  const key = state.subject + state.material;
  if (key === lastThumbState) return;
  const original = clone(state), originalCompare = compare;
  compare = false;
  try {
    for (const [id] of Object.entries(recipes)) {
      state = recipeSetup(id, original); state.hair.style = 'none';
      updateLighting();
      const img = $('#thumb-' + id); img.src = captureData(240, 300, .82); img.classList.add('loaded');
    }
    lastThumbState = key;
  } finally {
    state = original; compare = originalCompare; updateLighting(); renderNow();
  }
}

function updateShotCount() {
  $('#shotCount').textContent = shots.length;
  const latest = $('#latestShot');
  latest.style.backgroundImage = shots.length ? `url("${shots[0].image}")` : '';
  latest.querySelector('svg').style.display = shots.length ? 'none' : '';
}
function shoot() {
  if (!ready || !hairModel.isReady()) { toast('请等发型载入完成后再拍摄'); return; }
  const button = $('#captureBtn'); button.disabled = true;
  if (compare) setCompare(false);
  $('#captureFlash').classList.remove('flash'); void $('#captureFlash').offsetWidth; $('#captureFlash').classList.add('flash');
  requestAnimationFrame(() => {
    try {
      const [width, height] = captureDimensions();
      const image = captureData(width, height);
      const now = new Date();
      const shot = { image, state: clone(state), credits: imageCredits(state), time: now.toLocaleString('zh-CN', { hour12: false }), name: recipes[state.preset]?.name || '自定义布光', id: now.getTime() };
      shots.unshift(shot); shots = shots.slice(0, 8);
      try { localStorage.setItem(SHOTS, JSON.stringify(shots)); } catch { toast('已拍摄；浏览器存储已满，请下载保留这张照片'); }
      updateShotCount(); toast('已拍摄 · 在「我的拍摄」查看与下载');
    } catch (error) { console.error(error); toast('拍摄未成功，请重试'); }
    button.disabled = false;
  });
}

function imageCredits(setup, legacyMale = false) {
  const credits = [];
  if (setup.subject !== 'female') {
    if (legacyMale) credits.push('Head: Lee Perry-Smith / Infinite-Realities; CC BY 3.0; https://creativecommons.org/licenses/by/3.0/; adapted for LIGHTFIELD; https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/LeePerrySmith/README.md');
    else credits.push('Male bust: Man base mesh by BlakkMato; CC BY 4.0; https://creativecommons.org/licenses/by/4.0/; cropped head-neck-shoulders, refined geometry and new beard groom for LIGHTFIELD; https://sketchfab.com/3d-models/man-base-mesh-a870a28384fb428da535b6a816fea73e');
  }
  else credits.push('Female bust: Scifi Girl v.01 by patrix; CC BY-NC-SA 4.0; https://creativecommons.org/licenses/by-nc-sa/4.0/; shoulder-line crop, cropped textures and material adaptation for LIGHTFIELD; https://sketchfab.com/3d-models/scifi-girl-v01-96340701c2ed4d37851c7d9109eee9c0');
  if (setup.hair?.style && setup.hair.style !== 'none') credits.push('Hair Styles: Daniel Bystedt; upstream notice CC BY-SA, no asset-specific version; official website default BY-SA 3.0 is the documented distribution basis: https://www.blender.org/about/website/; https://creativecommons.org/licenses/by-sa/3.0/; source https://www.blender.org/download/demo-files/#hair; resampled, fitted, length/material/collision adaptations by LIGHTFIELD; separate portrait terms also apply');
  return credits;
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
    const dl = document.createElement('button'); dl.textContent = '下载 JPG'; dl.onclick = () => {
      const credits=Array.isArray(shot.credits)&&shot.credits.every(c=>typeof c==='string') ? shot.credits : imageCredits(shot.state,true);
      download(withImageAttribution(shot.image,credits), `lightfield-${shot.id}.jpg`);
    };
    const restore = document.createElement('button'); restore.textContent = '恢复布光'; restore.onclick = () => { try { state = validateSetup(shot.state); changed(false); resize(); $('#galleryModal').close(); toast('已恢复这张照片的布光与相机设置'); } catch { toast('这张照片的布光参数无法恢复'); } };
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
  resize(); requestRender();
}
function resetView() {
  if (view === 'scene' && controls) { orbitCamera.position.set(6, 4.8, 4.5); controls.target.set(0, 1.35, 0); controls.update(); }
  else { state.headYaw = state.headPitch = state.headRoll = 0; state.framing = clone(defaults.framing); state.camera = clone(defaults.camera); changed(); resize(); }
  requestRender();
}
function setCompare(on) { compare = on; $('#compareLabel').hidden = !on; $('#compareBtn').classList.toggle('active', on); $('#compareBtn').setAttribute('aria-pressed', on); updateLighting(); syncContextAdvice(); }

for (const field of ['azimuth', 'elevation', 'distance', 'power', 'size', 'temperature']) {
  $('#' + field).addEventListener('input', event => { state.lights[state.selected][field] = +event.target.value; changed(); });
}
$$('[data-light]').forEach(b => b.onclick = () => { state.selected = b.dataset.light; syncUI(); persist(); });
$('#lightToggle').onclick = () => { const light = state.lights[state.selected]; light.enabled = !light.enabled; changed(); };
$('#presets').onclick = event => { const b = event.target.closest('[data-preset]'); if (b) applyRecipe(b.dataset.preset); };
for (const field of ['aperture','iso']) $('#' + field).onchange = event => { state.camera[field] = +event.target.value; changed(false); };
$('#headYaw').oninput = event => { state.headYaw = +event.target.value; changed(); };
$$('[data-bg]').forEach(b => b.onclick = () => { state.background = b.dataset.bg; changed(false); makeThumbnails(); });
$$('[data-material]').forEach(b => b.onclick = () => { state.material = b.dataset.material; changed(false); makeThumbnails(); });
$$('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#resetViewBtn').onclick = resetView;
$('#resetBtn').onclick = () => { const recipe = recipes[state.preset] ? state.preset : lastRecipe; applyRecipe(recipe, false); toast('灯光与人像转向已重置'); };
$('#exportBtn').onclick = exportSetup;
$('#importBtn').onclick = () => $('#importInput').click();
$('#importInput').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 100000) throw new Error('方案文件过大'); state = validateSetup(JSON.parse(await file.text())); changed(false); resize(); makeThumbnails(); toast('已导入布光方案'); }
  catch (error) { toast('导入失败：' + (error instanceof SyntaxError ? '请选择有效的 JSON 布光方案' : error.message)); }
  event.target.value = '';
};
$('#captureBtn').onclick = shoot; $('#captureBtn').disabled = true;
$('#galleryNav').onclick = showGallery; $('#latestShot').onclick = showGallery;
const openGuide = () => openAcademy('recipes', recipes[state.preset] ? state.preset : lastRecipe);
$('#guideNav').onclick = openGuide; $('#learnMoreBtn').onclick = openGuide; $('#aboutBtn').onclick = openGuide;
$('#studioNav').onclick = () => $('.workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
$('#startRecipeBtn').onclick = () => { $('#guideModal').close(); if (guideMode === 'recipes') applyRecipe(guideSelection); else startLesson(guideSelection); $('.workspace').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
$$('.close-dialog').forEach(b => b.onclick = () => b.closest('dialog').close());
$$('dialog').forEach(d => d.addEventListener('click', event => { if (event.target === d) { const r = d.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) d.close(); } }));
$('#gridBtn').onclick = toggleGrid;
$('#hintBtn').onclick = () => { $('#triangleGuide').hidden = !$('#triangleGuide').hidden; $('#hintBtn').classList.toggle('active', !$('#triangleGuide').hidden); syncContextAdvice(); if (!$('#triangleGuide').hidden) toast('观察提示基于目标与当前参数；实际阴影请结合画面判断'); };
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
  if (!(event.buttons & 1)) { portraitDrag = null; return; }
  state.headYaw = Math.round(clamp(portraitDrag.yaw + (event.clientX - portraitDrag.x) * .25, -60, 60)); changed();
});
host.addEventListener('pointerup', () => portraitDrag = null); host.addEventListener('pointercancel', () => portraitDrag = null);
host.addEventListener('lostpointercapture', () => portraitDrag = null);
window.addEventListener('blur', () => portraitDrag = null);
host.addEventListener('wheel', event => {
  if (view !== 'camera') return;
  event.preventDefault();cameraUI.commit({focalLength:Math.round(clamp(state.camera.focalLength*(event.deltaY<0?1.04:1/1.04),12,300)*10)/10});
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

let analysisTimer, inspect = false, baselineA = null, comparisonB = null;
let requestedGoal = 'auto', currentConcern = 'none', currentAdvice;
let lastRecipe = Object.hasOwn(recipes, state.preset) ? state.preset : 'rembrandt', guideMode = 'recipes', guideSelection = 'rembrandt', activeTopic = 'direction', practiceProgress = {};
try { const saved = JSON.parse(localStorage.getItem('lightfield.practice.v1') || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) practiceProgress = saved; } catch {}
const analysisCanvas = document.createElement('canvas');
const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });

function captureDimensions(scale = 1) { return outputDimensions(state.framing,scale); }
const refPoint=new THREE.Vector3(),refOriginal=new THREE.Vector3(),refWeighted=new THREE.Vector3();
const refMatrix=new THREE.Matrix4(),cameraPoint=new THREE.Vector3();
function referencePoint(id='head') {
  const avatar=avatars[state.subject];
  if(!avatar)return [0,1.47,0];
  const mesh=avatar.head,anchor=avatar.anchors[id]||avatar.anchors.head;
  mesh.updateMatrixWorld(true);mesh.skeleton.update();
  refOriginal.fromArray(anchor).applyMatrix4(mesh.bindMatrix);refPoint.set(0,0,0);
  const weights=neckWeights(...anchor,state.subject);
  for(let i=0;i<3;i++){
    refMatrix.fromArray(mesh.skeleton.boneMatrices,i*16);
    refWeighted.copy(refOriginal).applyMatrix4(refMatrix);refPoint.addScaledVector(refWeighted,weights[i]);
  }
  return refPoint.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld).toArray();
}
function configurePhotoCamera() {
  if (!photoCamera) return;
  const p=projection(state.camera,state.framing);
  photoCamera.position.fromArray(state.camera.position);
  // Distance controls translate on this axis; framing shift is an optical shift.
  photoCamera.rotation.set(0,0,0);photoCamera.fov=p.verticalFov;
  const h = 1000, w = h * photoCamera.aspect;
  photoCamera.setViewOffset(w, h, -w * state.framing.shiftX / 100, -h * state.framing.shiftY / 100, w, h);
  photoCamera.updateProjectionMatrix();photoCamera.updateMatrixWorld(true);
  if(ready){
    cameraUI.sync();
    const bounds=head.geometry.boundingBox || (head.geometry.computeBoundingBox(),head.geometry.boundingBox);
    let clipped=false;
    for(const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z]){
      cameraPoint.set(x,y,z).applyMatrix4(head.matrixWorld).project(photoCamera);
      if(Math.abs(cameraPoint.x)>1||Math.abs(cameraPoint.y)>1||cameraPoint.z< -1||cameraPoint.z>1)clipped=true;
    }
    $('#cameraWarning').textContent=clipped?'当前取景可能裁切人物。可主动拉远距离或缩短焦距；设置已保留。':'';
  }
}
function layoutFrame() {
  const viewport = $('#viewport');
  const ratio = view === 'camera' ? aspectRatio(state.framing) : viewport.clientWidth / viewport.clientHeight;
  const width = Math.min(viewport.clientWidth, viewport.clientHeight * ratio), height = width / ratio;
  Object.assign(host.style, { width: width + 'px', height: height + 'px', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' });
  Object.assign($('#viewfinder').style, { width: width + 'px', height: height + 'px', top: '50%' });
}
function syncExtendedUI() {
  if (Object.hasOwn(recipes, state.preset)) lastRecipe = state.preset;
  for (const key of ['ambient', 'backgroundEV', 'exposureEV']) {
    const input = $('#' + key); input.value = state.environment[key]; rangeStyle(input);
    $('#' + key + 'Value').textContent = state.environment[key].toFixed(1);
  }
  for (const key of ['shiftX', 'shiftY', 'headPitch', 'headRoll']) {
    const value = key.startsWith('shift') ? state.framing[key] : state[key];
    $('#' + key).value = value; rangeStyle($('#' + key)); $('#' + key + 'Value').textContent = value;
  }
  $('#aspect').value = state.framing.aspect;
  $('#hairStyle').value = state.hair.style;
  $('#subject').value = state.subject;
  $$('[data-hair-color]').forEach(b => { const active = b.dataset.hairColor === state.hair.color; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
  $$('[data-solo]').forEach(b => { const active = b.dataset.solo === state.solo; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
  const ratio = lightRatio(state.lights);
  $('#ratioValue').textContent = ratio ? `${ratio.ratio.toFixed(1)} : 1` : '—';
  $('#ratioNote').textContent = ratio ? `主光相对补光 ${ratio.stops >= 0 ? '+' : ''}${ratio.stops.toFixed(1)} 挡 · 入射近似，非脸部实测。` : '主光与补光都开启且强度大于零时，显示入射估算。';
  $$('[data-ratio]').forEach(b => { const active = ratio && Math.abs(ratio.ratio - +b.dataset.ratio) < .02; b.classList.toggle('active', !!active); b.setAttribute('aria-pressed', !!active); });
  $('#renderStatus').textContent = view === 'scene' ? '3D 摄影棚' : state.solo !== 'none' ? `单灯观察 · ${lightMeta[state.solo].short}${state.lights[state.solo].enabled ? '' : '未开启'}` : '实时预览';
  $('#lensBadge').textContent = `${state.camera.focalLength} MM / ${state.framing.aspect}`;
  $('#learnMoreBtn').innerHTML = recipes[state.preset] ? '查看此方法 <span>↗</span>' : '打开布光指南 <span>↗</span>';
  $('#saveABtn').disabled = !ready || !hairModel?.isReady(); $('#compareABBtn').disabled = !ready || !hairModel?.isReady() || !baselineA;
  syncContextAdvice();
}
function syncContextAdvice() {
  currentAdvice = evaluateAdvice(state, requestedGoal, currentConcern, lastRecipe);
  const advice = compare ? { ...currentAdvice, title: '当前正在查看均匀照明对比', observation: '此时原有灯光暂时隐藏，画面与正式布光不同。', next: '松开对比按钮后，再根据拍摄目标判断光影层次。', topic: 'direction', level: 'info' } : currentAdvice;
  $('#contextTitle').textContent = advice.title; $('#contextObservation').textContent = advice.observation; $('#contextNext').textContent = advice.next;
  $('#contextFeedback').dataset.level = advice.level;
  $('#contextGoalBadge').textContent = goals[advice.goal];
  $('#contextLessonBtn').textContent = `阅读：${topics[advice.topic].title} ↗`;
  $('#triangleGuide span').textContent = advice.title;
  $('#triangleGuide div').hidden = lastRecipe !== 'rembrandt' || state.solo !== 'none' || requestedGoal === 'framing';
}
function buildContextAdvice() {
  $('#contextGoal').innerHTML = Object.entries(goals).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  $('#contextConcern').innerHTML = Object.entries(concerns).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  $('#contextGoal').onchange = event => { requestedGoal = event.target.value; syncContextAdvice(); };
  $('#contextConcern').onchange = event => { currentConcern = event.target.value; syncContextAdvice(); };
  $('#contextLessonBtn').onclick = () => openAcademy('topics', compare ? 'direction' : currentAdvice.topic);
}
function queueAnalysis() {
  clearTimeout(analysisTimer); analysisTimer = setTimeout(analyzeFrame, 140);
}
function analyzeFrame() {
  const overlay = $('#analysisOverlay'), histogramCanvas = $('#histogram'), ctx = histogramCanvas.getContext('2d');
  ctx.clearRect(0, 0, histogramCanvas.width, histogramCanvas.height);
  if (!ready || view !== 'camera') { overlay.hidden = true; $('#shadowPercent').textContent = $('#highlightPercent').textContent = '相机视角可用'; return; }
  analysisCanvas.width = 160; analysisCanvas.height = Math.round(160 / photoCamera.aspect);
  analysisContext.drawImage(renderer.domElement, 0, 0, analysisCanvas.width, analysisCanvas.height);
  const pixels = analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
  const stats = histogram(pixels.data), max = Math.max(1, ...stats.bins);
  ctx.fillStyle = '#18201d'; ctx.fillRect(0, 0, histogramCanvas.width, histogramCanvas.height);
  ctx.strokeStyle = '#ffffff12';
  for (const n of [1, 2, 3]) { ctx.beginPath(); ctx.moveTo(n * 80, 0); ctx.lineTo(n * 80, 74); ctx.stroke(); }
  stats.bins.forEach((n, i) => { const h = n / max * 66; ctx.fillStyle = i < 3 ? '#7ea6bc' : i > 60 ? '#d9a28e' : '#c6bd99'; ctx.fillRect(i * 5, 74 - h, 4, h); });
  $('#shadowPercent').textContent = stats.shadows.toFixed(1) + '%'; $('#highlightPercent').textContent = stats.highlights.toFixed(1) + '%';
  histogramCanvas.setAttribute('aria-label', `全画面亮度直方图：暗部 ${stats.shadows.toFixed(1)}%，高亮 ${stats.highlights.toFixed(1)}%，包括背景`);
  overlay.hidden = !inspect;
  if (inspect) {
    overlay.width = analysisCanvas.width; overlay.height = analysisCanvas.height;
    for (let i = 0; i < pixels.data.length; i += 4) {
      const value = .2126 * pixels.data[i] + .7152 * pixels.data[i + 1] + .0722 * pixels.data[i + 2];
      pixels.data[i] = value >= 250 ? 255 : 55; pixels.data[i + 1] = value >= 250 ? 64 : 135; pixels.data[i + 2] = value >= 250 ? 45 : 255;
      pixels.data[i + 3] = value >= 250 || value <= 8 ? 150 : 0;
    }
    overlay.getContext('2d').putImageData(pixels, 0, 0);
  }
}
function toggleGrid() {
  state.framing.guide=state.framing.guide==='none'?'thirds':'none';cameraUI.sync();persist();
}
function buildRecipeCards() {
  $('#presets').innerHTML = Object.entries(recipes).map(([id, r], i) => `<button data-preset="${id}" data-category="${r.category}" class="preset"><div class="preset-image"><img alt="${r.name}预览" id="thumb-${id}"><span class="preset-index">${String(i + 1).padStart(2, '0')}</span></div><div class="preset-copy"><strong>${r.name}<svg><use href="#i-check"/></svg></strong><span>${r.en}</span><p>${r.title}</p></div></button>`).join('');
  $$('[data-filter]').forEach(b => b.onclick = () => {
    $$('[data-filter]').forEach(item => { item.classList.toggle('active', item === b); item.setAttribute('aria-pressed', item === b); });
    $$('#presets [data-preset]').forEach(item => item.hidden = b.dataset.filter !== 'all' && item.dataset.category !== b.dataset.filter);
  });
}

function openAcademy(mode, id) {
  guideMode = mode; guideSelection = id; renderAcademy();
  if (!$('#guideModal').open) $('#guideModal').showModal();
}
function renderAcademy() {
  const data = guideMode === 'recipes' ? recipes : topics;
  if (!Object.hasOwn(data, guideSelection)) guideSelection = Object.keys(data)[0];
  $$('[data-guide-mode]').forEach(b => { const active = b.dataset.guideMode === guideMode; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
  $('#academyNav').innerHTML = Object.entries(data).map(([id, r], i) => `<button data-chapter="${id}" class="${id === guideSelection ? 'active' : ''}" aria-current="${id === guideSelection ? 'page' : 'false'}"><span>${String(i + 1).padStart(2, '0')}</span>${r.name || r.title}</button>`).join('');
  const r = data[guideSelection], article = $('#academyContent');
  if (guideMode === 'recipes') {
    const setup = recipeSetup(guideSelection), key = setup.lights.key, extra = setup.lights.fill.enabled ? `补光：${setup.lights.fill.azimuth}° / ${setup.lights.fill.elevation}°，强度 ${setup.lights.fill.power}%。` : '补光默认关闭，先看清主光再添加。';
    const thumb = $('#thumb-' + guideSelection);
    article.innerHTML = `<div class="chapter-kicker">${r.en} / LIGHTING METHOD</div><div class="chapter-hero"><div><h3>${r.name}</h3><p>${r.tip}</p></div>${thumb?.src ? `<img src="${thumb.src}" alt="${r.name}三维预览">` : ''}</div><section><h4>01 / 起点怎么放</h4><p>主光水平 ${key.azimuth}°、灯位仰俯 ${key.elevation}°、距离 ${key.distance} m、直径 ${key.size} cm、相对强度 ${key.power}%。人像转向 ${setup.headYaw}°。</p><p>${extra}${setup.lights.rim.enabled ? '后侧轮廓光同时开启，用于边缘分离。' : ''}</p><p class="micro-copy">角度以相机正前方为 0°，负值在画面左侧；仰俯负值表示灯在脸中心下方。数值是此模型的练习起点，不是通用实拍配方。</p></section><section><h4>02 / 按顺序观察</h4><ol>${r.steps.map(step => `<li>${step}</li>`).join('')}</ol></section><section><h4>03 / 常见问题怎么改</h4><p>${mistakes[guideSelection]}</p></section><section class="chapter-links"><h4>04 / 继续理解原理</h4><button data-jump-topic="direction">光的方向 ↗</button><button data-jump-topic="contrast">光比与反差 ↗</button><button data-jump-topic="softness">硬光与柔光 ↗</button><button data-jump-topic="shape">转头与宽窄光 ↗</button></section>${guideNotice()}`;
  } else {
    article.innerHTML = `<div class="chapter-kicker">${r.en} / OBSERVATION LAB</div><h3>${r.title}</h3><p class="chapter-intro">${r.subtitle}</p>${r.sections.map(([title, text], i) => `<section><h4>${String(i + 1).padStart(2, '0')} / ${title}</h4><p>${text}</p></section>`).join('')}<section><h4>动手练习</h4><ol>${r.task.map(text => `<li>${text}</li>`).join('')}</ol></section>${guideNotice()}`;
  }
  article.scrollTop = 0;
  $('#startRecipeBtn').textContent = guideMode === 'recipes' ? `载入${r.name}，开始观察 ↗` : '载入这堂练习 ↗';
}
function guideNotice() { return '<div class="guide-notice">模拟范围：柔光由遮挡距离与阴影贴图近似；补光灯近似说明反光板效果，不做完整反射计算。相机参数按持续光近似影响亮度，不模拟真实景深、闪光同步或自动三角光检测。模型保留原有眼睛，只显示头、颈和肩部，不模拟自主眼神与表情。</div>'; }
function buildAcademy() {
  $('#lessonCards').innerHTML = Object.entries(topics).map(([id, topic], i) => `<button data-lesson="${id}" class="lesson-card"><span>${String(i + 1).padStart(2, '0')} / ${topic.en}</span><strong>${topic.title}</strong><p>${topic.subtitle}</p><i>阅读与练习 ↗</i></button>`).join('');
  $('#lessonCards').onclick = event => { const b = event.target.closest('[data-lesson]'); if (b) openAcademy('topics', b.dataset.lesson); };
  $('#academyNav').onclick = event => { const b = event.target.closest('[data-chapter]'); if (b) { guideSelection = b.dataset.chapter; renderAcademy(); } };
  $('#academyContent').onclick = event => { const b = event.target.closest('[data-jump-topic]'); if (b) { guideMode = 'topics'; guideSelection = b.dataset.jumpTopic; renderAcademy(); } };
  $$('[data-guide-mode]').forEach(b => b.onclick = () => { guideMode = b.dataset.guideMode; guideSelection = guideMode === 'recipes' ? (recipes[state.preset] ? state.preset : lastRecipe) : activeTopic; renderAcademy(); });
  $('#allLessonsBtn').onclick = () => openAcademy('topics', activeTopic);
  $('#restartPracticeBtn').onclick = () => startLesson(activeTopic);
  $('#practiceChecklist').onchange = event => {
    const index = +event.target.dataset.step;
    if (!Number.isInteger(index) || index < 0 || index > 2) return;
    if (!Array.isArray(practiceProgress[activeTopic])) practiceProgress[activeTopic] = [false, false, false];
    practiceProgress[activeTopic][index] = event.target.checked;
    try { localStorage.setItem('lightfield.practice.v1', JSON.stringify(practiceProgress)); } catch {}
    renderPractice(); $('#practiceChecklist').querySelector(`[data-step="${index}"]`)?.focus();
  };
  renderPractice();
}
function renderPractice() {
  const topic = topics[activeTopic], progress = Array.isArray(practiceProgress[activeTopic]) ? practiceProgress[activeTopic] : [];
  $('#practiceNumber').textContent = `PRACTICE / ${String(Object.keys(topics).indexOf(activeTopic) + 1).padStart(2, '0')}`;
  $('#practiceTitle').textContent = topic.title;
  $('#practiceProgress').textContent = `${progress.slice(0, 3).filter(x => x === true).length} / 3 自查完成`;
  $('#practiceChecklist').innerHTML = topic.task.map((text, i) => `<li><label><input type="checkbox" data-step="${i}" ${progress[i] === true ? 'checked' : ''}><span>${text}</span></label></li>`).join('');
  $$('[data-lesson]').forEach(b => b.classList.toggle('active', b.dataset.lesson === activeTopic));
}
function startLesson(id) {
  activeTopic = id; applyRecipe(topics[id].recipe, false);
  requestedGoal = { contrast: 'shape', softness: 'soft', shape: 'shape', mood: 'lowkey', composition: 'framing' }[id] || 'auto';
  currentConcern = 'none'; $('#contextGoal').value = requestedGoal; $('#contextConcern').value = 'none';
  if (id === 'contrast') { state = setRatio(state, 4); changed(false); }
  if (id === 'composition' && $('#thirds').hidden) toggleGrid();
  syncContextAdvice(); renderPractice(); toast(`已开始：${topics[id].title} · 下方有三项观察自查`);
}
function snapshotMeta(setup) {
  return `${recipes[setup.preset]?.name || '自定义布光'} · ${setup.subject==='female'?'女性':'男性'} · ${setup.camera.focalLength}mm · ${hairCuts[setup.subject||'male'][setup.hair.style].name}${setup.hair.style === 'none' ? '' : setup.hair.color === 'light' ? ' / 浅发色' : ' / 深发色'} · ${setup.framing.aspect}`;
}
$$('[data-solo]').forEach(b => b.onclick = () => { state.solo = b.dataset.solo; changed(false); if (state.solo !== 'none' && !state.lights[state.solo].enabled) toast('当前观察的灯未开启，可在左侧打开它'); });
$$('[data-ratio]').forEach(b => b.onclick = () => { state = setRatio(state, +b.dataset.ratio); changed(false); toast('已按当前灯距设置主/补入射估算比例，实际脸部明暗仍需观察'); });
for (const key of ['ambient', 'backgroundEV', 'exposureEV']) $('#' + key).oninput = event => { state.environment[key] = +event.target.value; changed(); };
for (const key of ['headPitch', 'headRoll']) $('#' + key).oninput = event => { state[key] = +event.target.value; changed(); };
for (const key of ['shiftX', 'shiftY']) $('#' + key).oninput = event => { state.framing[key] = +event.target.value; changed(false); };
// Aspect controls are owned by camera-ui.js.
$('#hairStyle').onchange = event => { state.hair.style = event.target.value; changed(false); makeThumbnails(); toast('已切换发型 · 固定灯位，比较头发受光与投影'); };
$('#subject').onchange = event => { state.subject = event.target.value; changed(false); makeThumbnails(); toast('已切换人像模型 · 发型与灯位保留'); };
$('#hairMotion').onchange = event => { hairModel?.setMotion(event.target.checked); requestRender(); };
$('#previewHairMotion').onclick = () => { if (state.hair.style === 'none') { toast('先选择一种发型'); return; } hairModel?.nudge(); requestRender(); };
$$('[data-hair-color]').forEach(b => b.onclick = () => { state.hair.color = b.dataset.hairColor; changed(false); makeThumbnails(); });
$('#resetFramingBtn').onclick = () => { state.framing = clone(defaults.framing); state.headPitch = state.headRoll = 0; changed(false); resize(); };
$('#compositionGrid').onclick = toggleGrid;
$('#inspectBtn').onclick = () => { inspect = !inspect; $('#inspectBtn').setAttribute('aria-pressed', inspect); $('#inspectBtn').classList.toggle('active', inspect); analyzeFrame(); if (view === 'scene') toast('亮度检查在相机视角中显示'); };
$('#saveABtn').onclick = () => {
  if (!ready || !hairModel.isReady()) return;
  if (compare) setCompare(false);
  const [w, h] = captureDimensions(.4);
  baselineA = { image: captureData(w, h, .9), state: clone(state) };
  $('#abStatus').textContent = `A 已保存：${snapshotMeta(state)}。继续调节后打开对照。`; syncExtendedUI(); toast('已保存 A · 可以继续改灯、换方法或调整构图');
};
$('#compareABBtn').onclick = () => {
  if (!ready || !baselineA || !hairModel.isReady()) return;
  if (compare) setCompare(false);
  const [w, h] = captureDimensions(.4);
  comparisonB = { image: captureData(w, h, .9), state: clone(state) };
  $('#abImageA').src = baselineA.image; $('#abImageB').src = comparisonB.image;
  $('#abMetaA').textContent = snapshotMeta(baselineA.state); $('#abMetaB').textContent = snapshotMeta(comparisonB.state);
  $('#abModal').showModal();
};
$('#restoreABtn').onclick = () => { if (!baselineA) return; state = validateSetup(baselineA.state); changed(false); resize(); $('#abModal').close(); toast('已恢复 A 的灯光、姿态、构图与曝光'); };
$('#downloadABBtn').onclick = async () => {
  try {
    await Promise.all([$('#abImageA').decode(), $('#abImageB').decode()]);
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 1080;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#151c18'; ctx.fillRect(0, 0, 1440, 1080);
    [$('#abImageA'), $('#abImageB')].forEach((img, i) => { const scale = Math.min(680 / img.naturalWidth, 900 / img.naturalHeight), w = img.naturalWidth * scale, h = img.naturalHeight * scale; ctx.drawImage(img, i * 720 + (720 - w) / 2, 90 + (900 - h) / 2, w, h); ctx.fillStyle = '#e9c792'; ctx.font = '22px sans-serif'; ctx.fillText(i ? 'B' : 'A', 24 + i * 720, 48); });
    ctx.fillStyle = '#aab4a5'; ctx.font = '16px sans-serif'; ctx.fillText('LIGHTFIELD · 布光对照', 24, 1046);
    download(withImageAttribution(canvas.toDataURL('image/jpeg', .94), [...new Set([...imageCredits(baselineA.state), ...imageCredits(comparisonB.state)])]), 'lightfield-ab-comparison.jpg');
  } catch { toast('对照图下载失败，请重试'); }
};

buildRecipeCards(); buildAcademy(); buildContextAdvice(); syncUI(); initialize();
