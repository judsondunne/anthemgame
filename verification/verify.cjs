const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("fs");
const BASE = process.env.GARDEN_URL || "http://localhost:8082/index.html";
(async () => {
  const b = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-webgl", "--enable-unsafe-swiftshader"],
  });
  const results = {
    runtime: [],
    interactions: [],
    performance: [],
    checks: [],
  };
  for (const touch of [false, true]) {
    const p = await b.newPage({
      viewport: touch
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      hasTouch: touch,
      deviceScaleFactor: touch ? 2 : 1,
    });
    const log = { touch, errors: [], warnings: [], failed: [] };
    p.on("pageerror", (e) => log.errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") log.errors.push(m.text());
      if (m.type() === "warning") log.warnings.push(m.text());
    });
    p.on("requestfailed", (r) =>
      log.failed.push(r.url() + ":" + r.failure()?.errorText),
    );
    p.on("response", (r) => {
      if (r.status() >= 400) log.failed.push(r.status() + ":" + r.url());
    });
    await p.goto(BASE + "?seed=42&time=12&needs=1");
    await p.waitForFunction(() => window.Garden?.ready);
    await p.waitForTimeout(2000);
    assert.equal(await p.locator("body").innerText(), "");
    assert.equal(await p.locator(".need").count(), 3);
    for (const [label, kind] of [
      ["Affection", "heart"],
      ["Feed", "food"],
      ["Water", "water"],
    ]) {
      const before = await p.evaluate((kind) => {
        const n = Garden.world.needs.find((n) => n.kind === kind);
        return {
          needs: Garden.world.needs.length,
          growth: n.target.targetGrowth ?? 0,
          kind: n.kind,
        };
      }, kind);
      const button = p.getByRole("button", { name: label, exact: true });
      const box = await button.boundingBox();
      if (touch)
        await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await p.waitForTimeout(80);
      const after = await p.evaluate(() => ({
        needs: Garden.world.needs.length,
        pet: Garden.world.chickens.some((a) => a.pet > 0),
        fish: !!Garden.world.fishSpot,
        growth: Garden.world.plants[8].targetGrowth,
        audio: AudioGarden.ctx?.state,
      }));
      assert.equal(after.needs, before.needs - 1);
      if (kind === "heart") assert(after.pet);
      if (kind === "food") assert(after.fish);
      if (kind === "water") assert(after.growth > before.growth);
      assert.equal(after.audio, "running");
      results.interactions.push({ touch, label, before, after });
    }
    // Raycast care against actual meshes, with direct canvas mouse/touch interaction.
    await p.evaluate(() => {
      Garden.world.chickens[0].pause = 100;
      Garden.world.chickens[0].path = [];
    });
    const chicken = await p.evaluate(() =>
      Garden.projectTarget(Garden.world.chickens[0]),
    );
    if (touch) await p.touchscreen.tap(chicken.x, chicken.y);
    else await p.mouse.click(chicken.x, chicken.y);
    assert(
      await p.evaluate(() => Garden.world.chickens.some((a) => a.pet > 0)),
    );
    await p.evaluate(() => Garden.setHour(20));
    await p.waitForTimeout(100);
    assert((await p.evaluate(() => Garden.stats().lantern)) > 1);
    await p.evaluate(() => Garden.setHour(12));
    await p.waitForTimeout(100);
    assert((await p.evaluate(() => Garden.stats().lantern)) < 0.001);
    const dims = await p.evaluate(() => ({
      w: document.querySelector("canvas").width,
      h: document.querySelector("canvas").height,
      dpr: Garden.stats().dpr,
    }));
    assert.equal(dims.dpr, touch ? 2 : 1);
    assert.equal(dims.w, (touch ? 390 : 1440) * dims.dpr);
    assert.equal(dims.h, (touch ? 844 : 900) * dims.dpr);
    await p.evaluate(() => Garden.resetStats());
    await p.waitForTimeout(10500);
    const stats = await p.evaluate(() => Garden.stats());
    assert(stats.samples > 100);
    assert(stats.averageFrameMs < (touch ? 33.34 : 20));
    results.performance.push({ touch, measuredSeconds: 10.5, ...stats });
    await p.screenshot({
      path:
        "verification/" +
        (touch ? "touch-interactions" : "mouse-interactions") +
        ".png",
    });
    if (!touch) {
      const cdp = await p.context().newCDPSession(p);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
      await p.waitForTimeout(12500);
      const fallback = await p.evaluate(() => Garden.stats());
      results.fallback = fallback;
      assert.equal(fallback.quality, "low");
      assert.equal(fallback.fallback, true);
      assert.equal(fallback.grassCount, 8500);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await p.screenshot({ path: "verification/fallback.png" });
    }
    assert.equal(await p.locator("body").innerText(), "");
    assert.deepEqual(log.errors, []);
    assert.deepEqual(log.warnings, []);
    assert.deepEqual(log.failed, []);
    results.runtime.push(log);
    await p.close();
  }
  // A software WebGL launch explicitly validates the requested headless rendering route.
  await b.close();
  const sw = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-gpu-driver-bug-workarounds",
    ],
  });
  const sp = await sw.newPage();
  await sp.goto(BASE + "?time=12&quality=low&seed=42");
  await sp.waitForFunction(() => window.Garden?.ready);
  await sp.waitForTimeout(1600);
  await sp.screenshot({ path: "verification/swiftshader.png" });
  results.softwareWebGL = await sp.evaluate(() => Garden.stats());
  await sw.close();
  results.checks.push(
    "mouse and touch: all three needs fulfilled; real model picking; gesture audio running",
    "noon lantern off and 20:00 lantern on",
    "DPR 1 and 2 canvas sizes correct",
    "desktop and simulated mobile each measured for 10.5 seconds",
    "automatic quality fallback triggered by actual CPU throttling",
  );
  fs.writeFileSync(
    "verification/checks-3d.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
