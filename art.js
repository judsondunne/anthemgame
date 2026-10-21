"use strict";
// Architectural planes share one projection. Small details are cached at 2×.
Object.assign(P, {
  sky: "#dce5df",
  mist: "#c7d2c4",
  mountain: "#819b94",
  forest: "#506e61",
  slate: "#66777c",
  ivory: "#ece6d1",
});
function gradient(c, x, y, X, Y, stops) {
  let g = c.createLinearGradient(x, y, X, Y);
  stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
  return g;
}
function polygonClip(c, points, draw) {
  c.save();
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
  c.closePath();
  c.clip();
  draw();
  c.restore();
}
function houseWindow(c, x, y, w, h, lit = false) {
  c.fillStyle = "#737d71";
  c.fillRect(x - 5, y - 5, w + 10, h + 10);
  c.fillStyle = "#e9dfc5";
  c.fillRect(x - 3, y - 4, w + 6, h + 7);
  c.fillStyle = gradient(
    c,
    x,
    y,
    x + w,
    y + h,
    lit ? ["#e3bd75", "#f5dc9e", "#ba9258"] : ["#708b8c", "#adc0b4", "#607c7b"],
  );
  c.fillRect(x, y, w, h);
  if (!lit) {
    path(
      c,
      [
        [x + 1, y + 1],
        [x + w * 0.45, y + 1],
        [x + 1, y + h * 0.8],
      ],
      "#e0e6ce40",
    );
    path(
      c,
      [
        [x + w - 1, y + 1],
        [x + w - 1, y + h],
        [x + w * 0.65, y + h],
      ],
      "#f1e4c144",
    );
  }
  line(c, x + w / 2, y, x + w / 2, y + h, "#eee5cd", 1.6);
  line(c, x, y + h * 0.44, x + w, y + h * 0.44, "#eee5cd", 1.6);
  c.fillStyle = "#f1ead3";
  c.fillRect(x - 5, y + h + 1, w + 10, 3);
  line(c, x - 4, y - 4, x + w + 4, y - 4, "#fbefd5", 1.4);
}
// Layered broadleaf crowns: shaded masses broken into hundreds of small leaves.
function foliage(c, cx, cy, rx, ry, colors, count) {
  for (let i = 0; i < count; i++) {
    let a = rand() * Math.PI * 2,
      r = Math.sqrt(rand()),
      x = cx + Math.cos(a) * rx * r,
      y = cy + Math.sin(a) * ry * r;
    let light = ((cx - x) / rx) * 0.25 + ((cy - y) / ry) * 0.55 + rand() * 0.65;
    let col =
      colors[
        Math.max(
          0,
          Math.min(colors.length - 1, Math.floor(light * colors.length)),
        )
      ];
    c.save();
    c.translate(x, y);
    c.rotate(rand() * 4);
    ellipse(c, 0, 0, 2 + rand() * 4, 1.3 + rand() * 2, col);
    c.restore();
  }
}
S.tree = sprite(250, 300, (c) => {
  let trunk = gradient(c, 113, 170, 132, 200, [
    "#8d8c72",
    "#b7a27b",
    "#6f7c65",
  ]);
  c.fillStyle = trunk;
  c.beginPath();
  c.moveTo(108, 293);
  c.bezierCurveTo(119, 263, 118, 204, 121, 147);
  c.lineTo(132, 145);
  c.bezierCurveTo(130, 206, 128, 264, 137, 292);
  c.quadraticCurveTo(121, 288, 108, 293);
  c.fill();
  line(c, 122, 238, 82, 161, "#8b8b6c", 7);
  line(c, 126, 208, 173, 123, "#8b8b6c", 7);
  line(c, 125, 231, 123, 286, "#d5ba8933", 2);
  for (let i = 0; i < 16; i++) {
    let a = i * 2.4,
      r = Math.sqrt(i / 16);
    let x = 125 + Math.cos(a) * 76 * r,
      y = 121 + Math.sin(a) * 71 * r;
    ellipse(c, x, y, 34, 30, ["#4d735d", "#5c7d60", "#6d8b65"][i % 3]);
    foliage(
      c,
      x,
      y,
      34,
      30,
      ["#466c55", "#60805a", "#789365", "#93aa74", "#aebc85"],
      120,
    );
  }
  foliage(
    c,
    110,
    91,
    80,
    66,
    ["#587c57", "#6a8c5e", "#7d9b69", "#94ad79", "#b1bf8b"],
    850,
  );
});
S.bush = sprite(85, 55, (c) => {
  for (let i = 0; i < 7; i++)
    ellipse(c, 13 + i * 9, 32 - Math.sin(i * 0.6) * 8, 15, 13, "#617e5c");
  foliage(c, 42, 30, 36, 19, ["#536f53", "#6c885e", "#859c6b", "#a1b17b"], 450);
  for (let i = 0; i < 12; i++)
    ellipse(c, 12 + rand() * 60, 22 + rand() * 13, 1.6, 1.8, "#d7bcad");
});
S.rock = sprite(40, 25, (c) => {
  let p = [
    [3, 18],
    [10, 7],
    [25, 3],
    [36, 11],
    [36, 19],
    [26, 24],
    [11, 23],
  ];
  path(c, p, gradient(c, 10, 5, 28, 24, ["#c5c4b0", "#a6b09f", "#7d9389"]));
  line(c, 11, 7, 25, 5, "#e0d9c0", 1.2);
  line(c, 27, 12, 32, 19, "#899d90", 0.7);
});
// Smaller tufts with low contrast so the lawn feels soft rather than scratchy.
S.tuft = sprite(20, 18, (c) => {
  for (let i = 0; i < 6; i++) {
    let x = 5 + rand() * 10;
    c.strokeStyle = ["#9caf7a", "#b4c18c", "#819d6e"][i % 3];
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(10, 18);
    c.quadraticCurveTo(x, 13, x - 2, 7 + rand() * 7);
    c.stroke();
  }
});
S.stones = Array.from({ length: 6 }, (_, i) =>
  sprite(38, 25, (c) => {
    c.fillStyle = gradient(c, 8, 4, 27, 24, [
      ["#cac9b3", "#bfc5b0", "#b9c1ae"][i % 3],
      "#99aa99",
      "#7c9489",
    ]);
    c.beginPath();
    c.moveTo(4, 17);
    c.bezierCurveTo(1, 11, 8, 5, 15, 4);
    c.bezierCurveTo(22, 1, 32, 6, 34, 12);
    c.bezierCurveTo(39, 18, 28, 24, 19, 23);
    c.bezierCurveTo(10, 24, 5, 22, 4, 17);
    c.fill();
    c.strokeStyle = "#e0dcc166";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(7, 12);
    c.bezierCurveTo(12, 5, 21, 5, 28, 8);
    c.stroke();
    line(c, 27, 14, 30, 17, "#7d94896b", 0.7);
  }),
);

Object.assign(S.tree, { anchor: { x: 125, y: 292 } });
Object.assign(S.bush, { anchor: { x: 42.5, y: 49 } });
