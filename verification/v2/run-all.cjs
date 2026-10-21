// Runs every verification gate in order against a fresh production build.
//   npm run build && npm run e2e
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const L = require("./lib.cjs");

const run = (label, args, env = {}) => {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, args, { cwd: L.ROOT, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`✗ ${label} failed`);
    process.exit(r.status ?? 1);
  }
};

(async () => {
  run("Gate 1: unit + sim + server + balance tests", ["--test", ...require("node:fs").readdirSync(path.join(L.ROOT, "tests")).filter((f) => f.endsWith(".test.js")).map((f) => "tests/" + f)]);
  run("Gate 2: persistence", ["verification/v2/persistence.cjs"]); // starts and restarts its own server
  const server = await L.startServer({ port: 8095, dir: L.tmpDir("farm-e2e"), key: "test-key" });
  try {
    const env = { FARM_URL: server.url };
    run("Gate 3: full playthrough", ["verification/v2/playthrough.cjs"], env);
    run("Phase 8: interface edge cases", ["verification/v2/edge.cjs"], env);
    run("Gate 4: screenshots", ["verification/v2/screens.cjs", process.env.SHOTS || "final"], env);
    run("Gate 5: quality, frame rate, regression", ["verification/v2/quality.cjs"], env);
  } finally {
    await server.stop();
  }
  console.log("\nAll gates passed.");
})();
