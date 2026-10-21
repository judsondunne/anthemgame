"use strict";
// Camera panning plus the visual herd agents. Which cows and horses exist, their
// age, needs and death come from the farm simulation; this file only moves them.
const Farm = {
  pan: 0,
  targetPan: 0,
  held: 0,
  xp: 0,
  shownXP: 0,
  animals: [],
  feedPuffs: [],
  pastures: [
    { kind: "cow", x: -530, gate: -150, troughs: [-269, -215, -161], zone: { x0: -1000, x1: -90, y0: 580, y1: 905 } },
    { kind: "horse", x: 1930, gate: 1550, troughs: [1561, 1615, 1669], zone: { x0: 1490, x1: 2400, y0: 580, y1: 905 } },
  ],
  init() {
    try {
      this.xp = Number(JSON.parse(localStorage.getItem("garden-progress") || "{}").xp) || 0;
    } catch {}
    this.shownXP = this.xp;
  },
  award(x, y, amount) {
    this.xp += amount;
    this.shownXP = this.xp;
  },
  pasture(kind) {
    return this.pastures.find((p) => p.kind === kind);
  },
  makeHerdAgent(kind, x, y) {
    return { kind, x, y, tx: x, ty: y, dir: Math.random() < 0.5 ? -1 : 1, phase: Math.random() * 6, wait: 1 + Math.random() * 4, age: 1, feedUntil: 0, home: null };
  },
  // Walk to the nearest trough and eat there for a moment.
  eat(a) {
    const p = this.pasture(a.kind);
    const tx = p.troughs.reduce((best, x) => (Math.abs(x - a.x) < Math.abs(best - a.x) ? x : best), p.troughs[0]);
    const slot = this.animals.filter((b) => b !== a && b.kind === a.kind && b.feedUntil > world.elapsed).length;
    a.tx = tx + ((slot % 3) - 1) * 40;
    a.ty = 838 + Math.floor(slot / 3) * 26;
    a.feedUntil = world.elapsed + 9;
    a.wait = 0;
  },
  update(dt) {
    if (!world.started) return;
    this.targetPan = Math.max(-1450, Math.min(1450, this.targetPan + this.held * 620 * dt));
    this.pan += (this.targetPan - this.pan) * (1 - Math.exp(-dt * 6));
    this.feedPuffs = this.feedPuffs.filter((p) => (p.age += dt) < p.duration);
    const night = isNight();
    for (const a of this.animals) {
      a.happy = Math.max(0, (a.happy ?? 0) - dt);
      a.wait -= dt;
      if (a.dead) {
        a.moving = false;
        a.eating = false;
        a.sheltered = false;
        continue;
      }
      const p = this.pasture(a.kind),
        z = p.zone,
        home = a.home;
      if (night && home) {
        a.tx = home.door.x + ((a.phase % 3) - 1) * 24;
        a.ty = home.door.y;
        a.feedUntil = 0;
      } else if (a.wasNight) {
        a.wait = 0;
        a.x = a.tx = home ? home.approach.x : a.x;
        a.y = a.ty = home ? home.approach.y : a.y;
      }
      a.wasNight = night;
      const dist = Math.hypot(a.tx - a.x, a.ty - a.y);
      a.sheltered = night && !!home && dist < 16;
      a.eating = !night && a.feedUntil > world.elapsed && dist < 6;
      if (dist > 3) {
        const slow = a.sad ? 0.45 : 1;
        const speed =
          ((a.boltUntil ?? 0) > world.elapsed ? (a.kind === "horse" ? 100 : 60) : a.kind === "horse" && !night && a.feedUntil < world.elapsed && !a.juvenile ? 58 : 26) * slow;
        const step = Math.min(dist, speed * dt);
        a.x += ((a.tx - a.x) / dist) * step;
        a.y += ((a.ty - a.y) / dist) * step;
        if (Math.abs(a.tx - a.x) > 1) a.dir = a.tx > a.x ? 1 : -1;
        a.moving = true;
      } else {
        a.moving = false;
        if (!night && a.feedUntil < world.elapsed && a.wait < 0) {
          // Graze around home, staying inside the pasture fence line.
          const cx = home ? home.x : (z.x0 + z.x1) / 2;
          a.tx = Math.max(z.x0 + 30, Math.min(z.x1 - 30, cx - 300 + Math.random() * 600));
          a.ty = Math.max(z.y0 + 20, Math.min(z.y1 - 20, (home ? home.y + 30 : z.y0) + Math.random() * 230));
          a.wait = (5 + Math.random() * 9) / (a.sad ? 0.5 : 1);
        }
      }
    }
    // Personal space keeps grazing herds readable rather than stacked.
    if (!night)
      for (let i = 0; i < this.animals.length; i++)
        for (let j = i + 1; j < this.animals.length; j++) {
          const a = this.animals[i],
            b = this.animals[j];
          if (a.kind !== b.kind || a.dead || b.dead) continue;
          const dx = b.x - a.x,
            dy = (b.y - a.y) * 1.8,
            d = Math.hypot(dx, dy);
          if (d > 0 && d < 110) {
            const push = Math.min(8 * dt, (110 - d) * 0.12);
            a.x -= (dx / d) * push;
            b.x += (dx / d) * push;
            a.y -= (dy / d) * push * 0.45;
            b.y += (dy / d) * push * 0.45;
          }
        }
  },
};
