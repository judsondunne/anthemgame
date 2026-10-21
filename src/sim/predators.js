// Pure deterministic danger. Rendering owns the real-time flicker/jumpscare;
// the encounter draw happens once here and cannot repeat for the same pack.
import { BALANCE as B } from '../config/balance.js';
import { cyclePosition, dayIndex, isNightAt } from './clock.js';
import { nextRandom } from './rng.js';
import { isPenned, fenceBlocked } from './fences.js';
import { moveToward } from './movement.js';

const P = B.predators;
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.65);
const candidates = s => s.animals.filter(a => a.state === 'alive' && ['cow', 'horse'].includes(a.sp) && !isPenned(s, a));
export function forcePredator(s, kind = 'wolf', options = {}) {
  if (!['wolf', 'bear'].includes(kind)) return { ok: false, reason: 'unknown' };
  const angle = nextRandom(s) * Math.PI * 2;
  const p = {
    id: s.nextId++, kind,
    x: Number.isFinite(options.x) ? options.x : 650 + Math.cos(angle) * P.spawnRadius,
    y: Number.isFinite(options.y) ? options.y : 710 + Math.sin(angle) * P.spawnRadius / 1.65,
    state: 'approach', target: null, exposure: 0, born: s.time,
    pack: options.pack ?? `night-${dayIndex(s.time)}`, fleeFor: 0, encounter: null,
  };
  s.predators ??= []; s.predators.push(p);
  s.events.push({ type: 'predatorSpawn', id: p.id, kind, x: p.x, y: p.y });
  return { ok: true, id: p.id, predator: p };
}
export const spawnPredator = forcePredator;
export function beginEncounter(s, id) {
  const p = s.predators.find(q => q.id === id);
  if (!p || p.kind !== 'wolf' || p.state === 'flee') return { ok: false, reason: 'unknown' };
  if (p.encounter !== null) return { ok: true, suspense: p.encounter, repeated: true };
  const pack = s.predators.filter(q => q.kind === 'wolf' && q.pack === p.pack);
  const previous = pack.find(q => q.encounter !== null);
  const suspense = previous ? previous.encounter : nextRandom(s) < P.encounterChance;
  for (const q of pack) { q.encounter = suspense; q.state = 'encounter'; q.target = null; }
  s.predatorSchedule.encounters++;
  return { ok: true, suspense, repeated: !!previous };
}
export function scarePredator(s, id) {
  const p = s.predators.find(q => q.id === id);
  if (!p) return { ok: false, reason: 'unknown' };
  if (p.kind === 'bear') return { ok: false, reason: 'immune' };
  for (const q of s.predators) if (q.kind === 'wolf' && q.pack === p.pack) {
    q.state = 'flee'; q.target = null; q.fleeFor = 0;
  }
  s.alerts = s.alerts.filter(a => !s.predators.some(q => q.pack === p.pack && q.id === a.predator));
  s.events.push({ type: 'scared', id, kind: p.kind, x: p.x, y: p.y });
  return { ok: true };
}
export const scare = scarePredator;
export function illuminate(s, id, seconds, mode = 'fp') {
  const p = s.predators.find(q => q.id === id);
  if (!p) return { ok: false, reason: 'unknown' };
  if (mode !== 'fp' || s.player?.mode !== 'fp') return { ok: false, reason: 'firstPerson' };
  if (p.kind === 'bear') return { ok: false, reason: 'immune' };
  if (!isNightAt(s.time)) return { ok: false, reason: 'daylight' };
  if (!(seconds > 0) || !Number.isFinite(seconds)) return { ok: false, reason: 'duration' };
  if (p.state === 'flee' || p.state === 'encounter') return { ok: true, ready: p.exposure >= P.scareSeconds, exposure: p.exposure };
  p.exposure += seconds; p.litAt = s.time;
  return { ok: true, ready: p.exposure >= P.scareSeconds, exposure: p.exposure };
}
function targetFor(s, p) {
  return candidates(s).sort((a, b) => distance(p, a) - distance(p, b) || a.id - b.id)[0] || null;
}
export function stepPredators(s, h) {
  s.predators ??= []; s.alerts ??= [];
  s.predatorSchedule ??= { lastNight: -1, encounters: 0 };
  const night = isNightAt(s.time), day = dayIndex(s.time);
  if (!night) {
    if (s.predators.length) s.events.push({ type: 'predatorDawn' });
    s.predators = []; s.alerts = [];
  } else if (s.predatorSchedule.lastNight !== day && cyclePosition(s.time) >= B.time.daySeconds + P.delayIntoNight) {
    s.predatorSchedule.lastNight = day;
    const herd = s.animals.filter(a => a.state === 'alive' && a.sp !== 'chicken');
    if (herd.length) {
      const first = s.predatorSchedule.encounters === 0;
      const n = first ? 1 : Math.min(P.maxWolves, 1 + Math.floor(herd.length / 5));
      const kind = !first && herd.length >= P.bearAfterHerd && nextRandom(s) < P.bearChance ? 'bear' : 'wolf';
      const spawn = forcePredator(s, kind).predator;
      for (let i = 1; i < (kind === 'bear' ? 1 : n); i++) forcePredator(s, kind, { x: spawn.x + i * 30, y: spawn.y + i * 12, pack: spawn.pack });
      s.predatorSchedule.encounters++;
    }
  }
  const alerts = [];
  for (const p of s.predators) {
    if (p.state === 'flee') {
      p.fleeFor += h;
      let dx = p.x - 650, dy = p.y - 710;
      if (Math.abs(dx) + Math.abs(dy) < 1) dx = 1;
      moveToward(s, p, { x: p.x + dx, y: p.y + dy }, P.fleeSpeed, h);
      continue;
    }
    if (p.state === 'encounter') continue;
    if (p.litAt !== undefined && s.time - p.litAt > 1) p.exposure = Math.max(0, p.exposure - P.exposureDecay * h);
    const a = targetFor(s, p); p.target = a?.id ?? null;
    if (!a) {
      p.state = 'prowl';
      const protectedAnimal = s.animals.filter(q => q.state === 'alive' && q.sp !== 'chicken').sort((a, b) => distance(p, a) - distance(p, b))[0];
      p.prowlTarget = protectedAnimal?.id ?? null;
      if (protectedAnimal) moveToward(s, p, protectedAnimal, (p.kind === 'wolf' ? P.wolfSpeed : P.bearSpeed) * 0.55, h);
      continue;
    }
    const d = distance(p, a);
    if (d < P.alertRange) alerts.push({ id: p.id, predator: p.id, kind: p.kind, animal: a.id, sp: a.sp, x: a.x, y: a.y, attacking: d <= P.attackRange });
    if (d > P.attackRange || fenceBlocked(s, p.x, p.y, a.x, a.y)) {
      p.state = 'approach'; moveToward(s, p, a, p.kind === 'wolf' ? P.wolfSpeed : P.bearSpeed, h);
    } else {
      p.state = 'attack';
      a.health = Math.max(0, (a.health ?? P.maxHealth) - (p.kind === 'wolf' ? P.wolfDamage : P.bearDamage) * h);
      a.lastHurt = s.time; a.injured = a.health < P.injuryThreshold;
      if (a.health <= 0) {
        a.state = 'dead'; a.deadFor = 0; a.breed = 0; a.deathCause = 'predator'; s.stats.deaths++;
        s.events.push({ type: 'death', id: a.id, sp: a.sp, cause: 'predator' });
      }
    }
  }
  for (const a of s.animals) if (a.state === 'alive') {
    const content = a.hunger < B.species[a.sp].hungryAfter && a.thirst < B.species[a.sp].thirstyAfter;
    if (content && !alerts.some(q => q.animal === a.id && q.attacking)) a.health = Math.min(P.maxHealth, (a.health ?? P.maxHealth) + P.healPerSecond * h);
    a.injured = a.health < P.injuryThreshold;
  }
  for (const a of alerts) if (!s.alerts.some(q => q.predator === a.predator && q.animal === a.animal)) s.events.push({ type: 'predatorAlert', ...a });
  s.alerts = alerts;
  s.predators = s.predators.filter(p => p.state !== 'flee' || p.fleeFor < P.retreatSeconds);
}
