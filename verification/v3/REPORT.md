# Living world and nightfall verification

21 October 2026 · branch `codex/living-world-nightfall` · Apple M2 Pro, macOS.

## Scope and precedence

The attached brief is the implementation baseline. Later direct requests explicitly supersede three rules: short tutorial words are allowed; wolves can attack chickens left outdoors; flashlight deterrence works only in first person. The original God View scare and blanket no-letters assertions are therefore replaced with their directly requested behavior. Everything else remains icon led. No deployment was performed.

## Visual review and fixes

Two complete integration passes, plus a final follow-up review, were personally inspected. Screenshots and machine-readable results live beside this report.

**Pass 1:** `first-integrated.png`, `night-pass1.png`, candidate/pose sheets and `ART-REVIEW.md`. The original forest was too sparse and angular to meet the reference; hotbar contents appeared to float; the early coop resembled another house; walking hens slid. The first wolf lunge was incorrectly scaled and showed the animal's underside. The first AO integration also produced a black beauty output. These were failures, not accepted results.

**Pass 2:** `pass2/01`–`22`, upgraded world captures and the full-farm set. Added 21 downloaded textured forest/botany assets, retained their UV atlases, cut out foliage, mixed canopy species and dense undergrowth, and removed the giant rock backdrop. Replaced the coop with a raised, open-front henhouse, ramp, nesting hay, roosts and warm light, assembled from downloaded modules. Chicken gait follows traveled distance and existing leg bones. Fixed the AO beauty RenderPass, reduced AO resolution, batched compatible building and animal meshes, and preserved skinned eye vertices. Hotbar slots share a baseline and count badges sit inside. A dedicated head anchor fixes the wolf lunge.

**Final follow-up:** `followup/01`–`15`. Personally reviewed sleeping birds, amber/red care, egg visibility, return/timer card, desktop/mobile inventory and markets, cloud/sun/moon sky, and the final full-screen wolf face. Removed the light cone against empty sky and lowered jump illumination to avoid a white face. Clouds now have multiple scales and directional shading. The final pen review also caught a gate normalized against its narrow thickness: height normalization and a quarter-turn now match neighboring fence pieces. The last-seed whole-bed action now keeps the watering shortcut visible after the seed stack empties (a timing-dependent UI disappearance found by the rerun). The garden remains soft and muted, with sharper foliage, soft shadows and more depth. It does not reproduce Grand Mountain Adventure's proprietary art or rendering exactly. The sky and brook are procedural stylized effects rather than photographic captures or physically simulated water. The wolf's faceted face remains visibly stylized.

The selected chicken is the rounded **Pixor CC0 hen, 652 triangles**: readable comb, wattle, breast, wings, tail and feet, with four coats, matching chick and russet rooster. Its source supplies Peck only; walking, sleeping and collapse use the existing rig/transform. Quaternius's wolf has walk/run/attack clips; Pixor's bear has Idle only and uses restrained transform gait. See `ASSETS.md` for exact source/license/triangle records and downloaded provenance.

Compared with v1/v2 reference captures, the central house, beds, pond, pastures, muted palette and rounded icon language remain recognizable. The coop, foliage, hotbar and world depth intentionally change. Eggs now have a subtle cream highlight and ground cue.

## Automated evidence

- `unit-results.txt`: 89/89 unit, sim, migration, inventory, collision, server and balance tests pass. Covers every crop/bed combination and stage, care/death/bones, fences/gates/enclosure, deterministic predators and encounter timing, shelter and static world collisions.
- `camera-input-production.json`: actual mouse orbit, wheel pan, cursor zoom, ctrl-wheel, gesture cancellation/history stability, close/wide limits, FP movement/sprint/jump/house collision, rapid switching, mobile joystick/look/jump/interact and orientation.
- `fp-parity.json`: actual E interactions for crops, eggs/milk, animal care/pet, fence place/delete, gate passage, bed and coop placement, market buy/sell including held-stack exhaustion, inventory, lock loss and hidden tab.
- `fp-collisions.json`: forward movement blocked by downloaded trees/rocks, pond/brook, closed fence/gate; open gate passes.
- `flashlight-e2e.json`: real beam aiming accumulated exposure and triggered the deterministic branch and pack retreat without the forced-encounter hook; God View exposure stayed zero. Separate pure tests cover both 50% branches and real-second cinematic timing.
- `gameplay.json`: full actual-click seed/economy/building/pen/night playthrough, both cinematic outcomes, bear immunity, pen safety, delete/refund, and no browser errors/warnings/failed requests.
- `followup/results.json`: 14 checks for the actual dusk coop button/roosts, eye toggle both ways, crop helper/value/time, care warning escalation, aligned slots, mobile swipe and 64-slot fit. Browser logs clean.
- `visual-edges.json`: each of chicken, cow and horse eyes produces at least two depth-tested reflections under real FP beam aim; invalid fence preview and a full backpack drag captured.
- `persistence.json`: full schema-three state, v1/v2 migration, local/server round trips, corrupt backup, server restart/redeploy recovery, offline safety, two tabs and stale CAS conflict backup. Uses the actual API route with a file-backed Blob mock; no live Vercel credentials.
- `asset-audit.json`: 102 manifest entries, all local files present with source, license and triangle count. Source geometry grep personally inspected: only terrain, water, grass, sky, particles, light volume and flat ground UI overlays generate geometry. Solid props use downloaded topology.

The planting regression was reproduced using the previous input fixture when an animal overlapped a bed (`seed-input-before.fixture.js`, `seed-overlap-before.png`). The corrected click prioritizes the selected seed and exact plot. Generic non-overlap baseline planting already passed; it was not represented as the failing reproduction.

## Environment limits

Headless Chromium rejected native pointer lock with “The root document of this element is not valid for pointer lock.” The tests emulate the lock-element state and deliver real mouse-move deltas, verify orientation changes, lock loss and movement cancellation. This proves controller behavior under emulation; native captured-pointer operation still needs an interactive browser check.

All normal browser suites use the bundled Chromium headless shell with ANGLE Metal hardware WebGL because SwiftShader is too slow for meaningful full-farm performance. `software-smoke.json/png` separately exercises the built game with explicit SwiftShader flags. Software-driver KHR_parallel_shader_compile/ReadPixels warnings are preserved, not suppressed; they are an environment exception to the zero-warning gate. Hardware browser logs are clean. Software rendering is not claimed to meet the hardware frame-rate target.

## Balance and persistence

`balance-final.json` and `BALANCE.md`: relaxed balanced progression completes all ten beds/six buildings at game minute 80, zero deaths, final worth 82,932. Best crops finish at 47,255. A closed pen costing 87 takes zero damage across 12 nights; no-fence care takes 571 damage but retains six survivors. First-person flashlight helps against wolves; bears require fences. Outdoor chickens require a dusk call-in. Offline catch-up never spawns predators or causes neglect/predator deaths.

Schema three automatically migrates existing saves, including complete slot layout, player mode/position, fences/gates and health. Live threats clear safely on load. The existing API and Vercel Blob configuration remain compatible; a normal redeploy needs no new environment variables.

## Reproduce

`npm run dev` starts local play. `npm run verify` builds and runs the sequential verification suites against an isolated file-backed save server. Individual browser scripts accept `FARM_URL` (camera/FP scripts accept `GARDEN_URL`). `npm run simulate` reproduces the balance strategies.

### Browser pacing audit

An additional installed-Chrome run (`full-farm/performance-installed-chrome.json`) paced both desktop high and low at exactly 33.33ms despite CPU costs of 11.83ms and 6.64ms. It also missed the throttled mobile target. The pinned Playwright Chromium headless shell used by the other suites is therefore the reproducible performance browser. The installed-browser result is retained, not overwritten or claimed to pass.

## Final full-farm performance

Fixture: 10 beds, two coops, two barns, two stables, 30 animals, the full seeded forest and brook; frozen production build, warmed shader variants, one browser suite at a time.

| Profile | Mean | p95 | FPS |
|---|---:|---:|---:|
| desktop1440x900,high | 16.67ms | 16.70ms | 60.0 |
| desktop1440x900,low | 16.67ms | 16.70ms | 60.0 |
| mobile390x844,DPR2requested(qualitycaps1),4xCPU,low | 31.90ms | 50.00ms | 31.3 |
| mobile390x844,DPR2,4xCPU,high-or-automaticfallback | 34.33ms | 50.00ms | 29.1 |

Desktop high meets the 60 FPS target within timer precision; explicitly low mobile exceeds 30 FPS. The automatic-fallback window includes its transition and averages 29.1 FPS; it is not claimed to sustain 30 throughout that transition. This is a simulated 4× CPU mobile profile on M2 Pro, not a physical phone test. A separate sustained-pressure test confirms automatic fallback, and all hardware logs have zero warnings/errors/failed requests. Low quality reduces DPR, grass, detailed LOD range and animation sampling, and bypasses AO/bloom.
