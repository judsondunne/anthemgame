import { BALANCE as B } from '../config/balance.js';
import { isNightAt, dayIndex } from './clock.js';
import { BASE_COOP, frontOf, ZONES } from './layout.js';
import { hash32 } from './rng.js';
import { penAt } from './fences.js';
import { stepShelter } from './shelter.js';
import { separateAnimals, moveToward } from './movement.js';

export function animalHome(s, a, homes) {
  const b = homes?.get(a.id);
  if (b) return frontOf(b).approach;
  if (a.sp === 'chicken') return BASE_COOP.approach;
  const z = ZONES[a.sp === 'cow' ? 'west' : 'east'];
  return { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 };
}
export function callAnimal(s, id) {
  const a = s.animals.find(q => q.id === id && q.state === 'alive');
  if (!a) return { ok: false, reason: 'unknown' };
  a.calledUntil = s.time + B.wandering.decisionSeconds * 3;
  s.events.push({ type: 'called', id });
  return { ok: true };
}
export function stepWandering(s, h, housing) {
  const night = isNightAt(s.time), W = B.wandering;
  for (const a of s.animals) {
    if (a.state !== 'alive') continue;
    if(stepShelter(s,a,h,housing?.homes))continue;
    const home = animalHome(s, a, housing?.homes), pen = penAt(s, a.x, a.y);
    a.penned = !!pen;
    const period = Math.floor(s.time / W.decisionSeconds), u = hash32(s.seed, a.id, period) / 4294967296;
    const angle = u * Math.PI * 2;
    const out = a.sp !== 'chicken' && !pen && hash32(s.seed, a.id, dayIndex(s.time)) / 4294967296 < W.wanderChance;
    a.wandering = out && !night;
    const threat = a.injured && !pen && (s.predators || []).find(p => p.target === a.id && ['attack', 'approach'].includes(p.state) && Math.hypot(p.x - a.x, (p.y - a.y) * 1.65) < B.predators.alertRange / 2);
    if (threat) {
      const dx = a.x - threat.x || 1, dy = a.y - threat.y;
      moveToward(s, a, { x: a.x + dx * 3, y: a.y + dy * 3 }, W.speed * B.predators.restSpeed, h, { avoidAnimals: true });
      continue;
    }
    let target;
    if (night || a.calledUntil > s.time) {
      target = home;
      // If its home is outside the pen, settle inside rather than crossing walls.
      if (pen && penAt(s, home.x, home.y)?.id !== pen.id) {
        const c = pen.cells[hash32(s.seed, a.id, period) % pen.cells.length];
        target = { x: (c.gx + 0.5) * 40, y: (c.gy + 0.5) * (40 / 1.65) };
      }
      if (Math.hypot(a.x - target.x, (a.y - target.y) * 1.65) <= W.returnRadius) continue;
    } else {
      const radius = a.sp === 'chicken' ? W.chickenRadius : out ? W.wanderRadius : W.herdRadius;
      target = { x: home.x + Math.cos(angle) * radius, y: home.y + Math.sin(angle) * radius / 1.65 };
    }
    moveToward(s, a, target, W.speed * (a.injured ? B.predators.restSpeed : 1), h, { avoidAnimals: true });
  }
  separateAnimals(s);
}
