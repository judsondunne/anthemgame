// Pure, deterministic farm simulation: state creation, derived queries and tick.
// No DOM, Three.js or wall-clock access; randomness comes from state.rng.
import { BALANCE as B, DAY_SECONDS as DAY } from "../config/balance.js";
import { SPECIES, CROPS, GOODS, SEEDS, KITS, kitType, goodBaseValue, foodsFor } from "./catalog.js";
import { BASE_COOP, STARTER_BED, ZONES, frontOf, openGround, plotPosition } from "./layout.js";
import { nextRandom, hash32 } from "./rng.js";
import { dayIndex, nextTimeAtHour } from "./clock.js";
import { initializeInventory, addInventory, inventoryCapacity } from './inventory.js';
import { stepPredators } from './predators.js';
import { stepWandering } from './wandering.js';
import { penAt } from './fences.js';

export const SCHEMA_VERSION = B.save.schemaVersion;

const emptyPlot = () => ({ crop: null, g: 0, w: 0 });
// Thresholds compare with a small tolerance so accumulated float steps land exactly.
const EPS = 1e-6;
const reached = (value, limit) => value >= limit - EPS;
export const newId = (s) => s.nextId++;

export function createState({ seed = B.start.seed } = {}) {
  const s = {
    schemaVersion: SCHEMA_VERSION,
    rev: 0,
    seq: 0,
    savedAt: 0,
    seed: seed >>> 0,
    rng: seed >>> 0,
    time: 0,
    money: B.start.money,
    inv: {},
    inventoryOverflow: [],
    beds: [],
    buildings: [],
    animals: [],
    pickups: [],
    fences: [],
    predators: [],
    alerts: [],
    predatorSchedule: { lastNight: -1, encounters: 0 },
    player: { mode: 'god', x: 650, y: 700, yaw: 0, pitch: 0 },
    softlock: { clock: 0 },
    celebrated: { cow: false, horse: false },
    stats: { earned: 0, spent: 0, sold: 0, harvested: 0, births: 0, deaths: 0, legacyXp: 0 },
    ui: { tool: "hand", placing: null },
    nextId: 1,
    events: [],
  };
  for (const [k, n] of Object.entries(B.start.inventory)) s.inv[k] = n;
  initializeInventory(s);
  const bed = { id: newId(s), gx: STARTER_BED.gx, gy: STARTER_BED.gy, plots: Array.from({ length: B.beds.plots }, emptyPlot) };
  B.start.planted.forEach((crop, i) => (bed.plots[i] = { crop, g: 0, w: 0 }));
  s.beds.push(bed);
  for (const a of B.start.animals) spawnAnimal(s, a.sp, a.sex, { age: 1 });
  s.events = [];
  return s;
}

// ---------- derived queries ----------

export const count = (s, key) => s.inv[key] ?? 0;
export const alive = (s, sp) => s.animals.filter((a) => a.state === "alive" && (!sp || a.sp === sp));
export const isAdult = (a) => a.age >= 1;

export function needsOf(a) {
  const S = B.species[a.sp];
  const hungry = reached(a.hunger, S.hungryAfter),
    thirsty = reached(a.thirst, S.thirstyAfter);
  const unmet = Math.max(0, a.hunger - S.hungryAfter, a.thirst - S.thirstyAfter);
  const N = B.neglect;
  const level =
    a.state !== "alive" ? a.state : reached(unmet, N.sadDays * DAY) ? "sad" : reached(unmet, N.urgentDays * DAY) ? "urgent" : hungry || thirsty ? "needs" : "ok";
  return { hungry, thirsty, unmet, level, content: !hungry && !thirsty, untilDeath: N.deathDays * DAY - unmet };
}

// Housing: placed buildings fill first (best multipliers), then the starter coop.
export function housing(s) {
  const cap = { chicken: B.species.chicken.baseCapacity, cow: B.species.cow.baseCapacity, horse: B.species.horse.baseCapacity };
  const slots = { chicken: [], cow: [], horse: [] };
  for (const b of [...s.buildings].sort((p, q) => p.id - q.id))
    for (const [sp, n] of Object.entries(B.buildings[b.type].capacity)) {
      slots[sp].push({ b, n });
      cap[sp] += n;
    }
  slots.chicken.push({ b: null, n: B.species.chicken.baseCapacity });
  const homes = new Map();
  for (const sp of SPECIES) {
    const list = alive(s, sp).sort((p, q) => p.id - q.id);
    let k = 0;
    for (const slot of slots[sp]) for (let i = 0; i < slot.n && k < list.length; i++) homes.set(list[k++].id, slot.b);
    for (; k < list.length; k++) homes.set(list[k].id, slots[sp][0]?.b ?? null);
  }
  return { cap, homes };
}

export function homeBuilding(s, a, h = housing(s)) {
  return h.homes.get(a.id) ?? null;
}

export function multipliers(b) {
  return b ? { produce: B.buildings[b.type].produce, fertility: B.buildings[b.type].fertility } : { produce: 1, fertility: 1 };
}

export const lawnOf = (sp) => (sp === "chicken" ? "garden" : sp === "cow" ? "west" : "east");

// Where an animal gathers: its building's front, the starter coop, or the pasture.
export function homePoint(s, a, h = housing(s)) {
  const b = homeBuilding(s, a, h);
  if (b) return frontOf(b).approach;
  if (a.sp === "chicken") return BASE_COOP.approach;
  const z = ZONES[lawnOf(a.sp)];
  return { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 };
}

export function isUnlocked(s, sp) {
  const by = B.species[sp].unlockedBy;
  return !by || s.buildings.some((b) => b.type === by);
}

export function hasRoom(s, sp, h = housing(s)) {
  return alive(s, sp).length < h.cap[sp] && alive(s).length < B.animals.maxTotal;
}

export function ownedOf(s, type) {
  return type === "bed" ? s.beds.length + count(s, "kit_bed") : s.buildings.filter((b) => b.type === type).length + count(s, "kit_" + type);
}

export function bedPrice(s) {
  return Math.round(B.beds.basePrice * B.beds.priceGrowth ** Math.max(0, ownedOf(s, "bed") - 1));
}

export function buyPrice(s, key) {
  if (key === 'fence') return B.fences.price;
  if (key === 'gate') return B.fences.gatePrice;
  if (SEEDS.includes(key)) return B.crops[key.slice(5)].seed;
  if (key in B.feed) return B.feed[key].price;
  if (key === "kit_bed") return bedPrice(s);
  if (KITS.includes(key)) return B.buildings[kitType(key)].price;
  const m = /^animal_(chicken|cow|horse)_(f|m)$/.exec(key);
  if (m) return B.species[m[1]].buy[m[2]];
  return null;
}

export function driftOf(s, key) {
  const u = (hash32(s.seed, dayIndex(s.time), key) / 4294967296) * 2 - 1;
  return 1 + B.market.driftAmplitude * u;
}

export function sellPrice(s, key) {
  const base = goodBaseValue(key);
  return base > 0 ? Math.max(1, Math.round(base * driftOf(s, key))) : 0;
}

export function plotStage(p) {
  if (!p.crop) return -1;
  return reached(p.g, 1) ? 2 : reached(p.g, B.stages.growing) ? 1 : 0;
}

// ---------- spawning ----------

// Random open spot near a point, widening in rings when the area is crowded
// (e.g. a coop placed hard against a bed).
function scatterNear(s, lawn, near, spread) {
  const enclosure = penAt(s, near.x, near.y);
  for (let ring = 1; ring <= 4; ring++)
    for (let i = 0; i < 16; i++) {
      const ang = nextRandom(s) * Math.PI * 2,
        r = spread * ring * (0.3 + 0.7 * nextRandom(s));
      const x = near.x + Math.cos(ang) * r,
        y = near.y + Math.sin(ang) * r * 0.6;
      if (openGround(s, lawn, x, y) && (!enclosure || penAt(s, x, y)?.id === enclosure.id) && !s.pickups.some((p) => Math.hypot(p.x - x, p.y - y) < 18)) return { x, y };
    }
  return openGround(s, lawn, near.x, near.y) ? { x: near.x, y: near.y } : null;
}

export function spawnAnimal(s, sp, sex, { age = 1, near = null, variant = null } = {}) {
  const a = {
    id: newId(s),
    sp,
    sex,
    var: variant ?? Math.floor(nextRandom(s) * 4),
    born: s.time,
    age,
    hunger: 0,
    thirst: 0,
    prod: 0,
    breed: 0,
    state: "alive",
    deadFor: 0,
    x: 0,
    y: 0,
    health: B.predators.maxHealth,
    injured: false,
  };
  s.animals.push(a);
  const p = scatterNear(s, lawnOf(sp), near ?? homePoint(s, a), 60) ?? near ?? homePoint(s, a);
  a.x = p.x;
  a.y = p.y;
  return a;
}

function layProduct(s, a, h) {
  if (s.pickups.length >= B.pickups.max) return false;
  const home = homePoint(s, a, h);
  const near = a.sp === "chicken" ? { x: home.x + 10, y: home.y + 14 } : { x: home.x, y: home.y + 26 };
  const p = scatterNear(s, lawnOf(a.sp), near, B.pickups.spread);
  if (!p) return false;
  const pk = { id: newId(s), kind: B.species[a.sp].product, x: p.x, y: p.y, t: s.time, from: a.id };
  s.pickups.push(pk);
  s.events.push({ type: "pickup", id: pk.id, kind: pk.kind, from: a.id });
  return true;
}

// ---------- anti-softlock ----------

export function isStuck(s) {
  const cheapestSeed = Math.min(...CROPS.map((c) => B.crops[c].seed));
  if (s.money >= cheapestSeed) return false;
  if (SEEDS.some((k) => count(s, k) > 0)) return false;
  if (s.beds.some((b) => b.plots.some((p) => p.crop))) return false;
  if (GOODS.some((k) => count(s, k) > 0)) return false;
  if (s.pickups.length) return false;
  return true;
}

function hungryWithoutFood(s) {
  return alive(s).filter((a) => {
    if (!needsOf(a).hungry) return false;
    if (foodsFor(a.sp).some((k) => count(s, k) > 0)) return false;
    return s.money < B.feed[foodsFor(a.sp)[0]].price && !GOODS.some((k) => count(s, k) > 0) && !s.pickups.length;
  });
}

function softlockStep(s, h) {
  const seedless = isStuck(s),
    starving = hungryWithoutFood(s);
  if (!seedless && !starving.length) {
    s.softlock.clock = 0;
    return;
  }
  s.softlock.clock += h;
  if (s.softlock.clock < B.softlock.intervalSeconds) return;
  s.softlock.clock = 0;
  const gift = {};
  if (seedless) for (const [k, n] of Object.entries(B.softlock.seeds)) gift[k] = (gift[k] ?? 0) + n;
  for (const a of starving) {
    const k = foodsFor(a.sp)[0];
    gift[k] = (gift[k] ?? 0) + B.softlock.feedPerHungryAnimal;
  }
  for (const [k, n] of Object.entries(gift)) {
    const add = Math.min(n, inventoryCapacity(s, k));
    if (add > 0) addInventory(s, k, add);
  }
  s.events.push({ type: "gift", items: gift });
}

// ---------- tick ----------

function stepOnce(s, h, offline) {
  s.time += h;
  for (const bed of s.beds)
    for (const p of bed.plots) {
      if (!p.crop || p.g >= 1) continue;
      const use = Math.min(h, p.w);
      if (use <= 0) continue;
      p.w -= use;
      p.g = Math.min(1, p.g + use / B.crops[p.crop].grow);
      if (reached(p.g, 1)) p.g = 1;
      if (p.g >= 1) s.events.push({ type: "ripe", bed: bed.id, crop: p.crop });
    }

  const hs = housing(s),
    N = B.neglect;
  for (const a of s.animals) {
    if (a.state === "dead") {
      a.deadFor += h;
      if (reached(a.deadFor, N.bonesDays * DAY)) {
        a.state = "bones";
        s.events.push({ type: "bones", id: a.id });
      }
      continue;
    }
    if (a.state !== "alive") continue;
    const S = B.species[a.sp];
    // Need clocks only move during active play; offline catch-up never harms animals.
    if (!offline) {
      a.hunger += h;
      a.thirst += h;
      if (reached(needsOf(a).unmet, N.deathDays * DAY)) {
        a.state = "dead";
        a.deadFor = 0;
        a.breed = 0;
        s.stats.deaths++;
        s.events.push({ type: "death", id: a.id, sp: a.sp });
        continue;
      }
    }
    const content = needsOf(a).content,
      mult = multipliers(homeBuilding(s, a, hs));
    if (a.age < 1) {
      a.age = Math.min(1, a.age + h / (S.growDays * DAY));
      if (reached(a.age, 1)) a.age = 1;
      if (a.age >= 1) s.events.push({ type: "mature", id: a.id, sp: a.sp });
      continue;
    }
    if (S.product && a.sex === "f") {
      a.prod += h * mult.produce * (content ? 1 : N.produceFactor);
      if (reached(a.prod, S.produceEvery)) {
        if (layProduct(s, a, hs)) a.prod = Math.max(0, a.prod - S.produceEvery);
        else a.prod = S.produceEvery;
      }
    }
  }

  for (const sp of SPECIES) {
    const adults = alive(s, sp).filter((a) => isAdult(a) && needsOf(a).content);
    const males = adults.filter((a) => a.sex === "m"),
      females = adults.filter((a) => a.sex === "f").sort((p, q) => p.id - q.id);
    const need = B.species[sp].breedDays * DAY;
    for (let i = 0; i < Math.min(males.length, females.length); i++) {
      const f = females[i];
      f.breed += h * multipliers(homeBuilding(s, f, hs)).fertility;
      if (!reached(f.breed, need)) continue;
      if (!hasRoom(s, sp)) {
        f.breed = need; // held until housing frees up
        continue;
      }
      f.breed = 0;
      const baby = spawnAnimal(s, sp, nextRandom(s) < 0.5 ? "f" : "m", { age: 0, near: { x: f.x - 14, y: f.y + 10 }, variant: f.var });
      s.stats.births++;
      s.events.push({ type: "birth", id: baby.id, sp, mother: f.id });
    }
  }

  if (!offline) softlockStep(s, h);
  if (!offline) {
    stepWandering(s, h, hs);
    stepPredators(s, h);
  }
}

export function tick(s, dt, { offline = false } = {}) {
  if (!(dt > 0) || !Number.isFinite(dt)) return s;
  const step = offline ? B.offline.stepSeconds : B.time.substepSeconds;
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(step, left);
    stepOnce(s, h, offline);
    left -= h;
  }
  return s;
}

// Offline catch-up: capped, need clocks frozen, never fatal.
export function catchUp(s, realSeconds) {
  const dt = Math.min(Math.max(0, Number.isFinite(realSeconds) ? realSeconds : 0), B.offline.capSeconds);
  tick(s, dt, { offline: true });
  if (dt > 0) {
    s.predators = []; s.alerts = [];
    s.predatorSchedule.lastNight = dayIndex(s.time);
  }
  return dt;
}

// Test hook: jump forward to the next time the clock shows `hour` (never backwards).
export function advanceToHour(s, hour, opts) {
  const target = nextTimeAtHour(s.time, hour);
  return tick(s, target - s.time, opts);
}

export function drainEvents(s) {
  const e = s.events;
  s.events = [];
  return e;
}

export { plotPosition };
