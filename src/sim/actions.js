// Player actions. Each validates fully and returns { ok, reason? }; a failed
// action never mutates state, so spam taps and stale UI are harmless.
import { BALANCE as B } from "../config/balance.js";
import { CROPS, GOODS, SEEDS, FEEDS, KITS, kitType, foodsFor, itemKind } from "./catalog.js";
import { checkPlacement } from "./layout.js";
import { addInventory, removeInventory, inventoryCapacity } from './inventory.js';
import { fenceBlocked } from './fences.js';
import {
  count,
  alive,
  needsOf,
  isAdult,
  isUnlocked,
  hasRoom,
  ownedOf,
  buyPrice,
  sellPrice,
  plotStage,
  spawnAnimal,
  housing,
  newId,
} from "./sim.js";

const fail = (reason) => ({ ok: false, reason });
const isCount = (n) => Number.isInteger(n) && n > 0;

function spend(s, amount, what) {
  s.money -= amount;
  s.stats.spent += amount;
  s.events.push({ type: "coins", delta: -amount, what });
}

function earn(s, amount, what) {
  s.money += amount;
  s.stats.earned += amount;
  s.events.push({ type: "coins", delta: amount, what });
}

function addItem(s, key, n) {
  return addInventory(s, key, n);
}

function takeItem(s, key, n = 1) {
  return removeInventory(s, key, n);
}

export function canBuy(s, key) {
  const price = buyPrice(s, key);
  if (price === null) return fail("unknown");
  const kind = itemKind(key);
  if (kind === "animal") {
    const [, sp] = key.split("_");
    if (!isUnlocked(s, sp)) return fail("locked");
    if (!hasRoom(s, sp)) return fail("full");
  } else if (kind === "kit") {
    const type = kitType(key),
      max = type === "bed" ? B.beds.max : B.buildings[type].max;
    if (ownedOf(s, type) >= max) return fail("max");
  } else {
    const units = kind === "feed" ? B.feed[key].units : 1;
    if (inventoryCapacity(s, key) < units) return fail("stack");
  }
  if (kind !== "animal" && inventoryCapacity(s, key) < (kind === "feed" ? B.feed[key].units : 1)) return fail("stack");
  if (!Number.isFinite(s.money) || s.money < price) return fail("money");
  return { ok: true, price };
}

export function buy(s, key) {
  const check = canBuy(s, key);
  if (!check.ok) return check;
  spend(s, check.price, key);
  const kind = itemKind(key);
  if (kind === "animal") {
    const [, sp, sex] = key.split("_");
    const a = spawnAnimal(s, sp, sex, { age: 1 });
    s.events.push({ type: "arrive", id: a.id, sp });
    return { ok: true, price: check.price, id: a.id };
  }
  addItem(s, key, kind === "feed" ? B.feed[key].units : 1);
  return { ok: true, price: check.price };
}

const sellable = (s, key) => GOODS.includes(key) && count(s, key) > 0;

export function sellGood(s, key, n = 1) {
  if (!GOODS.includes(key)) return fail("unknown");
  const have = count(s, key);
  const qty = n === "all" ? have : n;
  if (!isCount(qty) || have <= 0) return fail("none");
  const amount = Math.min(qty, have);
  const unit = sellPrice(s, key);
  takeItem(s, key, amount);
  s.stats.sold += amount;
  earn(s, unit * amount, key);
  return { ok: true, sold: amount, unit, total: unit * amount };
}

export function sellableAnimals(s, sp, sex) {
  return alive(s, sp)
    .filter((a) => a.sex === sex && isAdult(a))
    .sort((p, q) => p.breed - q.breed || q.id - p.id);
}

export function sellAnimal(s, sp, sex, n = 1) {
  if (!B.species[sp] || !["f", "m"].includes(sex)) return fail("unknown");
  const list = sellableAnimals(s, sp, sex);
  const qty = n === "all" ? list.length : n;
  if (!isCount(qty) || !list.length) return fail("none");
  const unit = B.species[sp].sell[sex],
    sold = list.slice(0, qty);
  s.animals = s.animals.filter((a) => !sold.includes(a));
  for (const a of sold) s.events.push({ type: "leave", id: a.id, sp });
  s.stats.sold += sold.length;
  earn(s, unit * sold.length, `animal_${sp}_${sex}`);
  return { ok: true, sold: sold.length, unit, total: unit * sold.length };
}

const bedOf = (s, id) => s.beds.find((b) => b.id === id);

export function plant(s, bedId, index, crop) {
  const bed = bedOf(s, bedId);
  if (!bed || !CROPS.includes(crop)) return fail("unknown");
  const p = bed.plots[index];
  if (!p) return fail("unknown");
  if (p.crop) return fail("occupied");
  if (count(s, "seed_" + crop) <= 0) return fail("noSeed");
  takeItem(s, "seed_" + crop);
  bed.plots[index] = { crop, g: 0, w: 0 };
  s.events.push({ type: "plant", bed: bedId, index, crop });
  return { ok: true };
}

// Plant the empty plot nearest to `prefer` (an index) in a bed.
export function plantBed(s, bedId, crop, prefer = 0) {
  const bed = bedOf(s, bedId);
  if (!bed) return fail("unknown");
  const order = bed.plots.map((_, i) => i).sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer));
  const index = order.find((i) => !bed.plots[i].crop);
  return index === undefined ? fail("occupied") : plant(s, bedId, index, crop);
}

export function waterBed(s, bedId) {
  const bed = bedOf(s, bedId);
  if (!bed) return fail("unknown");
  const thirsty = bed.plots.some((p) => p.w < B.water.seconds - 1);
  for (const p of bed.plots) p.w = B.water.seconds;
  s.events.push({ type: "water", bed: bedId });
  return { ok: true, changed: thirsty };
}

export function harvest(s, bedId, index) {
  const bed = bedOf(s, bedId);
  const p = bed?.plots[index];
  if (!p) return fail("unknown");
  if (!p.crop) return fail("empty");
  if (plotStage(p) !== 2) return fail("unripe");
  const C = B.crops[p.crop],
    good = C.good ?? p.crop;
  if (inventoryCapacity(s, good) < C.yield) return fail("stack");
  addItem(s, good, C.yield);
  s.stats.harvested += C.yield;
  bed.plots[index] = { crop: null, g: 0, w: p.w };
  s.events.push({ type: "harvest", bed: bedId, index, crop: p.crop, good, n: C.yield });
  return { ok: true, good, n: C.yield };
}

export function harvestBed(s, bedId) {
  const bed = bedOf(s, bedId);
  if (!bed) return fail("unknown");
  let n = 0,
    last = fail("unripe");
  bed.plots.forEach((p, i) => {
    if (plotStage(p) === 2) {
      last = harvest(s, bedId, i);
      if (last.ok) n++;
    }
  });
  return n ? { ok: true, plots: n } : last;
}

const animalOf = (s, id) => s.animals.find((a) => a.id === id);

function pickFood(s, sp, item) {
  const foods = foodsFor(sp);
  if (item) return foods.includes(item) && count(s, item) > 0 ? item : null;
  return foods.find((k) => count(s, k) > 0) ?? null;
}

export function feed(s, id, item = null) {
  const a = animalOf(s, id);
  if (!a) return fail("unknown");
  if (a.state !== "alive") return fail("dead");
  if (item && !foodsFor(a.sp).includes(item)) return fail("wrongFood");
  if (!needsOf(a).hungry) return fail("notHungry");
  const food = pickFood(s, a.sp, item);
  if (!food) return fail("noFood");
  takeItem(s, food);
  a.hunger = 0;
  s.events.push({ type: "fed", id, food });
  return { ok: true, food };
}

export function feedMany(s, ids, item = null) {
  let fed = 0,
    last = fail("notHungry");
  for (const id of ids) {
    const r = feed(s, id, item);
    if (r.ok) fed++;
    else if (r.reason === "noFood") {
      last = r;
      break;
    } else last = r;
  }
  return fed ? { ok: true, fed } : last;
}

export function waterAnimal(s, id) {
  const a = animalOf(s, id);
  if (!a) return fail("unknown");
  if (a.state !== "alive") return fail("dead");
  if (!needsOf(a).thirsty) return fail("notThirsty");
  a.thirst = 0;
  s.events.push({ type: "drank", id });
  return { ok: true };
}

export function waterMany(s, ids) {
  let n = 0;
  for (const id of ids) if (waterAnimal(s, id).ok) n++;
  return n ? { ok: true, watered: n } : fail("notThirsty");
}

export function collect(s, pickupId) {
  const p = s.pickups.find((q) => q.id === pickupId);
  if (!p) return fail("unknown");
  if (inventoryCapacity(s, p.kind) < 1) return fail("stack");
  s.pickups = s.pickups.filter((q) => q !== p);
  addItem(s, p.kind, 1);
  s.events.push({ type: "collect", id: p.id, kind: p.kind, x: p.x, y: p.y });
  return { ok: true, kind: p.kind };
}

// Tapping a coop, barn or stable gathers every egg or milk lying around it.
export function collectNear(s, x, y, radius = B.pickups.collectRadius) {
  let n = 0,
    last = fail("none");
  for (const p of [...s.pickups])
    if (Math.hypot(p.x - x, (p.y - y) * 1.6) <= radius) {
      last = collect(s, p.id);
      if (last.ok) n++;
    }
  return n ? { ok: true, n } : last;
}

export function place(s, kit, gx, gy) {
  if (!KITS.includes(kit)) return fail("unknown");
  if (count(s, kit) <= 0) return fail("noKit");
  const type = kitType(kit);
  if (!checkPlacement(s, type, gx, gy).ok) return fail("blocked");
  takeItem(s, kit);
  if (type === "bed") {
    const bed = { id: newId(s), gx, gy, plots: Array.from({ length: B.beds.plots }, () => ({ crop: null, g: 0, w: 0 })) };
    s.beds.push(bed);
    s.events.push({ type: "placed", kind: "bed", id: bed.id });
    return { ok: true, id: bed.id };
  }
  const firstOfType = !s.buildings.some((b) => b.type === type);
  const b = { id: newId(s), type, gx, gy };
  s.buildings.push(b);
  s.events.push({ type: "placed", kind: type, id: b.id });
  const unlocks = Object.entries(B.species).find(([, S]) => S.unlockedBy === type)?.[0];
  if (unlocks && firstOfType) s.events.push({ type: "unlock", sp: unlocks, building: type });
  return { ok: true, id: b.id };
}

export function clearBones(s, id) {
  const a = animalOf(s, id);
  if (!a) return fail("unknown");
  if (a.state !== "bones") return fail(a.state === "dead" ? "notYet" : "alive");
  s.animals = s.animals.filter((q) => q !== a);
  s.events.push({ type: "cleared", id, x: a.x, y: a.y, sp: a.sp });
  return { ok: true };
}

// The view writes agent positions back so dead animals and bones stay put across reloads.
export function setPositions(s, list, { includeDead = false } = {}) {
  for (const { id, x, y } of list) {
    const a = animalOf(s, id);
    if (a && (a.state === "alive" || includeDead) && Number.isFinite(x) && Number.isFinite(y)) {
      if (!fenceBlocked(s, a.x, a.y, x, y)) { a.x = x; a.y = y; }
    }
  }
}

export { housing, SEEDS, FEEDS };
