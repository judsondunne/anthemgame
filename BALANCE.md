# Balance

Every number lives in `src/config/balance.js`. `npm run simulate` (`scripts/simulate.js`) plays six scripted strategies against the pure simulation for 150 game minutes with a **30 taps/minute** budget (a relaxed player, not a macro): feeding a flock by scattering grain or a herd at a trough is one tap, watering is one tap per building or bed, harvesting a bed is one tap, buying is two taps plus one to place. `tests/balance.test.js` re-runs the same strategies on every `npm test` and fails if the properties below stop holding.

## The intended loop

$1,000 → plant and sell crops, collect eggs → more beds and hens → coop → wheat for hay → barn → cows (milk) → stable → horses (foals) → a full farm.

| Milestone (balanced strategy) | Game minute |
|---|---:|
| Coop placed | 1 |
| Barn placed | 27 |
| First cow | 29 |
| Stable placed | 58 |
| First horse | 68 |
| All 10 beds, 2 coops, 2 barns, 2 stables | **115** |

The first ten minutes: the starting cash buys two beds, three hens and a coop straight away, eggs and daisies pay out within a minute or two, and net worth is already climbing by minute 10.

## Net worth over time (money + goods + animals at sell value + half building cost)

| strategy | 0m | 5m | 10m | 15m | 20m | 30m | 45m | 60m | 75m | 90m | 105m | 120m | 135m | 150m |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| idle | 1,055 | 1,055 | 1,055 | 1,055 | 1,055 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 |
| daisySpam | 1,055 | 274 | 104 | 356 | 79 | 603 | 742 | 737 | 1,700 | 2,629 | 3,565 | 4,485 | 5,435 | 6,371 |
| bestCropOnly | 1,007 | 144 | 195 | 467 | 378 | 683 | 556 | 2,487 | 4,388 | 6,302 | 7,992 | 9,919 | 11,465 | 13,358 |
| chickenFarm | 1,024 | 827 | 844 | 948 | 1,111 | 1,511 | 3,387 | 5,224 | 7,084 | 9,123 | 10,917 | 12,797 | 14,500 | 16,432 |
| **balanced** | 1,007 | 423 | 793 | 918 | 1,106 | 1,711 | 3,279 | 5,280 | 8,422 | 10,005 | 12,709 | 15,565 | 20,991 | **26,392** |
| horseRush | 1,007 | 1,008 | 1,107 | 1,197 | 1,287 | 1,389 | 1,682 | 1,921 | 2,266 | 2,530 | 1,616 | 1,832 | 2,126 | 2,362 |

## Money on hand over time

| strategy | 0m | 5m | 10m | 15m | 20m | 30m | 45m | 60m | 75m | 90m | 105m | 120m | 135m | 150m |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| idle | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 | 1,000 |
| daisySpam | 1,000 | 198 | 49 | 275 | 24 | 526 | 634 | 630 | 1,560 | 2,483 | 3,419 | 4,331 | 5,325 | 6,249 |
| bestCropOnly | 952 | 52 | 94 | 314 | 305 | 604 | 466 | 2,302 | 4,258 | 6,114 | 7,840 | 9,748 | 11,322 | 13,158 |
| chickenFarm | 939 | 293 | 29 | 57 | 134 | 609 | 2,316 | 4,265 | 6,146 | 8,230 | 10,042 | 11,902 | 13,618 | 15,557 |
| balanced | 952 | 48 | 370 | 126 | 256 | 214 | 225 | 331 | 1,707 | 461 | 662 | 3,178 | 6,776 | 9,839 |
| horseRush | 952 | 928 | 1,048 | 1,120 | 1,222 | 1,318 | 1,576 | 1,804 | 2,122 | 2,410 | 76 | 330 | 600 | 864 |

The balanced player keeps spending as it climbs (money stays low until the farm is complete at minute 115), then banks quickly: about $400/min after the build-out.

| strategy | milestones | deaths | taps used |
|---|---|---:|---:|
| idle | first death at 24 min | 2 | 0 |
| daisySpam | all beds at 50 | 0 | 4,500 |
| bestCropOnly | all beds at 40 | 0 | 1,760 |
| chickenFarm | coop at 0 | 0 | 4,337 |
| balanced | coop 1, barn 27, cow 29, stable 58, horse 68, full farm 115 | 0 | 4,163 |
| horseRush | stable at 93 | 0 | 597 |

## Why no strategy degenerates

- **Land plateaus.** Crop margins are small per plot ($1.2–2.0/min) and beds are capped at 10 with escalating prices (100 × 1.32ⁿ), so crop income tops out around $120/min and grows linearly, never compounding. The cheapest crop is also the most labour-hungry (replant every 50 s), so daisy spam is the weakest farming plan (6.4k at 150 min).
- **Each animal tier is capped by housing**, with a global cap of 30 animals; growth beyond the cap is impossible, and babies wait for room.
- **No arbitrage.** Every animal sells for less than it costs; seeds and feed cannot be resold. Daily sell prices drift deterministically by at most ±10%.
- **Later tiers earn more in total but pay back slower**, so the interesting decisions are about order, not a single best item. Steady-state $/min at full capacity: hens $4 (coop $6), cows $19 each, a breeding horse pair ~$98 in foals, a lavender bed ~$12. A full farm earns ~$530/min, roughly four times any single-resource plan.
- **Rushing is punished**: saving straight for a stable with no income takes 93 minutes (horseRush).
- **Neglect costs**: the idle farm loses both hens by minute 24.

## Key numbers (excerpt of balance.js)

| | value |
|---|---|
| day / night | 300 s / 300 s (one game day = 10 real minutes) |
| start | $1,000; 1 bed with 2 daisies; 4 daisy + 3 wheat seeds; 6 chicken feed; hen + rooster |
| crops (seed $ / grow s / yield / sell $) | daisy 1/50/1/2, wheat 1/90/2 hay, tulip 3/120/1/6, cabbage 5/180/1/10, sunflower 8/260/1/16, lavender 12/360/1/24 |
| one watering | 160 s of growth |
| beds | 6 plots; $100 × 1.32ⁿ; max 10 |
| hens / roosters | $60 / $50 (sell $30 / $25); egg every 90 s, $6 |
| cows / bulls | $300 / $250 (sell $220 / $180); milk every 240 s, $70 |
| mares / stallions | $2,200 / $2,000 (sell $1,800 / $1,600) |
| coop / barn / stable | $400 (+6 hens, eggs ×1.5, fertility ×1.5) / $900 (+4 cows) / $2,500 (+4 horses, fertility ×1.15) |
| needs | hungry after 240–300 s, thirsty after 220–260 s; urgent after 1 day unmet, sad 1.5, dead 2, bones 0.5 later |
| breeding / growing | a content pair: one baby per 2 game days ÷ fertility; juveniles mature in 3 game days |
| offline catch-up | at most 600 game s; need clocks frozen |
| anti-softlock | broke + nothing to plant/sell/collect → 3 daisy seeds every 45 s; hungry animals with no food and no money → 1 feed each |
