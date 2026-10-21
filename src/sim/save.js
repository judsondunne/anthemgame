// Save documents: serialise, migrate older schemas, validate/repair.
import { BALANCE as B } from "../config/balance.js";
import { SPECIES, CROPS, KITS, BUILDING_TYPES, SEEDS, FEEDS, GOODS } from "./catalog.js";
import { createState, SCHEMA_VERSION } from "./sim.js";
import { initializeInventory, syncInventory, SLOT_COUNT } from './inventory.js';
import { dayIndex, isNightAt } from './clock.js';

export { SCHEMA_VERSION };
const ITEM_KEYS = new Set([...SEEDS, ...FEEDS, ...GOODS, ...KITS, 'fence', 'gate']);
const DAY = B.time.cycleSeconds;

export function toDoc(s) {
  syncInventory(s);
  const { events, predators, alerts, ...doc } = s;
  return JSON.parse(JSON.stringify(doc));
}

export function serialize(s) {
  return JSON.stringify(toDoc(s));
}

// v0: the pre-economy garden only stored { xp } under 'garden-progress'.
function fromV0(doc) {
  const s = createState();
  s.stats.legacyXp = Math.max(0, Math.floor(Number(doc.xp) || 0));
  return toDoc(s);
}

// v1: first economy draft used `coins`, an [{k, n}] inventory, boolean `dead`
// on animals and had no ui/celebrated/softlock records.
function fromV1(doc) {
  const inv = {};
  for (const e of Array.isArray(doc.inventory) ? doc.inventory : []) if (e && typeof e.k === "string") inv[e.k] = (inv[e.k] ?? 0) + Number(e.n || 0);
  const buildings = Array.isArray(doc.buildings) ? doc.buildings : [];
  return {
    ...doc,
    schemaVersion: 2,
    money: doc.coins,
    inv,
    animals: (Array.isArray(doc.animals) ? doc.animals : []).map((a) => ({
      var: 0,
      deadFor: 0,
      ...a,
      state: a.dead ? (Number(a.deadFor) >= B.neglect.bonesDays * DAY ? "bones" : "dead") : "alive",
    })),
    softlock: { clock: 0 },
    celebrated: { cow: buildings.some((b) => b.type === "barn"), horse: buildings.some((b) => b.type === "stable") },
    ui: { tool: "hand", placing: null },
    stats: { earned: 0, spent: 0, sold: 0, harvested: 0, births: 0, deaths: 0, legacyXp: 0, ...(doc.stats ?? {}) },
    coins: undefined,
    inventory: undefined,
  };
}

function fromV2(doc) {
  const next = { ...doc, schemaVersion: 3,
    fences: doc.fences || [], predators: [], alerts: [],
    player: doc.player || { mode: 'god', x: 650, y: 700, yaw: 0, pitch: 0 },
    predatorSchedule: { lastNight: dayIndex(Number(doc.time) || 0), encounters: 0 },
    animals: (doc.animals || []).map(a => ({ ...a, health: a.health ?? B.predators.maxHealth, injured: false })),
  };
  initializeInventory(next);
  return next;
}
function fromV3(doc) {
  const open = !isNightAt(Number(doc.time) || 0);
  const coops = { base: { doorOpen: open, doorProgress: open ? 1 : 0 } };
  for (const b of doc.buildings || []) if (b.type === 'coop') coops[String(b.id)] = { doorOpen: open, doorProgress: open ? 1 : 0 };
  return { ...doc, schemaVersion: 4, coops };
}
const MIGRATIONS = { 0: fromV0, 1: fromV1, 2: fromV2, 3: fromV3 };

export function migrate(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("not an object");
  let doc = raw;
  let v = Number.isInteger(doc.schemaVersion) ? doc.schemaVersion : "xp" in doc ? 0 : NaN;
  if (!Number.isInteger(v)) throw Error("unknown schema");
  if (v > SCHEMA_VERSION) throw Error("newer schema");
  while (v < SCHEMA_VERSION) {
    doc = MIGRATIONS[v](doc);
    v = doc.schemaVersion;
  }
  for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];
  return doc;
}

const num = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const inventoryCount = n => { const c = Math.max(0, Math.floor(num(n))); return c > B.inventory.stackMax * SLOT_COUNT ? B.inventory.stackMax : c; };

// Repairs recoverable damage and rejects documents too broken to trust.
export function validate(doc) {
  const problems = [];
  if (!doc || typeof doc !== "object") return { ok: false, problems: ["shape"] };
  for (const k of ["beds", "animals"]) if (!Array.isArray(doc[k])) return { ok: false, problems: ["missing " + k] };
  if (!Number.isFinite(Number(doc.time)) || Number(doc.time) < 0) return { ok: false, problems: ["time"] };
  const base = createState({ seed: num(doc.seed, B.start.seed) });
  const s = { ...base, ...doc, events: [] };
  s.schemaVersion = SCHEMA_VERSION;
  s.time = num(doc.time);
  s.money = Math.floor(num(doc.money, -1));
  if (s.money < 0) {
    problems.push("money");
    s.money = 0;
  }
  s.inv = {};
  for (const [k, n] of Object.entries(doc.inv ?? {})) {
    const c = inventoryCount(n);
    if (ITEM_KEYS.has(k) && c > 0) s.inv[k] = c;
    else if (!ITEM_KEYS.has(k)) problems.push("item " + k);
  }
  s.beds = doc.beds
    .filter((b) => b && Number.isInteger(b.gx) && Number.isInteger(b.gy) && Array.isArray(b.plots))
    .map((b) => ({
      id: Math.floor(num(b.id)),
      gx: b.gx,
      gy: b.gy,
      plots: Array.from({ length: B.beds.plots }, (_, i) => {
        const p = b.plots[i] ?? {};
        const crop = CROPS.includes(p.crop) ? p.crop : null;
        return { crop, g: crop ? clamp(num(p.g), 0, 1) : 0, w: clamp(num(p.w), 0, B.water.seconds) };
      }),
    }));
  if (!s.beds.length) {
    problems.push("no beds");
    s.beds = base.beds;
  }
  s.buildings = (Array.isArray(doc.buildings) ? doc.buildings : [])
    .filter((b) => b && BUILDING_TYPES.includes(b.type) && Number.isInteger(b.gx) && Number.isInteger(b.gy))
    .map((b) => ({ id: Math.floor(num(b.id)), type: b.type, gx: b.gx, gy: b.gy }));
  s.coops = {};
  for (const key of ['base', ...s.buildings.filter(b => b.type === 'coop').map(b => String(b.id))]) {
    const c = doc.coops?.[key], open = typeof c?.doorOpen === 'boolean' ? c.doorOpen : !isNightAt(s.time);
    s.coops[key] = { doorOpen: open, doorProgress: clamp(num(c?.doorProgress, open ? 1 : 0), 0, 1) };
  }
  s.animals = doc.animals
    .filter((a) => a && SPECIES.includes(a.sp) && ["f", "m"].includes(a.sex) && ["alive", "dead", "bones"].includes(a.state))
    .map((a) => ({
      id: Math.floor(num(a.id)),
      sp: a.sp,
      sex: a.sex,
      var: clamp(Math.floor(num(a.var)), 0, 3),
      born: num(a.born),
      age: clamp(num(a.age, 1), 0, 1),
      hunger: Math.max(0, num(a.hunger)),
      thirst: Math.max(0, num(a.thirst)),
      prod: Math.max(0, num(a.prod)),
      breed: Math.max(0, num(a.breed)),
      state: a.state,
      deadFor: Math.max(0, num(a.deadFor)),
      x: num(a.x),
      y: num(a.y),
      health: clamp(num(a.health, B.predators.maxHealth), 0, B.predators.maxHealth),
      injured: num(a.health, B.predators.maxHealth) < B.predators.injuryThreshold,
      ...(Number.isFinite(a.heading) ? { heading: a.heading } : {}),
      ...(Number.isFinite(a.calledUntil) ? { calledUntil: a.calledUntil } : {}),
      ...(Number.isFinite(a.lastHurt) ? { lastHurt: a.lastHurt } : {}),
      ...(a.deathCause ? { deathCause: a.deathCause } : {}),
      ...(typeof a.shelterRequested==='boolean'?{shelterRequested:a.shelterRequested}:{}),
      ...(typeof a.indoors==='boolean'?{indoors:a.indoors}:{}),
      ...(typeof a.enteringCoop==='boolean'?{enteringCoop:a.enteringCoop}:{}),
      ...(typeof a.leavingCoop==='boolean'?{leavingCoop:a.leavingCoop}:{}),
      ...(typeof a.sleeping==='boolean'?{sleeping:a.sleeping}:{}),
      ...(typeof a.overflowRoost==='boolean'?{overflowRoost:a.overflowRoost}:{}),
      ...(Number.isInteger(a.roostSlot)?{roostSlot:Math.max(0,a.roostSlot)}:{}),
      ...(typeof a.penned === 'boolean' ? { penned: a.penned } : {}),
      ...(typeof a.wandering === 'boolean' ? { wandering: a.wandering } : {}),
    }));
  s.pickups = (Array.isArray(doc.pickups) ? doc.pickups : [])
    .filter((p) => p && ["egg", "milk"].includes(p.kind) && Number.isFinite(p.x) && Number.isFinite(p.y))
    .slice(0, B.pickups.max)
    .map((p) => ({ id: Math.floor(num(p.id)), kind: p.kind, x: p.x, y: p.y, t: num(p.t), from: p.from ?? null,
      ...(p.nest === true ? { nest: true, coopId: Number.isInteger(p.coopId) ? p.coopId : null } : {}),
    }));
  const fenceKeys = new Set();
  s.fences = (Array.isArray(doc.fences) ? doc.fences : []).filter(f => {
    if (!f || !Number.isInteger(f.gx) || !Number.isInteger(f.gy) || !['h', 'v'].includes(f.axis)) return false;
    const k = `${f.gx},${f.gy},${f.axis}`;
    if (fenceKeys.has(k)) return false;
    fenceKeys.add(k); return true;
  }).slice(0, B.fences.max).map(f => ({ id: Math.floor(num(f.id)), gx: f.gx, gy: f.gy, axis: f.axis, gate: !!f.gate, open: !!f.gate && !!f.open }));
  const ids = [...s.beds, ...s.buildings, ...s.animals, ...s.pickups, ...s.fences].map((o) => o.id);
  if (new Set(ids).size !== ids.length) problems.push("duplicate ids");
  s.nextId = Math.max(Math.floor(num(doc.nextId, 1)), ...ids.map((i) => i + 1), 1);
  s.rng = num(doc.rng, s.seed) >>> 0;
  s.rev = Math.max(0, Math.floor(num(doc.rev)));
  s.seq = Math.max(0, Math.floor(num(doc.seq)));
  s.savedAt = Math.max(0, num(doc.savedAt));
  s.softlock = { clock: Math.max(0, num(doc.softlock?.clock)) };
  s.celebrated = { cow: !!doc.celebrated?.cow, horse: !!doc.celebrated?.horse };
  s.stats = { ...base.stats, ...(doc.stats ?? {}) };
  const placing = doc.ui?.placing;
  s.ui = {
    ...doc.ui,
    tool: typeof doc.ui?.tool === "string" ? doc.ui.tool : "hand",
    placing: placing && KITS.includes(placing.kit) && Number.isInteger(placing.gx) && Number.isInteger(placing.gy) ? { ...placing } : null,
  };
  s.player = { mode: doc.player?.mode === 'fp' ? 'fp' : 'god', x: num(doc.player?.x, 650), y: num(doc.player?.y, 700), yaw: num(doc.player?.yaw), pitch: clamp(num(doc.player?.pitch), -1.4, 1.4) };
  s.predators = []; s.alerts = [];
  s.predatorSchedule = { lastNight: Math.max(-1, Math.floor(num(doc.predatorSchedule?.lastNight, dayIndex(s.time)))), encounters: Math.max(0, Math.floor(num(doc.predatorSchedule?.encounters))) };
  s.inventoryOverflow = (Array.isArray(doc.inventoryOverflow) ? doc.inventoryOverflow : []).filter(q => q && ITEM_KEYS.has(q.key) && Number.isInteger(q.n) && q.n > 0).map(q => ({ key: q.key, n: q.n }));
  initializeInventory(s, Array.isArray(doc.slots) ? doc.slots : null);
  // Accept aggregate edits made by the compatibility bridge while validating
  // saved layouts; new documents ordinarily have identical totals.
  s.inv = {};
  for (const [key, n] of Object.entries(doc.inv || {})) if (ITEM_KEYS.has(key) && Number(n) > 0) s.inv[key] = inventoryCount(n);
  syncInventory(s);
  return { ok: true, state: s, problems };
}

// Parse text from storage; returns { ok, state } or { ok: false, reason }.
export function loadText(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "empty" };
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  return loadObject(raw);
}

export function loadObject(raw) {
  let doc;
  try {
    doc = migrate(structuredClone(raw));
  } catch (e) {
    return { ok: false, reason: e.message === "newer schema" ? "newer" : "corrupt" };
  }
  const v = validate(doc);
  return v.ok ? { ok: true, state: v.state, problems: v.problems } : { ok: false, reason: "corrupt", problems: v.problems };
}
