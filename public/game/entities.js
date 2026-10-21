"use strict";
const W = 1400,
  H = 960;
const world = {
  started: false,
  tool: "pet",
  time: 0.22,
  elapsed: 0,
  needs: [],
  particles: [],
  food: [],
  fishFood: [],
  watering: [],
  ripples: [],
  koiTarget: { x: 1000, y: 620, koi: true },
  chickens: [],
  plants: [],
  tufts: [],
  scenery: [],
  koi: [],
  nextNeed: 9,
  nextNap: 35 + rand() * 35,
  forcedTime: null,
  timeTween: null,
  wasNight: false,
  fishSpot: null,
  coop: {
    x: 320,
    y: 818,
    scale: 0.9,
    door: { x: 317, y: 821 },
    approach: { x: 292, y: 858 },
  },
};
function addScenery(type, x, y, scale = 1) {
  world.scenery.push({ type, x, y, scale });
}
addScenery("house", 630, 460, 0.96);
addScenery("fence", 354, 454, 0.95);
addScenery("fence", 979, 437, 0.85);
for (const p of [
  [150, 488, 1.04],
  [1182, 453, 1.03],
  [1260, 799, 1.04],
  [121, 818, 0.78],
  [1020, 357, 0.59],
])
  addScenery("tree", ...p);
for (const p of [
  [447, 461, 0.8],
  [796, 443, 0.9],
  [350, 427, 0.8],
  [899, 402, 0.8],
  [206, 874, 0.85],
  [1128, 805, 0.95],
])
  addScenery("bush", ...p);
addScenery("coop", world.coop.x, world.coop.y, world.coop.scale);
// Bed flowers and the fixed flock now come from the farm simulation. Consume the
// same seeded draws they used so every decorative placement stays identical.
for (let i = 0; i < 28 + 7 * 5; i++) rand();
let chickenSerial = 0;
// One visual hen agent for a simulated chicken; behaviour code below drives it.
function makeChickenAgent(x, y, breed) {
  return {
    x,
    y,
    targetX: x,
    targetY: y,
    breed,
    phase: Math.random() * 7,
    pause: 1 + Math.random() * 3,
    dir: 1,
    pet: 0,
    path: [],
    mode: "wander",
    sleeping: false,
    sleepSlot: chickenSerial++,
    feedUntil: 0,
    wakeDelay: 0,
    thirst: 25 + Math.random() * 80,
    home: world.coop,
  };
}
for (let i = 0; i < 5; i++) {
  let phase = i * 1.25;
  world.koi.push({
    phase,
    r: 45 + i * 10,
    color: ["#e3ab6c", "#efdfbd", "#bd8266", "#ceba7a", "#e7d6b0"][i],
    x: 999 + Math.cos(phase) * (45 + i * 10),
    y: 626 + Math.sin(phase) * (25 + i * 5),
    vx: 0,
    vy: 0,
    angle: phase,
  });
}
for (let i = 0; i < 18; i++) {
  let x = 220 + rand() * 950,
    y = 850 + rand() * 55;
  if (x < 425 && y < 870) continue;
  addScenery("flowers", x, y, 0.6 + rand() * 0.35);
}
function isNight() {
  if (world.externalNight !== undefined) return world.externalNight;
  return world.time > 0.69 || world.time < 0.075;
}
// Game time belongs to the farm simulation, so day/night can no longer be forced.
function toggleDayNight() {}
function needTarget() {
  let roll = rand(),
    group =
      roll < 0.58
        ? world.chickens.filter((b) => !b.sleeping && !b.dead && !b.juvenile && b.mode !== "napping")
        : [world.koiTarget];
  const eligible = (t) =>
    !world.needs.some(
      (n) =>
        n.target === t || Math.hypot(n.target.x - t.x, n.target.y - t.y) < 70,
    );
  let available = group.filter(eligible);
  if (!available.length) available = [world.koiTarget].filter(eligible);
  return available[Math.floor(rand() * available.length)];
}
function makeNeed() {
  if (world.needs.length >= 3 || isNight()) return;
  let target = needTarget();
  if (target)
    world.needs.push({
      target,
      // Ambient care only: affection for hens, pellets for the koi. Food and
      // water requests come from the simulation's real need clocks.
      kind: target.koi ? "food" : "heart",
      born: world.elapsed,
    });
}
function burst(x, y, kind = "heart") {
  for (let i = 0; i < 12; i++)
    world.particles.push({
      x,
      y,
      vx: (rand() - 0.5) * 45,
      vy: -20 - rand() * 45,
      life: 1.4 + rand(),
      kind,
      size: 3 + rand() * 4,
    });
  if (kind === "heart" || kind === "water" || kind === "grain") AudioGarden.chime();
}
function scatterGrain(x, y) {
  if (isNight() || !walkable(x, y)) return false;
  world.needs = world.needs.filter(
    (n) => !(n.kind === "food" && n.target.breed !== undefined),
  );
  if ((world.lastGrainXP ?? -Infinity) + 20 < world.elapsed) {
    Farm.award(x, y, 8, "Chicken feed");
    world.lastGrainXP = world.elapsed;
  }
  world.food = world.food.slice(-120);
  for (let i = 0; i < 22; i++) {
    const p = nearestWalkable(
      x + (rand() - 0.5) * 100,
      y + (rand() - 0.5) * 54,
    );
    world.food.push({ ...p, life: 32 });
  }
  world.chickens.forEach((b, i) => {
    if (b.sleeping || b.dead) return;
    let p = nearestWalkable(
      x + Math.cos((i * Math.PI * 2) / 7) * 52,
      y + Math.sin((i * Math.PI * 2) / 7) * 34,
    );
    b.feedCenter = { x, y };
    b.feedUntil = world.elapsed + 32;
    sendChicken(b, p.x, p.y, "feeding");
  });
  burst(x, y - 6, "grain");
  return true;
}
function waterPlant(p) {
  if ((p.lastXP ?? -Infinity) + 12 < world.elapsed) {
    Farm.award(p.x, p.y - 30, 3, "Watered");
    p.lastXP = world.elapsed;
  }

  world.watering = world.watering.filter((w) => w.target !== p);
  world.watering.push({ target: p, x: p.x, y: p.y, life: 2.2 });
  p.targetGrowth = Math.min(1.85, p.targetGrowth + 0.18);
  burst(p.x, p.y - 42 * p.growth, "water");
}
function feedFish(x, y) {
  if (!inPond(x, y, -12)) return false;
  world.needs = world.needs.filter((n) => !n.target.koi);
  world.fishSpot = { x, y, until: world.elapsed + 16 };
  world.ripples.push({ x, y, life: 3 });
  world.fishFood = [];
  for (let i = 0; i < 16; i++)
    world.fishFood.push({
      x: x + (rand() - 0.5) * 60,
      y: y + (rand() - 0.5) * 24,
      life: 16,
    });
  burst(x, y, "grain");
  return true;
}
function moveChicken(b, dt, speed) {
  let p = b.path[0];
  if (!p) return false;
  let dx = p.x - b.x,
    dy = p.y - b.y,
    dist = Math.hypot(dx, dy);
  if (dist < speed * dt + 2) {
    b.x = p.x;
    b.y = p.y;
    b.path.shift();
  } else {
    b.x += (dx / dist) * speed * dt;
    b.y += (dy / dist) * speed * dt;
    if (Math.abs(dx) > 0.2) b.dir = dx > 0 ? 1 : -1;
  }
  return true;
}
function bedtime(b) {
  b.feedUntil = 0;
  const home = b.home ?? world.coop;
  sendChicken(b, home.approach.x, home.approach.y, "returning");
  b.homeStage = "approach";
}
function update(dt) {
  if (!world.started) return;
  world.elapsed += dt;
  if (world.timeTween) {
    let tw = world.timeTween;
    tw.elapsed += dt;
    let u = Math.min(1, tw.elapsed / tw.duration),
      v = u * u * (3 - 2 * u);
    world.time = tw.from + (tw.to - tw.from) * v;
    if (u === 1) world.timeTween = null;
  } else if (world.externalTime !== undefined) world.time = world.externalTime;
  else world.time = world.forcedTime ?? (0.22 + world.elapsed / 440) % 1;
  const night = isNight();
  if (night !== world.wasNight) {
    world.wasNight = night;
    document.body.dataset.night = String(night);
    document
      .querySelector("#daynight")
      .setAttribute("aria-pressed", String(night));
    document
      .querySelector("#daynight")
      .setAttribute(
        "aria-label",
        night ? "Bring back the morning" : "Settle the garden for the night",
      );
    world.needs = [];
    world.food = [];
    world.chickens.forEach((b, i) => {
      if (b.dead) return;
      if (night) bedtime(b);
      else {
        const home = b.home ?? world.coop;
        b.sleeping = false;
        b.mode = "waking";
        b.wakeDelay = i * 0.42;
        b.x = home.door.x;
        b.y = home.door.y;
        b.path = [];
        b.pause = 0;
      }
    });
  }
  if (!night && !world.chickens.some((b) => b.mode === "napping")) {
    world.nextNap -= dt;
    if (world.nextNap <= 0) {
      const candidates = world.chickens.filter(
        (b) =>
          b.mode === "wander" &&
          !b.path.length &&
          !b.pet &&
          !world.needs.some((n) => n.target === b),
      );
      if (candidates.length) {
        const b = candidates[Math.floor(rand() * candidates.length)];
        b.mode = "napping";
        b.napUntil = world.elapsed + 12 + rand() * 10;
        b.path = [];
        world.nextNap = 55 + rand() * 65;
      } else world.nextNap = 5;
    }
  }
  world.nextNeed -= dt;
  if (world.nextNeed < 0) {
    makeNeed();
    world.nextNeed = 14 + rand() * 12;
  }
  for (const p of world.plants)
    p.growth += (p.targetGrowth - p.growth) * (1 - Math.exp(-dt * 2.6));
  for (const [i, b] of world.chickens.entries()) {
    b.pet = Math.max(0, b.pet - dt);
    b.pause -= dt;
    if (b.sleeping || b.dead) continue;
    if (night) {
      if (b.mode !== "returning") bedtime(b);
      if (!moveChicken(b, dt, 80)) {
        if (b.homeStage === "approach") {
          b.path = [{ ...(b.home ?? world.coop).door }];
          b.homeStage = "enter";
        } else {
          b.sleeping = true;
          b.path = [];
          b.mode = "sleeping";
        }
      }
      continue;
    }
    b.thirst = (b.thirst ?? 60) - dt;
    // Ambient pond sips only for contented hens; a thirsty hen waits for the can.
    if (b.mode === "wander" && b.thirst <= 0 && !b.simThirsty) {
      const spots = [
        { x: 930, y: 715 },
        { x: 980, y: 715 },
        { x: 1040, y: 715 },
      ];
      const spot = spots[i % spots.length];
      sendChicken(b, spot.x, spot.y, "drinking");
      b.drinkUntil = 0;
    }
    if (b.mode === "drinking") {
      if (b.path.length) {
        moveChicken(b, dt, 24);
        continue;
      }
      if (!b.drinkUntil) b.drinkUntil = world.elapsed + 4 + rand() * 2;
      b.dir = b.x < 999 ? 1 : -1;
      if (world.elapsed < b.drinkUntil) {
        if ((b.lastSip ?? 0) + 1.3 < world.elapsed) {
          world.ripples.push({ x: b.x + b.dir * 25, y: b.y - 29, life: 1.5 });
          b.lastSip = world.elapsed;
        }
        continue;
      }
      b.mode = "wander";
      b.thirst = 65 + rand() * 110;
      b.pause = 2;
    }
    if (b.mode === "napping") {
      if (world.elapsed < b.napUntil && !b.pet) continue;
      b.mode = "wander";
      b.pause = 1 + rand() * 2;
    }
    if (b.mode === "waking") {
      b.wakeDelay -= dt;
      if (b.wakeDelay > 0) continue;
      if (!b.path.length) {
        b.path = [
          { x: (b.home ?? world.coop).approach.x + (i % 6) * 4, y: (b.home ?? world.coop).approach.y + 5 },
        ];
        b.mode = "exiting";
      }
    }
    if (b.mode === "exiting") {
      if (!moveChicken(b, dt, 35)) {
        b.mode = "wander";
        b.pause = 0.2;
      }
      continue;
    }
    if (b.path.length) {
      moveChicken(b, dt, b.mode === "feeding" ? 53 : 19);
      continue;
    }
    if (b.mode === "feeding" && b.feedUntil > world.elapsed) {
      b.pause = 1;
      b.dir = b.feedCenter.x > b.x ? 1 : -1;
      continue;
    }
    if (b.pause < 0) {
      let p = nearestWalkable(280 + rand() * 840, 510 + rand() * 345);
      sendChicken(b, p.x, p.y);
      b.pause = 2 + rand() * 5;
    }
    // Soft separation prevents a feeding group from occupying a single point.
    for (const other of world.chickens) {
      if (other === b || other.sleeping || other.dead) continue;
      let dx = b.x - other.x,
        dy = b.y - other.y,
        d = Math.hypot(dx, dy);
      if (d > 0 && d < 23) {
        let x = b.x + (dx / d) * dt * 7,
          y = b.y + (dy / d) * dt * 7;
        if (walkable(x, y)) {
          b.x = x;
          b.y = y;
        }
      }
    }
  }
  for (const k of world.koi) {
    let a = world.elapsed * 0.12 + k.phase,
      spot =
        world.fishSpot && world.fishSpot.until > world.elapsed
          ? world.fishSpot
          : null;
    let tx = spot
        ? spot.x + Math.cos(k.phase + world.elapsed * 0.12) * 45
        : 999 + Math.cos(a) * k.r * 1.25,
      ty = spot
        ? spot.y + Math.sin(k.phase + world.elapsed * 0.12) * 24
        : 626 + Math.sin(a * 0.86 + k.phase) * k.r * 0.48;
    const edge = Math.hypot((tx - 999) / 127, (ty - 626) / 55);
    if (edge > 1) {
      tx = 999 + (tx - 999) / edge;
      ty = 626 + (ty - 626) / edge;
    }
    let dx = tx - k.x,
      dy = ty - k.y,
      d = Math.hypot(dx, dy),
      speed = Math.min(spot ? 36 : 17, d * 1.8);
    let ease = 1 - Math.exp(-dt * 2);
    k.vx += ((dx / (d || 1)) * speed - k.vx) * ease;
    k.vy += ((dy / (d || 1)) * speed - k.vy) * ease;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    if (Math.hypot(k.vx, k.vy) > 1) {
      let target = Math.atan2(k.vy, k.vx),
        delta = Math.atan2(
          Math.sin(target - k.angle),
          Math.cos(target - k.angle),
        );
      k.angle += delta * (1 - Math.exp(-dt * 4));
    }
  }
  for (const p of world.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 10 * dt;
    p.life -= dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  world.food.forEach((f) => {
    f.life -= dt;
    for (const b of world.chickens)
      if (!b.path.length && Math.hypot(f.x - b.x, f.y - b.y) < 16)
        f.life -= dt * 0.7;
  });
  world.food = world.food.filter((f) => f.life > 0);
  world.fishFood.forEach((f) => (f.life -= dt));
  world.fishFood = world.fishFood.filter((f) => f.life > 0);
  world.watering.forEach((w) => (w.life -= dt));
  world.watering = world.watering.filter((w) => w.life > 0);
  world.ripples.forEach((r) => (r.life -= dt));
  world.ripples = world.ripples.filter((r) => r.life > 0);
}
