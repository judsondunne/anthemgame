# Three.js garden verification

Status: visual review and automated gates passed for the hardware-backed desktop and emulated-phone browser targets. Forced-software performance and physical-phone certification have explicit environment limitations, detailed below. All failed polish passes and subsequent corrections remain recorded.

## Preflight and sources

GitHub LICENSE and Kenney Nature page/ZIP downloads succeeded; npm Three.js install succeeded. Work branch: `codex/three-garden-rebuild`. Original game preserved in phase-0 commit `ba062d3` and retained in the working tree during replacement verification. Primary source family is Kenney Nature/Fantasy Town/Cube Pets/Food (CC0); only adult chickens and horses use Quaternius (CC0). All model files and triangle counts are in ASSETS.md; original Kenney licenses are included. Final shipped assets total approximately 1.42 MB before HTTP compression.

## Contact sheet

`contact-sheet.png` was rendered and personally inspected. The first attempt found missing external palette textures and a height-normalization error affecting flat decking/rocks. Those were fixed before accepting the corrected sheet. The selected palette, faceting and model detail are compatible; Quaternius birds have more rounded faces, intentionally retained for recognizable hens. Model rows follow the manifest, nine models per row. The final production sheet rotates each model into a 3/4 view so architectural surfaces are visible; assembled architecture is also reviewed in house close-ups.

## Polish pass 1 — all eleven captures inspected

Folder: `pass1/`. Noon, morning, sunset, dusk, deep night, needs, chickens, pond, house, mobile and desktop were captured and visually reviewed.

The camera reads as a real elevated 3D scene and the hen models are recognizable. Problems: grass had a rectangular density boundary and was too tall/dense; fish sat above the surface; the porch canopy hid the cottage windows/door; mobile framing showed huge distant rock shapes and too much empty lawn. Night's point light was too bright and the pond too luminous. A Three.js version mismatch emitted a soft-shadow deprecation warning. Therefore this pass failed.

Changes: use pinned Three.js 0.180, soften the density distribution, shorten blades, cut the pond ground hole and move fish below the surface over a lower floor, raise the house walls and narrow the porch canopy, reduce/further distance background rocks, tighten framing, reduce smoke and lantern brightness, recolor downloaded texture palettes to sage/cream/soft timber.

## Polish pass 2 — all eleven captures inspected

Folder: `pass2/`. All eleven captures personally inspected. Console/network checks were clean. The cottage front now reads clearly, shadow direction follows sunlight, fish are submerged and the hard grass rectangle is gone. Three icon bubbles are visible without letters. The requested view and actual downloaded geometry are consistent throughout. Morning capture was blank because first shader compilation consumed the fade duration before the first frame; this is a real failed gate. House close-up also cropped the roof, and mobile could use a tighter garden framing. Night was readable but window panes needed warm emissive light and pond brightness required more restraint.

Changes: precompile/render a real frame before setting ready/fade state, widen house close-up, tighten portrait framing again, add dusk-driven glass emissive shading and real window PointLights, add warm light particles, reduce night water brightness, add animated floor caustics, reuse a vector for logical coordinate conversion. Audio begins locally on a trusted gesture; optional streaming/local playlists remain available through keyboard controls.

## Polish pass 3

All eleven captures completed and personally reviewed; findings and final corrections follow.

## Third-pass findings and final polish

All eleven `pass3/` images were personally inspected. Morning was no longer blank, the roof fit the house close-up, hens were clearly recognizable, pond fish sat beneath the water, and portrait framing preserved the garden. One remaining issue was visible at night: the first glass-emission color mask also lit blue-gray wall panels. Final correction adds a per-vertex material mask to the downloaded window meshes, limiting emission to the actual glass region without altering topology. The point lights still illuminate adjacent walls naturally. Static batching combines 776 original downloaded mesh instances by shared material. Final particles distinguish butterflies, hearts, water drops and moon dreams rather than drawing every effect as a dot.

The final eleven images are in `final/` and were each opened and personally reviewed after these corrections. The original canvas implementation was then removed and the verified replacement became `index.html`. The complete original remains in the phase-0 Git commit.

## Final screenshot-by-screenshot art review

“Family” means every solid scene object is a downloaded model from the documented primary/secondary sources, recolored to the shared palette. “House” means a charming Victorian-influenced storybook cottage with a gabled roof, porch, bay-window kitbash, timber trim and chimney; it is an explicitly documented approximation, not a historical reproduction. Blank regions mean unintended empty/black rendering, not intentional open meadow. Shadows are checked against that screenshot's sun direction.

| Screenshot | 45° view | Model family | House | Cute chickens | Sun/shadows | Water | Night/readability | Defect check |
|---|---|---|---|---|---|---|---|---|
| final/morning.png (07:00) | Convincing raised view | Coherent downloaded family | Gable/porch grounded | Hens visible | Long morning shadows, correct direction | Fish visible under surface | Day scene, readable | No blank frame, text, acne, floating props or clipping |
| final/noon.png (12:00) | Consistent orthographic 3D | Same family | House in frame | Recognizable flock | Shorter soft shadows | Muted turquoise, lilies and bank grounded | Day scene, readable | No z-fighting, blown highlights or text |
| final/sunset.png (18:00) | Convincing | Same family | Warm cottage materials | Flock readable | Long warm shadows follow sun | Warm reflection/ripples | Golden hour readable | No flat black region, clipping or wrong scale |
| final/dusk.png (19:30) | Convincing | Same family | Warm porch/panes on | Flock still readable | Sun fading consistently | Subtle surface remains readable | Lantern visibly on | No whole-wall emissive error, blown light or text |
| final/night.png (23:00) | Convincing | Same family | Warm lamps balance cool moonlight | Returning hens near coop | Moonlit shapes, sun off | Quiet blue water, fish discernible | Beautiful cool/warm contrast; garden readable | No black canvas, glare, text or floating objects |
| final/needs.png | Convincing | Same family | Same cottage | Chicken need is clearly anchored | Noon shadows consistent | Pond feed bubble anchored | Day, readable | Exactly 3 icon-only bubbles; no text or awkward overlap |
| final/chickens.png | Convincing close-up | Downloaded Quaternius hens match palette | Contextual coop edge only | Comb, beak, plump bodies read as cute hens | Contact shadows grounded | Pond outside focus | Day, readable | Four color variants; no geometry clipping or z-fighting |
| final/pond.png | Convincing close-up | Downloaded rocks/lilies/fish | Outside focus | Peripheral hens only | Bank/nearby tree shadows consistent | Submerged fish, soft edge, ripples and caustics | Day, readable | Fish no longer float above surface; no seam or text |
| final/house.png | Convincing close-up | Downloaded kitbash only | Porch/bay/gable/trim/chimney visible | Peripheral flock/bee scale consistent | Roof/contact shadows plausible | Outside focus | Day, readable | Entire roof fits; supports meet deck; no roof z-fighting |
| final/mobile.png (390×844,18:00) | View preserved | Same family | Cottage and coop visible | Small but identifiable and tappable | Long warm shadows | Full pond visible | Portrait garden readable | No giant rock intrusion, text, black region or clipped garden core |
| final/desktop.png (1440×900,12:00) | View preserved | Same family | Framed and grounded | Full flock visible | Noon soft shadows | Full pond and bank visible | Desktop readable | No text, scale anomaly, floating props or blank canvas |

The pastel palette intentionally stays restrained. The garden is a stylized low-poly scene; the cottage is not a bespoke Victorian architectural model, and the pond fish are a stylized fish asset rather than anatomically accurate koi. Flying silhouettes reuse a downloaded bird rather than literal geese. Those asset compromises were disclosed during sourcing and do not involve hand-modeled geometry.

## Programmatic gates and measured evidence

- `checks-3d.json`: mouse and real touch events fulfilled chicken affection, pond feeding and flower watering; need counts changed 3→2→1→0, plant target growth 1→1.18, fish feeding target became active, and Web Audio was running after the trusted gesture. Real downloaded animal meshes were picked through the canvas as well.
- `checks-3d.json`: lantern was zero at noon and greater than 1 at 20:00. Canvas backing sizes matched 1440×900 at DPR 1 and 390×844 at DPR 2. Both contexts had **zero page errors, console warnings/errors, failed requests or HTTP errors**, including care interactions.
- `extended.json`: one chick, one calf and one foal were born; a contextual trough click increased feed; all seven hens reached their sleeping state and all eight herd animals sheltered; morning woke all seven hens and released all eight herd animals. Resize to 768×1024 succeeded. Rendered overlay text-node count was zero. No page errors.
- `asset-audit.json`: **43 shipped GLBs**, **1,418,607 total asset bytes**, **10,957 source mesh triangles** before reuse. Every GLB has a source/license/path/triangle ledger entry. Source audit confirms only ground plane, pond-floor plane, water plane, grass blade and sky dome generated surface geometry; the remaining BufferGeometry is a particle-point buffer. Every solid prop, plant, animal and building component is loaded from a downloaded model. Unused source-pack reserves were removed.
- `final/diagnostics.json`: all eleven final scenarios have empty body text, no console errors/warnings and no failed network requests. Each image was opened and visually inspected; the set was recaptured after the final pasture tree placement correction.
- `production.json` and `production.png`: built production distribution loaded all assets successfully, rendered the WebGL garden and three icon bubbles, had empty body text and zero browser errors/warnings or failed requests. `npm run build` succeeds. Vite has a bundle-size advisory for the 588 kB Three.js vendor chunk (approximately 150 kB gzipped); this is a build-size advisory, not a browser runtime warning.

Performance was sampled after warmup for **10.5 seconds per target**, using headless Chrome with hardware-backed WebGL:

| Target | Mean frame | P95 frame | CPU update/render | Samples | Quality |
|---|---:|---:|---:|---:|---|
| Desktop 1440×900, DPR 1 | 16.666 ms (~60 fps) | 16.8 ms | 2.49 ms | 630 | High, 28,000 blades |
| Phone viewport 390×844, touch, DPR 2 | 16.666 ms (~60 fps) | 16.7 ms | 2.09 ms | 630 | High, 28,000 blades |

The final batching pass combines **770 original static meshes** (the earlier pass combined 776, before removal of unused old scenery initialization changed seeded decorative placement). Steady-state draw calls were 326 desktop / 321 phone viewport, including shadow and post-processing passes. Shared source geometry/materials and SkeletonUtils clones are retained for animated assets. Logical coordinate conversion reuses a vector; grass/particle attributes are persistent buffers.

Automatic fallback was verified by **actual 20× CPU throttling**, not by calling a test setter: it switched to low quality, 8,500 blades, DPR 1, 1024-pixel shadows and disabled bloom. The stressed-window mean was 28.15 ms, with 83.2 ms P95 while throttling remained active. This stressed sample is evidence of the trigger, not a performance promise under artificial throttling. `fallback.png` was visually inspected.

## Explicit environment limits

The phone result is a **touch/DPR/viewport emulation on this Mac**, not a measurement on physical mobile hardware. Physical-phone 30+ fps cannot be certified in this environment.

The explicitly forced ANGLE/SwiftShader launch rendered a nonblank, correct garden (`swiftshader.png`, personally inspected). It was substantially slower than the hardware-backed run: the short low-quality sample averaged about **850 ms/frame including a 5.9-second startup stall**, as recorded in `checks-3d.json`. Software rasterization throughput therefore does **not** meet the performance target on this host; the hardware-backed headless Chromium targets do. No claim of 60 fps on SwiftShader or an actual phone is made.

Optional YouTube streaming is still available via R and the existing engine, and private local music via L. Normal verified interactions use the existing local audio engine and do not depend on third-party network playback. Remote streaming availability is outside this deterministic local test.

## Reproduce

1. `npm install`
2. `npm run dev -- --port 8082` (keep running)
3. `npm run verify`
4. `node verification/capture.cjs verification/final`
5. `node verification/extended.cjs`
6. `node scripts/audit-assets.cjs`
7. `npm run build` and `npm run preview`

Tests use the locally installed Chrome through Playwright. `GARDEN_URL` can override the main verification URL. The screenshot/extended scripts use port 8082. No test hook renders text or modifies normal care logic.
