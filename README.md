# Chicken Garden

The original October 20 illustrated Canvas garden, with the full farm economy and night gameplay. No WebGL or Three.js runtime is loaded.

## Play locally

Run `npm run dev`, then open http://localhost:8093. Native JavaScript modules require an HTTP server. All artwork is generated locally. Streaming music needs an internet connection; the garden also has original synthesized audio.

## Playing

The original cream and sage toolbar now holds ten inventory slots, a backpack, market, and walking toggle. Number keys select slots; I opens the 64-slot backpack. Drag items between slots, right-drag to split a stack, or Shift-click to move between backpack and hotbar. On touch, hold an item to split it. Swipe the hotbar to reach additional slots.

Buy seeds, feed, animals, fences, gates, beds, coops, barns, and stables at the market. Select seeds and tap soil to plant. Water dry beds with the can; growing crops need another watering. Use the hand to harvest sparkling ripe crops, then sell them through the market's Sell tab. Eggs and milk collect into inventory. Suitable adult animal pairs breed when cared for and housed; babies mature over time. Needs bubbles offer contextual feeding and watering.

Building kits show a placement preview on clear lawn. Barns unlock cows; stables unlock horses. Fence segments snap to a grid. R rotates, X switches removal, and the hand opens or closes gates. Closed pens and closed coop hatches protect livestock. Decorative original boundary fences are scenery; build a complete pen with inventory fences for protection.

Each day and night lasts five minutes. Chickens head home in the evening and coop doors close automatically. Tap the coop to call them home after dusk. Wolves threaten exposed livestock; bears can arrive as the herd grows. Choose the flashlight to enter walking mode, then aim steadily at a wolf for 1.5 real seconds to scare its pack. Bears need secure pens. WASD walks, F toggles overview/walking, P pauses, N advances day/night. Touch walking has directional buttons. Arrow buttons or swipes explore the pastures and brook. Livestock visit water, while wild deer, elk, and rabbits wander nearby.

## Persistent progress

Progress autosaves in this site's browser storage every two seconds, immediately after successful actions, and on hide/close. The previous valid save is retained as a recovery backup. Reloads and Vercel redeployments on the same domain preserve coins, inventory, crops, buildings, fences, animals, clock, and pickups. The Saved indicator confirms a successful local write. Keep using the same browser/device and allow site storage. Clearing browser data clears local saves.

The schema migrates existing newer farm saves. Offline catch-up is capped and does not kill neglected animals. Multiple tabs coordinate so a stale tab cannot overwrite an active farm. Optional private cross-device synchronization uses `/api/state` only when `BLOB_READ_WRITE_TOKEN` and `SAVE_KEY` are configured in Vercel; without them local saving remains fully functional. Neither secret is embedded in the client.

## Verification and deployment

`npm test` checks the simulation, progression balance, inventory, fences, shelter, predators, persistence formats, server behavior, pause, and water movement. `npm run test:browser` runs the actual illustrated game through planting, watering, harvesting, selling, building, buying livestock, inventory, flashlight encounters, pausing, reloads, and mobile market controls (requires Playwright/Chrome and the local server).

Deploy the static root and serverless API with `vercel --prod`. The original 3D rebuild remains backed up on the GitHub branches `codex/cozy-world-quality-update`, `codex/living-world-nightfall`, and `codex/three-garden-rebuild`.
