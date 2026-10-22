import { BALANCE as B } from '../config/balance.js';
import { isNightAt, dayIndex, hourAt } from './clock.js';
import { BASE_COOP, frontOf, ZONES } from './layout.js';
import { hash32 } from './rng.js';
import { penAt } from './fences.js';
import { stepShelter } from './shelter.js';
import { separateAnimals, moveToward, navigateToward, recoverAnimal, groundBlocked } from './movement.js';
import { waterAtLogical, brookDrinkingPoint } from './water.js';

const waterTrips = new WeakMap();
export function stepLivestockWater(s, a, h, home, pen) {
  if (!['cow', 'horse'].includes(a.sp)) return false;
  const hour = hourAt(s.time), K = B.livestockWater, day = dayIndex(s.time);
  let trip = waterTrips.get(a);
  if (hour < K.startHour || hour >= K.returnHour) {
    if (trip?.phase === 'visit' || trip?.phase === 'drink') trip.phase = 'return';
  } else if (!trip || trip.day !== day) {
    const u = hash32(s.seed, a.id, day) / 4294967296;
    const point = brookDrinkingPoint(-6 + u * 11);
    const targetPen = penAt(s, point.x, point.y);
    const eligible = u < K.visitChance && (!pen || targetPen?.id === pen.id);
    trip = { day, target: point, phase: eligible ? 'visit' : 'done', drank: 0 };
    waterTrips.set(a, trip);
  }
  if (!trip || trip.phase === 'done') { a.drinking = false; return false; }
  const wet = waterAtLogical(a.x, a.y);
  a.inWater = !!wet;
  a.drinking = trip.phase === 'drink';
  if (trip.phase === 'visit') {
    // A closed pen remains an absolute boundary, even if its gate closed after
    // an animal decided to visit the brook.
    if (pen && penAt(s, trip.target.x, trip.target.y)?.id !== pen.id) { trip.phase = 'done'; return false; }
    a.wandering = true;
    if (Math.hypot(a.x - trip.target.x, (a.y - trip.target.y) * 1.65) < 22) trip.phase = 'drink';
    else navigateToward(s, a, trip.target, K.visitSpeed, h, { avoidAnimals: true });
    return true;
  }
  if (trip.phase === 'drink') {
    if (wet) a.thirst = Math.max(0, a.thirst - K.thirstRecovery * h);
    trip.drank += h;
    if (trip.drank >= K.durationSeconds) { trip.phase = 'return'; a.drinking = false; }
    return true;
  }
  if (trip.phase === 'return') {
    a.drinking = false;
    if (Math.hypot(a.x - home.x, (a.y - home.y) * 1.65) < B.wandering.returnRadius) { trip.phase = 'done'; a.wandering = false; return false; }
    navigateToward(s, a, home, K.visitSpeed, h, { avoidAnimals: true });
    return true;
  }
  return false;
}

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
    if(!a.indoors&&!a.leavingCoop)recoverAnimal(s,a);
    if(stepShelter(s,a,h,housing?.homes))continue;
    const home = animalHome(s, a, housing?.homes), pen = penAt(s, a.x, a.y);
    a.penned = !!pen;
    if (stepLivestockWater(s, a, h, home, pen)) continue;
    const period = Math.floor(s.time / (a.sp==='chicken'?W.chickenDecisionSeconds:W.decisionSeconds)), u = hash32(s.seed, a.id, period) / 4294967296;
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
      for(let i=0;i<16;i++){const heading=angle+i*Math.PI/8;target={x:home.x+Math.cos(heading)*radius,y:home.y+Math.sin(heading)*radius/1.65};if(!groundBlocked(s,target.x,target.y,a))break;}
    }
    moveToward(s, a, target, (a.sp==='chicken'?W.chickenSpeed:W.speed) * (a.injured ? B.predators.restSpeed : 1), h, { avoidAnimals: true });
  }
  separateAnimals(s);
}
