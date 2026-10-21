import * as THREE from "three";
import { CAMERA as C } from "../config/camera.js";
import { layout } from "../sim/index.js";

export const toWorld = (x, y) => ({ x: (x - 700) / 50, z: ((y - 650) * 1.65) / 50 });
export const toLogical = (x, z) => ({ x: x * 50 + 700, y: (z * 50) / 1.65 + 650 });
export const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
export const zoomDistance = (distance, delta) => THREE.MathUtils.clamp(distance * Math.exp(delta * C.zoomSpeed), C.minDistance, C.maxDistance);
const clamp = THREE.MathUtils.clamp;

// Static objects use their actual logical footprints. Paths are walkable.
export function blockedByFarm(state, x, z, radius = C.radius) {
  const p = toLogical(x, z), rx = radius * 50, ry = radius * 50 / 1.65;
  for (const o of layout.OBSTACLES) {
    if (o.kind === "path") continue;
    if (o.kind === "rect" && p.x > o.x0 - rx && p.x < o.x1 + rx && p.y > o.y0 - ry && p.y < o.y1 + ry) return true;
    if (o.kind === "circle" && Math.hypot((p.x - o.x) / 50, (p.y - o.y) * 1.65 / 50) < o.r / 50 + radius) return true;
    if (o.kind === "ellipse" && ((p.x - o.x) / (o.rx + rx)) ** 2 + ((p.y - o.y) / (o.ry + ry)) ** 2 < 1) return true;
  }
  for (const b of [...(state.buildings ?? []), ...(state.beds ?? []).map((b) => ({ ...b, type: "bed" }))]) {
    const [w, h] = layout.footprintOf(b.type), r = layout.cellRect(b.gx, b.gy, w, h);
    if (p.x > r.x0 - rx && p.x < r.x1 + rx && p.y > r.y0 - ry && p.y < r.y1 + ry) return true;
  }
  return false;
}

// Expanded segment bounds stop a capsule from clipping fence rails or corners.
export function blockedByFences(state, x, z, radius = C.radius) {
  const p = toLogical(x, z), rx = radius * 50, ry = radius * 50 / 1.65;
  for (const f of state.fences ?? []) {
    if (f.gate && f.open) continue;
    const x0 = f.gx * layout.CELL_X, y0 = f.gy * layout.CELL_Y;
    const x1 = x0 + (f.axis === "h" ? layout.CELL_X : 0), y1 = y0 + (f.axis === "v" ? layout.CELL_Y : 0);
    if (p.x > x0 - rx && p.x < x1 + rx && p.y > y0 - ry && p.y < y1 + ry) return true;
  }
  return false;
}

export function createCameraController({ camera, canvas, game, Farm, view, params = new URLSearchParams(), worldGeometry = {}, onModeChange = () => {}, isUIBlocked = () => false }) {
  const focus = new THREE.Vector3(0, 0, -0.5), focusTarget = focus.clone();
  let yaw = C.defaultYaw, pitch = C.defaultPitch, distance = C.defaultDistance;
  let targetYaw = yaw, targetPitch = pitch, targetDistance = distance;
  let orbitVelocity = { x: 0, y: 0 }, panVelocity = new THREE.Vector3();
  let mode = "god", transitioned = false, gestureConsumed = false, interactionHandler = () => {}, wheelHandler = () => {};
  const saved = game.state.player ?? {};
  const start = toWorld(Number.isFinite(saved.x) ? saved.x : 620, Number.isFinite(saved.y) ? saved.y : 700);
  const player = { x: start.x, z: start.z, y: 0, yaw: saved.yaw || 0, pitch: saved.pitch || 0, vx: 0, vz: 0, vy: 0, grounded: true };
  let lookYaw = player.yaw, lookPitch = player.pitch, stepPhase = 0, joystick = { x: 0, y: 0 };
  const keys = new Set(), pointers = new Map(), desiredPosition = new THREE.Vector3(), desiredQuat = new THREE.Quaternion();
  const lookEuler = new THREE.Euler(0, 0, 0, "YXZ"), raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), rayHit = new THREE.Vector3();
  let lastFarmPan = Farm?.targetPan ?? 0, zoomAnchor = null, lastPinch = null, transitionSeconds = 0;
  const listeners = [];
  const listen = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); };
  const blocked = () => isUIBlocked() || document.hidden;
  canvas.style.touchAction = "none";
  document.documentElement.style.overscrollBehavior = "none";
  document.body.style.overscrollBehavior = "none";

  function groundAt(clientX = innerWidth / 2, clientY = innerHeight / 2, elevation = 0) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera); plane.constant = -elevation;
    if (!raycaster.ray.intersectPlane(plane, rayHit)) return null;
    return rayHit.clone();
  }
  function resize() {
    camera.aspect = innerWidth / innerHeight; camera.fov = C.fov; camera.near = C.near; camera.far = C.far; camera.updateProjectionMatrix();
    if (view) { view.w = innerWidth; view.h = innerHeight; }
  }
  function persist() {
    const p = toLogical(player.x, player.z);
    game.state.player = { mode, x: p.x, y: p.y, yaw: player.yaw, pitch: player.pitch };
  }
  function releasePointer() { if (document.pointerLockElement === canvas) document.exitPointerLock?.(); keys.clear(); joystick = { x: 0, y: 0 }; }
  function setMode(next, { immediate = false } = {}) {
    next = next === "fp" ? "fp" : "god";
    if (mode === next && transitioned) return;
    const previousMode = mode; mode = next; transitioned = true; transitionSeconds = immediate ? 0 : 0.7;
    pointers.clear(); keys.clear(); gestureConsumed = false; lastPinch = null; orbitVelocity = { x: 0, y: 0 }; panVelocity.set(0, 0, 0);
    if (mode === "god") { releasePointer(); if (previousMode === "fp") focusTarget.set(player.x, terrain(player.x, player.z), player.z); }
    else if (collides(player.x, player.z)) recoverPlayer();
    document.body.classList.toggle("first-person", mode === "fp");
    controls.hidden = mode !== "fp"; persist(); onModeChange(mode);
    if (immediate) update(0.016, true);
  }
  function terrain(x, z) { return Number((worldGeometry.terrainHeight ?? worldGeometry.heightAt)?.(x, z)) || 0; }
  function collides(x, z) {
    if((game.state.animals??[]).some(a=>a.state==='alive'&&!a.indoors&&Math.hypot(x-(a.x-700)/50,z-(a.y-650)*1.65/50)<C.radius+((a.sp==='chicken'?.22:a.sp==='cow'?.55:.60)*(a.age<1?.65:1))))return true;
    return Math.abs(x) > C.bounds - C.radius || Math.abs(z) > C.bounds - C.radius || blockedByFarm(game.state, x, z) || blockedByFences(game.state, x, z) || !!(worldGeometry.blocked ?? worldGeometry.isBlocked)?.(x, z, C.radius);
  }
  function recoverPlayer() {
    for (let ring = 0; ring < 25; ring++) for (let i = 0; i < 24; i++) {
      const x = player.x + Math.cos(i / 24 * Math.PI * 2) * ring * 0.3, z = player.z + Math.sin(i / 24 * Math.PI * 2) * ring * 0.3;
      if (!collides(x, z)) { player.x = x; player.z = z; player.y = terrain(x, z); return; }
    }
    player.x = -0.8; player.z = 1.5; player.y = terrain(player.x, player.z);
  }
  function setPlayer(p) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) Object.assign(player, toWorld(p.x, p.y));
    if (Number.isFinite(p.yaw)) player.yaw = lookYaw = p.yaw;
    if (Number.isFinite(p.pitch)) player.pitch = lookPitch = clamp(p.pitch, -C.pitchLimit, C.pitchLimit);
    player.y = terrain(player.x, player.z); player.vy = 0; player.vx = 0; player.vz = 0; persist();
  }
  function jump() { if (mode === "fp" && player.grounded && !blocked()) { player.vy = C.jumpSpeed; player.grounded = false; } }
  function pan(dx, dy) {
    const scale = 2 * targetDistance * Math.tan(THREE.MathUtils.degToRad(C.fov / 2)) / innerHeight;
    const sy = Math.max(0.24, Math.sin(pitch));
    const wx = -dx * Math.cos(yaw) * scale - dy * Math.sin(yaw) * scale / sy;
    const wz = dx * Math.sin(yaw) * scale - dy * Math.cos(yaw) * scale / sy;
    focusTarget.x += wx; focusTarget.z += wz; panVelocity.set(wx * 30, 0, wz * 30);
  }
  function zoom(delta, x, y) { if (!zoomAnchor) zoomAnchor = { world: groundAt(x, y), x, y }; targetDistance = zoomDistance(targetDistance, delta); }
  function pointerDown(e) {
    if (blocked()) return;
    gestureConsumed = false;
    if (mode === "fp") {
      if (e.pointerType !== "touch") {
        if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {});
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, kind: "look" });
      canvas.setPointerCapture?.(e.pointerId); return;
    }
    const kind = e.pointerType === "touch" || e.button === 2 || e.shiftKey || e.altKey || e.metaKey ? "pan" : "orbit";
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, kind, moved: false, touch: e.pointerType === "touch" });
    if (pointers.size > 1) { gestureConsumed = true; lastPinch = null; }
    canvas.setPointerCapture?.(e.pointerId);
  }
  function pointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (mode === "fp") {
      if (blocked()) return;
      if (e.pointerType !== "touch") return;
      if (p) { lookYaw -= (e.clientX - p.x) * C.lookSpeed * 1.5; lookPitch = clamp(lookPitch - (e.clientY - p.y) * C.lookSpeed * 1.5, -C.pitchLimit, C.pitchLimit); p.x = e.clientX; p.y = e.clientY; gestureConsumed ||= Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > C.touchDragThreshold; }
      return;
    }
    if (!p || blocked() || e.defaultPrevented) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    p.moved ||= Math.hypot(p.x - p.sx, p.y - p.sy) > (p.touch ? C.touchDragThreshold : C.dragThreshold);
    if (pointers.size > 1) {
      const a = [...pointers.values()], center = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }, span = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (lastPinch) { zoom(-Math.log(span / Math.max(1, lastPinch.span)) / C.zoomSpeed, center.x, center.y); targetYaw -= (center.x - lastPinch.x) * C.orbitSpeed; targetPitch = clamp(targetPitch + (center.y - lastPinch.y) * C.orbitSpeed, C.minPitch, C.maxPitch); }
      lastPinch = { ...center, span }; gestureConsumed = true; return;
    }
    if (!p.moved) return;
    gestureConsumed = true;
    if (p.kind === "pan") pan(dx, dy);
    else { targetYaw -= dx * C.orbitSpeed; targetPitch = clamp(targetPitch + dy * C.orbitSpeed, C.minPitch, C.maxPitch); orbitVelocity = { x: -dx * C.orbitSpeed * 30, y: dy * C.orbitSpeed * 30 }; }
  }
  function pointerUp(e) { pointers.delete(e.pointerId); lastPinch = null; }
  listen(canvas, "pointerdown", pointerDown);
  listen(canvas, "pointermove", pointerMove);
  listen(canvas, "pointerup", pointerUp);
  listen(document, "mousemove", (e) => {
    if (mode !== "fp" || blocked() || document.pointerLockElement !== canvas) return;
    lookYaw -= (e.movementX || 0) * C.lookSpeed;
    lookPitch = clamp(lookPitch - (e.movementY || 0) * C.lookSpeed, -C.pitchLimit, C.pitchLimit);
  });
  listen(canvas, "pointercancel", pointerUp);
  listen(canvas, "contextmenu", (e) => e.preventDefault());
  listen(canvas, "wheel", (e) => {
    e.preventDefault();
    if (blocked()) return;
    if (mode === "fp") { wheelHandler(Math.sign(e.deltaY || e.deltaX)); return; }
    const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.45 && !e.ctrlKey) pan(e.deltaX * factor, e.shiftKey ? e.deltaY * factor : 0);
    else zoom(e.deltaY * factor * (e.ctrlKey ? 1.5 : 1), e.clientX, e.clientY);
  }, { passive: false });
  // Consume browser navigation/zoom gestures even while UI panels are open.
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) listen(document, type, (e) => e.preventDefault(), { passive: false });
  listen(document, "touchmove", (e) => { if (e.target === canvas || e.touches.length > 1) e.preventDefault(); }, { passive: false });
  listen(document, "wheel", (e) => { if (e.ctrlKey || e.target === canvas) e.preventDefault(); }, { passive: false });
  listen(canvas, "dblclick", (e) => e.preventDefault());
  listen(window, "keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"].includes(e.code)) {
      e.preventDefault(); e.stopImmediatePropagation(); if (blocked()) return; keys.add(e.code); if (e.code === "Space" && !e.repeat) jump();
    }
  }, true);
  listen(window, "keyup", (e) => { keys.delete(e.code); if (Farm) Farm.held = 0; }, true);
  listen(window, "blur", releasePointer);
  listen(document, "visibilitychange", () => { if (document.hidden) releasePointer(); });
  listen(document, "pointerlockchange", () => { if (document.pointerLockElement !== canvas) { keys.clear(); joystick = { x: 0, y: 0 }; } });
  listen(window, "resize", resize);

  // Thumb controls are isolated from canvas interactions and never capture look.
  const controls = document.createElement("div"); controls.className = "fp-touch-controls"; controls.hidden = true;
  controls.innerHTML = '<div id="fp-joystick" aria-label="Move"><span></span></div><button id="fp-jump" aria-label="Jump">↥</button><button id="fp-interact" aria-label="Interact">◎</button>';
  document.body.append(controls);
  const stick = controls.querySelector("#fp-joystick"), knob = stick.querySelector("span");
  const moveStick = (e) => { const r = stick.getBoundingClientRect(); joystick.x = clamp((e.clientX - r.left - r.width / 2) / (r.width * 0.34), -1, 1); joystick.y = clamp((e.clientY - r.top - r.height / 2) / (r.height * 0.34), -1, 1); knob.style.transform = `translate(${joystick.x * 26}px,${joystick.y * 26}px)`; };
  listen(stick, "pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); stick.setPointerCapture(e.pointerId); moveStick(e); });
  listen(stick, "pointermove", (e) => { if (stick.hasPointerCapture(e.pointerId)) { e.preventDefault(); moveStick(e); } });
  for (const type of ["pointerup", "pointercancel"]) listen(stick, type, (e) => { e.stopPropagation(); joystick = { x: 0, y: 0 }; knob.style.transform = ""; });
  listen(controls.querySelector("#fp-jump"), "pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); jump(); });
  listen(controls.querySelector("#fp-interact"), "pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); interactionHandler(); });

  function update(dt = 1 / 60, immediate = false) {
    dt = clamp(dt, 0, 0.05);
    if (mode === "fp") {
      if (blocked()) { keys.clear(); joystick = { x: 0, y: 0 }; }
      player.yaw = damp(player.yaw, lookYaw, 22, dt); player.pitch = damp(player.pitch, lookPitch, 22, dt);
      const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown")) - joystick.y;
      const strafe = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft")) + joystick.x;
      const len = Math.max(1, Math.hypot(forward, strafe)), speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? C.sprintSpeed : C.walkSpeed;
      const vx = (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) / len * speed;
      const vz = (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * strafe) / len * speed;
      player.vx = damp(player.vx, vx, C.acceleration, dt); player.vz = damp(player.vz, vz, C.acceleration, dt);
      const steps = Math.max(1, Math.ceil(Math.hypot(player.vx, player.vz) * dt / C.collisionStep));
      for (let i = 0; i < steps; i++) {
        const dx = player.vx * dt / steps, dz = player.vz * dt / steps;
        const valid = (x, z) => !collides(x, z) && terrain(x, z) - terrain(player.x, player.z) <= C.maxSlopeStep;
        if (valid(player.x + dx, player.z)) player.x += dx; else player.vx = 0;
        if (valid(player.x, player.z + dz)) player.z += dz; else player.vz = 0;
      }
      player.vy -= C.gravity * dt; player.y += player.vy * dt;
      const floor = terrain(player.x, player.z);
      if (player.y <= floor) { player.y = floor; player.vy = 0; player.grounded = true; } else player.grounded = false;
      const moving = Math.min(1, Math.hypot(player.vx, player.vz) / C.walkSpeed);
      stepPhase += dt * moving * 10;
      desiredPosition.set(player.x, player.y + C.eyeHeight + (player.grounded ? Math.sin(stepPhase) * C.headBob * moving : 0), player.z);
      lookEuler.set(player.pitch, player.yaw, 0); desiredQuat.setFromEuler(lookEuler);
    } else {
      if (Farm && Farm.targetPan !== lastFarmPan) { focusTarget.x = Farm.targetPan / 50; lastFarmPan = Farm.targetPan; }
      const f = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
      const s = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
      if (!blocked()) { focusTarget.x += (Math.cos(yaw) * s - Math.sin(yaw) * f) * targetDistance * C.godKeySpeed * dt; focusTarget.z += (-Math.sin(yaw) * s - Math.cos(yaw) * f) * targetDistance * C.godKeySpeed * dt; }
      if (!pointers.size) { targetYaw += orbitVelocity.x * dt; targetPitch = clamp(targetPitch + orbitVelocity.y * dt, C.minPitch, C.maxPitch); focusTarget.addScaledVector(panVelocity, dt); }
      orbitVelocity.x *= Math.exp(-C.inertia * dt); orbitVelocity.y *= Math.exp(-C.inertia * dt); panVelocity.multiplyScalar(Math.exp(-C.inertia * dt));
      const edge = C.bounds - Math.min(C.softEdge, targetDistance * 0.08);
      focusTarget.x = clamp(focusTarget.x, -edge, edge); focusTarget.z = clamp(focusTarget.z, -edge, edge); focusTarget.y = terrain(focusTarget.x, focusTarget.z);
      yaw = damp(yaw, targetYaw, C.damping, dt); pitch = damp(pitch, targetPitch, C.damping, dt); distance = damp(distance, targetDistance, C.damping, dt); focus.lerp(focusTarget, 1 - Math.exp(-C.damping * dt));
      desiredPosition.copy(focus).add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance));
      desiredPosition.y = Math.max(desiredPosition.y, terrain(desiredPosition.x, desiredPosition.z) + 0.35);
      const matrix = new THREE.Matrix4().lookAt(desiredPosition, focus, camera.up); desiredQuat.setFromRotationMatrix(matrix);
      if (view) view.scale = innerHeight / (2 * distance * Math.tan(THREE.MathUtils.degToRad(C.fov / 2)) * 50);
    }
    const ease = immediate || transitionSeconds <= 0 ? 1 : 1 - Math.exp(-C.transitionRate * dt);
    camera.position.lerp(desiredPosition, ease); camera.quaternion.slerp(desiredQuat, ease); transitionSeconds = Math.max(0, transitionSeconds - dt);
    camera.near = mode === "fp" ? C.near : Math.max(C.near, Math.min(0.3, distance * 0.003)); camera.far = C.far; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    if (mode === "god" && zoomAnchor?.world) {
      const after = groundAt(zoomAnchor.x, zoomAnchor.y);
      if (after) { const correction = zoomAnchor.world.clone().sub(after); correction.y=0; focusTarget.add(correction); focus.add(correction); camera.position.add(correction); camera.updateMatrixWorld(); }
      if (Math.abs(distance - targetDistance) < 0.02) zoomAnchor = null;
    }
    persist();
  }
  function focusAt(x, y, height = 0, nextDistance = 12) {
    if (mode === "fp") setMode("god");
    const p = toWorld(x, y); focusTarget.set(p.x, height, p.z); targetDistance = clamp(nextDistance, C.minDistance, C.maxDistance); panVelocity.set(0, 0, 0); orbitVelocity = { x: 0, y: 0 };
  }
  const close = params.get("close"), preset = params.get("cam");
  if (close === "house") focusAt(630, 440, 1, 14);
  else if (close === "pond") focusAt(999, 626, 0.1, 10);
  else if (preset === "brook") focusAt(3000, 650 + 400 / 1.65, 0.2, 11);
  else if (close === "chickens" || preset === "chickens") focusAt(620, 760, 0.2, 6);
  else if (/^-?\d+,-?\d+$/.test(close ?? "")) focusAt(...close.split(",").map(Number), 0.2, 8);
  if (preset === "close") { targetDistance = C.minDistance; focusTarget.set(-1.6, 0, 2.8); }
  if (preset === "wide") targetDistance = 130;
  if (preset === "forest") { focusTarget.set(43, 0, -28); targetDistance = 24; }
  distance = targetDistance; focus.copy(focusTarget);
  if (game.on) listeners.push(game.on((event) => {
    if (event.type !== "replace") return;
    const replacement = { ...game.state.player };
    setPlayer(replacement); setMode(replacement.mode ?? "god");
  }));
  resize(); setMode(params.get("mode") ?? saved.mode ?? "god", { immediate: true });
  return {
    update, resize, setMode, toggle: () => setMode(mode === "fp" ? "god" : "fp"), focus: focusAt, setPlayer, jump, releasePointer, groundAt,
    setWorldGeometry: (value) => { worldGeometry = value ?? {}; },
    reserveGesture: (pointerId) => { pointers.delete(pointerId); gestureConsumed = false; },
    setHandlers: ({ interact, wheel } = {}) => { if (interact) interactionHandler = interact; if (wheel) wheelHandler = wheel; },
    snapshot: () => ({ mode, position: camera.position.toArray(), focus: focus.toArray(), focusTarget: focusTarget.toArray(), yaw, pitch, distance, targetDistance, targetYaw, targetPitch, velocity: { ...orbitVelocity }, player: { ...game.state.player }, grounded: player.grounded, locked: document.pointerLockElement === canvas }),
    get isFirstPerson() { return mode === "fp"; }, get mode() { return mode; }, get player() { return player; }, get gestureConsumed() { return gestureConsumed; },
    destroy() { releasePointer(); listeners.forEach((off) => off()); controls.remove(); },
  };
}
