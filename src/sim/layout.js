// Fixed world geometry in the garden's logical coordinates (x right, y toward
// the camera). The renderer maps (x, y) -> ((x-700)/50, h, (y-650)*1.65/50), so
// one grid cell is 0.8 x 0.8 world units.
import { worldCollisionAt } from "./world-collision.js";
import { BALANCE } from "../config/balance.js";

export const CELL_X = 40;
export const CELL_Y = 40 / 1.65;

// Where each placeable type may go. Beds and coops share the garden; barns
// stand in the cow pasture to the west, stables in the horse meadow east.
export const ZONES = {
  garden: { x0: -60, x1: 1460, y0: 505, y1: 862 },
  west: { x0: -1000, x1: -90, y0: 580, y1: 905 },
  east: { x0: 1490, x1: 2400, y0: 580, y1: 905 },
};
export const ZONE_OF = { bed: "garden", coop: "garden", barn: "west", stable: "east" };

// The cottage path follows the ground shader's painted curve.
export function pathCenterX(y) {
  const z = ((y - 650) * 1.65) / 50;
  return 700 + 50 * (-1.2 + Math.sin(z * 0.29) * 0.55);
}

const rect = (x0, x1, y0, y1) => ({ kind: "rect", x0, x1, y0, y1 });
const circle = (x, y, r) => ({ kind: "circle", x, y, r });
export const OBSTACLES = [
  rect(495, 800, 330, 522), // cottage and porch
  rect(220, 458, 728, 866), // starter coop
  { kind: "ellipse", x: 999, y: 626, rx: 178, ry: 94 }, // pond and bank stones
  { kind: "path", y0: 470, margin: 50 },
  circle(150, 488, 36),
  circle(1182, 453, 36),
  circle(1260, 799, 36),
  circle(121, 818, 30),
  circle(1020, 357, 26),
  rect(-305, -125, 765, 828), // cow troughs
  rect(1525, 1705, 765, 828), // horse troughs
  rect(830, 935, 470, 540), // market stall
  circle(206, 874, 30),
  circle(215, 790, 24), // potted flowers
  rect(-60, -18, 536, 566), // pasture fence ends
  rect(1418, 1460, 536, 566),
  circle(1128, 805, 30),
  circle(447, 461, 26),
  circle(796, 443, 26),
  circle(-1010, 840, 40),
  circle(2410, 840, 40),
];

export const BASE_COOP = { x: 320, y: 818, door: { x: 317, y: 821 }, approach: { x: 292, y: 858 } };
export const STARTER_BED = { gx: 7, gy: 23 };
export const TROUGHS = {
  west: [-269, -215, -161].map((x) => ({ x, y: 795 })),
  east: [1561, 1615, 1669].map((x) => ({ x, y: 795 })),
};
export const STALL = { x: 880, y: 505 };

export function hitObstacle(o, x, y) {
  if (o.kind === "rect") return x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1;
  if (o.kind === "circle") return (x - o.x) ** 2 + (y - o.y) ** 2 <= o.r * o.r;
  if (o.kind === "ellipse") return ((x - o.x) / o.rx) ** 2 + ((y - o.y) / o.ry) ** 2 <= 1;
  if (o.kind === "path") return y >= o.y0 && Math.abs(x - pathCenterX(y)) <= o.margin;
  return false;
}

export function footprintOf(type) {
  return type === "bed" ? BALANCE.beds.footprint : BALANCE.buildings[type].footprint;
}

export function cellRect(gx, gy, w = 1, h = 1) {
  return { x0: gx * CELL_X, x1: (gx + w) * CELL_X, y0: gy * CELL_Y, y1: (gy + h) * CELL_Y };
}

export function footprintCenter(gx, gy, w, h) {
  return { x: (gx + w / 2) * CELL_X, y: (gy + h / 2) * CELL_Y };
}

// Door sits on the camera-facing edge; animals gather a little in front of it.
export function frontOf(item) {
  const [w, h] = footprintOf(item.type ?? "bed");
  const c = footprintCenter(item.gx, item.gy, w, h);
  const y = (item.gy + h) * CELL_Y;
  return { x: c.x, y, door: { x: c.x, y: y - 4 }, approach: { x: c.x - 18, y: y + 32 } };
}

function cellFree(zone, gx, gy) {
  const r = cellRect(gx, gy);
  if (r.x0 < zone.x0 || r.x1 > zone.x1 || r.y0 < zone.y0 || r.y1 > zone.y1) return false;
  const pts = [
    [r.x0 + 1, r.y0 + 1],
    [r.x1 - 1, r.y0 + 1],
    [r.x0 + 1, r.y1 - 1],
    [r.x1 - 1, r.y1 - 1],
    [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2],
  ];
  return !OBSTACLES.some((o) => pts.some(([x, y]) => hitObstacle(o, x, y)));
}

const overlaps = (a, b) => a.gx < b.gx + b.w && b.gx < a.gx + a.w && a.gy < b.gy + b.h && b.gy < a.gy + a.h;

export function placedFootprints(state) {
  return [
    ...state.beds.map((b) => ({ id: b.id, type: "bed", gx: b.gx, gy: b.gy, w: footprintOf("bed")[0], h: footprintOf("bed")[1] })),
    ...state.buildings.map((b) => ({ id: b.id, type: b.type, gx: b.gx, gy: b.gy, w: footprintOf(b.type)[0], h: footprintOf(b.type)[1] })),
  ];
}

// Returns per-cell validity so the ghost can tint every cell, plus an overall verdict.
export function checkPlacement(state, type, gx, gy) {
  if (!ZONE_OF[type] || !Number.isInteger(gx) || !Number.isInteger(gy)) return { ok: false, cells: [] };
  const [w, h] = footprintOf(type),
    zone = ZONES[ZONE_OF[type]],
    others = placedFootprints(state),
    cells = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = { gx: gx + i, gy: gy + j, w: 1, h: 1 };
      cells.push({ gx: c.gx, gy: c.gy, ok: cellFree(zone, c.gx, c.gy) && !worldCollisionAt(state,(c.gx+.5)*CELL_X,(c.gy+.5)*CELL_Y,27) && !others.some((o) => overlaps(o, c)) });
    }
  if (type === 'coop') {
    const center = footprintCenter(gx, gy, w, h), edge = (gy + h) * CELL_Y;
    const doorClear = [-BALANCE.coop.doorHalfWidth, 0, BALANCE.coop.doorHalfWidth].every(dx =>
      [BALANCE.animals.radius.chicken, BALANCE.coop.exitDistance].every(dy => {
        const x = center.x + dx, y = edge + dy;
        return !OBSTACLES.some(o => o.kind !== 'path' && hitObstacle(o, x, y)) && !worldCollisionAt(state, x, y, BALANCE.animals.radius.chicken) && !others.some(o => {
          const r = cellRect(o.gx, o.gy, o.w, o.h);
          return x > r.x0 - BALANCE.animals.radius.chicken && x < r.x1 + BALANCE.animals.radius.chicken && y > r.y0 - BALANCE.animals.radius.chicken && y < r.y1 + BALANCE.animals.radius.chicken;
        });
      }));
    if (!doorClear) for (const c of cells) c.ok = false;
  }
  return { ok: cells.every((c) => c.ok), cells };
}

export function zoneCells(type) {
  const zone = ZONES[ZONE_OF[type]],
    out = [];
  for (let gy = Math.floor(zone.y0 / CELL_Y); gy * CELL_Y < zone.y1; gy++)
    for (let gx = Math.floor(zone.x0 / CELL_X); gx * CELL_X < zone.x1; gx++)
      if (cellFree(zone, gx, gy)) out.push({ gx, gy });
  return out;
}

// Snap a logical point to the top-left cell of a footprint centred on it.
export function snapFootprint(type, x, y) {
  const [w, h] = footprintOf(type);
  return { gx: Math.round(x / CELL_X - w / 2), gy: Math.round(y / CELL_Y - h / 2) };
}

export function insideZone(zoneName, x, y, margin = 0) {
  const z = ZONES[zoneName];
  return x >= z.x0 + margin && x <= z.x1 - margin && y >= z.y0 + margin && y <= z.y1 - margin;
}

// Lawns where pickups land and animals spawn (wider than the build zones so
// eggs can roll out in front of the starter coop).
export const LAWNS = {
  garden: { x0: 210, x1: 1190, y0: 500, y1: 905 },
  west: ZONES.west,
  east: ZONES.east,
};

// Open ground: on the lawn, clear of fixed obstacles and every placed footprint.
export function openGround(state, lawn, x, y) {
  const z = LAWNS[lawn];
  if (!z || x < z.x0 + 6 || x > z.x1 - 6 || y < z.y0 + 6 || y > z.y1 - 6) return false;
  if (OBSTACLES.some((o) => hitObstacle(o, x, y))||worldCollisionAt(state,x,y,12)) return false;
  for (const f of placedFootprints(state)) {
    const r = cellRect(f.gx, f.gy, f.w, f.h);
    if (x > r.x0 - 8 && x < r.x1 + 8 && y > r.y0 - 8 && y < r.y1 + 8) return false;
  }
  return true;
}

export function plotPosition(bed, index) {
  const [w, h] = footprintOf("bed"),
    cols = BALANCE.beds.plots / 2,
    c = footprintCenter(bed.gx, bed.gy, w, h);
  const col = index % cols,
    row = Math.floor(index / cols);
  return { x: c.x + (col - (cols - 1) / 2) * ((w * CELL_X) / (cols + 0.35)), y: c.y + (row - 0.5) * ((h * CELL_Y) / 2.25) };
}

// A valid spot that packs tightly against obstacles and other footprints,
// preferring positions near `near` (logical point). Used by the headless
// balance players and for the ghost's starting position.
export function bestSpot(state, type, near = null) {
  const [w, h] = footprintOf(type),
    zone = ZONES[ZONE_OF[type]],
    others = placedFootprints(state);
  const blocked = (gx, gy) => !cellFree(zone, gx, gy) || others.some((o) => overlaps(o, { gx, gy, w: 1, h: 1 }));
  let best = null;
  for (const c of zoneCells(type)) {
    if (!checkPlacement(state, type, c.gx, c.gy).ok) continue;
    let touch = 0;
    for (let i = -1; i <= w; i++) touch += blocked(c.gx + i, c.gy - 1) + blocked(c.gx + i, c.gy + h);
    for (let j = 0; j < h; j++) touch += blocked(c.gx - 1, c.gy + j) + blocked(c.gx + w, c.gy + j);
    const centre = footprintCenter(c.gx, c.gy, w, h);
    const dist = near ? Math.hypot(centre.x - near.x, (centre.y - near.y) * 1.65) : 0;
    const score = touch * 60 - dist * 0.12;
    if (!best || score > best.score) best = { gx: c.gx, gy: c.gy, score };
  }
  return best;
}
