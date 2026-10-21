// Phase 8 edge cases that need the real interface (the rest are unit tests).
const fs = require("node:fs");
const path = require("node:path");
const L = require("./lib.cjs");
const { assert } = L;

const BASE = process.env.FARM_URL || "http://127.0.0.1:8095";
const results = [];
const logs = [];
const ok = (name, detail = {}) => {
  results.push({ name, ...detail });
  console.log("✓", name, JSON.stringify(detail).slice(0, 160));
};

(async () => {
  const browser = await L.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const { page, log } = await L.open(ctx, `${BASE}/index.html?fresh=1&nosync=1&seed=6&time=9`, "edge");
    // (closed explicitly before the phone section)
    logs.push(log);
    const S = () => L.snapshot(page);

    // Rapid-tap spam on a buy tile: never overspends, counts stay exact.
    await page.evaluate(() => (Garden.state().money = 37));
    await L.openShop(page, "buy");
    const tile = await page.locator('#shop .tile[data-key="seed_tulip"]').boundingBox();
    for (let i = 0; i < 25; i++) await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2, { delay: 0 });
    await page.waitForTimeout(300);
    let s = await S();
    assert(s.money === 37 - 12 * 3 && s.inv.seed_tulip === 12, "spam bought exactly what money allowed: " + JSON.stringify({ m: s.money, t: s.inv.seed_tulip }));
    assert(s.money >= 0, "money never negative");
    ok("rapid-tap spam on a buy tile", { money: s.money, tulips: s.inv.seed_tulip });

    // Exactly enough money.
    await page.evaluate(() => (Garden.state().money = 60));
    await L.tap(page, '#shop .tile[data-key="animal_chicken_f"]');
    s = await S();
    assert(s.money === 0 && s.animals.filter((a) => a.sp === "chicken").length === 3, "exactly enough buys the hen");
    await L.tap(page, '#shop .tile[data-key="animal_chicken_f"]');
    s = await S();
    assert(s.money === 0 && (await page.locator('#shop .tile[data-key="animal_chicken_f"].poor').count()), "now unaffordable: dimmed, refused");
    ok("buying with exactly enough money; then dimmed + refused");

    // Selling zero: nothing sellable shows the empty basket, nothing changes.
    await page.evaluate(() => {
      const st = Garden.state();
      for (const k of Object.keys(st.inv)) if (Garden.Sim.GOODS.includes(k)) delete st.inv[k];
      st.animals = st.animals.filter((a) => a.age < 1);
    });
    await L.openShop(page, "sell");
    assert(await page.locator("#shop .empty").count(), "empty sell tab");
    ok("sell tab with nothing to sell shows an empty basket");

    // Stack limit: a full stack blocks the tile (greyed) and refuses the buy.
    await page.evaluate(() => {
      Garden.state().money = 500;
      Garden.state().inv.seed_daisy = 99;
    });
    await L.openShop(page, "buy");
    await page.waitForTimeout(250);
    await L.tap(page, '#shop .tile[data-key="seed_daisy"]');
    s = await S();
    assert(s.inv.seed_daisy === 99 && s.money === 500, "stack limit holds");
    assert(await page.locator('#shop .tile[data-key="seed_daisy"].blocked').count(), "full stack greyed");
    ok("stack limit 99 blocks the purchase");
    await L.closeShop(page);

    // Placement: invalid spots are refused; a phone rotation mid-placement keeps the ghost.
    await page.evaluate(() => (Garden.state().money = 1000));
    await L.openShop(page, "buy");
    await L.tap(page, '#shop .tile[data-key="kit_bed"]');
    await page.waitForTimeout(400);
    const pond = await page.evaluate(() => Garden.screen(990, 630, 0));
    await page.mouse.click(pond.x, pond.y);
    await page.waitForTimeout(250);
    assert(!(await page.evaluate(() => Garden.farmLayer.ghostValid)), "ghost over the pond is invalid");
    await L.tap(page, "#placement .ok");
    s = await S();
    assert(s.beds.length === 1 && s.ui.placing && s.inv.kit_bed === 1, "invalid confirm refused, kit kept");
    const house = await page.evaluate(() => Garden.screen(640, 450, 0));
    await page.mouse.click(house.x, house.y);
    await page.waitForTimeout(200);
    assert(!(await page.evaluate(() => Garden.farmLayer.ghostValid)), "overlapping the cottage is invalid");
    await page.evaluate(() => {
      const p = Garden.state().ui.placing;
      p.gx = -200; // far out of bounds
    });
    await page.waitForTimeout(150);
    assert(!(await page.evaluate(() => Garden.farmLayer.ghostValid)), "out of bounds is invalid");
    ok("placement refuses pond, cottage and out-of-bounds cells");
    const spot = await page.evaluate(() => Garden.Sim.layout.bestSpot(Garden.state(), "bed", { x: 900, y: 800 }));
    await page.evaluate((sp) => Object.assign(Garden.state().ui.placing, sp), { gx: spot.gx, gy: spot.gy });
    await page.setViewportSize({ width: 390, height: 844 }); // rotate to portrait mid-placement
    await page.waitForTimeout(600);
    s = await S();
    assert(s.ui.placing.gx === spot.gx && s.ui.placing.gy === spot.gy, "ghost keeps its cell through the rotation");
    assert(await page.locator("#placement:not([hidden])").count(), "controls still shown in portrait");
    await L.tap(page, "#placement .ok");
    s = await S();
    assert(s.beds.length === 2 && !s.ui.placing, "confirmed after rotating");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    ok("rotating the phone mid-placement keeps the ghost; confirm works");

    // Feeding a full animal wastes nothing; feeding the dead is refused.
    await page.evaluate(() => {
      const st = Garden.state();
      st.money += 60;
      const r = Garden.Sim.buy(st, "animal_chicken_f");
      const hen = st.animals.find((q) => q.id === r.id);
      Object.assign(hen, { x: 620, y: 760 });
      st.inv.feed_chicken = 6;
      for (const a of st.animals) a.hunger = a.thirst = 0;
      Garden.game.pump();
      Garden.game.setTimescale(0);
    });
    await page.waitForTimeout(700);
    const hen = (await S()).animals.find((a) => a.sp === "chicken" && a.state === "alive" && a.age >= 1);
    await L.tap(page, '.slot[data-key="feed_chicken"]');
    await L.tapWorld(page, "animal", hen.id);
    s = await S();
    assert(s.inv.feed_chicken === 6, "no feed used on a full hen");
    const shook = await page.evaluate((id) => Garden.bridge.agentOf(id).shake > 0, hen.id);
    assert(shook, "she shakes her head instead");
    await page.evaluate((id) => {
      const a = Garden.state().animals.find((q) => q.id === id);
      a.state = "dead";
    }, hen.id);
    await page.waitForTimeout(400);
    await L.tapWorld(page, "animal", hen.id);
    s = await S();
    assert(s.inv.feed_chicken === 6, "no feed used on the dead");
    ok("feeding a full or dead animal consumes nothing");

    // A hungry cow standing on her own milk: hay feeds the cow, the hand takes the milk.
    const cowId = await page.evaluate(() => {
      const st = Garden.state();
      if (Garden.clock().night) Garden.setHour(9); // herds shelter at night
      st.inv.kit_barn = 1;
      if (!Garden.Sim.place(st, "kit_barn", -17, 28).ok) return null;
      st.money += 300;
      const r = Garden.Sim.buy(st, "animal_cow_f");
      const cow = st.animals.find((q) => q.id === r.id);
      cow.hunger = Garden.Sim.BALANCE.species.cow.hungryAfter + 10;
      st.inv.hay = 3;
      Garden.game.pump();
      Garden.Farm.targetPan = Garden.Farm.pan = cow.x - 700;
      return cow.id;
    });
    assert(cowId, "barn placed and a cow bought");
    await page.waitForTimeout(900);
    const onMilk = async () => {
      // Drop the carton where she stands right now and aim at her body.
      const r = await page.evaluate((id) => {
        const st = Garden.state(),
          ag = Garden.bridge.agentOf(id);
        st.pickups = st.pickups.filter((q) => q.kind !== "milk");
        st.pickups.push({ id: Garden.Sim.newId(st), kind: "milk", x: ag.x, y: ag.y, t: st.time });
        return Garden.anchor("animal", id);
      }, cowId);
      await page.waitForTimeout(120); // the carton is drawn before the tap
      return page.evaluate((id) => Garden.anchor("animal", id), cowId) ?? r;
    };
    await L.tap(page, '.slot[data-key="hay"]');
    await L.tapAt(page, await onMilk());
    s = await S();
    assert(s.animals.find((a) => a.id === cowId).hunger < 5 && s.inv.hay === 2, "hay tap on the cow fed her");
    assert(s.pickups.some((q) => q.kind === "milk"), "the milk under her was left alone");
    await L.tap(page, '.slot[data-key="hand"]');
    const milkBefore = s.inv.milk ?? 0;
    await L.tapAt(page, await onMilk());
    s = await S();
    assert((s.inv.milk ?? 0) === milkBefore + 1 && !s.pickups.some((q) => q.kind === "milk"), "hand tap collected the milk");
    ok("tool decides between an animal and the pickup under her");

    // Animal cap: the tile shows full housing and refuses.
    await page.evaluate(() => {
      const st = Garden.state();
      st.money = 10000;
      while (Garden.Sim.buy(st, "animal_chicken_f").ok);
    });
    await L.openShop(page, "buy");
    await page.waitForTimeout(250);
    const cap = await page.locator('#shop .tile[data-key="animal_chicken_f"] .c').innerText();
    const before = (await S()).money;
    await L.tap(page, '#shop .tile[data-key="animal_chicken_f"]');
    assert((await S()).money === before, "full housing refuses the purchase");
    assert(/^(\d+)\/\1$/.test(cap), "capacity numerals show a full coop: " + cap);
    assert(await page.locator('#shop .tile[data-key="animal_chicken_f"].blocked').count(), "tile greyed");
    ok("housing cap: n/n numerals, greyed, refused", { cap });
    assert(L.noLetters(await page.locator("body").innerText()), "no letters");
    await ctx.close();

    // Phone: the core loop with real touchscreen taps at 390x844.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const P = await L.open(phone, `${BASE}/index.html?fresh=1&nosync=1&seed=6&time=9`, "phone");
    logs.push(P.log);
    const T = { touch: true };
    const tp = P.page;
    const bed = await tp.evaluate(() => Garden.state().beds[0].id);
    await L.tap(tp, '.slot[data-key="can"]', T);
    await L.tapWorld(tp, "bed", bed, T);
    await L.tap(tp, '.slot[data-key="seed_daisy"]', T);
    await L.tapWorld(tp, "plot", { bed, index: 3 }, T);
    let ps = await L.snapshot(tp);
    assert(ps.beds[0].plots[0].w > 0 && ps.beds[0].plots[3].crop === "daisy", "touch: watered and planted");
    await tp.evaluate(() => Garden.advance(60));
    await tp.waitForTimeout(600);
    await L.tap(tp, '.slot[data-key="hand"]', T);
    const bb = await tp.locator(".bubble.ripe button").boundingBox();
    await tp.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await tp.waitForTimeout(300);
    ps = await L.snapshot(tp);
    assert(ps.inv.daisy >= 3, "touch: harvested from the ripe bubble");
    await L.tap(tp, ".shopbtn", T);
    await tp.waitForTimeout(400);
    await L.tap(tp, "#shop .tab.sell", T);
    await L.tap(tp, '#shop .tile[data-key="daisy"] .all', T);
    await L.tap(tp, "#shop .tab.buy", T);
    await L.tap(tp, '#shop .tile[data-key="kit_bed"]', T);
    await tp.waitForTimeout(600);
    ps = await L.snapshot(tp);
    assert(!ps.inv.daisy && ps.money > 900 && ps.ui.placing?.kit === "kit_bed", "touch: sold, bought a bed kit, placing");
    await L.tap(tp, "#placement .ok", T);
    ps = await L.snapshot(tp);
    assert(ps.beds.length === 2 && !ps.ui.placing, "touch: bed placed with the check button");
    assert(L.noLetters(await tp.locator("body").innerText()), "no letters on the phone");
    ok("phone 390x844 touch loop: water, plant, harvest, sell, buy, place");
    await phone.close();
  } finally {
    await browser.close();
  }
  const errs = logs.flatMap((l) => l.errors),
    warns = logs.flatMap((l) => l.warnings),
    failed = logs.flatMap((l) => l.failed);
  fs.writeFileSync(path.join(L.OUT, "edge.json"), JSON.stringify({ results, errors: errs, warnings: warns, failed }, null, 2));
  assert(!errs.length && !warns.length && !failed.length, "console clean " + JSON.stringify({ errs, warns, failed }));
  console.log(`Edge cases (UI): ${results.length} passed, console clean`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
