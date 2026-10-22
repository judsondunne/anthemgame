"use strict";
function blendColor(a, b, t) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - t) +
            parseInt(b.slice(i, i + 2), 16) * t,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
// Rounded Green Mountain ridgelines, layered through atmospheric distance.
const mountains = sprite(2400, 500, (c) => {
  function ridge(points, colors) {
    let g = gradient(c, 0, 100, 0, 500, colors);
    c.beginPath();
    c.moveTo(0, 500);
    for (let i = 0; i < points.length - 1; i++) {
      let a = points[i],
        b = points[i + 1];
      for (let x = a[0]; x < b[0]; x += 5) {
        let u = (x - a[0]) / (b[0] - a[0]),
          v = u * u * (3 - 2 * u);
        let y =
          a[1] +
          (b[1] - a[1]) * v +
          Math.sin(x * 0.027) * 2.4 +
          Math.sin(x * 0.068 + 2) * 1.2 +
          Math.sin(x * 0.13) * 0.5;
        c.lineTo(x, y);
      }
    }
    c.lineTo(2400, 500);
    c.closePath();
    c.fillStyle = g;
    c.fill();
  }

  ridge(
    [
      [0, 180],
      [180, 148],
      [340, 200],
      [540, 111],
      [760, 172],
      [960, 129],
      [1180, 189],
      [1360, 121],
      [1580, 181],
      [1790, 105],
      [2020, 170],
      [2240, 127],
      [2400, 165],
    ],
    ["#9fb6b3", "#b1c4b8"],
  );
  ridge(
    [
      [0, 251],
      [210, 203],
      [410, 250],
      [600, 191],
      [840, 244],
      [1050, 182],
      [1280, 252],
      [1510, 205],
      [1720, 237],
      [1930, 185],
      [2150, 254],
      [2400, 211],
    ],
    ["#849f96", "#a2b7a2"],
  );
  ridge(
    [
      [0, 316],
      [240, 264],
      [450, 309],
      [680, 250],
      [900, 299],
      [1100, 265],
      [1340, 312],
      [1530, 252],
      [1790, 302],
      [2050, 263],
      [2270, 300],
      [2400, 284],
    ],
    ["#728f7b", "#94ac88"],
  );
  // Fine forest texture on the nearer ridge: quiet, irregular tree lines.
  for (let i = 0; i < 2100; i++) {
    let x = rand() * 2400,
      y = 305 + rand() * 120;
    let r = 1 + rand() * 3;
    ellipse(c, x, y, r, r * 1.5, rand() > 0.5 ? "#52765716" : "#c1cba01b");
  }
  ridge(
    [
      [0, 412],
      [250, 373],
      [520, 407],
      [780, 358],
      [1030, 407],
      [1280, 369],
      [1560, 420],
      [1800, 363],
      [2080, 406],
      [2400, 375],
    ],
    ["#8ca77f", "#a4b58a"],
  );
  // Field contours and a little distant line of spruce.
  for (let i = 0; i < 4; i++) {
    c.strokeStyle = "#d1d7a32b";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 420 + i * 12);
    c.bezierCurveTo(450, 350 + i * 17, 720, 480 + i * 9, 1180, 411 + i * 13);
    c.bezierCurveTo(1700, 344 + i * 18, 1900, 452 + i * 10, 2400, 421 + i * 12);
    c.stroke();
  }
  for (let i = 0; i < 100; i++) {
    let x = 1280 + i * 9,
      y = 378 + Math.sin(i * 0.12) * 11,
      h = 4 + rand() * 11;
    path(
      c,
      [
        [x, y],
        [x + 3, y - h],
        [x + 7, y],
      ],
      "#647f6655",
    );
  }
});
// Fade the foreground edge into the actual lawn without a rectangular seam.
{
  const c = mountains.canvas.getContext("2d");
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "destination-out";
  let fade = c.createLinearGradient(0, 760, 0, 1000);
  fade.addColorStop(0, "#00000000");
  fade.addColorStop(1, "#000000");
  c.fillStyle = fade;
  c.fillRect(0, 760, 4800, 240);
  c.restore();
}
// Feather tile edges so the wider valley has no vertical joins.
{
 const c=mountains.canvas.getContext('2d');c.save();c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='destination-in';
 const g=c.createLinearGradient(0,0,4800,0);g.addColorStop(0,'#0000');g.addColorStop(.08,'#000');g.addColorStop(.92,'#000');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,0,4800,1000);c.restore();
}
function drawLandscape(t, d, night, sunset) {
  let top = -Math.max(500, view.y / view.scale + 50),
    bottom = 345;
  let sky = gradient(ctx, 0, top, 0, bottom, [
    blendColor(
      blendColor("#b9d7e5", "#c6a3a5", sunset),
      "#233c59",
      night * 0.95,
    ),
    blendColor(
      blendColor("#e7e9d7", "#e3b5a0", sunset),
      "#5c7087",
      night * 0.85,
    ),
    blendColor("#e4ddc2", "#e6be98", sunset),
  ]);
  ctx.fillStyle = sky;
  ctx.fillRect(-4000, top, 12000, bottom - top);
  // Warm horizon light, feathered into the air rather than hard sun rays.
  if (sunset > 0.02) {
    let g = ctx.createRadialGradient(1080, 175, 5, 1080, 175, 400);
    g.addColorStop(0, `rgba(244,180,128,${sunset * 0.58})`);
    g.addColorStop(0.5, `rgba(235,172,142,${sunset * 0.29})`);
    g.addColorStop(1, "#f5c69500");
    ctx.fillStyle = g;
    ctx.fillRect(580, top, 1000, 700);
  }
  if (d > 0.06 && d < 0.67) {
    let u = (d - 0.06) / 0.61,
      x = 170 + u * 1050,
      y = 155 - Math.sin(u * Math.PI) * 95;
    let r = 9 + sunset * 2;
    glow(x, y, 85, "#ffdf9d3b");
    glow(x, y, 35, "#ffeaba44");
    ellipse(ctx, x, y, r, r, "#fff0c9");
  }
  if (night > 0.2) {
    ctx.save();
    ctx.globalAlpha = night;
    for (let i = 0; i < 65; i++) {
      let x = ((i * 131.7) % 1800) - 200,
        y = top + 35 + ((i * 79.3) % (210 - top));
      let a = 0.25 + Math.sin(t * 0.5 + i) * 0.13;
      ellipse(
        ctx,
        x,
        y,
        0.55 + (i % 4) * 0.15,
        0.55 + (i % 4) * 0.15,
        `rgba(237,232,208,${a})`,
      );
    }
    // A real crescent silhouette, cut in a local cache instead of a mismatched sky disk.
    let mx = 1020 + Math.sin(d * 4) * 150,
      my = 85;
    glow(mx, my, 65, "#e4e7d11c");
    ctx.drawImage(S.moon.canvas, mx - 14, my - 14, 28, 28);
    ctx.restore();
  }
  Atmosphere.draw(ctx, t, night, sunset);
  ctx.save();
  ctx.translate(Farm.pan*.82,0);
  ctx.drawImage(mountains.canvas, -2700, 0, 2400, 500);
  ctx.drawImage(mountains.canvas, -500, 0, 2400, 500);
  ctx.drawImage(mountains.canvas, 1700, 0, 2400, 500);
  ctx.drawImage(mountains.canvas, 3900, 0, 2400, 500);
  ctx.restore();
  // Light mist softens the valley and merges it into the near meadow.
  let fog = ctx.createLinearGradient(0, 215, 0, 420);
  fog.addColorStop(0, "#d1dac000");
  fog.addColorStop(0.5, "#c4d2ac33");
  fog.addColorStop(1, "#a6b58000");
  ctx.fillStyle = fog;
  ctx.fillRect(-4000, 215, 12000, 205);
}
S.moon = sprite(40, 40, (c) => {
  let g = c.createRadialGradient(15, 14, 1, 20, 20, 18);
  g.addColorStop(0, "#f1edd7");
  g.addColorStop(1, "#c9d2c6");
  ellipse(c, 20, 20, 13, 13, g);
  c.globalCompositeOperation = "destination-out";
  ellipse(c, 26, 15, 12, 12, "#eee4ca");
  c.globalCompositeOperation = "source-over";
});
S.cloud = sprite(300, 80, (c) => {
  for (let i = 0; i < 10; i++) {
    let x = 35 + i * 25,
      y = 38 + Math.sin(i) * 6;
    let g = c.createRadialGradient(x, y, 0, x, y, 42);
    g.addColorStop(0, "#f4f1dc66");
    g.addColorStop(1, "#f4f1dc00");
    c.fillStyle = g;
    c.fillRect(x - 42, y - 42, 84, 84);
  }
});
