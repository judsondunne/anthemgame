# Cozy world quality and content update

## Architecture reviewed
The full source is reviewed across the implementation team before changes: the deterministic `src/sim` owns economy, clock, crops, housing, fences and predators; `src/game` owns persistence, tab leadership, camera and interactions; `src/render` and `scene.js` present downloaded GLBs and allowed terrain/water/atmosphere geometry. Legacy `public/game` agents supply poses and audio while the bridge keeps simulation positions authoritative. The Blob API accepts the configured schema and revision-checks writes. Inventory remains ten hotbar slots and sixty-four backpack slots.

## Changes and file map
1. UI: a shared cozy theme, model-studio item portraits and coherent abstract SVGs; apply to HUD, inventory, market, bubbles and mobile controls. `src/ui/**`, `garden.css`, `index.html`.
2. Foliage: denser intentional planting, multi-species canopy/understory, wind, instancing/LOD and downloaded prop upgrades. `src/render/world.js`, `assets.js`, `public/assets`, `ASSETS.md`.
3. Cottage: downloaded modular shell and furniture, working door, wall/furniture collision, walkable floors and camera cutaway. `src/render/cottage.js`, `scene.js`, `src/game/input.js`, `camera.js`.
4. Coop: automatic dusk return/dawn exit, capacity-correct roosts, visible animated door and nest eggs; persistent door/resident state with migration. `src/sim/shelter.js`, `save.js`, `sim.js`, `src/render/kit.js`, `farm-layer.js`.
5. Wildlife: deterministic unsaved forest wildlife, grazing/drinking/fleeing and quality/distance caps using downloaded models/clips. `src/sim/wildlife.js`, `src/render/wildlife.js`, `scene.js`.
6. Predators: reproduce nightly pack failure first; fix accessibility/scheduling and tune packs/bears, preserve fence/coop and offline protection. `src/sim/predators.js`, `src/config/balance.js`, `tests/predators.test.js`, `scripts/simulate.js`.
7. Economy: 20–45 second fast crops, 2–4 minute premium crops, staged watering, faster breeding/maturation/production and bounded progression. `balance.js`, crop/animal/economy tests, `BALANCE.md`.
8. Movement/water: height-aware object tops/steps, interior collision, slope limits, pond/brook wading/swimming, visual/audio feedback and livestock brook trips respecting fences. `src/game/camera.js`, `src/game/surfaces.js`, `src/sim/movement.js`, `wandering.js`, `bridge.js`, `scene.js`.
9. Verification: focused Node tests, build, asset audit and one SwiftShader Playwright smoke with eight views and visible-letter/network/console assertions. `tests/**`, `verification/v5/**`, `README.md`.

## Execution
Work on `codex/cozy-world-quality-update`. Main agent integrates camera/water and verifies; workers independently implement UI, world/assets/interiors/wildlife, and simulation/balance/coop. Workers do not mutate shared files without coordination. Phase commits stage only their files; cross-phase shared configuration is committed with its first dependent phase and documented. Keep existing saves/inventory/API semantics and record compromises in `DECISIONS.md`. No deployment is requested.
