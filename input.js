"use strict";
let touchStart = null, touchPanned = false;
let dragging = false,
  lastWaterAt = -Infinity;
function selectTool(tool) {
  world.tool = tool;
  document.body.dataset.tool = tool;
  const icon = document.querySelector(`.care-tools [data-tool="${tool}"] svg`).cloneNode(true);
  icon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  icon.setAttribute("width", "40"); icon.setAttribute("height", "40");
  icon.setAttribute("style", "color:#778a71;stroke:#778a71;fill:none;stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round");
  canvas.dataset.toolCursor = `url("data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(icon))}") 20 20, crosshair`;
  updateGardenCursor();
  for (const b of document.querySelectorAll("[data-tool][aria-pressed]"))
    b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
}
function pointerWorld(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - view.x) / view.scale,
    y: (e.clientY - r.top - view.y) / view.scale,
  };
}
function fulfillNeed(n) {
  world.needs = world.needs.filter((x) => x !== n);
  if (n.target.breed !== undefined && n.kind !== "food") Farm.award(n.target.x,n.target.y-40,5,"Cared for");
  if (n.target.koi) feedFish(n.target.x, n.target.y);
  else if (n.kind === "food") scatterGrain(n.target.x, n.target.y);
  else if (n.kind === "water" && n.target.breed === undefined)
    waterPlant(n.target);
  else {
    n.target.pet = 2;
    burst(n.target.x, n.target.y - 40, n.kind === "water" ? "water" : "heart");
  }
}
function useTool(x, y, continuous = false) {
  if (!world.started) return;
  if (!continuous) {
    const need=needAt(x,y);
    if(need){fulfillNeed(need);updateGardenCursor();return;}
  }
  if (!continuous && Farm.interact(x,y)) return;
  if (world.tool === "grain") {
    if (!continuous) scatterGrain(x, y);
    return;
  }
  if (world.tool === "fish") {
    if (!continuous) feedFish(x, y);
    return;
  }
  if (world.tool === "water") {
    if (world.elapsed - lastWaterAt < 0.18) return;
    const plants = world.plants
      .filter((p) => Math.hypot(p.x - x, p.y - 25 * p.growth - y) < 36)
      .sort(
        (a, b) =>
          Math.hypot(a.x - x, a.y - 25 * a.growth - y) -
          Math.hypot(b.x - x, b.y - 25 * b.growth - y),
      );
    if (plants.length) {
      waterPlant(plants[0]);
      lastWaterAt = world.elapsed;
      world.needs = world.needs.filter((n) => n.target !== plants[0]);
    }
    return;
  }
  if (continuous) return;
  const b = world.chickens
    .filter((b) => !b.sleeping && b.mode !== "waking")
    .find((b) => Math.hypot(b.x - x, b.y - 25 - y) < 35);
  if (b) {
    b.pet = 2;
    if (!isNight() && b.mode !== "feeding") {
      b.pause = 2;
      b.path = [];
    }
    burst(b.x, b.y - 40);
    world.needs = world.needs.filter((n) => n.target !== b);
    return;
  }
  const plant = world.plants.find(
    (p) => Math.hypot(p.x - x, p.y - 25 * p.growth - y) < 28,
  );
  if (plant) {
    waterPlant(plant);
    return;
  }
  if (inPond(x, y, -12)) {
    feedFish(x, y);
    return;
  }
  if (isNight() && Math.hypot(world.coop.x - x, world.coop.y - 60 - y) < 90)
    burst(world.coop.x, world.coop.y - 100, "heart");
}
canvas.addEventListener("pointerdown", (e) => {
  if (!world.started) return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  const p = pointerWorld(e);
  if(e.pointerType === "touch"){touchStart={clientX:e.clientX,pan:Farm.targetPan,p};touchPanned=false;}
  else useTool(p.x, p.y);
  AudioGarden.start().catch(() => {});
  YouTubeGarden.start();
});
canvas.addEventListener("pointermove", (e) => {
  if (!world.started) return;
  const p = pointerWorld(e);
  world.pointer = { ...p, visible: e.pointerType !== "touch" };
  updateGardenCursor();
  if(dragging && e.pointerType==="touch" && touchStart && Math.abs(e.clientX-touchStart.clientX)>10){touchPanned=true;Farm.targetPan=Math.max(-1450,Math.min(1450,touchStart.pan-(e.clientX-touchStart.clientX)/view.scale));}
  if (dragging && !touchStart && world.tool === "water") useTool(p.x, p.y, true);

});
canvas.addEventListener("pointerup", () => {if(touchStart&&!touchPanned)useTool(touchStart.p.x,touchStart.p.y);touchStart=null;dragging=false;});
canvas.addEventListener("pointercancel", () => {touchStart=null;dragging=false;});
canvas.addEventListener("pointerleave", () => {
  if (world.pointer) world.pointer.visible = false;
});
for (const b of document.querySelectorAll(".care-tools button"))
  b.addEventListener("click", () => selectTool(b.dataset.tool));
document.querySelector("#continue").addEventListener("click", () => {
  if (world.started) return;
  world.started = true;
  world.nextNeed = 9;
  last = 0;
  document.body.dataset.started = "true";
  canvas.inert = false;
  document.querySelector("#garden-controls").hidden = false;
  YouTubeGarden.desired = true;
  // Both calls occur directly in the trusted Continue gesture.
  YouTubeGarden.start();
  AudioGarden.start().catch(() => {});
  const welcome = document.querySelector("#welcome");
  welcome.classList.add("leaving");
  welcome.inert = true;
  setTimeout(() => {
    welcome.hidden = true;
    document
      .querySelector('.care-tools [data-tool="pet"]')
      .focus({ preventScroll: true });
  }, 400);
});
document.querySelector("#daynight").addEventListener("click", toggleDayNight);
document.querySelector("#files").onclick = () =>
  document.querySelector("#music").click();
document.querySelector("#music").onchange = (e) => {
  if (e.target.files.length) {
    YouTubeGarden.stopForLocal();
    AudioGarden.load(e.target.files).catch(() => {});
  }
};
document.querySelector("#sound").onclick = () => {
  AudioGarden.start().catch(() => {});
  AudioGarden.toggle();
  YouTubeGarden.mute();
};
document.querySelector("#stream").onclick = () => {
  AudioGarden.start().catch(() => {});
  YouTubeGarden.panel();
};
document.addEventListener("visibilitychange", () => {
  last = 0;
  AudioGarden.visibility();
  YouTubeGarden.visibility();
});
document.addEventListener("keydown", (e) => {
  if (!world.started || e.altKey || e.ctrlKey || e.metaKey) return;
  const tools = { 1: "grain", 2: "water", 3: "fish", 4: "pet", Escape: "pet" };
  if (tools[e.key]) selectTool(tools[e.key]);
  if (e.key.toLowerCase() === "d") toggleDayNight();
});

document.addEventListener(
  "pointerdown",
  () => (document.body.dataset.modality = "pointer"),
  { capture: true, passive: true },
);
document.addEventListener(
  "keydown",
  () => (document.body.dataset.modality = "keyboard"),
  { capture: true },
);

selectTool(world.tool);

function updateGardenCursor(){
  const p=world.pointer;
  canvas.style.cursor=p?.visible&&(needAt(p.x,p.y)||Farm.hover(p.x,p.y))?"pointer":canvas.dataset.toolCursor;
}

Farm.init();
