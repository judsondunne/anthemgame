# Balance — living world update

Measured with `node scripts/simulate.js 150 --json`, seed 1247, on 21 October 2026. All prices, limits, and game timers live in `src/config/balance.js`. Tests repeat both the progression and night defense benchmarks.

## Progression

Six scripted strategies have a relaxed budget of 30 taps per game minute. One care tap can feed a group or water the animals at a building. The intended progression remains crops → hens → coop → wheat/hay → barn/cows → stable/horses. Inventory now has ten hotbar and 64 backpack slots, with 99 per consumable stack and one per permanent tool. Additional stacks no longer cause an artificial 99-item aggregate limit.

| Balanced milestone | Game minute |
|---|---:|
| Coop | 1 |
| Barn | 27 |
| First cow | 29 |
| Stable | 58 |
| First horse | 68 |
| All ten beds and six buildings | 111 |

### Net worth

Money + goods + living animals at sale value + half the cost of placed buildings.

| Strategy | 0m | 5m | 10m | 15m | 20m | 30m | 45m | 60m | 75m | 90m | 105m | 120m | 135m | 150m |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| idle | 1,055 | 1,055 | 1,055 | 1,055 | 1,055 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 |
| daisySpam | 1,055 | 274 | 104 | 356 | 79 | 603 | 743 | 739 | 1,705 | 2,697 | 3,681 | 4,659 | 5,637 | 6,601 |
| bestCropOnly | 1,007 | 144 | 195 | 467 | 378 | 683 | 557 | 2,489 | 4,411 | 6,391 | 8,141 | 10,120 | 11,728 | 13,687 |
| chickenFarm | 1,024 | 827 | 844 | 948 | 1,111 | 1,511 | 3,387 | 5,224 | 7,084 | 9,123 | 10,917 | 12,797 | 14,500 | 16,432 |
| balanced | 1,007 | 423 | 793 | 918 | 1,106 | 1,711 | 3,278 | 5,278 | 8,415 | 9,916 | 12,438 | 15,363 | 20,776 | 26,355 |
| horseRush | 1,007 | 1,008 | 1,107 | 1,197 | 1,287 | 1,389 | 1,683 | 1,923 | 2,289 | 2,619 | 1,721 | 2,044 | 2,370 | 2,699 |

| Strategy | Final money | Final worth | Deaths | Taps |
|---|---:|---:|---:|---:|
| idle | 1,000 | 1,000 | 2 | 0 |
| daisySpam | 6,468 | 6,601 | 0 | 4499.5 |
| bestCropOnly | 13,494 | 13,687 | 0 | 1821 |
| chickenFarm | 15,557 | 16,432 | 0 | 4337 |
| balanced | 12,703 | 26,355 | 0 | 4161.5 |
| horseRush | 1,304 | 2,699 | 0 | 643.5 |

The balanced farm completes at minute 111 with zero deaths and finishes above every single-resource strategy by at least 30%. Crop income remains limited by ten beds, growth times, escalating bed prices, and repeated planting/watering. Animal capacity remains limited by housing and the global cap of 30. Buying and immediately selling animals loses money. Ignoring care still loses both starter hens at minute 24.

## Night defenses

The defense benchmark starts with the same six adult female animals (four cows and two horses), seed 1247, and runs twelve full nights. Care clocks reset every 30 seconds, so the table isolates predator harm rather than starvation. The partial pen has one missing segment. The full pen encloses an eight-by-five-cell region with one closed gate. Active flashlight play models a first-person player aiming for 1.5 seconds at wolves within 550 logical units of the herd area; this is a headless response model rather than a measurement of human reaction or browser aim.

| Defense | Fence cost | Total damage | Lowest health | Deaths | Survivors | Wolf pack scares | Predator spawns |
|---|---:|---:|---:|---:|---:|---:|---:|
| noFences | 0 | 585 | 41 | 0 | 6 | 0 | 20 |
| partialFence | 84 | 207 | 54 | 0 | 6 | 0 | 20 |
| closedPen | 87 | 0 | 100 | 0 | 6 | 0 | 20 |
| activeFlashlight | 0 | 266 | 53 | 0 | 6 | 6 | 20 |

The closed pen prevents all damage for 87 coins. An incomplete loop provides no enclosure protection, even though physical segments can delay approach. Regular care avoids a wipeout in this twelve-night sample. The flashlight reduces exposure but cannot protect against bears; fences remain the dependable defense. Sustained attacks can kill an already injured or uncared-for animal, as a separate lifecycle test verifies.

### Rules and tuning

- Only cows and horses are predator targets; chickens stay near home and are never targeted.
- The first encounter is one wolf after the farm owns a cow or horse. Later packs contain one to three wolves. Bears require at least six large animals and have a 16% eligible-night chance.
- Spawns wait 75 seconds into the 300-second night. Wolves move at 34 logical units/s and deal 0.16 health/s; bears move at 23 and deal 0.32. All health starts at 100. Fed and watered animals heal at 0.4 health/s while out of an attack.
- Wolves require 1.5 seconds of flashlight exposure in first person at night. God View cannot scare them. Bears are immune. One seeded 50% suspense draw is shared by a pack; the renderer owns the real-time flicker, two-second pause, and lunge.
- Fences cost 3 per segment, gates cost 12, and deletion refunds 50% of the purchase value rounded to a coin. Solid segments and closed gates block animal/player/predator movement; open gates break enclosure protection.
- Offline catch-up caps at 600 game seconds, freezes animal needs, causes no attacks or predator deaths, and despawns danger. Live predators and alerts are deliberately omitted from saves, while the completed-night schedule is preserved to avoid an immediate repeat on reload.
- Permanent hand, watering can, fishing rod, and flashlight tools can move between slots but cannot be sold or discarded. Failed full-inventory purchases/harvests/collections are atomic, with crops and pickups left in the world.
- Anti-softlock seed/feed gifts remain active; wolves never target the gift-producing starter chickens. Free permanent tools and daytime recovery keep a broke farm playable.

## Validation

`npm test` covers the progression thresholds, defense comparison, every seed across all ten beds and growth stages, fence placement/refund/gates/enclosures/corner collision, animal fence collision, inventory moves/merges/splits/full capacity/migration, targeting, first-person exposure timing, bear immunity, encounter determinism, damage/healing/death/bones, dawn cleanup, and offline/reload safety. Browser graphics and performance are verified separately by the main implementation report.
