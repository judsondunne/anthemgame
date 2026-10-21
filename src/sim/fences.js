// Grid-edge fences, collision and cached flood-filled enclosed regions.
import { BALANCE as B } from '../config/balance.js';
import { CELL_X, CELL_Y, OBSTACLES, hitObstacle, placedFootprints, cellRect } from './layout.js';
import { removeInventory } from './inventory.js';

const fail = reason => ({ ok: false, reason });
const cache = new WeakMap();
const edgeKey = (gx, gy, axis) => `${gx},${gy},${axis}`;
const cellKey = (gx, gy) => `${gx},${gy}`;
export function fenceLine(f) {
  return { x1: f.gx * CELL_X, y1: f.gy * CELL_Y, x2: (f.gx + (f.axis === 'h' ? 1 : 0)) * CELL_X, y2: (f.gy + (f.axis === 'v' ? 1 : 0)) * CELL_Y };
}
export function checkFencePlacement(s, gx, gy, axis, gate = false) {
  const z = B.fences.bounds;
  if (!Number.isInteger(gx) || !Number.isInteger(gy) || !['h', 'v'].includes(axis)) return fail('blocked');
  if (gx < z.gx0 || gx >= z.gx1 || gy < z.gy0 || gy >= z.gy1) return fail('blocked');
  if ((s.fences || []).length >= B.fences.max) return fail('max');
  if ((s.fences || []).some(f => f.gx === gx && f.gy === gy && f.axis === axis)) return fail('occupied');
  const line = fenceLine({ gx, gy, axis }), footprints = placedFootprints(s);
  for (const t of [0.05, 0.5, 0.95]) {
    const x = line.x1 + (line.x2 - line.x1) * t, y = line.y1 + (line.y2 - line.y1) * t;
    if (OBSTACLES.some(o => o.kind !== 'path' && hitObstacle(o, x, y))) return fail('blocked');
    if (footprints.some(f => { const r = cellRect(f.gx, f.gy, f.w, f.h); return x > r.x0 + 0.1 && x < r.x1 - 0.1 && y > r.y0 + 0.1 && y < r.y1 - 0.1; })) return fail('blocked');
  }
  return { ok: true, line, gate: !!gate };
}
export function placeFence(s, gx, gy, axis, gate = false) {
  const check = checkFencePlacement(s, gx, gy, axis, gate);
  if (!check.ok) return check;
  const key = gate ? 'gate' : 'fence';
  const paid = removeInventory(s, key);
  if (!paid.ok) return fail('noKit');
  const f = { id: s.nextId++, gx, gy, axis, gate: !!gate, open: false };
  s.fences ??= []; s.fences.push(f); cache.delete(s);
  // Placing through an animal moves it to the nearer side; it cannot become
  // trapped exactly on a wall where subsequent collision tests are ambiguous.
  const l = check.line;
  for (const a of s.animals) {
    if (a.state !== 'alive') continue;
    if (axis === 'h' && a.x >= l.x1 && a.x <= l.x2 && Math.abs(a.y - l.y1) < B.fences.nudge) a.y = l.y1 + (a.y < l.y1 ? -1 : 1) * B.fences.nudge;
    if (axis === 'v' && a.y >= l.y1 && a.y <= l.y2 && Math.abs(a.x - l.x1) < B.fences.nudge) a.x = l.x1 + (a.x < l.x1 ? -1 : 1) * B.fences.nudge;
  }
  s.events.push({ type: 'fencePlaced', id: f.id, x: l.x1, y: l.y1 });
  return { ok: true, id: f.id };
}
export function removeFence(s, id) {
  const f = (s.fences || []).find(q => q.id === id);
  if (!f) return fail('unknown');
  s.fences = s.fences.filter(q => q !== f); cache.delete(s);
  const refund = Math.round((f.gate ? B.fences.gatePrice : B.fences.price) * B.fences.refund);
  s.money += refund; s.stats.earned += refund;
  s.events.push({ type: 'fenceRemoved', id, refund });
  return { ok: true, refund };
}
export function toggleGate(s, id) {
  const f = (s.fences || []).find(q => q.id === id);
  if (!f?.gate) return fail('unknown');
  f.open = !f.open; cache.delete(s);
  s.events.push({ type: 'gate', id, open: f.open });
  return { ok: true, open: f.open };
}
function solid(s) { return (s.fences || []).filter(f => !f.gate || !f.open); }

// Segment intersections include posts/end points so diagonal corner cuts fail.
export function fenceBlocked(s, x1, y1, x2, y2) {
  for (const f of solid(s)) {
    const l = fenceLine(f), dx = x2 - x1, dy = y2 - y1;
    if (f.axis === 'v') {
      if (Math.abs(dx) < 1e-8) continue;
      const t = (l.x1 - x1) / dx, y = y1 + dy * t;
      if (t >= -1e-8 && t <= 1 + 1e-8 && y >= l.y1 - 1e-8 && y <= l.y2 + 1e-8) return true;
    } else {
      if (Math.abs(dy) < 1e-8) continue;
      const t = (l.y1 - y1) / dy, x = x1 + dx * t;
      if (t >= -1e-8 && t <= 1 + 1e-8 && x >= l.x1 - 1e-8 && x <= l.x2 + 1e-8) return true;
    }
  }
  return false;
}
function regions(s) {
  const walls = solid(s);
  const signature = walls.map(f => edgeKey(f.gx, f.gy, f.axis)).sort().join(';');
  if (cache.get(s)?.signature === signature) return cache.get(s);
  const result = { signature, cells: new Map(), pens: [] };
  if (!walls.length) { cache.set(s, result); return result; }
  const bounds = { x0: Math.min(...walls.map(f => f.gx)) - 1, x1: Math.max(...walls.map(f => f.gx + 1)) + 1, y0: Math.min(...walls.map(f => f.gy)) - 1, y1: Math.max(...walls.map(f => f.gy + 1)) + 1 };
  if ((bounds.x1 - bounds.x0 + 1) * (bounds.y1 - bounds.y0 + 1) > B.fences.maxFloodCells) { cache.set(s, result); return result; }
  const set = new Set(walls.map(f => edgeKey(f.gx, f.gy, f.axis))), visited = new Set();
  for (let gy = bounds.y0; gy <= bounds.y1; gy++) for (let gx = bounds.x0; gx <= bounds.x1; gx++) {
    if (visited.has(cellKey(gx, gy))) continue;
    const queue = [[gx, gy]], cells = []; let outside = false;
    visited.add(cellKey(gx, gy));
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]; cells.push({ gx: x, gy: y });
      if (x === bounds.x0 || x === bounds.x1 || y === bounds.y0 || y === bounds.y1) outside = true;
      const neighbors = [[x + 1, y, x + 1, y, 'v'], [x - 1, y, x, y, 'v'], [x, y + 1, x, y + 1, 'h'], [x, y - 1, x, y, 'h']];
      for (const [nx, ny, ex, ey, axis] of neighbors) {
        const k = cellKey(nx, ny);
        if (nx < bounds.x0 || nx > bounds.x1 || ny < bounds.y0 || ny > bounds.y1 || visited.has(k) || set.has(edgeKey(ex, ey, axis))) continue;
        visited.add(k); queue.push([nx, ny]);
      }
    }
    if (!outside) {
      const pen = { id: result.pens.length + 1, cells };
      result.pens.push(pen);
      for (const p of cells) result.cells.set(cellKey(p.gx, p.gy), pen);
    }
  }
  cache.set(s, result); return result;
}
export function penAt(s, x, y) { return regions(s).cells.get(cellKey(Math.floor(x / CELL_X), Math.floor(y / CELL_Y))) || null; }
export function isPenned(s, animalOrX, y) { return !!(typeof animalOrX === 'object' ? penAt(s, animalOrX.x, animalOrX.y) : penAt(s, animalOrX, y)); }
export function enclosedPens(s) { return regions(s).pens; }
