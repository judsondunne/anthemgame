// Height-aware collision data derived from downloaded model bounds. This file
// creates no scene geometry; it supplies walkable tops to the player capsule.
import * as THREE from 'three';
import { BALANCE as B } from '../config/balance.js';
import { CAMERA as C } from '../config/camera.js';
import { layout } from '../sim/index.js';
import { waterAtWorld } from '../sim/water.js';

export const containsTop = (s, x, z, radius = 0) => x > s.x0 - radius && x < s.x1 + radius && z > s.z0 - radius && z < s.z1 + radius;
export function modelSurfaces(scene) {
  const surfaces = [];
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    const asset = o.userData.asset;
    if (!asset || !/stone|rock|boulder|log|stump|hay-bale|bench|stairs|trough|bowl-cereal/.test(asset)) return;
    // Cottage furniture and thresholds supply precise collision separately.
    for (let p = o.parent; p; p = p.parent) if (p.userData.cottage) return;
    const stored=o.userData.surfaceBounds;
    const box = stored ? new THREE.Box3(new THREE.Vector3(...stored.min),new THREE.Vector3(...stored.max)) : new THREE.Box3().setFromObject(o);
    if (box.isEmpty() || box.max.y - box.min.y < .015) return;
    surfaces.push({ x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z, y: box.max.y, baseY: box.min.y, type: asset });
  });
  return surfaces;
}
export function createPlayerGeometry({ world, cottage, scene, getState }) {
  const staticTops = modelSurfaces(scene);
  // Instanced forest stones have no per-instance Object3D. Their collider
  // records include physical top heights from the downloaded source bounds.
  for (const c of world.colliders) if (['rock','log','stump'].includes(c.type)) {
    const base = world.heightAt(c.x, c.z);
    staticTops.push({ x0: c.x - c.radius, x1: c.x + c.radius, z0: c.z - c.radius, z1: c.z + c.radius, y: c.top ?? base + c.radius, baseY: base, type: c.type });
  }
  const dynamicTops = () => (getState().beds ?? []).map(b => {
    const r = layout.cellRect(b.gx, b.gy, ...layout.footprintOf('bed'));
    return { x0: (r.x0 - 700) / 50, x1: (r.x1 - 700) / 50, z0: (r.y0 - 650) * 1.65 / 50, z1: (r.y1 - 650) * 1.65 / 50, y: .16, baseY: 0, type: 'bed' };
  });
  const buckets = new Map(), cellSize = 4;
  for (const s of [...staticTops, ...(cottage?.surfaces ?? [])]) {
    for (let iz = Math.floor(s.z0 / cellSize); iz <= Math.floor(s.z1 / cellSize); iz++) for (let ix = Math.floor(s.x0 / cellSize); ix <= Math.floor(s.x1 / cellSize); ix++) {
      const key = `${ix},${iz}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(s);
    }
  }
  const tops = (x, z, radius = 0) => {
    const result = new Set();
    for (let iz = Math.floor((z - radius) / cellSize); iz <= Math.floor((z + radius) / cellSize); iz++) for (let ix = Math.floor((x - radius) / cellSize); ix <= Math.floor((x + radius) / cellSize); ix++) for (const s of buckets.get(`${ix},${iz}`) ?? []) result.add(s);
    return [...result, ...dynamicTops()];
  };
  function terrainHeight(x, z) {
    const water = waterAtWorld(x, z);
    const bridge = world.brook.crossing;
    if (bridge && Math.abs(z - bridge.z) < 1.15 && Math.abs(x - bridge.x) < 2.9) return world.heightAt(x, z);
    if (water) return water.bottom;
    const interiorFloor = cottage?.floorAt?.(x, z);
    return Number.isFinite(interiorFloor) ? interiorFloor : world.heightAt(x, z);
  }
  function supportAt(x, z, feetY, allowance = B.movement.stepHeight) {
    let top = terrainHeight(x, z);
    for (const s of tops(x, z)) if (containsTop(s, x, z) && s.y <= feetY + allowance && s.y > top) top = s.y;
    return top;
  }
  function blocked(x, z, radius, feetY = 0) {
    if (cottage?.blocked?.(x, z, radius, feetY)) return true;
    for (const s of tops(x, z, radius)) {
      if (!containsTop(s, x, z, radius)) continue;
      if (feetY + B.movement.stepHeight < s.y && feetY + C.eyeHeight > s.baseY) return true;
    }
    return world.colliders.some(c => {
      if (['rock','log','stump'].includes(c.type)) return false;
      return Math.hypot(x - c.x, z - c.z) < radius + c.radius;
    });
  }
  return { terrainHeight, supportAt, blocked, waterAt: waterAtWorld, cottage, surfaces: staticTops, walkableFarm: true };
}
