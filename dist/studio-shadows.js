import * as THREE from './vendor/three.module.js';

export function linearShadowDepth(depth,near,far) {
  return near*far/(far-depth*(far-near));
}
export function penumbraUV(radius,receiver,blocker,tangent) {
  return radius*Math.max(0,receiver-blocker)/Math.max(.00001,blocker*2*receiver*tangent);
}

const softShadow = `
#if defined(USE_SHADOWMAP) && NUM_SPOT_LIGHT_SHADOWS > 0
uniform vec4 studioShadowFrustum[3];
float studioLinearDepth(float depth,vec2 clipping) {
  return clipping.x*clipping.y/(clipping.y-depth*(clipping.y-clipping.x));
}
vec2 studioDisk(int i,int count) {
  if(i==0)return vec2(0.0);
  float angle=float(i)*2.39996323;
  return vec2(cos(angle),sin(angle))*sqrt((float(i)-.5)/float(count-1));
}
float studioCompare(sampler2D map,vec2 uv,vec3 receiver,vec2 gradient) {
  float depth=receiver.z+dot(gradient,uv-receiver.xy);
  return step(depth,unpackRGBAToDepth(textureLod(map,uv,0.0)));
}
float studioBilinearCompare(sampler2D map,vec2 uv,vec2 size,vec3 receiver,vec2 gradient) {
  vec2 pixel=uv*size-.5,base=(floor(pixel)+.5)/size,f=fract(pixel),t=1.0/size;
  return mix(mix(studioCompare(map,base,receiver,gradient),studioCompare(map,base+vec2(t.x,0.0),receiver,gradient),f.x),
             mix(studioCompare(map,base+vec2(0.0,t.y),receiver,gradient),studioCompare(map,base+t,receiver,gradient),f.x),f.y);
}
float getStudioShadow(sampler2D map,vec2 size,float intensity,float bias,vec4 projected,vec4 setup) {
  vec3 p=projected.xyz/projected.w;p.z+=bias;
  vec3 dx=dFdx(p),dy=dFdy(p);
  float determinant=dx.x*dy.y-dx.y*dy.x;
  vec2 gradient=abs(determinant)>.0000000001 ? vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/determinant : vec2(0.0);
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0)return 1.0;
  float receiver=studioLinearDepth(p.z,setup.xy);
  // Search for actual occluders; shadows remain tight at the hair/scalp contact.
  float searchRadius=clamp(setup.z/(2.0*receiver*setup.w)*.5,1.0/size.x,.18);
  float blockerSum=0.0,blockerCount=0.0;
  for(int i=0;i<16;i++) {
    vec2 offset=studioDisk(i,16)*searchRadius;
    float z=unpackRGBAToDepth(textureLod(map,p.xy+offset,0.0));
    if(z<p.z+dot(gradient,offset)-.00005){blockerSum+=studioLinearDepth(z,setup.xy);blockerCount+=1.0;}
  }
  if(blockerCount<.5)return 1.0;
  float blocker=blockerSum/blockerCount;
  float penumbra=setup.z*max(0.0,receiver-blocker)/max(.00001,blocker*2.0*receiver*setup.w);
  penumbra=clamp(penumbra,.8/size.x,64.0/size.x);
  float visibility=0.0;
  for(int i=0;i<48;i++)visibility+=studioBilinearCompare(map,p.xy+studioDisk(i,48)*penumbra,size,p,gradient);
  return mix(1.0,visibility/48.0,intensity);
}
#endif
`;

export function createStudioShadows() {
  const parameters=[new THREE.Vector4(),new THREE.Vector4(),new THREE.Vector4()];
  const originalCall='getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] )';
  const replacement='getStudioShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, vSpotLightCoord[ i ], studioShadowFrustum[ i ] )';
  if(!THREE.ShaderChunk.lights_fragment_begin.includes(originalCall))throw new Error('阴影着色器版本不匹配');
  return {
    update(lights) {
      let index=0;
      for(const light of lights)if(light.visible&&light.castShadow) {
        parameters[index++].set(light.shadow.camera.near,light.shadow.camera.far,light.userData.emitterRadius,Math.tan(light.angle)*light.shadow.focus);
      }
    },
    material(material) {
      const original=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
      const cacheKey=key();
      material.onBeforeCompile=function(shader,renderer) {
        original.call(this,shader,renderer);
        shader.uniforms.studioShadowFrustum={value:parameters};
        shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',THREE.ShaderChunk.shadowmap_pars_fragment+'\n'+softShadow);
        // Receiver-plane derivatives must run across the whole pixel quad,
        // including pixels just outside the spotlight cone.
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',THREE.ShaderChunk.lights_fragment_begin.replace(originalCall,replacement).replace('( directLight.visible && receiveShadow ) ? getStudioShadow','receiveShadow ? getStudioShadow'));
      };
      material.customProgramCacheKey=()=>cacheKey+'-studio-contact-shadows-v1';
      return material;
    }
  };
}
export const studioShadows=createStudioShadows();
