// Kitbashed architecture. Every solid here is a downloaded Fantasy Town /
// Nature / Graveyard module; nothing is hand-modelled.
import * as THREE from "three";
import { model } from "../../assets.js";

export function piece(name, parent, x, y, z, sx = 1, sy = sx, sz = sx, rot = 0, tint) {
  const o = model(name, { raw: true, tint });
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.rotation.y = rot;
  parent.add(o);
  return o;
}

// The original cottage/coop recipe, parameterised so new buildings share it.
// Defaults reproduce the cottage exactly.
export function building(
  {
    coop = false,
    barn = false,
    front = ["wall-window-shutters", "wall-door", "wall-window-shutters"],
    sideFront = "wall-window-glass",
    sideBack = "wall",
    back = "wall",
    roof = "roof-gable-detail",
    roofScale = [3.4, 2.5, 5.1],
    height = 2.35,
    chimney = true,
    tint,
    roofTint,
  } = {},
  lanterns = [],
) {
  const b = new THREE.Group();
  const unit = 1.7,
    cols = 3,
    rear = -3.4;
  for (let i = 0; i < cols; i++) {
    const px = (i - 1) * unit;
    piece(front[i], b, px, 0, -0.85, unit, height, unit, -Math.PI / 2, tint);
    piece(back, b, px, 0, rear + 0.85, unit, height, unit, Math.PI / 2, tint);
  }
  piece(roof, b, 0, height, rear / 2, roofScale[0], roofScale[1], roofScale[2], Math.PI / 2, roofTint);
  for (let j = 0; j < 2; j++)
    for (const side of [-1, 1]) piece(j === 0 ? sideFront : sideBack, b, side * 1.7, 0, -0.85 - j * 1.7, unit, height, unit, side === 1 ? 0 : Math.PI, tint);
  // Porch decking, posts and pitched canopy, all from the same pack.
  if (!barn) {
    for (let i = -1; i <= 1; i++) piece("planks", b, i * 1.7, 0.02, 0.65, 1.7, 0.9, 1.4);
    for (const px of [-2.25, 2.25]) piece("pillar-wood", b, px, 0.04, 1.18, 1.1, 1.5, 1.1);
    piece("roof-gable", b, 0, 1.5, 0.85, 0.82, 0.5, 5.1, Math.PI / 2);
    piece("stairs-wood", b, 0, -0.02, 1.6, 0.55, 0.2, 1.3, Math.PI / 2);
    for (const px of [-1.75, 1.75]) piece("balcony-wall-fence", b, px, 0.05, 1.13, 1, 0.65, 1.1, -Math.PI / 2);
  }
  if (chimney) piece("chimney", b, 1.15, 2.6, -2.2, 1.2, 1.45, 1.2);
  if (!coop && !barn) {
    // Bay and ornamental gable crosswork reuse authentic downloaded wall modules.
    piece("wall-window-glass", b, -1.65, 0.7, 0.05, 0.7, 1.25, 0.8, -Math.PI / 2);
    piece("wall-window-glass", b, -2.05, 0.7, -0.1, 0.65, 1.25, 0.55, -Math.PI * 0.75);
    piece("wall-window-glass", b, -1.25, 0.7, -0.1, 0.65, 1.25, 0.55, -Math.PI * 0.25);
    piece("roof-gable-detail", b, -1.65, 1.95, 0.15, 0.9, 0.55, 1.35, Math.PI / 2);
    for (const px of [-1.25, 1.25]) piece("wall-detail-cross", b, px, 2.36, -0.84, 0.5, 0.4, 0.65, -Math.PI / 2);
    piece("wall-window-round", b, 0, 1.55, -0.8, 1.2, 1.1, 1.2, -Math.PI / 2);
  }
  const l = piece("lantern", b, 1.75, 0.45, 0.5, 0.7, 0.8, 0.7);
  lanterns.push(l);
  b.userData.lantern = l;
  return b;
}

// Placed buildings. Each returns a group whose origin is the footprint's
// front-centre; `depth` is how far the model extends behind that line.
const BARN_RED = "#d98f7c";
export const BUILDINGS = {
  coop() {
    const g = new THREE.Group();
    const lanterns = [];
    const house = building(
      {
        coop: true,
        barn: true,
        front: ["wall-wood-window-shutters", "wall-wood-door", "wall-wood-window-shutters"],
        sideFront: "wall-wood",
        sideBack: "wall-wood",
        back: "wall-wood",
        roof: "roof-gable",
        roofScale: [3.5, 2.1, 5.2],
        height: 2.1,
        chimney: false,
        tint: "#fff4e2",
        roofTint: "#f0b4a2",
      },
      lanterns,
    );
    house.scale.setScalar(0.58);
    house.position.z = -1.05;
    g.add(house);
    // Fenced run in front of the hen house.
    for (const x of [-1.25, -0.42, 0.42, 1.25]) piece("fence", g, x, 0, 0.05, 0.85, 0.55, 0.6, 0);
    for (const s of [-1, 1]) piece("fence", g, s * 1.55, 0, -0.38, 0.85, 0.55, 0.6, Math.PI / 2);
    piece("hay-bale", g, 1.15, 0, -0.65, 0.42, 0.42, 0.42, 0.3);
    g.userData.lantern = house.userData.lantern;
    g.userData.depth = 3.1;
    return g;
  },
  barn() {
    const g = new THREE.Group();
    const lanterns = [];
    const house = building(
      {
        barn: true,
        front: ["wall-wood-detail-cross", "wall-wood-door", "wall-wood-detail-cross"],
        sideFront: "wall-wood-window-shutters",
        sideBack: "wall-wood",
        back: "wall-wood",
        roof: "roof-high-gable",
        roofScale: [3.55, 2.8, 5.25],
        height: 2.5,
        chimney: false,
        tint: BARN_RED,
      },
      lanterns,
    );
    house.scale.setScalar(0.9);
    house.position.z = -0.55;
    g.add(house);
    for (const [x, z, r] of [
      [2.75, -0.9, 0.2],
      [2.85, -1.85, -0.15],
      [2.8, -1.38, 0.05],
    ])
      piece("hay-bale", g, x, z === -1.38 ? 0.36 : 0, z, 0.5, 0.5, 0.5, r);
    piece("cart", g, -2.8, 0, -1.2, 0.42, 0.42, 0.42, Math.PI * 0.55);
    g.userData.lantern = house.userData.lantern;
    g.userData.depth = 3.8;
    return g;
  },
  stable() {
    const g = new THREE.Group();
    const lanterns = [];
    const house = building(
      {
        barn: true,
        front: ["wall-wood-half", "wall-wood-door", "wall-wood-half"],
        sideFront: "wall-wood-window-shutters",
        sideBack: "wall-wood",
        back: "wall-wood",
        roof: "roof-gable-detail",
        roofScale: [3.5, 2.3, 5.3],
        height: 2.3,
        chimney: false,
      },
      lanterns,
    );
    house.scale.setScalar(0.9);
    house.position.z = -0.6;
    g.add(house);
    // Half doors open onto a small paddock rail.
    for (const x of [-2.35, -1.55, 1.55, 2.35]) piece("fence", g, x, 0, 0.12, 0.85, 0.7, 0.7, 0);
    piece("fence-gate", g, 0, 0, 0.18, 0.8, 0.75, 0.7, 0);
    for (const x of [-2.75, 2.75]) piece("poles", g, x, 0, 0.12, 0.6, 0.9, 0.6, 0);
    piece("hay-bale", g, -2.6, 0, -1.6, 0.48, 0.48, 0.48, 0.4);
    g.userData.lantern = house.userData.lantern;
    g.userData.depth = 3.5;
    return g;
  },
};

export function stall() {
  const g = new THREE.Group();
  const s = model("stall-red", { width: 2.2 });
  s.rotation.y = 0.12;
  g.add(s);
  for (const [x, z] of [
    [-0.55, 0.25],
    [0.05, 0.35],
  ]) {
    const crate = model("hay-bale", { width: 0.5 });
    crate.position.set(x + 1.25, 0, z);
    g.add(crate);
  }
  return g;
}
