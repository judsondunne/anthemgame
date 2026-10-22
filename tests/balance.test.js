import test, { after } from "node:test";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { runStrategies, runPredatorStrategies } from "../scripts/simulate.js";

const results = Object.fromEntries(runStrategies(150).map((r) => [r.name, r]));
const predatorResults = runPredatorStrategies(12);
if (process.env.FARM_BALANCE_REPORT) after(() => writeFileSync(process.env.FARM_BALANCE_REPORT, JSON.stringify({progression:Object.values(results).map(r=>({name:r.name,log:r.log,milestones:r.milestones,taps:r.taps,deaths:r.s.stats.deaths,final:{money:r.s.money,worth:r.netWorth()}})),predators:predatorResults},null,2)));
const worth = (name, min) => results[name].log.find((l) => l.min === min).worth;

test("balance: the faster progression reaches a protected full farm within ninety minutes", () => {
  const m = results.balanced.milestones;
  assert.ok(m.coop <= 15, "coop early");
  assert.ok(m.barn <= 40, "barn by 40 min");
  assert.ok(m.cow <= 45, "cows by 45 min");
  assert.ok(m.stable <= 75, "stable by 75 min");
  assert.ok(m.horse <= 85, "horses by 85 min");
  assert.ok(m.fullFarm >= 10 && m.fullFarm <= 90, `full farm in 10–90 min (got ${m.fullFarm})`);
  assert.equal(results.balanced.s.stats.deaths, 0);
});

test("balance: no degenerate single-resource strategy dominates", () => {
  for (const other of ["daisySpam", "bestCropOnly", "chickenFarm", "horseRush", "idle"]) assert.ok(worth("balanced", 150) > worth(other, 150) * 1.3, `balanced beats ${other} decisively`);
  assert.ok(worth("daisySpam", 150) < worth("bestCropOnly", 150), "cheap crop spam is the weakest farming plan");
  // Crop-only income plateaus at the bed cap instead of compounding.
  const rate = (name, a, b) => (worth(name, b) - worth(name, a)) / (b - a);
  assert.ok(rate("bestCropOnly", 120, 150) < rate("bestCropOnly", 60, 90) * 1.25, "crop income is linear, not exponential");
  assert.ok(rate("balanced", 120, 150) > 2 * rate("bestCropOnly", 120, 150), "horses/cows make the late game");
});

test("balance: the first ten minutes build up the farm", () => {
  const b = results.balanced;
  assert.ok(b.s.stats.spent > 0);
  assert.ok(worth("balanced", 15) > worth("balanced", 5), "assets grow early");
  assert.ok(results.idle.s.stats.deaths > 0, "ignoring animals has consequences");
});

test('balance: a modest closed pen prevents all damage and active flashlight play reduces exposure', () => {
  const outcomes = Object.fromEntries(predatorResults.map(r => [r.name, r]));
  assert.equal(outcomes.closedPen.damage, 0);
  assert.equal(outcomes.closedPen.lowestHealth, 100);
  assert.ok(outcomes.closedPen.fenceCost < 100, 'a modest pen is inexpensive');
  assert.ok(outcomes.noFences.damage > 0);
  assert.ok(outcomes.partialFence.damage > 0, 'a gap is not protective');
  assert.ok(outcomes.activeFlashlight.damage < outcomes.noFences.damage);
  assert.ok(outcomes.activeFlashlight.scares > 0);
  assert.equal(outcomes.closedPen.deaths,0,'a cared-for closed pen has no losses');
  assert.ok(outcomes.noFences.deaths>0,'reckless outdoor livestock can be lost');
  assert.ok(outcomes.noFences.survivors>0,'losses are recoverable rather than a total wipeout');
  assert.ok(outcomes.activeFlashlight.deaths<=outcomes.noFences.deaths,'active defense reduces losses');
});
