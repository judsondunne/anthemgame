// Shared Playwright helpers for the v2 verification gates.
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "verification/v2");
// Headless Chromium with WebGL enabled; SwiftShader allowed as the software fallback.
const ARGS = ["--enable-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

async function launch(extra = {}) {
  return chromium.launch({ channel: "chromium", headless: true, args: [...ARGS, ...(extra.args ?? [])] });
}

function watch(page, label = "") {
  const log = { label, errors: [], warnings: [], failed: [] };
  page.on("pageerror", (e) => log.errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") log.errors.push(m.text());
    if (m.type() === "warning") log.warnings.push(m.text());
  });
  page.on("requestfailed", (r) => log.failed.push(r.url() + " " + r.failure()?.errorText));
  page.on("response", (r) => {
    if (r.status() >= 400) log.failed.push(r.status() + " " + r.url());
  });
  return log;
}

async function ready(page, timeout = 90000) {
  await page.waitForFunction(() => window.Garden?.ready, null, { timeout });
  await page.waitForTimeout(400);
}

async function open(context, url, label) {
  const page = await context.newPage();
  const log = watch(page, label);
  await page.goto(url);
  await ready(page);
  return { page, log };
}

async function tap(page, selector, { touch = false } = {}) {
  const l = page.locator(selector).first();
  await l.scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);
  const b = await l.boundingBox();
  if (!b) throw Error("not visible: " + selector);
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(90);
}

async function tapAt(page, p, { touch = false } = {}) {
  if (!p) throw Error("no anchor");
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(90);
}

// Tap a world entity by its projected screen anchor.
async function tapWorld(page, kind, id, opts) {
  const p = await page.evaluate(([k, i]) => Garden.anchor(k, i), [kind, id]);
  await tapAt(page, p, opts);
  return p;
}

// Open the market on a given tab (the market button toggles).
async function openShop(page, tab = "buy") {
  if (!(await page.evaluate(() => Garden.shop.isOpen))) await tap(page, ".shopbtn");
  await page.waitForTimeout(250);
  await tap(page, `#shop .tab.${tab}`);
  await page.waitForTimeout(150);
}
async function closeShop(page) {
  if (await page.evaluate(() => Garden.shop.isOpen)) await tap(page, "#shop .close");
  await page.waitForTimeout(250);
}

const snapshot = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Garden.state())));

// Structural view of a save for equality checks (continuous timers excluded).
function structure(s) {
  return {
    money: s.money,
    inv: s.inv,
    beds: s.beds.map((b) => ({ id: b.id, gx: b.gx, gy: b.gy, crops: b.plots.map((p) => p.crop) })),
    buildings: s.buildings,
    animals: s.animals.map((a) => ({ id: a.id, sp: a.sp, sex: a.sex, state: a.state, adult: a.age >= 1 })),
    pickups: s.pickups.length,
    placing: s.ui.placing,
    celebrated: s.celebrated,
    nextId: s.nextId,
  };
}

function startServer({ port, dir, key = "test-key", extraEnv = {} }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(ROOT, "scripts/serve.js")], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), MOCK_BLOB_DIR: dir, SAVE_KEY: key, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let done = false;
    proc.stdout.on("data", (d) => {
      if (!done && String(d).includes("farm server")) {
        done = true;
        resolve({ proc, url: `http://127.0.0.1:${port}`, stop: () => new Promise((r) => (proc.once("exit", r), proc.kill())) });
      }
    });
    proc.stderr.on("data", (d) => process.stderr.write(d));
    proc.once("exit", (c) => !done && reject(Error("server exited " + c)));
  });
}

const tmpDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), name + "-"));
const noLetters = (text) => !/\p{L}/u.test(text);

function assert(cond, msg) {
  if (!cond) throw Error("ASSERT: " + msg);
}

module.exports = { launch, watch, ready, open, tap, tapAt, tapWorld, openShop, closeShop, snapshot, structure, startServer, tmpDir, noLetters, assert, OUT, ROOT, ARGS };
