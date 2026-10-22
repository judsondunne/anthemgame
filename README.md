# Chicken Garden

The original October 20 illustrated Canvas garden, with the full farm economy and night gameplay. No WebGL or Three.js runtime is loaded. Buildings, beds, and planting rows share a true isometric orthographic camera: 45° yaw, 35.264° elevation, and ground edges at ±30°. Added homes use a single consistent world scale and share depth ordering with livestock.

## Play locally

Run `npm run dev`, then open http://localhost:8094. The local shared server keeps its own save in `.local-shared-farm`, separate from production. Native JavaScript modules require an HTTP server. All artwork is generated locally. The album starts with a random track on each visit, then plays a shuffled queue of all 13 tracks without repeating the previous visit’s opening song. Streaming music needs an internet connection; the garden also has original synthesized audio.

## Playing

A new shared garden begins on the first real Continue with 1,000 coins, basic tools, and one empty bed. There are no chickens, coops, barns, stables, planted crops, or owned livestock. Buy a coop (400), a hen (60), and a rooster (50); 490 coins remain for flowers and feed. The welcome preview does not reset or save anything. The first start is committed only by a trusted Continue gesture. Later visitors join the shared progress, without resetting the world. A copy of the previous farm is kept under `farm-save-before-fresh-start-v1`.

The original cream and sage toolbar now holds ten inventory slots, a backpack, market, and walking toggle. Number keys select slots; I opens the 64-slot backpack. Drag items between slots, right-drag to split a stack, or Shift-click to move between backpack and hotbar. On touch, hold an item to split it. Swipe the hotbar to reach additional slots.

Buy seeds, feed, animals, fences, gates, beds, coops, barns, and stables at the market. Select seeds and tap soil to plant. Water dry beds with the can; growing crops need another watering. Use the hand to harvest sparkling ripe crops, then sell them through the market's Sell tab. Eggs and milk collect into inventory. Suitable adult animal pairs breed when cared for and housed; babies mature over time. Needs bubbles offer contextual feeding and watering.

Building kits show a placement preview on clear lawn. Barns unlock cows; stables unlock horses. Fence segments snap to a grid. R or the Rotate button rotates the grid preview; X switches removal. Tap a fence with any tool to pick it up, then tap a valid grid edge to move it without buying another piece. Cancel returns it to its original location. When holding a gate, use Gate to open or close it. Closed pens and closed coop hatches protect livestock. The cow and horse pastures start without preset fences; build a complete pen with inventory fences for protection.

Each day and night lasts five minutes. Chickens head home in the evening and coop doors close automatically. Tap the coop to call them home after dusk. Wolves threaten exposed livestock; bears can arrive as the herd grows. Choose the flashlight to enter walking mode, then aim steadily at a wolf for 1.5 real seconds to scare its pack. Bears need secure pens. WASD walks, F toggles overview/walking, P pauses, N advances day/night. Touch walking has directional buttons. Arrow buttons or swipes explore the pastures and brook. Livestock visit water, while wild rabbits wander nearby; horses appear only as owned livestock.

## Persistent shared progress

Everyone on the live site plays the same garden. `/api/farm` stores the world in private Vercel Blob storage. Legal player commands are applied to the latest server revision with ETag compare-and-swap, rather than uploading whichever browser happens to save last. Concurrent purchases, crops, livestock, inventory moves, and fences reconcile without overwriting another player's work. Open clients refresh the shared state about every 1.4 seconds. The status reads Live saved, Syncing, or Offline / queued.

Offline commands are retained in browser storage and replayed with unique IDs; the server's receipts prevent duplicate purchases on retries. Local saves and recovery backups remain available. Reloading joins the shared server world. On the first shared launch, previously played local progress can seed or recover an otherwise untouched shared garden. A stale or fresh browser cannot reset an already played server world. Keep the friend's original browser data until it has connected to the updated game.

The private Blob token stays on the server and is never included in the client or static deployment. Viewing the welcome screen does not initialize a new shared game; the real Continue gesture starts it. Deterministic local tests use `?nosync=1` and local-only historical fixtures.

## Verification and deployment

`npm test` checks the simulation, progression balance, inventory, fences, shelter, predators, persistence formats, server behavior, pause, and water movement. `npm run test:shared` starts an isolated server and tests two separate browsers, concurrent edits, offline recovery, migration, and shared persistence. With `npm run dev:classic` serving port 8093, `npm run test:browser` runs the actual illustrated game through planting, watering, harvesting, selling, building, buying livestock, inventory, flashlight encounters, pausing, reloads, and mobile market controls (requires Playwright/Chrome and the local server).

`npm run test:storage` checks real browser shutdown/restart and corrupt-save recovery. `npm run test:visual` verifies the isometric axes, model scale, depth ordering, and shuffled album queue, and captures desktop/mobile screenshots.

Deploy the static root and serverless API with `vercel --prod`. The original 3D rebuild remains backed up on the GitHub branches `codex/cozy-world-quality-update`, `codex/living-world-nightfall`, and `codex/three-garden-rebuild`.
