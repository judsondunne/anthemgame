// Pointer and touch input: taps apply the selected hotbar item to whatever is
// under the finger; drags pan the farm, sweep a can or seeds over beds, or move
// the placement ghost.
import * as THREE from "three";
import { BALANCE as B } from "../config/balance.js";
import { layout, needsOf, plotStage, foodsFor, cropGood, housing } from "../sim/index.js";
import { itemIcon } from "../ui/icons.js";

const { footprintOf, cellRect, plotPosition, snapFootprint, checkPlacement, zoneCells, ZONES, ZONE_OF, TROUGHS, STALL, CELL_X, CELL_Y } = layout;
const inRect = (r, x, y, m = 0) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;

export function createInput({ canvas, camera, G, game, hud, shop, farm, bridge, juice, screen }) {
  const { world, Farm, view } = G;
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    hit = new THREE.Vector3();
  let down = null,
    lastSweep = 0,
    sweptPlot = "";

  function ground(e) {
    pointer.set((e.clientX / innerWidth) * 2 - 1, (-e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(plane, hit);
    return { x: hit.x * 50 + 700, y: (hit.z * 50) / 1.65 + 650 };
  }
  const near = (e, x, y, h, radius) => {
    const p = screen(x, y, h);
    return Math.hypot(p.x - e.clientX, p.y - e.clientY) < radius;
  };
  const tool = () => hud.selected;

  // ---------- what is under the pointer ----------
  function pick(e, p) {
    const s = game.state;
    let best = null,
      bestD = 1e9;
    const consider = (kind, id, x, y, h, radius) => {
      const q = screen(x, y, h);
      const d = Math.hypot(q.x - e.clientX, q.y - e.clientY);
      if (d < radius && d < bestD) {
        best = { kind, id };
        bestD = d;
      }
    };
    // Eggs, milk and bones compete by distance: whichever the finger is nearest wins.
    for (const pk of s.pickups) consider("pickup", pk.id, pk.x, pk.y, 0.12, 30);
    for (const a of s.animals) if (a.state === "bones") consider("remains", a.id, a.x, a.y, 0.15, 40);
    if (best) return best;
    for (const [id, agent] of bridge.agents) {
      if (agent.sheltered || agent.bones || (agent.mode === "waking" && agent.wakeDelay > 0)) continue;
      const big = agent.sp === "chicken" ? 0.35 : agent.sp === "cow" ? 0.7 : 0.85;
      const r = (agent.sp === "chicken" ? 30 : 44) * (agent.juvenile ? 0.85 : 1) * Math.max(0.8, view.scale * 2.2);
      const ax = agent.sleeping ? agent.home.x + ((agent.sleepSlot % 4) - 1.5) * 26 : agent.x;
      const ay = agent.sleeping ? agent.home.y - 30 : agent.y;
      consider("animal", id, ax, ay, big * (agent.juvenile ? 0.7 : 1), r);
    }
    if (best) return best;
    for (const bed of s.beds) {
      const [w, h] = footprintOf("bed");
      if (inRect(cellRect(bed.gx, bed.gy, w, h), p.x, p.y, 6)) {
        let index = 0,
          d = 1e9;
        bed.plots.forEach((_, i) => {
          const q = plotPosition(bed, i);
          const dd = Math.hypot(q.x - p.x, (q.y - p.y) * 1.65);
          if (dd < d) {
            d = dd;
            index = i;
          }
        });
        return { kind: "bed", id: bed.id, index };
      }
    }
    for (const b of s.buildings) {
      const [w, h] = footprintOf(b.type);
      if (inRect(cellRect(b.gx, b.gy, w, h), p.x, p.y, 4)) return { kind: "building", id: b.id, type: b.type };
    }
    if (inRect({ x0: 225, x1: 455, y0: 728, y1: 866 }, p.x, p.y)) return { kind: "building", id: null, type: "coop" };
    for (const [zone, list] of Object.entries(TROUGHS)) if (list.some((t) => Math.abs(t.x - p.x) < 40 && Math.abs(t.y - p.y) < 30)) return { kind: "trough", zone };
    if (Math.hypot(p.x - STALL.x, (p.y - STALL.y) * 1.6) < 70) return { kind: "stall" };
    if (G.inPond(p.x, p.y, -12)) return { kind: "pond" };
    return { kind: "ground" };
  }

  // ---------- feedback ----------
  const at = (x, y, h = 0.4) => screen(x, y, h);
  function gained(key, x, y, h = 0.3) {
    const p = at(x, y, h);
    juice.fly(p.x, p.y, itemIcon(key), hud.slotEl(key));
  }
  function refuse(reason, extra) {
    if (reason === "noFood" || reason === "noSeed") {
      juice.shake(hud.slotEl(tool()));
      juice.bump(hud.shopBtn, "nudge");
    } else if (reason === "stack") juice.shake(hud.slotEl(extra ?? tool()));
    else if (extra?.agent) extra.agent.shake = 1;
  }

  // Animals served by a tapped trough (whole pasture) or building (its residents).
  function groupOf(t) {
    const s = game.state;
    if (t.kind === "trough") return s.animals.filter((a) => a.state === "alive" && a.sp === (t.zone === "west" ? "cow" : "horse"));
    const hs = housing(s),
      sp = t.type === "coop" ? "chicken" : t.type === "barn" ? "cow" : "horse";
    return s.animals.filter((a) => a.state === "alive" && a.sp === sp && (hs.homes.get(a.id)?.id ?? null) === t.id);
  }

  function feedOne(a, item) {
    const agent = bridge.agentOf(a.id);
    const r = game.act("feed", a.id, item);
    if (r.ok) {
      if (a.sp !== "chicken") Farm.eat(agent);
      else {
        agent.feedUntil = world.elapsed + 6;
        agent.mode = "feeding";
        agent.feedCenter = { x: agent.x, y: agent.y };
        agent.pause = 1;
      }
      G.burst(agent.x, agent.y - 20, "grain");
    } else refuse(r.reason, { agent });
    return r;
  }

  function waterOne(a) {
    const agent = bridge.agentOf(a.id);
    const r = game.act("waterAnimal", a.id);
    if (r.ok) {
      G.burst(agent.x, agent.y - 30, "water");
      agent.pet = 1.2;
    } else if (r.reason === "notThirsty") G.burst(agent.x, agent.y - 10, "water");
    return r;
  }

  // ---------- applying the selected item ----------
  function apply(t, p, e, sweep = false) {
    const s = game.state,
      k = tool();
    const isSeed = k.startsWith("seed_"),
      isFood = k.startsWith("feed_") || k === "hay";
    if (t.kind === "pickup" && !sweep) {
      const pk = s.pickups.find((q) => q.id === t.id);
      const r = game.act("collect", t.id);
      if (r.ok) gained(pk.kind, pk.x, pk.y, 0.2);
      else refuse(r.reason, pk.kind);
      return;
    }
    if (t.kind === "remains" && !sweep) {
      const a = s.animals.find((q) => q.id === t.id);
      if (game.act("clearBones", t.id).ok) G.burst(a.x, a.y, "dust");
      return;
    }
    if (t.kind === "animal") {
      if (sweep) return;
      const a = s.animals.find((q) => q.id === t.id),
        agent = bridge.agentOf(t.id);
      if (!a || a.state !== "alive") return;
      if (isFood) return void feedOne(a, k);
      if (k === "can") return void waterOne(a);
      agent.pet = 2;
      if (agent.sp === "chicken") {
        agent.path = [];
        agent.pause = 2;
      } else agent.happy = 3;
      G.burst(agent.x, agent.y - (agent.sp === "chicken" ? 40 : 70), "heart");
      world.needs = world.needs.filter((n) => n.target !== agent);
      return;
    }
    if (t.kind === "bed") {
      const bed = s.beds.find((b) => b.id === t.id);
      const plot = bed.plots[t.index];
      const key = bed.id + ":" + t.index;
      if (k === "can") {
        if (sweep && sweptPlot === "bed" + bed.id) return;
        sweptPlot = "bed" + bed.id;
        game.act("waterBed", bed.id);
        world.watering.push({ target: bed, x: plotPosition(bed, 2).x - 40, y: plotPosition(bed, 2).y, life: 2.2 });
        const c = plotPosition(bed, 1);
        G.burst(c.x, c.y - 10, "water");
        return;
      }
      if (sweep && sweptPlot === key) return;
      sweptPlot = key;
      if (isSeed) {
        const r = game.act("plantBed", bed.id, k.slice(5), t.index);
        if (!r.ok) {
          if (r.reason === "occupied" && !sweep) farm.wiggle(bed.id, t.index);
          else if (r.reason === "noSeed") refuse("noSeed");
        }
        return;
      }
      if (k === "hand" || isFood || k === "fish") {
        if (plotStage(plot) === 2) {
          const crop = plot.crop,
            pos = plotPosition(bed, t.index);
          const r = game.act("harvest", bed.id, t.index);
          if (r.ok) {
            gained(cropGood(crop), pos.x, pos.y);
            G.burst(pos.x, pos.y - 20, "sparkle");
          } else refuse(r.reason, cropGood(crop));
        } else if (plot.crop) {
          farm.wiggle(bed.id, t.index);
        } else if (!sweep && bed.plots.some((q) => plotStage(q) === 2)) harvestAll(bed);
      }
      return;
    }
    if (sweep) return;
    if (t.kind === "building" && k === "hand") {
      // Gather every egg or milk carton lying around this building.
      const b = s.buildings.find((q) => q.id === t.id);
      const front = b ? layout.frontOf(b).approach : layout.BASE_COOP.approach;
      const before = s.pickups.map((q) => ({ ...q }));
      const r = game.act("collectNear", front.x, front.y);
      if (r.ok) for (const q of before) if (!game.state.pickups.some((x) => x.id === q.id)) gained(q.kind, q.x, q.y, 0.2);
      return;
    }
    if (t.kind === "building" || t.kind === "trough") {
      const herd = groupOf(t);
      if (isFood) {
        const hungry = herd.filter((a) => needsOf(a).hungry && foodsFor(a.sp).includes(k));
        if (!hungry.length) return void herd.forEach((a) => bridge.agentOf(a.id) && (bridge.agentOf(a.id).shake = 1));
        for (const a of hungry) if (!feedOne(a, k).ok) break;
      } else if (k === "can") {
        const thirsty = herd.filter((a) => needsOf(a).thirsty);
        for (const a of thirsty) waterOne(a);
        G.burst(p.x, p.y, "water");
      }
      return;
    }
    if (t.kind === "stall") return void shop.open("buy");
    if (t.kind === "pond") {
      if (k === "fish" || k === "hand") G.feedFish(p.x, p.y);
      return;
    }
    if (t.kind === "ground" && (k === "feed_chicken" || k === "hay")) {
      // Scatter grain: every hungry hen nearby comes running; one portion each.
      const hungry = s.animals.filter((a) => a.state === "alive" && a.sp === "chicken" && needsOf(a).hungry);
      if (!hungry.length) {
        world.chickens.forEach((b) => !b.dead && (b.shake = 1));
        return;
      }
      if ((s.inv[k] ?? 0) <= 0) return refuse("noFood");
      if (!G.scatterGrain(p.x, p.y)) return;
      for (const a of hungry) {
        const r = game.act("feed", a.id, k);
        if (!r.ok) {
          refuse(r.reason);
          break;
        }
      }
    }
  }

  function harvestAll(bed) {
    const ripe = bed.plots.map((q, i) => (plotStage(q) === 2 ? { i, crop: q.crop } : null)).filter(Boolean);
    let any = false;
    for (const { i, crop } of ripe) {
      const pos = plotPosition(bed, i);
      const r = game.act("harvest", bed.id, i);
      if (r.ok) {
        any = true;
        gained(cropGood(crop), pos.x, pos.y);
        G.burst(pos.x, pos.y - 20, "sparkle");
      } else refuse(r.reason, cropGood(crop));
    }
    return any;
  }

  // ---------- placement ----------
  function startPlacement(kit) {
    const s = game.state,
      type = kit.slice(4);
    const zone = ZONES[ZONE_OF[type]];
    const viewX = 700 + Farm.targetPan;
    const cx = Math.min(zone.x1 - 120, Math.max(zone.x0 + 120, viewX));
    if (viewX < zone.x0 || viewX > zone.x1) Farm.targetPan = THREE.MathUtils.clamp((zone.x0 + zone.x1) / 2 - 700, -1450, 1450);
    const target = { x: viewX < zone.x0 || viewX > zone.x1 ? (zone.x0 + zone.x1) / 2 : cx, y: (zone.y0 + zone.y1) / 2 };
    // Begin on the nearest valid spot so a single tap on the check confirms.
    let best = null,
      bestD = 1e9;
    for (const c of zoneCells(type)) {
      if (!checkPlacement(s, type, c.gx, c.gy).ok) continue;
      const [w, h] = footprintOf(type);
      const d = Math.hypot((c.gx + w / 2) * CELL_X - target.x, ((c.gy + h / 2) * CELL_Y - target.y) * 1.65);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    const snap = best ?? snapFootprint(type, target.x, target.y);
    s.ui.placing = { kit, gx: snap.gx, gy: snap.gy };
    hud.select("hand");
  }

  function moveGhost(p) {
    const placing = game.state.ui.placing;
    if (!placing) return;
    const snap = snapFootprint(placing.kit.slice(4), p.x, p.y);
    placing.gx = snap.gx;
    placing.gy = snap.gy;
  }

  function onGhost(p) {
    const placing = game.state.ui.placing;
    const [w, h] = footprintOf(placing.kit.slice(4));
    return inRect(cellRect(placing.gx, placing.gy, w, h), p.x, p.y, 10);
  }

  function confirm() {
    const s = game.state,
      placing = s.ui.placing;
    if (!placing) return;
    const r = game.act("place", placing.kit, placing.gx, placing.gy);
    if (!r.ok) return void juice.shake(hud.okBtn);
    s.ui.placing = null;
    const type = placing.kit.slice(4);
    const [w, h] = footprintOf(type);
    const c = cellRect(placing.gx, placing.gy, w, h);
    G.burst((c.x0 + c.x1) / 2, c.y1 - 10, "dust");
    // The next kit of the same kind (if any) can be placed straight away.
    if ((s.inv[placing.kit] ?? 0) > 0) startPlacement(placing.kit);
  }

  function cancel() {
    if (shop.isOpen) return shop.close();
    game.state.ui.placing = null;
  }

  // ---------- pointer plumbing ----------
  canvas.addEventListener("pointerdown", (e) => {
    G.startAudio();
    game.takeOver();
    const p = ground(e);
    const placing = game.state.ui.placing;
    down = { x: e.clientX, y: e.clientY, pan: Farm.targetPan, moved: false, ghost: placing && onGhost(p), id: e.pointerId, t: performance.now() };
    sweptPlot = "";
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const placing = game.state.ui.placing;
    if (!down) {
      if (placing && e.pointerType === "mouse") moveGhost(ground(e));
      return;
    }
    const dx = e.clientX - down.x;
    if (down.ghost) {
      if (Math.hypot(dx, e.clientY - down.y) > B.ui.placementTapSlopPx) down.moved = true;
      if (down.moved) moveGhost(ground(e));
      return;
    }
    if (Math.abs(dx) > 10 && !down.sweeping) {
      down.moved = true;
      Farm.targetPan = THREE.MathUtils.clamp(down.pan - dx / view.scale, -1450, 1450);
      return;
    }
    if (!down.moved && !placing) {
      // Sweeping the can, seeds or hand across beds acts on each plot once.
      const k = tool();
      if (k !== "can" && !k.startsWith("seed_") && k !== "hand") return;
      const now = performance.now();
      if (now - lastSweep < 70) return;
      lastSweep = now;
      const p = ground(e),
        t = pick(e, p);
      if (t.kind === "bed") {
        down.sweeping = true;
        apply(t, p, e, true);
      }
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    const d = down;
    down = null;
    if (!d || d.moved) return;
    const p = ground(e);
    if (game.state.ui.placing) {
      if (onGhost(p)) confirm();
      else moveGhost(p);
      return;
    }
    if (d.sweeping) {
      const t = pick(e, p);
      if (t.kind === "bed") return;
    }
    apply(pick(e, p), p, e);
  });
  canvas.addEventListener("pointercancel", () => (down = null));
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaX) > 0.5) {
        e.preventDefault();
        Farm.targetPan = THREE.MathUtils.clamp(Farm.targetPan + e.deltaX / view.scale, -1450, 1450);
      }
    },
    { passive: false },
  );

  return { startPlacement, confirm, cancel, pick, apply, ground, harvestAll, feedOne, waterOne };
}
