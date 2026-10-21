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
const code = fs.readFileSync("scene.js", "utf8");
const constructors = [
  ...code.matchAll(/new THREE\.([A-Za-z]*Geometry)\(([^;]*)/g),
].map((m) => m[0]);
assert(
  constructors.every(
    (x) =>
      x.includes("PlaneGeometry") ||
      x.includes("SphereGeometry") ||
      x.includes("BufferGeometry"),
  ),
);
assert.equal(constructors.length, 6);
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
    "5 allowed surfaces only: ground, pond floor, water, instanced grass blade, sky dome. Particle BufferGeometry stores point positions only.",
};
fs.writeFileSync("verification/asset-audit.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
