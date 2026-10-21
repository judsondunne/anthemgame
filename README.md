# Chicken Garden — a cozy farm

A Three.js farm made entirely from downloaded CC0 models, with an icon-only interface (no words anywhere), a 10-minute day/night cycle, crops, chickens, cows and horses, a market, and a save that survives reloads and redeploys.

## Run it

```bash
npm install
npm run dev        # Vite dev server; /api/state is served from a local file mock
npm test           # 51 node:test unit/sim/server/balance tests
npm run simulate   # headless balance strategies, money over 150 game minutes
npm run build      # production build into dist/
npm run serve      # dist/ + /api/state on http://127.0.0.1:8095 (file mock of Vercel Blob)
```

Verification (Playwright, headless Chromium with WebGL; `npx playwright install chromium` once):

```bash
npm run build && npm run verify
```

`verification/v2/run-all.cjs` runs the unit tests, the persistence gate (which starts and restarts its own server on port 8095), then starts `scripts/serve.js` with a temporary Blob mock and runs the playthrough, interface edge cases, screenshots and quality/performance gates. Individual gates can be run with `FARM_URL=http://127.0.0.1:8095 node verification/v2/<gate>.cjs` against a running `SAVE_KEY=test-key npm run serve`.

Results and the screenshot review are in `verification/v2/REPORT.md`. Balance results are in `BALANCE.md`; asset sources and compromises in `ASSETS.md`; the architecture plan in `PLAN.md`.

## How to play (no text in the game)

- **Hotbar** (bottom): hand, watering can, fish food, then whatever you hold — seed packets, feed sacks, hay, building kits, harvested goods — each with a count. Tap a slot to hold it; on desktop the cursor shows the held item. Number keys 1–9 pick slots.
- **Crops**: hold seeds and tap a bed to plant; tap a bed with the can to water it (dry crops simply pause); tap a ripe plant (sparkles, bubble) with the hand to harvest. Six crops, from daisy (fast, cheap) to lavender (slow, valuable); wheat becomes hay.
- **Animals**: request bubbles show food and water; tap the bubble, or tap the animal (or its coop/barn/stable, or a trough) holding feed, hay or the can. Bubbles turn warm red and pulse when a need has gone unmet for a game day; a sad animal droops; after two game days of an unmet need it dies, lies still, and half a day later becomes bones you can tap away. Animals never starve while you are away.
- **Eggs and milk** appear in the world: tap them, or tap their coop or barn with the hand to gather everything around it.
- **Market**: the stall button (or the stall beside the cottage). Basket tab buys seeds, feed, animals (♀/♂) and buildings; coins tab sells goods and adult animals (tap = one, the coin stack = all). Cows unlock with a barn, horses with a stable (padlock + building icon until then).
- **Building**: buying a coop, barn, stable or bed enters placement mode: a ghost over the build grid, green when it fits, red when it doesn't. Drag or tap to move it, tap it again or press the check to confirm; the cross keeps the kit in the hotbar for later. Barns go in the west pasture, stables in the east meadow, beds and coops in the garden.
- **Sound**: the speaker toggle; M mutes. R streams the optional album, L plays local audio files.

## Test parameters (no UI)

| Param | Effect |
|---|---|
| `?timescale=N` | game-time multiplier (0 freezes the clock, up to 2000) |
| `?time=H` | jump forward (never backward) to hour H, once; stripped after use |
| `?fresh=1` | start a new farm (the previous local save is kept as a backup); stripped after use |
| `?nosync=1` | skip the server copy (localStorage only) |
| `?seed=N` | seed for scenery layout and a fresh farm |
| `?k=SECRET` | one-time: stores the save key in localStorage, then removes it from the address bar |
| `?quality=low`, `?close=house\|pond\|chickens\|x,y` | renderer quality / close-up framing for captures |

`window.Garden` exposes read/advance hooks for the verification scripts (state, advance, setHour, anchor positions, stats). It renders nothing.

## Saving

- One JSON save document (`schemaVersion` 2, with migrations from the pre-economy XP record and the v1 draft). Autosaved to localStorage every 2 s and on hide/blur/pagehide; a backup copy of the last good save and a copy of any unreadable save are kept.
- `api/state` (Vercel serverless function) stores the same document as one private Vercel Blob, `farm/save.json` (fixed pathname, no random suffix, overwrite allowed, uncached reads). Every write carries the revision it was based on; the route compares-and-swaps with the blob's ETag, so an older tab or device can never overwrite a newer save. On a conflict the newest document wins and the other is kept in localStorage (`farm-save-conflict`).
- Writes need the `x-save-key` header to equal the `SAVE_KEY` environment variable. Reads are open. The client sends the key it captured from `?k=`.
- The client loads the newest of the server copy and localStorage, pushes at most every 5 s and on hide (keepalive), and never shows an error. Without Blob credentials the route answers `{"status":"unavailable"}` with HTTP 200 and the game quietly runs on localStorage alone.
- Coming back after time away fast-forwards crops, growth and production by up to 10 game minutes (`balance.js`), with need clocks frozen: nothing can starve while the tab is closed or hidden. Only the most recently focused tab simulates and saves; other tabs mirror it.

## Vercel dashboard steps (manual)

1. **Create a private Blob store**: Vercel dashboard → project `chicken-garden` → **Storage** tab → **Create Storage** → **Blob** → **Continue** → set access to **Private** → create it.
2. **Connect it to the project** in all environments (Production, Preview, Development) when prompted (or from the store's **Projects** tab → **Connect Project**). Connecting adds `BLOB_STORE_ID` and lets the SDK authenticate with Vercel OIDC.
3. **Check `BLOB_READ_WRITE_TOKEN`**: under **Settings → Environment Variables**, confirm `BLOB_READ_WRITE_TOKEN` (or at least `BLOB_STORE_ID`) is present. If neither is, copy the read-write token from the store's page (its `.env.local` snippet) and add it as `BLOB_READ_WRITE_TOKEN` for Production. The route works with either. (A *public* store also works if you add `BLOB_ACCESS=public`.)
4. **Set the save key**: **Settings → Environment Variables** → add `SAVE_KEY` = a long random string (e.g. `openssl rand -hex 24`) for Production (and Preview if you play there).
5. **Redeploy**: **Deployments** → latest → **Redeploy**; environment variables only reach new deployments. The build is `npm run build` → `dist/` (see `vercel.json`), and `api/state.js` deploys as a function.
6. **Authorise each browser once**: open `https://<your-domain>/?k=<SAVE_KEY>`. The key is stored in that browser and removed from the address bar.

Until this is done the deployed game still works and saves to localStorage only; `GET /api/state` answers `{"status":"unavailable"}`.

## Files

- `src/config/balance.js` — every tunable number (prices, growth, rates, timers, durations, caps, footprints).
- `src/sim/` — pure deterministic simulation: `sim.js` (state, queries, tick), `actions.js`, `save.js` (serialise/migrate/validate), `catalog.js`, `layout.js` (grid, zones, obstacles), `clock.js`, `rng.js`.
- `src/game/` — browser glue: `controller.js` (ticks the sim, routes actions, catch-up), `persistence.js`, `bridge.js` (sim animals → behaviour agents), `input.js` (taps, drags, placement).
- `src/render/` — `farm-layer.js` (beds, crop stages, buildings, pickups, bones, ghost + grid), `animals.js`, `kit.js` (kitbashed buildings).
- `src/ui/` — `hud.js`, `shop.js`, `bubbles.js`, `juice.js`, `icons.js`, `ui.css`.
- `scene.js`, `assets.js`, `public/game/*.js` — the original renderer and behaviour scripts (hen A* navigation, herds, koi, ambience), now driven by the simulation.
- `api/state.js`, `src/server/` — the save route, store-agnostic handler, Blob and file-mock stores.
