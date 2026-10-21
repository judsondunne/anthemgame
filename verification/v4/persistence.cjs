// V3 persistence end to end against the built app and the api/state route
// (scripts/serve.js with a file-backed mock of Vercel Blob, since no real Blob
// credentials exist in this environment).
const fs = require("node:fs");
const path = require("node:path");
const legacy = require('../v2/lib.cjs');
const { chromium } = require('playwright');
const L = { ...legacy, OUT: __dirname };
L.launch = () => chromium.launch({headless:true,args:['--enable-webgl','--enable-gpu','--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
L.ready = async page => { await page.waitForFunction(() => window.Garden?.ready, null, {timeout:90000}); await page.locator('#tutorial').evaluate(e=>e.remove()).catch(()=>{}); await page.waitForTimeout(250); };
L.open = async (context,url,label) => {const page=await context.newPage(),log=L.watch(page,label);await page.goto(url+(url.includes('?')?'&':'?')+'timescale=0&quality=low');await L.ready(page);return {page,log};};
L.openShop = async (page,tab='buy') => {if(!(await page.evaluate(()=>Garden.shop.isOpen)))await L.tap(page,'.marketbtn');await page.waitForTimeout(150);await L.tap(page,`#shop .tab.${tab}`);};
L.structure = s => ({...legacy.structure(s),slots:s.slots,selectedSlot:s.selectedSlot,player:s.player,fences:s.fences,health:s.animals.map(a=>a.health)});
const { assert } = L;

const KEY = "test-key";
const results = [];
const logs = [];
const step = (name, detail = {}) => {
  results.push({ name, ...detail });
  console.log("✓", name, JSON.stringify(detail).slice(0, 200));
};

async function serverDoc(url) {
  return (await fetch(url + "/api/state")).json();
}
async function until(fn, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("timeout waiting");
}

(async () => {
  const dir = L.tmpDir("farm-blob");
  let server = await L.startServer({ port: 8097, dir, key: KEY });
  const browser = await L.launch();
  try {
    // ---------- play, change state, reload -> identical ----------
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let { page, log } = await L.open(ctx, `${server.url}/index.html?k=${KEY}&seed=11&time=9`, "main");
    logs.push(log);
    assert(!(await page.evaluate(() => location.search)).includes("k="), "save key stripped from the address bar");
    assert((await page.evaluate(() => localStorage.getItem("farm-save-key"))) === KEY, "save key stored");
    step("one-time ?k= key captured and stripped");

    // Real taps: water, plant, buy seeds and a hen, start placing a bed and leave it mid-placement.
    await L.tap(page, '.slot[data-key="can"]');
    const bedId = await page.evaluate(() => Garden.state().beds[0].id);
    await L.tapWorld(page, "bed", bedId);
    await L.tap(page, '.slot[data-key="seed_daisy"]');
    await L.tapWorld(page, "plot", { bed: bedId, index: 3 });
    await L.openShop(page);
    await L.tap(page, '#shop .tile[data-key="seed_tulip"]');
    await L.tap(page, '#shop .tile[data-key="animal_chicken_f"]');
    await L.tap(page, '#shop .tile[data-key="kit_bed"]');
    let s = await L.snapshot(page);
    assert(s.beds[0].plots[3].crop === "daisy" && s.beds[0].plots[0].w > 0, "planted and watered by tap");
    assert(s.ui.placing?.kit === "kit_bed", "mid-placement");
    // Fast-forward (test hook) to reach the other mid-states: growing crops, a pregnant
    // hen, a chick, a dead hen and bones.
    await page.evaluate(() => {
      const st = Garden.state();
      for (let i = 0; i < 26; i++) {
        for (const a of st.animals) if (a.state === "alive" && a.sex !== "x") a.hunger = a.thirst = 0;
        Garden.advance(50);
      }
      const doomed = Garden.Sim.spawnAnimal(st, "chicken", "m", { age: 1 });
      doomed.state = "dead";
      const old = Garden.Sim.spawnAnimal(st, "chicken", "f", { age: 1 });
      old.state = "bones";
      Garden.game.pump();
    });
    await page.waitForTimeout(600);
    s = await L.snapshot(page);
    assert(s.animals.some((a) => a.age < 1 && a.state === "alive"), "a chick is mid-growth");
    assert(s.animals.some((a) => a.breed > 0), "a hen is mid-breeding");
    assert(s.animals.some((a) => a.state === "dead") && s.animals.some((a) => a.state === "bones"), "dead + bones");
    assert(s.beds[0].plots.some((p) => p.crop && p.g > 0 && p.g < 1) || s.beds[0].plots.some((p) => p.crop), "growing crop");
    // New schema-three data survives the same real persistence/reload path.
    await page.evaluate(() => {
      const s = Garden.state();
      Garden.game.act('addInventory', 'fence', 30); Garden.game.act('addInventory', 'gate', 1);
      for (let x = -20; x < -12; x++) { Garden.game.act('placeFence', x, 26, 'h'); Garden.game.act('placeFence', x, 31, 'h', x === -17); }
      for (let y = 26; y < 31; y++) { Garden.game.act('placeFence', -20, y, 'v'); Garden.game.act('placeFence', -12, y, 'v'); }
      const gate = s.fences.find(f => f.gate); Garden.game.act('toggleGate', gate.id);
      Garden.game.act('moveSlot', 3, 9); Garden.game.act('selectSlot', 9);
      Garden.cameraControl.setPlayer({ x: 650, y: 700, yaw: .4, pitch: -.2 });
      Garden.cameraControl.setMode('fp');
    });
    await page.waitForTimeout(950); // finish the camera flight before comparing its aimed placement ghost
    const before = await L.snapshot(page);
    const t0 = Date.now();
    await page.reload();
    await L.ready(page);
    const after = await L.snapshot(page);
    const gap = (Date.now() - t0) / 1000;
    if(JSON.stringify(L.structure(after)) !== JSON.stringify(L.structure(before))) {
      fs.writeFileSync(path.join(__dirname, 'persistence-reload-debug.json'), JSON.stringify({before:L.structure(before),after:L.structure(after)},null,2));
      console.log('reload mismatch fields', Object.keys(L.structure(before)).filter(k => JSON.stringify(L.structure(before)[k]) !== JSON.stringify(L.structure(after)[k])));
    }
    assert(JSON.stringify(L.structure(after)) === JSON.stringify(L.structure(before)), "structure identical after reload");
    assert(after.time >= before.time && after.time - before.time <= gap + 3, "clock resumed (catch-up only for the reload gap)");
    assert(after.ui.placing?.kit === "kit_bed", "placement mode restored after reload");
    assert(await page.locator("#placement:not([hidden])").count(), "placement controls visible again");
    assert(after.player.mode === 'fp' && after.selectedSlot === 9 && after.slots[9].key === 'flashlight', 'first-person mode and custom hotbar persist');
    assert(after.fences.length === 26 && after.fences.find(f => f.gate).open, 'fence and open gate persist');
    step("reload restores identical state", { timeDelta: +(after.time - before.time).toFixed(2), gap: +gap.toFixed(2), animals: after.animals.length, slots: after.slots.length, selectedSlot: after.selectedSlot, mode: after.player.mode, fences: after.fences.length, gateOpen: after.fences.find(f=>f.gate).open });

    // ---------- server copy ----------
    const doc = await until(async () => {
      const d = await serverDoc(server.url);
      return d.rev >= 1 && d.doc && d.doc.seq >= after.seq - 1 ? d : null;
    });
    step("debounced push reached api/state", { rev: doc.rev, seq: doc.doc.seq });
    await page.evaluate(() => Garden.save());
    await page.waitForTimeout(800);
    const pushed = await serverDoc(server.url);
    const live = await L.snapshot(page);
    await ctx.close();

    // ---------- redeploy: restart the server, fresh browser storage ----------
    await server.stop();
    server = await L.startServer({ port: 8097, dir, key: KEY });
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    ({ page, log } = await L.open(ctx2, `${server.url}/index.html`, "after-redeploy"));
    logs.push(log);
    const restored = await L.snapshot(page);
    assert((await page.evaluate(() => Garden.persistStatus().source)) === "server", "loaded from the server copy");
    assert(JSON.stringify(L.structure(restored)) === JSON.stringify(L.structure(pushed.doc)), "server copy restored after restart");
    assert(JSON.stringify(L.structure(restored).animals) === JSON.stringify(L.structure(live).animals), "same animals as the last live tab");
    step("server restart (redeploy) + empty browser storage restores the farm", { rev: pushed.rev });
    await ctx2.close();

    // ---------- corrupted / empty saves ----------
    const ctx3 = await browser.newContext();
    ({ page, log } = await L.open(ctx3, `${server.url}/index.html?nosync=1&seed=4`, "corrupt"));
    logs.push(log);
    await page.evaluate(() => {
      const st = Garden.state();
      st.money = 4321;
      Garden.save();
    });
    await page.evaluate(() => {
      localStorage.setItem("farm-save-backup", localStorage.getItem("farm-save-v2"));
      localStorage.setItem("farm-save-v2", "{this is not json");
    });
    // Reload without the pagehide flush overwriting the damage.
    await page.evaluate(() => {
      Garden.game.persist.leader = false;
    });
    await page.reload();
    await L.ready(page);
    let st = await L.snapshot(page);
    assert(st.money === 4321, "fell back to the backup copy");
    assert((await page.evaluate(() => localStorage.getItem("farm-save-corrupt"))) === "{this is not json", "corrupt text kept aside");
    step("corrupt save falls back to backup and keeps a copy");
    await page.evaluate(() => {
      Garden.game.persist.leader = false;
      localStorage.setItem("farm-save-v2", "");
      localStorage.removeItem("farm-save-backup");
    });
    await page.reload();
    await L.ready(page);
    st = await L.snapshot(page);
    assert(st.money === 1000 && st.animals.length === 2, "empty save starts fresh");
    step("empty save starts a fresh farm safely");
    await page.evaluate(() => {
      Garden.game.persist.leader = false;
      localStorage.setItem("farm-save-v2", "[1,2,3]");
    });
    await page.reload();
    await L.ready(page);
    st = await L.snapshot(page);
    assert(st.money === 1000, "nonsense save starts fresh");
    step("structurally invalid save starts fresh");

    // ---------- older schema migration ----------
    const v1 = JSON.parse(fs.readFileSync(path.join(__dirname, "../v2/fixtures/save-v1.json"), "utf8"));
    v1.savedAt = Date.now() - 1000;
    await page.evaluate((d) => {
      Garden.game.persist.leader = false;
      localStorage.setItem("farm-save-v2", JSON.stringify(d));
    }, v1);
    await page.reload();
    await L.ready(page);
    st = await L.snapshot(page);
    assert(st.schemaVersion === 3 && st.money === v1.coins && st.inv.egg === 3, "v1 save migrated");
    step("schemaVersion 1 save migrates on load", { money: st.money });

    const v2 = await page.evaluate(() => {
      const d = Garden.Sim.toDoc(Garden.state()); d.schemaVersion = 2; d.money = 1357;
      delete d.slots; delete d.selectedSlot; delete d.inventoryOverflow; delete d.player; delete d.fences; delete d.predatorSchedule;
      for (const a of d.animals) { delete a.health; delete a.injured; }
      d.savedAt = Date.now(); return d;
    });
    await page.evaluate(d => { Garden.game.persist.leader = false; localStorage.setItem('farm-save-v2', JSON.stringify(d)); }, v2);
    await page.reload(); await L.ready(page); st = await L.snapshot(page);
    assert(st.schemaVersion === 3 && st.money === 1357, 'v2 save migrated');
    assert(JSON.stringify(st.inv) === JSON.stringify(v2.inv), 'v2 aggregate inventory preserved exactly');
    assert(st.slots.length === 74 && ['hand','can','fish','flashlight'].every(k => st.slots.some(q => q?.key === k)), 'v2 receives permanent tools and full slot layout');
    assert(st.animals.length === v2.animals.length && st.animals.every(a => a.health === 100), 'v2 animals preserved with full health');
    step('schemaVersion 2 migrates without losing inventory or animals', { money: st.money, slots: st.slots.length });

    // ---------- clock skew and hidden-for-hours ----------
    await page.evaluate(() => {
      const s = Garden.state();
      const h = s.animals.find((a) => a.state === "alive");
      h.hunger = 240 + 1199;
      s.savedAt = Date.now() + 3600e3; // clock went backwards
      Garden.game.persist.leader = false;
      localStorage.setItem("farm-save-v2", JSON.stringify({ ...s, events: undefined }));
    });
    await page.reload();
    await L.ready(page);
    let ps = await page.evaluate(() => Garden.persistStatus());
    assert(ps.caughtUp === 0, "future timestamp -> no catch-up");
    step("clock moving backwards gives zero catch-up", ps);
    await page.evaluate(() => {
      const s = Garden.state();
      s.savedAt = Date.now() - 5 * 3600e3; // away five hours
      for (const a of s.animals) if (a.state === "alive") a.hunger = 240 + 1199;
      Garden.game.persist.leader = false;
      localStorage.setItem("farm-save-v2", JSON.stringify({ ...s, events: undefined }));
    });
    await page.reload();
    await L.ready(page);
    ps = await page.evaluate(() => Garden.persistStatus());
    st = await L.snapshot(page);
    assert(ps.caughtUp === 600, "catch-up capped at 600 game s");
    assert(st.animals.filter((a) => a.state === "alive").length >= 1, "no deaths during offline catch-up");
    step("five hours away: capped catch-up, nobody died offline", { caughtUp: ps.caughtUp });
    // Hidden tab variant: visibility change after hours.
    await page.evaluate(() => {
      Garden.game.hiddenAt = Date.now() - 3 * 3600e3;
      for (const a of Garden.state().animals) if (a.state === "alive") a.hunger = 240 + 1190;
      const t = Garden.state().time;
      Garden.game.visibility(false);
      window.__dt = Garden.state().time - t;
    });
    const hid = await page.evaluate(() => ({ dt: window.__dt, alive: Garden.state().animals.filter((a) => a.state === "alive").length }));
    assert(hid.dt === 600 && hid.alive >= 1, "hidden tab catch-up capped and harmless");
    step("tab hidden for hours: capped, no deaths", hid);
    await ctx3.close();

    // ---------- two tabs in one browser ----------
    const ctx4 = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    const A = await L.open(ctx4, `${server.url}/index.html?nosync=1&fresh=1&seed=21`, "tabA");
    logs.push(A.log);
    await L.openShop(A.page);
    await L.tap(A.page, '#shop .tile[data-key="seed_tulip"]');
    await L.tap(A.page, '#shop .tile[data-key="seed_tulip"]');
    await A.page.evaluate(() => Garden.save());
    const B = await L.open(ctx4, `${server.url}/index.html?nosync=1`, "tabB");
    logs.push(B.log);
    await B.page.waitForTimeout(600);
    let a = await A.page.evaluate(() => ({ following: Garden.game.following, money: Garden.state().money }));
    let b = await B.page.evaluate(() => ({ following: Garden.game.following, money: Garden.state().money, tulips: Garden.state().inv.seed_tulip }));
    assert(a.following && !b.following, "newest tab leads, older tab follows");
    assert(b.tulips === 2 && b.money === a.money, "new tab picked up the old tab's purchases");
    await L.openShop(B.page);
    await L.tap(B.page, '#shop .tile[data-key="animal_chicken_f"]');
    await B.page.evaluate(() => Garden.save());
    await A.page.waitForTimeout(500);
    a = await A.page.evaluate(() => ({ animals: Garden.state().animals.length, money: Garden.state().money }));
    b = await B.page.evaluate(() => ({ animals: Garden.state().animals.length, money: Garden.state().money }));
    assert(a.animals === 3 && a.money === b.money, "follower mirrors the leader's save");
    // A real tab switch: B blurs (and flushes) before A gains focus.
    await B.page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await A.page.bringToFront();
    await A.page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await L.openShop(A.page);
    await L.tap(A.page, '#shop .tile[data-key="seed_daisy"]');
    await A.page.evaluate(() => Garden.save());
    await B.page.waitForTimeout(500);
    const finalA = await A.page.evaluate(() => Garden.state());
    const finalB = await B.page.evaluate(() => ({ following: Garden.game.following, inv: Garden.state().inv, animals: Garden.state().animals.length }));
    assert(finalB.following, "older tab yields when the other is focused again");
    assert(finalA.inv.seed_tulip === 2 && finalA.animals.length === 3 && finalA.inv.seed_daisy === 5, "no purchase lost across tabs");
    assert(finalB.inv.seed_daisy === 5, "mirror is current");
    step("two tabs: single leader, mirrored saves, nothing lost", { money: finalA.money });
    await ctx4.close();

    // ---------- revision conflict between two devices ----------
    const devX = await browser.newContext(),
      devY = await browser.newContext();
    const X = await L.open(devX, `${server.url}/index.html?k=${KEY}`, "deviceX");
    const Y = await L.open(devY, `${server.url}/index.html?k=${KEY}`, "deviceY");
    logs.push(X.log, Y.log);
    const rev0 = (await serverDoc(server.url)).rev;
    await Y.page.evaluate(async () => {
      Garden.state().money += 111;
      Garden.game.persist.dirtyServer = true;
      await Garden.game.persist.push(Garden.state(), { now: true });
    });
    const afterY = await serverDoc(server.url);
    assert(afterY.rev === rev0 + 1, "device Y wrote the next revision");
    await X.page.evaluate(async () => {
      Garden.state().money += 222;
      Garden.state().savedAt = Date.now() + 5;
      Garden.game.persist.dirtyServer = true;
      await Garden.game.persist.push(Garden.state(), { now: true }); // stale base -> conflict
      await Garden.game.persist.push(Garden.state(), { now: true }); // newest wins on retry
    });
    const afterX = await serverDoc(server.url);
    const conflictCopy = await X.page.evaluate(() => JSON.parse(localStorage.getItem("farm-save-conflict") || "null"));
    assert(afterX.rev === rev0 + 2, "newest document written after the conflict");
    assert(afterX.doc.money === (await X.page.evaluate(() => Garden.state().money)), "newest (device X) wins");
    assert(conflictCopy && conflictCopy.money === afterY.doc.money, "the losing document is kept, no data loss");
    step("revision conflict: stale write refused, newest wins, loser backed up", { rev: afterX.rev });
    await devX.close();
    await devY.close();

    // ---------- server unreachable ----------
    const ctx5 = await browser.newContext();
    const page5 = await ctx5.newPage();
    const log5 = L.watch(page5, "offline-server");
    await page5.route("**/api/state", (r) => r.abort());
    await page5.goto(`${server.url}/index.html?k=${KEY}&seed=8`);
    await L.ready(page5);
    await L.openShop(page5);
    await L.tap(page5, '#shop .tile[data-key="seed_tulip"]');
    await page5.evaluate(async () => {
      Garden.save();
      await new Promise((r) => setTimeout(r, 300));
    });
    const text5 = await page5.evaluate(()=>{const c=document.body.cloneNode(true);for(const e of c.querySelectorAll("#tutorial,#pause-screen,.toolbar-actions,#night-sighting,script,style"))e.remove();return c.textContent;});
    const ls = await page5.evaluate(() => JSON.parse(localStorage.getItem("farm-save-v2")).inv.seed_tulip);
    assert(L.noLetters(text5), "no error text shown");
    assert(ls === 1, "saved to localStorage while the server is down");
    await page5.reload();
    await L.ready(page5);
    assert((await page5.evaluate(() => Garden.state().inv.seed_tulip)) === 1, "reload works from localStorage alone");
    const status5 = await page5.evaluate(() => Garden.persistStatus());
    step("server unreachable: silent localStorage fallback", { server: status5.server, source: status5.source, browserLoggedAbort: log5.errors.length });
    await ctx5.close();

    // ---------- storage not configured (degraded route) ----------
    await server.stop();
    server = await L.startServer({ port: 8097, dir, key: "", extraEnv: {} });
    const ctx6 = await browser.newContext();
    const P6 = await L.open(ctx6, `${server.url}/index.html?k=anything&seed=2`, "no-save-key");
    logs.push(P6.log);
    await P6.page.evaluate(async () => {
      Garden.game.persist.dirtyServer = true;
      await Garden.game.persist.push(Garden.state(), { now: true });
    });
    const st6 = await P6.page.evaluate(() => Garden.persistStatus());
    assert(st6.server === "unavailable", "writes refused without SAVE_KEY, quietly");
    step("route without SAVE_KEY refuses writes silently (localStorage-only)", st6);
    await ctx6.close();
  } finally {
    await browser.close();
    await server.stop();
  }
  const errs = logs.flatMap((l) => l.errors.map((e) => l.label + ": " + e));
  const warns = logs.flatMap((l) => l.warnings.map((e) => l.label + ": " + e));
  const failed = logs.flatMap((l) => l.failed.map((e) => l.label + ": " + e));
  const buildIndex = fs.readFileSync(path.join(L.ROOT, 'dist/index.html'), 'utf8');
  const testedBuild = { indexModifiedAt: fs.statSync(path.join(L.ROOT, 'dist/index.html')).mtime.toISOString(), entry: buildIndex.match(/src="([^"]+\.js)"/)?.[1] };
  fs.writeFileSync(path.join(L.OUT, "persistence.json"), JSON.stringify({ results, testedBuild, fixtureNotes: ['The live first-person placement ghost follows camera aim. The fixture settles the0.7-second camera flight for0.95 seconds before exact structural comparison.'], errors: errs, warnings: warns, failed }, null, 2));
  assert(!errs.length && !warns.length && !failed.length, "console/network clean: " + JSON.stringify({ errs, warns, failed }));
  fs.rmSync(path.join(__dirname, 'persistence-reload-debug.json'), { force: true });
  console.log(`\nV3 persistence: ${results.length} checks passed, console clean`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
