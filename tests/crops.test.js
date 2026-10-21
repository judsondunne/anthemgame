import test from "node:test";
import assert from "node:assert/strict";
import { S, B, fresh } from "./helpers.js";

test('every selected seed plants into every bed, grows through all stages, harvests and replants', () => {
  const s = fresh(); s.animals = []; s.money = 1e7;
  while (s.beds.length < B.beds.max) {
    const at = S.layout.bestSpot(s, 'bed'); assert.ok(at);
    assert.ok(S.buy(s, 'kit_bed').ok); assert.ok(S.place(s, 'kit_bed', at.gx, at.gy).ok);
  }
  for (const crop of S.CROPS) {
    const key = 'seed_' + crop; assert.ok(S.addInventory(s, key, 2 * s.beds.length).ok);
    let slot = s.slots.findIndex(q => q?.key === key);
    if (slot >= 10) { assert.ok(S.moveSlot(s, slot, 9).ok); slot = 9; }
    assert.ok(S.selectSlot(s, slot).ok); assert.equal(S.selectedItem(s).key, key);
    for (const bed of s.beds) {
      bed.plots = bed.plots.map(() => ({ crop: null, g: 0, w: 0 }));
      assert.ok(S.plant(s, bed.id, 0, S.selectedItem(s).key.slice(5)).ok);
      assert.equal(bed.plots[0].crop, crop); assert.equal(S.plotStage(bed.plots[0]), 0);
      const n = s.inv[key]; assert.equal(S.plant(s, bed.id, 0, crop).reason, 'occupied'); assert.equal(s.inv[key], n);
    }
    const grow = B.crops[crop].grow;
    S.waterBed(s, s.beds[0].id);
    // Keep every bed watered at regular intervals; long crops require several waterings.
    for (let elapsed = 0; elapsed < grow;) {
      for (const bed of s.beds) S.waterBed(s, bed.id);
      const dt = Math.min(grow - elapsed, grow * B.stages.growing, B.water.seconds - 1);
      S.tick(s, dt); elapsed += dt;
      for (const bed of s.beds) {
        const p = bed.plots[0];
        assert.equal(S.plotStage(p), elapsed >= grow - 1e-6 ? 2 : elapsed >= grow * B.stages.growing - 1e-6 ? 1 : 0);
      }
    }
    for (const bed of s.beds) {
      assert.ok(S.harvest(s, bed.id, 0).ok); assert.equal(bed.plots[0].crop, null);
      assert.ok(S.plant(s, bed.id, 0, crop).ok); assert.equal(bed.plots[0].crop, crop);
    }
  }
  const empty = s.slots.findIndex((q, i) => i < 10 && !q);
  const target = empty < 0 ? 9 : empty;
  if (s.slots[target]) S.moveSlot(s, target, s.slots.findIndex((q, i) => i >= 10 && !q));
  S.selectSlot(s, target); assert.equal(S.selectedItem(s), null); assert.equal(s.ui.tool, 'empty');
});

test("crop growth stages advance only while watered", () => {
  const s = fresh(),
    bed = s.beds[0],
    grow = B.crops.daisy.grow;
  assert.equal(S.plotStage(bed.plots[0]), 0);
  S.tick(s, 500);
  assert.equal(bed.plots[0].g, 0, "dry seed never grows");
  assert.ok(S.waterBed(s, bed.id).ok);
  S.tick(s, Math.floor(grow * B.stages.growing) - 1);
  assert.equal(S.plotStage(bed.plots[0]), 0, "still a seedling");
  S.tick(s, 2);
  assert.equal(S.plotStage(bed.plots[0]), 1, "growing stage");
  S.tick(s, grow - Math.floor(grow * B.stages.growing) - 2);
  assert.equal(S.plotStage(bed.plots[0]), 1, "not ripe one second early");
  S.tick(s, 1);
  assert.equal(S.plotStage(bed.plots[0]), 2, "ripe exactly at the growth time");
});

test("unwatered plants pause rather than die, then resume", () => {
  const s = fresh(),
    bed = s.beds[0];
  s.inv.seed_lavender = 1;
  assert.ok(S.plant(s, bed.id, 3, "lavender").ok);
  S.waterBed(s, bed.id);
  S.tick(s, B.water.seconds + 200);
  const g = bed.plots[3].g;
  assert.ok(Math.abs(g - B.water.seconds / B.crops.lavender.grow) < 1e-9);
  S.tick(s, 1000);
  assert.equal(bed.plots[3].g, g, "paused while dry");
  assert.equal(bed.plots[3].crop, "lavender", "dry crop is not lost");
  S.waterBed(s, bed.id);
  S.tick(s, 10);
  assert.ok(bed.plots[3].g > g, "resumes after watering");
});

test("harvest only when ripe; unripe taps change nothing", () => {
  const s = fresh(),
    bed = s.beds[0];
  S.waterBed(s, bed.id);
  S.tick(s, 20);
  const before = JSON.stringify(S.toDoc(s));
  assert.deepEqual(S.harvest(s, bed.id, 0), { ok: false, reason: "unripe" });
  assert.deepEqual(S.harvestBed(s, bed.id), { ok: false, reason: "unripe" });
  assert.equal(JSON.stringify(S.toDoc(s)), before);
  assert.deepEqual(S.harvest(s, bed.id, 4), { ok: false, reason: "empty" });
  S.tick(s, B.crops.daisy.grow);
  const r = S.harvest(s, bed.id, 0);
  assert.ok(r.ok);
  assert.equal(s.inv.daisy, B.crops.daisy.yield);
  assert.equal(bed.plots[0].crop, null);
  assert.ok(S.harvestBed(s, bed.id).ok);
  assert.equal(s.inv.daisy, 2 * B.crops.daisy.yield);
});

test("wheat harvests into hay, a separate good", () => {
  const s = fresh(),
    bed = s.beds[0];
  assert.ok(S.plant(s, bed.id, 2, "wheat").ok);
  S.waterBed(s, bed.id);
  S.tick(s, B.crops.wheat.grow);
  assert.ok(S.harvest(s, bed.id, 2).ok);
  assert.equal(s.inv.hay, B.crops.wheat.yield);
  assert.equal(s.inv.wheat, undefined);
});

test("planting needs a seed and an empty plot", () => {
  const s = fresh(),
    bed = s.beds[0];
  assert.equal(S.plant(s, bed.id, 0, "daisy").reason, "occupied");
  assert.equal(S.plant(s, bed.id, 2, "tulip").reason, "noSeed");
  assert.equal(S.plant(s, 999, 2, "daisy").reason, "unknown");
  const seeds = s.inv.seed_daisy;
  assert.ok(S.plantBed(s, bed.id, "daisy", 5).ok);
  assert.equal(bed.plots[5].crop, "daisy", "nearest empty plot to the tap");
  assert.equal(s.inv.seed_daisy, seeds - 1);
});

test("a timer straddling dusk/dawn keeps its exact pace", () => {
  const s = fresh(),
    bed = s.beds[0];
  s.inv.seed_lavender = 1;
  S.plant(s, bed.id, 3, "lavender");
  S.advanceToHour(s, 19.5, { offline: true });
  S.waterBed(s, bed.id);
  const g0 = bed.plots[3].g;
  assert.equal(S.clock.isNightAt(s.time), false);
  S.tick(s, 100);
  assert.equal(S.clock.isNightAt(s.time), true, "crossed into night");
  assert.ok(Math.abs(bed.plots[3].g - g0 - 100 / B.crops.lavender.grow) < 1e-9);
});
