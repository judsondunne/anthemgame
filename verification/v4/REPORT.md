# First-person controls, animals and world fidelity follow-up

21 October 2026 · branch `codex/living-world-nightfall`.

## Direct feedback addressed

- Wolves now appear naturally on a chicken-only farm, after 40 seconds of night. The old cow/horse ownership gate was the reason the starter farm had no visits. A small God-view sighting button focuses the actual wolf. Sheltered chickens stay protected; wolf packs distribute among exposed animals instead of all attacking one animal.
- Escape opens a clear **Game paused** screen. Farm time, animals, encounters and camera movement freeze. Escape/Resume returns to play; losing native pointer lock also pauses. Opening inventory/market deliberately releases the pointer without triggering pause.
- E opens inventory, M opens market, Q toggles God view / first person; each is visibly labeled. Left-click/touch performs the aimed interaction. I/Tab remain inventory aliases. A permanent outlined center reticle remains visible. The later direct correction explicitly removed all interaction wording beneath it.
- Double-tap W or Shift sprints. Releasing W stops the double-tap sprint latch; pointer release clears movement immediately.
- All building kits automatically switch to God view for placement. Q returns to the preserved first-person position.
- Aim assistance expands the screen-space target and the reach to 4.5m. A real off-center click more than 45 pixels from a plot's center plants the selected seed; empty/occupied plots still obey the sim rules.

## Animals

Old saves or newly solid props could contain hens inside blocked ground. They now recover to the nearest clear position without crossing fences. Daytime clears yesterday's coop-entry flag, and a local route takes called birds around the coop and nearby pots. A three-day regression includes newly bred chicks and verifies sleeping, leaving and roaming on every day. Both movement and separation still check buildings, fences, water and body radii.

Housing maps are cached by building and living-animal membership; local path searches cache cell passability and retry at bounded intervals. This fixes the corner case without doing a large path search every frame. Offline catch-up retains its no-danger/no-neglect rules.

## Visual changes and inspected polish passes

**Pass 1** (`held-*.png`, `pause.png`): the new large physical props were readable, but the seed bag was sideways/untextured, foliage edges needed smoothing, and distant high-detail trees increased rendering cost. Fixed the external bag texture, portrait orientation, soft paper printing with the existing illustrated crop icons, and lens/body material treatment. The first seed print was mirrored and its SVG lacked an XML namespace; both were caught visually and corrected.

**Pass 2** (`01-held-*`, `02-pause`, `03-aim-assist`, `04-barn-god-placement`, `05-natural-wolf-night`, `06-roaming-hens`, and the full-farm set): personally reviewed the actual new architecture, 3D seed/feed pouches, aqua enamel watering can, flashlight, permanent reticle, pause card, natural wolf visit and hens outside. The interaction caption is absent. Held props have independent soft key/rim lighting which darkens with the world at night; they stay sharply rendered without intersecting scenery.

The cottage now uses Quaternius's 4,012-triangle tiled/timber building body, plus downloaded Kenney porch/windows/lantern modules. Barns and stables use the 1,612-triangle Quaternius barn body with real plank edges, framing and curved roof geometry, in muted red/sage variants. Their gameplay anchors and housing/build grids are preserved; the cottage's back collider covers its new physical depth. Main source/license records are in `ASSETS.md` and `public/assets/licenses/architecture-upgrade.json`.

Grass is rebuilt as curved, tapered, differently oriented six-blade tufts, with root/tip color and wind, instead of flat rectangular strips. Building clearances are applied once to instance transforms rather than tested 24 times in every vertex shader invocation. FXAA smooths the scene at high quality; low quality retains the canvas antialiasing path.

Distant forest meshes use the **same downloaded tree geometry, UVs, maps and silhouette** as nearby trees. There is no replacement with the crude old pine/oak models. Bark and alpha-cutout foliage share one geometry draw with separate texture samplers; custom depth/distance materials preserve those leaf cutouts in shadows. This is batching, not a reduction in tree detail. Fog, chunk visibility and shadow range still bound cost.

This remains a stylized garden, not a literal recreation of Grand Mountain Adventure's proprietary assets or shaders. The new physical building/tile detail and consistent foliage directly address the repeated request about asset quality, while preserving the garden palette and interface.

## Evidence

`feedback.json`: direct actual-key/click checks cover pause/freeze/resume, E/M/Q, center reticle/no caption, double-tap sprint, large 3D models, generous off-center planting, automatic God-view barn placement, natural wolf spawning and approach through actual forest colliders, and legacy-hen recovery/roaming. Runtime errors/warnings/failed requests must all be empty.

`unit-results.txt`, `camera-unit-results.txt`, `focused-tests.txt`, `balance-tests.txt`: simulation, migration, care, collision, multi-day coop routing, exact dawn boundaries, pause controller, progression and defense gates. The dawn modulo now snaps floating-point values at the cycle boundary so a fractional accumulation cannot remain night at exactly dawn.

The adapted v4 browser suites retain the v3 interaction, camera, fence, inventory, night, persistence, mobile and software checks. Assertions about no letters explicitly exempt the newly requested control labels, pause card and wolf sighting; they still reject unexpected error words elsewhere. E interaction and direct FP building placement assertions were changed to the user's requested left-click and God-view placement semantics. Historical v3 evidence is preserved.

## Environment limits

Native pointer lock is rejected by headless Chromium. The camera suite faithfully emulates the lock element, sends mouse deltas, tests lock loss, and records the limitation. Native capture still needs an interactive browser check. SwiftShader is separately exercised with its driver warnings retained; it is not used for hardware FPS claims. Normal hardware suites use the pinned Playwright Chromium shell with ANGLE Metal on M2 Pro. The throttled mobile profile is a simulation, not a physical-phone measurement.

## Run

`npm run dev` for local play, `npm run verify` for the sequential v4 verification runner. No new save schema or Vercel variables are needed; existing schema-three saves remain compatible.

## Final results

93/93 unit/simulation/server/balance tests pass; the eight camera unit checks were also rerun after the last input change. The direct-feedback browser suite passes 28 checks with zero errors, warnings or failed requests. The click playthrough passes 32 checks; the coop/mobile follow-up passes 14. FP interaction parity, world collisions, camera gestures, real flashlight aim, animal eye reflections and 16 persistence/restart/offline/two-tab checks pass. Explicit SwiftShader smoke passes with its known driver warnings retained.

The final mobile-default check also passes: touch starts at low quality with DPR capped at one, the 3D flashlight and permanent reticle remain visible, no interaction caption appears, and the 390px viewport has no horizontal overflow. Personally inspected `mobile-night-default.png` and `mobile-pause.png`, together with the final full-farm, forest-interior, morning, sleeping-coop and jumpscare captures.

The full-farm fixture contains ten beds, six buildings and thirty animals with the complete forest/brook. Final ANGLE Metal measurements:

| Profile | Mean frame | p95 | FPS |
|---|---:|---:|---:|
| desktop1440x900,high | 16.67ms | 16.70ms | 60.0 |
| desktop1440x900,low | 16.67ms | 16.80ms | 60.0 |
| mobile390x844,DPR2requested(qualitycaps1),4xCPU,low | 31.30ms | 50.00ms | 31.9 |
| mobile390x844,DPR2,4xCPU,high-or-automaticfallback | 36.74ms | 66.70ms | 27.2 |

High-to-low automatic fallback is verified, but its measurement window includes the costly transition and is not represented as a sustained 30 FPS result. Touch devices now start in low quality, which meets the mobile target while retaining the same detailed tree silhouettes and all gameplay. Explicit high remains available via the existing test hook. Pass-one performance evidence records the earlier missed targets; grass footprint work, tree draw batching, housing caching, building consolidation and FXAA fixed the regression without restoring crude tree replacements.

Asset audit: 111 manifest records, no missing local model files or incomplete source/license/triangle records. No generated solid props.
