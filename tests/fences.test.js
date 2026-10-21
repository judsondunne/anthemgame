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
