// Gate 5: no letters anywhere, console/network clean, frame timing with a full
// farm, and a visual regression comparison against the previous build's
// verification/final screenshots.
const fs = require("node:fs");
const path = require("node:path");
const L = require("./lib.cjs");
const { assert } = L;

const BASE = process.env.FARM_URL || "http://127.0.0.1:8095";
const DIR = path.join(L.OUT, "quality");
fs.mkdirSync(DIR, { recursive: true });
const report = { text: [], perf: [], regression: [], logs: [] };

const FULL_FARM = fs.readFileSync(path.join(__dirname, "screens.cjs"), "utf8").match(/const FULL_FARM = (\(\) => \{[\s\S]*?\n\});/)[1];

async function textChecks(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, log } = await L.open(ctx, `${BASE}/index.html?fresh=1&nosync=1&seed=3&time=9`, "text");
  report.logs.push(log);
  const check = async (label) => {
    const t = await page.locator("body").innerText();
    report.text.push({ label, ok: L.noLetters(t), sample: t.replace(/\s+/g, " ").slice(0, 80) });
    assert(L.noLetters(t), label + " shows letters: " + t);
  };
  await check("fresh");
  await page.evaluate(`(${FULL_FARM})()`);
  await page.waitForTimeout(800);
  await check("full farm");
  await L.openShop(page, "buy");
  await check("market buy");
  await L.openShop(page, "sell");
  await check("market sell");
  await L.closeShop(page);
  await L.openShop(page, "buy");
  await L.tap(page, '#shop .tile[data-key="kit_bed"]');
  await page.waitForTimeout(400);
  await check("placement mode");
  await L.tap(page, "#placement .no");
  await page.evaluate(() => {
    for (const a of Garden.state().animals) a.hunger = 2000;
    Garden.setHour(22);
  });
  await page.waitForTimeout(900);
  await check("night with urgent bubbles");
  // A sixty-second soak at high time scale: births, deaths, eggs, nights.
  await page.evaluate(() => Garden.timescale(120));
  await page.waitForTimeout(60000);
  await check("after soak");
  const s = await L.snapshot(page);
  report.soak = { gameSeconds: Math.round(s.time), animals: s.animals.length, dead: s.animals.filter((a) => a.state !== "alive").length };
  await ctx.close();
}

async function perf(browser, label, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const { page, log } = await L.open(ctx, `${BASE}/index.html?fresh=1&nosync=1&seed=3&time=16`, "perf-" + label);
  report.logs.push(log);
  await page.evaluate(`(${FULL_FARM})()`);
  await page.waitForTimeout(4000); // warm-up: every model and shader in view
  await page.evaluate(() => Garden.resetStats());
  await page.waitForTimeout(10500);
  const st = await page.evaluate(() => Garden.stats());
  await page.screenshot({ path: path.join(DIR, `perf-${label}.png`) });
  report.perf.push({ label, viewport, dpr: mobile ? 2 : 1, ...st, fps: +(1000 / st.averageFrameMs).toFixed(1) });
  console.log("⏱", label, JSON.stringify({ avg: st.averageFrameMs.toFixed(2), p95: st.p95FrameMs?.toFixed(2), cpu: st.cpuRenderMs.toFixed(2), draws: st.drawCalls, tris: st.triangles, quality: st.quality, animals: st.animals, gl: st.webgl }));
  await ctx.close();
  return st;
}

async function regression(browser) {
  const prev = path.join(L.ROOT, "verification/final");
  const regions = {
    house: [560, 30, 330, 320],
    pond: [810, 380, 310, 190],
    trees: [240, 80, 140, 200],
    lawn: [40, 560, 220, 200],
  };
  for (const [name, hour] of [
    ["morning", 7],
    ["noon", 12],
    ["sunset", 18],
    ["dusk", 19.5],
    ["night", 23],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, log } = await L.open(ctx, `${BASE}/index.html?fresh=1&nosync=1&seed=42&time=${hour}&timescale=0`, "regress-" + name);
    report.logs.push(log);
    // Hide the new interface so only the world is compared.
    await page.addStyleTag({ content: "#hud,#toolbar,#needs{visibility:hidden}" });
    await page.waitForTimeout(1800);
    const cur = path.join(DIR, `now-${name}.png`);
    await page.screenshot({ path: cur });
    const a = "data:image/png;base64," + fs.readFileSync(path.join(prev, name + ".png")).toString("base64");
    const b = "data:image/png;base64," + fs.readFileSync(cur).toString("base64");
    const cmp = await page.evaluate(
      async ([a, b, regions]) => {
        const load = (src) => new Promise((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = src;
        });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const W = ia.width,
          H = ia.height;
        const data = (img) => {
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0, W, H);
          return g.getImageData(0, 0, W, H).data;
        };
        const da = data(ia),
          db = data(ib);
        const stats = (x0, y0, w, h) => {
          let sum = 0,
            lum = [0, 0],
            n = 0;
          for (let y = y0; y < y0 + h; y++)
            for (let x = x0; x < x0 + w; x++) {
              const i = (y * W + x) * 4;
              const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
              sum += d / 3;
              lum[0] += 0.3 * da[i] + 0.59 * da[i + 1] + 0.11 * da[i + 2];
              lum[1] += 0.3 * db[i] + 0.59 * db[i + 1] + 0.11 * db[i + 2];
              n++;
            }
          return { meanAbsDiff: +(sum / n).toFixed(2), lumBefore: +(lum[0] / n).toFixed(1), lumNow: +(lum[1] / n).toFixed(1) };
        };
        const out = { whole: stats(0, 0, W, H) };
        for (const [k, r] of Object.entries(regions)) out[k] = stats(...r);
        // Side-by-side composite for eyeballing.
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H / 2;
        const g = c.getContext("2d");
        g.drawImage(ia, 0, 0, W / 2, H / 2);
        g.drawImage(ib, W / 2, 0, W / 2, H / 2);
        out.composite = c.toDataURL("image/png");
        return out;
      },
      [a, b, regions],
    );
    fs.writeFileSync(path.join(DIR, `compare-${name}.png`), Buffer.from(cmp.composite.split(",")[1], "base64"));
    delete cmp.composite;
    report.regression.push({ name, hour, ...cmp });
    console.log("🔍", name, JSON.stringify(cmp));
    await ctx.close();
  }
}

(async () => {
  const browser = await L.launch();
  if (process.env.ONLY === "regression") {
    await regression(browser);
    await browser.close();
    fs.writeFileSync(path.join(DIR, "regression.json"), JSON.stringify(report.regression, null, 2));
    return console.log("regression only: done");
  }
  try {
    await textChecks(browser);
    const desk = await perf(browser, "desktop-1440x900", { width: 1440, height: 900 }, false);
    const mob = await perf(browser, "mobile-390x844", { width: 390, height: 844 }, true);
    report.perfVerdict = { desktop60: desk.averageFrameMs <= 17.2, mobile30: mob.averageFrameMs <= 33.4 };
    await regression(browser);
  } finally {
    await browser.close();
  }
  // Reference only: the same farm on forced software rasterisation.
  const sw = await require("playwright").chromium.launch({ channel: "chromium", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    const st = await perf(sw, "forced-swiftshader-1440x900", { width: 1440, height: 900 }, false);
    report.swiftshader = { averageFrameMs: st.averageFrameMs, fps: +(1000 / st.averageFrameMs).toFixed(1), quality: st.quality, webgl: st.webgl };
  } finally {
    await sw.close();
  }
  const errs = report.logs.flatMap((l) => l.errors.map((e) => l.label + ": " + e));
  const warns = report.logs.flatMap((l) => l.warnings.map((e) => l.label + ": " + e));
  const failed = report.logs.flatMap((l) => l.failed.map((e) => l.label + ": " + e));
  report.console = { errors: errs, warnings: warns, failed };
  delete report.logs;
  fs.writeFileSync(path.join(DIR, "quality.json"), JSON.stringify(report, null, 2));
  assert(!errs.length && !warns.length && !failed.length, "console/network clean: " + JSON.stringify(report.console));
  assert(report.perfVerdict.desktop60 && report.perfVerdict.mobile30, "frame-rate targets: " + JSON.stringify(report.perf.map((p) => [p.label, p.averageFrameMs])));
  console.log("Gate 5 quality:", JSON.stringify({ text: report.text.length, perf: report.perfVerdict, swiftshaderFps: report.swiftshader.fps }));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
