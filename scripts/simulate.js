// Headless balance harness: scripted players drive the pure simulation with a
// limited tap budget (a relaxed human, not a macro) and report money over time.
//   node scripts/simulate.js [minutes=120] [--json]
import * as S from "../src/sim/index.js";

const B = S.BALANCE;
const MINUTES = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 120);
const MINUTES_REF = { value: MINUTES };
const JSON_OUT = process.argv.includes("--json");
const TAPS_PER_MINUTE = B.simulation.tapsPerMinute;
const THINK = B.simulation.thinkSeconds;

const FOOD_UNIT = { chicken: "feed_chicken", cow: "feed_cow", horse: "feed_horse" };

class Bot {
  constructor(name, plan) {
    this.name = name;
    this.plan = plan;
    this.s = S.createState({ seed: 1247 });
    this.taps = 0;
    this.budget = 0;
    this.log = [];
    this.milestones = {};
    this.defended = new Set();
    this.defenseProgress = new Map();
  }
  spend(n = 1) {
    if (this.budget < n) return false;
    this.budget -= n;
    this.taps += n;
    return true;
  }
  mark(key) {
    if (!(key in this.milestones)) this.milestones[key] = Math.round(this.s.time / 60);
  }
  act(name, ...args) {
    const r = S[name](this.s, ...args);
    return r;
  }

  // ---------- chores every strategy performs ----------
  careForAnimals() {
    const s = this.s,
      hs = S.housing(s);
    // Hens return and close their coop automatically; taps go to farm care.
    for (const sp of S.SPECIES) {
      const herd = S.alive(s, sp);
      const hungry = herd.filter((a) => S.needsOf(a).hungry);
      if (hungry.length) {
        // One scatter/trough tap feeds the whole group; buy feed first if out.
        const have = () => (s.inv.hay ?? 0) + (s.inv[FOOD_UNIT[sp]] ?? 0);
        while (have() < hungry.length && S.canBuy(s, FOOD_UNIT[sp]).ok && this.spend(0.5)) S.buy(s, FOOD_UNIT[sp]);
        if (this.spend()) S.feedMany(s, hungry.map((a) => a.id), this.plan.hayFor?.includes(sp) && (s.inv.hay ?? 0) > 0 ? "hay" : null);
      }
      const thirsty = herd.filter((a) => S.needsOf(a).thirsty);
      // Water taps go per housing building (coop/barn/stable or starter coop).
      const homes = new Set(thirsty.map((a) => hs.homes.get(a.id)?.id ?? "base"));
      for (const h of homes) {
        if (!this.spend()) break;
        S.waterMany(s, thirsty.filter((a) => (hs.homes.get(a.id)?.id ?? "base") === h).map((a) => a.id));
      }
    }
  }
  // One tap on each building (or the starter coop) gathers the eggs/milk around it.
  collect() {
    const s = this.s;
    while (s.pickups.length && this.spend()) {
      const p = s.pickups[0];
      if (!S.collectNear(s, p.x, p.y).ok) {
        S.sellGood(s, p.kind, "all");
        S.collect(s, p.id);
      }
    }
  }
  farm() {
    const s = this.s;
    for (const bed of s.beds) {
      if (bed.plots.some((p) => S.plotStage(p) === 2) && this.spend()) S.harvestBed(s, bed.id);
      if (bed.plots.some((p) => p.crop && S.plotStage(p) < 2 && p.w <= 0) && this.spend()) S.waterBed(s, bed.id);
      const empty = bed.plots.filter((p) => !p.crop).length;
      if (!empty) continue;
      const crop = this.plan.crop(this, bed);
      if (!crop) continue;
      while ((s.inv["seed_" + crop] ?? 0) < empty && S.canBuy(s, "seed_" + crop).ok) S.buy(s, "seed_" + crop);
      if (!this.spend(1.5)) return;
      for (let i = 0; i < empty; i++) S.plantBed(s, bed.id, crop);
      S.waterBed(s, bed.id);
    }
  }
  sell(force = false) {
    const s = this.s;
    for (const k of S.GOODS) {
      const n = s.inv[k] ?? 0;
      if (!n) continue;
      if (k === "hay" && this.plan.keepHay && !force) {
        const keep = this.plan.keepHay(this);
        if (n > keep && this.spend()) S.sellGood(s, k, n - keep);
        continue;
      }
      if ((force || n >= 6 || s.money < 50) && this.spend()) S.sellGood(s, k, "all");
    }
  }
  // Shop tap + buy (+ one placement tap for kits), paid as one step.
  buy(key) {
    const kit = key.startsWith("kit_");
    const sp = key.startsWith('animal_') ? key.split('_')[1] : null;
    if (sp && sp !== 'chicken' && !this.protectHousing(sp)) return false;
    if (!S.canBuy(this.s, key).ok) return false;
    const spot = kit ? S.layout.bestSpot(this.s, key.slice(4)) : null;
    if (kit && !spot) return false;
    if (!this.spend(kit ? 3 : 2)) return false;
    const r = S.buy(this.s, key);
    if (r.ok && kit) S.place(this.s, key, spot.gx, spot.gy);
    return r.ok;
  }

  // A careful progression player draws an inexpensive closed perimeter before
  // buying large livestock. The separate defense benchmark remains reckless.
  protectHousing(sp) {
    const s=this.s, type=B.species[sp].unlockedBy;
    for(const b of s.buildings.filter(b=>b.type===type)) {
      if(this.defended.has(b.id))continue;
      const [bw,bh]=S.layout.footprintOf(type);let perimeter=null;
      for(let margin=2;margin<=6&&!perimeter;margin++) {
        const gx=b.gx-margin,gy=b.gy-margin,w=bw+margin*2,h=bh+margin*2+2,list=[];
        for(let x=0;x<w;x++){list.push({gx:gx+x,gy,axis:'h',gate:false});list.push({gx:gx+x,gy:gy+h,axis:'h',gate:x===Math.floor(w/2)});}
        for(let y=0;y<h;y++)for(const x of[gx,gx+w])list.push({gx:x,gy:gy+y,axis:'v',gate:false});
        if(list.every(f=>S.checkFencePlacement(s,f.gx,f.gy,f.axis,f.gate).ok))perimeter=list;
      }
      if(!perimeter)return false;
      const cost=perimeter.reduce((n,f)=>n+(f.gate?B.fences.gatePrice:B.fences.price),0);
      const taps=B.simulation.fenceDragBaseTaps+perimeter.length*B.simulation.fenceDragSegmentTaps;
      if(s.money<cost)return false;
      const progress=this.defenseProgress.get(b.id)??0, work=Math.min(this.budget,taps-progress);
      if(work>0){this.spend(work);this.defenseProgress.set(b.id,progress+work);}
      if(progress+work<taps-1e-8)return false;
      for(const f of perimeter){S.buy(s,f.gate?'gate':'fence');const r=S.placeFence(s,f.gx,f.gy,f.axis,f.gate);if(!r.ok)throw Error('benchmark perimeter failed');}
      this.defended.add(b.id);this.mark('pen');
    }
    return true;
  }

  netWorth() {
    const s = this.s;
    let v = s.money;
    for (const k of S.GOODS) v += (s.inv[k] ?? 0) * S.sellPrice(s, k);
    for (const a of S.alive(s)) v += S.isAdult(a) ? B.species[a.sp].sell[a.sex] : B.species[a.sp].sell[a.sex] * a.age * 0.6;
    for (const b of s.buildings) v += B.buildings[b.type].price * 0.5;
    return Math.round(v);
  }

  run() {
    const total = MINUTES_REF.value * 60;
    let next = 0;
    while (this.s.time < total) {
      S.tick(this.s, THINK);
      this.budget = Math.min(20, this.budget + (TAPS_PER_MINUTE / 60) * THINK);
      if (!this.plan.idle) {
        this.careForAnimals();
        this.plan.invest(this);
        this.collect();
        this.farm();
        this.sell();
        this.plan.trade?.(this);
      }
      for (const e of S.drainEvents(this.s)) if (e.type === "death") this.mark("firstDeath");
      if (this.s.time >= next) {
        this.log.push({ min: Math.round(this.s.time / 60), money: this.s.money, worth: this.netWorth(), animals: S.alive(this.s).length, beds: this.s.beds.length });
        next += 300;
      }
      const s = this.s;
      if (s.buildings.some((b) => b.type === "coop")) this.mark("coop");
      if (s.buildings.some((b) => b.type === "barn")) this.mark("barn");
      if (S.alive(s, "cow").length) this.mark("cow");
      if (s.buildings.some((b) => b.type === "stable")) this.mark("stable");
      if (S.alive(s, "horse").length) this.mark("horse");
      if (s.beds.length >= B.beds.max) this.mark("allBeds");
      if (s.buildings.length >= 6 && s.beds.length >= B.beds.max) this.mark("fullFarm");
    }
    return this;
  }
}

// ---------- crop choice ----------
const profitPerMinute = (c) => ((B.crops[c].yield * (B.crops[c].good ? B.goods[B.crops[c].good] : B.crops[c].sell) - B.crops[c].seed) / B.crops[c].grow) * 60;
const bestCrop = (bot) => {
  const affordable = S.CROPS.filter((c) => c !== "wheat" && bot.s.money >= B.crops[c].seed * 6 + 40);
  return affordable.sort((a, b) => profitPerMinute(b) - profitPerMinute(a))[0] ?? "daisy";
};

const ladder = (steps) => (bot) => {
  for (const step of steps) {
    if (step.when && !step.when(bot)) return;
    if (step.done(bot)) continue;
    if (bot.s.money >= (step.reserve ?? 0) + (S.buyPrice(bot.s, step.key) ?? Infinity)) bot.buy(step.key);
    return;
  }
};
const count = (bot, sp, sex) => S.alive(bot.s, sp).filter((a) => !sex || a.sex === sex).length;
const owned = (bot, type) => S.ownedOf(bot.s, type);

// Horses: keep a breeding pair per stable, sell every other adult as it matures.
const sellSurplusHorses = (bot) => {
  const s = bot.s;
  const pairs = s.buildings.filter((b) => b.type === "stable").length;
  for (const sex of ["f", "m"]) {
    const extra = S.sellableAnimals(s, "horse", sex).length - pairs;
    for (let i = 0; i < extra; i++) if (bot.spend()) S.sellAnimal(s, "horse", sex, 1);
  }
};

const STRATEGIES = {
  idle: { idle: true, crop: () => null, invest: () => {} },
  daisySpam: { crop: () => "daisy", invest: ladder([{ key: "kit_bed", done: (b) => owned(b, "bed") >= B.beds.max }]) },
  bestCropOnly: { crop: bestCrop, invest: ladder([{ key: "kit_bed", done: (b) => owned(b, "bed") >= B.beds.max }]) },
  chickenFarm: {
    crop: (bot, bed) => (bed.id % 2 ? "wheat" : bestCrop(bot)),
    hayFor: ["chicken"],
    invest: ladder([
      { key: "animal_chicken_f", done: (b) => count(b, "chicken", "f") >= 3 },
      { key: "kit_coop", done: (b) => owned(b, "coop") >= 1 },
      { key: "animal_chicken_f", done: (b) => count(b, "chicken") >= 10 },
      { key: "kit_coop", done: (b) => owned(b, "coop") >= 2 },
      { key: "animal_chicken_f", done: (b) => count(b, "chicken") >= 16 },
      { key: "kit_bed", done: (b) => owned(b, "bed") >= 6 },
    ]),
  },
  balanced: {
    crop: (bot, bed) => (bed.id % 3 === 0 && bot.s.buildings.length ? "wheat" : bestCrop(bot)),
    hayFor: ["cow", "horse", "chicken"],
    keepHay: (bot) => 6 + S.alive(bot.s).length,
    invest: ladder([
      { key: "kit_bed", done: (b) => owned(b, "bed") >= 3 },
      { key: "animal_chicken_f", done: (b) => count(b, "chicken", "f") >= 3 },
      { key: "kit_coop", done: (b) => owned(b, "coop") >= 1 },
      { key: "animal_chicken_f", done: (b) => count(b, "chicken", "f") >= 6 },
      { key: "kit_coop", done: (b) => owned(b, "coop") >= 2 },
      { key: "animal_chicken_f", done: (b) => count(b, "chicken") >= 14 },
      { key: "kit_bed", done: (b) => owned(b, "bed") >= 4 },
      { key: "kit_barn", done: (b) => owned(b, "barn") >= 1 },
      { key: "animal_cow_f", done: (b) => count(b, "cow", "f") >= 2 },
      { key: "animal_cow_m", done: (b) => count(b, "cow", "m") >= 1 },
      { key: "animal_cow_f", done: (b) => count(b, "cow", "f") >= 3 },
      { key: "kit_barn", done: (b) => owned(b, "barn") >= 2 },
      { key: "animal_cow_f", done: (b) => count(b, "cow") >= 8 },
      { key: "kit_stable", done: (b) => owned(b, "stable") >= 1 },
      { key: "animal_horse_f", done: (b) => count(b, "horse", "f") >= 1 },
      { key: "animal_horse_m", done: (b) => count(b, "horse", "m") >= 1 },
      { key: "kit_bed", done: (b) => owned(b, "bed") >= 6 },
      { key: "kit_stable", done: (b) => owned(b, "stable") >= 2 },
      { key: "animal_horse_f", done: (b) => count(b, "horse", "f") >= 2 },
      { key: "animal_horse_m", done: (b) => count(b, "horse", "m") >= 2 },
      { key: "kit_bed", done: (b) => owned(b, "bed") >= B.beds.max },
    ]),
    trade: sellSurplusHorses,
  },
  horseRush: {
    crop: bestCrop,
    hayFor: ["horse"],
    invest: ladder([
      { key: "kit_stable", done: (b) => owned(b, "stable") >= 1 },
      { key: "animal_horse_f", done: (b) => count(b, "horse", "f") >= 1 },
      { key: "animal_horse_m", done: (b) => count(b, "horse", "m") >= 1 },
      { key: "kit_bed", done: (b) => owned(b, "bed") >= B.beds.max },
    ]),
    trade: sellSurplusHorses,
  },
};

export function runStrategies(minutes = MINUTES) {
  const saved = MINUTES_REF.value;
  MINUTES_REF.value = minutes;
  const out = Object.entries(STRATEGIES).map(([name, plan]) => new Bot(name, plan).run());
  MINUTES_REF.value = saved;
  return out;
}

// A second deterministic benchmark isolates night defenses on the same herd.
// Animals are cared for every 30 s so neglect cannot mask predator outcomes.
export function runPredatorStrategies(nights = 12) {
  return ['noFences', 'partialFence', 'closedPen', 'activeFlashlight'].map(name => {
    const s = S.createState({ seed: 1247 }); s.animals = []; s.pickups = [];
    if (name === 'activeFlashlight') s.player.mode = 'fp';
    for (let i = 0; i < 6; i++) {
      const a = S.spawnAnimal(s, i < 4 ? 'cow' : 'horse', 'f');
      a.x = -620 + (i % 3) * 15; a.y = 680 + Math.floor(i / 3) * 15;
    }
    let fenceCost = 0;
    if (['partialFence', 'closedPen'].includes(name)) {
      S.addInventory(s, 'fence', 26); S.addInventory(s, 'gate', 1);
      for (let x = -20; x < -12; x++) {
        if (!(name === 'partialFence' && x === -18)) {
          if (S.placeFence(s, x, 26, 'h').ok) fenceCost += B.fences.price;
        }
        if (S.placeFence(s, x, 31, 'h', x === -17).ok) fenceCost += x === -17 ? B.fences.gatePrice : B.fences.price;
      }
      for (let y = 26; y < 31; y++) for (const x of [-20, -12]) if (S.placeFence(s, x, y, 'v').ok) fenceCost += B.fences.price;
    }
    let damage = 0, lowestHealth = 100, scares = 0, alerts = 0, spawns = 0, wolves = 0, bears = 0;
    for (let t = 0; t < nights * S.DAY_SECONDS; t++) {
      if (t % 30 === 0) for (const a of s.animals) if (a.state === 'alive') a.hunger = a.thirst = 0;
      const before = new Map(s.animals.map(a => [a.id, a.health]));
      S.tick(s, 1);
      for (const a of s.animals) {
        damage += Math.max(0, (before.get(a.id) ?? 100) - a.health);
        lowestHealth = Math.min(lowestHealth, a.health);
      }
      if (name === 'activeFlashlight') for (const p of s.predators) {
        if (p.kind !== 'wolf' || p.state === 'flee' || Math.hypot(p.x + 620, (p.y - 690) * 1.65) > 550) continue;
        const r = S.illuminate(s, p.id, 1, 'fp');
        if (r.ready && S.scarePredator(s, p.id).ok) scares++;
      }
      for (const e of S.drainEvents(s)) {
        if (e.type === 'predatorAlert') alerts++;
        if (e.type === 'predatorSpawn') { spawns++; if(e.kind==='wolf')wolves++;else bears++; }
      }
    }
    return { name, nights, fenceCost, damage: Math.round(damage), lowestHealth: Math.round(lowestHealth), deaths: s.stats.deaths, survivors: S.alive(s).length, scares, alerts, spawns, wolves, bears };
  });
}

const direct = import.meta.url === `file://${process.argv[1]}`;
const results = direct ? runStrategies() : [];
const predatorResults = direct ? runPredatorStrategies() : [];

if (!direct) {
  // imported by tests
} else if (JSON_OUT) {
  console.log(JSON.stringify({ progression: results.map((r) => ({ name: r.name, log: r.log, milestones: r.milestones, taps: r.taps, deaths: r.s.stats.deaths, final: { money: r.s.money, worth: r.netWorth() } })), predators: predatorResults }, null, 2));
} else {
  const mins = results[0].log.map((l) => l.min);
  const pad = (v, n = 9) => String(v).padStart(n);
  console.log(`Money over time (game minutes; ${TAPS_PER_MINUTE} taps/min budget)\n`);
  console.log("strategy".padEnd(13) + mins.map((m) => pad(m + "m", 8)).join(""));
  for (const r of results) console.log(r.name.padEnd(13) + r.log.map((l) => pad(l.money, 8)).join(""));
  console.log(`\nNet worth (money + goods + animals + half building cost)\n`);
  console.log("strategy".padEnd(13) + mins.map((m) => pad(m + "m", 8)).join(""));
  for (const r of results) console.log(r.name.padEnd(13) + r.log.map((l) => pad(l.worth, 8)).join(""));
  console.log(`\nMilestones (minute reached)\n`);
  for (const r of results) console.log(r.name.padEnd(13) + JSON.stringify(r.milestones) + `  deaths=${r.s.stats.deaths} taps=${Math.round(r.taps)} animals=${S.alive(r.s).length} beds=${r.s.beds.length}`);
  console.log('\nNight defense benchmark (same six cared-for animals, 12 nights)');
  for (const r of predatorResults) console.log(JSON.stringify(r));
}
