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
for (let i = 0; i < 28; i++) {
  const p = project3(
    -72 + (i % 7) * 24,
    25 + Math.floor((i % 14) / 7) * 65,
    12,
  );
  world.plants.push({
    x: (i > 13 ? 710 : 355) + p.x,
    y: 637 + p.y,
    kind: i % 4,
    phase: rand() * 7,
    growth: 1,
    targetGrowth: 1,
  });
}
for (let i = 0; i < 7; i++)
  world.chickens.push({
    x: 450 + rand() * 345,
    y: 700 + rand() * 125,
    targetX: 500,
    targetY: 750,
    breed: i % 4,
    phase: rand() * 7,
    pause: 2 + rand() * 4,
    dir: 1,
    pet: 0,
    path: [],
    mode: "wander",
    sleeping: false,
    sleepSlot: i,
    feedUntil: 0,
    wakeDelay: 0,
    thirst: 25 + rand() * 80,
  });
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
for (let i = 0; i < 1500; i++) {
  let x = rand() * W,
    y = 425 + rand() * 535;
  if (
    (x > 500 && x < 790 && y < 500) ||
    insideBed(x, y, 16) ||
    inPond(x, y, 25) ||
    (x > 215 && x < 425 && y > 745 && y < 840) ||
    Math.abs(x - (650 + (y - 450) * -0.23)) < 44
  )
    continue;
  world.tufts.push({ x, y, s: 0.35 + rand() * 0.65, p: rand() * 7 });
}
for (let i = 0; i < 18; i++) {
  let x = 220 + rand() * 950,
    y = 850 + rand() * 55;
  if (x < 425 && y < 870) continue;
  addScenery("flowers", x, y, 0.6 + rand() * 0.35);
}
function isNight() {
  return world.time > 0.69 || world.time < 0.075;
}
function toggleDayNight() {
  const current = world.timeTween?.to ?? (isNight() ? 0.86 : 0.22);
  const to = current === 0.86 ? 0.22 : 0.86;
  world.forcedTime = to;
  world.timeTween = { from: world.time, to, elapsed: 0, duration: 2.6 };
  document
    .querySelector("#daynight")
    .setAttribute("aria-pressed", String(to === 0.86));
  document
    .querySelector("#daynight")
    .setAttribute(
      "aria-label",
      to === 0.86
        ? "Bring back the morning"
        : "Settle the garden for the night",
    );
  document.body.dataset.night = String(to === 0.86);
}
function needTarget() {
  let roll = rand(),
    group =
      roll < 0.58
        ? world.chickens.filter((b) => !b.sleeping && b.mode !== "napping")
        : roll < 0.86
          ? world.plants
          : [world.koiTarget];
  const eligible = (t) =>
    !world.needs.some(
      (n) =>
        n.target === t || Math.hypot(n.target.x - t.x, n.target.y - t.y) < 70,
    );
  let available = group.filter(eligible);
  if (!available.length)
    available = [...world.plants, world.koiTarget].filter(eligible);
  return available[Math.floor(rand() * available.length)];
}
function makeNeed() {
  if (world.needs.length >= 3 || isNight()) return;
  let target = needTarget();
  if (target)
    world.needs.push({
      target,
      kind: target.koi
        ? "food"
        : target.breed !== undefined
          ? ["heart", "food", "water"][Math.floor(rand() * 3)]
          : "water",
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
  AudioGarden.chime();
}
function scatterGrain(x, y) {
  if (isNight() || !walkable(x, y)) return false;
  world.needs = world.needs.filter(
    (n) => !(n.kind === "food" && n.target.breed !== undefined),
  );
  if ((world.lastGrainXP ?? -Infinity) + 20 < world.elapsed) {
    Farm.award(x,y,8,"Chicken feed");world.lastGrainXP=world.elapsed;
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
    if (b.sleeping) return;
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
  if ((p.lastXP ?? -Infinity)+12<world.elapsed){Farm.award(p.x,p.y-30,3,"Watered");p.lastXP=world.elapsed;}

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
  sendChicken(b, world.coop.approach.x, world.coop.approach.y, "returning");
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
  } else world.time = world.forcedTime ?? (0.22 + world.elapsed / 440) % 1;
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
      if (night) bedtime(b);
      else {
        b.sleeping = false;
        b.mode = "waking";
        b.wakeDelay = i * 0.42;
        b.x = world.coop.door.x;
        b.y = world.coop.door.y;
        b.path = [];
        b.pause = 0;
      }
    });
  }
  if (!night && !world.chickens.some(b => b.mode === "napping")) {
    world.nextNap -= dt;
    if (world.nextNap <= 0) {
      const candidates = world.chickens.filter(b => b.mode === "wander" && !b.path.length && !b.pet && !world.needs.some(n => n.target === b));
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
    if (b.sleeping) continue;
    if (night) {
      if (b.mode !== "returning") bedtime(b);
      if (!moveChicken(b, dt, 80)) {
        if (b.homeStage === "approach") {
          b.path = [{ ...world.coop.door }];
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
    if (b.mode === "wander" && b.thirst <= 0) {
      const spots=[{x:930,y:715},{x:980,y:715},{x:1040,y:715}];
      const spot=spots[i%spots.length];sendChicken(b,spot.x,spot.y,"drinking");b.drinkUntil=0;
    }
    if (b.mode === "drinking") {
      if(b.path.length){moveChicken(b,dt,24);continue;}
      if(!b.drinkUntil)b.drinkUntil=world.elapsed+4+rand()*2;
      b.dir=b.x<999?1:-1;
      if(world.elapsed<b.drinkUntil){
        if((b.lastSip??0)+1.3<world.elapsed){world.ripples.push({x:b.x+b.dir*25,y:b.y-29,life:1.5});b.lastSip=world.elapsed;}
        continue;
      }
      b.mode="wander";b.thirst=65+rand()*110;b.pause=2;
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
          { x: world.coop.approach.x + i * 4, y: world.coop.approach.y + 5 },
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
      if (other === b || other.sleeping) continue;
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
  updateAmbient(dt);
}

function updateAmbient(dt) {
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

// One shared anchor keeps hit targets aligned with the animated need bubbles.
function needPosition(n) {
  return {x:n.target.x,y:n.target.y-(n.target.breed!==undefined?76:n.target.koi?69:45*(n.target.growth??1)+16)+Math.sin(world.elapsed*2)*3};
}
function needAt(x,y) {
  return [...world.needs].reverse().find(n=>{const p=needPosition(n);return Math.hypot(p.x-x,p.y-y)<Math.max(24,18/view.scale);});
}
