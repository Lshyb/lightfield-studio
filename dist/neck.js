import * as THREE from './vendor/three.module.js';
import {createSkinNormalUpdater} from './skin-normals.js';

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const cervicalProfiles = {
  male:{base:-.31,backTop:.005,frontTop:-.14,core:.12,edge:.255,rearOuter:-.31,rearInner:-.23,lower:[0,-.265,-.075],upper:[0,.035,-.070],shares:[0,.9,.3]},
  female:{base:-.29,backTop:.025,frontTop:-.080,core:.080,edge:.180,rearOuter:-.235,rearInner:-.155,lower:[0,-.25,-.055],upper:[0,.005,-.040]}
};
export function neckWeights(x, y, z = 0, subject = 'male') {
  const p=cervicalProfiles[subject]||cervicalProfiles.male;
  // Jaw/occiput follow the skull rigidly. Below them, only the actual cervical
  // envelope blends; height alone must never rotate the scapula or shoulder.
  const top=THREE.MathUtils.lerp(p.backTop,p.frontTop,smooth(.015,.13,z));
  const head=smooth(top-.075,top+.025,y),rise=smooth(p.base,top,y);
  // The envelope widens toward the atlas. A constant narrow cylinder pins
  // lateral neck vertices beside a moving occiput and folds that surface.
  const atlas=smooth(-.22,-.10,y);
  const core=THREE.MathUtils.lerp(p.core,subject==='female'?.14:.15,atlas);
  const edge=THREE.MathUtils.lerp(p.edge,subject==='female'?.23:.295,atlas);
  const rearInner=p.rearInner-atlas*.05,rearOuter=p.rearOuter-atlas*.04;
  const envelope=(1-smooth(core,edge,Math.abs(x)))*smooth(rearOuter,rearInner,z);
  const moving=head+(1-head)*rise*envelope;
  const upper=head+(1-head)*smooth(.38,.94,rise);
  return [1-moving,moving*(1-upper),moving*upper,0];
}
export function createNeckRig(sourceGeometry, material, {subject=sourceGeometry.userData.subject||'male'} = {}) {
  const profile=cervicalProfiles[subject]||cervicalProfiles.male;
  function skinGeometry(source, rootAttribute) {
    const geometry = source.clone(), position = geometry.attributes.position, indices = [], weights = [];
    const roots = (rootAttribute && geometry.getAttribute(rootAttribute)) || position;
    for (let i = 0; i < position.count; i++) {
      indices.push(0, 1, 2, 0); weights.push(...neckWeights(roots.getX(i),roots.getY(i),roots.getZ(i),subject));
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    return geometry;
  }
  const geometry = skinGeometry(sourceGeometry);
  const shoulder = new THREE.Bone(), neck = new THREE.Bone(), skull = new THREE.Bone();
  shoulder.name = 'Shoulders'; neck.name = 'LowerNeck'; skull.name = 'UpperNeckHead';
  neck.position.fromArray(profile.lower); skull.position.fromArray(profile.upper).sub(neck.position);
  shoulder.add(neck); neck.add(skull);
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.add(shoulder);
  mesh.bind(new THREE.Skeleton([shoulder, neck, skull]));
  const normals=createSkinNormalUpdater(geometry,(x,y,z)=>neckWeights(x,y,z,subject));
  const matrices=Array.from({length:3},()=>new THREE.Matrix4());let previousYaw,previousPitch,previousRoll;
  // The head turns about the cervical joints. Shoulder vertices stay in the root bind pose.
  return {
    mesh,
    normalDiagnostics:normals.stats,
    attachSurface(source, surfaceMaterial, options = {}) {
      const surface = new THREE.SkinnedMesh(skinGeometry(source,options.rootAttribute), surfaceMaterial);
      surface.bind(mesh.skeleton, mesh.bindMatrix); mesh.add(surface);
      surface.castShadow = options.castShadow ?? false;
      surface.receiveShadow = options.receiveShadow ?? false;
      return surface;
    },
    setPose(yaw, pitch, roll) {
      const r = THREE.MathUtils.degToRad;
      const [yawShare,pitchShare,rollShare]=profile.shares||[.35,.25,.25];
      neck.rotation.set(r(-pitch*pitchShare),r(yaw*yawShare),r(roll*rollShare),'YXZ');
      skull.rotation.set(r(-pitch*(1-pitchShare)),r(yaw*(1-yawShare)),r(roll*(1-rollShare)),'YXZ');
      mesh.updateMatrixWorld(true);
      if(yaw!==previousYaw||pitch!==previousPitch||roll!==previousRoll){
        mesh.skeleton.bones.forEach((bone,i)=>matrices[i].copy(mesh.bindMatrixInverse).multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix));
        normals.update(matrices);previousYaw=yaw;previousPitch=pitch;previousRoll=roll;
      }
    },
    attachHair(group) {
      group.position.fromArray(profile.upper).negate(); skull.add(group);
    }
  };
}
