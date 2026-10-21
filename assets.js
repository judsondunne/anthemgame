import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
export const palette = {
  grass: "#94ad70",
  leaf: "#78985b",
  leafLight: "#a2b879",
  bark: "#816752",
  cream: "#f4e6c7",
  blush: "#d39b8f",
  gold: "#e3bf73",
  stone: "#b5b6a0",
  roof: "#738d88",
  water: "#659e9a",
  night: "#354c72",
};
export const windTime = { value: 0 };
export const duskUniform = { value: 0 };
export const manifest = await fetch("/assets/manifest.json").then((r) =>
  r.json(),
);
const loader = new GLTFLoader(),
  cache = new Map(),
  materials = new Map();
function material(original, key, sway) {
  const id = key + "|" + original.uuid + "|" + sway;
  if (materials.has(id)) return materials.get(id);
  const m = original.clone();
  m.roughness = 0.87;
  m.metalness = 0;
  const colors = {
    leafsGreen: palette.leaf,
    grass: palette.leafLight,
    leafsDark: "#537e67",
    woodBark: palette.bark,
    woodBarkDark: "#6e594a",
    woodInner: "#d2b28a",
    wood: "#c3ab86",
    woodDark: "#aa8c6d",
    stone: palette.stone,
    dirt: "#aa8a68",
    dirtDark: "#876e52",
    colorPurple: "#b39fcb",
    colorRed: palette.blush,
    colorYellow: palette.gold,
    Chicken_Main: palette.cream,
    Chicken_Red: "#cf8273",
    Beak: palette.gold,
  };
  if (colors[m.name]) m.color.set(colors[m.name]);
  if (m.map) {
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.color.set("#eee5d3");
  }
  if (key.startsWith("wall-window") || key === "wall-door") {
    m.onBeforeCompile = (s) => {
      s.uniforms.uDusk = duskUniform;
      s.vertexShader =
        "attribute float aWindowMask;varying float vWindowMask;\n" +
        s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n vWindowMask=aWindowMask;",
      );
      s.fragmentShader =
        "uniform float uDusk;varying float vWindowMask;\n" + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
 #ifdef USE_MAP
 vec3 glassSample=texture2D(map,vMapUv).rgb;float glassMask=vWindowMask*step(glassSample.r*1.16,glassSample.b)*step(glassSample.r*1.1,glassSample.g);totalEmissiveRadiance+=glassMask*uDusk*vec3(1.2,.58,.18);
 #endif`,
      );
    };
    m.customProgramCacheKey = () => "window-light-v1";
  }
  if (sway) {
    m.onBeforeCompile = (s) => {
      s.uniforms.uWindTime = windTime;
      s.vertexShader = "uniform float uWindTime;\n" + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n transformed.x += sin(uWindTime*1.2+position.x*2.3+position.z*3.1)*0.023*max(0.,position.y);",
      );
    };
    m.customProgramCacheKey = () => "foliage-wind-v1";
  }
  materials.set(id, m);
  return m;
}
export async function loadAssets() {
  await Promise.all(
    manifest.map(async (a) => {
      const gltf = await loader.loadAsync(a.path);
      if (a.name.startsWith("wall-window") || a.name === "wall-door")
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          const pos = o.geometry.attributes.position,
            mask = new Float32Array(pos.count);
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i),
              y = pos.getY(i),
              z = pos.getZ(i);
            mask[i] =
              Math.abs(x - 0.45) < 0.019 &&
              y > 0.23 &&
              y < 0.77 &&
              Math.abs(z) < 0.22
                ? 1
                : 0;
          }
          o.geometry.setAttribute(
            "aWindowMask",
            new THREE.BufferAttribute(mask, 1),
          );
        });
      gltf.scene.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(gltf.scene),
        size = bounds.getSize(new THREE.Vector3());
      cache.set(a.name, { ...a, gltf, bounds, size });
    }),
  );
}
export function assetInfo(name) {
  return cache.get(name);
}
export function model(
  name,
  { height, width, sway = false, raw = false, tint, recolor } = {},
) {
  const a = cache.get(name);
  if (!a) throw Error("Missing asset " + name);
  const root = new THREE.Group(),
    object = clone(a.gltf.scene);
  root.add(object);
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const map = (m) => material(m, name, sway);
      o.material = Array.isArray(o.material)
        ? o.material.map(map)
        : map(o.material);
      if (tint) {
        o.material = o.material.clone();
        o.material.color.multiply(new THREE.Color(tint));
      }
      if (recolor && !Array.isArray(o.material) && recolor[o.material.name]) {
        o.material = o.material.clone();
        o.material.color.set(recolor[o.material.name]);
      }
    }
  });
  const scale = height ? height / a.size.y : width ? width / a.size.x : 1;
  if (!raw) {
    object.position.set(
      -(a.bounds.min.x + a.bounds.max.x) * 0.5,
      -a.bounds.min.y,
      -(a.bounds.min.z + a.bounds.max.z) * 0.5,
    );
    root.scale.setScalar(scale);
  }
  root.userData.asset = name;
  root.userData.baseScale = root.scale.x;
  if (a.gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(object),
      actions = {};
    for (const clip of a.gltf.animations) {
      const n = clip.name.split("|").pop().toLowerCase();
      actions[n] = mixer.clipAction(clip);
    }
    root.userData.mixer = mixer;
    root.userData.actions = actions;
    play(root, "idle");
  }
  return root;
}
export function play(root, action) {
  const d = root.userData,
    a = d.actions;
  if (!a) return;
  const key =
    Object.keys(a).find((k) => k === action) ||
    Object.keys(a).find((k) => k.includes(action)) ||
    "idle";
  if (d.action === key) return;
  if (d.action) a[d.action]?.fadeOut(0.25);
  a[key]?.reset().fadeIn(0.25).play();
  d.action = key;
}

// Give a model its own material instances so per-animal states can tint it.
export function ownMaterials(root) {
  root.traverse((o) => {
    if (o.isMesh && !o.userData.ownMaterial) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      o.userData.ownMaterial = true;
      o.userData.baseColors = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.color.clone());
    }
  });
}

// Soft tonal shifts from each mesh's original colours: `cream` lightens toward a
// juvenile cream, `grey` mutes toward a soft grey (used for the dead).
const CREAM = new THREE.Color("#fff1dc");
export function softTone(root, cream = 0, grey = 0) {
  ownMaterials(root);
  const g = new THREE.Color();
  root.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m, i) => {
      const base = o.userData.baseColors[i];
      m.color.copy(base).lerp(CREAM, cream);
      const l = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11;
      g.setRGB(l * 0.92, l * 0.95, l * 0.9);
      m.color.lerp(g, grey);
      if (m.map && grey) m.color.multiplyScalar(1 - grey * 0.18);
    });
  });
}
export const desaturate = (root, amount) => softTone(root, 0, amount);

// Play a clip once and hold its final pose (collapse into the dead pose).
export function playOnce(root, action) {
  const d = root.userData,
    a = d.actions;
  if (!a) return false;
  const key = Object.keys(a).find((k) => k === action) || Object.keys(a).find((k) => k.includes(action));
  if (!key) return false;
  if (d.action === key) return true;
  if (d.action) a[d.action]?.fadeOut(0.2);
  a[key].reset().setLoop(THREE.LoopOnce, 1);
  a[key].clampWhenFinished = true;
  a[key].fadeIn(0.2).play();
  d.action = key;
  return true;
}
