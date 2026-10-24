import * as THREE from './vendor/three.module.js';
import {loadMaleGeometry} from './male.js';
import {loadFemaleGeometry} from './female.js';
import {createNeckRig} from './neck.js';
import {createHair} from './hair-fibers.js';
import {loadHeadCollider} from './head-collider.js';
import {studioShadows} from './studio-shadows.js';
const $=s=>document.querySelector(s),host=$('main'),status=$('#status');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.45;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;
host.prepend(renderer.domElement);const scene=new THREE.Scene();scene.background=new THREE.Color('#282d30');
const ambient=new THREE.HemisphereLight(0xffffff,0x777777,2);scene.add(ambient);
const inspectionLight=new THREE.DirectionalLight(0xffffff,2);scene.add(inspectionLight);
const lights=[['key',[-1,1.2,1.7],65,.4],['fill',[1,.5,1.5],18,.5],['rim',[.9,1,-1.2],38,.3]].map(([id,p,power,radius])=>{
 const l=new THREE.SpotLight(0xffffff,power,10,.7,.65,2);l.name=id;l.position.set(...p);l.target.position.set(0,.05,0);l.castShadow=true;l.shadow.mapSize.set(id==='key'?2048:1024,id==='key'?2048:1024);l.shadow.bias=-.00008;l.shadow.normalBias=.002;l.shadow.camera.near=.1;l.shadow.camera.far=5;l.userData.emitterRadius=radius;scene.add(l,l.target);return l;
});
const clay=studioShadows.material(new THREE.MeshStandardMaterial({color:'#c4bcae',roughness:.85}));
const normal=new THREE.MeshNormalMaterial();const wire=new THREE.MeshBasicMaterial({color:'#e9ddd1',wireframe:true});
const cameras=Array.from({length:4},()=>new THREE.OrthographicCamera(-.62,.62,.52,-.52,.01,10));
const avatars={};let active,pending=false,frames=0,lastMs=0,wasMoving=false;
function request(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;render();});}
function render(){if(!active)return;const start=performance.now(),moving=active.hair.step(start);if(moving||wasMoving)renderer.shadowMap.needsUpdate=true;wasMoving=moving;renderer.info.reset();renderer.setScissorTest(true);const w=host.clientWidth,h=host.clientHeight;
 for(let i=0;i<4;i++){const x=i%2*w/2,y=i<2?h/2:0,c=cameras[i];inspectionLight.position.copy(c.position);renderer.setViewport(x,y,w/2,h/2);renderer.setScissor(x,y,w/2,h/2);renderer.render(scene,c);}
 renderer.setScissorTest(false);lastMs=performance.now()-start;frames++;status.textContent=`就绪 · ${$('#subject').value} · ${$('#surface').value} · 姿态 ${$('#pose').value} · 发型 ${$('#hair').value} · 可见胸像 ${Object.values(avatars).filter(a=>a.rig.mesh.visible).length} · 可见发型 ${active.hair.root.visible?active.hair.root.children.filter(c=>c.visible).length:0} · Draws(四视图) ${renderer.info.render.calls} · Triangles ${renderer.info.render.triangles} · Geometries ${renderer.info.memory.geometries} · CPU submit ${lastMs.toFixed(1)} ms · 帧 ${frames} · ${moving?'摆动中':'稳定'}`;status.dataset.ready=String(active.hair.isReady());status.dataset.settings=[...document.querySelectorAll('select')].map(e=>e.value).join('|');if(moving)request();}
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);const extent=$('#zoom').value==='close'?.38:.54,target=$('#zoom').value==='close'?-.17:.04,aspect=w/h;
 const positions=[[0,target,2],[0,target,-2],[-2,target,0],[2,target,0]];cameras.forEach((c,i)=>{c.left=-extent*aspect;c.right=extent*aspect;c.top=extent;c.bottom=-extent;c.position.set(...positions[i]);c.lookAt(0,target,0);c.updateProjectionMatrix();});request();}
function update(){if(!avatars[$('#subject').value])return;renderer.shadowMap.needsUpdate=true;active=avatars[$('#subject').value];const mode=$('#surface').value,shadows=mode==='skin'||mode==='flatnormal'||mode==='native';
 for(const a of Object.values(avatars))a.rig.mesh.visible=a===active;
 active.rig.setPose(...$('#pose').value.split(',').map(Number));active.rig.mesh.material=mode==='clay'?clay:mode==='normals'?normal:mode==='wire'?wire:mode==='unlit'?active.unlit:mode==='native'?active.native:active.skin;
 renderer.toneMappingExposure=mode==='clay'?1:.45;active.skin.normalScale.setScalar(mode==='flatnormal'?0:active.normalScale);active.rig.mesh.receiveShadow=shadows;active.rig.mesh.castShadow=shadows;
 for(const s of active.parts){s.visible=!['clay','normals','wire'].includes(mode)||s.userData.original.name==='Eyes';s.material=['clay','normals','wire'].includes(mode)?active.rig.mesh.material:s.userData.original;s.receiveShadow=shadows;}
 ambient.intensity=['clay','normals','wire'].includes(mode)?1.4:($('#light').value==='all'?.035:0);inspectionLight.visible=mode==='clay';
 for(const l of lights)l.visible=!['clay','normals','wire'].includes(mode)&&($('#light').value==='all'||$('#light').value===l.name);
 studioShadows.update(lights);renderer.shadowMap.enabled=shadows;active.hair.update({style:$('#hair').value,color:'dark'});resize();}
for(const el of document.querySelectorAll('select'))el.onchange=update;$('#sway').onclick=()=>{active.hair.nudge();request();};
try{const manager=new THREE.LoadingManager();const assets=await Promise.all([loadMaleGeometry(manager),loadFemaleGeometry(manager),loadHeadCollider('male'),loadHeadCollider('female')]);
 for(let i=0;i<2;i++){const id=i?'female':'male',asset=assets[i],native=asset.material.clone(),skin=studioShadows.material(asset.material),rig=createNeckRig(asset.geometry,skin,{subject:id});rig.mesh.castShadow=rig.mesh.receiveShadow=true;scene.add(rig.mesh);
 const parts=asset.parts.map(p=>{const s=rig.attachSurface(p.geometry,studioShadows.material(p.material),{castShadow:['Beard','Lashes'].includes(p.material.name),receiveShadow:true,rootAttribute:p.material.name==='Beard'?'_beard_root':undefined});s.userData.original=p.material;return s;});
 const hair=createHair(asset.geometry,()=>{renderer.shadowMap.needsUpdate=true;request();},id,assets[i+2]);rig.attachHair(hair.root);avatars[id]={rig,skin,native,unlit:new THREE.MeshBasicMaterial({map:skin.map}),parts,hair,normalScale:skin.normalScale.x};}
 update();new ResizeObserver(resize).observe(host);
}catch(e){status.textContent='诊断失败：'+e.message;console.error(e);}

const gl=renderer.getContext(),gpuInfo=gl.getExtension('WEBGL_debug_renderer_info'),gpu=gpuInfo?gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL):'WebGL2 renderer (name unavailable)';
$('#benchmark').onclick=async()=>{
 const button=$('#benchmark'),output=$('#benchmarkResult');button.disabled=true;output.dataset.complete='false';output.textContent='基准运行中（四视图，固定模型与灯光）…';
 const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2'),queries=[],results=[];
 for(const cache of [false,true]){const cpu=[],draws=[];for(let i=0;i<16;i++){
  await new Promise(resolve=>requestAnimationFrame(resolve));
  if(!cache)renderer.shadowMap.needsUpdate=true;
  const query=extension?gl.createQuery():null;if(query)gl.beginQuery(extension.TIME_ELAPSED_EXT,query);
  render();if(query){gl.endQuery(extension.TIME_ELAPSED_EXT);queries.push({cache,query});}if(i>3){cpu.push(lastMs);draws.push(renderer.info.render.calls);}}
  results.push({cache,cpuMedian:cpu.sort((a,b)=>a-b)[Math.floor(cpu.length/2)],draws:draws.reduce((a,b)=>a+b)/draws.length});}
 let gpuResults=[];
 if(extension){for(let i=0;i<100&&queries.some(({query})=>!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE));i++)await new Promise(resolve=>requestAnimationFrame(resolve));
  if(!gl.getParameter(extension.GPU_DISJOINT_EXT))for(const cache of [false,true]){const values=queries.filter(q=>q.cache===cache&&gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE)).map(q=>gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6).slice(4).sort((a,b)=>a-b);if(values.length)gpuResults.push({cache,medianMs:values[Math.floor(values.length/2)]});}
  queries.forEach(({query})=>gl.deleteQuery(query));}
 const report={gpu,pixelRatio:renderer.getPixelRatio(),width:host.clientWidth,height:host.clientHeight,subject:$('#subject').value,hair:$('#hair').value,surface:$('#surface').value,views:4,cpuSubmission:results,gpuTiming:gpuResults};
 output.textContent=JSON.stringify(report);output.dataset.complete='true';button.disabled=false;
};
