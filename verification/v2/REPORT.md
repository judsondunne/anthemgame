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

<!-- REVIEW -->
