"use strict";
const P = {
  grass: "#8fa56d",
  light: "#cbd29a",
  dark: "#4c694f",
  ink: "#535749",
  cream: "#efe3bb",
  wood: "#bca37e",
  roof: "#747f79",
  roofLight: "#9da694",
  pink: "#c58e8b",
  water: "#719c93",
  soil: "#8e7659",
};
function shade(hex, n) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) + n))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
let seed = 71;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function ellipse(c, x, y, rx, ry, color) {
  if (
    typeof color === "string" &&
    color[0] === "#" &&
    color.length === 7 &&
    rx > 8 &&
    ry > 5
  ) {
    let g = c.createRadialGradient(
      x - rx * 0.35,
      y - ry * 0.45,
      1,
      x,
      y,
      Math.max(rx, ry) * 1.2,
    );
    g.addColorStop(0, color);
    g.addColorStop(1, shade(color, -16));
    c.fillStyle = g;
  } else c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, 7);
  c.fill();
}
function path(c, points, color, stroke) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1.5;
    c.stroke();
  }
}
function line(c, x, y, X, Y, color, w = 1) {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(X, Y);
  c.stroke();
}
function sprite(w, h, draw, finish = true) {
  let s = document.createElement("canvas");
  s.width = w * 2;
  s.height = h * 2;
  let c = s.getContext("2d");
  c.scale(2, 2);
  draw(c);
  if (!finish) return { canvas: s, w, h };
  c.globalCompositeOperation = "source-atop";
  let glaze = c.createLinearGradient(0, 0, w, h);
  glaze.addColorStop(0, "#ffe4a322");
  glaze.addColorStop(0.5, "#e4dbb000");
  glaze.addColorStop(1, "#354f5c20");
  c.fillStyle = glaze;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 10; i++) {
    c.fillStyle = i % 2 ? "#f9e9b509" : "#53665309";
    c.fillRect(rand() * w, rand() * h, 0.7 + rand(), 0.7);
  }
  c.globalCompositeOperation = "source-over";
  return { canvas: s, w, h };
}
const S = {};
S.flowers = [];
for (let k = 0; k < 4; k++)
  S.flowers.push(
    sprite(45, 60, (c) => {
      for (let i = 0; i < 7; i++) {
        let x = 7 + rand() * 30,
          y = 10 + rand() * 22;
        line(c, x, 56, x - 2, y, "#708660", 1.5);
        ellipse(c, x + 3, 42, 5, 2, "#839761");
        let color = ["#eee3bd", "#ca9399", "#a4a0b9", "#e3bc68"][k];
        if (k === 2) {
          for (let j = 0; j < 5; j++)
            ellipse(c, x + (j % 2 ? 2 : -2), y + j * 3, 3, 2, color);
        } else {
          for (let j = 0; j < 6; j++)
            ellipse(c, x + Math.cos(j) * 4, y + Math.sin(j) * 4, 3, 3, color);
          ellipse(c, x, y, 2, 2, "#b99455");
        }
      }
    }),
  );
S.chickens = [];
for (let breed = 0; breed < 4; breed++)
  S.chickens.push(
    sprite(52, 53, (c) => {
      let body = ["#f0e4c2", "#b98254", "#59655d", "#d7c6a4"][breed];
      path(
        c,
        [
          [17, 31],
          [3, 20],
          [6, 34],
          [15, 40],
        ],
        breed === 2 ? "#444f4b" : "#b3a27e",
      );
      ellipse(c, 26, 32, 16, 12, body);
      ellipse(
        c,
        22,
        29,
        10,
        8,
        breed === 1 ? "#ceaa78" : breed === 2 ? "#7f8c7e" : "#e1d3b0",
      );
      for (let i = 0; i < 6; i++)
        line(
          c,
          17 + i * 2,
          29,
          20 + i * 2,
          34,
          breed === 2 ? "#c0c7a0" : "#bba47b",
          0.7,
        );
      ellipse(c, 36, 19, 9, 11, body);
      ellipse(c, 37, 8, 3, 4, "#b66e61");
      ellipse(c, 32, 9, 3, 3, "#b66e61");
      ellipse(c, 41, 9, 2.5, 3, "#b66e61");
      ellipse(c, 41, 27, 2.5, 4, "#b66e61");
      path(
        c,
        [
          [43, 19],
          [51, 22],
          [43, 24],
        ],
        "#d5a75b",
      );
      ellipse(c, 40, 17, 2, 2, "#3e4c44");
      ellipse(c, 40.5, 16.5, 0.65, 0.65, "#fff0ca");
      line(c, 23, 42, 22, 49, "#ac8e5d", 2);
      line(c, 32, 42, 33, 49, "#ac8e5d", 2);
      line(c, 22, 49, 27, 49, "#ac8e5d", 1.5);
      line(c, 33, 49, 38, 49, "#ac8e5d", 1.5);
    }),
  );
S.tuft = sprite(22, 23, (c) => {
  for (let i = 0; i < 9; i++) {
    let x = 4 + rand() * 14;
    c.strokeStyle = ["#a6b77a", "#819c66", "#c0ca91"][i % 3];
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(11, 23);
    c.quadraticCurveTo(x, 13, x - 2, 5 + rand() * 12);
    c.stroke();
  }
});
