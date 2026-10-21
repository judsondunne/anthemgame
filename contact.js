import * as THREE from "three";
import { manifest, loadAssets, model, assetInfo } from "./assets.js";
await loadAssets();
const scene = new THREE.Scene();
scene.background = new THREE.Color("#d5dac7");
const camera = new THREE.OrthographicCamera(-19, 19, 14.25, -14.25, 0.1, 200);
camera.position.set(0, 35, 25);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(1600, 1200);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.append(renderer.domElement);
scene.add(new THREE.HemisphereLight("#fff6de", "#7e9977", 2));
const sun = new THREE.DirectionalLight("#fff1d0", 3);
sun.position.set(-10, 20, 10);
scene.add(sun);
for (let i = 0; i < manifest.length; i++) {
  const a = assetInfo(manifest[i].name),
    o = model(manifest[i].name, {
      width: (1.85 * a.size.x) / Math.max(a.size.x, a.size.y, a.size.z),
    });
  o.position.set(((i % 9) - 4) * 3.3, 0, (Math.floor(i / 9) - 2.5) * 3.8);
  o.rotation.y = -Math.PI / 4;
  scene.add(o);
  o.userData.mixer?.update(0.01);
}
renderer.render(scene, camera);
window.ready = true;
