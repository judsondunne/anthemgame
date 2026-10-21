import { NIGHT } from '../config/night.js';
// Real-time encounter clock. Isolated from render and game-time acceleration.
export function encounterAt(elapsed, suspense = true) {
  const b = NIGHT.suspense;
  if (!suspense) return { phase: 'retreat', light: 1, lunge: 0, done: true };
  if (elapsed < b.flickerSeconds) {
    const off = (elapsed >= .08 && elapsed < .15) || (elapsed >= .29 && elapsed < .39);
    return { phase: 'flicker', light: off ? .035 : 1, lunge: 0, done: false };
  }
  const afterFlicker = elapsed - b.flickerSeconds;
  if (afterFlicker < b.waitSeconds) return { phase: 'waiting', light: 1, lunge: 0, done: false };
  const jump = afterFlicker - b.waitSeconds;
  if (jump < b.lungeSeconds) return { phase: 'lunge', light: 1.7, lunge: Math.min(1, jump / .09), done: false };
  if (jump < b.lungeSeconds + b.recoverSeconds) return { phase: 'recover', light: 1, lunge: 0, done: false };
  return { phase: 'retreat', light: 1, lunge: 0, done: true };
}
