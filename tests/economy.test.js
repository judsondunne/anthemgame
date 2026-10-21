import test from "node:test";
import assert from "node:assert/strict";
import { S, B, DAY, fresh, run, withBuilding } from "./helpers.js";

test("starting farm matches the brief", () => {
  const s = fresh();
  assert.equal(s.money, 1000);
  assert.equal(s.beds.length, 1);
  assert.ok(s.beds[0].plots.filter((p) => p.crop).length >= 2, "a couple of seeds already planted");
  assert.ok(S.SEEDS.some((k) => s.inv[k] > 0), "starter seeds in inventory");
  assert.ok(s.inv.feed_chicken > 0, "starter chicken feed");
  const birds = s.animals.filter((a) => a.sp === "chicken");
  assert.deepEqual(birds.map((a) => a.sex).sort(), ["f", "m"]);
  assert.equal(s.buildings.length, 0);
  assert.equal(s.animals.length, 2);
});

test("buy math is exact, including exactly enough money", () => {
  const s = fresh();
  assert.ok(S.buy(s, "seed_daisy").ok);
  assert.equal(s.money, 1000 - B.crops.daisy.seed);
  s.money = B.crops.tulip.seed;
  assert.ok(S.buy(s, "seed_tulip").ok, "exactly enough succeeds");
  assert.equal(s.money, 0);
  assert.deepEqual(S.buy(s, "seed_tulip"), { ok: false, reason: "money" });
  assert.equal(s.money, 0, "never negative");
  s.money = 100;
  assert.ok(S.buy(s, "feed_cow").ok);
  assert.equal(s.inv.feed_cow, B.feed.feed_cow.units, "feed comes in bags");
  assert.equal(S.buy(s, "nonsense").reason, "unknown");
});

test("rapid-tap spam can never overspend or exceed limits", () => {
  const s = fresh();
  let ok = 0;
  for (let i = 0; i < 500; i++) if (S.buy(s, "kit_coop").ok) ok++;
  assert.equal(ok, 1);
  assert.equal(s.money, 1000 - B.buildings.coop.price);
  s.money = 1e6;
  for (let i = 0; i < 500; i++) S.buy(s, "kit_coop");
  assert.equal(s.inv.kit_coop, B.buildings.coop.max);
  for (let i = 0; i < 500; i++) S.buy(s, "seed_daisy");
  assert.equal(s.inv.seed_daisy, B.inventory.stackMax);
  assert.ok(s.money >= 0);
});

test("sell math uses the shown unit price; selling zero or nothing is refused", () => {
  const s = fresh();
  s.inv.egg = 5;
  const unit = S.sellPrice(s, "egg");
  assert.ok(Math.abs(unit - B.goods.egg) <= Math.ceil(B.goods.egg * B.market.driftAmplitude));
  const r = S.sellGood(s, "egg", 1);
  assert.deepEqual(r, { ok: true, sold: 1, unit, total: unit });
  assert.equal(s.money, 1000 + unit);
  const all = S.sellGood(s, "egg", "all");
  assert.equal(all.sold, 4);
  assert.equal(s.money, 1000 + 5 * unit);
  assert.equal(s.inv.egg, undefined);
  assert.equal(S.sellGood(s, "egg", 1).reason, "none");
  s.inv.milk = 3;
  assert.equal(S.sellGood(s, "milk", 0).reason, "none");
  assert.equal(S.sellGood(s, "milk", -2).reason, "none");
  assert.equal(S.sellGood(s, "milk", 1.5).reason, "none");
  assert.equal(s.inv.milk, 3);
  assert.equal(S.sellGood(s, "seed_daisy", 1).reason, "unknown", "seeds are not goods");
});

test("daily price drift is deterministic and small", () => {
  const s = fresh();
  const seen = new Set();
  for (let d = 0; d < 20; d++) {
    const p = S.sellPrice(s, "milk");
    assert.equal(p, S.sellPrice(s, "milk"));
    assert.ok(Math.abs(p - B.goods.milk) <= Math.ceil(B.goods.milk * B.market.driftAmplitude));
    seen.add(p);
    s.time += DAY;
  }
  assert.ok(seen.size > 1, "prices do move day to day");
});

test("animals sell for their adult value; juveniles are kept", () => {
  const s = fresh();
  const chick = S.spawnAnimal(s, "chicken", "f", { age: 0.5 });
  const r = S.sellAnimal(s, "chicken", "f");
  assert.deepEqual(r, { ok: true, sold: 1, unit: B.species.chicken.sell.f, total: B.species.chicken.sell.f });
  assert.ok(s.animals.includes(chick));
  assert.equal(S.sellAnimal(s, "chicken", "f").reason, "none");
  assert.ok(B.species.chicken.sell.f < B.species.chicken.buy.f, "no buy-sell arbitrage");
  for (const sp of ["cow", "horse"]) for (const x of ["f", "m"]) assert.ok(B.species[sp].sell[x] < B.species[sp].buy[x]);
});

test("cows and horses unlock only when their building is placed", () => {
  const s = fresh();
  s.money = 1e6;
  assert.equal(S.buy(s, "animal_cow_f").reason, "locked");
  assert.ok(S.buy(s, "kit_barn").ok);
  assert.equal(S.buy(s, "animal_cow_f").reason, "locked", "an unplaced kit unlocks nothing");
  assert.equal(S.isUnlocked(s, "horse"), false);
  const cell = S.layout.zoneCells("barn").find((c) => S.layout.checkPlacement(s, "barn", c.gx, c.gy).ok);
  S.drainEvents(s);
  assert.ok(S.place(s, "kit_barn", cell.gx, cell.gy).ok);
  assert.ok(S.drainEvents(s).some((e) => e.type === "unlock" && e.sp === "cow"));
  assert.ok(S.isUnlocked(s, "cow"));
  for (let i = 0; i < B.buildings.barn.capacity.cow; i++) assert.ok(S.buy(s, "animal_cow_f").ok);
  assert.equal(S.buy(s, "animal_cow_m").reason, "full");
  assert.equal(S.buy(s, "animal_horse_f").reason, "locked");
  withBuilding(s, "stable");
  assert.ok(S.buy(s, "animal_horse_f").ok);
});

test("bed prices escalate and beds are capped", () => {
  const s = fresh();
  s.money = 1e6;
  const prices = [];
  while (S.canBuy(s, "kit_bed").ok) prices.push(S.buy(s, "kit_bed").price);
  assert.equal(prices.length, B.beds.max - 1);
  for (let i = 1; i < prices.length; i++) assert.ok(prices[i] > prices[i - 1]);
  assert.equal(S.canBuy(s, "kit_bed").reason, "max");
});

test("placement rejects overlap, wrong zones and out-of-bounds cells", () => {
  const s = fresh(),
    bed = s.beds[0];
  s.inv.kit_bed = 1;
  s.inv.kit_barn = 1;
  assert.equal(S.place(s, "kit_bed", bed.gx + 1, bed.gy + 1).reason, "blocked", "overlap");
  assert.equal(S.place(s, "kit_bed", -500, -500).reason, "blocked", "out of bounds");
  assert.equal(S.place(s, "kit_bed", 1.5, 22).reason, "blocked", "non-integer cell");
  assert.equal(S.place(s, "kit_bed", 24, 25).reason, "blocked", "pond");
  assert.equal(S.place(s, "kit_bed", 15, 18).reason, "blocked", "cottage");
  const gardenCell = S.layout.zoneCells("bed").find((c) => S.layout.checkPlacement(s, "bed", c.gx, c.gy).ok);
  assert.equal(S.place(s, "kit_barn", gardenCell.gx, gardenCell.gy).reason, "blocked", "barns belong in the pasture");
  assert.equal(S.place(s, "kit_coop", gardenCell.gx, gardenCell.gy).reason, "noKit");
  assert.ok(S.place(s, "kit_bed", gardenCell.gx, gardenCell.gy).ok);
  assert.equal(s.inv.kit_bed, undefined);
  assert.equal(S.place(s, "kit_bed", gardenCell.gx, gardenCell.gy).reason, "noKit");
});

test("inventory stacks are capped for buying, harvesting and collecting", () => {
  const s = fresh(),
    bed = s.beds[0];
  s.inv.seed_daisy = B.inventory.stackMax;
  assert.equal(S.buy(s, "seed_daisy").reason, "stack");
  s.inv.feed_chicken = B.inventory.stackMax - B.feed.feed_chicken.units + 1;
  assert.equal(S.buy(s, "feed_chicken").reason, "stack");
  s.inv.daisy = B.inventory.stackMax;
  S.waterBed(s, bed.id);
  S.tick(s, B.crops.daisy.grow);
  assert.equal(S.harvest(s, bed.id, 0).reason, "stack");
  assert.equal(bed.plots[0].crop, "daisy", "crop waits in the bed");
  s.inv.egg = B.inventory.stackMax;
  s.pickups.push({ id: S.newId(s), kind: "egg", x: 300, y: 860, t: 0 });
  assert.equal(S.collect(s, s.pickups[0].id).reason, "stack");
  assert.equal(s.pickups.length, 1, "egg stays in the world");
});

test("anti-softlock: a broke, empty farm with no animals receives seeds and recovers", () => {
  const s = fresh();
  s.money = 0;
  s.inv = {};
  s.animals = [];
  s.pickups = [];
  for (const p of s.beds[0].plots) Object.assign(p, { crop: null, g: 0, w: 0 });
  assert.ok(S.isStuck(s));
  S.tick(s, B.softlock.intervalSeconds - 1);
  assert.equal(s.inv.seed_daisy, undefined);
  S.tick(s, 1);
  assert.ok(s.inv.seed_daisy > 0, "gift arrives");
  // Play the recovery: plant, water, grow, harvest, sell.
  while (s.inv.seed_daisy) S.plantBed(s, s.beds[0].id, "daisy");
  S.waterBed(s, s.beds[0].id);
  S.tick(s, B.crops.daisy.grow);
  assert.ok(S.harvestBed(s, s.beds[0].id).ok);
  assert.ok(S.sellGood(s, "daisy", "all").ok);
  assert.ok(s.money >= B.crops.daisy.seed, "can buy seeds again");
  assert.equal(S.isStuck(s), false);
});

test("anti-softlock: broke farmers with hungry animals and no food get feed", () => {
  const s = fresh();
  s.money = 0;
  s.inv = { seed_daisy: 1 };
  s.pickups = [];
  for (const a of s.animals) a.hunger = B.species.chicken.hungryAfter;
  S.tick(s, B.softlock.intervalSeconds);
  assert.ok(s.inv.feed_chicken >= 2, "one feed per hungry animal");
  for (const a of s.animals) assert.ok(S.feed(s, a.id).ok);
});

test("anti-softlock never gifts to a farm that can still trade", () => {
  const s = fresh();
  S.tick(s, 10 * B.softlock.intervalSeconds, { offline: true });
  run(s, 10 * B.softlock.intervalSeconds);
  assert.equal(s.stats.legacyXp, 0);
  assert.ok(!S.drainEvents(s).some((e) => e.type === "gift"));
});
