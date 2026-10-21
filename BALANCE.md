# Balance — living world update

Measured with `node scripts/simulate.js 150 --json`, seed 1247, on 21 October 2026. All prices, limits, and game timers live in `src/config/balance.js`. Tests repeat both the progression and night defense benchmarks.

## Progression

Six scripted strategies have a relaxed budget of 30 taps per game minute. One care tap can feed a group or water the animals at a building. The intended progression remains crops → hens → coop → wheat/hay → barn/cows → stable/horses. Inventory now has ten hotbar and 64 backpack slots, with 99 per consumable stack and one per permanent tool. Additional stacks no longer cause an artificial 99-item aggregate limit.

| Balanced milestone | Game minute |
|---|---:|
| Coop | 1 |
| Barn | 15 |
| First cow | 16 |
| Stable | 32 |
| First horse | 36 |
| All ten beds and six buildings | 80 |

### Net worth

Money + goods + living animals at sale value + half the cost of placed buildings.

| Strategy | 0m | 5m | 10m | 15m | 20m | 30m | 45m | 60m | 75m | 90m | 105m | 120m | 135m | 150m |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| idle | 1,055 | 1,055 | 1,055 | 1,055 | 1,055 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 |
| daisySpam | 1,055 | 206 | 385 | 491 | 373 | 2,119 | 4,789 | 7,411 | 10,021 | 12,553 | 15,091 | 17,669 | 20,209 | 22,810 |
| bestCropOnly | 1,007 | 208 | 300 | 593 | 1,045 | 3,949 | 10,369 | 15,127 | 21,439 | 26,305 | 32,185 | 36,988 | 42,528 | 47,255 |
| chickenFarm | 1,024 | 853 | 882 | 906 | 922 | 2,477 | 5,216 | 8,132 | 11,056 | 14,088 | 16,940 | 19,615 | 22,554 | 25,293 |
| balanced | 1,007 | 457 | 907 | 1,718 | 2,132 | 4,729 | 11,840 | 17,287 | 27,288 | 37,833 | 49,625 | 60,965 | 71,971 | 82,932 |
| horseRush | 1,007 | 1,012 | 1,257 | 1,491 | 1,721 | 1,973 | 1,497 | 1,979 | 2,787 | 3,391 | 3,723 | 4,444 | 5,044 | 4,955 |

| Strategy | Final money | Final worth | Deaths | Taps |
|---|---:|---:|---:|---:|
| idle | 1,000 | 1,000 | 2 | 0 |
| daisySpam | 22,695 | 22,810 | 0 | 4500 |
| bestCropOnly | 47,038 | 47,255 | 0 | 1879 |
| chickenFarm | 24,394 | 25,293 | 0 | 4421 |
| balanced | 67,734 | 82,932 | 0 | 4369.5 |
| horseRush | 118 | 4,955 | 0 | 775.5 |

The balanced farm completes at minute 80 with zero deaths. Daisy, tulip, cabbage, sunflower and lavender now yield two items; wheat yields four hay. Milk sells for 210. The unchanged late-income test passes: the balanced farm earns 2.14 times the best crop strategy over the last 30 minutes. Each strategy calls its hens in at dusk within its tap budget. Ignoring care loses both starter hens at minute 24.

## Night defenses

The defense benchmark starts with the same six adult female animals (four cows and two horses), seed 1247, and runs twelve full nights. Care clocks reset every 30 seconds, so the table isolates predator harm rather than starvation. The partial pen has one missing segment. The full pen encloses an eight-by-five-cell region with one closed gate. Active flashlight play models a first-person player aiming for 1.5 seconds at wolves within 550 logical units of the herd area; this is a headless response model rather than a measurement of human reaction or browser aim.

| Defense | Fence cost | Total damage | Lowest health | Deaths | Survivors | Wolf pack scares | Predator spawns |
|---|---:|---:|---:|---:|---:|---:|---:|
| noFences | 0 | 571 | 41 | 0 | 6 | 0 | 20 |
| partialFence | 84 | 157 | 41 | 0 | 6 | 0 | 20 |
| closedPen | 87 | 0 | 100 | 0 | 6 | 0 | 20 |
| activeFlashlight | 0 | 260 | 42 | 0 | 6 | 6 | 20 |

The closed pen prevents all damage for 87 coins. An incomplete loop provides no enclosure protection, even though physical segments can delay approach. Regular care avoids a wipeout in this twelve-night sample. The flashlight reduces exposure but cannot protect against bears; fences remain the dependable defense. Sustained attacks can kill an already injured or uncared-for animal, as a separate lifecycle test verifies.

### Rules and tuning

- Outdoor chickens, cows and horses are predator targets. Chickens only enter the coop after the player calls them in near dusk; indoors they are safe. This follows the later direct user request.
- The first encounter is one wolf after the farm owns a cow or horse. Later packs contain one to three wolves. Bears require at least six large animals and have a 16% eligible-night chance.
- Spawns wait 75 seconds into the 300-second night. Wolves move at 34 logical units/s and deal 0.16 health/s; bears move at 23 and deal 0.32. All health starts at 100. Fed and watered animals heal at 0.4 health/s while out of an attack.
- Wolves require 1.5 seconds of flashlight exposure in first person at night. God View cannot scare them. Bears are immune. One seeded 50% suspense draw is shared by a pack; the renderer owns the real-time flicker, two-second pause, and lunge.
- Fences cost 3 per segment, gates cost 12, and deletion refunds 50% of the purchase value rounded to a coin. Solid segments and closed gates block animal/player/predator movement; open gates break enclosure protection.
- Offline catch-up caps at 600 game seconds, freezes animal needs, causes no attacks or predator deaths, and despawns danger. Live predators and alerts are deliberately omitted from saves, while the completed-night schedule is preserved to avoid an immediate repeat on reload.
- Permanent hand, watering can, fishing rod, and flashlight tools can move between slots but cannot be sold or discarded. Failed full-inventory purchases/harvests/collections are atomic, with crops and pickups left in the world.
- Anti-softlock seed/feed gifts remain active; daytime recovery and gifts remain available even if outdoor chickens are lost. Free permanent tools and daytime recovery keep a broke farm playable.

## Validation

`npm test` covers the progression thresholds, defense comparison, every seed across all ten beds and growth stages, fence placement/refund/gates/enclosures/corner collision, animal fence collision, inventory moves/merges/splits/full capacity/migration, targeting, first-person exposure timing, bear immunity, encounter determinism, damage/healing/death/bones, dawn cleanup, and offline/reload safety. Browser graphics and performance are verified separately by the main implementation report.

## First-person feedback follow-up — current values

This section supersedes the earlier night schedule table. Wolves now also visit chicken-only farms after 40 seconds of night. Indoor hens are protected; pack targeting spreads among exposed animals. The original progression and defense assertions are unchanged. `verification/v4/balance.json` contains the full new run.

| Strategy | Final money | Final worth | Deaths |
|---|---:|---:|---:|
| idle | 1,000 | 1,000 | 2 |
| daisySpam | 22,818 | 22,952 | 0 |
| bestCropOnly | 46,702 | 46,926 | 0 |
| chickenFarm | 28,097 | 28,972 | 0 |
| balanced | 66,146 | 81,638 | 0 |
| horseRush | 72 | 4,862 | 0 |

The balanced farm completes at minute 78, with 0 deaths.

| Defense | Fence cost | Damage | Lowest health | Deaths |
|---|---:|---:|---:|---:|
| noFences | 0 | 756 | 31 | 0 |
| partialFence | 84 | 218 | 50 | 0 |
| closedPen | 87 | 0 | 100 | 0 |
| activeFlashlight | 0 | 374 | 31 | 0 |

## Quality update — predator diagnosis and retune (schema 4)

This section supersedes the earlier predator timings. A failing regression on seed 6 reproduced the missing-wolf report: the random radius-2250 spawn placed a wolf beyond the brook, and local steering never brought it closer than 3450 logical units to the cow before dawn. Night groups now choose a clear approach about 620 units from livestock and use obstacle routing. The seed-6 arrival regression and first-night pack regression were run failing before the fix.

Wolves now arrive every eligible night at 40 seconds (13% of the 300-second night). Chicken-only farms receive a gentle lone wolf at 0.12 health/s. Owning any cow or horse triggers 2–4 wolves: `min(4, 2 + floor(herd / 5))`, including the first night and fully enclosed farms. Wolves move at 54 units/s and deal 0.32 health/s, twice the previous sustained damage. Bears are an independent 72% roll with at least six cows/horses, arrive at 105 seconds, move at 36 units/s and deal 0.65 health/s; they can accompany wolves. Wolves still need 1.5 seconds of first-person flashlight exposure; bears remain immune. Packs howl on arrival and while prowling. Closed pens and chickens inside closed coops receive no damage. Offline catch-up neither spawns predators nor damages animals.

A twelve-night seed-1247 benchmark with six cared-for animals measured 2 deaths / 4 survivors without fences, 0 deaths with a one-segment gap, 0 damage and 6 survivors in an 87-coin closed pen, and 1 death / 5 survivors with active flashlight use. A gap delays approach but is not safe. These are recoverable losses for a reckless farm; the closed pen remains the dependable defense. Production and faster-crop measurements are updated in the next section.
