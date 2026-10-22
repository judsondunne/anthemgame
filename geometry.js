"use strict";
// One isometric orthographic camera: ground axes project at +30° and −30°.
// Every vertex is [width, depth, height]; verticals stay vertical in the image.
const Camera3D = { yaw: Math.PI / 4, elevation: Math.atan(1 / Math.sqrt(2)) };
Object.assign(Camera3D, {
  xx: Math.cos(Camera3D.yaw),
  xy: Math.sin(Camera3D.yaw) * Math.sin(Camera3D.elevation),
  zx: Math.sin(Camera3D.yaw),
  zy: -Math.cos(Camera3D.yaw) * Math.sin(Camera3D.elevation),
  hy: -Math.cos(Camera3D.elevation),
});
function project3(x, z, h = 0) {
  return {
    x: x * Camera3D.xx + z * Camera3D.zx,
    y: x * Camera3D.xy + z * Camera3D.zy + h * Camera3D.hy,
  };
}
function face3(c, vertices, color, stroke) {
  path(
    c,
    vertices.map((v) => {
      let p = project3(...v);
      return [p.x, p.y];
    }),
    color,
    stroke,
  );
}
function line3(c, a, b, color, w = 1) {
  let A = project3(...a),
    B = project3(...b);
  line(c, A.x, A.y, B.x, B.y, color, w);
}
function frontPlane(c, z, draw) {
  c.save();
  c.transform(
    Camera3D.xx,
    Camera3D.xy,
    0,
    -Camera3D.hy,
    Camera3D.zx * z,
    Camera3D.zy * z,
  );
  draw();
  c.restore();
}
function sidePlane(c, x, draw) {
  c.save();
  c.transform(
    Camera3D.zx,
    Camera3D.zy,
    0,
    -Camera3D.hy,
    Camera3D.xx * x,
    Camera3D.xy * x,
  );
  draw();
  c.restore();
}
function box3(c, x0, x1, z0, z1, h0, h1, colors) {
  face3(
    c,
    [
      [x1, z0, h0],
      [x1, z1, h0],
      [x1, z1, h1],
      [x1, z0, h1],
    ],
    colors[1],
  );
  face3(
    c,
    [
      [x0, z0, h0],
      [x1, z0, h0],
      [x1, z0, h1],
      [x0, z0, h1],
    ],
    colors[0],
  );
  face3(
    c,
    [
      [x0, z0, h1],
      [x1, z0, h1],
      [x1, z1, h1],
      [x0, z1, h1],
    ],
    colors[2],
  );
}
function modelSprite(w, h, anchor, draw) {
  let s = sprite(w, h, (c) => {
    c.translate(anchor.x, anchor.y);
    draw(c);
  });
  s.anchor = anchor;
  return s;
}
function roof3(c, half, depth, wall, ridge, colors) {
  const over = 7,
    height = (x) => ridge - ((ridge - wall) * Math.abs(x)) / half;
  face3(
    c,
    [
      [0, -over, ridge],
      [0, depth + over, ridge],
      [half + over, depth + over, height(half + over)],
      [half + over, -over, height(half + over)],
    ],
    gradient(c, -30, -260, 180, -80, colors),
  );
  // Shingles are laid along the roof plane's exact width/depth vectors.
  for (let i = 0; i <= 14; i++) {
    let x = ((half + over) * i) / 14,
      h = height(x);
    line3(c, [x, -over, h], [x, depth + over, h], "#bec8b252", 0.7);
    for (let j = 0; j < 13; j++) {
      let z = -over + (j * (depth + over * 2)) / 13 + (i % 2 ? 6 : 0),
        X = Math.min(half + over, x + (half + over) / 14);
      line3(c, [x, z, h], [X, z, height(X)], "#3e62664d", 0.6);
    }
  }
  line3(c, [0, -8, ridge + 1], [0, depth + 8, ridge + 1], "#c6c4ad", 3);
  line3(c, [-half - 7, -8, height(half + 7)], [0, -8, ridge + 2], "#f1e6cc", 4);
  line3(c, [0, -8, ridge + 2], [half + 7, -8, height(half + 7)], "#f1e6cc", 4);
  line3(
    c,
    [half + 7, -8, height(half + 7)],
    [half + 7, depth + 8, height(half + 7)],
    "#d8d9c0",
    4,
  );
}
const cottageModel = { width: 210, depth: 155, wall: 152, ridge: 238 };
function cottage3(c, lit = false) {
  const half = 105,
    depth = 155;
  if (!lit) {
    box3(c, -110, 110, -3, 158, 0, 9, ["#a4aa97", "#8e9f8f", "#d0ccb5"]);
    face3(
      c,
      [
        [105, 0, 9],
        [105, 155, 9],
        [105, 155, 152],
        [105, 0, 152],
      ],
      gradient(c, 75, -120, 180, 0, ["#b9c4b4", "#a6b5a6", "#889e94"]),
    );
    face3(
      c,
      [
        [-105, 0, 9],
        [105, 0, 9],
        [105, 0, 152],
        [0, 0, 238],
        [-105, 0, 152],
      ],
      gradient(c, -90, -220, 100, 0, ["#f4ead2", "#e4dfc9", "#c8cfb9"]),
    );
    frontPlane(c, 0, () => {
      for (let h = 14; h < 235; h += 6) {
        let inset = h > 152 ? ((h - 152) / 86) * 105 : 0;
        line(c, -105 + inset, -h, 105 - inset, -h, "#9eac9366", 0.6);
        line(c, -105 + inset, -h + 1, 105 - inset, -h + 1, "#fff1d84d", 0.6);
      }
    });
    sidePlane(c, 105, () => {
      for (let h = 14; h < 152; h += 6) {
        line(c, 0, -h, 155, -h, "#718d7b70", 0.65);
        line(c, 0, -h + 1, 155, -h + 1, "#e0e6ce44", 0.6);
      }
    });
    roof3(c, half, depth, 152, 238, ["#9baba6", "#718990", "#536f7a"]);
    for (let i = 1; i < 16; i++) {
      let x = -105 + i * 13,
        h = 238 - (Math.abs(x) / 105) * 86 - 8;
      line3(c, [x, -8, h], [x, -8, h - 8], "#dfd9c1", 1.4);
    }
    line3(c, [0, -9, 224], [0, -9, 204], "#eee4c9", 2);
    line3(c, [-16, -9, 211], [16, -9, 211], "#e8dfc5", 1.6);
    // A masonry chimney has the same camera and physically intersects the roof.
    const roofAt = (x) => 238 - ((238 - 152) * x) / 105;
    face3(
      c,
      [
        [68, 102, roofAt(68)],
        [68, 124, roofAt(68)],
        [68, 124, 265],
        [68, 102, 265],
      ],
      "#82988b",
    );
    face3(
      c,
      [
        [48, 102, roofAt(48)],
        [68, 102, roofAt(68)],
        [68, 102, 265],
        [48, 102, 265],
      ],
      "#a5a591",
    );
    face3(
      c,
      [
        [48, 102, 265],
        [68, 102, 265],
        [68, 124, 265],
        [48, 124, 265],
      ],
      "#c9c5ac",
    );
    for (let h = 205; h < 260; h += 7) {
      line3(c, [48, 102, h], [68, 102, h], "#ddd0b1", 0.6);
      line3(c, [68, 102, h], [68, 124, h], "#637f7266", 0.6);
    }
    box3(c, 45, 71, 99, 127, 264, 269, ["#c4bba2", "#9eaa93", "#d4cbb1"]);
    face3(
      c,
      [
        [50, 104, 269.5],
        [66, 104, 269.5],
        [66, 122, 269.5],
        [50, 122, 269.5],
      ],
      "#63776f",
    );
  }
  frontPlane(c, -0.8, () => {
    if (!lit) {
      c.fillStyle = "#d6d1b6";
      c.beginPath();
      c.ellipse(0, -183, 13, 16, 0, 0, 7);
      c.fill();
      c.fillStyle = gradient(c, -8, -194, 8, -170, [
        "#6d8e89",
        "#b6c6b2",
        "#718c83",
      ]);
      c.beginPath();
      c.ellipse(0, -183, 9, 12, 0, 0, 7);
      c.fill();
    } else {
      c.fillStyle = "#e5c88a";
      c.beginPath();
      c.ellipse(0, -183, 9, 12, 0, 0, 7);
      c.fill();
    }
    line(c, 0, -195, 0, -171, "#eee3c6", 1.6);
    line(c, -9, -183, 9, -183, "#eee3c6", 1.6);
    for (const x of [-73, 42]) {
      if (!lit) {
        for (const sx of [x - 11, x + 28]) {
          c.fillStyle = "#78937c";
          c.fillRect(sx, -146, 8, 47);
          for (let j = 0; j < 10; j++)
            line(c, sx, -142 + j * 4, sx + 8, -142 + j * 4, "#b2bda0", 0.65);
        }
      }
      houseWindow(c, x, -143, 24, 42, lit);
    }
    if (!lit) {
      c.fillStyle = "#78957f";
      c.fillRect(6, -86, 35, 73);
      houseWindow(c, 12, -80, 23, 27);
      c.strokeStyle = "#b8c8a6";
      c.strokeRect(11, -44, 25, 23);
      ellipse(c, 35, -48, 1.7, 1.7, "#ccb27c");
    } else houseWindow(c, 12, -80, 23, 27, true);
  });
  sidePlane(c, 105.8, () => {
    for (let z of [27, 99]) houseWindow(c, z, -133, 29, 51, lit);
  });
  if (lit) {
    c.save();
    c.globalCompositeOperation = "destination-out";
    face3(
      c,
      [
        [-12, -30, 94],
        [113, -30, 94],
        [113, 2, 101],
        [-12, 2, 101],
      ],
      "#eee3c6",
    );
    c.restore();
    return;
  }
  // Projecting bay with three genuinely different window planes.
  box3(c, -87, -40, -16, 0, 20, 85, ["#dcd9bf", "#abbba6", "#eee1c5"]);
  frontPlane(c, -16, () => {
    houseWindow(c, -81, -77, 16, 45);
    houseWindow(c, -60, -77, 16, 45);
  });
  sidePlane(c, -40, () => houseWindow(c, -14, -77, 12, 45));
  face3(
    c,
    [
      [-91, -20, 86],
      [-36, -20, 86],
      [-39, 3, 95],
      [-88, 3, 95],
    ],
    "#6e8982",
  );
  // Porch floor, sloping roof, and posts all meet at matching 3D coordinates.
  box3(c, -9, 108, -42, 0, 4, 12, ["#b8b59b", "#a0aa91", "#dcd0b2"]);
  for (let z = -38; z < 0; z += 6)
    line3(c, [-9, z, 12.4], [108, z, 12.4], "#aaa78a", 0.65);
  face3(
    c,
    [
      [-12, -30, 94],
      [113, -30, 94],
      [113, 2, 101],
      [-12, 2, 101],
    ],
    "#6c8780",
  );
  line3(c, [-12, -30, 92], [113, -30, 92], "#e9dfc4", 4);
  for (const x of [-6, 103]) {
    box3(c, x - 2, x + 2, -27, -23, 12, 94, ["#ede3ca", "#b2bda4", "#eee7cb"]);
    line3(c, [x, -25, 83], [x + (x < 0 ? 12 : -12), -25, 93], "#ded9bf", 2);
  }
  for (let x = 65; x < 102; x += 6)
    line3(c, [x, -39, 15], [x, -39, 43], "#e0d8bc", 1.6);
  line3(c, [63, -39, 45], [107, -39, 45], "#f0e4c8", 3);
  for (let i = 0; i < 3; i++)
    box3(c, 9 - i * 3, 48 + i * 3, -47 - i * 8, -39 - i * 8, 0, 9 - i * 3, [
      "#b3b19a",
      "#99a48e",
      "#d8d0b6",
    ]);
  // A small hanging lantern, attached under the porch roof.
  line3(c, [73, -23, 94], [73, -23, 83], "#637d6d", 1);
  box3(c, 69, 77, -26, -20, 69, 82, ["#d4b87e", "#b59e6d", "#8fa084"]);
  for (const [x, z] of [
    [-94, -15],
    [96, -36],
  ]) {
    box3(c, x - 5, x + 5, z - 4, z + 4, 12, 23, [
      "#b19b80",
      "#9c9175",
      "#c2b28e",
    ]);
    let p = project3(x, z, 25);
    for (let i = 0; i < 15; i++)
      ellipse(
        c,
        p.x + (rand() - 0.5) * 14,
        p.y - rand() * 7,
        2,
        2,
        ["#91a277", "#d3ada3", "#e7d6b1"][i % 3],
      );
  }
}
S.house = modelSprite(420, 390, { x: 155, y: 310 }, (c) => cottage3(c));
S.houseNight = modelSprite(420, 390, { x: 155, y: 310 }, (c) =>
  cottage3(c, true),
);
S.house.lantern = project3(73, -23, 76);
S.house.chimney = project3(58, 112, 271);
S.house.footprint = [
  [-110, -3, 0],
  [-87, -3, 0],
  [-87, -20, 0],
  [-35, -20, 0],
  [-35, -3, 0],
  [-9, -3, 0],
  [-9, -42, 0],
  [3, -42, 0],
  [3, -65, 0],
  [54, -65, 0],
  [54, -42, 0],
  [110, -42, 0],
  [110, 158, 0],
  [-110, 158, 0],
].map((p) => project3(...p));
// The same camera constructs the raised beds and their exposed soil plane.
S.bed = modelSprite(260, 150, { x: 90, y: 112 }, (c) => {
  box3(c, -90, 90, 0, 122, 0, 12, ["#b49a72", "#8e8e6c", "#d0b68b"]);
  face3(
    c,
    [
      [-84, 5, 12.1],
      [84, 5, 12.1],
      [84, 116, 12.1],
      [-84, 116, 12.1],
    ],
    gradient(c, -80, -80, 90, 30, ["#8d8160", "#9d8c66", "#7f7859"]),
  );
  for (let z = 18; z < 115; z += 25)
    line3(c, [-80, z, 12.3], [80, z, 12.3], "#b19a706b", 1.2);
  line3(c, [-90, 0, 12], [90, 0, 12], "#dcca9c", 2);
});
S.fence = modelSprite(235, 170, { x: 105, y: 110 }, (c) => {
  for (let x = -110; x <= 110; x += 22) {
    box3(c, x - 2.5, x + 2.5, -1, 3, 0, 53, ["#dfd6ba", "#afb69b", "#ece3c6"]);
    face3(
      c,
      [
        [x - 2.5, -1, 53],
        [x, -1, 60],
        [x + 2.5, -1, 53],
      ],
      "#e4dcc1",
    );
  }
  for (let h of [19, 38])
    box3(c, -114, 114, -3, -0.5, h, h + 4, ["#c5c4a5", "#a0b296", "#dfd7b9"]);
});
// A modest cedar coop, with an open front so each sleeping bird stays visible.
S.coop = modelSprite(280, 240, { x: 120, y: 190 }, (c) => {
  const half = 83,
    depth = 103;
  box3(c, -87, 87, -4, 106, 0, 9, ["#a49e81", "#89967d", "#c7b58d"]);
  face3(
    c,
    [
      [half, 0, 9],
      [half, depth, 9],
      [half, depth, 88],
      [half, 0, 88],
    ],
    "#a3af91",
  );
  frontPlane(c, 0, () => {
    c.fillStyle = gradient(c, 0, -87, 0, -9, ["#b8bf9a", "#939f80"]);
    c.fillRect(-83, -88, 166, 79);
    c.fillStyle = gradient(c, 0, -75, 0, -12, [
      "#5e7564",
      "#867e56",
      "#b2a074",
    ]);
    c.fillRect(-69, -71, 138, 59);
    for (let x = -80; x < 85; x += 10)
      line(c, x, -88, x, -72, "#e0d1a45c", 0.6);
  });
  face3(
    c,
    [
      [-83, 0, 88],
      [0, 0, 139],
      [83, 0, 88],
    ],
    "#c7c3a0",
  );
  roof3(c, half, depth, 88, 139, ["#b09a80", "#958b75", "#747d6b"]);
  frontPlane(c, -0.5, () => {
    ellipse(c, 0, -106, 8, 9, "#a9b191");
    ellipse(c, 0, -106, 5, 6, "#6e836c");
    line(c, 0, -112, 0, -100, "#d7c8a1", 1);
    line(c, -5, -106, 5, -106, "#d7c8a1", 1);
  });
  const vane = project3(0, 15, 157);
  line3(c, [0, 15, 139], [0, 15, 158], "#809078", 1);
  c.drawImage(S.chickens[1].canvas, vane.x - 7, vane.y - 12, 14, 14);
  sidePlane(c, 83, () => {
    for (let h = 16; h < 85; h += 8) line(c, 0, -h, 103, -h, "#778e7666", 0.6);
    houseWindow(c, 40, -62, 30, 30);
  });
  for (const x of [-73, 73])
    box3(c, x - 3, x + 3, -3, 0, 10, 77, ["#d4c4a0", "#a0ad8a", "#dfd1ab"]);
  line3(c, [-72, -3, 74], [72, -3, 74], "#e3d1a7", 3);
  line3(c, [-72, -3, 11], [72, -3, 11], "#c9ba92", 3);
  // A short ramp, resting on the lawn at its front edge.
  face3(
    c,
    [
      [-25, -43, 0],
      [25, -43, 0],
      [25, -5, 11],
      [-25, -5, 11],
    ],
    "#bdb28e",
  );
  for (let z = -38; z < -5; z += 7)
    line3(
      c,
      [-24, z, ((z + 43) / 38) * 11],
      [24, z, ((z + 43) / 38) * 11],
      "#ded0a5",
      1.5,
    );
  frontPlane(c, -0.5, () => {
    for (let i = 0; i < 80; i++) {
      let x = (rand() - 0.5) * 130,
        y = -15 - rand() * 6;
      line(c, x, y, x + 3, y - 1, "#dac18c66", 0.5);
    }
  });
});
S.coop.opening = [
  [-67, 0, 14],
  [67, 0, 14],
  [67, 0, 70],
  [-67, 0, 70],
].map((p) => project3(...p));
S.sleeping = S.chickens.map((s, i) =>
  sprite(52, 43, (c) => {
    c.drawImage(s.canvas, 0, 0, 52, 53);
    c.clearRect(0, 41, 52, 12);
    const colors = ["#f0e4c2", "#b98254", "#59655d", "#d7c6a4"];
    ellipse(c, 40, 17, 2.7, 2.7, colors[i]);
    line(c, 38, 17, 42, 18, "#5e6e5a", 1);
    ellipse(c, 25, 39, 11, 2, "#c7b58f55");
  }),
);
