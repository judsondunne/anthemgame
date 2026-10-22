import test from 'node:test';
import assert from 'node:assert/strict';
import { S, B, fresh } from './helpers.js';

test('inventory has ten hotbar slots, 64 backpack slots and every permanent tool', () => {
  const s = fresh();
  assert.equal(s.slots.length, 74);
  assert.equal(S.HOTBAR_SIZE, 10);
  for (const key of S.TOOLS) {
    assert.equal(s.slots.filter(q => q?.key === key).length, 1);
    assert.equal(S.removeInventory(s, key).reason, 'permanent');
    assert.equal(S.sellGood(s, key).reason, 'unknown');
  }
  assert.ok(S.selectSlot(s, 9).ok);
  assert.equal(S.selectedItem(s), null);
  assert.equal(s.ui.tool, 'empty');
  assert.equal(S.selectSlot(s, 10).reason, 'slot');
});
test('stacks split, merge with overflow, swap, quick move and cancel outside drops', () => {
  const s = fresh();
  s.inv = {}; S.syncInventory(s);
  assert.ok(S.addInventory(s, 'seed_tulip', 150).ok);
  assert.deepEqual(s.slots[4], { key: 'seed_tulip', n: 99 });
  assert.deepEqual(s.slots[5], { key: 'seed_tulip', n: 51 });
  assert.ok(S.splitSlot(s, 4, 10).ok);
  assert.equal(s.slots[4].n, 49); assert.equal(s.slots[10].n, 50);
  assert.ok(S.moveSlot(s, 5, 10).ok);
  assert.equal(s.slots[10].n, 99); assert.equal(s.slots[5].n, 2);
  assert.ok(S.moveSlot(s, 0, 10).ok);
  assert.equal(s.slots[10].key, 'hand'); assert.equal(s.slots[0].key, 'seed_tulip');
  const before = S.serialize(s);
  assert.equal(S.moveSlot(s, 10, -1).reason, 'slot');
  assert.equal(S.serialize(s), before);
  assert.ok(S.moveSlot(s, 5, null, { quick: true }).ok);
  assert.equal(s.slots[5], null);
  assert.equal(s.inv.seed_tulip, 150);
  assert.deepEqual(S.toDoc(S.loadText(S.serialize(s)).state), S.toDoc(s));
});
test('capacity failure is atomic and collection stays in the world', () => {
  const s = fresh(); s.inv = {}; S.syncInventory(s);
  const cap = S.inventoryCapacity(s, 'egg');
  assert.equal(cap, 70 * B.inventory.stackMax);
  assert.ok(S.addInventory(s, 'egg', cap).ok);
  const before = S.serialize(s);
  assert.equal(S.addInventory(s, 'egg').reason, 'stack');
  assert.equal(S.serialize(s), before);
  const p = { id: s.nextId++, kind: 'egg', x: 100, y: 200, t: 0 };
  s.pickups.push(p);
  assert.equal(S.collect(s, p.id).reason, 'stack'); assert.ok(s.pickups.includes(p));
  assert.ok(S.removeInventory(s, 'egg').ok); assert.ok(S.collect(s, p.id).ok);
});
test('schema two migration preserves the farm and inventory in canonical slots', () => {
  const s = fresh();
  const old = S.toDoc(s);
  old.schemaVersion = 2; delete old.slots; delete old.inventoryOverflow;
  old.inv = { seed_lavender: 87, egg: 99, kit_stable: 2, hay: 17 };
  old.money = 785; old.stats.earned = 12345;
  const r = S.loadObject(old); assert.ok(r.ok);
  assert.deepEqual(r.state.inv, old.inv);
  assert.deepEqual(r.state.beds, s.beds); assert.equal(r.state.money, 785);
  assert.equal(r.state.stats.earned, 12345);
  assert.ok(r.state.animals.every(a => a.health === B.predators.maxHealth));
  for (const key of S.TOOLS) assert.ok(r.state.slots.some(q => q?.key === key));
});
