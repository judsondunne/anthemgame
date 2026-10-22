"use strict";
const canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d");
let view = { scale: 1, x: 0, y: 0, w: 0, h: 0 },
  last = 0,
  frames = [],
  grassStride = 1;
function resize() {
  let dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  view.w = innerWidth;
  view.h = innerHeight;
  view.dpr = dpr;
  view.scale = Math.min(innerWidth / 1750, innerHeight / 1050);
  view.x = (innerWidth - W * view.scale) / 2;
  view.y = (innerHeight - H * view.scale) / 2;
  if (innerWidth / innerHeight < 1.1) {
    view.scale = Math.min(
      innerWidth / 1680,
      innerHeight / 1120,
    );
    view.x = (innerWidth - W * view.scale) / 2;
    view.y = (innerHeight - H * view.scale) / 2;
  }
  if (innerWidth / innerHeight > 1.9) {
    view.scale = innerHeight / 1000;
    view.x = (innerWidth - W * view.scale) / 2;
    view.y = -36;
  }
  view.x -= Farm.pan * view.scale;
  render();
}
function blit(s, x, y, scale = 1) {
  const anchor = s.anchor ?? { x: s.w / 2, y: s.h };
  ctx.drawImage(
    s.canvas,
    x - anchor.x * scale,
    y - anchor.y * scale,
    s.w * scale,
    s.h * scale,
  );
}
function drawCoop(e, t) {
  blit(S.coop, e.x, e.y, e.scale);
  const residents = world.chickens.filter(
    (b) => (b.coopId==null)&&(b.sleeping || (b.mode === "waking" && b.wakeDelay > 0)),
  );
  if (!residents.length) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.scale, e.scale);
  const points = S.coop.opening.map((p) => [p.x, p.y]);
  polygonClip(ctx, points, () => {
    for (const b of residents) {
      const i = b.sleepSlot,
        row = i < 4 ? 0 : 1,
        x = row === 0 ? -49 + i * 33 : -34 + (i - 4) * 34,
        p = project3(x, 0, row === 0 ? 21 : 47),
        s = S.sleeping[b.breed];
      const breath = 1 + Math.sin(t * 1.7 + b.phase) * 0.018;
      ctx.drawImage(s.canvas, p.x - 12, p.y - 20 * breath, 24, 20 * breath);
    }
  });
  ctx.restore();
}
function drawCoopDreams(t) {
  const co = world.coop;
  ctx.save();
  ctx.translate(co.x, co.y);
  ctx.scale(co.scale, co.scale);
  polygonClip(
    ctx,
    S.coop.opening.map((p) => [p.x, p.y]),
    () => {
      for (const b of world.chickens.filter(
        (b) => b.sleeping && b.sleepSlot % 2 === 0,
      )) {
        const i = b.sleepSlot,
          row = i < 4 ? 0 : 1,
          x = row === 0 ? -49 + i * 33 : -34 + (i - 4) * 34,
          p = project3(x, 0, row === 0 ? 21 : 47);
        ctx.fillStyle = "#eddfb9";
        ctx.globalAlpha = 0.8;
        ctx.font = "500 11px -apple-system, sans-serif";
        ctx.fillText("Z", p.x + 7, p.y - 15 - Math.sin(t * 0.9 + i) * 2);
      }
    },
  );
  ctx.restore();
}
function shadow(x, y, w, h, night) {
  const u = Math.max(0, Math.min(1, (world.time - 0.06) / 0.61)),
    sunX = 170 + u * 1050;
  ctx.save();
  ctx.translate(x + ((700 - sunX) / 700) * w * 0.25, y + 2);
  ctx.scale(w, h);
  let g = ctx.createRadialGradient(0, 0, 0.06, 0, 0, 1);
  g.addColorStop(0, `rgba(48,73,58,${night ? 0.14 : 0.22})`);
  g.addColorStop(0.4, `rgba(48,73,58,${night ? 0.1 : 0.14})`);
  g.addColorStop(1, "#30493a00");
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}
const ground = sprite(
  W,
  H,
  (c) => {
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#b9c49b");
    g.addColorStop(0.3, "#a6b580");
    g.addColorStop(1, "#8da674");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 7000; i++) {
      let x = rand() * W,
        y = 220 + rand() * H;
      ellipse(
        c,
        x,
        y,
        1 + rand() * 6,
        0.4 + rand() * 2,
        ["#e4dcab19", "#647d4c18", "#eff0b018"][i % 3],
      );
    }
    // A meandering path.
    c.lineCap = "round";
    c.strokeStyle = "#d0c49f";
    c.lineWidth = 65;
    c.beginPath();
    c.moveTo(621, 498);
    c.bezierCurveTo(580, 530, 550, 620, 590, 690);
    c.bezierCurveTo(625, 780, 697, 909, 660, 960);
    c.stroke();
    c.strokeStyle = "#ded0ac";
    c.lineWidth = 48;
    c.stroke();
    for (let i = 0; i < 1400; i++) {
      let y = 460 + rand() * 500,
        x = 635 + Math.sin(y * 0.016) * 35 + (rand() - 0.5) * 50;
      ellipse(c, x, y, rand() * 2, 0.6, "#a99d792c");
    }
  },
  false,
);
// Feather the lawn cache into the full-bleed terrain without stretching noise pixels.
{
  const c = ground.canvas.getContext("2d");
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "destination-in";
  let g = c.createLinearGradient(0, 0, ground.canvas.width, 0);
  g.addColorStop(0, "#00000000");
  g.addColorStop(0.045, "#000000");
  g.addColorStop(0.955, "#000000");
  g.addColorStop(1, "#00000000");
  c.fillStyle = g;
  c.fillRect(0, 0, ground.canvas.width, ground.canvas.height);
  c.restore();
}
const pond = sprite(405, 235, (c) => {
  c.save();
  c.translate(200, 120);
  let g = c.createRadialGradient(-50, -30, 5, 0, 0, 180);
  g.addColorStop(0, "#91b4a1");
  g.addColorStop(0.55, "#6c9e92");
  g.addColorStop(1, "#477d79");
  c.beginPath();
  c.moveTo(-165, 0);
  c.bezierCurveTo(-200, -55, -100, -101, -33, -83);
  c.bezierCurveTo(28, -109, 154, -73, 171, -19);
  c.bezierCurveTo(206, 31, 99, 89, 28, 82);
  c.bezierCurveTo(-50, 108, -171, 58, -165, 0);
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 8;
  c.strokeStyle = "#78977c";
  c.stroke();
  c.restore();
  for (let i = 0; i < 44; i++) {
    let a = (i / 44) * Math.PI * 2,
      x = 200 + Math.cos(a) * (166 + Math.sin(a * 3) * 9),
      y = 120 + Math.sin(a) * (83 + Math.cos(a * 4) * 6);
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(a * 3) * 0.14);
    const s = S.stones[i % 6],
      scale = 0.6 + Math.sin(i * 2.3) * 0.08;
    c.drawImage(
      s.canvas,
      (-s.w * scale) / 2,
      (-s.h * scale) / 2,
      s.w * scale,
      s.h * scale,
    );
    c.restore();
  }
});
function heart(x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.bezierCurveTo(-12, -4, -7, -12, 0, -6);
  ctx.bezierCurveTo(7, -12, 12, -4, 0, 3);
  ctx.fill();
  ctx.restore();
}
function icon(kind, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (kind === "heart") heart(0, 2, 1, "#c88f8b");
  else if (kind === "water") {
    ctx.fillStyle = "#82aeb1";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(-3, -5, -10, 3, -5, 7);
    ctx.bezierCurveTo(3, 14, 13, 5, 0, -10);
    ctx.fill();
    line(ctx, -3, 3, -2, 6, "#d4e3d8", 2);
  } else {
    for (let i = 0; i < 5; i++) {
      let a = i * 1.6;
      ellipse(ctx, Math.cos(a) * 5, Math.sin(a) * 6, 2.4, 4, "#c5a268");
    }
    line(ctx, -6, 8, 6, -8, "#a08b55", 1);
  }
  ctx.restore();
}
function glow(x, y, r, color) {
  let g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "#f9c77900");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawPond(t) {
  blit(pond, 999, 744, 1);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(999, 626, 153, 72, 0, 0, 7);
  ctx.clip();
  for (let k of world.koi) {
    let x = k.x,
      y = k.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(k.angle);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = k.color;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.bezierCurveTo(10, -8, -10, -5, -18, Math.sin(t * 3 + k.phase) * 5);
    ctx.bezierCurveTo(-9, 4, 11, 8, 18, 0);
    ctx.fill();
    path(
      ctx,
      [
        [-16, 0],
        [-26, Math.sin(t * 3 + k.phase) * 6 - 5],
        [-24, Math.sin(t * 3 + k.phase) * 6 + 5],
      ],
      k.color,
    );
    ellipse(ctx, 5, 0, 4, 3, "#ad6c4c");
    ellipse(ctx, 13, -2, 1, 1, "#455d52");
    ctx.restore();
  }
  for (let i = 0; i < 11; i++) {
    let x = 901 + i * 19 + Math.sin(t * 0.6 + i) * 8,
      y = 593 + (i % 4) * 16;
    ctx.strokeStyle = "#d5e0bd30";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + Math.sin(t + i) * 5, 2, 0, 0, Math.PI);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    let r = (t * 5 + i * 24) % 75;
    ctx.strokeStyle = `rgba(222,230,199,${(1 - r / 75) * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(990 + i * 18, 634 - i * 11, r, r * 0.35, 0, 0, 7);
    ctx.stroke();
  }
  ctx.restore();
  for (let p of [
    [910, 617, 14],
    [1066, 656, 13],
    [1043, 581, 10],
    [928, 655, 11],
  ]) {
    ellipse(ctx, p[0], p[1], p[2], p[2] * 0.5, "#7b9d75");
    line(ctx, p[0], p[1], p[0] + p[2], p[1] - 3, "#a6b58a", 1);
  }
  for (let p of [
    [1065, 651],
    [928, 650],
  ]) {
    for (let j = 0; j < 7; j++) {
      ctx.save();
      ctx.translate(...p);
      ctx.rotate(j * 0.9);
      ellipse(ctx, 0, -3, 3, 7, "#e9c4b6");
      ctx.restore();
    }
    ellipse(ctx, p[0], p[1], 3, 2, "#d2b371");
  }
}
function render() {
  if (!canvas.width) return;
  let t = world.elapsed,
    d = world.time;
  let night = Math.max(0, Math.min(1, (Math.abs(d - 0.32) - 0.29) * 5)),
    sunset = Math.exp(-(((d - 0.59) / 0.08) ** 2));
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  let sky = ctx.createLinearGradient(0, 0, 0, view.h);
  sky.addColorStop(
    0,
    night > 0.5 ? "#536876" : sunset > 0.3 ? "#d8b39b" : "#d9ddc9",
  );
  sky.addColorStop(0.5, "#b4c194");
  sky.addColorStop(1, "#8da674");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);
  ctx.fillStyle = "#d9ddc9";
  ctx.fillRect(-3000, -2000, 9000, 2000);
  let lawn = ctx.createLinearGradient(0, 0, 0, H);
  lawn.addColorStop(0, "#b9c49b");
  lawn.addColorStop(0.3, "#a6b580");
  lawn.addColorStop(1, "#8da674");
  ctx.fillStyle = lawn;
  ctx.fillRect(-3000, 0, 9000, H);
  ctx.fillStyle = "#8da674";
  ctx.fillRect(-3000, H, 9000, 2000);
  ctx.drawImage(ground.canvas, 0, 0, W, H);
  // Continue the meadow and garden path into tall portrait viewports.
  if (view.h / view.scale > H) {
    ctx.lineCap = "round";
    ctx.strokeStyle = "#d0c49f";
    ctx.lineWidth = 65;
    ctx.beginPath();
    ctx.moveTo(660, 960);
    ctx.bezierCurveTo(610, 1030, 730, 1300, 700, 1800);
    ctx.stroke();
    ctx.strokeStyle = "#ded0ac";
    ctx.lineWidth = 48;
    ctx.stroke();
    for (let i = 0; i < 160; i++) {
      let x = (i * 83) % 1400,
        y = 970 + ((i * 37) % 800);
      blit(S.tuft, x, y, 0.5);
    }
  }
  drawLandscape(t, d, night, sunset);
  Farm.draw(t,night);
  if(window.ClassicFarm)window.ClassicFarm.drawGround(ctx);
  else {blit(S.bed,355,637,1);blit(S.bed,710,637,1);}
  // Drifting broad shadows make the lawn feel alive.
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(((t * 4 + i * 550) % (W + 600)) - 300, 400 + i * 120);
    ctx.rotate(-0.3);
    ellipse(ctx, 0, 0, 180, 45, "#566e5810");
    ctx.restore();
  }
  drawPond(t);
  for (const r of world.ripples) {
    ctx.strokeStyle = `rgba(226,234,207,${r.life * 0.15})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(
        r.x,
        r.y,
        (3 - r.life) * 18 + i * 12,
        ((3 - r.life) * 18 + i * 12) * 0.4,
        0,
        0,
        7,
      );
      ctx.stroke();
    }
  }
  for (const w of world.watering) {
    ellipse(ctx, w.x, w.y - 3, 20, 7, `rgba(81,115,94,${w.life * 0.055})`);
    ctx.save();
    ctx.globalAlpha = Math.min(1, w.life);
    for (let i = 0; i < 9; i++) {
      let phase = (t * 1.3 + i * 0.11) % 1;
      ellipse(ctx, w.x - 18 + i * 4, w.y - 60 + phase * 52, 1, 2.8, "#c0d8d3");
    }
    ctx.restore();
  }
  for (const f of world.food) ellipse(ctx, f.x, f.y, 1.8, 1.1, "#d8bf84");
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(999, 626, 149, 69, 0, 0, 7);
  ctx.clip();
  for (const f of world.fishFood) ellipse(ctx, f.x, f.y, 1.5, 1, "#d8bf84");
  ctx.restore();
  ctx.globalAlpha = 0.47;
  for (let i = 0; i < world.tufts.length; i += grassStride) {
    let g = world.tufts[i],
      sway =
        Math.sin(t * 1.25 + g.x * 0.008 + g.y * 0.005) * 0.12 +
        Math.sin(t * 2.8 + g.p) * 0.025;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.transform(1, 0, sway, 1, 0, 0);
    blit(S.tuft, 0, 0, g.s);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  let entities = [
    ...world.scenery,
    ...(window.ClassicFarm?.renderables()??[]),
    ...world.plants.map((p) => ({
      ...p,
      type: "plant",
      scale: 0.75 * p.growth,
    })),
    ...world.chickens
      .filter((b) => !b.sleeping && !(b.mode === "waking" && b.wakeDelay > 0))
      .map((b) => ({ ...b, type: "chicken", scale: 1 })),
  ].sort((a, b) => a.y - b.y);
  for (let e of entities) {
    if(e.type==="classic"){e.draw(ctx,t);continue;}
    if (e.type === "coop") {
      shadow(e.x + 10, e.y - 5, 85 * e.scale, 24 * e.scale, night);
      drawCoop(e, t);
      window.ClassicFarm?.drawDoor(ctx,e.x,e.y,e.scale);
      continue;
    }
    if (e.type === "chicken") {
      let b = e,
        bob =
          Math.sin(t * (b.mode === "returning" ? 14 : 8) + b.phase) *
          (b.path.length ? 1.8 : 0.3);
      shadow(b.x, b.y, 20, 6, night);
      if (b.mode === "napping") {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(b.dir * (1 + Math.sin(t * 1.8 + b.phase) * .012), 1 + Math.sin(t * 1.8 + b.phase) * .015);
        blit(S.sleeping[b.breed], 0, 0, 1);
        ctx.restore();
        ctx.save();
        ctx.font = "italic 13px Georgia";
        ctx.fillStyle = "#63765c";
        for (let z = 0; z < 2; z++) {
          const u = (t * .28 + z * .5) % 1;
          ctx.globalAlpha = Math.sin(u * Math.PI) * .7;
          ctx.fillText("z", b.x + 12 + u * 10, b.y - 39 - u * 24);
        }
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      let entry = 0;
      if (b.mode === "returning" && b.homeStage === "enter")
        entry =
          1 -
          Math.min(
            1,
            Math.hypot(b.x - world.coop.door.x, b.y - world.coop.door.y) / 20,
          );
      if (b.mode === "exiting")
        entry =
          1 -
          Math.min(
            1,
            Math.hypot(b.x - world.coop.door.x, b.y - world.coop.door.y) / 20,
          );
      ctx.globalAlpha = 1 - entry * 0.7;
      if(window.ClassicFarm){const size=.5+Math.min(1,b.age??1)*.5;ctx.scale(size,size);}
      ctx.scale(1 - entry * 0.25, 1 - entry * 0.2);
      ctx.scale(
        b.dir * (1 + Math.sin(b.pet * 12) * 0.06),
        1 - Math.sin(b.pet * 12) * 0.06,
      );
      let peck =
        !b.path.length &&
        (b.mode === "drinking" || Math.sin(t * (b.mode === "feeding" ? 3 : 1.3) + b.phase) > 0.5);
      ctx.rotate(peck ? 0.18 : 0);
      blit(S.chickens[b.breed], 0, bob, 1);
      ctx.restore();
      if (b.pet > 0) heart(b.x, b.y - 65 + Math.sin(t * 3) * 3, 0.6, "#d9a39b");
      continue;
    }
    let s =
      e.type === "plant"
        ? S.flowers[e.kind]
        : e.type === "flowers"
          ? S.flowers[Math.floor(e.x) % 4]
          : S[e.type];
    if (!s) continue;
    if (e.type === "house") {
      const points = S.house.footprint.map((p) => [
        e.x + p.x * e.scale,
        e.y + p.y * e.scale,
      ]);
      ctx.save();
      ctx.shadowColor = "#3f5e4a35";
      ctx.shadowBlur = 15;
      path(ctx, points, "#46634e0f");
      ctx.restore();
    } else if (e.type === "fence") {
      for (let x = -110; x <= 110; x += 22) {
        const p = project3(x, 0, 0);
        shadow(
          e.x + p.x * e.scale,
          e.y + p.y * e.scale,
          7 * e.scale,
          3 * e.scale,
          night,
        );
      }
    } else
      shadow(
        e.x,
        e.y,
        s.w * e.scale * (e.type === "tree" ? 0.12 : 0.28),
        s.w * e.scale * (e.type === "tree" ? 0.035 : 0.045),
        night,
      );
    ctx.save();
    ctx.translate(e.x, e.y);
    if (
      e.type === "tree" ||
      e.type === "plant" ||
      e.type === "flowers" ||
      e.type === "bush"
    )
      ctx.transform(1, 0, Math.sin(t * 1.1 + e.x * 0.01) * 0.012, 1, 0, 0);
    blit(s, 0, 0, e.scale);
    ctx.restore();
  }
  if(window.ClassicFarm)window.ClassicFarm.drawObjects(ctx,t);else Farm.drawSmall(t);
  // The path starts at the actual projected bottom stair, not the sprite's bounding box.
  for (const p of [
    [621, 508],
    [603, 527],
    [586, 549],
    [577, 574],
    [575, 599],
  ]) {
    ellipse(ctx, p[0], p[1] + 1, 9, 3, "#778c6725");
    ellipse(ctx, p[0], p[1] - 1, 8, 3, "#c9c4a6");
  }
  const cottage = world.scenery.find((e) => e.type === "house"),
    chimney = S.house.chimney;
  for (let i = 0; i < 7; i++) {
    let a = (t * 0.15 + i / 7) % 1;
    ellipse(
      ctx,
      cottage.x +
        chimney.x * cottage.scale +
        Math.sin(t * 0.3 + a * 5) * 10 +
        a * 16,
      cottage.y + chimney.y * cottage.scale - a * 55,
      4 + a * 12,
      6 + a * 10,
      `rgba(235,229,207,${(1 - a) * 0.1})`,
    );
  }
  // Ambient grade derives from the same clock as the sun.
  if (sunset > 0.01) {
    ctx.fillStyle = `rgba(228,153,108,${sunset * 0.1})`;
    ctx.fillRect(-4000, -3000, 12000, 8000);
  }
  if (night > 0) {
    ctx.fillStyle = `rgba(39,58,87,${night * 0.43})`;
    ctx.fillRect(-4000, -3000, 12000, 8000);
    ctx.fillStyle = `rgba(99,111,136,${night * 0.04})`;
    ctx.fillRect(-4000, -3000, 12000, 8000);
    ctx.save();
    ctx.globalAlpha = night;
    ctx.globalCompositeOperation = "screen";
    const h = world.scenery.find((e) => e.type === "house"),
      hx = h.x - S.house.anchor.x * h.scale,
      hy = h.y - S.house.anchor.y * h.scale;
    ctx.drawImage(
      S.houseNight.canvas,
      hx,
      hy,
      S.house.w * h.scale,
      S.house.h * h.scale,
    );
    const lx = h.x + S.house.lantern.x * h.scale,
      ly = h.y + S.house.lantern.y * h.scale;
    glow(lx, ly, 25, "#f8cf8355");
    glow(lx, ly + 24, 67, "#f4c57c2a");
    ellipse(ctx, lx, ly, 2.2, 4, "#f2d28d");
    const co = world.coop,
      p = project3(0, 0, 40);
    glow(co.x + p.x, co.y + p.y, 60, "#f3c77545");
    ctx.restore();
    for (let i = 0; i < 26; i++) {
      let x = 220 + ((i * 83) % 950) + Math.sin(t * 0.3 + i) * 19,
        y = 450 + ((i * 67) % 350) + Math.sin(t * 0.7 + i) * 12,
        alpha = night * Math.max(0, Math.sin(t * 1.3 + i));
      ctx.globalAlpha = alpha;
      glow(x, y, 9, "#e8dc8155");
      ellipse(ctx, x, y, 1.3, 1.3, "#e6df9a");
      ctx.globalAlpha = 1;
    }
  }
  drawCoopDreams(t);
  // Butterflies and falling petals.
  for (let i = 0; i < 7; i++) {
    let x = 300 + ((i * 137) % 800) + Math.sin(t * 0.24 + i) * 35,
      y = 460 + ((i * 61) % 330) + Math.cos(t * 0.36 + i) * 18;
    let f = Math.abs(Math.sin(t * 5 + i)) * 4;
    ellipse(ctx, x - f / 2, y, f, 3, i % 2 ? "#e5cf9e" : "#d8b5af");
    ellipse(ctx, x + f / 2, y, f, 3, i % 2 ? "#e5cf9e" : "#d8b5af");
  }
  for (let n of world.needs) {
    let a = Math.min(1, (world.elapsed - n.born) * 2),
      {x,y} = needPosition(n);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.scale(0.85 + a * 0.15, 0.85 + a * 0.15);
    ctx.shadowColor = "#475e4930";
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 3;
    ellipse(ctx, 0, 0, 19, 20, "#f2e9cf");
    ctx.shadowColor = "transparent";
    path(
      ctx,
      [
        [-4, 16],
        [0, 25],
        [5, 16],
      ],
      "#f2e9cf",
    );
    ctx.strokeStyle = "#d6d3b5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle =
      n.kind === "heart"
        ? "#cba099"
        : n.kind === "water"
          ? "#8dadb0"
          : "#c5ac70";
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      16,
      -Math.PI / 2,
      -Math.PI / 2 +
        Math.PI * 2 * Math.max(0.15, 1 - (world.elapsed - n.born) / 100),
    );
    ctx.stroke();
    icon(n.kind, 0, 0, 0.85);
    ctx.restore();
  }
  for (let p of world.particles) {
    ctx.globalAlpha = Math.min(1, p.life);
    if (p.kind === "heart") heart(p.x, p.y, p.size * 0.12, "#dba19b");
    else if (p.kind === "grain") ellipse(ctx, p.x, p.y, 1.6, 1, "#d6b37a");
    else if (p.kind === "water") ellipse(ctx, p.x, p.y, 1.5, 3, "#c9e1d0");
    else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t);
      path(
        ctx,
        [
          [0, -p.size],
          [2, 0],
          [0, p.size],
          [-2, 0],
        ],
        "#f4dfa5",
      );
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // Soft lens vignette, never opaque.
  let v = ctx.createRadialGradient(700, 500, 270, 700, 500, 850);
  v.addColorStop(0, "#475c4900");
  v.addColorStop(1, "#465c492c");
  ctx.fillStyle = v;
  ctx.fillRect(-4000, -3000, 12000, 8000);
  ctx.restore();
}
function tick(now) {
  let dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  if (!document.hidden) {
    if(window.ClassicFarm)window.ClassicFarm.frame(dt);else update(dt);
    if (world.started) {Atmosphere.update(dt);Farm.update(dt);updateGardenCursor();}
    render();
    if (dt > 0) {
      frames.push(dt * 1000);
      if (frames.length > 600) frames.shift();
      if (frames.length > 180 && world.elapsed > 5) {
        let avg = frames.reduce((a, b) => a + b, 0) / frames.length;
        if (avg > 24) grassStride = 2;
      }
    }
  }
  requestAnimationFrame(tick);
}
window.Garden = {
  world,
  view,
  setTime(t) {
    world.forcedTime = t;
    world.time = t;
    world.timeTween = null;
    render();
  },
  needs(n = 3) {
    world.needs = [];
    for (let i = 0; i < n; i++) makeNeed();
    render();
  },
  stats() {
    return {
      averageFrameMs: frames.reduce((a, b) => a + b, 0) / frames.length,
      grassCount: world.tufts.length,
      grassStride,
      dpr: view.dpr,
    };
  },
};
addEventListener("resize", resize);
resize();
requestAnimationFrame(tick);
