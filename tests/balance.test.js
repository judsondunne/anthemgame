import test from "node:test";
import assert from "node:assert/strict";
import { runStrategies } from "../scripts/simulate.js";

const results = Object.fromEntries(runStrategies(150).map((r) => [r.name, r]));
const worth = (name, min) => results[name].log.find((l) => l.min === min).worth;

test("balance: the intended progression reaches a full farm within two hours", () => {
  const m = results.balanced.milestones;
  assert.ok(m.coop <= 15, "coop early");
  assert.ok(m.barn <= 40, "barn by 40 min");
  assert.ok(m.cow <= 45, "cows by 45 min");
  assert.ok(m.stable <= 75, "stable by 75 min");
  assert.ok(m.horse <= 85, "horses by 85 min");
  assert.ok(m.fullFarm >= 60 && m.fullFarm <= 120, `full farm in 1-2 h (got ${m.fullFarm})`);
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
