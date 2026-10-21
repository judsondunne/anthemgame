# Visual inventory and gameplay contracts

The original canvas renderer remains untouched until the Three.js replacement is verified. Logical coordinates remain in the existing 1400 × 960 world; farm pastures extend horizontally. Rendering will map `(x,y)` to `(x-700, height, (y-650)*1.65)/50`; raycasting maps back with the inverse. Existing A* navigation, care logic, growth, spawning, XP persistence and audio remain authoritative.

| ID | Existing visual and reference | Required replacement |
|---|---|---|
| house | `world.scenery`, house at (630,460), footprint x508–785 y<493 | Downloaded gabled cottage, porch/trim/chimney kitbash from same family |
| coop | `world.coop` (320,818); door(317,821), approach(292,858), bedtime slots | Downloaded small building; sleeping birds retained inside |
| barns | `Farm.pastures`, cow(-190,545), horse(1590,545), shelter y530 | Downloaded barn/building models |
| fences | scenery (354,454),(979,437); pasture boundaries/gates | Downloaded fence segments |
| trees | scenery five trees; three trees per pasture; collision radius18 | Downloaded broadleaf trees |
| bushes | scenery six bushes | Downloaded shrubs |
| flowers | 28 `world.plants` in two beds, four kinds, growth1–1.85; foreground flower clusters | Downloaded flower/plant variants with material sway |
| beds | projected footprints centered(355,637),(710,637), dimensions180×122 | Downloaded garden-bed/planter pieces |
| grass | `world.tufts`; continuous pasture grass | Allowed instanced grass shader |
| pond | `inPond`: center(999,626), radii151×72; rock bank | Allowed water/ground shader plus downloaded rocks |
| koi | five `world.koi`, steering, angle, fishSpot feeding | Downloaded fish with swim clip or shader wag |
| lilies | four lily pads, two lotus flowers in pond | Downloaded aquatic plants |
| chickens | seven `world.chickens`, four breeds; paths, sleep, drink, peck, pet | Downloaded chicken models with clips/material tint |
| chicks | `Farm.chicks`, parent following, growth150seconds | Downloaded chick or scaled downloaded chicken |
| cows/calves | `Farm.animals`, three cows plus births, age scale, queue feeding | Downloaded cow models |
| horses/foals | `Farm.animals`, three horses plus births | Downloaded horse models |
| eggs | `Farm.eggs`, spawned pickup positions, XP15 | Downloaded egg model |
| troughs/feed | `Farm.pastures.feed`, visualFeed, serving queue | Downloaded trough + particle feed |
| path/stones | meandering cottage path, five entry stones | Downloaded path/stepping stone assets |
| lantern/windows | cottage dusk lantern, coop light, window glows | Downloaded lantern/window pieces, emissive materials and PointLights |
| sky/sun/moon/stars | `world.time`, original atmosphere color cycle | Allowed sky shader |
| clouds/cloud shadows | Atmosphere density fields, drifting ground shadows | Allowed sky/ground shader |
| landscape | distant mountains, hills, treeline | Downloaded rocks/trees with distance fog |
| smoke | cottage chimney soft drifting puffs | Allowed particles |
| geese | `Atmosphere.flock`, timed flights and goose audio | Downloaded bird clones with flying animation |
| insects/petals/fireflies | butterflies seven, falling foliage, 26 night glows | Allowed particles |
| needs | max3 `world.needs`, target/kind/born, `fulfillNeed`; heart/water/grain | Icon-only projected bubbles with ring and pointer interaction |
| care feedback | `world.particles`, food, fishFood, watering, ripples, pet squash | Allowed particles/water shader ripples and downloaded animal transforms |
| sleep/dream icons | sleepy poses and letter Zs in old renderer | Sleeping model poses + icon-only moon particles (no letters) |
| progression/navigation | Farm XP/localStorage, feed cursor, side navigation, birth toast | Preserve underlying mechanics; remove text and UI chrome; keyboard/swipe navigation and contextual care |
| audio | `AudioGarden`, `YouTubeGarden`, local playlist, honks, chimes | Preserve gesture-start audio and keyboard audio controls, no visible text |

Final asset mapping and counts are tracked in ASSETS.md; final coverage is audited in verification/REPORT.md.
