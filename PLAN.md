# Farm economy layer: plan

Branch `claude/farm-economy`, cut from `60e4a4b` (Codex Phase 7, the shipped Three.js garden).

## Current architecture (as found)

- `index.html` (identical to `three.html`) loads classic scripts from `public/game/` in order: `core.js` (canvas, `view`, URL `params`, seeded `rand`, old 2D projection helpers), `audio.js` (`AudioGarden` Web Audio: ambience, pad chords, chime, goose honk, mute), `navigation.js` (`walkable`, `inPond`, `insideBed`, A* `routeTo`, `sendChicken`), `entities.js` (`world`: 7 hens, 28 bed flowers, 5 koi, scenery anchors, needs, particles, day clock), `farm-state.js` (`Farm`: camera pan, XP, random eggs, 3 cows + 3 horses with fixed pastures/barns, timed births), `youtube.js` (optional album stream), `care.js` (`fulfillNeed`, keyboard, `window.GameState`). Then the ES module `scene.js` (+ `assets.js`) builds the Three.js scene.
- `scene.js`: WebGL renderer, PCF soft shadows, ACES, bloom + vignette/warm grade passes, ortho camera at 45°, kitbashed cottage/coop/barns from Fantasy Town modules, Kenney nature scenery, instanced grass (28k) that bends around hens, pond water shader, sky dome shader, point-particle system (dots, butterflies, hearts, drops, moons), static batching of ~770 meshes by material, DOM need bubbles, raycast picking in `care()`, render loop, automatic low-quality fallback, `window.Garden` test hooks.
- Logical coordinates: the old 1400×960 world; renderer maps `(x,y) → ((x−700)/50, h, (y−650)·1.65/50)`. Garden ≈ x 210–1190, y 410–920; cow pasture centred x −530, horse meadow x 1930; camera pans ±1450.
- Assets: `public/assets/manifest.json` + GLBs (Kenney Nature/Town/Pets/Food recoloured colormaps, Quaternius hen; `horse.glb` is actually a Quaternius **sheep**).

## How time of day works now

`world.time` is a normalised cycle (0–1): `update()` advances it as `(0.22 + elapsed/440) % 1` (≈7.3 min/day) unless `forcedTime`/`timeTween` (D key, `?time=H`) override it. `isNight()` = `time > .69 || time < .075` (20:00–06:00). `scene.js` converts to hours (`clockHour`) for lighting: night factor `smoothstep(18.4,21)` plus a hard step at 06:00 (abrupt dawn), sunset gold Gaussian at 18h, sun arc 6→20h, static moon disc, lantern/window lights scale with night. At the night boundary entities send hens to the coop (sleeping, squashed pose, moon particles) and herds to barns (hidden).

## How needs, bubbles and entities work now

`makeNeed()` every 14–26 s (max 3, daytime) picks a random hen (heart/food/water), bed flower (water) or the koi (food). Bubbles are DOM buttons positioned by `screen()`; tapping calls `fulfillNeed` (pet, scatter grain, water flower, feed fish). There is no failure state: needs never expire, nothing dies, flowers only grow in size, eggs/births are timer-driven decorations, XP is the only progression (saved to `localStorage['garden-progress']`). Hens are A*-navigating agents with wander/feed/drink/nap/sleep modes; herds wander pastures, queue at troughs, shelter at night.

## What must change

1. **Pure simulation** (`src/sim/`): deterministic state + `tick(state, dt, {offline})` + action functions, no DOM/Three. Owns money, inventory, beds/plots, buildings, animals (age, sex, hunger/thirst neglect clocks, production, breeding, death, bones), pickups, clock, anti-softlock, unlocks. Seeded RNG stored in state.
2. **One tunables file** `src/config/balance.js` (times, prices, rates, caps, durations, footprints). Fixed world geometry (zones/obstacles) lives in `src/sim/layout.js`.
3. **Time model**: game time is one monotonic number of game seconds in the save. Cycle = 300 s day + 300 s night. Hour mapping: day phase 06→20 h, night phase 20→06 h, so `isNight` ⇔ second half of the cycle. Lighting rebuilt around real sun/moon arcs: smooth dawn and dusk, golden hour at both ends, moonrise at 20 h, one shadow-casting celestial light (sun by day, moon by night, swapped at the horizon when both are dark), moon/sun glints on the pond. `?timescale=N`, `?time=H` (jumps forward only), `?fresh=1`, `?nosync=1`, `?k=` (save key).
4. **Entities become views of the sim**: hens/chicks (`world.chickens`) and herds (`Farm.animals`) are created/removed by a bridge from sim animals; agents keep the existing A*/wander/sleep/drink/eat behaviours but get a per-animal home (coop/barn/stable door). Fixed bed flowers, random eggs, timed births, fixed barns and pre-placed herds are removed (the sim owns those now). Ambient heart and koi needs stay as cosmetic care.
5. **Persistence**: one JSON save doc (`schemaVersion` + migrations), localStorage autosave (2 s debounce + `visibilitychange`/`pagehide`), Vercel function `api/state` storing one private blob `farm/save.json` with a revision counter and ETag compare-and-swap, `x-save-key` write guard, silent failure, tab leadership via `BroadcastChannel`, offline catch-up capped at 600 game-s with need clocks frozen.
6. **Icon-only UI**: money pill + day dial (top), sound toggle, bottom hotbar, market panel (buy/sell tabs), placement controls, need/ripe bubbles, coin pops, unlock flourish. `body.innerText` must contain no letters.
7. **Assets**: add real Quaternius Cow/Bull/Horse (same rig: Idle, Walk, Gallop, Eating, Idle_Headlow, Death), Quaternius bone + ribcage (bones state), Kenney crop stages (leafsStageA, wheatStageA, cornStageC, flower B/C variants), Kenney cabbage + milk carton (Food), hay bale, Fantasy Town wood walls/high roof/fence/stall for coop, barn, stable and market stall. The Kenney cube cow and the mislabelled sheep are retired.

## File-by-file change list

| File | Change |
|---|---|
| `src/config/balance.js` | **new**: every tunable number |
| `src/sim/layout.js` | **new**: grid, zones, fixed obstacles, footprint validity |
| `src/sim/rng.js`, `state.js`, `clock.js`, `sim.js`, `actions.js`, `save.js`, `catalog.js`, `index.js` | **new**: pure simulation, catalog, save/migrate/validate |
| `src/game/persistence.js` | **new**: localStorage, server sync, revision conflicts, leadership, catch-up |
| `src/game/controller.js` | **new**: owns state, ticks sim each frame, dispatches actions, turns sim events into juice, test hooks |
| `src/game/bridge.js` | **new**: sim animals → hen/herd agents; sim needs → bubbles |
| `src/render/farm-layer.js` | **new**: beds, crops by stage, buildings, ghost + grid overlay, pickups, bones, building lights |
| `src/ui/icons.js`, `hud.js`, `shop.js`, `juice.js`, `bubbles.js`, `ui.css` | **new**: icon-only interface |
| `src/game/input.js` | **new**: pointer/touch → tool actions (replaces `care()`) |
| `scene.js` | remove fixed beds/flowers/barns/herds; dynamic layer group excluded from batching; new sun/moon lighting + sky/water uniforms; animal model selection (adult/juvenile/dead), add/remove, sad/dead poses; per-building window lights; extended `window.Garden` |
| `assets.js` | per-model material recolour map for new Quaternius animals; desaturated clone helper |
| `public/game/entities.js` | sim-driven clock (no forced toggle), dynamic hens with per-hen homes, ambient needs only, no fixed flowers |
| `public/game/farm-state.js` | herds become sim-driven agents with building homes and pasture zones; no XP/eggs/births |
| `public/game/navigation.js` | `insideBed` → dynamic bed/building footprints from the sim |
| `public/game/care.js` | keyboard tools mapped to hotbar, remove D toggle, expose new hooks |
| `public/assets/manifest.json`, `ASSETS.md`, licences | new assets recorded |
| `api/state.js`, `src/server/state-core.js`, `src/server/stores.js` | **new**: Vercel Blob route + store-agnostic core + file mock store |
| `scripts/serve.js` | **new**: local prod server (dist + api with file-backed mock blob) |
| `scripts/simulate.js`, `BALANCE.md` | **new**: headless strategies and results |
| `tests/*.test.js` | **new**: `node:test` unit/sim tests |
| `verification/v2/*` | **new**: Playwright E2E, screenshots, REPORT.md |
| `README.md`, `vercel.json`, `package.json`, `vite.config.js` | run/test scripts, Vercel steps, build config |

## Data model (save doc, schemaVersion 2)

```js
{
  schemaVersion: 2,
  rev: 0,              // server revision this doc descends from
  seq: 0,              // local save counter (tab ordering)
  savedAt: 0,          // wall-clock ms of the save
  seed: 1247, rng: 1247,
  time: 0,             // game seconds, monotonic (cycle 600)
  money: 1000,         // integer, never negative
  inv: { seed_daisy: 4, feed_chicken: 6, egg: 0, ... },   // item key -> count (0..stackMax)
  beds: [{ id, gx, gy, plots: [{ crop: 'daisy'|null, g: 0..1, w: secondsOfWater }] }],
  buildings: [{ id, type: 'coop'|'barn'|'stable', gx, gy }],
  animals: [{ id, sp: 'chicken'|'cow'|'horse', sex: 'f'|'m', var, born,
              age: 0..1, hunger, thirst,   // active-play seconds since last fed / watered
              prod, breed,                 // production / breeding progress (seconds)
              state: 'alive'|'dead'|'bones', deadFor }],
  pickups: [{ id, kind: 'egg'|'milk', x, y, t }],
  softlock: { clock },
  celebrated: { cow: false, horse: false },
  stats: { earned, spent, sold, harvested, births, deaths, legacyXp },
  ui: { tool: 'hand', placing: { kit, gx, gy } | null },
  nextId: 1
}
```

Derived (never stored): hour/night, housing assignment and capacity, needs (hungry/thirsty/urgent/sad), unlocks, prices. Migrations: v0 (legacy `garden-progress` XP) → fresh farm with `stats.legacyXp`; v1 (first draft: `coins`, array inventory, no `ui`/`celebrated`) → v2.

## Key rules (all numbers in balance.js)

- Crops: plant seed in empty plot; growth accrues only while the plot has water; stages seedling/growing/ripe; harvest only ripe; unripe tap = wiggle.
- Animals: hungry after `hungryAfter`, thirsty after `thirstyAfter`; urgent at 1 game day unmet, sad at 1.5, dead at 2. Dead → bones after 0.5 day → tap to clear. Need clocks only advance in active play; offline catch-up never kills.
- Breeding: per content adult female, paired with a content adult male of the species (pairs = min(males, females)); one baby per 2 game days ÷ housing fertility multiplier; blocked (progress held) at housing or global cap. Juveniles mature over 3 game days.
- Housing: base coop holds a few hens; coop upgrades, barns and stables add capacity and multipliers. Cows/horses locked until a barn/stable is placed.
- Anti-softlock: when broke with nothing to plant, sell or harvest, a free seed (and feed for hungry animals) trickle arrives.
