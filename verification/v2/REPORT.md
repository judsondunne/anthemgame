# Farm economy verification (v2)

Branch `claude/farm-economy`. Browser: Playwright's bundled headless **Chromium 156** (`channel: "chromium"`) launched with `--enable-webgl --enable-unsafe-swiftshader --ignore-gpu-blocklist`. On this Mac (Apple M2 Pro) that renders WebGL through ANGLE/Metal on the GPU, with SwiftShader allowed as the fallback; a forced-SwiftShader run is reported separately. Server: `scripts/serve.js` serving the production build plus `/api/state` backed by a **file mock of Vercel Blob** — the same handler code as the Vercel function, but no real Blob credentials exist in this environment, so the real Blob SDK path is exercised only up to its "unavailable" degradation.

Reproduce: `npm install && npm run build && npm run verify` (runs every gate below in order).

<!-- GATES -->

## Phase 8 edge cases

| Case | Where it is verified |
|---|---|
| Negative money impossible | `economy.test.js` (buy refuses; spam); `save.test.js` (validation repairs −50 → 0); `edge.cjs` |
| Double-tap / rapid-tap spam | `economy.test.js` (500 buys); `animals.test.js` (double collect); `edge.cjs` (25 rapid clicks on a tile: exactly 12 tulips for $37) |
| Buying with exactly enough money | `economy.test.js`; `edge.cjs` ($60 → hen → $0, tile then dims and refuses) |
| Selling zero | `economy.test.js` (0, −2, 1.5, none); `edge.cjs` (empty sell tab = empty basket) |
| Inventory stack limits | `economy.test.js` (buy, harvest and collect at 99); `edge.cjs` (greyed tile, refused) |
| Placement overlap / out-of-bounds / rotating phone mid-placement | `economy.test.js`; `edge.cjs` (pond, cottage, far out of bounds refused; 1280×800 → 390×844 mid-placement keeps the ghost cell, confirm works) |
| Breeding with no housing capacity | `animals.test.js` (progress held at threshold, baby arrives when a hen leaves) |
| Feeding an animal that isn't hungry | `animals.test.js`; `edge.cjs` (no feed used, the hen shakes her head) |
| Feeding dead animals | `animals.test.js`; `edge.cjs` |
| Saving mid-action | `persistence.cjs` (reload mid-placement restores the ghost and kit) |
| Older schemaVersion | `save.test.js` (v0 XP, v1); `persistence.cjs` (v1 file loaded in the browser) |
| Corrupted / empty save | `save.test.js`; `persistence.cjs` (falls back to the backup; the unreadable text is kept as `farm-save-corrupt`; empty → fresh) |
| Two tabs | `persistence.cjs` (leader epochs, mirrored saves over BroadcastChannel, no purchase lost; cross-device revision conflict: newest wins, loser kept) |
| Clock changes / time going backwards | `save.test.js` (negative/NaN durations ignored); `persistence.cjs` (save timestamp in the future → zero catch-up) |
| Tab hidden for hours | `save.test.js`; `persistence.cjs` (five hours away and three hours hidden → exactly 600 game s, no deaths) |
| Server unreachable | `persistence.cjs` (aborted `/api/state`: silent, saves and reloads from localStorage) |
| Reload in every state | `persistence.cjs` (growing crop, breeding hen, chick, dead hen, bones, placement mode all identical after reload) |
| All animals dead | `economy.test.js` (seed gift → plant → harvest → sell → can buy again) |
| Hitting the animal cap | `animals.test.js` (global cap 30 binds before housing); `edge.cjs` (4/4 numerals, greyed, refused) |
| Day/night boundary during a timer | `crops.test.js` (lavender growth identical across dusk) |

## Polish pass 1 (`pass1/`, `pass1b/`): critique and fixes

All 29 captures were opened and reviewed by eye.

| Capture | What worked | Problem found | Fix |
|---|---|---|---|
| 01 fresh start | Water bubble over the bed is the obvious first action; money pill and hotbar clean | The two starter seedlings were nearly invisible; the bed's dirt rows looked like loose boards | Seedling models enlarged; every crop 30% larger; beds framed with logs on all four sides |
| 03–06 market, locked/unlocked | Icon tabs, coin prices, owned counts, padlock + barn/stable icon, unlock after the barn | Locked tiles also showed a "0/0" capacity badge overlapping the padlock | Capacity badge hidden while locked; extra top padding when the badge is present |
| 07 unlock flourish | Sunburst disc with barn + cow and confetti reads as a celebration | — | — |
| 08–09 placement | Zone grid, red ghost over the pond, greyed check | The valid (green) ghost read as a soft box | Lit translucent material, higher opacity, lower emissive |
| 10 crop stages | Six crops distinguishable when ripe | The ripe bed sat behind the starter coop's roof; growing stage barely larger than a seedling | Stages arranged in a clear column; growing stage enlarged |
| 11 ripe cue | Sunflowers and tulips read clearly, bubble shows the crop | Sparkles too faint | Bigger, brighter, more frequent sparkles |
| 12 babies vs adults | Cube chicks, smaller paler calf and foal are clearly juveniles | — | — |
| 13–15 urgent, sad, dead | Warm red bubble; drooped sad hen; dead hen on her back, eyes closed, muted, no bubble | — | — |
| 16 bones | Ribcage + bone where the hen fell | Too small, too pale against the stepping stones | Larger, plain bone-white tone (texture dropped), then warmed slightly in pass 2 |
| 17 full farm, golden hour | Golden light consistent with the original sunset | Fixture placed only a few beds (several placements failed silently): not "lush" | Dense layout found by search in the pure sim (10 beds, 2 coops, 2 barns, 2 stables) |
| 18–21 night, pastures | Every building lit at night, herd sheltered in the barn, stables with horses and a foal | Second barn missing (blocked by the trough obstacle) | Fixture uses packing-aware placement |
| 22–24 phone | Bottom-sheet market with thumb-sized tiles; hotbar scrolls | Farm small in portrait; capacity pill overlapped animal art | Closer portrait framing (garden fills the width); padding |
| 25–26 juice | Coin pop flies to the pill; harvested lavender icons arc to the hotbar | Coin pop small | Larger coin pop |

Regression comparison against `verification/final/` (pass 1 build) also showed **7:00 had turned yellow and 19:30 cooler/darker** than the previous build. Fix: the sunrise glow now peaks at 6:00 and has faded by 7:00, and the cool night tint arrives later in the dusk.

## Polish pass 2 (`pass2/`): critique and fixes

All captures re-opened after the fixes. Seedlings visible; framed beds read as raised beds; locked tiles clean; ghost shows the coop's walls and roof; full farm reads as busy and thriving; night shot has every building glowing with sparkles over ripe beds; phone market tiles clean. Remaining issues and fixes: on phones the sell-all coin button crowded the item art (made smaller on narrow screens); bones still slightly cold against pale stone (warmed); purchases had no sound cue (soft pop added).

Found while running the gates rather than in screenshots, and fixed: a coop placed hard against a bed hid its egg-drop point (eggs now search outward in rings); tapping bones beside a rolled egg collected the egg (pickups and bones now compete by distance); a hay or water tap on a cow standing by her milk collected the milk instead (one tap in three in a probe; now the selected tool decides: food and the can reach animals first, the hand reaches pickups first — covered by a new edge case that fails on the old code); `?fresh`/`?time` re-applied on reload (now one-shot, stripped like `?k=`); a stale tab's late flush could overwrite a newer save and Chrome can show other tabs' localStorage late (leadership epochs; the save document travels over BroadcastChannel); the Blob store needed to accept `BLOB_STORE_ID` + OIDC, which is what connecting a private store provides.

