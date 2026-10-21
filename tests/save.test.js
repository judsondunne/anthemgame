import test from "node:test";
import assert from "node:assert/strict";
import { S, B, DAY, fresh, run, withBuilding } from "./helpers.js";

function playedFarm() {
  const s = fresh(3);
  s.money = 50000;
  withBuilding(s, "coop");
  withBuilding(s, "barn");
  S.buy(s, "animal_cow_f");
  S.buy(s, "kit_stable");
  s.ui.placing = { kit: "kit_stable", gx: 40, gy: 26 };
  S.waterBed(s, s.beds[0].id);
  run(s, 1300);
  const dying = s.animals.find((a) => a.sp === "cow");
  dying.hunger = 999;
  const dead = S.spawnAnimal(s, "chicken", "f");
  dead.state = "dead";
  dead.deadFor = 100;
  const bones = S.spawnAnimal(s, "chicken", "m");
  bones.state = "bones";
  S.drainEvents(s);
  return s;
}

test("save -> load round trip is lossless mid-everything", () => {
  const s = playedFarm();
  assert.ok(s.animals.some((a) => a.age < 1), "a baby is mid-growth");
  assert.ok(s.animals.some((a) => a.breed > 0), "a pair is mid-breeding");
  const text = S.serialize(s);
  const back = S.loadText(text);
  assert.ok(back.ok, back.reason);
  assert.deepEqual(back.problems, []);
  assert.deepEqual(S.toDoc(back.state), S.toDoc(s));
  // And the restored farm keeps ticking identically.
  run(s, 500);
  run(back.state, 500);
  assert.deepEqual(S.toDoc(back.state), S.toDoc(s));
});

test("events are transient and never saved", () => {
  const s = fresh();
  s.events.push({ type: "coins", delta: 1 });
  assert.equal(JSON.parse(S.serialize(s)).events, undefined);
});

test("v0 legacy XP saves migrate into a fresh farm", () => {
  const r = S.loadText(JSON.stringify({ xp: 345 }));
  assert.ok(r.ok);
  assert.equal(r.state.schemaVersion, S.SCHEMA_VERSION);
  assert.equal(r.state.stats.legacyXp, 345);
  assert.equal(r.state.money, B.start.money);
});

test("v1 saves migrate to the current schema", () => {
  const v1 = {
    schemaVersion: 1,
    seed: 9,
    rng: 12345,
    time: 4321,
    coins: 777,
    inventory: [
      { k: "seed_tulip", n: 4 },
      { k: "egg", n: 2 },
      { k: "egg", n: 1 },
    ],
    beds: [{ id: 1, gx: 7, gy: 25, plots: [{ crop: "tulip", g: 0.5, w: 20 }] }],
    buildings: [{ id: 2, type: "barn", gx: -20, gy: 26 }],
    animals: [
      { id: 3, sp: "cow", sex: "f", age: 1, hunger: 10, thirst: 5, prod: 1, breed: 0, dead: false, x: -500, y: 700 },
      { id: 4, sp: "chicken", sex: "m", age: 1, hunger: 0, thirst: 0, prod: 0, breed: 0, dead: true, deadFor: 400, x: 300, y: 860 },
    ],
    pickups: [],
    nextId: 5,
  };
  const r = S.loadText(JSON.stringify(v1));
  assert.ok(r.ok, r.reason);
  const s = r.state;
  assert.equal(s.schemaVersion, S.SCHEMA_VERSION);
  assert.equal(s.money, 777);
  assert.deepEqual(s.inv, { seed_tulip: 4, egg: 3 });
  assert.equal(s.animals[0].state, "alive");
  assert.equal(s.animals[1].state, "bones");
  assert.equal(s.celebrated.cow, true, "already-owned barn does not celebrate again");
  assert.equal(s.beds[0].plots.length, B.beds.plots);
  assert.equal(s.coins, undefined);
  assert.equal(s.inventory, undefined);
  assert.deepEqual(s.ui, { tool: "hand", placing: null });
});

test("corrupt, empty and future saves are refused rather than trusted", () => {
  assert.equal(S.loadText("").reason, "empty");
  assert.equal(S.loadText("{not json").reason, "corrupt");
  assert.equal(S.loadText("[]").reason, "corrupt");
  assert.equal(S.loadText("null").reason, "corrupt");
  assert.equal(S.loadText(JSON.stringify({ schemaVersion: 99, beds: [], animals: [] })).reason, "newer");
  assert.equal(S.loadText(JSON.stringify({ schemaVersion: 2, time: 5 })).reason, "corrupt");
  assert.equal(S.loadText(JSON.stringify({ schemaVersion: 2, time: -1, beds: [], animals: [] })).reason, "corrupt");
});

test("validation repairs damage: negative money, junk items, bad ids", () => {
  const s = fresh();
  const doc = S.toDoc(s);
  doc.money = -50;
  doc.inv.junk = 4;
  doc.inv.egg = 1e9;
  doc.nextId = 1;
  doc.animals.push({ id: 99, sp: "dragon", sex: "f", state: "alive" });
  const r = S.loadObject(doc);
  assert.ok(r.ok);
  assert.equal(r.state.money, 0);
  assert.equal(r.state.inv.junk, undefined);
  assert.equal(r.state.inv.egg, B.inventory.stackMax);
  assert.equal(r.state.animals.length, 2);
  assert.ok(r.state.nextId > Math.max(...r.state.animals.map((a) => a.id)));
});

test("offline catch-up is capped and never advances need clocks or kills", () => {
  const s = fresh();
  const h = s.animals[0];
  h.hunger = B.species.chicken.hungryAfter + 2 * DAY - 1; // one second from death
  h.thirst = 10;
  S.waterBed(s, s.beds[0].id);
  const t0 = s.time;
  const used = S.catchUp(s, 6 * 3600); // tab hidden for six hours
  assert.equal(used, B.offline.capSeconds);
  assert.equal(s.time, t0 + B.offline.capSeconds);
  assert.equal(h.state, "alive");
  assert.equal(h.hunger, B.species.chicken.hungryAfter + 2 * DAY - 1);
  assert.equal(h.thirst, 10);
  assert.equal(S.plotStage(s.beds[0].plots[0]), 2, "crops still grew");
  assert.ok(s.pickups.length > 0, "production continued");
  S.tick(s, 1);
  assert.equal(h.state, "dead", "deaths only happen in active play");
});

test("time going backwards or garbage durations are ignored", () => {
  const s = fresh();
  const before = S.serialize(s);
  S.tick(s, -30);
  S.tick(s, NaN);
  S.tick(s, Infinity);
  assert.equal(S.catchUp(s, -5000), 0);
  assert.equal(S.catchUp(s, NaN), 0);
  assert.equal(S.serialize(s), before);
});

test("juveniles grow during offline catch-up", () => {
  const s = fresh();
  const chick = S.spawnAnimal(s, "chicken", "f", { age: 0 });
  S.catchUp(s, 1e9);
  assert.ok(Math.abs(chick.age - B.offline.capSeconds / (3 * DAY)) < 1e-9);
});
