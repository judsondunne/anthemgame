// Game time is one monotonic number of game seconds. A cycle is the day phase
// (dawn -> dusk) followed by the night phase (dusk -> dawn).
import { BALANCE } from "../config/balance.js";

const T = BALANCE.time;
const mod = (a, n) => {const r=((a % n)+n)%n;return r<1e-8||n-r<1e-8?0:r;};
const nightHours = 24 - T.duskHour + T.dawnHour;
const startOffset = ((T.startHour - T.dawnHour) / (T.duskHour - T.dawnHour)) * T.daySeconds;

// Seconds since the most recent dawn.
export function cyclePosition(time) {
  return mod(time + startOffset, T.cycleSeconds);
}

export function hourAt(time) {
  const p = cyclePosition(time);
  const h =
    p < T.daySeconds
      ? T.dawnHour + (p / T.daySeconds) * (T.duskHour - T.dawnHour)
      : T.duskHour + ((p - T.daySeconds) / T.nightSeconds) * nightHours;
  return mod(h, 24);
}

export function isNightAt(time) {
  return cyclePosition(time) >= T.daySeconds;
}

export function dayIndex(time) {
  return Math.floor((time + startOffset) / T.cycleSeconds);
}

// Cycle position (seconds after dawn) at which the clock reads `hour`.
function positionOfHour(hour) {
  const h = mod(hour, 24);
  if (h >= T.dawnHour && h < T.duskHour) return ((h - T.dawnHour) / (T.duskHour - T.dawnHour)) * T.daySeconds;
  const intoNight = mod(h - T.duskHour, 24);
  return T.daySeconds + (intoNight / nightHours) * T.nightSeconds;
}

// Earliest game time >= `time` showing `hour`. Time only ever moves forward.
export function nextTimeAtHour(time, hour) {
  if (!Number.isFinite(hour)) return time;
  const now = cyclePosition(time),
    target = positionOfHour(hour);
  return time + mod(target - now, T.cycleSeconds);
}

export function clockOf(time) {
  return { hour: hourAt(time), night: isNightAt(time), day: dayIndex(time), position: cyclePosition(time) };
}
