import {cameraDefaults,framingDefaults,validateCamera,validateFraming} from './camera-system.js';
export const clone = value => JSON.parse(JSON.stringify(value));
export const lightMeta = {
  key: { name: '主光柔光箱', desc: '主光 · KEY LIGHT', color: '#e9bb7b', short: '主光' },
  fill: { name: '补光柔光箱', desc: '补光 · FILL LIGHT', color: '#94b7c4', short: '补光' },
  rim: { name: '轮廓柔光箱', desc: '轮廓光 · RIM LIGHT', color: '#ad9dbd', short: '轮廓' }
};
export const palettes = { charcoal: ['#343b35', '#151b18'], olive: ['#535745', '#23291e'], warm: ['#776251', '#352a24'], slate: ['#4b6069', '#1d2c34'], white: ['#e7e6df', '#bcbdb7'], black: ['#101312', '#030504'] };
export const defaults = {
  version: 3, preset: 'rembrandt', selected: 'key', solo: 'none',
  lights: {
    key: { enabled: true, azimuth: -50, elevation: 30, distance: 2, power: 70, size: 60, temperature: 5200 },
    fill: { enabled: false, azimuth: 35, elevation: 10, distance: 2.6, power: 18, size: 100, temperature: 5600 },
    rim: { enabled: false, azimuth: 135, elevation: 25, distance: 2, power: 50, size: 40, temperature: 6000 }
  },
  camera: clone(cameraDefaults),
  headYaw: 0, headPitch: 0, headRoll: 0, background: 'charcoal', material: 'skin', subject: 'male', hair: { style: 'none', color: 'dark' },
  environment: { ambient: 3.5, backgroundEV: 0, exposureEV: 0 },
  framing: clone(framingDefaults)
};
export const recipes = {
  rembrandt: { name: '伦勃朗光', en: 'REMBRANDT', category: 'classic', title: '看暗侧的三角亮区。', tip: '主光从侧上方照来，让鼻影接到脸颊暗部。观察亮区随转头与灯位变化，而不是追一个固定角度。', key: { azimuth: -50, elevation: 30, size: 60 }, steps: ['先关补光，只移动主光，找到鼻影与脸颊暗部的连接。','把主光左右移动 5°，比较三角亮区的大小。','少量增加补光，保留暗部细节，再拍摄前后两张。'] },
  loop: { name: '环状光', en: 'LOOP', category: 'classic', title: '让鼻影保留一小段间隔。', tip: '鼻影向侧下方延伸，但不连接脸颊暗部。Loop 是环状鼻影，和环形灯的正面环形照明不同。', key: { azimuth: -28, elevation: 24, size: 65 }, steps: ['从相机旁的侧上方放置主光。','缓慢向侧面移动，保持鼻影与脸颊暗部不相接。','比较 30 cm 和 100 cm 光源的阴影边缘。'] },
  split: { name: '分割光', en: 'SPLIT', category: 'classic', title: '让明暗交界穿过面部。', tip: '主光从接近正侧面照来，半张脸进入阴影。轻微转头会明显改变亮面面积。', key: { azimuth: -90, elevation: 12, size: 35 }, steps: ['将主光放在侧方，保持补光关闭。','转头 ±10°，观察中央明暗交界。','加一点补光，比较黑暗与有细节的暗部。'] },
  butterfly: { name: '蝴蝶光', en: 'BUTTERFLY', category: 'classic', title: '正面高光，鼻下留影。', tip: '主光在相机轴线上方，鼻下出现相对对称的阴影。灯太高时眼窝容易变暗。', key: { azimuth: 0, elevation: 40, size: 65 }, steps: ['主光置于正前上方，先观察鼻下阴影。','逐渐降低主光高度，比较眼窝与颧骨。','切换上下夹光，比较补光对下巴阴影的作用。'] },
  clamshell: { name: '上下夹光', en: 'CLAMSHELL', category: 'soft', title: '用下方补光，托起面部暗部。', tip: '上方主光塑形，下方较弱的补光提亮鼻下与下巴。这里用第二盏灯近似反光板效果，不模拟真实反射。', key: { azimuth: 0, elevation: 35, distance: 1.8, size: 100, power: 65 }, fill: { enabled: true, azimuth: 0, elevation: -18, distance: 1.5, size: 100, power: 20 }, steps: ['上下两灯都对着脸，上方负责主要照明。','单独观察补光，确认它从面部下方照来。','逐步增加补光，避免下方比上方更亮。'] },
  broad: { name: '宽光', en: 'BROAD', category: 'shape', title: '把可见面积较大的脸颊照亮。', tip: '人像略转离主光，让朝向相机的较宽一侧受光。宽光与窄光描述亮面和相机的关系，可以与鼻影模式组合。', key: { azimuth: -40, elevation: 25, size: 70 }, headYaw: 25, steps: ['把脸转向画面右侧，主光从左前方照来。','观察面向相机的较宽脸颊是否受光。','保持转头不变，切换窄光做 A/B 比较。'] },
  short: { name: '窄光', en: 'SHORT', category: 'shape', title: '让较窄的远侧脸颊受光。', tip: '人像转向主光，让相机看见更多暗侧。和宽光比较亮面比例，感受脸部体积。', key: { azimuth: 55, elevation: 25, size: 70 }, headYaw: 25, steps: ['保持脸向画面右侧，主光移到右前方。','观察朝向相机的较宽脸颊进入暗部。','只增加补光，比较轮廓感如何变弱。'] },
  window: { name: '窗边柔光', en: 'WINDOW LIGHT', category: 'soft', title: '让大光源靠近，再保留方向。', tip: '用近距离的大柔光箱近似窗边散射光。窗户不是无方向的光，脸与窗的相对方向仍决定鼻影。', key: { azimuth: -65, elevation: 15, distance: 1.3, size: 120, power: 32, temperature: 6000 }, environment: { ambient: 8 }, background: 'warm', steps: ['从侧前方的大光源开始，先观察柔和的阴影边缘。','把光源拉远，保持大小，观察它相对人像变小。','再调整强度补回亮度，分开比较亮度与光质。'] },
  highkey: { name: '高调人像', en: 'HIGH KEY', category: 'mood', title: '明亮的画面，也需要细微层次。', tip: '用柔和主光、较足补光与浅背景建立明亮基调。高调不等于把肤色推成没有细节的白色。', key: { azimuth: -25, elevation: 25, size: 120, power: 75 }, fill: { enabled: true, azimuth: 30, elevation: 10, distance: 2, size: 120, power: 42 }, background: 'white', environment: { ambient: 12, backgroundEV: .2, exposureEV: .3 }, steps: ['保留浅背景，观察补光如何缩小明暗差。','打开亮度检查，区分明亮背景和面部高亮。','微调曝光补偿，让皮肤亮但不失去纹理。'] },
  lowkey: { name: '低调人像', en: 'LOW KEY', category: 'mood', title: '让亮部有选择地出现。', tip: '用深背景、低环境光和侧向主光保留大片暗部。低调仍要让关键轮廓和亮部可辨认。', key: { azimuth: -65, elevation: 25, size: 25, power: 50 }, background: 'black', environment: { ambient: 0, exposureEV: -.2 }, steps: ['先用单灯决定想保留哪一侧的形体。','保持曝光不变，只增加环境光，比较暗部变化。','轻开轮廓光，让人物和背景分离。'] },
  rim: { name: '逆光与轮廓', en: 'RIM & SEPARATION', category: 'mood', title: '先看边缘，再决定脸要多亮。', tip: '后侧光勾勒轮廓，弱正面主光保留面部。轮廓太亮会抢走注意力，需单灯检查。', key: { azimuth: -20, elevation: 15, size: 90, power: 16 }, rim: { enabled: true, azimuth: 140, elevation: 20, distance: 1.7, power: 65, size: 35, temperature: 6500 }, background: 'black', environment: { ambient: 1 }, steps: ['单独观察轮廓光，找头部边缘与鼻尖的亮线。','回到全部灯光，加入少量正面照明。','降低轮廓光强度，避免边缘比面部更抢眼。'] }
};
export function recipeSetup(id, appearance = {}) {
  if (!Object.hasOwn(recipes, id)) throw new Error('未知布光方法');
  const recipe = recipes[id], result = clone(defaults);
  for (const field of ['key', 'fill', 'rim']) Object.assign(result.lights[field], recipe[field]);
  Object.assign(result.environment, recipe.environment);
  result.headYaw = recipe.headYaw || 0; result.background = recipe.background || 'charcoal';
  result.material = appearance.material === 'clay' ? 'clay' : 'skin'; result.preset = id;
  result.subject = appearance.subject === 'female' ? 'female' : 'male';
  if (appearance.hair && ['none', 'short', 'bob', 'curly'].includes(appearance.hair.style) && ['dark', 'light'].includes(appearance.hair.color)) result.hair = clone(appearance.hair);
  if (appearance.camera) result.camera = validateCamera(appearance.camera);
  if (appearance.framing) result.framing = validateFraming(appearance.framing);
  return result;
}
export function validateSetup(input) {
  if (!input || typeof input !== 'object' || !input.lights || !input.camera) throw new Error('文件中缺少灯光或相机参数');
  const result = clone(defaults);
  const limits = { azimuth: [-150, 150], elevation: [-20, 75], distance: [.8, 4], power: [0, 100], size: [10, 120], temperature: [2800, 8000] };
  const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  for (const id of Object.keys(lightMeta)) {
    const light = input.lights[id];
    if (!light || typeof light.enabled !== 'boolean') throw new Error('灯光参数不完整');
    result.lights[id].enabled = light.enabled;
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (!number(light[key], min, max)) throw new Error('灯光参数超出支持范围');
      result.lights[id][key] = light[key];
    }
  }
  result.camera = validateCamera(input.camera);
  if (!number(input.headYaw, -60, 60)) throw new Error('人像转向参数无效'); result.headYaw = input.headYaw;
  for (const key of ['headPitch', 'headRoll']) { if (input[key] !== undefined) { if (!number(input[key], -15, 15)) throw new Error('头部姿态无效'); result[key] = input[key]; } }
  if (!Object.hasOwn(palettes, input.background) || !['skin', 'clay'].includes(input.material)) throw new Error('场景参数无效');
  result.background = input.background; result.material = input.material;
  if (input.subject !== undefined && !['male','female'].includes(input.subject)) throw new Error('人像模型无效');
  result.subject = input.subject || 'male';
  result.preset = Object.hasOwn(recipes, input.preset) ? input.preset : 'custom';
  result.selected = Object.hasOwn(lightMeta, input.selected) ? input.selected : 'key';
  if (input.solo !== undefined) { if (!['none', 'key', 'fill', 'rim'].includes(input.solo)) throw new Error('单灯观察设置无效'); result.solo = input.solo; }
  for (const [key, min, max] of [['ambient', 0, 30], ['backgroundEV', -2, 2], ['exposureEV', -2, 2]]) {
    if (input.environment?.[key] !== undefined) { if (!number(input.environment[key], min, max)) throw new Error('光影控制参数无效'); result.environment[key] = input.environment[key]; }
  }
  result.framing = validateFraming(input.framing);
  if (input.hair) {
    if (!['none', 'short', 'bob', 'curly'].includes(input.hair.style) || !['dark', 'light'].includes(input.hair.color)) throw new Error('发型或发色设置无效');
    result.hair = { style: input.hair.style, color: input.hair.color };
  }
  return result;
}
// Relative incident illumination at the face centre; no surface normals, bounce or ambient.
export function incident(light) { return light.enabled ? light.power / (light.distance * light.distance) : 0; }
export function lightRatio(lights) {
  const key = incident(lights.key), fill = incident(lights.fill);
  if (key <= 0 || fill <= 0) return null;
  return { ratio: key / fill, stops: Math.log2(key / fill) };
}
export function setRatio(setup, ratio) {
  if (![1, 2, 4, 8].includes(ratio)) throw new Error('不支持的光比');
  const result = clone(setup), key = result.lights.key, fill = result.lights.fill;
  key.enabled = true; if (!key.power) key.power = 50;
  fill.enabled = true;
  const required = key.power * (fill.distance / key.distance) ** 2 / ratio;
  const scale = Math.min(1, 100 / required);
  key.power = Math.min(100, key.power * scale); fill.power = Math.min(100, required * scale);
  result.solo = 'none'; result.preset = 'custom';
  return result;
}
export function histogram(pixels) {
  const bins = Array(64).fill(0); let shadows = 0, highlights = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const value = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
    bins[Math.min(63, Math.floor(value / 4))]++;
    if (value <= 8) shadows++;
    if (value >= 250) highlights++;
  }
  const count = pixels.length / 4 || 1;
  return { bins, shadows: shadows / count * 100, highlights: highlights / count * 100 };
}
