"use strict";
function fulfillNeed(n) {
  world.needs = world.needs.filter((x) => x !== n);
  if (n.target.breed !== undefined && n.kind !== "food")
    Farm.award(n.target.x, n.target.y - 40, 5);
  if (n.target.koi) feedFish(n.target.x, n.target.y);
  else if (n.kind === "food") scatterGrain(n.target.x, n.target.y);
  else if (n.kind === "water" && n.target.breed === undefined)
    waterPlant(n.target);
  else {
    n.target.pet = 2;
    burst(n.target.x, n.target.y - 40, n.kind === "water" ? "water" : "heart");
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
  const tools = { 1: "grain", 2: "water", 3: "fish", 4: "pet", Escape: "pet" };
  if (tools[e.key]) selectTool(tools[e.key]);
  if (e.key.toLowerCase() === "r") {
    YouTubeGarden.desired = true;
    YouTubeGarden.start();
  }
  if (e.key.toLowerCase() === "l") document.querySelector("#music").click();
  if (e.key.toLowerCase() === "d") toggleDayNight();
  if (e.key.toLowerCase() === "m") {
    AudioGarden.toggle();
    YouTubeGarden.mute();
  }
  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
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
  insideBed,
  fulfillNeed,
  scatterGrain,
  waterPlant,
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
