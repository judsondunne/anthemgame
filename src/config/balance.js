// Every tunable gameplay number lives here: prices, growth times, rates, timers,
// durations, caps and footprints. Simulation, renderer and UI import from this
// file only. Times are game seconds unless a name says otherwise.

const daySeconds = 300;
const nightSeconds = 300;
const DAY = daySeconds + nightSeconds;

export const BALANCE = {
  time: {
    daySeconds,
    nightSeconds,
    cycleSeconds: DAY,
    dawnHour: 6, // the day phase spans dawn -> dusk, the night phase dusk -> dawn
    duskHour: 20,
    startHour: 7,
    maxFrameSeconds: 0.05, // real seconds per rendered frame before clamping
    substepSeconds: 1, // simulation integration step
    maxTimescale: 2000,
  },

  offline: {
    capSeconds: 600, // at most one game day of catch-up
    stepSeconds: 2,
  },

  save: {
    schemaVersion: 3,
    localDebounceMs: 2000,
    serverDebounceMs: 5000,
    requestTimeoutMs: 4000,
    maxBytes: 200000,
    positionSyncSeconds: 1, // real seconds between agent position write-backs
  },

  inventory: { stackMax: 99, hotbarSlots: 10, backpackSlots: 64 },

  fences: {
    price: 3, gatePrice: 12, refund: 0.5, max: 800,
    bounds: { gx0: -110, gx1: 150, gy0: -70, gy1: 140 },
    maxFloodCells: 60000, nudge: 5, playerClearance: 14,
  },
  predators: {
    delayIntoNight: 40, maxWolves: 3, bearAfterHerd: 6, bearChance: 0.16,
    wolfSpeed: 34, bearSpeed: 23, fleeSpeed: 100, spawnRadius: 2250,
    attackRange: 34, alertRange: 400, wolfDamage: 0.16, bearDamage: 0.32,
    targetSpread: 450, scareSeconds: 1.5, exposureDecay: 1, encounterChance: 0.5,
    retreatSeconds: 12, maxHealth: 100, healPerSecond: 0.4,
    injuryThreshold: 60, restSpeed: 0.65,
  },
  wandering: { chickenSpeed: 17, chickenDecisionSeconds: 9, speed: 9, chickenRadius: 72, herdRadius: 165, wanderRadius: 650, wanderChance: 0.24, decisionSeconds: 24, returnRadius: 30 },

  start: {
    money: 1000,
    seed: 1247,
    inventory: { seed_daisy: 4, seed_wheat: 3, feed_chicken: 6 },
    planted: ["daisy", "daisy"],
    animals: [
      { sp: "chicken", sex: "f" },
      { sp: "chicken", sex: "m" },
    ],
  },

  // Cheap/fast/low value -> slow/high value. Growth only accrues while watered.
  crops: {
    daisy: { seed: 1, grow: 50, yield: 2, sell: 2 },
    wheat: { seed: 1, grow: 90, yield: 4, good: "hay" },
    tulip: { seed: 3, grow: 120, yield: 2, sell: 6 },
    cabbage: { seed: 5, grow: 180, yield: 2, sell: 10 },
    sunflower: { seed: 8, grow: 260, yield: 2, sell: 16 },
    lavender: { seed: 12, grow: 360, yield: 2, sell: 24 },
  },
  stages: { growing: 0.34 }, // growth fraction where seedling becomes growing; ripe at 1
  water: { seconds: 160 }, // growth seconds supplied by one watering

  beds: { plots: 6, basePrice: 100, priceGrowth: 1.32, max: 10, footprint: [4, 3] },

  species: {
    chicken: {
      buy: { f: 60, m: 50 },
      sell: { f: 30, m: 25 },
      food: ["feed_chicken", "hay"],
      product: "egg",
      produceEvery: 90,
      hungryAfter: 240,
      thirstyAfter: 220,
      growDays: 3,
      breedDays: 2,
      baseCapacity: 4,
    },
    cow: {
      buy: { f: 300, m: 250 },
      sell: { f: 220, m: 180 },
      food: ["feed_cow", "hay"],
      product: "milk",
      produceEvery: 240,
      hungryAfter: 300,
      thirstyAfter: 260,
      growDays: 3,
      breedDays: 2,
      baseCapacity: 0,
      unlockedBy: "barn",
    },
    horse: {
      buy: { f: 2200, m: 2000 },
      sell: { f: 1800, m: 1600 },
      food: ["feed_horse", "hay"],
      product: null, // horses are the premium breed-and-sell animal
      produceEvery: 0,
      hungryAfter: 300,
      thirstyAfter: 260,
      growDays: 3,
      breedDays: 2,
      baseCapacity: 0,
      unlockedBy: "stable",
    },
  },
  // Hungry/thirsty animals still produce, slower, so a broke farm can recover.
  neglect: { produceFactor: 0.5, urgentDays: 1, sadDays: 1.5, deathDays: 2, bonesDays: 0.5 },
  animals: { maxTotal: 30, radius: {chicken:12,cow:29,horse:32}, separation:3 },
  coop: {callHour:18,runSpeed:32,doorRadius:28,roostSpacing:36,rowSpacing:22},

  buildings: {
    coop: { price: 400, max: 2, footprint: [4, 4], zone: "garden", capacity: { chicken: 6 }, produce: 1.5, fertility: 1.5 },
    barn: { price: 900, max: 2, footprint: [6, 5], zone: "west", capacity: { cow: 4 }, produce: 1.1, fertility: 1.1 },
    stable: { price: 2500, max: 2, footprint: [6, 5], zone: "east", capacity: { horse: 4 }, produce: 1, fertility: 1.15 },
  },

  feed: {
    feed_chicken: { price: 6, units: 6 },
    feed_cow: { price: 10, units: 5 },
    feed_horse: { price: 16, units: 4 },
  },

  goods: { egg: 6, milk: 210, hay: 1 }, // crop goods use crops[*].sell

  market: { driftAmplitude: 0.1 }, // gentle deterministic daily price drift, +/- 10%

  pickups: { max: 30, spread: 70, collectRadius: 190 },

  softlock: { intervalSeconds: 45, seeds: { seed_daisy: 3 }, feedPerHungryAnimal: 1 },

  ui: {
    coinPopMs: 900,
    shakeMs: 420,
    holdToSellAllMs: 550,
    holdRepeatStartMs: 380,
    holdRepeatMs: 110,
    flourishMs: 2600,
    wiggleSeconds: 0.6,
    dustSeconds: 1.2,
    popInSeconds: 0.55,
    collapseSeconds: 1.4,
    cameraPanSeconds: 0.7,
    placementTapSlopPx: 12,
  },
};

export const DAY_SECONDS = DAY;
export default BALANCE;
