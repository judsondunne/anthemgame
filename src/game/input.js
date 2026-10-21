// Pointer and touch input: taps apply the selected hotbar item to whatever is
// under the finger; drags pan the farm, sweep a can or seeds over beds, or move
// the placement ghost.
import * as THREE from "three";
import { BALANCE as B } from "../config/balance.js";
import { layout, needsOf, plotStage, foodsFor, cropGood, housing } from "../sim/index.js";
import { itemIcon } from "../ui/icons.js";
import * as Sim from "../sim/index.js";
import { CAMERA as C } from "../config/camera.js";

const { footprintOf, cellRect, plotPosition, snapFootprint, checkPlacement, zoneCells, ZONES, ZONE_OF, TROUGHS, STALL, CELL_X, CELL_Y } = layout;
const inRect = (r, x, y, m = 0) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;

export function createInput({ canvas, camera, G, game, hud, shop, farm, bridge, juice, screen, cameraControl = null, cottage = null, onInventory = () => hud.toggleInventory?.(), onSelect = (k, i) => i === undefined ? hud.select(k) : hud.selectSlot?.(i), onFlashlight = () => {}, onPause=()=>{}, onMode=()=>cameraControl?.toggle() }) {
  const { world, Farm, view } = G;
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    hit = new THREE.Vector3();
  let down = null,
    lastSweep = 0,
    sweptPlot = "";

  const crosshairEl = document.querySelector("#crosshair") ?? document.createElement("div");
  crosshairEl.id = "crosshair"; crosshairEl.hidden = true; crosshairEl.setAttribute("aria-hidden", "true");
  if (!crosshairEl.isConnected) document.body.append(crosshairEl);
  const firstPerson = () => !!cameraControl?.isFirstPerson;
  const uiBlocked = () => game.paused || shop.isOpen || !!hud.inventoryOpen;
  const centerEvent = () => ({ clientX: innerWidth / 2, clientY: innerHeight / 2, pointerType: "mouse" });
  function ground(e = centerEvent()) {
    if (firstPerson()) e = centerEvent();
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) {
      raycaster.ray.at(C.reach, hit);
      hit.y = 0;
    }
    return { x: hit.x * 50 + 700, y: (hit.z * 50) / 1.65 + 650 };
  }
  function reachable(x, y, height = 0) {
    if (!firstPerson()) return true;
    const point = new THREE.Vector3((x - 700) / 50, height, ((y - 650) * 1.65) / 50);
    const projected = point.clone().project(camera);
    return point.distanceTo(camera.position) <= C.reach && projected.z > -1 && projected.z < 1;
  }
  const tool = () => hud.selected;

  // ---------- what is under the pointer ----------
  function pick(e, p) {
    const s = game.state;
    if (firstPerson()) e = centerEvent();
    if(s.ui.fenceDelete){for(const f of s.fences??[]){const l=Sim.fenceLine(f),x=(l.x1+l.x2)/2,y=(l.y1+l.y2)/2;if(!reachable(x,y,.4))continue;const q=screen(x,y,.4);if(firstPerson()?Math.hypot(q.x-e.clientX,q.y-e.clientY)<C.assistRadius:p.x>l.x1-15&&p.x<l.x2+15&&p.y>l.y1-10&&p.y<l.y2+10)return{kind:'fence',id:f.id,gate:f.gate};}}
    let best = null,
      bestD = 1e9;
    const consider = (kind, id, x, y, h, radius) => {
      if (!reachable(x, y, h)) return;
      const q = screen(x, y, h);
      const d = Math.hypot(q.x - e.clientX, q.y - e.clientY);
      if (d < (firstPerson() ? Math.max(C.assistRadius, radius) : radius*1.25) && d < bestD) {
        best = { kind, id };
        bestD = d;
      }
    };
    if (cottage?.door) {
      const d=cottage.door, x=d.x*50+700, y=d.z*50/1.65+650;
      consider('door', 'cottage', x, y, d.y ?? 1, firstPerson() ? C.assistRadius : 32);
      if (best) return best;
    }
    // Eggs, milk and bones compete by distance: whichever the finger is nearest wins.
    const items = () => {
      for (const pk of s.pickups) consider("pickup", pk.id, pk.x, pk.y, 0.12, 30);
      for (const a of s.animals) if (a.state === "bones") consider("remains", a.id, a.x, a.y, 0.15, 40);
    };
    const animals = () => {
      for (const [id, agent] of bridge.agents) {
        if (agent.sheltered || agent.bones || (agent.mode === "waking" && agent.wakeDelay > 0)) continue;
        const big = agent.sp === "chicken" ? 0.35 : agent.sp === "cow" ? 0.7 : 0.85;
        const r = (agent.sp === "chicken" ? 30 : 44) * (agent.juvenile ? 0.85 : 1) * Math.max(0.8, view.scale * 2.2);
        const ax = agent.sleeping && !agent.simMotion ? agent.home.x + ((agent.sleepSlot % 4) - 1.5) * 26 : agent.x;
        const ay = agent.sleeping && !agent.simMotion ? agent.home.y - 30 : agent.y;
        consider("animal", id, ax, ay, big * (agent.juvenile ? 0.7 : 1), r);
      }
    };
    // Food and the can are for animals, so a cow standing on her milk still gets
    // fed; the hand reaches for the milk first.
    const k = tool();
    const forAnimals = k === "can" || k === "hay" || k.startsWith("feed_");
    const bedTarget = () => {
    if(firstPerson()){let target=null,closest=C.assistRadius;for(const b of s.beds)for(let i=0;i<b.plots.length;i++){const pos=plotPosition(b,i);if(!reachable(pos.x,pos.y,.14))continue;const q=screen(pos.x,pos.y,.14),d=Math.hypot(q.x-e.clientX,q.y-e.clientY);if(d<closest){closest=d;target={kind:'bed',id:b.id,index:i};}}if(target)return target;}
    for (const bed of s.beds) {
      const [w, h] = footprintOf("bed");
      if (reachable(p.x, p.y, 0.12) && inRect(cellRect(bed.gx, bed.gy, w, h), p.x, p.y, 6)) {
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
      return null;
    };
    // Seeds and water belong to the soil even when an animal crosses the bed.
    if (k.startsWith("seed_") || k === "can") {
      const target = bedTarget();
      if (target) return target;
    }
    for (const look of forAnimals ? [animals, items] : [items, animals]) {
      look();
      if (best) return best;
    }
    const soil = bedTarget();
    if (soil) return soil;
    for (const f of s.fences ?? []) {
      const line = Sim.fenceLine?.(f) ?? { x1: f.gx * CELL_X, y1: f.gy * CELL_Y, x2: (f.gx + (f.axis === "h" ? 1 : 0)) * CELL_X, y2: (f.gy + (f.axis === "v" ? 1 : 0)) * CELL_Y };
      const mx = (line.x1 + line.x2) / 2, my = (line.y1 + line.y2) / 2;
      if (!reachable(mx, my, 0.45)) continue;
      const q = screen(mx, my, 0.45);
      if ((firstPerson() && Math.hypot(q.x - e.clientX, q.y - e.clientY) < C.assistRadius) || (!firstPerson() && p.x > line.x1 - 13 && p.x < line.x2 + 13 && p.y > line.y1 - 8 && p.y < line.y2 + 8)) return { kind: "fence", id: f.id, gate: f.gate };
    }
    for (const b of s.buildings) {
      const [w, h] = footprintOf(b.type);
      if (reachable(p.x, p.y, 0.2) && inRect(cellRect(b.gx, b.gy, w, h), p.x, p.y, 4)) return { kind: "building", id: b.id, type: b.type };
    }
    if(firstPerson()){for(const b of s.buildings){const f=layout.frontOf(b);consider('building',b.id,f.x,f.y,.8,120);}consider('building',null,320,818,.8,120);if(best)return {...best,type:best.id===null?'coop':s.buildings.find(b=>b.id===best.id)?.type};}
    if (!reachable(p.x, p.y, 0)) return { kind: "distant" };
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
    if (k === "empty" || t.kind === "distant") return;
    if (t.kind === 'door') {
      if (!sweep) { cottage?.toggleDoor?.(); G.startAudio(); juice.bump?.(document.querySelector('#crosshair')); }
      return;
    }
    if (t.kind === "fence") {
      if (!sweep && t.gate && k !== "fence" && k !== "gate") game.act("toggleGate", t.id);
      return;
    }
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
      } else {
        agent.happy = 3;
        game.act("callAnimal", a.id);
      }
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
        const r = game.act("plant", bed.id, t.index, k.slice(5));
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
    if(firstPerson()){cameraControl.setMode('god');cameraControl.focus((zone.x0+zone.x1)/2,(zone.y0+zone.y1)/2,0,type==='bed'?16:25);}

    const cameraFocus = cameraControl?.snapshot().focusTarget;
    const viewX = cameraFocus ? cameraFocus[0] * 50 + 700 : 700 + Farm.targetPan;
    const cx = Math.min(zone.x1 - 120, Math.max(zone.x0 + 120, viewX));
    if (!firstPerson() && (viewX < zone.x0 || viewX > zone.x1)) Farm.targetPan = THREE.MathUtils.clamp((zone.x0 + zone.x1) / 2 - 700, -1450, 1450);
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
    game.state.ui.fenceDelete = false;
    game.state.ui.fenceGhost = null;
  }

  // ---------- fence tools ----------
  let fenceAxis = "h", fenceStart = null, lastFence = "", lastFenceCell = null, aimed = { kind: "ground" };
  const fenceMode = () => tool() === "fence" || tool() === "gate" || !!game.state.ui.fenceDelete;
  function fenceGhost(p) {
    const gate = tool() === "gate";
    fenceAxis = game.state.ui.fenceAxis ?? fenceAxis;
    const gx = fenceAxis === "h" ? Math.floor(p.x / CELL_X) : Math.round(p.x / CELL_X);
    const gy = fenceAxis === "v" ? Math.floor(p.y / CELL_Y) : Math.round(p.y / CELL_Y);
    const valid = reachable(p.x, p.y, 0) && !!Sim.checkFencePlacement?.(game.state, gx, gy, fenceAxis, gate)?.ok;
    return (game.state.ui.fenceGhost = { gx, gy, axis: fenceAxis, gate, valid });
  }
  function useFence(p, e, sweep = false) {
    const t = pick(e, p);
    if (game.state.ui.fenceDelete) {
      if (t.kind === "fence" && lastFence !== "delete:" + t.id) { lastFence = "delete:" + t.id; game.act("removeFence", t.id); }
      return;
    }
    const g = fenceGhost(p);
    const from = sweep ? (lastFenceCell ?? (fenceStart ? fenceGhost(fenceStart) : g)) : g;
    const count = Math.min(80, Math.max(Math.abs(g.gx - from.gx), Math.abs(g.gy - from.gy)));
    for (let i = 0; i <= count; i++) {
      const t = count ? i / count : 1;
      const gx = Math.round(from.gx + (g.gx - from.gx) * t), gy = Math.round(from.gy + (g.gy - from.gy) * t);
      const key = `${gx}:${gy}:${g.axis}`;
      if (sweep && lastFence === key) continue;
      if (!Sim.checkFencePlacement?.(game.state, gx, gy, g.axis, g.gate)?.ok) continue;
      const r = game.act("placeFence", gx, gy, g.axis, g.gate);
      if (r.ok) { lastFence = key; G.burst(gx * CELL_X, gy * CELL_Y, "dust"); }
    }
    lastFenceCell = g;
    game.state.ui.fenceGhost = g;
  }
  function interact() {
    if (uiBlocked()) return;
    G.startAudio(); game.takeOver();
    const e = centerEvent(), p = ground(e);
    if (fenceMode()) return useFence(p, e);
    if (game.state.ui.placing) { if (!reachable(p.x, p.y, 0)) return; moveGhost(p); return confirm(); }
    apply(pick(e, p), p, e);
  }
  function attachCamera(control) {
    cameraControl = control;
    control?.setHandlers({ interact, wheel: (delta) => hud.cycle?.(delta) });
  }
  attachCamera(cameraControl);

  // ---------- pointer plumbing ----------
  canvas.addEventListener("pointerdown", (e) => {
    if (uiBlocked() || e.button > 0) return;
    G.startAudio(); game.takeOver();
    if (firstPerson()) { down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), fp: true }; return; }
    const p = ground(e), placing = game.state.ui.placing;
    down = { x: e.clientX, y: e.clientY, moved: false, ghost: placing && onGhost(p), id: e.pointerId, t: performance.now(), p };
    sweptPlot = ""; lastFence = ""; lastFenceCell = null; fenceStart = fenceMode() ? p : null;
    const t = pick(e, p), k = tool();
    down.cropSweep = !placing && !fenceMode() && t.kind === "bed" && (k === "can" || k.startsWith("seed_") || k === "hand");
    if (down.ghost || down.cropSweep || fenceMode()) cameraControl?.reserveGesture?.(e.pointerId);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (uiBlocked()) return;
    if (firstPerson()) {
      if (down?.fp && e.pointerType === "touch" && Math.hypot(e.clientX - down.x, e.clientY - down.y) > C.touchDragThreshold) down.moved = true;
      return;
    }
    const placing = game.state.ui.placing;
    if (!down) { if (placing && e.pointerType === "mouse") moveGhost(ground(e)); if (fenceMode()) fenceGhost(ground(e)); return; }
    const distance = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (cameraControl?.gestureConsumed) { down.moved = true; return; }
    if (down.ghost) { down.moved ||= distance > B.ui.placementTapSlopPx; if (down.moved) moveGhost(ground(e)); return; }
    if (fenceMode()) {
      down.sweeping ||= distance > C.dragThreshold;
      const p = ground(e);
      if (fenceStart && down.sweeping && !game.state.ui.fenceDelete) { fenceAxis = Math.abs(p.x - fenceStart.x) > Math.abs((p.y - fenceStart.y) * 1.65) ? "h" : "v"; game.state.ui.fenceAxis = fenceAxis; }
      fenceGhost(p); if (down.sweeping) useFence(p, e, true); return;
    }
    if (down.cropSweep && distance > C.dragThreshold) {
      const now = performance.now(); if (now - lastSweep < 70) return; lastSweep = now;
      const p = ground(e), t = pick(e, p);
      if (t.kind === "bed") { down.sweeping = true; apply(t, p, e, true); }
    }
    if (!cameraControl && distance > C.dragThreshold) down.moved = true;
  });
  canvas.addEventListener("pointerup", (e) => {
    const d = down; down = null; fenceStart = null;
    if (!d || d.id !== e.pointerId || d.moved || uiBlocked()) return;
    if (d.fp) { if (!cameraControl?.gestureConsumed) interact(); return; }
    if (cameraControl?.gestureConsumed) return;
    const p = ground(e);
    if (fenceMode()) { if (!d.sweeping) useFence(p, e); return; }
    if (game.state.ui.placing) { if (onGhost(p)) confirm(); else moveGhost(p); return; }
    if (!d.sweeping) apply(pick(e, p), p, e);
  });
  canvas.addEventListener("pointercancel", () => { down = null; fenceStart = null; });
  canvas.addEventListener("dblclick", (e) => {
    if (firstPerson() || uiBlocked() || fenceMode() || game.state.ui.placing) return;
    const p = ground(e), target = pick(e, p);
    if (target.kind === "animal") { const a = bridge.agentOf(target.id); if (a) cameraControl?.focus(a.x, a.y, 0.4, a.sp === "chicken" ? 4 : 7); }
    else if (target.kind === "building") cameraControl?.focus(p.x, p.y, 0.5, 11);
  });
  addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)) return;
    const key = e.key.toLowerCase();
    if(game.paused&&key!=='escape'){e.preventDefault();e.stopImmediatePropagation();return;}
    if (/^[0-9]$/.test(key)) { e.preventDefault(); e.stopImmediatePropagation(); onSelect(null, key === "0" ? 9 : Number(key) - 1); return; }
    if(key==="r"&&!fenceMode())return;
    if (["e", "q", "i", "tab", "m", "f", "r", "delete", "backspace", "escape"].includes(key)) {
      e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return;
      if (key === "escape") { onPause(); }
      else if (key === "i" || key === "tab" || key === "e") { cameraControl?.releasePointer(); onInventory(); }
      else if (key === "m") { cameraControl?.releasePointer(); shop.isOpen ? shop.close() : shop.open("buy"); }
      else if (key === "q") { hud.toggleInventory(false);shop.close();cancel();onMode(); }
      else if (key === "f") onFlashlight();
      else if (key === "r" && fenceMode()) rotateFence();
      else if ((key === "delete" || key === "backspace") && fenceMode()) deleteToggle();
    }
  }, true);
  addEventListener("blur", () => { down = null; fenceStart = null; });
  function rotateFence() { fenceAxis = fenceAxis === "h" ? "v" : "h"; game.state.ui.fenceAxis = fenceAxis; return fenceAxis; }
  function deleteToggle() { game.state.ui.fenceDelete = !game.state.ui.fenceDelete; return game.state.ui.fenceDelete; }
  function update() {
    if (firstPerson() && !uiBlocked()) {
      const e = centerEvent(), p = ground(e); aimed = pick(e, p);
      if (game.state.ui.placing) moveGhost(p);
      if (fenceMode()) fenceGhost(p);
    } else if (!fenceMode()) game.state.ui.fenceGhost = null;
    const crosshair = document.querySelector("#crosshair");
    if (crosshair) { crosshair.hidden = !firstPerson(); crosshair.dataset.target = aimed.kind; crosshair.dataset.tool = tool(); crosshair.classList.toggle("active", firstPerson() && !["ground", "distant"].includes(aimed.kind) && !uiBlocked()); }
  }
  return { startPlacement, confirm, cancel, pick, apply, ground, harvestAll, feedOne, waterOne, attachCamera, update, interact, reachable, deleteToggle, rotateFence, get aimed() { return aimed; } };
}
