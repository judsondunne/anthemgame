// Water rings and droplets are allowed particle geometry, shared by the pond,
// brook, swimming player and wading livestock. Fixed pool, no per-frame meshes.
import * as THREE from 'three';
import { BALANCE as B } from '../config/balance.js';
import { waterAtLogical } from '../sim/water.js';

export function createWaterFeedback({ scene, cameraControl, getState, audio }) {
  const capacity = 48, positions = new Float32Array(capacity * 3), ages = new Float32Array(capacity), seeds = new Float32Array(capacity * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAge', new THREE.BufferAttribute(ages, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDpr: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: `attribute float aAge;attribute vec3 aSeed;uniform float uTime;uniform float uDpr;varying float vAge;varying float vKind;void main(){float age=uTime-aAge;vAge=age;vKind=aSeed.z;vec3 p=position;if(vKind>.5){p.xz+=aSeed.xy*age*.55;p.y+=age*.9-age*age*.95;}vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(vKind>.5?18.:55.+age*70.)*uDpr/max(1.,-mv.z);if(age<0.||age>1.6)gl_PointSize=0.;}`,
    fragmentShader: `varying float vAge;varying float vKind;void main(){vec2 p=gl_PointCoord-.5;float d=length(p)*2.;float fade=max(0.,1.-vAge/1.6);float alpha=vKind>.5?(1.-smoothstep(.25,.85,d))*.6:smoothstep(.58,.72,d)*(1.-smoothstep(.78,.94,d))*.45;gl_FragColor=vec4(.72,.91,.87,alpha*fade);}`,
  });
  ages.fill(-100); geometry.attributes.aAge.needsUpdate = true;
  const points = new THREE.Points(geometry, material); points.frustumCulled = false; points.renderOrder = 3; scene.add(points);
  let elapsed = 0, index = 0, nextPlayer = 0;
  const animalClocks = new Map();
  const emit = (x, z, surface, splash = false) => {
    for (let i = 0; i < (splash ? 5 : 1); i++) {
      const n = index++ % capacity;
      positions.set([x, surface + .025, z], n * 3); ages[n] = elapsed;
      seeds.set([Math.sin(n * 2.399), Math.cos(n * 2.399), i ? 1 : 0], n * 3);
    }
    geometry.attributes.position.needsUpdate = geometry.attributes.aAge.needsUpdate = geometry.attributes.aSeed.needsUpdate = true;
  };
  let wasWet = false;
  function update(dt) {
    elapsed += dt; material.uniforms.uTime.value = elapsed;
    const p = cameraControl.player, wet = cameraControl.isFirstPerson && !!p.water && p.y < p.water.surface;
    if (wet && (!wasWet || (elapsed >= nextPlayer && Math.hypot(p.vx, p.vz) > .15))) {
      emit(p.x, p.z, p.water.surface, !wasWet); nextPlayer = elapsed + B.movement.rippleInterval;
      audio?.splash?.(!wasWet ? .8 : .25);
    }
    wasWet = wet;
    for (const a of getState().animals) {
      if (a.state !== 'alive' || a.sp === 'chicken') continue;
      const water = waterAtLogical(a.x, a.y), last = animalClocks.get(a.id);
      if (!water) { animalClocks.delete(a.id); continue; }
      if (!last || elapsed - last > B.movement.rippleInterval * 2) {
        emit((a.x - 700) / 50, (a.y - 650) * 1.65 / 50, water.surface, !last);
        animalClocks.set(a.id, elapsed);
      }
    }
  }
  return { update, emit, group: points };
}
