"use strict";
// Ambient care from the original garden: affection for hens and pellets for the
// koi. Feeding and watering animals is handled by the farm simulation.
function fulfillNeed(n) {
  world.needs = world.needs.filter((x) => x !== n);
  if (n.target.koi) feedFish(n.target.x, n.target.y);
  else {
    n.target.pet = 2;
    burst(n.target.x, n.target.y - 40, "heart");
  }
}
function selectTool(tool) {
  world.tool = tool;
}
Farm.init();
// The shared sound engine starts from the first trusted garden gesture.
function startAudio() {
  AudioGarden.start().catch(() => {});
}
addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key.toLowerCase() === "r") {
    YouTubeGarden.desired = true;
    YouTubeGarden.start();
  }
  if (e.key.toLowerCase() === "l") document.querySelector("#music").click();
  if (e.key.toLowerCase() === "m") {
    AudioGarden.toggle();
    YouTubeGarden.mute();
  }
  if (!window.Garden?.cameraControl && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    Farm.held = e.key === "ArrowLeft" ? -1 : 1;
  }
});
addEventListener("keyup", (e) => {
  if (["ArrowLeft", "ArrowRight"].includes(e.key)) Farm.held = 0;
});
addEventListener("blur", () => (Farm.held = 0));
addEventListener("visibilitychange", () => {
  AudioGarden.visibility();
  YouTubeGarden.visibility();
});
window.GameState = {
  world,
  Farm,
  view,
  update,
  rand,
  inPond,
  walkable,
  nearestWalkable,
  insideBed,
  FarmFootprints,
  makeChickenAgent,
  sendChicken,
  fulfillNeed,
  scatterGrain,
  feedFish,
  burst,
  isNight,
  selectTool,
  startAudio,
  params,
};

document.querySelector("#music").onchange = (e) => {
  if (e.target.files.length) {
    YouTubeGarden.stopForLocal();
    AudioGarden.load(e.target.files).catch(() => {});
  }
};
