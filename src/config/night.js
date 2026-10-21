// Real-second cinematic and lighting tunables. The simulation owns game time.
export const NIGHT = {
  flashlight: { power: 48, range: 27, angle: Math.PI / 7.3, penumbra: .68, eyeRange: 30, coneDot: .9, scareSeconds: 1.5, nearWolf: 15, beamOpacity: .032 },
  suspense: { probability: .5, flickerSeconds: .55, waitSeconds: 2, lungeSeconds: .36, recoverSeconds: .7, cooldownSeconds: 32, maxDistance: 14 },
  tutorial: { seconds: 13, duskHour: 18.5 },
  eyes: { chicken: { h: .43, w: .105, forward: .14 }, cow: { h: .96, w: .23, forward: .36 }, horse: { h: 1.36, w: .19, forward: .4 }, wolf: { h: .8, w: .17, forward: .38 }, bear: { h: 1.17, w: .23, forward: .46 } },
};
