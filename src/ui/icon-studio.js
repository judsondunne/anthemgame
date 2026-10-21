// Startup-only studio photography of the downloaded farm assets. Reuses the
// game's renderer and GPU context, then releases its render target. No object
// topology is generated here; composition is limited to downloaded models.
import * as THREE from 'three';
import { model, ownMaterials } from '../../assets.js';
import { BUILDINGS } from '../render/kit.js';
import { BALANCE as B } from '../config/balance.js';
import { registerItemIcons } from './icons.js';

const cropAsset = {
  daisy: 'flower_yellowC', wheat: 'crops_wheatStageB', tulip: 'flower_redA',
  cabbage: 'cabbage', sunflower: 'flower_yellowC', lavender: 'flower_purpleB',
};

export async function initializeItemIcons(renderer) {
  const pixels = Math.max(B.ui.iconPixels, Math.round(B.ui.iconLogicalPixels * Math.min(devicePixelRatio || 1, B.ui.iconDprMax)));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 100);
  scene.add(new THREE.HemisphereLight('#fff8e7', '#8b9a83', 2.25));
  const key = new THREE.DirectionalLight('#fff0d6', 3.2);
  key.position.set(-3, 5, 6);
  const fill = new THREE.DirectionalLight('#d4e9e1', 1.8);
  fill.position.set(4, 2, -3);
  scene.add(key, fill);
  const target = new THREE.WebGLRenderTarget(pixels, pixels, { depthBuffer: true, stencilBuffer: false });
  target.samples = Math.min(4, renderer.capabilities.maxSamples);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const old = {
    target: renderer.getRenderTarget(), viewport: renderer.getViewport(new THREE.Vector4()),
    scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest(),
    clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear, exposure: renderer.toneMappingExposure,
  };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = pixels;
  const context = canvas.getContext('2d');
  const cursor = document.createElement('canvas');
  cursor.width = cursor.height = 48;
  const cursorContext = cursor.getContext('2d');
  const bytes = new Uint8Array(pixels * pixels * 4);
  const image = context.createImageData(pixels, pixels);
  const entries = {};
  const snapshots = new Map();

  function make(key) {
    if (key.startsWith('kit_') && key !== 'kit_bed') return BUILDINGS[key.slice(4)]();
    let name = key === 'kit_bed' ? 'crops_dirtDoubleRow' : key === 'hay' ? 'hay-bale'
      : key === 'milk' ? 'carton-small' : key === 'fence' ? 'fence_simple' : key === 'gate' ? 'fence-gate'
      : key === 'can' ? 'watering-can' : key === 'flashlight' ? 'hand-flashlight' : key === 'fish' ? 'bowl-cereal'
      : key.startsWith('seed_') ? 'seed-sack' : key.startsWith('feed_') ? 'feed-sack'
      : key.startsWith('animal_chicken_') ? 'chicken-pixor'
      : key.startsWith('animal_cow_') ? key.endsWith('_m') ? 'bull' : 'cow'
      : key.startsWith('animal_horse_') ? 'horse' : cropAsset[key] ?? key;
    const root = model(name, { height: 1 });
    ownMaterials(root);
    if (key.startsWith('seed_')) root.rotation.x = Math.PI / 2;
    if (key === 'daisy') root.traverse(o => { if (o.isMesh && o.material.name === 'colorYellow') o.material.color.set('#fff5df'); });
    if (key === 'can') root.traverse(o => { if (o.isMesh) o.material.color.set('#86aaa4'); });
    if (key === 'animal_horse_m') root.traverse(o => { if (o.isMesh && /Main|Hair/.test(o.material.name)) o.material.color.multiplyScalar(.65); });
    if (key === 'animal_chicken_m') {
      const comb = root.getObjectByName('Hen_comb') ?? root.getObjectByName('Hen comb');
      if (comb) comb.scale.set(1.12, 1.3, 1.12);
      const tail = root.getObjectByName('Hen_tail') ?? root.getObjectByName('Hen tail');
      if (tail) tail.scale.set(1.2, 1.25, 1.25);
    }
    root.userData.mixer?.update(.1);
    return root;
  }

  async function photograph(key) {
    const object = make(key);
    scene.add(object);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    camera.position.copy(center).add(new THREE.Vector3(1.5, 1.05, 2.2).normalize().multiplyScalar(Math.max(size.length() * 2, 4)));
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    const half = Math.max(...corners.map(p => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 1.12;
    camera.left = camera.bottom = -half;
    camera.right = camera.top = half;
    camera.updateProjectionMatrix();
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, pixels, pixels, bytes);
    for (let y = 0; y < pixels; y++) image.data.set(bytes.subarray((pixels - y - 1) * pixels * 4, (pixels - y) * pixels * 4), y * pixels * 4);
    context.putImageData(image, 0, 0);
    // Crop and species seals distinguish seed packets and feed sacks without
    // letters. Their miniature is itself a photograph from this same studio.
    const sealKey = key.startsWith('seed_') ? key.slice(5) : key === 'feed_chicken' ? 'animal_chicken_f' : key === 'feed_cow' ? 'animal_cow_f' : key === 'feed_horse' ? 'animal_horse_f' : null;
    if (sealKey && snapshots.has(sealKey)) {
      const r = pixels * .24, x = pixels * .72, y = pixels * .70;
      context.fillStyle = '#fff7e5';
      context.strokeStyle = '#bca37b';
      context.lineWidth = pixels * .009;
      context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill(); context.stroke();
      context.drawImage(snapshots.get(sealKey), x - r * .88, y - r * .88, r * 1.76, r * 1.76);
    }
    const snapshot = document.createElement('canvas');
    snapshot.width = snapshot.height = pixels;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
    snapshots.set(key, snapshot);
    cursorContext.clearRect(0, 0, 48, 48);
    cursorContext.drawImage(canvas, 7, 7, 40, 40);
    cursorContext.fillStyle = '#fff9e9'; cursorContext.strokeStyle = '#5c5140'; cursorContext.lineWidth = 1.6;
    cursorContext.beginPath(); cursorContext.moveTo(3, 2); cursorContext.lineTo(3, 20); cursorContext.lineTo(8, 15); cursorContext.lineTo(13, 24); cursorContext.lineTo(17, 22); cursorContext.lineTo(12, 13); cursorContext.lineTo(19, 13); cursorContext.closePath(); cursorContext.fill(); cursorContext.stroke();
    const source = canvas.toDataURL('image/png');
    entries[key] = { html: `<img class="item-icon" src="${source}" width="${pixels}" height="${pixels}" alt="" draggable="false" decoding="sync">`, cursor: cursor.toDataURL('image/png') };
    object.userData.mixer?.stopAllAction();
    object.removeFromParent();
    // Geometry/textures are cache-owned. Only the local material clones are freed.
    const materials = new Set();
    object.traverse(o => { if (o.isMesh && o.userData.ownMaterial) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
    materials.forEach(m => m.dispose());
  }

  try {
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    renderer.setClearColor(0, 0);
    renderer.toneMappingExposure = 1;
    const keys = [...Object.keys(cropAsset), 'egg', 'milk', 'hay', 'animal_chicken_f', 'animal_chicken_m', 'animal_cow_f', 'animal_cow_m', 'animal_horse_f', 'animal_horse_m', ...Object.keys(cropAsset).map(k => 'seed_' + k), 'feed_chicken', 'feed_cow', 'feed_horse', 'kit_bed', 'kit_coop', 'kit_barn', 'kit_stable', 'fence', 'gate', 'can', 'fish', 'flashlight'];
    for (const key of keys) await photograph(key);
    registerItemIcons(entries);
  } finally {
    target.dispose(); snapshots.clear();
    renderer.setRenderTarget(old.target);
    renderer.setViewport(old.viewport);
    renderer.setScissor(old.scissor);
    renderer.setScissorTest(old.scissorTest);
    renderer.setClearColor(old.clear, old.alpha);
    renderer.autoClear = old.autoClear;
    renderer.toneMappingExposure = old.exposure;
  }
  return { count: Object.keys(entries).length, pixels };
}
