import test from 'node:test';
import assert from 'node:assert/strict';
import { S, B, fresh } from './helpers.js';

export function box(s, { gx = -20, gy = 26, w = 8, h = 5, gate = true, gap = false } = {}) {
  S.addInventory(s, 'fence', (w + h) * 2); S.addInventory(s, 'gate', 1);
  const ids = [];
  for (let x = 0; x < w; x++) {
    if (!(gap && x === 2)) ids.push(S.placeFence(s, gx + x, gy, 'h').id);
    ids.push(S.placeFence(s, gx + x, gy + h, 'h', gate && x === 3).id);
  }
  for (let y = 0; y < h; y++) {
    ids.push(S.placeFence(s, gx, gy + y, 'v').id);
    ids.push(S.placeFence(s, gx + w, gy + y, 'v').id);
  }
  assert.ok(ids.every(Number.isInteger), 'all perimeter segments placed');
  return { ids, gate: s.fences.find(f => f.gate) };
}
test('fences validate, delete with configured refund, re-place and nudge animals', () => {
  const s = fresh(); S.addInventory(s, 'fence', 3);
  assert.equal(S.placeFence(s, 7.2, 26, 'h').reason, 'blocked');
  assert.equal(S.placeFence(s, 13, 20, 'h').reason, 'blocked', 'house');
  assert.equal(S.placeFence(s, s.beds[0].gx + 1, s.beds[0].gy + 1, 'h').reason, 'blocked', 'crops');
  const a = s.animals[0]; a.x = -780; a.y = 26 * S.layout.CELL_Y;
  const r = S.placeFence(s, -20, 26, 'h'); assert.ok(r.ok);
  assert.equal(Math.abs(a.y - 26 * S.layout.CELL_Y), B.fences.nudge);
  assert.equal(S.placeFence(s, -20, 26, 'h').reason, 'occupied');
  const money = s.money, removed = S.removeFence(s, r.id);
  assert.equal(removed.refund, Math.round(B.fences.price * B.fences.refund));
  assert.equal(s.money, money + removed.refund);
  assert.ok(S.placeFence(s, -20, 26, 'h').ok);
});
test('flood fill only protects closed loops and survives open-gate save/load', () => {
  const s = fresh(), { gate } = box(s), point = { x: -640, y: 690 };
  assert.ok(S.isPenned(s, point)); assert.equal(S.enclosedPens(s).length, 1);
  assert.equal(S.isPenned(s, -900, 690), false);
  S.toggleGate(s, gate.id); assert.equal(S.isPenned(s, point), false);
  let back = S.loadText(S.serialize(s)).state; assert.equal(S.isPenned(back, point), false);
  S.toggleGate(back, gate.id); assert.ok(S.isPenned(back, point));
  const first = back.fences[0]; S.removeFence(back, first.id); assert.equal(S.isPenned(back, point), false);
  assert.ok(S.placeFence(back, first.gx, first.gy, first.axis).ok); assert.ok(S.isPenned(back, point));
  for (const f of [...back.fences]) S.removeFence(back, f.id);
  assert.equal(S.isPenned(back, point), false);
});
test('diagonal corner cuts cannot cross fences and a single gap breaks a pen', () => {
  const s = fresh(); box(s, { gap: true });
  assert.equal(S.isPenned(s, -640, 690), false);
  assert.equal(S.fenceBlocked(s, -810, 620, -790, 640), true);
  assert.equal(S.fenceBlocked(s, -900, 620, -880, 640), false);
});
test('animal movement and legacy position updates cannot cross a closed fence', () => {
  const s = fresh(); box(s);
  const a = s.animals[0]; a.x = -640; a.y = 690;
  S.setPositions(s, [{ id: a.id, x: -850, y: 690 }]); assert.equal(a.x, -640);
  for (let i = 0; i < 200; i++) S.moveToward(s, a, { x: -900, y: 690 }, 20, 1);
  assert.ok(S.isPenned(s, a));
});

test('placing a fence across the first-person player is refused without consuming stock', () => {
  const s = fresh(); S.addInventory(s, 'fence', 1);
  s.player = { mode: 'fp', x: -780, y: 26 * S.layout.CELL_Y, yaw: 0, pitch: 0 };
  const n = s.inv.fence;
  assert.equal(S.placeFence(s, -20, 26, 'h').reason, 'player');
  assert.equal(s.inv.fence, n); assert.equal(s.fences.length, 0);
});
test('a purchased animal spawns in the pen enclosing its barn even with a tight door edge', () => {
  const s = fresh(); s.money = 1e6;
  s.buildings.push({ id: s.nextId++, type: 'barn', gx: -23, gy: 25 });
  // The bottom fence is immediately below the building, so its approach point
  // lies outside. The interior still has grazing room beside the barn.
  box(s, { gx: -25, gy: 24, w: 10, h: 6 });
  assert.equal(S.isPenned(s, S.homePoint(s, S.spawnAnimal(s, 'cow', 'f'))), false, 'door approach is deliberately outside');
  assert.ok(S.isPenned(s, s.animals.at(-1)), 'center-based pen fallback keeps purchase inside');
  const r = S.buy(s, 'animal_cow_f'); assert.ok(r.ok);
  assert.ok(S.isPenned(s, s.animals.find(a => a.id === r.id)));
});
test('deep brook water blocks movement and fences while the crossing remains walkable', () => {
  const s = fresh(), wz = 0, wx = 46;
  assert.equal(S.deepWaterAt(700 + wx * 50, 650 + wz * 50 / 1.65), true);
  const crossingZ = 8, crossingX = 46 + Math.sin(8 * .045) * 7 + Math.sin(8 * .115) * 1.9;
  assert.equal(S.deepWaterAt(700 + crossingX * 50, 650 + crossingZ * 50 / 1.65), false);
  assert.equal(S.checkFencePlacement(s, 75, 26, 'h').ok, false);
});
test('unfenced animals return at dusk and can be called home during the day', () => {
  const s = fresh(), a = S.spawnAnimal(s, 'cow', 'f'), home = S.homePoint(s, a);
  a.x = home.x + 400; a.y = home.y - 100;
  s.time = S.clock.nextTimeAtHour(s.time, 20);
  for (let i = 0; i < 100; i++) S.stepWandering(s, 1, S.housing(s));
  assert.ok(Math.hypot(a.x - home.x, (a.y - home.y) * 1.65) < 35);
  s.time = 0; a.x = home.x - 400; a.y = home.y - 90;
  assert.ok(S.callAnimal(s, a.id).ok);
  for (let i = 0; i < 100; i++) S.stepWandering(s, 1, S.housing(s));
  assert.ok(Math.hypot(a.x - home.x, (a.y - home.y) * 1.65) < 35);
});
