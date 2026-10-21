import test from 'node:test';
import assert from 'node:assert/strict';
import { S, B, DAY, fresh } from './helpers.js';
const night = s => { s.time = S.clock.nextTimeAtHour(s.time, 22); s.predatorSchedule.lastNight = S.clock.dayIndex(s.time); s.player.mode = 'fp'; };
function herd(s) { const a = S.spawnAnimal(s, 'cow', 'f'); a.x = -640; a.y = 690; return a; }
function enclose(s) {
  for (let x = -20; x < -12; x++) for (const y of [26, 31]) s.fences.push({ id: s.nextId++, gx: x, gy: y, axis: 'h', gate: false, open: false });
  for (let y = 26; y < 31; y++) for (const x of [-20, -12]) s.fences.push({ id: s.nextId++, gx: x, gy: y, axis: 'v', gate: false, open: false });
}
test('predator schedule waits into night and an early farm stays safe', () => {
  const s = fresh(); S.tick(s, 400); assert.equal(s.predators.length, 0);
  const t = fresh(); herd(t); t.time = S.clock.nextTimeAtHour(t.time, 20);
  S.tick(t, B.predators.delayIntoNight - 1); assert.equal(t.predators.length, 0);
  S.tick(t, 1); assert.equal(t.predators.length, 1); assert.equal(t.predators[0].kind, 'wolf');
  S.tick(t, 1); assert.equal(t.predators.length, 1);
});
test('wolves target unprotected cows or horses, never chickens; pens clear alerts', () => {
  const s = fresh(), a = herd(s); night(s);
  const p = S.forcePredator(s, 'wolf', { x: a.x + 200, y: a.y }).predator;
  S.stepPredators(s, 1); assert.equal(p.target, a.id); assert.ok(s.alerts.some(q => q.animal === a.id));
  assert.ok(s.events.some(q => q.type === 'predatorAlert'));
  enclose(s); S.stepPredators(s, 1); assert.equal(p.target, null); assert.equal(s.alerts.length, 0);
  const health = a.health; S.stepPredators(s, 200); assert.equal(a.health, health);
});
test('closed pens block bears and wolves, open gates expose the herd', () => {
  const s = fresh(), a = herd(s); night(s); enclose(s); const f = s.fences[0]; f.gate = true;
  const p = S.forcePredator(s, 'bear', { x: a.x + 5, y: a.y }).predator;
  S.stepPredators(s, 1); assert.equal(a.health, 100); assert.equal(p.target, null);
  S.toggleGate(s, f.id); S.stepPredators(s, 1); assert.equal(p.target, a.id); assert.ok(a.health < 100);
});
test('flashlight requires first person at night and configured exposure; bears ignore it', () => {
  const s = fresh(); night(s); const wolf = S.forcePredator(s, 'wolf').predator, bear = S.forcePredator(s, 'bear').predator;
  assert.equal(S.illuminate(s, wolf.id, 20, 'god').reason, 'firstPerson'); assert.equal(wolf.exposure, 0);
  s.player.mode = 'god'; assert.equal(S.illuminate(s, wolf.id, 20, 'fp').reason, 'firstPerson'); s.player.mode = 'fp';
  assert.equal(S.illuminate(s, wolf.id, B.predators.scareSeconds - 0.1).ready, false);
  assert.equal(S.illuminate(s, wolf.id, 0.1).ready, true);
  assert.equal(S.illuminate(s, bear.id, 20).reason, 'immune'); assert.equal(S.scarePredator(s, bear.id).reason, 'immune');
  assert.ok(S.scarePredator(s, wolf.id).ok); assert.equal(wolf.state, 'flee');
  S.stepPredators(s, B.predators.retreatSeconds); assert.ok(!s.predators.includes(wolf)); assert.ok(s.predators.includes(bear));
  s.time = S.clock.nextTimeAtHour(s.time, 12); const dayWolf = S.forcePredator(s, 'wolf').predator;
  assert.equal(S.illuminate(s, dayWolf.id, 20).reason, 'daylight');
});
test('encounters draw one deterministic 50 percent branch and then the pack flees', () => {
  const outcomes = new Set();
  for (let seed = 1; seed <= 50; seed++) {
    const s = fresh(seed); night(s); const p = S.forcePredator(s, 'wolf').predator, other = S.forcePredator(s, 'wolf').predator;
    const before = structuredClone(s), first = S.beginEncounter(s, p.id), repeat = S.beginEncounter(s, other.id);
    assert.equal(first.suspense, S.beginEncounter(before, p.id).suspense);
    assert.equal(repeat.suspense, first.suspense); assert.ok(repeat.repeated); outcomes.add(first.suspense);
    S.scarePredator(s, p.id); assert.ok(s.predators.every(q => q.state === 'flee'));
  }
  assert.equal(outcomes.size, 2);
});
test('damage, healing, injury, predator death and dawn cleanup use the existing lifecycle', () => {
  const s = fresh(), a = herd(s); night(s); const p = S.forcePredator(s, 'wolf', { x: a.x + 5, y: a.y }).predator;
  a.health = B.predators.injuryThreshold; S.stepPredators(s, 1); assert.ok(a.injured);
  S.scarePredator(s, p.id); S.stepPredators(s, 10); assert.ok(a.health > B.predators.injuryThreshold); assert.equal(a.injured, false);
  S.forcePredator(s, 'bear', { x: a.x, y: a.y }); a.health = 0.1;
  S.stepPredators(s, 1); assert.equal(a.state, 'dead'); assert.equal(a.deathCause, 'predator');
  S.tick(s, B.neglect.bonesDays * DAY); assert.equal(a.state, 'bones'); assert.ok(S.clearBones(s, a.id).ok);
  s.time = S.clock.nextTimeAtHour(s.time, 6); S.stepPredators(s, 1); assert.equal(s.predators.length, 0); assert.equal(s.alerts.length, 0);
});
test('offline catch-up and reload remove danger without attacking or killing', () => {
  const s = fresh(), a = herd(s); night(s); a.health = 1; a.hunger = 1e6;
  S.forcePredator(s, 'wolf', { x: a.x, y: a.y }); const back = S.loadText(S.serialize(s)).state;
  assert.equal(back.predators.length, 0); assert.equal(back.alerts.length, 0); assert.equal(back.animals.find(q => q.id === a.id).health, 1);
  S.catchUp(s, 10000); assert.equal(a.health, 1); assert.equal(a.state, 'alive'); assert.equal(s.predators.length, 0);
  const empty = fresh(); herd(empty); empty.time = S.clock.nextTimeAtHour(0, 20); S.catchUp(empty, 200);
  assert.equal(empty.predators.length, 0); assert.ok(!empty.events.some(q => q.type === 'predatorSpawn'));
});
test('removing a nearby wall exposes the target without trapping or teleporting predators', () => {
  const s = fresh(), a = herd(s); night(s); enclose(s);
  const p = S.forcePredator(s, 'wolf', { x: -805, y: 690 }).predator;
  S.stepPredators(s, 1); assert.equal(p.state, 'prowl'); assert.equal(p.target, null);
  const wall = s.fences.find(f => f.gx === -20 && f.gy === 28 && f.axis === 'v');
  S.removeFence(s, wall.id);
  const x = p.x; S.stepPredators(s, 1);
  assert.equal(p.target, a.id); assert.ok(p.x > x); assert.ok(Math.abs(p.x - x) <= B.predators.wolfSpeed);
});
