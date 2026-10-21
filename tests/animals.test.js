import test from "node:test";
import assert from "node:assert/strict";
import { S, B, DAY, fresh, pamper, run, withBuilding, addAnimal, chickens } from "./helpers.js";

const hen = (s) => s.animals.find((a) => a.sp === "chicken" && a.sex === "f");
const eggs = (s) => s.pickups.filter((p) => p.kind === "egg").length;

test("a fed hen lays exactly one egg per production interval", () => {
  const s = fresh();
  const every = B.species.chicken.produceEvery;
  run(s, every * 10 - 1);
  assert.equal(eggs(s), 9);
  run(s, 1);
  assert.equal(eggs(s), 10);
  const p = s.pickups[0];
  assert.ok(S.collect(s, p.id).ok);
  assert.equal(s.inv.egg, 1);
  assert.equal(S.collect(s, p.id).reason, "unknown", "double tap does not double collect");
  assert.equal(s.inv.egg, 1);
});

test("hungry hens still lay, at the neglect rate", () => {
  const s = fresh(),
    h = hen(s);
  for (const a of s.animals) a.hunger = B.species.chicken.hungryAfter;
  const every = B.species.chicken.produceEvery / B.neglect.produceFactor;
  S.tick(s, every - 1);
  assert.equal(eggs(s), 0);
  S.tick(s, 1);
  assert.equal(eggs(s), 1);
  assert.equal(h.state, "alive");
});

test("roosters never lay", () => {
  const s = fresh();
  s.animals = s.animals.filter((a) => a.sex === "m");
  run(s, 2000);
  assert.equal(eggs(s), 0);
});

test("coop multiplies egg production and fertility for the hens it houses", () => {
  const s = fresh(),
    coop = withBuilding(s, "coop"),
    C = B.buildings.coop;
  assert.equal(S.homeBuilding(s, hen(s)), coop);
  const every = B.species.chicken.produceEvery / C.produce;
  run(s, Math.ceil(every * 6));
  assert.equal(eggs(s), 6);
  const s2 = fresh();
  withBuilding(s2, "coop");
  const need = (B.species.chicken.breedDays * DAY) / C.fertility;
  run(s2, Math.ceil(need) - 1);
  assert.equal(chickens(s2).length, 2);
  run(s2, 1);
  assert.equal(chickens(s2).length, 3, "baby arrives at breedDays / fertility");
});

test("cows give milk on their longer rhythm; bulls do not", () => {
  const s = fresh();
  s.money = 1e6;
  const barn = withBuilding(s, "barn");
  assert.ok(S.buy(s, "animal_cow_f").ok);
  assert.ok(S.buy(s, "animal_cow_m").ok);
  const cow = s.animals.find((a) => a.sp === "cow" && a.sex === "f");
  assert.equal(S.homeBuilding(s, cow), barn);
  s.pickups = [];
  for (const a of s.animals) a.prod = 0;
  const every = B.species.cow.produceEvery / B.buildings.barn.produce;
  run(s, Math.ceil(every * 3));
  assert.equal(s.pickups.filter((p) => p.kind === "milk").length, 3);
  assert.equal(B.species.horse.product, null, "horses are bred and sold, not milked");
});

test("a content pair breeds exactly every 2 game days", () => {
  const s = fresh();
  const need = B.species.chicken.breedDays * DAY;
  assert.equal(need, 1200);
  run(s, need - 1);
  assert.equal(chickens(s).length, 2);
  run(s, 1);
  assert.equal(chickens(s).length, 3);
  const baby = chickens(s).at(-1);
  assert.equal(baby.age, 0);
  assert.equal(s.stats.births, 1);
  run(s, need);
  assert.equal(chickens(s).length, 4, "one baby per pair per interval");
});

test("breeding pauses while either parent needs care", () => {
  const s = fresh();
  for (const a of s.animals) a.hunger = B.species.chicken.hungryAfter;
  S.tick(s, 600);
  assert.equal(hen(s).breed, 0);
});

test("juveniles mature over exactly 3 game days and only adults produce", () => {
  const s = fresh();
  s.animals = [];
  const chick = addAnimal(s, "chicken", "f", 0);
  run(s, 3 * DAY - 1);
  assert.ok(chick.age < 1);
  assert.equal(eggs(s), 0, "juveniles never lay");
  run(s, 1);
  assert.equal(chick.age, 1);
  run(s, B.species.chicken.produceEvery);
  assert.equal(eggs(s), 1);
});

test("starvation kills at 2 game days of unmet hunger, with gentle escalation first", () => {
  const s = fresh(),
    h = hen(s),
    A = B.species.chicken.hungryAfter;
  s.animals = [h];
  const water = () => (h.thirst = 0);
  for (let t = 0; t < A + 2 * DAY - 1; t++) {
    water();
    S.tick(s, 1);
    if (t === A + DAY) assert.equal(S.needsOf(h).level, "urgent");
    if (t === A + 1.5 * DAY) assert.equal(S.needsOf(h).level, "sad");
  }
  assert.equal(h.state, "alive", "alive one second before the limit");
  water();
  S.tick(s, 1);
  assert.equal(h.state, "dead");
  assert.equal(s.stats.deaths, 1);
});

test("thirst alone is just as fatal", () => {
  const s = fresh(),
    h = hen(s),
    A = B.species.chicken.thirstyAfter;
  s.animals = [h];
  for (let t = 0; t < A + 2 * DAY; t++) {
    h.hunger = 0;
    S.tick(s, 1);
  }
  assert.equal(h.state, "dead");
});

test("dead animals become bones after half a day, then clear on tap", () => {
  const s = fresh(),
    h = hen(s);
  h.state = "dead";
  h.deadFor = 0;
  const pos = { x: h.x, y: h.y };
  S.tick(s, 0.5 * DAY - 1);
  assert.equal(h.state, "dead");
  assert.equal(S.clearBones(s, h.id).reason, "notYet");
  S.tick(s, 1);
  assert.equal(h.state, "bones");
  assert.deepEqual({ x: h.x, y: h.y }, pos, "remains stay where the animal fell");
  assert.ok(S.clearBones(s, h.id).ok);
  assert.equal(s.animals.includes(h), false);
});

test("dead animals cannot be fed, watered, sold, breed or produce", () => {
  const s = fresh(),
    h = hen(s);
  h.state = "dead";
  const inv = { ...s.inv };
  assert.equal(S.feed(s, h.id).reason, "dead");
  assert.equal(S.waterAnimal(s, h.id).reason, "dead");
  assert.deepEqual(s.inv, inv, "no feed wasted on the dead");
  assert.equal(S.sellAnimal(s, "chicken", "f").reason, "none");
  pamper(s);
  S.tick(s, 3 * DAY);
  assert.equal(eggs(s), 0);
  assert.equal(chickens(s).length, 2);
});

test("feeding only consumes food when hungry, prefers species feed, accepts hay", () => {
  const s = fresh(),
    h = hen(s);
  const feed0 = s.inv.feed_chicken;
  assert.equal(S.feed(s, h.id).reason, "notHungry");
  assert.equal(s.inv.feed_chicken, feed0);
  h.hunger = B.species.chicken.hungryAfter;
  assert.equal(S.feed(s, h.id, "feed_cow").reason, "wrongFood");
  s.inv.hay = 2;
  assert.ok(S.feed(s, h.id).ok);
  assert.equal(s.inv.feed_chicken, feed0 - 1, "species feed first");
  h.hunger = B.species.chicken.hungryAfter;
  assert.ok(S.feed(s, h.id, "hay").ok);
  assert.equal(s.inv.hay, 1);
  delete s.inv.feed_chicken;
  delete s.inv.hay;
  h.hunger = B.species.chicken.hungryAfter;
  assert.equal(S.feed(s, h.id).reason, "noFood");
  assert.equal(S.waterAnimal(s, h.id).reason, "notThirsty");
});

test("breeding with no housing capacity holds the baby until room frees up", () => {
  const s = fresh();
  addAnimal(s, "chicken", "f");
  addAnimal(s, "chicken", "f");
  assert.equal(S.housing(s).cap.chicken, chickens(s).length);
  const need = B.species.chicken.breedDays * DAY;
  run(s, need + 300);
  assert.equal(chickens(s).length, 4, "no birth without room");
  assert.equal(hen(s).breed, need, "progress held, not lost");
  assert.equal(S.buy(s, "animal_chicken_f").reason, "full");
  assert.ok(S.sellAnimal(s, "chicken", "f").ok);
  run(s, 1);
  assert.equal(chickens(s).length, 4, "the held baby arrives once a hen leaves");
});

test("the global animal cap stops purchases and births", () => {
  const s = fresh();
  s.money = 1e7;
  for (const t of ["coop", "coop", "barn", "barn", "stable", "stable"]) withBuilding(s, t);
  const buyAll = (key) => {
    while (S.buy(s, key).ok);
  };
  buyAll("animal_horse_f");
  buyAll("animal_cow_f");
  buyAll("animal_chicken_f");
  assert.equal(S.alive(s).length, B.animals.maxTotal);
  assert.ok(S.housing(s).cap.chicken > S.alive(s, "chicken").length, "species room left");
  assert.equal(S.buy(s, "animal_chicken_m").reason, "full", "global cap binds");
  run(s, 2 * DAY);
  assert.equal(S.alive(s).length, B.animals.maxTotal);
});
