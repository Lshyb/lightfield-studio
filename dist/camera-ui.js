import {ratios,focalPresets,distancePresets,shutterPresets,sensors,projection,shutterLabel,parseShutter,validateCamera,validateFraming,framingPosition,positionAtDistance,distanceMetres,cameraDefaults,framingDefaults,outputDimensions} from './camera-system.js';
const $=s=>document.querySelector(s);
const options=(values,format)=>values.map(v=>`<option value="${v}">${format(v)}</option>`).join('');
export function setupCameraUI({getState,getReference,onChange,notify}){
  const panel=$('.camera-settings');panel.className='camera-console';
  panel.innerHTML=`
    <div class="camera-console-title"><span>CAMERA CONTROL</span><b>取景与镜头</b></div>
    <details class="camera-module"><summary><span><i>01</i> 画幅与构图</span><output id="frameSummary"></output></summary><div class="camera-module-body" id="frameModule">
      <div class="camera-inline"><button id="swapAspect" type="button">横 / 竖 ⇄</button><button data-camera-reset="frame" type="button">重置</button></div>
      <div id="customRatio" class="camera-pair"><label>宽<input id="ratioWidth" type="number" min="1" max="10000" step="1"></label><label>高<input id="ratioHeight" type="number" min="1" max="10000" step="1"></label></div>
      <label>构图辅助线<select id="cameraGuide"><option value="none">无</option><option value="thirds">三分法 · 交点</option><option value="cross">中心十字</option><option value="grid">九宫格</option></select></label>
      <p id="outputSize" class="camera-feedback"></p>
    </div></details>
    <details class="camera-module"><summary><span><i>02</i> 快门与运动模糊</span><output id="shutterSummary"></output></summary><div class="camera-module-body">
      <label>快门预设<select id="shutterPreset">${options(shutterPresets,v=>shutterLabel(v)+' s')}<option value="custom">手动数值</option></select></label>
      <div class="camera-pair"><label>手动快门<input id="shutterInput" type="text" inputmode="decimal" placeholder="1/125 或 2"></label><button data-camera-reset="shutter" type="button">重置</button></div>
      <input id="shutterRange" aria-label="快门速度，按曝光挡连续调节" type="range" min="${Math.log2(1/8000)}" max="${Math.log2(30)}" step=".01">
      <label class="camera-check"><input id="motionBlur" type="checkbox" disabled> 运动模糊 · 当前引擎不支持</label>
      <p class="micro-copy">快门记录拍摄参数；当前实时引擎没有时间积分，不产生真实运动模糊，也不随快门自动改变亮度。静止人像保持清晰。</p>
      <details class="camera-advanced"><summary>曝光练习</summary><div class="camera-pair"><label>光圈<select id="aperture">${options([2.8,4,5.6,8,11],v=>'f / '+v)}</select></label><label>感光度<select id="iso">${options([100,200,400,800],v=>'ISO '+v)}</select></label></div><p class="micro-copy">光圈与 ISO 仅作曝光近似，不模拟景深。使用页面下方曝光补偿调节明暗。</p></details>
    </div></details>
    <details class="camera-module" open><summary><span><i>03</i> 镜头与焦距</span><output id="focalSummary"></output></summary><div class="camera-module-body">
      <div class="camera-pair"><label>焦距预设<select id="focalPreset">${options(focalPresets,v=>v+' mm')}<option value="custom">自定义</option></select></label><label>精确焦距 / mm<input id="focalLength" type="number" min="12" max="300" step=".1"></label></div>
      <input id="focalRange" type="range" min="12" max="300" step=".1" aria-label="焦距，毫米">
      <label>工作模式<select id="cameraMode"><option value="position">固定相机位置</option><option value="framing">保持主体构图大小 · 自动移机</option></select></label>
      <div class="camera-inline"><output id="fovValue" class="camera-feedback"></output><button data-camera-reset="lens" type="button">重置</button></div>
      <details class="camera-advanced"><summary>传感器尺寸</summary><label>规格<select id="cameraSensor"><option value="full">全画幅 · 36 × 24 mm</option><option value="apsc">APS-C · 23.5 × 15.6 mm</option><option value="canon">APS-C · 22.3 × 14.9 mm</option><option value="mft">M4/3 · 17.3 × 13 mm</option><option value="custom">自定义</option></select></label><div id="customSensor" class="camera-pair"><label>宽 / mm<input id="sensorWidth" type="number" min="1" max="100" step=".1"></label><label>高 / mm<input id="sensorHeight" type="number" min="1" max="100" step=".1"></label></div><p class="micro-copy">画幅在传感器内裁切；竖幅时转为纵向传感器。视角为裁切后的实际视角。</p></details>
    </div></details>
    <details class="camera-module" open><summary><span><i>04</i> 相机位置与距离</span><output id="distanceSummary"></output></summary><div class="camera-module-body">
      <div class="camera-pair"><label>预设距离<select id="distancePreset">${options(distancePresets,v=>v+' m')}<option value="custom">自定义</option></select></label><label>精确距离 / m<input id="cameraDistance" type="number" min=".2" max="50" step=".05"></label></div>
      <input id="distanceRange" type="range" min=".2" max="50" step=".05" aria-label="拍摄距离，米">
      <label>距离参考点<select id="cameraReference"><option value="eyes">双眼中心</option><option value="face">面部中心</option><option value="head">头部中心</option><option value="body">胸像身体中心</option></select></label>
      <div class="camera-inline"><output id="distanceValueLive" class="camera-feedback"></output><button data-camera-reset="distance" type="button">恢复 1.5 m</button></div>
      <p id="cameraWarning" class="camera-warning" role="status" aria-live="polite"></p>
      <p class="micro-copy">距离为相机至参考点的三维直线距离。现有人物仅有头颈肩；远距离不会生成全身或场景人物。</p>
    </div></details>`;
  const format=$('.format-row');$('#frameModule').prepend(format);
  $('#aspect').innerHTML=options(ratios,v=>v.replace(':',' : '))+'<option value="custom">自定义宽高</option>';
  $('#compositionGrid').hidden=true;
  const commit=(cameraPatch={},framePatch={},compensate=true)=>{
    const state=getState();
    try{
      const camera=validateCamera({...state.camera,...cameraPatch}),framing=validateFraming({...state.framing,...framePatch});
      if(compensate&&camera.mode==='framing'&&(camera.focalLength!==state.camera.focalLength||camera.sensor!==state.camera.sensor||camera.sensorWidth!==state.camera.sensorWidth||camera.sensorHeight!==state.camera.sensorHeight||framing.aspect!==state.framing.aspect||framing.customWidth!==state.framing.customWidth||framing.customHeight!==state.framing.customHeight)){
        camera.position=framingPosition(state.camera,state.framing,camera,framing,getReference(camera.reference));
      }
      state.camera=camera;state.framing=framing;onChange();
    }catch(error){notify(error.message);sync();}
  };
  function setDistance(value){try{const c=getState().camera;commit({position:positionAtDistance(c.position,getReference(c.reference),Number(value))},{},false);}catch(error){notify(error.message);sync();}}
  const number=(id,fn,event='change')=>$(id).addEventListener(event,e=>fn(Number(e.target.value)));
  $('#aspect').onchange=e=>commit({}, {aspect:e.target.value});
  $('#swapAspect').onclick=()=>{const f=getState().framing;const [w,h]=f.aspect==='custom'?[f.customWidth,f.customHeight]:f.aspect.split(':').map(Number);const reversed=`${h}:${w}`;commit({},{aspect:ratios.includes(reversed)?reversed:'custom',customWidth:h,customHeight:w});};
  number('#ratioWidth',v=>commit({},{customWidth:v}));number('#ratioHeight',v=>commit({},{customHeight:v}));
  $('#cameraGuide').onchange=e=>commit({}, {guide:e.target.value},false);
  $('#shutterPreset').onchange=e=>{if(e.target.value!=='custom')commit({shutterSeconds:Number(e.target.value)});};
  $('#shutterInput').onchange=e=>{try{commit({shutterSeconds:parseShutter(e.target.value)});}catch(error){notify(error.message);sync();}};
  number('#shutterRange',v=>commit({shutterSeconds:2**v}),'input');
  number('#focalLength',v=>commit({focalLength:v}));number('#focalRange',v=>commit({focalLength:v}),'input');
  $('#focalPreset').onchange=e=>{if(e.target.value!=='custom')commit({focalLength:Number(e.target.value)});};
  $('#cameraMode').onchange=e=>commit({mode:e.target.value},{},false);
  $('#cameraSensor').onchange=e=>commit({sensor:e.target.value});
  number('#sensorWidth',v=>commit({sensorWidth:v}));number('#sensorHeight',v=>commit({sensorHeight:v}));
  number('#cameraDistance',setDistance);number('#distanceRange',setDistance,'input');
  $('#distancePreset').onchange=e=>{if(e.target.value!=='custom')setDistance(e.target.value);};
  $('#cameraReference').onchange=e=>commit({reference:e.target.value},{},false);
  panel.querySelectorAll('[data-camera-reset]').forEach(b=>b.onclick=()=>{
    const kind=b.dataset.cameraReset;if(kind==='distance')setDistance(1.5);
    else if(kind==='frame')commit({},framingDefaults);
    else if(kind==='shutter')commit({shutterSeconds:cameraDefaults.shutterSeconds});
    else commit({focalLength:85,sensor:'full',sensorWidth:36,sensorHeight:24});
  });
  function sync(){
    const {camera:c,framing:f}=getState(),p=projection(c,f),d=distanceMetres(c.position,getReference(c.reference));
    for(const [id,value] of Object.entries({aspect:f.aspect,ratioWidth:f.customWidth,ratioHeight:f.customHeight,cameraGuide:f.guide,shutterInput:shutterLabel(c.shutterSeconds),shutterRange:Math.log2(c.shutterSeconds),focalLength:c.focalLength,focalRange:c.focalLength,cameraMode:c.mode,cameraSensor:c.sensor,sensorWidth:c.sensorWidth,sensorHeight:c.sensorHeight,cameraReference:c.reference,cameraDistance:Number(d.toFixed(4)),distanceRange:d}))$('#'+id).value=value;
    for(const [id,list,value] of [['shutterPreset',shutterPresets,c.shutterSeconds],['focalPreset',focalPresets,c.focalLength],['distancePreset',distancePresets,d]]){
      const match=list.find(n=>Math.abs(n-value)<1e-6);$('#'+id).value=match===undefined?'custom':match;
    }
    $('#customRatio').hidden=f.aspect!=='custom';$('#customSensor').hidden=c.sensor!=='custom';
    $('#frameSummary').textContent=f.aspect==='custom'?`${f.customWidth}:${f.customHeight}`:f.aspect;
    $('#shutterSummary').textContent=shutterLabel(c.shutterSeconds)+' s';$('#focalSummary').textContent=c.focalLength+' mm';$('#distanceSummary').textContent=d.toFixed(2)+' m';
    $('#fovValue').textContent=`视角 H ${p.horizontalFov.toFixed(1)}° / V ${p.verticalFov.toFixed(1)}°`;
    $('#distanceValueLive').textContent=`实距 ${d.toFixed(3)} m`;
    $('#outputSize').textContent=`输出 ${outputDimensions(f).join(' × ')} px · 辅助线不入照片`;
    const grid=$('#thirds');grid.dataset.guide=f.guide;grid.hidden=f.guide==='none';
    for(const id of ['gridBtn','compositionGrid']){$('#'+id).classList.toggle('active',f.guide!=='none');$('#'+id).setAttribute('aria-pressed',f.guide!=='none');}
    panel.querySelectorAll('input[type=range]').forEach(input=>input.style.setProperty('--pct',(100*(input.value-input.min)/(input.max-input.min))+'%'));
  }
  return {sync,commit,setDistance};
}
