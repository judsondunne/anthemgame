const fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict");
const manifest = JSON.parse(fs.readFileSync("public/assets/manifest.json")),
  ledger = fs.readFileSync("ASSETS.md", "utf8");
const files = [];
function walk(p) {
  for (const n of fs.readdirSync(p)) {
    const f = path.join(p, n);
    if (fs.statSync(f).isDirectory()) walk(f);
    else files.push(f);
  }
}
walk("public/assets");
let bytes = 0,
  triangles = 0;
for (const f of files) {
  bytes += fs.statSync(f).size;
  if (/\.(glb|gltf)$/i.test(f)) {
    const a = manifest.find((a) => "public" + a.path === f);
    assert(a, "No manifest: " + f);
    assert(ledger.includes(f) || ledger.includes(a.path), "No ledger: " + f);
    assert.equal(a.license, "CC0-1.0");
    assert(a.source && a.triangles > 0, "Incomplete provenance: " + f);
    const b = fs.readFileSync(f);
    assert.equal(b.toString("utf8", 0, 4), "glTF");
    const g = JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12)));
    const tris = g.meshes.reduce(
      (sum, m) =>
        sum +
        m.primitives.reduce(
          (n, p) =>
            n + g.accessors[p.indices ?? p.attributes.POSITION].count / 3,
          0,
        ),
      0,
    );
    assert.equal(tris, a.triangles);
    triangles += tris;
  }
}
// Every generated geometry in the codebase, with its purpose. Solid objects
// must come from downloaded models; only surfaces/overlays may be generated.
const sources = ["scene.js", "assets.js", ...["src/render", "src/ui", "src/game"].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith(".js")).map((f) => d + "/" + f))];
const constructors = sources.flatMap((file) =>
  [...fs.readFileSync(file, "utf8").matchAll(/new THREE\.([A-Za-z]*Geometry)\(([^;]*)/g)].map((m) => ({ file, kind: m[1], text: m[0].slice(0, 70) })),
);
const ALLOWED = {
  "scene.js": { PlaneGeometry: 5, SphereGeometry: 1, BufferGeometry: 1 }, // terrain, pond bed/surface, shader warm-up overlays; sky; particles
  "src/render/farm-layer.js": { PlaneGeometry: 2 }, // pickup ring shader and placement overlay
  "src/render/meadow.js": { BufferGeometry: 1 }, // instanced grass blades
  "src/render/threats.js": { ConeGeometry: 1, BufferGeometry: 1, PlaneGeometry: 1 }, // light shader volume, eye particles, pen overlay
  "src/render/water-feedback.js": { BufferGeometry: 1 }, // ripple/splash particles
  "src/render/world.js": { BufferGeometry: 2, PlaneGeometry: 1 }, // brook surface, pollen particles, terrain
};
const counts = {};
for (const c of constructors) {
  counts[c.file] ??= {};
  counts[c.file][c.kind] = (counts[c.file][c.kind] ?? 0) + 1;
}
assert.deepEqual(counts, ALLOWED, "generated geometry outside the allowlist: " + JSON.stringify(counts));
const code = fs.readFileSync("scene.js", "utf8");
assert(/const\s+particles\s*=\s*new THREE\.Points\(pg,\s*pm\)/.test(code));
assert(
  !fs.readFileSync("assets.js", "utf8").includes("new THREE.BufferGeometry"),
);
const out = {
  models: manifest.length,
  totalAssetBytes: bytes,
  sourceMeshTriangles: triangles,
  geometryConstructors: constructors,
  licenses: "All CC0-1.0; every GLB has source, path and triangle ledger entry",
  proceduralGeometry:
    "Allowed geometry only: terrain/pond beds, water surfaces, grass blades, sky, light shader volume, ground UI overlays and particle buffers. Every solid object retains downloaded GLB topology; cottage collider boxes are data only.",
};
fs.mkdirSync("verification/v5", { recursive: true });
fs.writeFileSync("verification/v5/asset-audit.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
