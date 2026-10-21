// Gate 3: a full playthrough driven by real pointer input (hotbar slots, world
// taps, market tiles, placement confirm). Time is fast-forwarded with the
// Garden.advance test hook; every step asserts the simulation state.
const fs = require("node:fs");
const path = require("node:path");
const L = require("./lib.cjs");
const { assert } = L;

const BASE = process.env.FARM_URL || "http://127.0.0.1:8095";
const shots = path.join(L.OUT, "playthrough");
fs.mkdirSync(shots, { recursive: true });
const steps = [];
let page, log;

const S = () => L.snapshot(page);
const B = () => page.evaluate(() => Garden.Sim.BALANCE);
async function record(name, extra = {}) {
  const s = await S();
  steps.push({ step: steps.length + 1, name, time: Math.round(s.time), money: s.money, animals: s.animals.filter((a) => a.state === "alive").length, ...extra });
  console.log(`${String(steps.length).padStart(2)} ✓ ${name}`, JSON.stringify(extra).slice(0, 160), "$" + s.money);
}
async function shot(name) {
  await page.screenshot({ path: path.join(shots, name + ".png") });
}
const select = (key) => L.tap(page, `.slot[data-key="${key}"]`);

// Pan the farm with a real drag until a logical x is near the screen centre.
async function lookAt(x) {
  for (let i = 0; i < 8; i++) {
    const { pan, scale, w } = await page.evaluate(() => ({ pan: Garden.Farm.pan, scale: Garden.view.scale, w: innerWidth }));
    const want = Math.max(-1450, Math.min(1450, x - 700));
    if (Math.abs(pan - want) < 60) return;
    const dx = Math.max(-w * 0.4, Math.min(w * 0.4, (pan - want) * scale));
    const y = 260;
    await page.mouse.move(w / 2, y);
    await page.mouse.down();
    for (let k = 1; k <= 6; k++) await page.mouse.move(w / 2 + (dx * k) / 6, y);
    await page.mouse.up();
    await page.waitForTimeout(700);
  }
}

async function onScreen(p) {
  const v = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  return p && p.x > 30 && p.x < v.w - 30 && p.y > 70 && p.y < v.h - 110;
}

async function tapThing(kind, id) {
  let p = await page.evaluate(([k, i]) => Garden.anchor(k, i), [kind, id]);
  if (!(await onScreen(p))) {
    const lx = await page.evaluate(([k, i]) => {
      if (k === "animal") return Garden.bridge.agentOf(i)?.x;
      const a = Garden.farmLayer.anchorOf(k, i, Garden.state());
      return a?.x;
    }, [kind, id]);
    await lookAt(lx);
    p = await page.evaluate(([k, i]) => Garden.anchor(k, i), [kind, id]);
  }
  await L.tapAt(page, p);
}

async function tapLogical(x, y, h = 0) {
  await lookAt(x);
  const p = await page.evaluate(([a, b, c]) => Garden.screen(a, b, c), [x, y, h]);
  await L.tapAt(page, p);
}

// ---------- chores through real taps ----------
const needs = () =>
  page.evaluate(() => {
    const s = Garden.state(),
      hs = Garden.Sim.housing(s);
    return s.animals.filter((a) => a.state === "alive").map((a) => ({ id: a.id, sp: a.sp, home: hs.homes.get(a.id)?.id ?? null, ...Garden.Sim.needsOf(a) }));
  });
const has = async (key) => ((await S()).inv[key] ?? 0) > 0;

// Tap a building on its roof while the ground ray lands on its footprint centre.
async function tapBuilding(id) {
  const c = await page.evaluate((i) => {
    if (i === null) return { x: 340, y: 797 };
    return Garden.farmLayer.anchorOf("building", i, Garden.state());
  }, id);
  await lookAt(c.x);
  const p = await page.evaluate(([x, y]) => Garden.screen(x, y + 48, 1.6), [c.x, c.y]);
  await L.tapAt(page, p);
}

async function foodFor(sp) {
  if (await has("feed_" + sp)) return "feed_" + sp;
  if (await has("hay")) return "hay";
  const price = await page.evaluate((k) => Garden.Sim.buyPrice(Garden.state(), k), "feed_" + sp);
  if ((await S()).money < price) await sellAll({});
  await buy("feed_" + sp, 1);
  assert(await has("feed_" + sp), "bought feed for " + sp);
  return "feed_" + sp;
}

async function care({ starve = null, skip = null } = {}) {
  const keep = (a) => a.id !== starve && a.sp !== skip;
  let list = (await needs()).filter(keep);
  const hens = list.filter((a) => a.sp === "chicken" && a.hungry);
  if (hens.length && starve === null && skip !== "chicken") {
    await select(await foodFor("chicken"));
    await tapLogical(560, 790); // scatter grain on open lawn
  }
  for (const [sp, trough] of [
    ["cow", -215],
    ["horse", 1615],
  ]) {
    const herd = list.filter((a) => a.sp === sp);
    if (herd.some((a) => a.hungry)) {
      await select(await foodFor(sp));
      await tapLogical(trough, 795);
    }
    if (herd.some((a) => a.thirsty)) {
      await select("can");
      await tapLogical(trough, 795);
    }
  }
  // Anyone still asking gets an individual tap.
  for (let round = 0; round < 3; round++) {
    list = (await needs()).filter((a) => keep(a) && (a.hungry || a.thirsty));
    if (!list.length) return;
    for (const a of list) {
      if (a.hungry) {
        await select(await foodFor(a.sp));
        await tapThing("animal", a.id);
      }
      const n = (await needs()).find((q) => q.id === a.id);
      if (n?.thirsty) {
        await select("can");
        await tapThing("animal", a.id);
      }
    }
  }
}

async function gather() {
  await select("hand");
  const s = await S();
  if (s.pickups.some((p) => p.kind === "egg")) {
    await tapBuilding(null);
    for (const b of s.buildings.filter((b) => b.type === "coop")) await tapBuilding(b.id);
  }
  for (const b of s.buildings.filter((b) => b.type === "barn")) if ((await S()).pickups.some((p) => p.kind === "milk")) await tapBuilding(b.id);
  for (const p of (await S()).pickups.slice(0, 8)) await tapThing("pickup", p.id);
}

async function tendBeds(crop = null) {
  const s = await S();
  for (const bed of s.beds) {
    const ripe = bed.plots.some((p) => p.crop && p.g >= 1 - 1e-6);
    if (ripe) {
      await select("hand");
      for (const [i, p] of bed.plots.entries()) if (p.crop && p.g >= 1 - 1e-6) await tapThing("plot", { bed: bed.id, index: i });
    }
    const cur = (await S()).beds.find((b) => b.id === bed.id);
    const empty = cur.plots.map((p, i) => (p.crop ? null : i)).filter((i) => i !== null);
    if (crop && empty.length) {
      if (((await S()).inv["seed_" + crop] ?? 0) < empty.length) await buy("seed_" + crop, empty.length);
      await select("seed_" + crop);
      for (const i of empty) await tapThing("plot", { bed: bed.id, index: i });
    }
    if ((await S()).beds.find((b) => b.id === bed.id).plots.some((p) => p.crop && p.g < 1 && p.w <= 0)) {
      await select("can");
      await tapThing("bed", bed.id);
    }
  }
}

async function buy(key, times = 1) {
  await L.openShop(page, "buy");
  for (let i = 0; i < times; i++) await L.tap(page, `#shop .tile[data-key="${key}"]`);
  if (await page.evaluate(() => Garden.shop.isOpen)) await L.closeShop(page);
}

async function sellAll(keep = {}) {
  await L.openShop(page, "sell");
  const keys = await page.$$eval("#shop .tile", (els) => els.map((e) => e.dataset.key));
  for (const k of keys) {
    if (k.startsWith("animal_")) continue;
    if (keep[k] !== undefined) continue;
    await L.tap(page, `#shop .tile[data-key="${k}"] .all`);
  }
  await L.closeShop(page);
}

async function play(seconds, opts = {}) {
  let left = seconds;
  while (left > 0) {
    const h = Math.min(opts.chunk ?? 120, left);
    await page.evaluate((n) => Garden.advance(n), h);
    await page.waitForTimeout(120);
    await care(opts);
    left -= h;
  }
}

async function earn(target, crop, opts = {}) {
  for (let i = 0; i < 80 && (await S()).money < target; i++) {
    await play(180, opts);
    await gather();
    await tendBeds(crop);
    await sellAll({ hay: true });
    // Reinvest like a player would: a couple more cows pay back fastest.
    const st = await S();
    const cows = st.animals.filter((a) => a.sp === "cow" && a.state === "alive").length;
    if (opts.cows && cows < opts.cows && st.buildings.some((b) => b.type === "barn") && st.money > 300 + 150) await buy(cows === 1 ? "animal_cow_m" : "animal_cow_f");
  }
  assert((await S()).money >= target, `earned ${target}`);
}

// The player stops caring for the flock; cows and horses are still tended at
// their troughs. The first hen to die is followed through dead pose and bones.
let doomed = null;
async function neglect() {
  await lookAt(600);
  assert((await S()).animals.some((a) => a.sp === "chicken" && a.state === "alive"), "a flock to neglect");
  for (let i = 0; i < 30 && !doomed; i++) {
    await play(90, { skip: "chicken" });
    doomed = (await S()).animals.find((a) => a.sp === "chicken" && a.state === "dead") ?? null;
  }
  assert(doomed, "a neglected hen died");
}

async function placeKit(kit) {
  await buy(kit);
  await page.waitForTimeout(500);
  const placing = (await S()).ui.placing;
  assert(placing?.kit === kit, kit + " entered placement mode");
  assert(await page.evaluate(() => Garden.farmLayer.ghostValid), "ghost starts on a valid spot");
  await L.tap(page, "#placement .ok");
  await page.waitForTimeout(500);
  const s = await S();
  assert(!s.ui.placing, "placement confirmed");
  return s.buildings.at(-1) ?? s.beds.at(-1);
}

(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  ({ page, log } = await L.open(ctx, `${BASE}/index.html?fresh=1&seed=5&time=8&nosync=1`, "playthrough"));
  try {
    let s = await S();
    assert(s.money === 1000 && s.beds.length === 1 && s.animals.length === 2, "starting farm");
    await shot("01-start");
    await record("fresh start: $1,000, one bed with daisies, hen + rooster, chicken feed");

    if (process.env.FROM === "neglect") {
      // Development shortcut only: jump to a late-game farm. Full runs never set FROM.
      await page.evaluate(() => {
        const st = Garden.state(),
          Sim = Garden.Sim;
        st.money = 9000;
        for (const k of ["kit_coop", "kit_barn", "kit_stable"]) {
          st.inv[k] = 1;
          const sp = Sim.layout.bestSpot(st, k.slice(4));
          Sim.place(st, k, sp.gx, sp.gy);
        }
        for (const k of ["animal_chicken_f", "animal_chicken_f", "animal_cow_f", "animal_horse_f"]) Sim.buy(st, k);
        Sim.drainEvents(st);
      });
      await page.waitForTimeout(800);
    } else {
    const bed = s.beds[0].id;
    await select("can");
    await tapThing("bed", bed);
    s = await S();
    assert(s.beds[0].plots.every((p) => p.w > 0), "bed watered by tapping it with the can");
    await record("water the bed with the can");

    await select("seed_daisy");
    await tapThing("plot", { bed, index: 2 });
    s = await S();
    assert(s.beds[0].plots[2].crop === "daisy" && s.inv.seed_daisy === 3, "seed planted by tap");
    await record("plant a daisy seed");

    await select("hand");
    const view = (st) => JSON.stringify({ crops: st.beds[0].plots.map((p) => p.crop), inv: st.inv });
    const unripe = view(await S());
    await tapThing("plot", { bed, index: 2 });
    assert(view(await S()) === unripe, "tapping an unripe crop only wiggles it");
    await record("tap unripe crop: wiggle only");

    await page.evaluate(() => Garden.advance(52));
    await page.waitForTimeout(500);
    s = await S();
    assert(s.beds[0].plots[0].g >= 1, "fast-forward ripened the daisies");
    await shot("02-ripe");
    for (const i of [0, 1, 2]) await tapThing("plot", { bed, index: i });
    s = await S();
    assert(s.inv.daisy === 3 && !s.beds[0].plots[0].crop, "three daisies harvested");
    await record("fast-forward, harvest ripe daisies", { daisy: s.inv.daisy });

    const before = s.money;
    await L.openShop(page, "sell");
    const unit = await page.evaluate(() => Garden.Sim.sellPrice(Garden.state(), "daisy"));
    await L.tap(page, '#shop .tile[data-key="daisy"]');
    s = await S();
    assert(s.money === before + unit && s.inv.daisy === 2, "sold one daisy at the shown price");
    await L.tap(page, '#shop .tile[data-key="daisy"] .all');
    s = await S();
    assert(s.money === before + 3 * unit && !s.inv.daisy, "sold the rest");
    await L.closeShop(page);
    await record("sell daisies in the market", { unit });

    await buy("seed_tulip", 3);
    await buy("seed_wheat", 1);
    s = await S();
    assert(s.inv.seed_tulip === 3 && s.inv.seed_wheat === 4, "bought seeds");
    await record("buy tulip and wheat seeds");

    await select("seed_wheat");
    for (const i of [0, 1, 2]) await tapThing("plot", { bed, index: i });
    await select("seed_tulip");
    for (const i of [3, 4, 5]) await tapThing("plot", { bed, index: i });
    await select("can");
    await tapThing("bed", bed);
    s = await S();
    assert(s.beds[0].plots.every((p) => p.crop), "bed fully planted");
    await record("plant wheat (for hay) and tulips");

    await buy("animal_chicken_f");
    s = await S();
    assert(s.animals.filter((a) => a.sp === "chicken").length === 3, "bought a hen");
    await record("buy a hen");

    await play(200);
    await page.waitForTimeout(300);
    s = await S();
    assert(s.pickups.some((p) => p.kind === "egg"), "hens laid eggs");
    await shot("03-eggs");
    await select("hand");
    const egg = s.pickups.find((p) => p.kind === "egg");
    await tapThing("pickup", egg.id);
    s = await S();
    assert(s.inv.egg === 1 && !s.pickups.some((p) => p.id === egg.id), "egg collected by tap");
    await gather();
    await record("collect eggs", { eggs: (await S()).inv.egg });

    await tendBeds("tulip");
    const coop = await placeKit("kit_coop");
    s = await S();
    assert(s.buildings.some((b) => b.type === "coop"), "coop placed");
    await shot("04-coop");
    await record("buy the coop and place it");

    // Breeding: a content pair has a chick within two game days, grown in three more.
    let chick = null;
    for (let i = 0; i < 16 && !chick; i++) {
      await play(100);
      chick = (await S()).animals.find((a) => a.age < 1 && a.state === "alive");
    }
    assert(chick, "a chick was born");
    await shot("05-chick");
    await record("observe breeding: a chick hatched", { chick: chick.id });
    await gather();
    await tendBeds("tulip");
    await sellAll({ hay: true });
    await play(1800, { chunk: 150 });
    s = await S();
    assert(s.animals.find((a) => a.id === chick.id).age === 1, "chick matured after three game days");
    await record("observe growth: the chick grew up");

    await gather();
    await tendBeds("tulip");
    await sellAll({ hay: true });
    const P = await B();
    await earn(P.buildings.barn.price + P.species.cow.buy.f, "tulip");
    await placeKit("kit_barn");
    await page.waitForTimeout(400);
    s = await S();
    assert(s.buildings.some((b) => b.type === "barn"), "barn placed");
    await L.openShop(page, "buy");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shots, "06-cow-unlocked.png") });
    assert(!(await page.locator('#shop .tile[data-key="animal_cow_f"].locked').count()), "cow tile unlocked");
    await L.tap(page, '#shop .tile[data-key="animal_cow_f"]');
    await L.closeShop(page);
    s = await S();
    assert(s.animals.some((a) => a.sp === "cow" && a.state === "alive"), "cow bought");
    await record("buy the barn, then a cow");

    // Feed the cow with home-grown hay.
    let hay = (await S()).inv.hay ?? 0;
    for (let i = 0; i < 6 && hay < 2; i++) {
      await play(120);
      await tendBeds("wheat");
      hay = (await S()).inv.hay ?? 0;
    }
    assert(hay >= 1, "harvested hay");
    const cow = (await S()).animals.find((a) => a.sp === "cow");
    await page.evaluate(() => {
      Garden.advance(Garden.Sim.BALANCE.species.cow.hungryAfter);
      // Herds shelter in the barn at night; come back in daylight to see her.
      if (Garden.clock().night) Garden.setHour(9);
    });
    await page.waitForTimeout(1500);
    assert((await S()).animals.find((a) => a.id === cow.id).hunger >= P.species.cow.hungryAfter, "cow is hungry");
    await select("hay");
    await tapThing("animal", cow.id);
    s = await S();
    assert(s.animals.find((a) => a.id === cow.id).hunger < 5 && (s.inv.hay ?? 0) === hay - 1, "fed the cow with hay by tap (one hay used, hunger reset)");
    await record("feed the cow with hay", { hay: s.inv.hay ?? 0 });
    await care();

    await earn(P.buildings.stable.price + P.species.horse.buy.f, "tulip", { cows: 3 });
    await placeKit("kit_stable");
    await buy("animal_horse_f");
    s = await S();
    assert(s.animals.some((a) => a.sp === "horse" && a.state === "alive"), "horse bought");
    await lookAt(1930);
    await page.waitForTimeout(800);
    await shot("07-horse");
    await record("buy the stable, then a horse");
    }

    await neglect();
    s = await S();
    const dead = s.animals.find((a) => a.id === doomed.id);
    assert(dead.state === "dead", "the neglected hen died after two game days of unmet needs");
    await page.waitForTimeout(B_COLLAPSE_MS);
    const pose = await page.evaluate((id) => {
      const agent = Garden.bridge.agentOf(id);
      const view = Garden.animals.views.get(agent);
      return { action: view.o.userData.action, deadAt: view.deadAt !== null, dimmed: view.dimmed, visible: view.o.visible, bubble: !!document.querySelector(`.bubble`) && [...document.querySelectorAll(".bubble")].length };
    }, doomed.id);
    assert(pose.action === "death" && pose.dimmed > 0.9 && pose.visible, "dead pose held, softly desaturated");
    await lookAt(dead.x);
    await shot("08-dead");
    await record("neglected hen died: dead pose", pose);

    await page.evaluate(() => Garden.advance(Garden.Sim.BALANCE.neglect.bonesDays * 600));
    await page.waitForTimeout(900);
    s = await S();
    assert(s.animals.find((a) => a.id === doomed.id).state === "bones", "turned to bones after half a day");
    const hidden = await page.evaluate((id) => !Garden.animals.views.get(Garden.bridge.agentOf(id))?.o.visible, doomed.id);
    assert(hidden, "the body is replaced by the bones prop");
    await shot("09-bones");
    await record("bones after half a game day");
    await select("hand");
    await tapThing("remains", doomed.id);
    await page.waitForTimeout(400);
    s = await S();
    assert(!s.animals.some((a) => a.id === doomed.id), "bones cleared by tap");
    await shot("10-cleared");
    await record("tap the bones: cleared with a dust puff");

    assert(s.money >= 0, "money never negative");
    assert(L.noLetters(await page.locator("body").innerText()), "no letters on the page");
  } finally {
    fs.writeFileSync(path.join(L.OUT, "playthrough.json"), JSON.stringify({ steps, errors: log.errors, warnings: log.warnings, failed: log.failed }, null, 2));
    await browser.close();
  }
  assert(!log.errors.length && !log.warnings.length && !log.failed.length, "console/network clean " + JSON.stringify(log));
  console.log(`\nGate 3 playthrough: ${steps.length} steps passed, console clean`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

const B_COLLAPSE_MS = 1700;
