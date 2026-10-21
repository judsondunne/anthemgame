# Living world / nightfall update

## Existing architecture
`scene.js` creates the Three renderer, orthographic camera, downloaded scenery and animal instances. `public/game` supplies original logical-coordinate behaviour (50 logical x units = 1 world unit, y scaled by 1.65). `src/game/controller.js` owns deterministic sim state and persistence; bridge.js synchronizes that state with visual behaviour. input.js performs raycasts/proximity picks, crop and care actions and building ghosts. `src/sim` separates economy, needs, breeding, crops, placement, clock and version-2 migration from rendering. `src/ui` supplies icon HUD/shop/bubbles/juice. Assets are GLBs through assets.js and manifest.json. Saves use localStorage plus revision-checked Blob API and tab leadership.

## Implementation phases and file map
0. Architecture, plan and precedence decisions (this document / DECISIONS.md).
1. Crop regression: tests/crops.test.js, verification/v3, src/game/input.js. Chicken sourcing and comparison: assets.js, manifest.json, src/render/animals.js, ASSETS.md, verification/v3.
2. Camera/input: new src/game/camera.js, input.js, scene.js, garden.css; inertial orbit/pan/zoom, gesture guards and close/wide presets.
3. Larger rolling world/forest/brook: new src/render/world.js and world configuration; instanced downloaded foliage/rocks, water shader, audio.js.
4. First person: camera.js, input.js, scene.js, HUD/CSS, save migration; movement/collision, pointer lock, mobile controls and interaction parity.
5. Fences: pure sim/fences.js; actions/catalog/save/balance; new render/threats.js fence instances and ghosts; HUD modes and input routes.
6. Predators: pure sim/predators.js; health/targeting/scare/retreat; render/threats.js, audio.js and UI alerts. Night flashlight and eye reflection renderer.
7. Inventory: sim/inventory.js and migration, HUD backpack/hotbar drag/drop, market fence sections. Ten hotbar and 64 backpack slots.
8. Balance and edge cases: unit tests, scripts/simulate.js, BALANCE.md, performance fallbacks and polish.
9. Deterministic URL hooks: controller.js/scene.js; camera, money/give, pens/predators/mode/needs.
10. verification/v3 automated sim/browser gates, screenshots, two visual review passes and honest REPORT.md. Record limits, never assert unobserved success.

## Parallel boundaries
Simulation worker owns src/sim, balance.js, simulation tests and scripts/simulate.js. Camera worker owns camera.js and input.js plus camera configuration. Asset/world worker owns downloaded assets, assets.js, animal renderer, world.js and sourcing/license documentation. Main agent owns scene integration, HUD/shop/CSS, threats renderer, tutorials and browser verification. All code shares the same branch; phase commits stage only owned files.
