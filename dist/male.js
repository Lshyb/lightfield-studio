import { loadPortraitGeometry } from './portrait.js';
import { loadBeard } from './beard.js';

export async function loadMaleGeometry(manager) {
  const [asset,beard]=await Promise.all([loadPortraitGeometry('male-portrait.glb',manager),loadBeard()]);
  asset.parts.push(beard);return asset;
}
