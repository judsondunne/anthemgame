// Coop occupancy and door animation are simulation state; renderers only read it.
import { BALANCE as B } from '../config/balance.js';
import { housing } from './sim.js';
import { BASE_COOP, frontOf, footprintOf, cellRect } from './layout.js';
import { navigateToward } from './movement.js';
import { isNightAt, hourAt } from './clock.js';

const keyOf = id => id == null ? 'base' : String(id);
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.65);
const occupancyCache = new WeakMap();

function slotsFor(s, homes) {
  let slots = occupancyCache.get(homes);
  if (slots) return slots;
  slots = new Map(); const counts = new Map();
  for (const a of s.animals.filter(a => a.sp === 'chicken' && a.state === 'alive').sort((a,b)=>a.id-b.id)) {
    const key = homes.get(a.id)?.id ?? null, slot = counts.get(key) ?? 0;
    slots.set(a.id, slot); counts.set(key, slot + 1);
  }
  occupancyCache.set(homes, slots); return slots;
}

export function coopState(s, id = null) {
  s.coops ??= {};
  return s.coops[keyOf(id)] ??= { doorOpen: !isNightAt(s.time), doorProgress: isNightAt(s.time) ? 0 : 1 };
}

export function coopFor(s, a, homes = housing(s).homes) {
  const b = homes.get(a.id), placed = b?.type === 'coop';
  const f = placed ? frontOf(b) : BASE_COOP;
  const id = placed ? b.id : null;
  const slot = slotsFor(s, homes).get(a.id) ?? -1;
  const capacity = placed ? B.buildings.coop.capacity.chicken : B.species.chicken.baseCapacity;
  return {
    id, x: f.x, y: f.y,
    door: { x: f.x, y: f.y + (placed ? 8 : 12) },
    rect: placed ? cellRect(b.gx, b.gy, ...footprintOf('coop')) : { x0: 220, x1: 458, y0: 728, y1: 866 },
    capacity, slot, overflow: slot < 0 || slot >= capacity,
  };
}

export function chickenSheltered(s, a) {
  return a.sp === 'chicken' && !!a.indoors && !coopState(s, coopFor(s, a).id).doorOpen;
}

export function coopRoost(c) {
  return { x: c.x + ((c.slot % B.coop.roostColumns) - 1) * B.coop.roostSpacing, y: c.y - B.coop.roostBack - Math.floor(c.slot / B.coop.roostColumns) * B.coop.rowSpacing };
}

export function callChickensIn(s) {
  const hour = hourAt(s.time);
  if (hour < B.coop.callHour && hour >= B.time.dawnHour) return { ok: false, reason: 'daylight' };
  let n = 0;
  for (const a of s.animals) if (a.sp === 'chicken' && a.state === 'alive') { a.shelterRequested = true; n++; }
  s.events.push({ type: 'coopCall', count: n });
  return { ok: true, count: n };
}

export function stepCoops(s, h, homes = housing(s).homes) {
  const night = isNightAt(s.time), hour = hourAt(s.time);
  const evening = night || hour >= B.coop.callHour;
  const ids = [null, ...s.buildings.filter(b => b.type === 'coop').map(b => b.id)];
  for (const a of s.animals) if (a.sp === 'chicken' && a.state === 'alive' && evening) a.shelterRequested = true;
  for (const id of ids) {
    const door = coopState(s, id);
    // Late birds may still use the door. Close behind the last arrival instead
    // of trapping a hen outside, and reopen at dawn before anyone exits.
    const arriving = s.animals.some(a => {
      if (a.sp !== 'chicken' || a.state !== 'alive' || a.indoors) return false;
      const c = coopFor(s, a, homes);
      return c.id === id && !c.overflow && (a.enteringCoop || distance(a, c.door) < B.coop.lateEntryRadius);
    });
    const open = !night || arriving;
    if (door.doorOpen !== open) s.events.push({ type: 'coopDoor', coopId: id, open });
    door.doorOpen = open;
    const delta = h / B.coop.doorAnimationSeconds;
    door.doorProgress = Math.max(0, Math.min(1, door.doorProgress + (open ? delta : -delta)));
  }
}

export function coopEntryAllowed(s, a, x, y) {
  if (a.sp !== 'chicken' || (!a.shelterRequested && !a.indoors && !a.leavingCoop)) return null;
  const c = coopFor(s, a);
  if (c.overflow) return null;
  if (!a.indoors && !a.leavingCoop && !coopState(s, c.id).doorOpen) return null;
  if (!a.enteringCoop && !a.indoors && !a.leavingCoop && (Math.abs(x - c.door.x) > B.coop.doorHalfWidth || y < c.door.y - B.coop.doorRadius)) return null;
  if (x < c.rect.x0 - B.coop.arriveRadius || x > c.rect.x1 + B.coop.arriveRadius || y < c.rect.y0 - B.coop.arriveRadius || y > c.rect.y1 + B.coop.arriveRadius) return null;
  return c;
}

export function stepShelter(s, a, h, homes) {
  if (a.sp !== 'chicken') return false;
  const c = coopFor(s, a, homes), hour = hourAt(s.time);
  const daytime = !isNightAt(s.time) && hour < B.coop.callHour;
  if (daytime) {
    a.enteringCoop = false; a.sleeping = false; a.overflowRoost = false;
    if (a.indoors) { a.indoors = false; a.leavingCoop = true; }
    a.shelterRequested = false;
    if (a.leavingCoop) {
      const exit = { x: c.door.x, y: Math.max(c.rect.y1, c.door.y) + B.coop.exitDistance };
      navigateToward(s, a, exit, B.coop.runSpeed, h, { avoidAnimals: true });
      if (distance(a, exit) < B.coop.arriveRadius) a.leavingCoop = false;
      return true;
    }
    return false;
  }
  if (!a.shelterRequested && !a.indoors) return false;
  a.roostSlot = c.slot;
  a.overflowRoost = c.overflow;
  if (c.overflow) {
    a.indoors = false; a.enteringCoop = false;
    const overflow = { x: c.door.x + ((c.slot - c.capacity) % B.coop.roostColumns - 1) * B.coop.roostSpacing, y: c.rect.y1 + B.coop.overflowDistance };
    navigateToward(s, a, overflow, B.coop.runSpeed, h, { avoidAnimals: true });
    a.sleeping = distance(a, overflow) < B.coop.arriveRadius;
    return true;
  }
  const roost = coopRoost(c);
  if (a.indoors) { a.x = roost.x; a.y = roost.y; a.sleeping = true; return true; }
  if (!coopState(s, c.id).doorOpen && a.enteringCoop) return true;
  if (!a.enteringCoop && distance(a, c.door) < B.coop.doorRadius) a.enteringCoop = true;
  const target = a.enteringCoop ? roost : Math.abs(a.x - c.door.x) > B.coop.doorHalfWidth ? { x: c.door.x, y: c.rect.y1 + B.coop.doorRadius } : c.door;
  navigateToward(s, a, target, B.coop.runSpeed, h, { avoidAnimals: !a.enteringCoop });
  if (a.enteringCoop && distance(a, roost) < B.coop.arriveRadius) {
    a.indoors = true; a.sleeping = true; a.enteringCoop = false;
    a.x = roost.x; a.y = roost.y;
  }
  return true;
}
