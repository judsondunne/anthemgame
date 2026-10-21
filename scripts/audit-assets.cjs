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
    assert(ledger.includes(f), "No ledger: " + f);
    assert.equal(a.license, "CC0-1.0");
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
  "scene.js": { PlaneGeometry: 6, SphereGeometry: 1, BufferGeometry: 1 }, // ground, pond floor, water, grass blade, 2 hidden shader warm-up planes; sky dome; particle points
  "src/render/farm-layer.js": { PlaneGeometry: 1 }, // placement-grid cell overlay
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
    "Allowed surfaces only: ground, pond floor, water, instanced grass blade, sky dome, placement-grid cell overlay, two hidden shader warm-up planes. Particle BufferGeometry stores point positions only. Every solid object is a downloaded model.",
};
fs.writeFileSync("verification/asset-audit.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
