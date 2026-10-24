import { lightRatio, recipes } from './lighting.js';
export const goals = { auto: '跟随当前方法', soft: '自然柔和', shape: '立体塑形', highkey: '清爽高调', lowkey: '戏剧低调', rim: '轮廓分离', framing: '构图与留白' };
export const concerns = { none: '整体观察', eyes: '眼窝 / 鼻下太暗', flat: '脸太平，层次不够', harsh: '阴影边缘太硬', separation: '人物融入背景', detail: '面部太亮，担心细节' };
export function evaluateAdvice(setup, requestedGoal = 'auto', concern = 'none', lastRecipe = 'rembrandt') {
  const { key, fill, rim } = setup.lights, ratio = lightRatio(setup.lights);
  const angularSize = key.size / (key.distance * 100);
  const exposure = setup.camera.iso / 100 * (5.6 / setup.camera.aperture) ** 2 * 2 ** setup.environment.exposureEV;
  const id = Object.hasOwn(recipes, setup.preset) ? setup.preset : lastRecipe;
  const inferred = { clamshell: 'soft', window: 'soft', highkey: 'highkey', lowkey: 'lowkey', rim: 'rim', broad: 'shape', short: 'shape' }[id] || 'shape';
  const goal = Object.hasOwn(goals, requestedGoal) && requestedGoal !== 'auto' ? requestedGoal : inferred;
  const result = (title, observation, next, topic, level = 'info') => ({ title, observation, next, topic, level, goal });
  if (setup.solo !== 'none') {
    const l = setup.lights[setup.solo], label = { key: '主光', fill: '补光', rim: '轮廓光' }[setup.solo];
    return !l.enabled || !l.power
      ? result(`当前观察的${label}没有发光`, '单灯模式只显示选中灯，其他灯与环境光暂时隐藏；背景依然可见。', `打开${label}并增加强度，或点“全部”恢复整体照明后再判断。`, 'direction', 'watch')
      : result(`先单独读懂${label}，再看整体`, `正在单灯观察，${label}之外的照明与环境光暂时隐藏。此时的暗部不代表完整方案。`, setup.solo === 'rim' ? '检查边缘亮线，再点“全部”确认它是否抢过脸部。' : '观察这盏灯形成的阴影方向，再点“全部”比较叠加后的变化。', setup.solo === 'rim' ? 'mood' : 'direction');
  }
  if (!Object.values(setup.lights).some(l => l.enabled && l.power > 0)) return result('当前没有有效的灯具照明', '三盏灯都关闭或强度为零，画面可能主要依靠环境光。', '先开启一盏主光，决定方向，再考虑补光与轮廓。', 'direction', 'watch');
  if (concern === 'eyes') return key.elevation > 40
    ? result('先降低主光高度，检查眼窝与鼻影', `主光仰俯为 ${key.elevation}°，较高的灯位可能让眼窝变暗；这里只能依据灯位提示。`, '每次降低 3–5°，同时观察鼻影长度；再决定是否需要下方弱补光。当前模型闭眼，不能评价眼神光。', 'direction', 'watch')
    : result('用小幅转头或弱补光检查局部阴影', '主光并非特别高；脸的方向、鼻梁与颧骨仍会影响眼窝受光。', '先微调下巴与朝向，再试上下夹光中的下方弱补光；避免把全脸曝光一并推高。', 'shape');
  if (concern === 'flat') return setup.environment.ambient >= 10 || (ratio && ratio.ratio < 2)
    ? result('先减弱填进暗部的光', `环境光 ${setup.environment.ambient.toFixed(1)}%${ratio ? `，主/补入射估算 ${ratio.ratio.toFixed(1)}:1` : ''}，这些设置可能缩小明暗差。`, '先只降低环境光或补光中的一项，保留主光方向；保存 A/B 比较。', 'contrast', 'watch')
    : result('尝试改变方向，而非继续加大强度', '目前并非强补光状态。主光越接近相机轴线，面部投影通常越不明显。', '把主光向侧方移动约 5–10°，或保持灯位只转头，检查鼻影与脸颊起伏。', 'direction');
  if (concern === 'harsh' || (concern === 'none' && goal === 'soft')) return angularSize < .35
    ? result('让光源从脸的位置看起来更大', `主光直径 ${key.size} cm、距离 ${key.distance.toFixed(1)} m，相对大小偏小。`, '先增大直径，或把主光移近；距离改变后再补偿亮度，比较鼻影边缘。', 'softness', 'watch')
    : result('光源已相对较大，接着控制暗部层次', `主光 ${key.size} cm / ${key.distance.toFixed(1)} m；柔度与整张画面的明暗差是不同问题。`, '观察鼻影边缘是否柔和；若仍觉得反差大，少量增加补光，别只追求把所有阴影照没。', 'softness');
  if (concern === 'separation' || (concern === 'none' && goal === 'rim')) return !rim.enabled || !rim.power
    ? result('先建立人物和背景的分离', '轮廓光未开启或没有有效强度；深背景与暗侧可能接近。', '开启后侧轮廓光，先用低强度，单灯检查边缘；也可调整背景亮度。', 'mood', 'watch')
    : result('轮廓光已开启，检查它是否适量', `后侧光水平 ${rim.azimuth}°、强度 ${rim.power.toFixed(1)}%；${setup.hair?.style !== 'none' ? setup.hair?.color === 'light' ? '浅发色较容易显出亮部，留意发束是否过亮。' : '深色发束可先观察边缘分离，不必把整片头发提到很亮。' : '当前无发，可先看头部边缘。'}开着不等于已经照在合适位置。`, '单独观察轮廓光，确保主要照亮边缘；回到“全部”，避免它压过脸部。', 'mood');
  if (concern === 'detail') return exposure > 2
    ? result('先检查人像曝光，保住亮部细节', `相机与补偿组合约为基础亮度的 ${exposure.toFixed(1)} 倍，仍需结合实际画面判断。`, '先把人像曝光补偿降低 0.3–0.7 EV，再看皮肤纹理；亮度检查不是 RAW 溢出检测。', 'mood', 'watch')
    : result('区分皮肤高亮与浅色背景', '当前曝光组合接近基础范围，局部亮度仍受灯距、灯强和材质影响。', '打开亮度检查，自己确认标色落在面部还是背景；必要时降低主光或人像曝光，别仅凭全图占比判断肤色。', 'mood');
  if (goal === 'lowkey') {
    if (setup.environment.ambient > 5) return result('低调目标：先收住环境光', `环境光为 ${setup.environment.ambient.toFixed(1)}%，会整体托起阴影。`, '先把环境光降到较低范围，保留主光亮部，再决定需要多少补光。', 'contrast', 'watch');
    if (fill.enabled && ratio && ratio.ratio < 4) return result('低调目标：减少不必要的补光', `主/补入射估算 ${ratio.ratio.toFixed(1)}:1，暗部可能被补得较足。`, '先试 4:1 或 8:1，再观察脸部暗侧是否仍有需要保留的信息。', 'contrast');
    return result('低调目标：选择亮哪里，而非一起压暗', `环境光 ${setup.environment.ambient.toFixed(1)}%，${setup.background === 'black' ? '已使用深背景' : '背景仍可继续调整'}。`, '保持曝光，微调主光方向，选择保留的亮面；若边缘消失，再加少量轮廓光。', 'mood');
  }
  if (goal === 'highkey') return setup.background !== 'white'
    ? result('高调目标：先安排明亮区域的面积', '当前不是浅白背景；单独增加脸部曝光不一定形成高调画面。', '先换浅白背景，再用较柔的主光和适量补光；保留皮肤纹理。', 'mood')
    : result('高调目标：明亮也要保留细微层次', '当前使用浅白背景。背景高亮会影响全画面直方图，不能据此认定脸部过曝。', '结合面部纹理与亮度检查微调曝光；补光只需托起暗部，避免把脸照平。', 'mood');
  if (goal === 'framing') return result('先选画幅，再安排主体和留白', `当前画幅 ${setup.framing.aspect}、水平偏移 ${setup.framing.shiftX}%、焦距 ${setup.camera.focalLength} mm。`, '打开三分线，保持光线不变，只调整构图偏移；居中也可以成立，比较哪种位置更符合表达。', 'composition');
  if (!key.enabled || !key.power) return result('塑形目标：先让主光建立方向', '主光当前关闭或强度为零，其他光仍可能照亮人物。', '开启主光并单独观察，确定鼻影方向，再恢复其他灯。', 'direction', 'watch');
  if (setup.environment.ambient >= 12 || (ratio && ratio.ratio < 2)) return result('塑形目标：给暗侧留一点空间', `环境光 ${setup.environment.ambient.toFixed(1)}%${ratio ? `，主/补入射估算 ${ratio.ratio.toFixed(1)}:1` : ''}。`, '先减少一项填充照明，再观察鼻影、颧骨和暗侧；硬光柔光都可以有立体感。', 'contrast');
  return result(`${recipes[id]?.name || '当前布光'}：把判断放回阴影`, `主光水平 ${key.azimuth}°、仰俯 ${key.elevation}°，人像转向 ${setup.headYaw}°。`, recipes[id]?.steps[0] || '一次只改一个变量，观察鼻影与脸颊的连接，保存 A/B 对照。', 'direction');
}
