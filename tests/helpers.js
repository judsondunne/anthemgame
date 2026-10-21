import * as S from "../src/sim/index.js";
export { S };
export const B = S.BALANCE;
export const DAY = S.DAY_SECONDS;

export function fresh(seed = 7) {
  const s = S.createState({ seed });
  S.drainEvents(s);
  return s;
}

// Keep every living animal fed and watered (direct state access for isolation).
export function pamper(s) {
  for (const a of s.animals) if (a.state === "alive") a.hunger = a.thirst = 0;
}

// Advance active play while pampering every `every` seconds.
export function run(s, seconds, { every = 30, care = true, offline = false } = {}) {
  let left = seconds;
  while (left > 0) {
    const h = Math.min(every, left);
    if (care) pamper(s);
    S.tick(s, h, { offline });
    left -= h;
  }
  if (care) pamper(s);
}

export function withBuilding(s, type) {
  s.inv["kit_" + type] = (s.inv["kit_" + type] ?? 0) + 1;
  for (const c of S.layout.zoneCells(type)) {
    const r = S.place(s, "kit_" + type, c.gx, c.gy);
    if (r.ok) return s.buildings.find((b) => b.id === r.id);
  }
  throw Error("no room for " + type);
}

export function addAnimal(s, sp, sex, age = 1) {
  return S.spawnAnimal(s, sp, sex, { age });
}

export const chickens = (s) => s.animals.filter((a) => a.sp === "chicken");
