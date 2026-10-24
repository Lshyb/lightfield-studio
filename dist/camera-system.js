// Camera geometry uses the studio's existing units: a ~48 cm source head is
// calibrated to ~24 cm. This changes camera units only, never avatar scale.
export const METRES_PER_UNIT = .5;
export const ratios = ['1:1','4:3','3:4','3:2','2:3','4:5','5:4','16:9','9:16','21:9','1.85:1','2.39:1'];
export const focalPresets = [12,14,16,18,20,24,28,35,40,50,55,58,70,75,85,100,105,120,135,150,180,200,300];
export const distancePresets = [.2,.3,.4,.5,.6,.7,.8,1,1.2,1.5,1.8,2,2.5,3,3.5,4,5,6,7,8,10,12,15,20,25,30];
export const shutterPresets = [30,15,8,4,2,1,.5,.25,.125,1/15,1/30,1/50,1/60,1/80,1/100,1/125,1/160,1/200,1/250,1/320,1/500,1/1000,1/2000,1/4000,1/8000];
export const sensors = { full: [36,24], apsc: [23.5,15.6], canon: [22.3,14.9], mft: [17.3,13] };
export const cameraDefaults = {
  focalLength:85, aperture:5.6, iso:100, shutterSeconds:1/125,
  sensor:'full', sensorWidth:36, sensorHeight:24,
  mode:'position', reference:'head', position:[0,1.47,2.9],
  // Motion blur is explicitly unsupported by the realtime renderer.
  motionBlur:false
};
export const framingDefaults = {aspect:'4:5',customWidth:4,customHeight:5,shiftX:0,shiftY:0,guide:'none'};
const finite = (n,a,b) => typeof n==='number' && Number.isFinite(n) && n>=a && n<=b;
export function validateCamera(input={}) {
  const c={...cameraDefaults,position:[...cameraDefaults.position]};
  for(const [key,min,max] of [['focalLength',12,300],['shutterSeconds',1/8000,30],['sensorWidth',1,100],['sensorHeight',1,100]]) {
    let value=input[key];
    if(key==='shutterSeconds' && value===undefined && input.shutterSpeed!==undefined) value=1/input.shutterSpeed;
    if(value!==undefined){if(!finite(value,min,max))throw Error('相机数值超出范围');c[key]=value;}
  }
  for(const [key,values] of Object.entries({aperture:[2.8,4,5.6,8,11],iso:[100,200,400,800],sensor:[...Object.keys(sensors),'custom'],mode:['position','framing'],reference:['eyes','face','head','body']})) {
    if(input[key]!==undefined){if(!values.includes(input[key]))throw Error('相机选项无效');c[key]=input[key];}
  }
  if(input.position!==undefined){if(!Array.isArray(input.position)||input.position.length!==3||!input.position.every(n=>finite(n,-200,200)))throw Error('相机位置无效');c.position=[...input.position];}
  if(input.motionBlur!==undefined && typeof input.motionBlur!=='boolean')throw Error('运动模糊选项无效');
  // Unsupported input cannot silently enable a fake effect.
  c.motionBlur=false;
  return c;
}
export function validateFraming(input={}) {
  const f={...framingDefaults};
  if(input.aspect!==undefined){if(![...ratios,'custom'].includes(input.aspect))throw Error('画幅无效');f.aspect=input.aspect;}
  for(const [key,min,max] of [['customWidth',1,10000],['customHeight',1,10000],['shiftX',-30,30],['shiftY',-30,30]]){
    if(input[key]!==undefined){if(!finite(input[key],min,max))throw Error('构图数值无效');f[key]=input[key];}
  }
  if(input.guide!==undefined){if(!['none','thirds','cross','grid'].includes(input.guide))throw Error('辅助线无效');f.guide=input.guide;}
  const r=aspectRatio(f);if(r<.1 || r>10)throw Error('画幅宽高比须在 1:10 至 10:1 之间');
  return f;
}
export function aspectRatio(f){return f.aspect==='custom'?f.customWidth/f.customHeight:f.aspect.split(':').reduce((a,b)=>Number(a)/Number(b));}
export function outputDimensions(f,scale=1){
  const a=aspectRatio(f),long=Math.round(1500*scale);
  return a>=1?[long,Math.max(1,Math.round(long/a))]:[Math.max(1,Math.round(long*a)),long];
}
// The output is an inscribed crop of the physical sensor, rotated for portrait.
export function projection(c,f){
  const a=aspectRatio(f),base=sensors[c.sensor]||[c.sensorWidth,c.sensorHeight];
  const wide=Math.max(...base),short=Math.min(...base);
  const sw=a>=1?wide:short,sh=a>=1?short:wide;
  const width=Math.min(sw,sh*a),height=width/a;
  const radToDeg=180/Math.PI;
  return {width,height,aspect:a,horizontalFov:2*Math.atan(width/(2*c.focalLength))*radToDeg,verticalFov:2*Math.atan(height/(2*c.focalLength))*radToDeg};
}
export function distanceMetres(position,reference){return Math.hypot(...position.map((p,i)=>p-reference[i]))*METRES_PER_UNIT;}
// Move only on the existing viewing axis. Off-axis reference selection leaves
// orientation and lateral offset intact; an unreachable radius is rejected.
export function positionAtDistance(position,reference,metres,forward=[0,0,-1]){
  if(!finite(metres,.2,50))throw Error('拍摄距离须在 0.2–50 m 之间');
  const norm=Math.hypot(...forward);if(!norm)throw Error('相机方向无效');
  const axis=forward.map(v=>v/norm),v=position.map((p,i)=>p-reference[i]);
  const parallel=v.reduce((s,p,i)=>s+p*axis[i],0);
  const lateral=v.map((p,i)=>p-parallel*axis[i]);
  const remaining=(metres/METRES_PER_UNIT)**2-lateral.reduce((s,p)=>s+p*p,0);
  if(remaining<0)throw Error('此参考点偏离观察轴过远，当前方向无法达到该距离');
  const depth=Math.sqrt(remaining);
  return reference.map((p,i)=>p+lateral[i]-axis[i]*depth);
}
export function framingPosition(c,oldFraming,newCamera,newFraming,reference){
  const before=projection(c,oldFraming),after=projection(newCamera,newFraming);
  const oldDepth=reference[2]-c.position[2];
  const depth=oldDepth*(newCamera.focalLength/c.focalLength)*(before.height/after.height);
  const pos=[...c.position];pos[2]=reference[2]-depth;
  const metres=distanceMetres(pos,reference);
  if(metres<.2||metres>50)throw Error('保持构图所需距离超出 0.2–50 m，请先调整焦距或关闭此模式');
  return pos;
}
export function shutterLabel(t){if(t>=1)return `${Number(t.toFixed(3))}`;return `1/${Number((1/t).toFixed(2))}`;}
export function parseShutter(text){
  const s=String(text).trim().replace(/\s*s$/i,'').replace(/\s/g,'');
  if(!/^(?:\d*\.?\d+|1\/\d*\.?\d+)$/.test(s))throw Error('请输入秒数或 1/125 形式');
  const t=s.includes('/')?1/Number(s.slice(2)):Number(s);
  if(!finite(t,1/8000,30))throw Error('快门须在 30 s–1/8000 s 之间');return t;
}
