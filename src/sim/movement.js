// Shared logical-coordinate steering. Solid fences, buildings and deep pond
// water are respected by both livestock and predators.
import { BALANCE as B } from '../config/balance.js';
import { OBSTACLES, hitObstacle, placedFootprints, cellRect, CELL_X, CELL_Y } from './layout.js';
import { fenceBlocked } from './fences.js';
import { WORLD } from '../config/world.js';

export function deepWaterAt(x, y) {
  const wx = (x - 700) / 50, wz = (y - 650) * 1.65 / 50;
  const streamX = WORLD.brook.x + Math.sin(wz * 0.045) * WORLD.brook.meander + Math.sin(wz * 0.115) * 1.9;
  const halfWidth = WORLD.brook.halfWidth + 0.30 * Math.sin(wz * 0.09 + 2);
  return Math.abs(wz - WORLD.brook.crossingZ) > WORLD.brook.crossingHalfDepth && Math.abs(wx - streamX) < halfWidth;
}

export function groundBlocked(s, x, y) {
  const z = B.fences.bounds;
  if (x < z.gx0 * CELL_X || x > z.gx1 * CELL_X || y < z.gy0 * CELL_Y || y > z.gy1 * CELL_Y) return true;
  if (deepWaterAt(x, y)) return true;
  if (OBSTACLES.some(o => o.kind !== 'path' && hitObstacle(o, x, y))) return true;
  return placedFootprints(s).some(f => {
    const r = cellRect(f.gx, f.gy, f.w, f.h);
    return x > r.x0 - 2 && x < r.x1 + 2 && y > r.y0 - 2 && y < r.y1 + 2;
  });
}
export function canMove(s, a, x, y) {
  if (fenceBlocked(s, a.x, a.y, x, y)) return false;
  const n = Math.max(1, Math.ceil(Math.hypot(x - a.x, y - a.y) / 8));
  for (let i = 1; i <= n; i++) if (groundBlocked(s, a.x + (x - a.x) * i / n, a.y + (y - a.y) * i / n)) return false;
  return true;
}
export function moveToward(s, a, target, speed, h, { avoidAnimals = false } = {}) {
  const dx = target.x - a.x, dy = (target.y - a.y) * 1.65;
  const dist = Math.hypot(dx, dy), amount = Math.min(dist, Math.max(0, speed * h));
  if (dist < 0.001 || !amount) return false;
  const angle = Math.atan2(dy, dx);
  const side = a.id % 2 ? 1 : -1;
  for (const offset of [0, side * 0.65, -side * 0.65, side * 1.25, -side * 1.25, side * 1.8]) {
    const x = a.x + Math.cos(angle + offset) * amount, y = a.y + Math.sin(angle + offset) * amount / 1.65;
    if (!canMove(s, a, x, y)) continue;
    if (avoidAnimals && s.animals.some(q => q !== a && q.state === 'alive' && Math.hypot(q.x - x, (q.y - y) * 1.65) < (q.sp === 'chicken' ? 8 : 15))) continue;
    a.x = x; a.y = y; a.heading = angle + offset;
    return true;
  }
  return false;
}
