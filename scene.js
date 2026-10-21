import { meadowGeometry } from './src/render/meadow.js';
import { createHeldItem } from './src/render/held-item.js';
import { createPause } from './src/ui/pause.js';
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { VISUAL } from "./src/config/visual.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  loadAssets,
  model,
  play,
  palette,
  windTime,
  duskUniform,
  assetInfo,
} from "./assets.js";
import { building } from "./src/render/kit.js";
import { createFarmLayer } from "./src/render/farm-layer.js";
import { createAnimalRenderer } from "./src/render/animals.js";
import { Game } from "./src/game/controller.js";
import { createBridge } from "./src/game/bridge.js";
import { createCameraController } from "./src/game/camera.js";
import { createPlayerGeometry } from './src/game/surfaces.js';
import { createWaterFeedback } from './src/render/water-feedback.js';
import { waterAtWorld } from './src/sim/water.js';
import { initializeItemIcons } from './src/ui/icon-studio.js';
import { createSkyMaterial } from "./src/render/sky.js";
import { terrainHeight, createWorld } from "./src/render/world.js";
import { createThreats } from "./src/render/threats.js";
import { createWildlife } from './src/render/wildlife.js';
import { createCropInfo } from "./src/ui/crop-info.js";
import { createTutorial } from "./src/ui/tutorial.js";
import { createInput } from "./src/game/input.js";
import { createHud } from "./src/ui/hud.js";
import { createShop } from "./src/ui/shop.js";
import { createBubbles } from "./src/ui/bubbles.js";
import { createJuice } from "./src/ui/juice.js";
import { ICONS, itemIcon } from "./src/ui/icons.js";
import * as Sim from "./src/sim/index.js";
import "./src/ui/ui.css";
const G = window.GameState,
  { world, Farm, view, params } = G;
// The farm save loads (local + server) while the models download.
const game = new Game(params);
const loadingGame = game.load();
const canvas = document.querySelector("canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2("#b6c9b0", 0.0065);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .035, 430);
let cameraControl = null, largerWorld = null, threats = null, pause = null;
const root = new THREE.Group();
scene.add(root);
const hemi = new THREE.HemisphereLight("#fff4d7", "#687b55", 2);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff1d1", 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -24,
  right: 24,
  top: 24,
  bottom: -24,
  near: 1,
  far: 90,
});
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const moon = new THREE.DirectionalLight("#a8c7ed", 0.4);
moon.position.set(-10, 25, 15);
scene.add(moon);
const lantern = new THREE.PointLight("#ffc777", 0, 9, 1.7);
scene.add(lantern);
const windows = [];
const windowLights = [];
let farmLayer = null;
for (const [x, y] of [
  [630, 463],
  [320, 820],
]) {
  const l = new THREE.PointLight("#ffd393", 0, 4, 2);
  l.position.set((x - 700) / 50, 1.15, ((y - 650) * 1.65) / 50);
  scene.add(l);
  windowLights.push(l);
}
// A fixed pool for player buildings, so placing one never recompiles shaders.
const buildingLights = Array.from({ length: 6 }, () => {
  const l = new THREE.PointLight("#ffd393", 0, 4.5, 2);
  l.position.set(0, -50, 0);
  scene.add(l);
  return l;
});
const composer = new EffectComposer(renderer);

composer.addPass(new RenderPass(scene,camera));
const ssao = new SSAOPass(scene,camera,innerWidth,innerHeight,16);
ssao.kernelRadius=VISUAL.ao.radius;ssao.minDistance=VISUAL.ao.minDistance;ssao.maxDistance=VISUAL.ao.maxDistance;
composer.addPass(ssao);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.15,
  0.65,
  0.86,
);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, warm: { value: 0 } },
  vertexShader:
    "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader:
    "uniform sampler2D tDiffuse;uniform float warm;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float v=smoothstep(.8,.22,distance(vUv,vec2(.5)));c*=mix(.90,1.,v);c*=vec3(1.+warm*.055,1.,1.-warm*.06);gl_FragColor=vec4(c,1.);}",
});
composer.addPass(grade);
composer.addPass(new OutputPass());
const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);
let quality = params.get("quality") === "low" || (!params.has("quality") && matchMedia("(pointer:coarse)").matches) ? "low" : "high",
  fallback = false;
function qualitySet(q, automatic = false) {
  quality = q;
  fallback = automatic;
  const low = q === "low";
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 2));
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  bloom.enabled = !low;
  ssao.enabled = !low;
  grass && (grass.count = low ? VISUAL.grass.low : VISUAL.grass.high);
  threats?.setQuality(q);
  largerWorld?.setQuality?.(q);
  resize();
}
const logicalVector = new THREE.Vector3();
const logical = (x, y, h = 0) =>
  logicalVector.set((x - 700) / 50, h, ((y - 650) * 1.65) / 50);
const propertyColliders=[];
function place(o, x, y, h = 0) {
  o.position.copy(logical(x, y, h));
  root.add(o);
  if(/^(forest_leaf_tree|tree_)/.test(o.userData.asset??""))propertyColliders.push({x:o.position.x,z:o.position.z,radius:.46,type:"tree"});
  return o;
}
await loadAssets({anisotropy:renderer.capabilities.getMaxAnisotropy()});
await initializeItemIcons(renderer);
// Every architectural component below is a downloaded GLB module (see kit.js).
const house = place(building({}, windows), 630, 460);
house.scale.setScalar(1.03);
const cottage = house.userData.cottage;
const coop = place(building({ coop: true }, windows), 320, 818);
coop.scale.setScalar(1);
lantern.position.copy(logical(715, 476, 1.8));
// Hours come from the farm simulation's monotonic game time (5 min day + 5 min night);
// the original normalized cycle is still published for the behaviour scripts.
function hourToTime(h) {
  return h < 6
    ? (h / 6) * 0.075
    : h <= 20
      ? 0.075 + ((h - 6) / 14) * 0.615
      : 0.69 + ((h - 20) / 4) * 0.31;
}
function clockHour() {
  return Sim.clock.hourAt(game.state.time);
}
function publishClock() {
  const c = game.clock;
  world.externalTime = hourToTime(c.hour);
  world.externalNight = c.night;
  world.time = world.externalTime;
}
// Test hook: jump forward (never back) to an hour of the game day.
function setHour(h) {
  Sim.advanceToHour(game.state, h, { offline: true });
  Sim.drainEvents(game.state);
  publishClock();
}
await loadingGame;
publishClock();
// Continuous ground and painted path/pond floor are allowed ground shader geometry.
const groundMat = new THREE.MeshStandardMaterial({
  color: palette.grass,
  roughness: 1,
});
groundMat.onBeforeCompile = (s) => {
  s.uniforms.uTime = windTime;
  s.vertexShader = "varying vec3 vGround;\n" + s.vertexShader;
  s.vertexShader = s.vertexShader.replace(
    "#include <worldpos_vertex>",
    "#include <worldpos_vertex>\n vGround=(modelMatrix*vec4(transformed,1.)).xyz;",
  );
  s.fragmentShader =
    "uniform float uTime;varying vec3 vGround;\n" + s.fragmentShader;
  s.fragmentShader = s.fragmentShader.replace(
    "#include <color_fragment>",
    `#include <color_fragment>
 vec2 p=vGround.xz;float z=p.y;float pathX=-1.2+sin(z*.29)*.55;float pathMask=(1.-smoothstep(.57,.92,abs(p.x-pathX)))*smoothstep(-7.,-5.3,z);
 float n=sin(p.x*3.8+sin(z*2.4))*sin(z*4.1)*.021+sin(p.x*91.+sin(z*43.))*sin(z*79.)*.008;
 diffuseColor.rgb*=1.+n;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.54,.36),pathMask*.65);
 vec2 pond=(p-vec2(5.98,-.792))/vec2(3.02,2.376);float d=length(pond);if(d<.98)discard;float shore=1.-smoothstep(.97,1.08,d);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.36,.32),shore);
 float caustic=pow(max(0.,sin(p.x*8.+uTime)*sin(p.y*7.-uTime*.7)),12.);diffuseColor.rgb+=caustic*shore*.13;
 float cloud=sin(p.x*.2+uTime*.035+sin(p.y*.25))*sin(p.y*.19+uTime*.02);diffuseColor.rgb*=1.-smoothstep(.35,.85,cloud)*.07;`,
  );
};
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
// Tree/bush anchors exactly match the logical scenery. Flowers and crops retain growth references.
for (const s of world.scenery) {
  if (s.type === "tree")
    place(model("tree_oak", { height: 4.3 * s.scale, sway: true }), s.x, s.y);
  if (s.type === "bush")
    place(
      model("plant_bushLarge", { width: 1.35 * s.scale, sway: true }),
      s.x,
      s.y,
    );
  if (s.type === "flowers")
    place(
      model(
        "forest_flowers",
        { height: 0.5 * s.scale, sway: true },
      ),
      s.x,
      s.y,
    );
  if (s.type === "fence")
    for (let j = -1; j <= 1; j++)
      place(model("fence_simple", { width: 1.5 }), s.x + j * 72, s.y);
}
// Foundation beds: low evergreen mounds, lavender-height flowers and fern
// accents form continuous planted edges instead of isolated marker props.
for(const side of [-1,1])for(let i=0;i<5;i++){
  const x=630+side*(157+i*5),y=425+i*17;
  place(model('forest_shrub',{height:.5+(i%2)*.12,sway:true}),x,y);
  place(model(i%2?'forest_fern':'forest_flowers',{height:.34+(i%3)*.06,sway:true,tint:i%2?'#d1dcbc':'#e0cbe2'}),x+side*23,y+6);
}
for(let i=0;i<28;i++){
  const x=185+i*37,y=900+Math.sin(i*.7)*7;
  if(Math.abs(x-630)<62)continue;
  place(model('forest_shrub',{height:.52+(i%3)*.08,sway:true}),x,y);
  if(i%2===0)place(model('forest_grass_wispy',{height:.32,sway:true}),x+15,y-12);
}
// Garden beds and their crops are placed by the player (farm-layer.js).
for (let i = 0; i < 25; i++) {
  const y = 505 + i * 16,
    x = 620 + Math.sin(i * 0.35) * 23;
  const stone = place(
    model(i % 2 ? "stone_smallFlatA" : "stone_smallFlatB", {
      width: 0.5 + G.rand() * 0.25,
    }),
    x,
    y,
    0.015,
  );
  stone.rotation.y = G.rand() * 6.28;
}
for (let i = 0; i < 38; i++) {
  const a = (i / 38) * Math.PI * 2,
    r = 1 + 0.035 * Math.sin(a * 5);
  const stone = place(
    model(i % 3 ? "stone_largeA" : "stone_largeB", {
      width: 0.47 + G.rand() * 0.3,
    }),
    999 + Math.cos(a) * 151 * r,
    626 + Math.sin(a) * 72 * r,
    -0.03,
  );
  stone.rotation.y = G.rand() * 6.28;
  stone.scale.y *= 0.65;
}
for (const [x, y, big] of [
  [910, 617, 0],
  [1066, 656, 1],
  [1043, 581, 0],
  [928, 655, 1],
])
  place(model(big ? "lily_large" : "lily_small", { width: 0.65 }), x, y, 0.105);
for (const p of Farm.pastures) {
  for (let i = -7; i <= 7; i++)
    place(model("fence_simple", { width: 1.4 }), p.x + i * 72, 550);
  for (const [dx, y] of [
    [-450, 510],
    [450, 515],
    [p.kind === "cow" ? -480 : 480, 840],
  ])
    place(
      model("tree_detailed", { height: 3.7, sway: true }),
      // Positions keep the clearings the original fixed barns left.
      Math.abs(p.x + dx - (p.kind === "cow" ? -190 : 1590)) < 210
        ? (p.kind === "cow" ? -190 : 1590) + (p.kind === "cow" ? -250 : 250)
        : p.x + dx,
      y,
    );
  for (let i = -1; i <= 1; i++)
    place(
      model("bowl-cereal", { width: 1.1 }),
      p.gate + (p.kind === "cow" ? -65 : 65) + i * 54,
      795,
    );
}
for (const [x, y] of [
  [475, 480],
  [805, 470],
  [215, 790],
  [400, 815],
]) {
  place(model("pot_small", { height: 0.4 }), x, y);
  place(model("flower_redA", { height: 0.6, sway: true }), x, y, 0.3);
}
for(const[name,x,y,width]of[['forest_stump',1150,810,1.0],['log_large',150,925,1.4],['hay-bale',410,845,.9],['interior-benchCushion',785,485,1.45]]){
  const rest=place(model(name,{width}),x,y);rest.rotation.y=name.includes('bench')?-.15:.4;
}
// Layered borders reuse the same downloaded botanical family. They form the
// hedge between the farm land and the two pastures.
for (let i = 0; i < 75; i++) {
  const side = i % 2 ? -1 : 1,
    x = 700 + side * (765 + G.rand() * 25),
    y = 440 + G.rand() * 470;
  if (G.inPond(x, y, 15)) continue;
  place(
    model(i % 4 ? "plant_bush" : "flower_purpleB", {
      height: i % 4 ? 0.3 + G.rand() * 0.35 : 0.4,
      sway: true,
    }),
    x,
    y,
  );
}
for (let i = 0; i < 95; i++) {
  const x = 200 + G.rand() * 1000,
    y = 875 + G.rand() * 42;
  if (Math.abs(x - 650) < 65) continue;
  place(
    model("forest_flowers", {
      height: 0.28 + G.rand() * 0.26,
      sway: true,
      tint:["#d7c8ef","#f5e3b4","#efd3c9"][i%3],
    }),
    x,
    y,
  );
}
// Distant downloaded rock silhouettes and forest create the backdrop without handmade objects.
// Allowed pond surface shader: shore gradient, moving ripples, reflections and event rings.
const waterUniforms = {
  uTime: windTime,
  uNight: { value: 0 },
  uSun: { value: new THREE.Vector3() },
  uMoon: { value: new THREE.Vector3(0, 1, 0) },
  uGold: { value: 0 },
  uRipples: {
    value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)),
  },
};
const waterMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: waterUniforms,
  vertexShader:
    "varying vec2 vUv;varying vec3 vPos;void main(){vUv=uv;vPos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vPos,1.);}",
  fragmentShader: `uniform float uTime;uniform float uNight;uniform vec3 uSun;uniform vec3 uMoon;uniform float uGold;uniform vec4 uRipples[8];varying vec2 vUv;varying vec3 vPos;
void main(){vec2 p=(vUv-.5)*2.;float a=atan(p.y,p.x);float edge=1.+.035*sin(a*5.)+.025*cos(a*3.);float d=length(p)/edge;if(d>1.)discard;
float rip=sin(vPos.x*6.+uTime*.8+sin(vPos.z*4.+uTime*.5))*.5+.5;float lines=pow(rip,18.);
for(int i=0;i<8;i++){float age=uTime-uRipples[i].z;float rr=length(vPos.xz-uRipples[i].xy);if(age>0.&&age<3.)lines+=exp(-pow((rr-age*.7)*18.,2.))*(1.-age/3.)*.8;}
vec3 c=mix(vec3(.43,.67,.59),vec3(.12,.36,.37),smoothstep(.0,1.,1.-d));c+=lines*.065;
float shine=pow(max(0.,sin(vPos.x*2.8+vPos.z*3.1+uTime*.7)),35.);c+=shine*vec3(.26,.24,.13);c=mix(c,c*vec3(.45,.66,.88),uNight*.88);
vec2 wv=vec2(sin(vPos.x*5.+uTime*1.1+sin(vPos.z*3.)),cos(vPos.z*6.-uTime*.9));vec3 nrm=normalize(vec3(wv.x*.09,1.,wv.y*.09));vec3 refl=reflect(normalize(vec3(-.142,-.709,-.695)),nrm);
vec3 mDir=normalize(vec3(uMoon.x,max(.15,uMoon.y),-abs(uMoon.z)));vec3 sDir=normalize(vec3(uSun.x,max(.15,uSun.y),-abs(uSun.z)));
c+=vec3(.86,.91,1.)*pow(max(0.,dot(refl,mDir)),180.)*uNight*1.3+vec3(1.,.8,.52)*pow(max(0.,dot(refl,sDir)),140.)*(1.-uNight)*(.25+uGold*.9);float shore=smoothstep(1.,.82,d);gl_FragColor=vec4(c,.28+shore*.24);}`,
});
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(6.1, 4.8, 42, 36),
  new THREE.MeshStandardMaterial({ color: "#548c80", roughness: 1 }),
);
floor.material.onBeforeCompile = (s) => {
  s.uniforms.uTime = windTime;
  s.vertexShader = "varying vec2 vFloor;\n" + s.vertexShader;
  s.vertexShader = s.vertexShader.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\n vFloor=position.xz;",
  );
  s.fragmentShader =
    "uniform float uTime;varying vec2 vFloor;\n" + s.fragmentShader;
  s.fragmentShader = s.fragmentShader.replace(
    "#include <color_fragment>",
    "#include <color_fragment>\n diffuseColor.rgb+=pow(max(0.,sin(vFloor.x*9.+uTime)*sin(vFloor.y*11.-uTime*.7)),14.)*.19;",
  );
};
floor.geometry.rotateX(-Math.PI/2);
const floorOrigin=logical(999,626).clone(),floorPositions=floor.geometry.attributes.position;
for(let i=0;i<floorPositions.count;i++){const waterVolume=waterAtWorld(floorOrigin.x+floorPositions.getX(i),floorOrigin.z+floorPositions.getZ(i));floorPositions.setY(i,waterVolume?.bottom??-.02);}
floor.geometry.computeVertexNormals();
floor.position.copy(floorOrigin);
root.add(floor);
const water = new THREE.Mesh(new THREE.PlaneGeometry(6.24, 4.92), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.copy(logical(999, 626, 0.12));
root.add(water);
// Only grass blades use generated mesh geometry; the instanced meadow bends around hens.
let grass, grassBase;
const henUniform = {
  value: Array.from({ length: 12 }, () => new THREE.Vector3(999, 0, 999)),
};
const hideUniform = { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, 0, 0)) };
const grassMat = new THREE.MeshStandardMaterial({
  color: "#a4b97d",
  vertexColors:true,
  side: THREE.DoubleSide,
  roughness: 1,
});
grassMat.onBeforeCompile = (s) => {
  s.uniforms.uTime = windTime;
  s.uniforms.uHens = henUniform;
  s.uniforms.uHide = hideUniform;
  s.vertexShader =
    "uniform float uTime;uniform vec3 uHens[12];varying float vTip;\n" +
    s.vertexShader;
  s.vertexShader = s.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
 vTip=uv.y;vec3 anchor=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;float gust=sin(anchor.x*.7+anchor.z*.42+uTime*1.3)+.35*sin(anchor.x*1.9-uTime*2.2);transformed.x+=gust*uv.y*uv.y*.10;
 for(int i=0;i<12;i++){vec2 delta=anchor.xz-uHens[i].xz;float d2=dot(delta,delta);if(d2<.49&&d2>.000001){float d=sqrt(d2);transformed.xz+=delta/d*(.7-d)*uv.y*.65;}}
`,
  );
  s.fragmentShader = "varying float vTip;\n" + s.fragmentShader;
  s.fragmentShader = s.fragmentShader.replace(
    "#include <color_fragment>",
    "#include <color_fragment>\n diffuseColor.rgb*=mix(.68,1.16,vTip);",
  );
};
const blade = meadowGeometry();
grass = new THREE.InstancedMesh(blade, grassMat, VISUAL.grass.high);
grass.receiveShadow = true;
const dummy = new THREE.Object3D();
let gi = 0;
while (gi < VISUAL.grass.high) {
  const central = gi < VISUAL.grass.high*.82,
    x = central
      ? (G.rand() + G.rand() + G.rand() - 1.5) * 25
      : -95 + G.rand() * 190,
    z = central
      ? (G.rand() + G.rand() + G.rand() - 1.5) * 23
      : -24 + G.rand() * 70,
    lx = x * 50 + 700,
    ly = (z * 50) / 1.65 + 650;
  if (
    cottage.contains(x,z) ||
    G.inPond(lx, ly, 10) ||
    G.insideBed(lx, ly, 8) ||
    (Math.abs(x - (-1.2 + Math.sin(z * 0.29) * 0.55)) < 0.9 && z > -6) ||
    (lx > 500 && lx < 790 && ly < 493) ||
    (lx > 233 && lx < 445 && ly > 744 && ly < 850)
  )
    continue;
  dummy.position.set(x, Math.max(0,terrainHeight(x,z))+.006, z);
  dummy.rotation.y = G.rand() * 6.28;
  dummy.scale.setScalar(0.65 + G.rand() * 0.85);
  dummy.updateMatrix();
  grass.setMatrixAt(gi++, dummy.matrix);
}
grass.instanceMatrix.needsUpdate = true;
grassBase=grass.instanceMatrix.array.slice();
scene.add(grass);
// Batch repeated static meshes by shared material while retaining downloaded topology.
root.updateMatrixWorld(true);
const staticBatches = new Map();
root.traverse(o=>{if(o.userData.asset&&/stone|rock|boulder|log|stump|hay-bale|bench|stairs|trough|bowl-cereal/.test(o.userData.asset)){const b=new THREE.Box3().setFromObject(o);if(!b.isEmpty())o.userData.surfaceBounds={min:b.min.toArray(),max:b.max.toArray()};}});
root.traverse((o) => {
  if (
    !o.isMesh ||
    o.isSkinnedMesh ||
    Array.isArray(o.material) ||
    o === water ||
    o === floor
  )
    return;
  let p = o,
    lanternPart = false;
  while (p && p !== root) {
    if (p.userData.asset === "lantern" || p.userData.dynamicArchitecture) lanternPart = true;
    p = p.parent;
  }
  if (lanternPart) return;
  let batch = staticBatches.get(o.material);
  if (!batch) {
    batch = [];
    staticBatches.set(o.material, batch);
  }
  batch.push(o);
});
let mergedMeshCount = 0;
for (const [material, meshes] of staticBatches) {
  if (meshes.length < 2) continue;
  const geometries = meshes.map((o) =>
    o.geometry.clone().applyMatrix4(o.matrixWorld),
  );
  const geometry = mergeGeometries(geometries, false);
  if (!geometry) throw Error("Incompatible static asset batch");
  const batch = new THREE.Mesh(geometry, material);
  let triangleOffset=0;
  batch.userData.sources=meshes.map(mesh=>{let parent=mesh,asset='';while(parent&&parent!==root){asset=parent.userData.asset||asset;parent=parent.parent;}const count=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;const record={asset,start:triangleOffset,count};triangleOffset+=count;return record;});
  batch.castShadow = true;
  batch.receiveShadow = true;
  root.add(batch);
  for (const o of meshes) {
    o.removeFromParent();
    mergedMeshCount++;
  }
  for (const g of geometries) g.dispose();
}
// Animated model instances live in their own group (never batched).
const dynamicRoot = new THREE.Group();
scene.add(dynamicRoot);
const bees = [];
for (let i = 0; i < 5; i++) {
  const o = place(model("animal-bee", { width: 0.2 }), 350 + i * 145, 600, 1.3);
  play(o, "idle");
  bees.push(o);
}
const birds = [];
for (let i = 0; i < 7; i++) {
  const o = model("animal-parrot", { height: 0.25, tint: "#a2afa6" });
  root.add(o);
  birds.push(o);
}
let lastGooseCycle = -1;

// Allowed sky dome shader with clouds, sun/moon discs and stars.
const skyMat = createSkyMaterial(windTime);
const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 32, 16), skyMat);
scene.add(sky);
// Particles: ambient fireflies, smoke, petals and care bursts, no modeled props.
const maxParticles = 650,
  pos = new Float32Array(maxParticles * 3),
  colors = new Float32Array(maxParticles * 3),
  sizes = new Float32Array(maxParticles),
  particleTypes = new Float32Array(maxParticles);
const pg = new THREE.BufferGeometry();
pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
pg.setAttribute("color", new THREE.BufferAttribute(colors, 3));
pg.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
pg.setAttribute("particleType", new THREE.BufferAttribute(particleTypes, 1));
const pm = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexColors: true,
  uniforms: { uDpr: { value: Math.min(devicePixelRatio, 2) } },
  vertexShader:
    "attribute float size;attribute float particleType;varying float vType;varying vec3 vColor;uniform float uDpr;void main(){vType=particleType;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*uDpr;}",
  fragmentShader:
    "varying float vType;varying vec3 vColor;void main(){vec2 p=(gl_PointCoord-.5)*2.;float d=length(p);float alpha=pow(max(0.,1.-d),1.5)*.65;if(vType>.5&&vType<1.5){float l=length((p-vec2(-.38,0.))*vec2(1.8,1.15));float r=length((p-vec2(.38,0.))*vec2(1.8,1.15));alpha=(1.-smoothstep(.7,1.,min(l,r)))*.85;}else if(vType>1.5&&vType<2.5){vec2 q=vec2(p.x,-p.y)*1.15;float h=pow(dot(q,q)-.55,3.)-q.x*q.x*q.y*q.y*q.y;alpha=(1.-smoothstep(-.02,.02,h))*.85;}else if(vType>2.5&&vType<3.5){alpha=(1.-smoothstep(.6,.9,length(p*vec2(1.35,.8))))*.8;}else if(vType>3.5){alpha=(1.-smoothstep(.75,.9,d))*smoothstep(.65,.8,length(p-vec2(.3,-.25)));}if(alpha<.01)discard;gl_FragColor=vec4(vColor,alpha);}",
});
const particles = new THREE.Points(pg, pm);
particles.frustumCulled = false;
scene.add(particles);
let currentNight = 0;
const tone = (hex) => new THREE.Color(hex);
const LIGHT = {
  hemiDay: tone("#dcecf5"), hemiGold: tone("#ffd9b4"), hemiNight: tone("#a4bce0"),
  groundDay: tone("#4c6458"), groundNight: tone("#596b7d"),
  sunDay: tone("#fff5e5"), sunDusk: tone("#ffc487"), sunDawn: tone("#ffd1a4"),
  fogDay: tone("#b8c9c4"), fogDusk: tone("#c7b09a"), fogDawn: tone("#cdbbb6"), fogNight: tone("#344a65"),
};
const mix = new THREE.Color();
moon.target.position.set(0, 0, 0);
scene.add(moon.target);
// Sun arcs across the day phase and sets at dusk; the moon rises at dusk and
// crosses the night. Dawn and dusk both blend through golden light.
function lighting() {
  const h = clockHour(),
    S = THREE.MathUtils.smoothstep;
  const night = h >= 12 ? S(h, 18.4, 21) : 1 - S(h, 4.6, 6.5);
  const dusk = Math.exp(-(((h - 18) / 1.7) ** 2)),
    dawn = 0.8 * Math.exp(-(((h - 6.1) / 0.6) ** 2)),
    gold = Math.max(dusk, dawn),
    morning = dawn > dusk;
  currentNight = night;
  duskUniform.value = night;
  const shadowFocus=cameraControl?.snapshot().focus;
  const pan = cameraControl?.isFirstPerson ? camera.position.x : shadowFocus?.[0] ?? Farm.pan / 50;
  const sunAngle = ((h - 6) / 14) * Math.PI;
  sun.position.set(-Math.cos(sunAngle) * 22 + pan, Math.max(3, Math.sin(sunAngle) * 26), 12);
  const shadowZ = cameraControl?.isFirstPerson ? camera.position.z : shadowFocus?.[2] ?? 0;
  sun.position.z += shadowZ;
  sun.target.position.set(pan, 0, shadowZ);
  const shadowSpan = Math.max(7, Math.min(29, (cameraControl?.snapshot().distance ?? 35) * .65));
  Object.assign(sun.shadow.camera, {left:-shadowSpan,right:shadowSpan,top:shadowSpan,bottom:-shadowSpan});
  sun.shadow.camera.updateProjectionMatrix();
  const moonAngle = (((h >= 20 ? h - 20 : h + 4) % 24) / 10) * Math.PI;
  const moonHigh = Math.max(0, Math.sin(moonAngle));
  moon.position.set(-Math.cos(moonAngle) * 20 + pan, Math.max(4, moonHigh * 24), 10);
  moon.target.position.set(pan, 0, 0);
  hemi.intensity = 1.08 - night * (cameraControl?.isFirstPerson ? .57 : .28);
  // Cool night tints arrive late in the dusk so twilight keeps its warmth.
  const cool = S(night, 0.3, 0.8);
  hemi.color.copy(LIGHT.hemiDay).lerp(LIGHT.hemiGold, gold * 0.2).lerp(LIGHT.hemiNight, cool);
  hemi.groundColor.copy(LIGHT.groundDay).lerp(LIGHT.groundNight, cool);
  sun.intensity = (3.1 + gold * 0.65) * (1 - night);
  sun.color.copy(LIGHT.sunDay).lerp(morning ? LIGHT.sunDawn : LIGHT.sunDusk, S(gold, 0.12, 0.45));
  moon.intensity = night * (cameraControl?.isFirstPerson ? .27 + .16 * moonHigh : .6 + .3 * moonHigh);
  lantern.intensity = night * (7 + Math.sin(world.elapsed * 5) * 0.2);
  for (const l of windowLights) l.intensity = night * 2.2;
  farmLayer?.lightsAtNight(night);
  renderer.toneMappingExposure = 1.12 + night * 0.12;
  mix.copy(LIGHT.fogDay).lerp(morning ? LIGHT.fogDawn : LIGHT.fogDusk, S(gold, 0.2, 0.6)).lerp(LIGHT.fogNight, cool);
  scene.fog.color.copy(mix);
  skyMat.uniforms.uHour.value = h;
  skyMat.uniforms.uNight.value = night;
  skyMat.uniforms.uGold.value = gold;
  skyMat.uniforms.uSun.value.copy(sun.position).sub(sun.target.position).normalize();
  skyMat.uniforms.uMoon.value.copy(moon.position).sub(moon.target.position).normalize();
  waterUniforms.uNight.value = night;
  waterUniforms.uGold.value = gold;
  waterUniforms.uSun.value.copy(skyMat.uniforms.uSun.value);
  waterUniforms.uMoon.value.copy(skyMat.uniforms.uMoon.value);
  grade.uniforms.warm.value = gold;
  for (const l of windows)
    l.traverse((m) => {
      if (m.isMesh) {
        if (!m.userData.lit) {
          m.material = m.material.clone();
          m.userData.lit = true;
        }
        m.material.emissive.set("#ffbb60");
        m.material.emissiveIntensity = night * 0.8;
      }
    });
}
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  ssao.setSize(Math.ceil(innerWidth*.6),Math.ceil(innerHeight*.6));
  fxaa.material.uniforms.resolution.value.set(1/(innerWidth*renderer.getPixelRatio()),1/(innerHeight*renderer.getPixelRatio()));
  view.w = innerWidth; view.h = innerHeight; view.dpr = renderer.getPixelRatio();
  cameraControl?.resize();
}
const projection = new THREE.Vector3();
function cameraUpdate(dt = .016) { cameraControl?.update(dt); }
function screen(x, y, height = 0) {
  projection.copy(logical(x, y, height)).project(camera);
  return {
    x: (projection.x * 0.5 + 0.5) * innerWidth,
    y: (-0.5 * projection.y + 0.5) * innerHeight,
    visible: projection.z > -1 && projection.z < 1,
  };
}
function animateObjects(dt) {
  const t = world.elapsed;
  const gooseCycle = Math.floor(t / 100);
  if (t % 100 > 14 && lastGooseCycle !== gooseCycle) {
    AudioGarden.goose(0);
    lastGooseCycle = gooseCycle;
  }
  animals.update(dt);
  bees.forEach((o, i) => {
    o.position.copy(
      logical(
        350 + i * 145 + Math.sin(t * 0.4 + i) * 35,
        600 + Math.cos(t * 0.35 + i) * 40,
        1.1 + Math.sin(t * 2 + i) * 0.15,
      ),
    );
    o.userData.mixer?.update(dt);
  });
  birds.forEach((o, i) => {
    const phase = t % 100;
    o.visible = phase > 14 && phase < 52;
    o.position.set(
      -25 + (phase - 14) * 1.35 - Math.ceil(i / 2) * 0.65,
      7 + (i % 2 ? 0.2 : -0.2) * Math.ceil(i / 2),
      -8 + i * 0.3,
    );
    o.rotation.z = Math.sin(t * 5 + i) * 0.16;
  });
  for (let j = 0; j < 8; j++) {
    const r = world.ripples[world.ripples.length - 1 - j];
    if (r) {
      const p = logical(r.x, r.y);
      waterUniforms.uRipples.value[j].set(p.x, p.z, t - (3 - r.life), 0);
    } else waterUniforms.uRipples.value[j].z = -100;
  }
}
const PARTICLE = {
  heart: [8, "#e49d9c", 2],
  water: [4, "#bce5dd", 3],
  sparkle: [9, "#fff0b8", 0],
  dust: [10, "#d8cbb0", 0],
  feather: [6, "#fff6e4", 0],
};
function particleUpdate() {
  const t = world.elapsed;
  let n = 0;
  const c = new THREE.Color();
  function put(x, y, z, size, color, type = 0) {
    if (n >= maxParticles) return;
    pos[n * 3] = x;
    pos[n * 3 + 1] = y;
    pos[n * 3 + 2] = z;
    sizes[n] = size;
    particleTypes[n] = type;
    c.set(color);
    colors[n * 3] = c.r;
    colors[n * 3 + 1] = c.g;
    colors[n * 3 + 2] = c.b;
    n++;
  }
  for (let i = 0; i < 30; i++) {
    const u = (t * 0.12 + i / 30) % 1;
    put(
      -0.7 + u * 0.7 + Math.sin(t * 0.3 + i) * 0.12,
      3.6 + u * 2.1,
      -8.45,
      5 + u * 13,
      "#bfc2b5",
    );
  }
  put(
    lantern.position.x,
    lantern.position.y,
    lantern.position.z,
    18 * currentNight,
    "#ffcf7a",
  );
  for (let i = 0; i < 60; i++) {
    const x = -12 + ((i * 7.13) % 25),
      z = -5 + ((i * 3.71) % 17);
    put(
      x + Math.sin(t * 0.4 + i) * 0.3,
      0.5 + Math.sin(t * 0.6 + i) * 0.3,
      z,
      currentNight * (2 + Math.max(0, Math.sin(t * 2 + i)) * 5),
      "#f7da87",
    );
  }
  for (let i = 0; i < 7; i++) {
    const v = logical(
      300 + i * 120 + Math.sin(t * 0.3 + i) * 35,
      550 + ((i * 61) % 290),
      1 + Math.sin(t * 0.8 + i) * 0.2,
    );
    put(
      v.x,
      v.y,
      v.z,
      5 + Math.abs(Math.sin(t * 5 + i)) * 6,
      i % 2 ? "#e7c98f" : "#d4a8b6",
      1,
    );
  }
  if (world.chickens.some((a) => a.sleeping))
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.3 + i / 3) % 1,
        v = logical(320 + u * 18, 800, 1.7 + u * 0.7);
      put(v.x, v.y, v.z, 10, "#e7d7a4", 4);
    }
  for (let i = 0; i < 28; i++) {
    const u = (t * 0.07 + i / 28) % 1;
    put(
      -15 + ((i * 7.19) % 30) + u * 2,
      3 - u * 3,
      -7 + ((i * 2.91) % 19),
      2.5,
      "#dfb8aa",
    );
  }
  for (const p of world.particles) {
    const v = logical(p.x, p.y, 0.2 + Math.max(0, 1.8 - p.life) * 0.35);
    const [size, color, type] = PARTICLE[p.kind] ?? [4, "#efd398", 0];
    put(v.x, v.y, v.z, size, color, type);
  }
  for (const f of [...world.food, ...world.fishFood]) {
    const v = logical(f.x, f.y, 0.14);
    put(v.x, v.y, v.z, 3, "#e0be77");
  }
  for (const w of world.watering)
    for (let j = 0; j < 9; j++) {
      const v = logical(
        w.x - 18 + j * 4,
        w.y,
        0.2 + ((t * 1.3 + j * 0.11) % 1) * 0.8,
      );
      put(v.x, v.y, v.z, 4, "#c1e6e0");
    }
  pg.setDrawRange(0, n);
  pg.attributes.position.needsUpdate = true;
  pg.attributes.color.needsUpdate = true;
  pg.attributes.size.needsUpdate = true;
  pg.attributes.particleType.needsUpdate = true;
}
// ---------- farm layers, interface and input ----------
function updateHide() {
  hideUniform.value.forEach((v, i) => {
    const r = G.FarmFootprints[i];
    if (r) v.set((r.x0 - 700) / 50, ((r.y0 - 650) * 1.65) / 50, (r.x1 - 700) / 50, ((r.y1 - 650) * 1.65) / 50);
    else v.set(0, 0, 0, 0);
  });
  // Building footprints change only on placement/load: hide tufts once here,
  // instead of running 24 footprint tests for every blade vertex every frame.
  if(grassBase){const matrices=grass.instanceMatrix.array;matrices.set(grassBase);for(let i=0;i<VISUAL.grass.high;i++){const n=i*16,x=grassBase[n+12],z=grassBase[n+14];if(hideUniform.value.some(r=>x>r.x&&x<r.z&&z>r.y&&z<r.w))for(let j=0;j<12;j++)matrices[n+j]=0;}grass.instanceMatrix.needsUpdate=true;}
}
largerWorld = createWorld({scene, camera, quality, seed: game.state.seed});
largerWorld.colliders.push(...propertyColliders);
function bindWorldCollision(){Sim.setWorldColliders(game.state,largerWorld.colliders.map(c=>({x:c.x*50+700,y:c.z*50/1.65+650,r:c.radius*50})));}
bindWorldCollision();
const playerGeometry=createPlayerGeometry({world:largerWorld,cottage,scene,getState:()=>game.state});
cameraControl = createCameraController({camera, canvas, game, Farm, view, params,
  worldGeometry: playerGeometry,
  onPointerUnlock: () => pause?.set(true),
  isUIBlocked: () => game.paused || !!(document.querySelector('#shop.open') || document.querySelector('#backpack:not([hidden])')),
  onModeChange: () => { document.exitPointerLock?.(); },
});
farmLayer = createFarmLayer({ scene, camera, world, lights: buildingLights, footprints: G.FarmFootprints, registerLantern: (l) => windows.push(l), onFootprints: updateHide });
const animals = createAnimalRenderer({ group: dynamicRoot, world, Farm, logical, henUniform, burst: G.burst, camera, getQuality:()=>quality });
const bridge = createBridge(G, game, {heightAt:largerWorld.heightAt});
const waterFeedback=createWaterFeedback({scene,cameraControl,getState:()=>game.state,audio:AudioGarden});
const wildlife=createWildlife({scene,cameraControl,world:largerWorld,game,getQuality:()=>quality,onWater:waterFeedback.emit});
const juice = createJuice({ audio: AudioGarden });
let input = null, tutorial = null;
const hud = createHud({
  game,
  audio: AudioGarden,
  onSelect: (k) => selectItem(k),
  onShop: () => (shop.isOpen ? shop.close() : shop.open(shop.tab)),
  onConfirm: () => input.confirm(),
  onCancel: () => input?.cancel(),
  onMode: () => { hud.toggleInventory(false); shop.close(); cameraControl.toggle(); game.persist.noteAction(); },
  onHelp: () => tutorial?.help(),
  onFlashlight: () => threats?.toggleFlashlight(),
});
const shop = createShop({ game, hud, juice, audio: AudioGarden, onKit: (kit) => input.startPlacement(kit) });
input = createInput({ canvas, camera, G, game, hud, shop, farm: farmLayer, bridge, juice, screen, cameraControl, cottage,
 onSelect: (k,index) => index != null ? hud.selectSlot(index,true) : selectItem(k),
 onInventory: () => {shop.close();hud.toggleInventory();}, onFlashlight: () => threats?.toggleFlashlight(),
 onPause:()=>pause.toggle(),onMode:()=>cameraControl.toggle(),
});
threats = createThreats({scene,camera,renderer,game,cameraControl,bridge,animalRenderer:animals,hud,audio:AudioGarden,screen});
const cropInfo=createCropInfo({game,hud,input,canvas});
pause=createPause({game,cameraControl,hud,shop,canvas});
const heldItem=createHeldItem({renderer,hud,game,cameraControl,getNight:()=>currentNight});
tutorial = createTutorial({game,onMode:()=>cameraControl.setMode('fp'),onFence:()=>{hud.select('fence');}});

function selectItem(k, index) {
  if (!k) return;
  G.startAudio();
  if (k.startsWith("kit_")) return input.startPlacement(k);

  hud.select(k);
}
const bubbleUi = createBubbles({
  G,
  game,
  bridge,
  screen,
  onAnimal(id, what, btn, el) {
    const a = game.state.animals.find((q) => q.id === id);
    if (!a) return;
    const r = what === "food" ? input.feedOne(a, Sim.foodsFor(a.sp).includes(hud.selected) ? hud.selected : null) : input.waterOne(a);
    if (!r.ok) juice.shake(el);
  },
  onBed(id, what, btn, el) {
    const bed = game.state.beds.find((b) => b.id === id);
    if (!bed) return;
    if (what === "harvest") {
      if (!input.harvestAll(bed)) juice.shake(el);
    } else {
      game.act("waterBed", id);
      const c = Sim.layout.plotPosition(bed, 1);
      world.watering.push({ target: bed, x: c.x - 20, y: c.y, life: 2.2 });
      G.burst(c.x, c.y - 10, "water");
    }
  },
  onAmbient: (n) => G.fulfillNeed(n),
});
const herdHomeX = { cow: -530, horse: 1930 };
game.on((e) => {
  const s = game.state;
  if (e.type === "replace") { bindWorldCollision(); return bridge.reset(); }
  if (e.type === "birth") {
    const a = s.animals.find((q) => q.id === e.id);
    if (a) G.burst(a.x, a.y - 20, "heart");
  } else if (e.type === "unlock") juice.flourish([ICONS[e.building], itemIcon(`animal_${e.sp}_f`)]);
  else if (e.type === "gift") {
    for (const k of Object.keys(e.items)) juice.fly(innerWidth / 2, innerHeight * 0.35, itemIcon(k), hud.slotEl(k));
  } else if (e.type === "arrive" && e.sp !== "chicken" && !cameraControl.isFirstPerson) cameraControl.focus(herdHomeX[e.sp],750,.4,28);
  else if (e.type === "fencePlaced") { G.burst(e.x,e.y,"dust"); AudioGarden.pop?.(); }
  else if (e.type === "scared") AudioGarden.wolfYelp?.();
  else if (e.type === "death") AudioGarden.soft?.();
});
bridge.sync(0, { initial: true });
farmLayer.sync(game.state, 0);
// Warm shader programs for materials that first appear later (ghost, grid).
const warm = new THREE.Group();
warm.position.y = -40;
warm.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: "#b9f0b0", emissive: "#2f6a2c", transparent: true, opacity: 0.6, depthWrite: false })));
const warmCells = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }), 1);
warmCells.setColorAt(0, new THREE.Color("#ffffff"));
warm.add(warmCells);
scene.add(warm);

renderer.info.autoReset = false;
const frames = [],
  renderTimes = [];
let last = 0,
  qualityClock = 0,
  frameCount = 0;
world.started = true;
world.nextNeed = 9;
if (params.get("needs") === "1" && world.chickens.length)
  world.needs = [
    { target: world.chickens[0], kind: "heart", born: -1 },
    { target: world.koiTarget, kind: "food", born: -1 },
  ];
resize();
cameraUpdate();
qualitySet(quality);
lighting();
// WebGL implementations without the optional parallel compiler can still
// compile normally; avoid Three's unsupported-extension console warning.
if (renderer.getContext().getExtension('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
else renderer.compile(scene, camera);
renderer.render(scene, camera);
scene.remove(warm);
function tick(now) {
  const raw = last ? (now - last) / 1000 : 0;
  last = now;
  const dt = game.paused ? 0 : Math.min(0.05, raw);
  if (!document.hidden) {
    const start = performance.now();
    renderer.info.reset();
    game.frame(raw);
    publishClock();
    bridge.sync(dt);
    G.update(dt);
    Farm.update(dt);
    bridge.constrain?.(dt);
    windTime.value = world.elapsed;
    lighting();
    if(!game.paused)cameraUpdate(dt);
    input.update(dt);
    largerWorld.update(dt,{night:currentNight,camera});
    cottage.update(dt,{cameraControl,night:currentNight});
    const coopDoor=game.state.coops?.base;
    if(coopDoor)coop.userData.setDoorOpen(coopDoor.doorOpen,coopDoor.doorProgress);
    waterFeedback.update(dt);
    wildlife.update(dt);
    tutorial.update(dt,game.clock);
    if(frameCount%6===0)cropInfo.update();
    AudioGarden.worldAmbience?.(currentNight,largerWorld.brook.distanceTo(camera.position.x,camera.position.z),cameraControl.isFirstPerson);
    farmLayer.sync(game.state, dt);
    animateObjects(dt);
    threats.update(dt,currentNight);
    particleUpdate();
    hud.update(game.state, game.clock);
    hud.setValid(farmLayer.ghostValid);
    if(frameCount % (quality === "low" ? 3 : 2) === 0) bubbleUi.update();
    if (shop.isOpen && frameCount % 8 === 0) shop.render();
    frameCount++;
    if (quality === "high") composer.render();
    else renderer.render(scene, camera);
    heldItem.render(dt);
    if (!window.Garden.ready) {
      window.Garden.ready = true;
      document.body.classList.add("ready");
    }
    renderTimes.push(performance.now() - start);
    if (renderTimes.length > 1200) renderTimes.shift();
    if (raw > 0) {
      frames.push(raw * 1000);
      if (frames.length > 1200) frames.shift();
      qualityClock += raw;
      if (
        quality === "high" &&
        qualityClock > 10 &&
        frames.slice(-120).reduce((a, b) => a + b, 0) /
          Math.min(120, frames.length) >
          34
      )
        qualitySet("low", true);
    }
  }
  requestAnimationFrame(tick);
}
// Verification hooks (no visible UI).
const anchorScreen = (kind, id) => {
  if (kind === "animal") {
    const agent = bridge.agentOf(id);
    if (!agent) return null;
    const h = agent.sp === "chicken" ? 0.3 : agent.sp === "cow" ? 0.7 : 0.85;
    const x = agent.sleeping && !agent.simMotion ? agent.home.x + (((agent.sleepSlot ?? 0) % 4) - 1.5) * 26 : agent.x,
      y = agent.sleeping && !agent.simMotion ? agent.home.y - 30 : agent.y;
    return screen(x, y, h * (agent.juvenile ? 0.7 : 1));
  }
  const a = farmLayer.anchorOf(kind, id, game.state);
  return a && screen(a.x, a.y, a.h);
};
window.Garden = {
  world,
  Farm,
  view,
  ready: false,
  screen,
  setHour,
  game,
  Sim,
  bridge,
  hud,
  shop,
  input,
  farmLayer,
  animals,
  cameraControl, camera, scene, renderer, largerWorld, threats, tutorial,
  state: () => game.state,
  clock: () => game.clock,
  advance(seconds, offline = false) {
    Sim.tick(game.state, seconds, { offline });
    game.pump();
  },
  pause, heldItem, cottage, playerGeometry, waterFeedback, wildlife,
  timescale: (n) => game.setTimescale(n),
  anchor: anchorScreen,
  save: () => game.persist.flush(game.state),
  persistStatus: () => ({ ...game.persist.status, leader: game.persist.leader, rev: game.state.rev, caughtUp: game.persist.caughtUp ?? 0 }),
  needs() {
    world.needs = [
      { target: world.chickens[0], kind: "heart", born: world.elapsed - 1 },
      { target: world.koiTarget, kind: "food", born: world.elapsed - 1 },
    ];
  },
  stats() {
    const sum = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    return {
      averageFrameMs: sum(frames),
      p95FrameMs: [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)],
      cpuRenderMs: sum(renderTimes.slice(-600)),
      samples: frames.length,
      quality,
      fallback,
      grassCount: grass.count,
      dpr: renderer.getPixelRatio(),
      drawCalls: renderer.info.render.calls,
      mergedMeshCount,
      triangles: renderer.info.render.triangles,
      lantern: lantern.intensity,
      animals: game.state.animals.length,
      beds: game.state.beds.length,
      buildings: game.state.buildings.length,
      world: largerWorld.stats, mode: cameraControl.isFirstPerson ? "fp" : "god",
      webgl: renderer.getContext().getParameter(renderer.getContext().VERSION),
    };
  },
  resetStats() {
    frames.length = 0;
    renderTimes.length = 0;
  },
  quality: (q) => qualitySet(q),
  forceFallback() {
    qualitySet("low", true);
  },
  projectTarget(a) {
    return screen(a.x, a.y, world.chickens.includes(a) ? 0.35 : 0.45);
  },
};
addEventListener("resize", resize);
requestAnimationFrame(tick);
