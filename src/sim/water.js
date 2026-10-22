// Shared water volumes in metres. Simulation and camera use the same banks;
// the renderer carves its terrain from these depths rather than owning physics.
import { BALANCE as B } from '../config/balance.js';
import { WORLD as W } from '../config/world.js';

const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
export const brookCenter = z => W.brook.x + Math.sin(z * .045) * W.brook.meander + Math.sin(z * .115) * 1.9;
export const brookHalfWidth = z => W.brook.halfWidth + .30 * Math.sin(z * .09 + 2);
export function brookSurface(z) {
  let height = .08 + (z + W.radius) * .003;
  for (let step = -64; step < 90; step += 26) height += .12 * smooth(step - .45, step + .45, z);
  return height;
}
export function waterAtWorld(x, z) {
  const P = B.waterBodies.pond;
  const pondRadius = Math.hypot((x - P.x) / P.rx, (z - P.z) / P.rz);
  if (pondRadius < 1) {
    const depth = P.edgeDepth + (P.maxDepth - P.edgeDepth) * (1 - smooth(.12, 1, pondRadius));
    return { kind: 'pond', surface: P.surface, bottom: P.surface - depth, depth, shore: pondRadius };
  }
  const r = Math.abs(x - brookCenter(z)) / brookHalfWidth(z);
  if (r >= 1 || Math.abs(z) >= W.radius) return null;
  // The crossing is a dry downloaded bridge, not an invisible wall in the water.
  const surface = brookSurface(z), K = B.waterBodies.brook;
  const depth = K.edgeDepth + (K.maxDepth - K.edgeDepth) * (1 - smooth(.08, 1, r));
  return { kind: 'brook', surface, bottom: surface - depth, depth, shore: r };
}
export const waterAtLogical = (x, y) => waterAtWorld((x - 700) / 50, (y - 650) * 1.65 / 50);
export function brookDrinkingPoint(z, side = -1) {
  // A shallow spot keeps a drinking animal's head above the surface. Large
  // animals may continue across the channel; hens never enter this volume.
  const x = brookCenter(z) + Math.sign(side || -1) * brookHalfWidth(z) * .70;
  return { x: x * 50 + 700, y: z * 50 / 1.65 + 650 };
}
