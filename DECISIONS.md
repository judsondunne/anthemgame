# Update decisions

- The latest direct user message overrides the pasted brief's no-words rule for a small, dismissible tutorial and a concise dusk warning: “Make sure all the animals are in. Locals have heard wolves nearby.” The remaining HUD stays icon based. The original no-letters gate is superseded only for these explicitly requested tutorial strings; verification audits for unintended text outside the tutorial.
- The latest direct user message overrides God View flashlight scare in phases 6/10: only first-person aiming can scare wolves. God View never scares a wolf. Bears remain immune.
- Scare encounters choose one deterministic 50% branch per wolf encounter. The suspense branch flickers the light once or twice, pauses two real seconds, then briefly lunges the downloaded wolf toward the first-person camera and sends the pack away. The other branch flees normally. Cooldowns prevent repeated jumps from one pack. No gore.
- Chickens are never predator targets. Closed pens protect cows and horses. No offline predator attacks or predator-related deaths.
- Existing property coordinates and save API conflict behavior are preserved. New schema migration retains legacy inventory and animals.

- Latest follow-up explicitly permits wolves to eat chickens left outdoors. Chickens called into the coop are protected; no automatic night shelter without the player's call. This supersedes the earlier chicken immunity decision.
- The skiing screenshots are visual references for soft contact shadows, clear silhouettes, fine ground detail and atmospheric depth. Keep the garden palette and downloaded stylized models; do not introduce snow.
- Show yield/sale value and maturity as icons, numerals and a compact clock. Brief tutorial text remains the sole intentional text exception.

## First-person feedback follow-up
- The direct request explicitly adds visible text labels for E Inventory, M Market and Q God view, plus an Escape pause screen. These supersede the prior restriction on letters outside tutorial text for these specific controls. Interaction is left-click/touch; I/Tab remain aliases. Q toggles the view and preserves player position. All building kits switch to God view for placement.
- The newest direct correction removes the "Click to interact" prompt and all action text under the reticle. The permanent center reticle remains.
- Wolves now visit a chicken-only starter farm after 40 seconds of night. Sheltered birds remain protected. A visible wolf sighting button in God view makes a visit clear and focuses the actual animal. Pack members spread among nearby exposed animals rather than piling onto one target.
- Hens recover from legacy positions inside solid props. Coop entry state resets in daytime; local routes lead around the coop and pots, so birds can leave and return across multiple days. These routes never bypass fences or colliders.
- Distant trees retain the same downloaded source geometry, UVs and silhouette. Bark and foliage render in one draw using separate samplers, rather than swapping to crude old models. Grass now uses curved tapered tufts. New source architecture has physical roof tiles/plank edges/timbers/foundations; the garden's layout and muted palette remain.
