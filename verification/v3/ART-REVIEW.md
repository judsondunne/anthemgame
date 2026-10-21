# Chicken and forest art review

The diagnostic viewer uses the game's Three.js version, ACES exposure 1.15,
2.0-strength warm hemisphere and 3.2-strength warm directional sunlight, real
PCF shadows, and the same asset normalizer/material palette. The top row is
normal animal viewing scale; the bottom row is a close-up. Candidate order in
`chicken-candidates.png`, left to right:

1. Current Quaternius 2022 chicken (2,904 triangles): appealing face, but almost no readable body or legs.
2. Quaternius 2023 chicken (2,140 triangles): clear comb, wattle and feet with idle/run/peck/death clips, but a rigid rectangular voxel body.
3. Matching Quaternius 2023 chick (1,924 triangles): coherent with candidate 2, similarly rectangular.
4. Pixor rounded chicken (652 triangles): a distinct rounded breast, neck, separate wings, tail, black eyes, yellow feet and a red comb/wattle. This is the selection.
5. Current Kenney Cube Pets chick (490 triangles): appealing baby face but box-shaped and a different family.

Three newly downloaded candidates were compared beside both current adult and
baby. All were downloaded without login; exact sources/CC0 provenance are in
ASSETS.md and public/assets/licenses/v3-provenance.json.

`chicken-variants.png` shows the selected hen in cream, russet, charcoal and buff,
then its matching yellow chick and the larger russet rooster with sage wings/
tail and a fuller comb. The baby reuses the downloaded rig and hides the comb;
no new solid geometry is generated. `chicken-poses.png` shows idle, walking,
pecking, sleeping and dead poses using the actual animal renderer.

The selected model has a single original Peck clip. Walking uses its existing
leg bones with alternating motion; sleep compresses the body; collapse rotates
the original model into a held side pose. This is an explicit animation
compromise, preferred to the much less appealing voxel model with more clips.

## Two world polish passes

Pass 1 (`brook-art-pass1.png`, `world-art-pass1.png`) found readable species and
banks/crossing, but excessive draw calls from separate trunk/leaf primitives,
and a foreground trunk clipped the brook review framing. The water looked too
sparkly at long distance.

Pass 2 (`brook-art-pass2.png`, `world-art-pass2.png`) bakes the downloaded source
material colors into their existing mesh vertices and merges each source asset
before instancing it in chunks. Source topology remains unchanged. Canopies
have a dedicated per-vertex wind mask; distant forest uses simpler downloaded
oak/pine models. A more useful brook camera shows the crossing and winding
shoreline. The final world has 1,139 seeded trees plus seeded bushes, fern-like
plants, mushrooms, logs and rocks on all sides of the flat property. Two small
clearings and an eastbound path break up the forest.

The brook uses an animated strip shader with directional waves, two flow
frequencies, shore foam, six whitewater zones, depth/sky color and daylight
sparkles. The stream bed has gentle continuous elevation steps; downloaded bank
stones surround the bends and a downloaded wood bridge is the sole deep-water
crossing. Terrain, brook and particle geometry are allowed surface/effect
geometry; every solid object remains a downloaded mesh. Caustics are a stylized
surface color impression, not a physically simulated underwater light field.

The forest-only hardware sample at 1440×900 measured 16.67 ms mean / 16.8 ms p95
with 72 draw calls and 118,948 triangles. At 390×844, low quality and 4× CPU
slowdown it measured 16.67 ms mean / 16.8 ms p95, 43 calls and 85,680 triangles.
These are an Apple M2 Pro Metal/Chrome headless sample, not real mobile hardware
and not the full farm. Full integration performance is measured separately.

Commands: run Vite on port 5175, then `node verification/v3/capture-art.cjs`,
`node verification/v3/chicken-poses.cjs`, `node verification/v3/world-performance.cjs`.
The first chicken/world screenshots also completed under software SwiftShader;
final pose and performance captures use Metal. Both console logs are clean.

## Final reference-driven asset pass

The later direct request made asset fidelity the main priority. The first forest metrics above describe an earlier simpler asset set, not the delivered full game. The final game now uses 21 additional downloaded textured KayKit/Quaternius foliage, rock and ground-cover assets, with real alpha-cutout boughs, preserved gradient atlases, mixed silhouettes, wind and distance LOD. These are in `forest-upgrade.json`, `firs-upgrade.json` and `botany-upgrade.json`. `REPORT.md` and `full-farm/performance.json` supersede the earlier forest-only measurements.

Final comparisons inspected the original `verification/production.png` and v2 `pass1/17-full-farm-golden-hour.png` / `02-toolbar-items.png` against the new farm, brook, interior and backpack captures. The new conifers have layered branches rather than polygon stacks; leafy trees have visible crowns and branches. The property still reads as the same muted green garden. The cozy coop has a warm open interior and sleeping birds. The sun/moon are small, realistic-scale shader discs; clouds are shaded procedural layers, not photographic assets. The brook foam is readable but remains stylized and the bear gait remains an animation compromise. No claim of exact proprietary reference parity is made.
