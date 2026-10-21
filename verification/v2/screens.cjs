// Gate 4: evidence screenshots. Scenes are arranged through the simulation's
// own actions (state setup only); each capture is reviewed by eye in REPORT.md.
const fs = require("node:fs");
const path = require("node:path");
const L = require("./lib.cjs");
const { assert } = L;

const BASE = process.env.FARM_URL || "http://127.0.0.1:8090";
const DIR = path.join(L.OUT, process.argv[2] || "shots");
fs.mkdirSync(DIR, { recursive: true });
const manifest = [];
const logs = [];

// A thriving farm: every building, all beds in different stages, every species
// with juveniles, eggs and milk lying about.
const FULL_FARM = () => {
  const s = Garden.state(),
    Sim = Garden.Sim;
  s.money = 48250;
  const place = (kit, gx, gy) => {
    s.inv[kit] = (s.inv[kit] ?? 0) + 1;
    const r = Sim.place(s, kit, gx, gy);
    if (!r.ok) delete s.inv[kit];
    return r.ok;
  };
  // A dense valid layout (found by search in the pure sim): 10 beds, 2 coops.
  [["kit_coop", 0, 28], ["kit_coop", 30, 24], ["kit_barn", -9, 24], ["kit_barn", -25, 24], ["kit_stable", 38, 24], ["kit_stable", 54, 24]].forEach((a) => place(...a));
  for (const [gx, gy] of [[18, 32], [6, 27], [29, 28], [0, 25], [29, 21], [22, 31], [3, 22], [10, 26], [18, 29]]) place("kit_bed", gx, gy);
  const crops = ["daisy", "tulip", "sunflower", "lavender", "cabbage", "wheat"];
  s.beds.forEach((b, bi) => b.plots.forEach((p, i) => Object.assign(p, { crop: crops[(bi + i) % 6], g: [1, 0.75, 0.5, 1, 0.2][bi % 5], w: 140 })));
  const buy = (k, n) => {
    for (let i = 0; i < n; i++) Sim.buy(s, k);
  };
  buy("animal_chicken_f", 9);
  buy("animal_chicken_m", 1);
  buy("animal_cow_f", 4);
  buy("animal_cow_m", 1);
  buy("animal_horse_f", 2);
  buy("animal_horse_m", 1);
  Sim.spawnAnimal(s, "chicken", "f", { age: 0.25 });
  Sim.spawnAnimal(s, "chicken", "m", { age: 0.5 });
  Sim.spawnAnimal(s, "cow", "f", { age: 0.3 });
  Sim.spawnAnimal(s, "horse", "f", { age: 0.4 });
  for (const a of s.animals) a.hunger = a.thirst = 0;
  s.inv = { ...s.inv, seed_lavender: 12, seed_tulip: 8, feed_chicken: 18, feed_cow: 10, feed_horse: 8, hay: 14, egg: 23, milk: 6, tulip: 9, lavender: 5 };
  for (let i = 0; i < 7; i++) s.pickups.push({ id: Sim.newId(s), kind: "egg", x: 980 + (i % 4) * 26, y: 846 + Math.floor(i / 4) * 14, t: s.time });
  for (let i = 0; i < 3; i++) s.pickups.push({ id: Sim.newId(s), kind: "milk", x: -560 + i * 40, y: 760, t: s.time });
  Sim.drainEvents(s);
  return { beds: s.beds.length, buildings: s.buildings.length, animals: s.animals.length };
};

async function scene(browser, name, url, { viewport = { width: 1440, height: 900 }, mobile = false, setup = null, after = null, wait = 1400, clip = null, note = "" } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const { page, log } = await L.open(ctx, `${BASE}/index.html?${url}`, name);
  logs.push(log);
  if (setup) await page.evaluate(...(Array.isArray(setup) ? setup : [setup]));
  await page.waitForTimeout(wait);
  if (after) await after(page);
  const file = path.join(DIR, name + ".png");
  const shotClip = typeof clip === "function" ? await clip(page) : clip;
  await page.screenshot({ path: file, clip: shotClip ?? undefined });
  const text = await page.locator("body").innerText();
  manifest.push({ name, url, viewport, note, textOk: L.noLetters(text), text: text.replace(/\s+/g, " ").slice(0, 120) });
  assert(L.noLetters(text), name + ": letters found in " + JSON.stringify(text));
  console.log("📸", name);
  await ctx.close();
}

const toolbarClip = async (page) => {
  const b = await page.locator("#toolbar").boundingBox();
  return { x: Math.max(0, b.x - 16), y: Math.max(0, b.y - 24), width: Math.min(b.width + 32, page.viewportSize().width), height: b.height + 40 };
};
const tileRowClip = (key) => async (page) => {
  const t = await page.locator(`#shop .tile[data-key="${key}"]`).boundingBox();
  const g = await page.locator("#shop").boundingBox();
  return { x: g.x, y: t.y - 14, width: g.width, height: t.height + 28 };
};
const openMarket = (tab, focus) => async (page) => {
  await L.openShop(page, tab);
  if (focus) await page.locator(`#shop .tile[data-key="${focus}"]`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
};

(async () => {
  const browser = await L.launch();
  try {
    await scene(browser, "01-fresh-start", "fresh=1&nosync=1&seed=5&time=9", { note: "first load: $1,000, one bed, hen and rooster" });
    await scene(browser, "02-toolbar-items", "fresh=1&nosync=1&seed=5&time=10", {
      setup: () => {
        const s = Garden.state();
        Object.assign(s.inv, { seed_tulip: 6, seed_cabbage: 4, seed_lavender: 3, feed_cow: 5, hay: 12, egg: 9, milk: 2, daisy: 7, cabbage: 3, kit_bed: 1 });
      },
      after: async (p) => L.tap(p, '.slot[data-key="seed_tulip"]'),
      clip: toolbarClip,
      note: "hotbar: tools, seeds, feed, hay, kit, goods with count badges; tulip seeds selected",
    });
    await scene(browser, "03-shop-buy", "fresh=1&nosync=1&seed=5&time=10", { after: openMarket("buy"), note: "market buy tab at start" });
    await scene(browser, "04-shop-sell", "fresh=1&nosync=1&seed=5&time=10", {
      setup: () => Object.assign(Garden.state().inv, { daisy: 6, tulip: 4, egg: 11, milk: 2, hay: 9, lavender: 3 }),
      after: openMarket("sell"),
      note: "market sell tab: unit price, drift arrows, sell-all",
    });
    await scene(browser, "05-locked-cows-horses", "fresh=1&nosync=1&seed=5&time=10", {
      after: openMarket("buy", "animal_cow_f"),
      clip: tileRowClip("animal_cow_f"),
      note: "cows and horses greyed with padlock + barn/stable icon",
    });
    await scene(browser, "06-unlocked-after-barn", "fresh=1&nosync=1&seed=5&time=10", {
      setup: () => {
        const s = Garden.state();
        s.inv.kit_barn = 1;
        Garden.Sim.place(s, "kit_barn", -17, 28);
        s.money = 2400;
        Garden.game.pump();
      },
      after: async (p) => {
        await p.waitForTimeout(2600);
        await openMarket("buy", "animal_cow_f")(p);
        await p.waitForTimeout(250);
      },
      clip: tileRowClip("animal_cow_f"),
      note: "after placing the barn: cow tiles unlocked (padlock pops), horses still locked",
    });
    await scene(browser, "07-unlock-flourish", "fresh=1&nosync=1&seed=5&time=10", {
      setup: () => {
        const s = Garden.state();
        s.inv.kit_barn = 1;
        s.ui.placing = { kit: "kit_barn", gx: -17, gy: 28 };
      },
      after: async (p) => {
        await p.waitForTimeout(1200);
        await L.tap(p, "#placement .ok");
        await p.waitForTimeout(650);
      },
      wait: 300,
      note: "level-up style flourish when the barn unlocks cows",
    });
    await scene(browser, "08-placement-valid", "fresh=1&nosync=1&seed=5&time=10", {
      after: async (p) => {
        await openMarket("buy", "kit_coop")(p);
        await L.tap(p, '#shop .tile[data-key="kit_coop"]');
        await p.waitForTimeout(900);
      },
      note: "coop ghost on a valid spot (green) over the zone grid",
    });
    await scene(browser, "09-placement-invalid", "fresh=1&nosync=1&seed=5&time=10", {
      after: async (p) => {
        await openMarket("buy", "kit_coop")(p);
        await L.tap(p, '#shop .tile[data-key="kit_coop"]');
        await p.waitForTimeout(500);
        const pond = await p.evaluate(() => Garden.screen(990, 630, 0));
        await p.mouse.move(pond.x, pond.y);
        await p.waitForTimeout(700);
      },
      note: "ghost over the pond (red), confirm button greyed",
    });
    await scene(browser, "10-crop-stages", "fresh=1&nosync=1&seed=5&time=10&close=90,660", {
      setup: () => {
        const s = Garden.state(),
          Sim = Garden.Sim;
        const stack = [];
        for (const [gx, gy] of [[0, 22], [0, 25], [0, 28]]) {
          s.inv.kit_bed = 1;
          stack.push(Sim.place(s, "kit_bed", gx, gy).id);
        }
        const crops = ["daisy", "tulip", "sunflower", "lavender", "cabbage", "wheat"];
        stack.forEach((id, bi) => s.beds.find((b) => b.id === id).plots.forEach((p, i) => Object.assign(p, { crop: crops[i], g: [0.15, 0.62, 1][bi], w: 120 })));
      },
      wait: 2200,
      note: "three beds, top to bottom: seedling, growing, ripe; columns are the six crops",
    });
    await scene(browser, "11-ripe-cue", "fresh=1&nosync=1&seed=5&time=10&close=380,610", {
      setup: () => Garden.state().beds[0].plots.forEach((p, i) => Object.assign(p, { crop: i % 2 ? "tulip" : "sunflower", g: 1, w: 0 })),
      wait: 2400,
      note: "ripe bed: golden sparkles, ripe bubble",
    });
    await scene(browser, "12-babies-vs-adults", "fresh=1&nosync=1&seed=5&time=10&close=610,760", {
      setup: () => {
        const s = Garden.state(),
          Sim = Garden.Sim;
        s.inv.kit_barn = 1;
        Sim.place(s, "kit_barn", -17, 28);
        s.inv.kit_stable = 1;
        Sim.place(s, "kit_stable", 44, 28);
        const at = (a, x, y) => Object.assign(a, { x, y });
        at(Sim.spawnAnimal(s, "chicken", "f", { age: 0.2 }), 560, 760);
        at(Sim.spawnAnimal(s, "chicken", "f", { age: 0.7 }), 595, 770);
        at(Sim.spawnAnimal(s, "chicken", "f", { age: 1 }), 630, 760);
        at(Sim.spawnAnimal(s, "cow", "f", { age: 0.2 }), 520, 820);
        at(Sim.spawnAnimal(s, "cow", "f", { age: 1 }), 560, 830);
        at(Sim.spawnAnimal(s, "horse", "f", { age: 0.25 }), 660, 820);
        at(Sim.spawnAnimal(s, "horse", "f", { age: 1 }), 720, 830);
        for (const a of s.animals) a.hunger = a.thirst = 0;
        Sim.drainEvents(s);
        // Hold them still for the comparison.
        Garden.game.setTimescale(0);
      },
      after: async (p) => {
        await p.evaluate(() => {
          for (const a of [...Garden.world.chickens, ...Garden.Farm.animals]) {
            const sim = Garden.state().animals.find((q) => q.id === a.simId);
            a.x = sim.x;
            a.y = sim.y;
            a.path = [];
            a.pause = 99;
            a.tx = a.x;
            a.ty = a.y;
            a.wait = 99;
          }
        });
        await p.waitForTimeout(700);
      },
      note: "chick (cube chick), half-grown chick, hen; calf vs cow; foal vs horse (scaled, lighter)",
    });
    const needy = (level) => [
      (level) => {
      const s = Garden.state(),
        Sim = Garden.Sim;
      const D = 600;
      const a = Sim.spawnAnimal(s, "chicken", "f", { age: 1 });
      Object.assign(a, { x: 600, y: 780 });
      if (level === "urgent") a.thirst = 220 + 1.15 * D;
      if (level === "sad") a.hunger = 240 + 1.7 * D;
      if (level === "dead") a.state = "dead";
      if (level === "bones") a.state = "bones";
      Sim.drainEvents(s);
      Garden.game.setTimescale(0);
      },
      level,
    ];
    await scene(browser, "13-urgent-bubble", "fresh=1&nosync=1&seed=5&time=10&close=600,780", { setup: needy("urgent"), wait: 1800, note: "urgent need: warm red pulsing bubble" });
    await scene(browser, "14-dying-animal", "fresh=1&nosync=1&seed=5&time=10&close=600,780", { setup: needy("sad"), wait: 1800, note: "sad: drooped, slowed, urgent bubble" });
    await scene(browser, "15-dead-animal", "fresh=1&nosync=1&seed=5&time=10&close=600,780", { setup: needy("dead"), wait: 2600, note: "dead: death clip held, muted colours, no bubble" });
    await scene(browser, "16-bones", "fresh=1&nosync=1&seed=5&time=10&close=600,780", { setup: needy("bones"), wait: 1800, note: "bones prop where the hen fell" });
    await scene(browser, "17-full-farm-golden-hour", "fresh=1&nosync=1&seed=5&time=17.7", { setup: FULL_FARM, wait: 2600, note: "thriving full farm, golden hour" });
    await scene(browser, "18-night-buildings-lit", "fresh=1&nosync=1&seed=5&time=22.5", { setup: FULL_FARM, wait: 2600, note: "night: cottage, coops lit; fireflies" });
    await scene(browser, "19-night-pastures-lit", "fresh=1&nosync=1&seed=5&time=22.5", {
      setup: FULL_FARM,
      after: async (p) => {
        await p.evaluate(() => (Garden.Farm.targetPan = -1100));
        await p.waitForTimeout(2200);
      },
      note: "night: both barns lit, herd sheltered",
    });
    await scene(browser, "20-full-farm-cows", "fresh=1&nosync=1&seed=5&time=16", {
      setup: FULL_FARM,
      after: async (p) => {
        await p.evaluate(() => (Garden.Farm.targetPan = -1150));
        await p.waitForTimeout(2600);
      },
      note: "cow pasture with two barns",
    });
    await scene(browser, "21-full-farm-horses", "fresh=1&nosync=1&seed=5&time=16", {
      setup: FULL_FARM,
      after: async (p) => {
        await p.evaluate(() => (Garden.Farm.targetPan = 1300));
        await p.waitForTimeout(2600);
      },
      note: "horse meadow with two stables",
    });
    for (const [label, viewport, mobile] of [
      ["mobile", { width: 390, height: 844 }, true],
      ["desktop", { width: 1440, height: 900 }, false],
    ]) {
      await scene(browser, `22-${label}-toolbar`, "fresh=1&nosync=1&seed=5&time=11", {
        viewport,
        mobile,
        setup: () => Object.assign(Garden.state().inv, { seed_tulip: 6, seed_lavender: 2, feed_cow: 5, hay: 8, egg: 12, milk: 3, tulip: 4 }),
        note: label + " " + viewport.width + "x" + viewport.height + " hotbar",
      });
      await scene(browser, `23-${label}-shop-buy`, "fresh=1&nosync=1&seed=5&time=11", { viewport, mobile, after: openMarket("buy"), note: label + " market buy" });
      await scene(browser, `24-${label}-shop-sell`, "fresh=1&nosync=1&seed=5&time=11", {
        viewport,
        mobile,
        setup: () => Object.assign(Garden.state().inv, { daisy: 6, tulip: 4, egg: 11, milk: 2, hay: 9 }),
        after: openMarket("sell"),
        note: label + " market sell",
      });
    }
    await scene(browser, "25-juice-coin-pop", "fresh=1&nosync=1&seed=5&time=11", {
      setup: () => Object.assign(Garden.state().inv, { egg: 12 }),
      after: async (p) => {
        await openMarket("sell")(p);
        await L.tap(p, '#shop .tile[data-key="egg"] .all');
        await p.waitForTimeout(260);
      },
      wait: 600,
      note: "coin pop flying to the money pill after selling eggs",
    });
    await scene(browser, "26-juice-harvest", "fresh=1&nosync=1&seed=5&time=11&close=380,610", {
      setup: () => Garden.state().beds[0].plots.forEach((p) => Object.assign(p, { crop: "lavender", g: 1, w: 50 })),
      after: async (p) => {
        await p.waitForTimeout(800);
        const b = await p.locator(".bubble.ripe button").boundingBox();
        await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        await p.waitForTimeout(280);
      },
      note: "harvest: sparkles burst, lavender icons fly to the hotbar",
    });
  } finally {
    await browser.close();
  }
  const errs = logs.flatMap((l) => l.errors.map((e) => l.label + ": " + e));
  const warns = logs.flatMap((l) => l.warnings.map((e) => l.label + ": " + e));
  const failed = logs.flatMap((l) => l.failed.map((e) => l.label + ": " + e));
  fs.writeFileSync(path.join(DIR, "manifest.json"), JSON.stringify({ manifest, errors: errs, warnings: warns, failed }, null, 2));
  assert(!errs.length && !warns.length && !failed.length, "console/network clean: " + JSON.stringify({ errs, warns, failed }));
  console.log(`Gate 4: ${manifest.length} screenshots, no letters, console clean -> ${DIR}`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
