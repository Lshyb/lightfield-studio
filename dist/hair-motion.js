import * as THREE from './vendor/three.module.js';

// Horizontal cross sections enclosing the actual bust.
export function createCollisionProfile(geometry, count = 96, transform, reuse) {
  const attr = geometry.attributes.position, points = [];
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < attr.count; i++) { const p = new THREE.Vector3().fromBufferAttribute(attr, i); transform?.(i,p); points.push(p); low = Math.min(low, p.y); high = Math.max(high, p.y); }
  const data = reuse?.data || new Float32Array(count * 4), range = high - low;
  const slices = Array.from({length:count},()=>[]);
  for (const p of points) {
    const first=Math.max(0,Math.ceil((p.y-.018-low)/range*(count-1))),last=Math.min(count-1,Math.floor((p.y+.018-low)/range*(count-1)));
    for(let i=first;i<=last;i++) slices[i].push(p);
  }
  // Include triangle/plane intersections: checking vertices alone can miss a
  // broad shoulder triangle whose corners are in adjacent cross sections.
  const indices=geometry.index?.array;
  for(let t=0;t<(indices?.length||points.length);t+=3) {
    const triangle=[points[indices?indices[t]:t],points[indices?indices[t+1]:t+1],points[indices?indices[t+2]:t+2]];
    const first=Math.max(0,Math.ceil((Math.min(...triangle.map(p=>p.y))-low)/range*(count-1))),last=Math.min(count-1,Math.floor((Math.max(...triangle.map(p=>p.y))-low)/range*(count-1)));
    for(let i=first;i<=last;i++) {
      const y=low+i/(count-1)*range;
      for(let edge=0;edge<3;edge++) {const a=triangle[edge],b=triangle[(edge+1)%3];
        if((a.y<=y&&b.y>=y||b.y<=y&&a.y>=y)&&Math.abs(b.y-a.y)>1e-8) {const f=(y-a.y)/(b.y-a.y);slices[i].push({x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f});}
      }
    }
  }
  for (let i = 0; i < count; i++) {
    const y = low + i / (count - 1) * range;
    let slice = slices[i];
    if (!slice.length) slice = points.filter(p => Math.abs(p.y - y) < .04);
    let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
    for (const p of slice) { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); }
    const cx = (xmin + xmax) / 2, cz = (zmin + zmax) / 2;
    let rx = Math.max(.008, (xmax - xmin) / 2), rz = Math.max(.008, (zmax - zmin) / 2), factor = 1;
    for (const p of slice) factor = Math.max(factor, Math.hypot((p.x - cx) / rx, (p.z - cz) / rz));
    data.set([rx * factor + .006, rz * factor + .006, cx, cz], i * 4);
  }
  const texture = reuse?.texture || new THREE.DataTexture(data, count, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = texture.magFilter = THREE.NearestFilter; texture.needsUpdate = true;
  return { data, low, high, count, texture };
}

export function springStep(offset, velocity, dt) {
  // Substeps keep damping stable after a slow frame or a background-tab pause.
  dt = Math.min(.06, Math.max(0, dt));
  const steps = Math.max(1, Math.ceil(dt / .008)), h = dt / steps;
  for (let i = 0; i < steps; i++) {
    velocity.addScaledVector(offset, -95 * h).multiplyScalar(Math.exp(-11 * h));
    offset.addScaledVector(velocity, h);
    if (offset.length() > .036) { offset.clampLength(0, .036); velocity.multiplyScalar(.7); }
  }
  return offset.lengthSq() + velocity.lengthSq() > 2e-8;
}

export function createNeckCollisionProxy(geometry) {
  const source=geometry.attributes.position,indices=geometry.index?.array,used=new Set(),triangles=[];
  for(let t=0;t<(indices?.length||source.count);t+=3) {
    const face=[0,1,2].map(k=>indices?indices[t+k]:t+k);
    if(face.some(i=>source.getY(i)<-.035)) {triangles.push(...face);face.forEach(i=>used.add(i));}
  }
  const sourceIndices=[...used],mapping=new Map(sourceIndices.map((i,k)=>[i,k])),positions=[];
  for(const i of sourceIndices)positions.push(source.getX(i),source.getY(i),source.getZ(i));
  const proxy=new THREE.BufferGeometry();proxy.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));proxy.setIndex(triangles.map(i=>mapping.get(i)));
  return {geometry:proxy,sourceIndices};
}

const declarations = `
attribute float fiberMobility;
uniform vec3 fiberSway;
uniform vec2 styleCut;
uniform highp sampler3D headCollider;
uniform vec3 headColliderLow;
uniform vec3 headColliderHigh;
uniform float headColliderRange;
uniform sampler2D bodyProfile;
uniform vec3 profileRange;
uniform sampler2D posedBodyProfile;
uniform vec3 posedProfileRange;
uniform mat4 hairToBody;
uniform mat4 bodyToHair;
vec4 profileAt(float y, sampler2D profileMap, vec3 range) {
  float f = clamp((y - range.x) / (range.y - range.x), 0.0, 1.0) * (range.z - 1.0);
  float i = floor(f);
  vec4 a = textureLod(profileMap, vec2((i + .5) / range.z, .5), 0.0);
  vec4 b = textureLod(profileMap, vec2((min(i + 1.0, range.z - 1.0) + .5) / range.z, .5), 0.0);
  return mix(a, b, fract(f));
}
vec3 outsideProfile(vec3 p, float lo, float hi, bool rear) {
  if (p.y < lo || p.y > hi) return p;
  vec4 section = rear ? profileAt(p.y, posedBodyProfile, posedProfileRange) : profileAt(p.y, bodyProfile, profileRange);
  vec2 q = (p.xz - section.zw) / section.xy;
  float d = length(q);
  if (d < 1.0) {
    if(rear) p.z = section.w - section.y * sqrt(max(0.0,1.0-q.x*q.x)) - .002;
    else p.xz = section.zw + (d < .0001 ? vec2(0.0, -1.0) : q / d) * section.xy;
  }
  return p;
}
vec3 outsideNeck(vec3 p) {
  vec3 a = (hairToBody * vec4(0.0, -.09, -.025, 1.0)).xyz;
  vec3 b = vec3(0.0, -.20, -.045);
  vec3 axis = b-a;
  float t = clamp(dot(p-a, axis) / max(dot(axis, axis), .000001), 0.0, 1.0);
  vec3 center = mix(a,b,t), radius = vec3(.158,.16,.20);
  vec3 q = (p-center)/radius;
  float d = length(q);
  if (d<1.0) p.z = center.z - radius.z * sqrt(max(0.0,1.0-q.x*q.x-q.y*q.y)) - .002;
  return p;
}
vec3 moveFiber(vec3 p) {
  float cutWeight = smoothstep(0.0,.4,fiberMobility);
  p.y += max(0.0,styleCut.x-p.y)*(1.0-styleCut.y)*cutWeight;
  p += fiberSway * fiberMobility;
  // Repeat the head/body constraints because the contact regions overlap.
  for(int i=0;i<3;i++) {
    if (p.y >= -.12 && all(greaterThanEqual(p,headColliderLow)) && all(lessThanEqual(p,headColliderHigh))) {
      vec4 contact=textureLod(headCollider,(p-headColliderLow)/(headColliderHigh-headColliderLow),0.0);
      float distance=(contact.a*2.0-1.0)*headColliderRange;
      // A large movement can bury a curl past the field's nearest-surface
      // basin. Escape with a convex section before resolving fine contact.
      if(distance<-.008) p=outsideProfile(p,-.12,profileRange.y,false);
      else if(distance<.0035) p+=normalize(contact.rgb*2.0-1.0)*(.0035-distance);
    }
    // Thin ear folds are smaller than a field voxel; use the enclosing bust
    // section here while retaining the closer surface fit across the scalp.
    if(abs(p.x)>.14 && abs(p.z)<.075) p=outsideProfile(p,.075,.245,false);
    vec3 body = (hairToBody * vec4(p,1.0)).xyz;
    body = outsideProfile(body, posedProfileRange.x, posedProfileRange.y, true);
    body = outsideNeck(body);
    p = (bodyToHair * vec4(body,1.0)).xyz;
  }
  return p;
}
`;

export function createHairMotion(root, geometry, collider) {
  const profile = createCollisionProfile(geometry);
  const proxy = createNeckCollisionProxy(geometry);
  const posedProfile = createCollisionProfile(proxy.geometry);
  const offset = new THREE.Vector3(), velocity = new THREE.Vector3();
  const currentQ = new THREE.Quaternion(), previousQ = new THREE.Quaternion(), delta = new THREE.Quaternion(), inverseQ = new THREE.Quaternion();
  const currentP = new THREE.Vector3(), previousP = new THREE.Vector3(), movement = new THREE.Vector3();
  const uniforms = {
    styleCut: {value:new THREE.Vector2(0,1)},
    headCollider: {value:collider.texture}, headColliderLow:{value:new THREE.Vector3(...collider.low)},
    headColliderHigh:{value:new THREE.Vector3(...collider.high)},headColliderRange:{value:collider.range},
    fiberSway: { value: offset }, bodyProfile: { value: profile.texture },
    profileRange: { value: new THREE.Vector3(profile.low, profile.high, profile.count) },
    posedBodyProfile: { value: posedProfile.texture },
    posedProfileRange: { value: new THREE.Vector3(posedProfile.low, posedProfile.high, posedProfile.count) },
    hairToBody: { value: new THREE.Matrix4() }, bodyToHair: { value: new THREE.Matrix4() }
  };
  let lastTime = 0, first = true, enabled = true, lastStyle = 'none';
  const lastCollisionMatrix = new THREE.Matrix4();
  function shader(material) {
    material.onBeforeCompile = program => {
      Object.assign(program.uniforms, uniforms);
      program.vertexShader = program.vertexShader.replace('#include <common>', '#include <common>\n' + declarations).replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = moveFiber(transformed);');
      program.vertexShader = program.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        float cutScale = position.y < styleCut.x ? mix(1.0,styleCut.y,smoothstep(0.0,.4,fiberMobility)) : 1.0;
        objectNormal.y /= max(.1,cutScale);
        objectNormal = normalize(objectNormal);
        #ifdef USE_TANGENT
          objectTangent.y *= cutScale;
          objectTangent = normalize(objectTangent);
        #endif
      `);
    };
    material.customProgramCacheKey = () => 'lightfield-hair-surface-collision-v3';
    return material;
  }
  return {
    shader,
    dispose() {profile.texture.dispose();posedProfile.texture.dispose();proxy.geometry.dispose();},
    setCut(cut) {uniforms.styleCut.value.set(...cut);},
    setEnabled(value) { enabled = value; if (!value) { offset.set(0,0,0); velocity.set(0,0,0); } },
    nudge() { if (enabled) { velocity.x+=.19;velocity.y-=.025;velocity.z+=.055; } },
    step(time, style) {
      root.updateWorldMatrix(true, false);
      let body = root.parent;
      while(body && !body.isSkinnedMesh) body = body.parent;
      if (body && style !== 'none') {
        uniforms.hairToBody.value.copy(body.matrixWorld).invert().multiply(root.matrixWorld);
        uniforms.bodyToHair.value.copy(uniforms.hairToBody.value).invert();
        if (first || !lastCollisionMatrix.equals(uniforms.hairToBody.value)) {
          const updated = createCollisionProfile(proxy.geometry, profile.count, (i,p) => body.applyBoneTransform(proxy.sourceIndices[i],p),posedProfile);
          uniforms.posedProfileRange.value.set(updated.low,updated.high,updated.count);
          lastCollisionMatrix.copy(uniforms.hairToBody.value);
        }
      }
      root.getWorldQuaternion(currentQ); root.getWorldPosition(currentP);
      const dt = lastTime ? Math.min(.06, Math.max(.001, (time-lastTime)/1000)) : .016;
      if (!first && style === lastStyle && enabled && style !== 'none') {
        delta.copy(previousQ).invert().multiply(currentQ);
        if(delta.w<0) delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
        velocity.x -= delta.y * .95; velocity.z += delta.x * .75; velocity.y += delta.z * .2;
        movement.copy(currentP).sub(previousP).applyQuaternion(inverseQ.copy(currentQ).invert());
        velocity.addScaledVector(movement, -2.4); velocity.clampLength(0,.42);
      } else { offset.set(0,0,0); velocity.set(0,0,0); }
      first = false; previousQ.copy(currentQ); previousP.copy(currentP); lastTime = time; lastStyle = style;
      return enabled && style !== 'none' && springStep(offset, velocity, dt);
    }
  };
}
