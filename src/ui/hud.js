// Money pill, day/night dial, sound toggle, bottom hotbar and placement controls.
import { ICONS, TOOL_ICONS, itemIcon, cursorFor } from "./icons.js";
import { fmt } from "./juice.js";
import { SEEDS, FEEDS, KITS, GOODS } from "../sim/index.js";
import { BALANCE as B } from "../config/balance.js";

const TOOLS = ["hand", "can", "fish"];

export function slotKeys(state) {
  const has = (k) => (state.inv[k] ?? 0) > 0;
  return [...TOOLS, ...SEEDS.filter(has), ...[...FEEDS, "hay"].filter(has), ...KITS.filter(has), ...GOODS.filter((k) => k !== "hay" && has(k))];
}
export const isTool = (k) => TOOLS.includes(k);
export const isGood = (k) => GOODS.includes(k) && k !== "hay";

export function createHud({ game, audio, onSelect, onShop, onConfirm, onCancel }) {
  const root = document.documentElement.style;
  root.setProperty("--coin-pop", B.ui.coinPopMs + "ms");
  root.setProperty("--shake", B.ui.shakeMs + "ms");
  root.setProperty("--flourish", B.ui.flourishMs + "ms");

  const hud = document.createElement("div");
  hud.id = "hud";
  hud.innerHTML = `<div class="pill money glass"><span class="ico">${ICONS.coin}</span><span class="num"></span></div>
    <div class="pill dial glass" aria-hidden="true"><svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="rgba(107,91,69,.16)" stroke-width="3"/><circle class="arc" cx="20" cy="20" r="17" fill="none" stroke="#e3bf73" stroke-width="3" stroke-linecap="round" stroke-dasharray="106.8" stroke-dashoffset="106.8"/></svg><span class="ico"></span></div>
    <div class="spacer"></div>
    <button class="roundbtn glass mute" aria-label="Sound"></button>`;
  document.body.append(hud);
  const moneyEl = hud.querySelector(".money"),
    numEl = hud.querySelector(".num"),
    dialEl = hud.querySelector(".dial"),
    arcEl = hud.querySelector(".arc"),
    dialIco = dialEl.querySelector(".ico"),
    muteEl = hud.querySelector(".mute");
  muteEl.innerHTML = ICONS.speaker;
  muteEl.onclick = () => {
    audio.start?.().catch?.(() => {});
    audio.toggle();
    muteEl.innerHTML = audio.muted ? ICONS.muted : ICONS.speaker;
  };

  const bar = document.createElement("div");
  bar.id = "toolbar";
  bar.className = "glass";
  bar.innerHTML = `<div class="slots" role="toolbar" aria-label="Items"></div><span class="divider"></span><button class="shopbtn" aria-label="Market">${ICONS.stall}</button>`;
  document.body.append(bar);
  const slotsEl = bar.querySelector(".slots"),
    shopBtn = bar.querySelector(".shopbtn");
  shopBtn.onclick = () => onShop();

  const place = document.createElement("div");
  place.id = "placement";
  place.hidden = true;
  place.innerHTML = `<button class="no" aria-label="Cancel">${ICONS.close}</button><button class="ok" aria-label="Place">${ICONS.check}</button>`;
  document.body.append(place);
  const okBtn = place.querySelector(".ok");
  place.querySelector(".no").onclick = () => onCancel();
  okBtn.onclick = () => onConfirm();

  let signature = "",
    shownMoney = null,
    selected = game.state.ui.tool || "hand";
  const slotEls = new Map();

  function rebuild(state) {
    const keys = slotKeys(state);
    slotsEl.innerHTML = "";
    slotEls.clear();
    for (const k of keys) {
      const b = document.createElement("button");
      b.className = "slot" + (k.startsWith("kit_") ? " kit" : "");
      b.dataset.key = k;
      b.setAttribute("aria-label", k);
      b.innerHTML = (isTool(k) ? TOOL_ICONS[k] : itemIcon(k)) + (isTool(k) ? "" : `<span class="badge"></span>`);
      b.onclick = () => onSelect(k);
      slotsEl.append(b);
      slotEls.set(k, b);
    }
    if (!keys.includes(selected)) select("hand");
  }

  function select(k) {
    selected = k;
    game.state.ui.tool = k;
    for (const [key, el] of slotEls) el.classList.toggle("selected", key === k);
    document.querySelector("canvas").style.cursor = cursorFor(k);
    slotEls.get(k)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  function update(state, clock) {
    const sig = slotKeys(state).join(",");
    if (sig !== signature) {
      signature = sig;
      rebuild(state);
      select(slotEls.has(selected) ? selected : "hand");
    }
    for (const [k, el] of slotEls) {
      const badge = el.querySelector(".badge");
      if (!badge) continue;
      const n = state.inv[k] ?? 0;
      const text = String(n);
      if (badge.textContent !== text) badge.textContent = text;
      badge.classList.toggle("full", n >= B.inventory.stackMax);
    }
    // Money counts smoothly toward the true value.
    if (shownMoney === null) shownMoney = state.money;
    shownMoney += (state.money - shownMoney) * 0.2;
    if (Math.abs(state.money - shownMoney) < 0.5) shownMoney = state.money;
    const m = fmt(shownMoney);
    if (numEl.textContent !== m) numEl.textContent = m;
    const night = clock.night;
    const frac = night ? (clock.position - B.time.daySeconds) / B.time.nightSeconds : clock.position / B.time.daySeconds;
    arcEl.style.strokeDashoffset = String(106.8 * (1 - frac));
    arcEl.setAttribute("stroke", night ? "#c9d6f0" : "#e3bf73");
    if (dialEl.dataset.night !== String(night)) {
      dialEl.dataset.night = String(night);
      dialEl.classList.toggle("night", night);
      dialIco.innerHTML = night ? ICONS.moon : ICONS.sun;
    }
    const placing = state.ui.placing;
    place.hidden = !placing;
    bar.classList.toggle("dim", !!placing);
  }

  function setValid(ok) {
    okBtn.classList.toggle("invalid", !ok);
  }

  addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 9) {
      const k = [...slotEls.keys()][n - 1];
      if (k) onSelect(k);
    }
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter" && game.state.ui.placing) onConfirm();
  });

  return {
    update,
    select,
    setValid,
    get selected() {
      return selected;
    },
    slotEl: (k) => slotEls.get(k) ?? shopBtn,
    moneyEl,
    shopBtn,
    okBtn,
  };
}
