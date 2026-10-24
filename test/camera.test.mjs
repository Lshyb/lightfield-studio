import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraDefaults,framingDefaults,ratios,focalPresets,shutterPresets,distancePresets,projection,outputDimensions,aspectRatio,positionAtDistance,distanceMetres,framingPosition,validateCamera,validateFraming,parseShutter} from '../dist/camera-system.js';
import {defaults,clone,validateSetup} from '../dist/lighting.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('all ratios have matching physical projection and export crop, including custom and rotated frames',()=>{
  for(const aspect of ratios){const f={...framingDefaults,aspect},p=projection(cameraDefaults,f),[w,h]=outputDimensions(f);near(p.width/p.height,aspectRatio(f));assert.ok(Math.abs(w/h-aspectRatio(f))<.01);assert.ok(p.width<=36&&p.height<=36);}
  for(const [w,h] of [[17,13],[13,17],[10000,1000]])assert.doesNotThrow(()=>validateFraming({...framingDefaults,aspect:'custom',customWidth:w,customHeight:h}));
  assert.throws(()=>validateFraming({...framingDefaults,aspect:'custom',customWidth:10000,customHeight:1}));
});
test('all focal presets and sensor crops use real perspective and keep model-independent camera data',()=>{
  let previous=180;
  for(const focalLength of focalPresets){const c=validateCamera({...cameraDefaults,focalLength}),p=projection(c,framingDefaults);assert.ok(p.verticalFov<previous);previous=p.verticalFov;near(p.height,30);assert.deepEqual(c.position,cameraDefaults.position);}
  for(const sensor of ['full','apsc','canon','mft','custom'])assert.ok(projection({...cameraDefaults,sensor,sensorWidth:40,sensorHeight:30},framingDefaults).verticalFov>0);
  assert.throws(()=>validateCamera({...cameraDefaults,focalLength:NaN}));assert.throws(()=>validateCamera({...cameraDefaults,focalLength:301}));
});
test('distance control follows viewing axis and measures off-axis references in 3D',()=>{
  const pos=[.02,1.5,2.9],ref=[.01,1.47,.15];
  for(const d of [...distancePresets,50,.65,4.35]){const p=positionAtDistance(pos,ref,d);near(distanceMetres(p,ref),d);near(p[0],pos[0]);near(p[1],pos[1]);}
  assert.throws(()=>positionAtDistance([3,0,0],[0,0,0],.2));assert.throws(()=>positionAtDistance(pos,ref,Infinity));
});
test('fixed framing compensates focal and aspect changes, with bounded camera distance',()=>{
  const c=clone(cameraDefaults),ref=[0,1.47,0],f=clone(framingDefaults);
  for(const focalLength of [50,85,135,200]){const next={...c,focalLength},p=framingPosition(c,f,next,f,ref);near(Math.abs(p[2])*projection(next,f).height/focalLength,Math.abs(c.position[2])*projection(c,f).height/c.focalLength);}
  const nextF={...f,aspect:'16:9'},p=framingPosition(c,f,c,nextF,ref);near(Math.abs(p[2])*projection(c,nextF).height,Math.abs(c.position[2])*projection(c,f).height);
});
test('shutter units, presets, migration, strict manual parsing and unsupported blur are explicit',()=>{
  for(const t of shutterPresets)near(validateCamera({...cameraDefaults,shutterSeconds:t}).shutterSeconds,t);
  near(parseShutter('1/8000 s'),1/8000);near(parseShutter('30s'),30);near(parseShutter('0.008'),1/125);
  for(const s of ['0','1/0','31','1/9000','NaN','1/125foo','Infinity','<script>'])assert.throws(()=>parseShutter(s));
  const legacy=clone(defaults);legacy.version=2;delete legacy.camera.shutterSeconds;legacy.camera.shutterSpeed=60;
  near(validateSetup(legacy).camera.shutterSeconds,1/60);assert.equal(validateCamera({...cameraDefaults,motionBlur:true}).motionBlur,false);
  const round=clone(defaults);round.camera.position=[0,1.4,8];round.camera.focalLength=58.4;round.camera.sensor='custom';round.camera.sensorWidth=32;round.framing.aspect='custom';round.framing.customWidth=17;round.framing.customHeight=13;round.framing.guide='cross';assert.deepEqual(validateSetup(JSON.parse(JSON.stringify(round))),round);
});
test('requested photography combinations have matching metric distance and lens equations',()=>{
  const ref=[0,1.52,.12];
  for(const [focalLength,d] of [[85,1.5],[50,3],[35,5],[135,8]]){const c={...cameraDefaults,focalLength},pos=positionAtDistance(c.position,ref,d);near(distanceMetres(pos,ref),d);const p=projection(c,framingDefaults);near(Math.tan(p.verticalFov*Math.PI/360),p.height/(2*focalLength));}
});
