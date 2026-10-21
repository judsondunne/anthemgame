"use strict";
// Navigation uses ground footprints, not the visible tree crowns or roof silhouettes.
const NAV = { step: 20, left: 210, top: 370, cols: 51, rows: 27 };
function inPond(x, y, margin = 0) {
  return (
    (x - 999) ** 2 / (151 + margin) ** 2 +
      (y - 626) ** 2 / (72 + margin * 0.5) ** 2 <
    1
  );
}
function walkable(x, y) {
  if (x < 225 || x > 1190 || y < 410 || y > 890 || inPond(x, y, 20))
    return false;
  if (insideBed(x, y, 13)) return false;
  if (x > 508 && x < 785 && y < 493) return false;
  if (x > 233 && x < 445 && y > 744 && y < 850) return false;
  for (const f of world.scenery.filter((s) => s.type === "fence")) {
    const a = project3(-114 * f.scale, 0, 0),
      b = project3(114 * f.scale, 0, 0),
      dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((x - f.x - a.x) * dx + (y - f.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      );
    if (Math.hypot(x - f.x - a.x - t * dx, y - f.y - a.y - t * dy) < 11)
      return false;
  }
  for (const tree of world.scenery.filter((s) => s.type === "tree"))
    if (Math.hypot(x - tree.x, (y - tree.y) * 1.7) < 18 * tree.scale)
      return false;
  return true;
}
function nearestWalkable(x, y) {
  if (walkable(x, y)) return { x, y };
  for (let r = 10; r < 300; r += 10)
    for (let i = 0; i < 16; i++) {
      let a = (i * Math.PI) / 8,
        X = x + Math.cos(a) * r,
        Y = y + Math.sin(a) * r;
      if (walkable(X, Y)) return { x: X, y: Y };
    }
  return { x: 550, y: 750 };
}
function routeTo(sx, sy, tx, ty) {
  const goal = nearestWalkable(tx, ty),
    start = nearestWalkable(sx, sy),
    key = (x, y) => y * NAV.cols + x;
  const cell = (p) => ({
    x: Math.max(
      0,
      Math.min(NAV.cols - 1, Math.round((p.x - NAV.left) / NAV.step)),
    ),
    y: Math.max(
      0,
      Math.min(NAV.rows - 1, Math.round((p.y - NAV.top) / NAV.step)),
    ),
  });
  const a = cell(start),
    b = cell(goal),
    end = key(b.x, b.y),
    open = [key(a.x, a.y)],
    cost = new Map([[open[0], 0]]),
    came = new Map(),
    closed = new Set();
  const point = (id) => ({
    x: NAV.left + (id % NAV.cols) * NAV.step,
    y: NAV.top + Math.floor(id / NAV.cols) * NAV.step,
  });
  const valid = (x, y) =>
    x >= 0 &&
    x < NAV.cols &&
    y >= 0 &&
    y < NAV.rows &&
    walkable(NAV.left + x * NAV.step, NAV.top + y * NAV.step);
  let reached = null;
  for (let n = 0; open.length && n < 1500; n++) {
    let best = 0,
      bestScore = Infinity;
    for (let i = 0; i < open.length; i++) {
      let id = open[i],
        score =
          cost.get(id) +
          Math.hypot((id % NAV.cols) - b.x, Math.floor(id / NAV.cols) - b.y);
      if (score < bestScore) {
        best = i;
        bestScore = score;
      }
    }
    const id = open.splice(best, 1)[0],
      x = id % NAV.cols,
      y = Math.floor(id / NAV.cols);
    if (
      id === end ||
      Math.hypot(point(id).x - goal.x, point(id).y - goal.y) < 22
    ) {
      reached = id;
      break;
    }
    closed.add(id);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        let X = x + dx,
          Y = y + dy,
          k = key(X, Y);
        if (
          !valid(X, Y) ||
          closed.has(k) ||
          (dx && dy && (!valid(x + dx, y) || !valid(x, y + dy)))
        )
          continue;
        const next = cost.get(id) + Math.hypot(dx, dy);
        if (next < (cost.get(k) ?? Infinity)) {
          cost.set(k, next);
          came.set(k, id);
          if (!open.includes(k)) open.push(k);
        }
      }
  }
  if (reached === null) return [];
  let route = [goal],
    id = reached;
  while (came.has(id)) {
    route.unshift(point(id));
    id = came.get(id);
  }
  return route;
}
function sendChicken(b, x, y, mode = "wander") {
  b.path = routeTo(b.x, b.y, x, y);
  b.mode = mode;
  b.pause = -1;
  b.targetX = x;
  b.targetY = y;
}
function unprojectGround(x, y) {
  const det = Camera3D.xx * Camera3D.zy - Camera3D.zx * Camera3D.xy;
  return {
    x: (x * Camera3D.zy - y * Camera3D.zx) / det,
    z: (y * Camera3D.xx - x * Camera3D.xy) / det,
  };
}
function insideBed(x, y, margin = 0) {
  return [355, 710].some((cx) => {
    const p = unprojectGround(x - cx, y - 637);
    return (
      p.x > -90 - margin &&
      p.x < 90 + margin &&
      p.z > -margin &&
      p.z < 122 + margin
    );
  });
}
