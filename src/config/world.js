// World dimensions are in Three.js metres. Legacy farm coordinates stay flat.
export const WORLD = Object.freeze({
  seed: 721031,
  radius: 92,
  property: { halfWidth: 38, halfDepth: 17, blend: 14 },
  terrainSegments: 112,
  forest: { spacing: 4.8, jitter: 0.82, chunkSize: 46, nearDistance: 57, farDistance: 145, shadowDistance: 55, undergrowthSpacing: 3.8 },
  brook: { x: 46, meander: 7, halfWidth: 1.7, shoreWidth: 2.8, crossingZ: 8, crossingHalfDepth: 1.7, rocks: 90 },
  particles: { high: 150, low: 65 },
});
