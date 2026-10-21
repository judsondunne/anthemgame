// World units are metres; the legacy farm grid maps 50 logical units to 1m.
export const CAMERA = Object.freeze({
  fov: 48, minDistance: 1.7, maxDistance: 148, defaultDistance: 35.5,
  minPitch: 0.19, maxPitch: 1.43, defaultPitch: 0.79, defaultYaw: 0.2,
  damping: 11, inertia: 7, orbitSpeed: 0.005, zoomSpeed: 0.0018,
  dragThreshold: 7, touchDragThreshold: 9, bounds: 118, softEdge: 8,
  eyeHeight: 1.7, radius: 0.26, walkSpeed: 3.25, sprintSpeed: 5.4,
  acceleration: 12, gravity: 18, jumpSpeed: 6.1, lookSpeed: 0.0021,
  pitchLimit: 1.45, maxSlopeStep: 0.3, reach: 3.5,
  headBob: 0.018, transitionRate: 9, collisionStep: 0.12,
  godKeySpeed: 0.65, near: 0.035, far: 430,
});
