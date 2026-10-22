# Balance — cozy quality update

Measured on 21 October 2026, seed 1247, default timescale. All tunables are in src/config/balance.js; the camera, night, visual and world modules expose stable import proxies. Raw evidence: verification/v5/balance.json. Reproduce with npm run simulate or node scripts/simulate.js 150 --json.

## Growth and care

| Crop | Watered growth | Seed cost | Yield | Unit sale base |
|---|---:|---:|---:|---:|
| Daisy | 24 s | 1 | 2 | 3 |
| Wheat | 32 s | 1 | 4 hay | 1 |
| Tulip | 42 s | 3 | 2 | 8 |
| Cabbage | 120 s | 5 | 2 | 20 |
| Sunflower | 180 s | 8 | 2 | 34 |
| Lavender | 240 s | 12 | 2 | 48 |

Planting starts dry; water again at the visible growing-stage boundary (34%). Dry crops pause rather than die. The listed times exclude the player's watering delay. Replanting clears old water. Premium crops need the same two intentional watering taps.

Breeding is 300 seconds (.5 game day) before housing fertility multipliers, versus 1200 seconds before this update. Babies mature in 510 seconds (.85 day). Female chickens lay every 45 seconds and cows produce milk every 80 seconds before housing production multipliers. Milk remains 210 coins; feed still costs coins and wheat/hay provides a farming alternative. Needs become urgent after one day unmet; neglect death still requires two game days after hunger/thirst starts. Offline catch-up freezes needs and never kills.

## Bounded progression

The six scripted plans receive 30 taps per real/game minute at timescale 1. Scatter/trough care and grouped harvesting count as one tap; planting six plots costs 1.5 taps. Investments reserve enough taps instead of letting fast chores consume the entire budget. Closed pens are paid for before large livestock purchases. Crops are limited to ten beds × six plots, animals to thirty total plus housing capacity, buildings to two of each type, consumable stacks to 99, and fences to 800. Daily market drift is ±10%. No animal/feed/building buy-and-immediate-sale arbitrage exists; crop income requires seeds, finite beds and active watering.

Balanced milestones: first coop minute 0, barn 5, first closed pen 6, cow 6, stable 13, horse 14, all ten beds and six buildings 21. Protected balanced strategy deaths: 0. The best-crop-only plan fills ten beds at minute 7; its bounded income remains linear.

| Plan, 150 minutes | Final money | Net worth | Deaths | Taps |
|---|---:|---:|---:|---:|
| idle | 1,000 | 1,000 | 2 | 0 |
| daisySpam | 26,706 | 26,821 | 0 | 4500 |
| bestCropOnly | 176,422 | 176,555 | 0 | 2562 |
| chickenFarm | 39,431 | 40,408 | 0 | 4500 |
| balanced | 323,136 | 337,748 | 0 | 4429 |
| horseRush | 153,777 | 160,027 | 0 | 2335 |

Net worth includes money, goods, living livestock at sale value and half placed-building cost. Balanced final worth is 1.91× best-crop-only worth; its last-thirty-minute income is 2.16× crop-only income. The assertions retain both checks so a single-resource infinite-profit strategy cannot silently dominate. Idle loses the starter birds at minute 24; active strategies had no deaths. These are deterministic bots, not a claim about every human playthrough.

## Predator diagnosis and defense

The original seed-6 reproduction spawned a wolf across the brook at radius 2250; local steering never brought it closer than 3450 logical units to the cow before dawn. Both this arrival regression and the first-night one-wolf regression were run failing before the fix. Night entries now choose a clear reachable approach about 620 units from livestock. Progress-aware bounded routing handles walls, distant waypoints and local oscillation.

Wolves visit every night: one gentle wolf on chicken-only farms, otherwise min(4, 2 + floor(large-herd/5)), so 2–4 wolves from the first cow/horse onward. They arrive at 40 seconds, 13% into the 300-second night, move 54 logical units/s and deal .32 health/s. The early lone wolf deals .12 health/s. Bears independently roll 72% per night with six or more large livestock, arrive at 105 seconds, move 36 units/s and deal .65 health/s. Bears can accompany wolves.

Wolves require 1.5 seconds of aimed first-person flashlight exposure; bears are immune. Outdoor cows/horses are prioritized, then exposed chickens. Closed pens and chickens inside closed coops receive no damage. Protected farms still get prowling/howling packs; dawn removes them. Fed/watered animals heal .4 health/s out of attack. Offline catch-up clears danger, never spawns it and cannot cause predator/neglect deaths.

Twelve-night benchmark, six cared-for large animals, same seed:

| Defense | Fence cost | Damage | Deaths | Survivors | Scares | Wolves/bears |
|---|---:|---:|---:|---:|---:|---:|
| noFences | 0 | 3417 | 1 | 5 | 0 | 36/7 |
| partialFence | 84 | 2917 | 0 | 6 | 0 | 36/9 |
| closedPen | 87 | 0 | 0 | 6 | 0 | 36/9 |
| activeFlashlight | 0 | 220 | 1 | 5 | 12 | 36/2 |

The 87-coin closed pen prevents all damage. A gap delays attackers but provides no enclosure protection. The flashlight greatly reduces wolf exposure; bears still require fences. Unfenced losses remain recoverable in this measured sample. Anti-softlock gifts and daytime recovery remain enabled.

## Shelter, water and persistence

Hens automatically hurry home at hour 18, settle in assigned capacity-correct roosts, close the hatch at night and walk out at dawn. Late residents briefly reopen the hatch; overflow birds roost outside. Nest eggs and hatch state persist in schema 4. Newborn sheltered chicks hatch at a free assigned roost. Legacy coops with unreachable flush-front doors shift to the nearest valid grid position during migration without losing purchases or residents.

Unpenned cows/horses visit a shallow brook spot between hours 8–18, drink for 32 seconds and return. Closed fences are absolute; ordinary pens use troughs unless they enclose reachable water. No animals drown. Wildlife is deterministic, unsaved and capped at 16 high/7 low.
