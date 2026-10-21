// Renders everything the simulation places: beds and crops by growth stage,
// player buildings, eggs and milk, bones, and the placement ghost + grid.
import * as THREE from "three";
import { model, ownMaterials } from "../../assets.js";
import { BUILDINGS, piece, stall } from "./kit.js";
import { BALANCE as B } from "../config/balance.js";
import { layout, plotStage, alive } from "../sim/index.js";

const { CELL_X, CELL_Y, footprintOf, footprintCenter, cellRect, checkPlacement, zoneCells, plotPosition, STALL } = layout;
const toWorld = (x, y, h = 0, v = new THREE.Vector3()) => v.set((x - 700) / 50, h, ((y - 650) * 1.65) / 50);
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const overshoot = (t) => {
  t = Math.min(1, Math.max(0, t));
  return 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
};

// Downloaded models for each crop at seedling / growing / ripe.
function cropModel(crop, stage) {
  const g = new THREE.Group();
  const add = (name, opts, x = 0, y = 0, z = 0, ry = 0) => {
    const o = model(name, { sway: true, ...opts });
    o.position.set(x, y, z);
    o.rotation.y = ry;
    g.add(o);
    return o;
  };
  if (stage === 0) {
    add(crop === "wheat" ? "crops_wheatStageA" : "crops_leafsStageA", { height: crop === "wheat" ? 0.2 : 0.26 });
    return g;
  }
  if (stage === 1) {
    if (crop === "wheat") add("crops_wheatStageA", { height: 0.4 });
    else if (crop === "sunflower") add("crops_cornStageA", { height: 0.62 });
    else add("crops_leafsStageB", { height: crop === "cabbage" ? 0.36 : 0.42 });
    return g;
  }
  switch (crop) {
    case "daisy":
      add("flower_yellowC", { height: 0.42, recolor: { colorYellow: "#f6f1e4", colorWhite: "#e3bf73" } });
      add("flower_yellowC", { height: 0.3, recolor: { colorYellow: "#f6f1e4", colorWhite: "#e3bf73" } }, 0.16, 0, 0.08, 1.2);
      break;
    case "tulip":
      add("flower_redA", { height: 0.46 });
      add("flower_redA", { height: 0.36 }, 0.15, 0, 0.07, 0.8);
      break;
    case "sunflower": {
      add("crops_cornStageB", { height: 1.05 });
      const head = add("flower_yellowC", { width: 0.52, recolor: { colorWhite: "#7a5a3a" } }, 0, 0.78, 0.06);
      head.rotation.x = 0.8;
      break;
    }
    case "lavender":
      for (const [x, z, h] of [
        [0, 0, 0.44],
        [0.12, 0.07, 0.36],
        [-0.11, 0.06, 0.38],
      ])
        add("flower_purpleB", { height: h, recolor: { colorPurple: "#a993cf" } }, x, 0, z, x * 7);
      break;
    case "cabbage":
      add("crops_leafsStageB", { height: 0.3 });
      add("cabbage", { width: 0.44 }, 0, 0.02, 0.02);
      break;
    case "wheat":
      add("crops_wheatStageB", { height: 0.52 });
      break;
  }
  return g;
}

function stageProgress(p) {
  const t = B.stages.growing;
  const st = plotStage(p);
  return st === 0 ? p.g / t : st === 1 ? (p.g - t) / (1 - t) : 1;
}

export function createFarmLayer(ctx) {
  const { scene, camera, world } = ctx;
  const group = new THREE.Group();
  scene.add(group);
  const beds = new Map(),
    buildings = new Map(),
    pickups = new Map(),
    remains = new Map(),
    leaving = [];
  const v = new THREE.Vector3();
  let now = 0,
    ghost = null,
    grid = null,
    hideKey = "";

  // Market stall: tap it to open the market.
  const stallObj = stall();
  toWorld(STALL.x, STALL.y, 0, stallObj.position);
  group.add(stallObj);

  function bedObject(bed) {
    const [w, h] = footprintOf("bed");
    const c = footprintCenter(bed.gx, bed.gy, w, h);
    const g = new THREE.Group();
    toWorld(c.x, c.y, 0.01, g.position);
    const dirt = model("crops_dirtDoubleRow", { width: w * 0.8 * 0.93 });
    dirt.scale.z *= 1.06;
    ownMaterials(dirt);
    g.add(dirt);
    for (const s of [-1, 1]) {
      const log = model("log", { width: 0.22 });
      log.position.set(s * 1.35, 0.05, 1.25);
      log.rotation.y = Math.PI / 2;
      g.add(log);
    }
    const plots = bed.plots.map((_, i) => {
      const p = plotPosition(bed, i);
      const holder = new THREE.Group();
      toWorld(p.x, p.y, 0.07, holder.position).sub(g.position);
      g.add(holder);
      return { holder, key: "", obj: null, born: 0, wiggle: 0, sparkle: Math.random() * 2 };
    });
    group.add(g);
    return { g, dirt, plots, wet: -1, born: now };
  }

  function buildingObject(b) {
    const [w, h] = footprintOf(b.type);
    const g = BUILDINGS[b.type]();
    toWorld((b.gx + w / 2) * CELL_X, (b.gy + h) * CELL_Y, 0, g.position);
    group.add(g);
    ctx.registerLantern(g.userData.lantern);
    const light = ctx.lights.find((l) => !l.userData.owner);
    if (light) {
      light.userData.owner = b.id;
      g.userData.lantern.getWorldPosition(light.position);
      light.position.y += 0.7;
    }
    return { g, light, born: now };
  }

  function pickupObject(p) {
    const o = p.kind === "egg" ? model("egg", { height: 0.23 }) : model("carton-small", { height: 0.32 });
    toWorld(p.x, p.y, 0, o.position);
    o.rotation.y = (p.id * 1.7) % 6.28;
    o.userData.base = o.scale.x;
    group.add(o);
    return { o, born: now };
  }

  function remainsObject(a) {
    const g = new THREE.Group();
    const size = a.sp === "chicken" ? 0.42 : a.sp === "cow" ? 1.0 : 1.1;
    const rib = model("ribcage", { width: size, tint: "#efe4cc" });
    rib.rotation.y = (a.id * 2.3) % 6.28;
    g.add(rib);
    const bone = model("bone", { width: size * 0.62, recolor: { Beige: "#e9dcc2" } });
    bone.position.set(size * 0.55, 0, size * 0.25);
    bone.rotation.y = (a.id * 0.7) % 3;
    g.add(bone);
    toWorld(a.x, a.y, 0, g.position);
    group.add(g);
    return { g, born: now };
  }

  // ---------- placement ghost and grid ----------
  const ghostMats = {
    ok: new THREE.MeshBasicMaterial({ color: "#a6e3a0", transparent: true, opacity: 0.55, depthWrite: false }),
    bad: new THREE.MeshBasicMaterial({ color: "#f08f86", transparent: true, opacity: 0.55, depthWrite: false }),
  };
  const cellGeo = new THREE.PlaneGeometry(0.72, 0.72).rotateX(-Math.PI / 2);
  const cellMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.32, depthWrite: false });
  const tmp = new THREE.Object3D(),
    col = new THREE.Color();

  function buildGhost(kit) {
    const type = kit.slice(4);
    const g = new THREE.Group();
    const inner = type === "bed" ? bedObject({ gx: 0, gy: 0, plots: [] }).g : BUILDINGS[type]();
    group.remove(inner);
    if (type === "bed") inner.position.set(0, 0, 0);
    g.add(inner);
    g.traverse((o) => {
      if (o.isMesh) {
        o.material = ghostMats.ok;
        o.castShadow = false;
        o.receiveShadow = false;
        o.renderOrder = 3;
      }
    });
    group.add(g);
    const cells = zoneCells(type);
    const inst = new THREE.InstancedMesh(cellGeo, cellMat, cells.length + footprintOf(type)[0] * footprintOf(type)[1]);
    inst.renderOrder = 2;
    inst.frustumCulled = false;
    cells.forEach((c, i) => {
      toWorld((c.gx + 0.5) * CELL_X, (c.gy + 0.5) * CELL_Y, 0.025, tmp.position);
      tmp.updateMatrix();
      inst.setMatrixAt(i, tmp.matrix);
      inst.setColorAt(i, col.set("#fff7df"));
    });
    group.add(inst);
    grid = { inst, zone: cells.length };
    return { g, kit, type, inner, key: "" };
  }

  function updateGhost(state) {
    const placing = state.ui.placing;
    if (!placing) {
      if (ghost) {
        group.remove(ghost.g, grid.inst);
        grid.inst.dispose();
        ghost = grid = null;
      }
      return;
    }
    if (!ghost || ghost.kit !== placing.kit) {
      if (ghost) group.remove(ghost.g, grid.inst);
      ghost = buildGhost(placing.kit);
    }
    const [w, h] = footprintOf(ghost.type);
    const check = checkPlacement(state, ghost.type, placing.gx, placing.gy);
    ghost.valid = check.ok;
    if (ghost.type === "bed") {
      const c = footprintCenter(placing.gx, placing.gy, w, h);
      toWorld(c.x, c.y, 0.02, ghost.g.position);
    } else toWorld((placing.gx + w / 2) * CELL_X, (placing.gy + h) * CELL_Y, 0, ghost.g.position);
    ghost.g.position.y = 0.02 + Math.sin(now * 4) * 0.03;
    const mat = check.ok ? ghostMats.ok : ghostMats.bad;
    mat.opacity = 0.45 + Math.sin(now * 5) * 0.08;
    ghost.g.traverse((o) => o.isMesh && (o.material = mat));
    check.cells.forEach((c, i) => {
      toWorld((c.gx + 0.5) * CELL_X, (c.gy + 0.5) * CELL_Y, 0.03, tmp.position);
      tmp.updateMatrix();
      grid.inst.setMatrixAt(grid.zone + i, tmp.matrix);
      grid.inst.setColorAt(grid.zone + i, col.set(c.ok ? "#7fd37a" : "#ea6f66"));
    });
    grid.inst.count = grid.zone + check.cells.length;
    grid.inst.instanceMatrix.needsUpdate = true;
    if (grid.inst.instanceColor) grid.inst.instanceColor.needsUpdate = true;
  }

  // ---------- reconciliation ----------
  function sync(state, dt) {
    now += dt;
    for (const bed of state.beds) {
      let o = beds.get(bed.id);
      if (!o) beds.set(bed.id, (o = bedObject(bed)));
      const wet = bed.plots.reduce((m, p) => Math.max(m, p.w), 0) / B.water.seconds;
      if (Math.abs(wet - o.wet) > 0.01) {
        o.wet = wet;
        o.dirt.traverse((m) => {
          if (!m.isMesh) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mm, i) => mm.color.copy(m.userData.baseColors[i]).multiplyScalar(1 - 0.32 * Math.min(1, wet * 1.4)));
        });
      }
      const pop = ease((now - o.born) / B.ui.popInSeconds);
      o.g.scale.setScalar(0.6 + 0.4 * overshoot((now - o.born) / B.ui.popInSeconds));
      bed.plots.forEach((p, i) => {
        const slot = o.plots[i];
        const stage = plotStage(p);
        const key = p.crop ? p.crop + ":" + stage : "";
        if (key !== slot.key) {
          if (slot.obj) slot.holder.remove(slot.obj);
          slot.obj = p.crop ? cropModel(p.crop, stage) : null;
          if (slot.obj) slot.holder.add(slot.obj);
          slot.key = key;
          slot.born = now;
        }
        if (!slot.obj) return;
        const grow = stage === 2 ? 1 : 0.72 + 0.28 * stageProgress(p);
        const popIn = overshoot((now - slot.born) / 0.45);
        slot.wiggle = Math.max(0, slot.wiggle - dt);
        slot.obj.scale.setScalar(grow * popIn * pop);
        slot.obj.rotation.z = Math.sin(now * 28) * 0.22 * (slot.wiggle / B.ui.wiggleSeconds);
        slot.obj.position.y = stage === 2 ? Math.abs(Math.sin(now * 2.2 + i)) * 0.03 : 0;
        // Ripe cue: rising golden sparkles.
        if (stage === 2 && (slot.sparkle -= dt) < 0) {
          slot.sparkle = 0.45 + Math.random() * 0.5;
          const pp = plotPosition(bed, i);
          world.particles.push({ x: pp.x + (Math.random() - 0.5) * 20, y: pp.y, vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 10, life: 1.4, kind: "sparkle", size: 4 });
        }
      });
    }
    for (const [id, o] of beds)
      if (!state.beds.some((b) => b.id === id)) {
        group.remove(o.g);
        beds.delete(id);
      }

    for (const b of state.buildings) {
      let o = buildings.get(b.id);
      if (!o) buildings.set(b.id, (o = buildingObject(b)));
      o.g.scale.setScalar(overshoot((now - o.born) / B.ui.popInSeconds));
    }

    for (const p of state.pickups) {
      let o = pickups.get(p.id);
      if (!o) pickups.set(p.id, (o = pickupObject(p)));
      const t = now - o.born;
      o.o.scale.setScalar(o.o.userData.base * overshoot(t / B.ui.popInSeconds));
      o.o.position.y = Math.abs(Math.sin(now * 2 + p.id)) * 0.025;
    }
    for (const [id, o] of pickups)
      if (!state.pickups.some((p) => p.id === id)) {
        pickups.delete(id);
        leaving.push({ o: o.o, t: 0, kind: "hop" });
      }

    for (const a of state.animals) {
      if (a.state !== "bones") continue;
      let o = remains.get(a.id);
      if (!o) remains.set(a.id, (o = remainsObject(a)));
      o.g.scale.setScalar(overshoot((now - o.born) / 0.8));
    }
    for (const [id, o] of remains)
      if (!state.animals.some((a) => a.id === id && a.state === "bones")) {
        remains.delete(id);
        leaving.push({ o: o.g, t: 0, kind: "sink" });
      }

    for (let i = leaving.length - 1; i >= 0; i--) {
      const l = leaving[i];
      l.t += dt;
      const u = l.t / 0.45;
      if (l.kind === "hop") {
        l.o.position.y = Math.sin(Math.min(1, u) * Math.PI) * 0.6 + u * 0.4;
        l.o.scale.multiplyScalar(0.93);
      } else l.o.scale.multiplyScalar(0.88);
      if (u >= 1) {
        group.remove(l.o);
        leaving.splice(i, 1);
      }
    }

    updateGhost(state);
    stallObj.scale.setScalar(1 + Math.max(0, Math.sin(now * 3)) * 0.012);

    // Publish footprints for hen navigation and grass hiding.
    const fp = [...state.beds.map((b) => ["bed", b]), ...state.buildings.map((b) => [b.type, b])];
    const key = fp.map(([t, b]) => t + b.gx + "," + b.gy).join("|");
    if (key !== hideKey) {
      hideKey = key;
      ctx.footprints.length = 0;
      for (const [t, b] of fp) {
        const [w, h] = footprintOf(t);
        ctx.footprints.push(cellRect(b.gx, b.gy, w, h));
      }
      ctx.onFootprints();
    }
  }

  function wiggle(bedId, index) {
    const o = beds.get(bedId);
    if (o?.plots[index]) o.plots[index].wiggle = B.ui.wiggleSeconds;
  }

  function anchorOf(kind, id, state) {
    if (kind === "pickup") {
      const p = state.pickups.find((q) => q.id === id);
      return p && { x: p.x, y: p.y, h: 0.15 };
    }
    if (kind === "remains") {
      const a = state.animals.find((q) => q.id === id);
      return a && { x: a.x, y: a.y, h: 0.2 };
    }
    if (kind === "bed") {
      const b = state.beds.find((q) => q.id === id);
      if (!b) return null;
      const [w, h] = footprintOf("bed");
      return { ...footprintCenter(b.gx, b.gy, w, h), h: 0.1 };
    }
    if (kind === "plot") {
      const b = state.beds.find((q) => q.id === id.bed);
      return b && { ...plotPosition(b, id.index), h: 0.15 };
    }
    if (kind === "building") {
      const b = state.buildings.find((q) => q.id === id);
      if (!b) return null;
      const [w, h] = footprintOf(b.type);
      return { ...footprintCenter(b.gx, b.gy, w, h), h: 0.6 };
    }
    if (kind === "stall") return { x: STALL.x, y: STALL.y, h: 0.6 };
    return null;
  }

  function lightsAtNight(night) {
    for (const l of ctx.lights) l.intensity = l.userData.owner ? night * 2.2 : 0;
  }

  return { group, sync, wiggle, anchorOf, lightsAtNight, get ghostValid() { return ghost?.valid ?? false; }, alive };
}
