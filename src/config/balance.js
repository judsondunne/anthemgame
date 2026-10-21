// Every tunable gameplay number lives here: prices, growth times, rates, timers,
// durations, caps and footprints. Simulation, renderer and UI import from this
// file only. Times are game seconds unless a name says otherwise.

const daySeconds = 300;
const nightSeconds = 300;
const DAY = daySeconds + nightSeconds;

export const BALANCE = {
  // Camera/lighting/render controls are exposed through stable config proxies.
  camera: {
    "fov": 48,
    "minDistance": 1.7,
    "maxDistance": 148,
    "defaultDistance": 35.5,
    "minPitch": 0.19,
    "maxPitch": 1.43,
    "defaultPitch": 0.79,
    "defaultYaw": 0.2,
    "damping": 11,
    "inertia": 7,
    "orbitSpeed": 0.005,
    "zoomSpeed": 0.0018,
    "dragThreshold": 7,
    "touchDragThreshold": 9,
    "bounds": 88,
    "softEdge": 8,
    "eyeHeight": 1.7,
    "radius": 0.26,
    "walkSpeed": 3.25,
    "sprintSpeed": 5.4,
    "acceleration": 12,
    "gravity": 18,
    "jumpSpeed": 6.1,
    "lookSpeed": 0.0021,
    "pitchLimit": 1.45,
    "maxSlopeStep": 0.3,
    "reach": 4.5,
    "assistRadius": 88,
    "doubleTapMs": 300,
    "headBob": 0.018,
    "transitionRate": 9,
    "collisionStep": 0.12,
    "godKeySpeed": 0.65,
    "near": 0.035,
    "far": 430
  },
  night: {
    "flashlight": {
      "power": 48,
      "range": 27,
      "angle": 0.43035515802599905,
      "penumbra": 0.68,
      "eyeRange": 30,
      "coneDot": 0.9,
      "scareSeconds": 1.5,
      "nearWolf": 15,
      "beamOpacity": 0.032
    },
    "suspense": {
      "probability": 0.5,
      "flickerSeconds": 0.55,
      "waitSeconds": 2,
      "lungeSeconds": 0.36,
      "recoverSeconds": 0.7,
      "cooldownSeconds": 32,
      "maxDistance": 14
    },
    "tutorial": {
      "seconds": 13,
      "duskHour": 18.5
    },
    "eyes": {
      "chicken": {
        "h": 0.43,
        "w": 0.105,
        "forward": 0.14
      },
      "cow": {
        "h": 0.96,
        "w": 0.23,
        "forward": 0.36
      },
      "horse": {
        "h": 1.36,
        "w": 0.19,
        "forward": 0.4
      },
      "wolf": {
        "h": 0.8,
        "w": 0.17,
        "forward": 0.38
      },
      "bear": {
        "h": 1.17,
        "w": 0.23,
        "forward": 0.46
      }
    }
  },
  visual: {
    "grass": {
      "high": 8500,
      "low": 2600,
      "blades": 6,
      "height": 0.16,
      "width": 0.018
    },
    "held": {
      "size": 1.05,
      "x": 0.54,
      "y": -0.56,
      "z": -1.6
    },
    "ao": {
      "radius": 5,
      "minDistance": 0.0003,
      "maxDistance": 0.055
    },
    "shadow": {
      "high": 2048,
      "low": 1024
    },
    "hudHz": 10,
    "lowMotionHz": 12,
    "egg": {
      "height": 0.32,
      "ringRadius": 0.23
    },
    "detail": {
      "sunRadius": 0.0074,
      "moonRadius": 0.009
    },
    "maturityBadge": 64
  },
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
    schemaVersion: 4,
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
    delayIntoNight: 40, minWolves: 2, maxWolves: 4, herdPerWolf: 5,
    bearAfterHerd: 6, bearChance: .72, bearDelayIntoNight: 105,
    wolfSpeed: 54, bearSpeed: 36, fleeSpeed: 100, spawnRadius: 2250,
    arrivalRadius: 620, arrivalAttempts: 24, packSpacing: 30,
    attackRange: 34, alertRange: 520, wolfDamage: .32, bearDamage: .65,
    gentleDamage: .12, prowlRadius: 160, prowlSpeed: .65, howlEvery: 45,
    targetSpread: 450, scareSeconds: 1.5, exposureDecay: 1, encounterChance: 0.5,
    retreatSeconds: 12, maxHealth: 100, healPerSecond: 0.4,
    injuryThreshold: 60, restSpeed: 0.65,
  },
  wandering: { chickenSpeed: 17, chickenDecisionSeconds: 9, speed: 9, chickenRadius: 72, herdRadius: 165, wanderRadius: 650, wanderChance: 0.24, decisionSeconds: 24, returnRadius: 30 },
  movement: { stepHeight: .32, maxJumpTop: 1.2, swimSpeed: 1.6, wadeSpeed: 2.1, buoyancy: 8, floatEyeHeight: 1.05, waterDrag: 5, shoreStep: .45, rippleInterval: .45, diveDip: .85,
    routeStep: 16, routeNodes: 800, routeWindow: 30, routeStuckSeconds: 2,
  },
  waterBodies: { pond: { x: 5.98, z: -.792, rx: 3.02, rz: 2.376, surface: .12, maxDepth: 1.8, edgeDepth: .03 }, brook: { maxDepth: 1.65, edgeDepth: .08 } },
  livestockWater: { visitChance: 1, visitSpeed: 100, durationSeconds: 32, decisionSeconds: 180, thirstRecovery: 12, startHour: 8, returnHour: 18 },
  wildlife: { highCount: 16, lowCount: 7, activeDistance: 65, despawnDistance: 84, fleeDistance: 9, predatorFleeDistance: 13, wanderSpeed: .65, fleeSpeed: 3.4, hopHeight: .16, drinkHours: [5, 8, 17, 20], repathSeconds: 4,
    candidateCount: 36, habitatRadius: 8, grazeSeconds: 5, activeHz: 10, seedEpochSeconds: 600,
    modelHeight: { deer: 1.25, elk: 1.65, bunny: .38 }, radii: { deer: .35, elk: .42, bunny: .18 }, bunnyEdge: 15.5, chunkSize: 24,
  },
  world: {
    seed: 721031, radius: 92, property: { halfWidth: 38, halfDepth: 17, blend: 14 }, terrainSegments: 112,
    forest: { spacing: 4.6, jitter: .82, chunkSize: 40, nearDistance: 54, farDistance: 145, shadowDistance: 44, undergrowthSpacing: 3.2, lowUndergrowthDistance: 30, highUndergrowthDistance: 56 },
    brook: { x: 46, meander: 7, halfWidth: 1.7, shoreWidth: 2.8, crossingZ: 8, crossingHalfDepth: 1.7, rocks: 110 },
    particles: { high: 150, low: 65 },
  },
  cottage: { halfWidth: 3.1, depth: 5.4, floor: .12, wallHeight: 2.6, doorWidth: 1.2, doorSpeed: 4, cutawayDistance: 20, lightDay: .45, lightNight: 1.55 },

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
    daisy: { seed: 1, grow: 24, yield: 2, sell: 3 },
    wheat: { seed: 1, grow: 32, yield: 4, good: "hay" },
    tulip: { seed: 3, grow: 42, yield: 2, sell: 8 },
    cabbage: { seed: 5, grow: 120, yield: 2, sell: 20 },
    sunflower: { seed: 8, grow: 180, yield: 2, sell: 34 },
    lavender: { seed: 12, grow: 240, yield: 2, sell: 48 },
  },
  stages: { growing: 0.34 }, // growth fraction where seedling becomes growing; ripe at 1
  water: { seconds: 160, dryAtStage: true }, // watering is renewed at each visible growth stage

  beds: { plots: 6, basePrice: 100, priceGrowth: 1.32, max: 10, footprint: [4, 3] },

  species: {
    chicken: {
      buy: { f: 60, m: 50 },
      sell: { f: 30, m: 25 },
      food: ["feed_chicken", "hay"],
      product: "egg",
      produceEvery: 45,
      hungryAfter: 240,
      thirstyAfter: 220,
      growDays: .85,
      breedDays: .5,
      baseCapacity: 4,
    },
    cow: {
      buy: { f: 300, m: 250 },
      sell: { f: 220, m: 180 },
      food: ["feed_cow", "hay"],
      product: "milk",
      produceEvery: 80,
      hungryAfter: 300,
      thirstyAfter: 260,
      growDays: .85,
      breedDays: .5,
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
      growDays: .85,
      breedDays: .5,
      baseCapacity: 0,
      unlockedBy: "stable",
    },
  },
  // Hungry/thirsty animals still produce, slower, so a broke farm can recover.
  neglect: { produceFactor: 0.5, urgentDays: 1, sadDays: 1.5, deathDays: 2, bonesDays: 0.5 },
  animals: { maxTotal: 30, radius: {chicken:12,cow:29,horse:32}, separation:3 },
  coop: {
    callHour: 18, runSpeed: 46, doorRadius: 32, doorHalfWidth: 24,
    roostSpacing: 36, rowSpacing: 22, roostColumns: 3,
    roostBack: 23, arriveRadius: 5, exitDistance: 48,
    doorAnimationSeconds: 1.4, lateEntryRadius: 80,
    overflowDistance: 84, nestSpread: 22,
  },

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
  simulation: { tapsPerMinute: 30, thinkSeconds: 2, fenceDragBaseTaps: 4, fenceDragSegmentTaps: .08 },

  pickups: { max: 30, spread: 70, collectRadius: 190 },

  softlock: { intervalSeconds: 45, seeds: { seed_daisy: 3 }, feedPerHungryAnimal: 1 },

  ui: {
    iconPixels: 256, iconDprMax: 3, iconLogicalPixels: 96,
    bubbleScaleMin: .76, bubbleScaleMax: 1.08, bubbleDistanceScale: 900,
    inventoryHoldMs: 420, inventoryDragPixels: 7, renderEveryMs: 100,
    duskHintSeconds: 22,
    bubbleFpFalloff: .24, bubbleGodScale: 1.3,
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
