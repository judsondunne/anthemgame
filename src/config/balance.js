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
    schemaVersion: 2,
    localDebounceMs: 2000,
    serverDebounceMs: 5000,
    requestTimeoutMs: 4000,
    maxBytes: 200000,
    positionSyncSeconds: 1, // real seconds between agent position write-backs
  },

  inventory: { stackMax: 99 },

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
    daisy: { seed: 3, grow: 70, yield: 2, sell: 3 },
    wheat: { seed: 2, grow: 110, yield: 3, sell: 2, good: "hay" },
    tulip: { seed: 7, grow: 150, yield: 2, sell: 7 },
    cabbage: { seed: 10, grow: 220, yield: 2, sell: 11 },
    sunflower: { seed: 14, grow: 300, yield: 2, sell: 15 },
    lavender: { seed: 22, grow: 420, yield: 2, sell: 22 },
  },
  stages: { growing: 0.34 }, // growth fraction where seedling becomes growing; ripe at 1
  water: { seconds: 160 }, // growth seconds supplied by one watering

  beds: { plots: 6, basePrice: 120, priceGrowth: 1.3, max: 10, footprint: [4, 3] },

  species: {
    chicken: {
      buy: { f: 80, m: 60 },
      sell: { f: 40, m: 30 },
      food: ["feed_chicken", "hay"],
      product: "egg",
      produceEvery: 110,
      hungryAfter: 240,
      thirstyAfter: 220,
      growDays: 3,
      breedDays: 2,
      baseCapacity: 4,
    },
    cow: {
      buy: { f: 550, m: 420 },
      sell: { f: 300, m: 240 },
      food: ["feed_cow", "hay"],
      product: "milk",
      produceEvery: 260,
      hungryAfter: 300,
      thirstyAfter: 260,
      growDays: 3,
      breedDays: 2,
      baseCapacity: 0,
      unlockedBy: "barn",
    },
    horse: {
      buy: { f: 1600, m: 1400 },
      sell: { f: 1150, m: 1050 },
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
  animals: { maxTotal: 30 },

  buildings: {
    coop: { price: 650, max: 2, footprint: [4, 4], zone: "garden", capacity: { chicken: 6 }, produce: 1.5, fertility: 1.5 },
    barn: { price: 2200, max: 2, footprint: [6, 5], zone: "west", capacity: { cow: 4 }, produce: 1.1, fertility: 1.1 },
    stable: { price: 5200, max: 2, footprint: [6, 5], zone: "east", capacity: { horse: 4 }, produce: 1, fertility: 1.15 },
  },

  feed: {
    feed_chicken: { price: 8, units: 6 },
    feed_cow: { price: 14, units: 5 },
    feed_horse: { price: 22, units: 4 },
  },

  goods: { egg: 6, milk: 28, hay: 2 }, // crop goods use crops[*].sell

  market: { driftAmplitude: 0.1 }, // gentle deterministic daily price drift, +/- 10%

  pickups: { max: 30, spread: 70 },

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
