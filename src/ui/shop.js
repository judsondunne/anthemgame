// Market panel. Buy tab: seeds, feed, animals, buildings, beds. Sell tab:
// everything sellable. Icons, numerals and states only.
import { ICONS, itemIcon } from "./icons.js";
import { NIGHT_ICONS as N } from "./night-icons.js";
import { fmt } from "./juice.js";
import { BALANCE as B } from "../config/balance.js";
import { SEEDS, FEEDS, GOODS, SPECIES, buyPrice, sellPrice, canBuy, housing, alive, ownedOf, driftOf, sellableAnimals } from "../sim/index.js";

const SECTIONS = [
  { icon: () => N.fence, keys: ["fence", "gate"] },
  { icon: () => itemIcon("seed_daisy"), keys: SEEDS },
  { icon: () => itemIcon("feed_chicken"), keys: FEEDS },
  { icon: () => ICONS.hen, keys: SPECIES.flatMap((sp) => ["f", "m"].map((x) => `animal_${sp}_${x}`)) },
  { icon: () => ICONS.house, keys: ["kit_bed", "kit_coop", "kit_barn", "kit_stable"] },
];
const BUILDING_FOR = { cow: "barn", horse: "stable" };

export function createShop({ game, hud, juice, audio, onKit }) {
  const veil = document.createElement("div");
  veil.id = "shopveil";
  const el = document.createElement("div");
  el.id = "shop";
  el.className = "glass";
  el.setAttribute("role", "dialog");
  el.innerHTML = `<div class="shophead"><button class="tab buy" aria-label="Buy">${ICONS.basket}</button><button class="tab sell" aria-label="Sell">${ICONS.coins}</button><div class="pill money"><span class="ico">${ICONS.coin}</span><span class="num"></span></div><button class="close" aria-label="Close">${ICONS.close}</button></div><div class="shopbody"></div>`;
  document.body.append(veil, el);
  const body = el.querySelector(".shopbody"),
    numEl = el.querySelector(".num"),
    tabs = { buy: el.querySelector(".tab.buy"), sell: el.querySelector(".tab.sell") };
  let tab = "buy",
    isOpen = false,
    signature = "",
    hold = null;
  veil.onclick = close;
  el.querySelector(".close").onclick = close;
  tabs.buy.onclick = () => show("buy");
  tabs.sell.onclick = () => show("sell");

  function open(which = "buy", focus = null) {
    document.exitPointerLock?.();
    hud.toggleInventory?.(false);
    isOpen = true;
    el.classList.add("open");
    veil.classList.add("open");
    show(which);
    if (focus) body.querySelector(`[data-key="${focus}"]`)?.scrollIntoView({ block: "center" });
  }
  function close() {
    isOpen = false;
    el.classList.remove("open");
    veil.classList.remove("open");
    stopHold();
  }
  function show(which) {
    tab = which;
    tabs.buy.classList.toggle("active", tab === "buy");
    tabs.sell.classList.toggle("active", tab === "sell");
    signature = "";
    render();
  }

  // ---------- buy ----------
  function buyTile(s, key) {
    const t = document.createElement("button");
    t.className = "tile";
    t.dataset.key = key;
    t.setAttribute("aria-label", key);
    const animal = /^animal_(\w+)_(f|m)$/.exec(key);
    t.innerHTML = `<div class="art">${itemIcon(key)}${animal ? `<span class="sex">${animal[2] === "f" ? ICONS.female : ICONS.male}</span>` : ""}</div><div class="price"><span class="ico">${ICONS.coin}</span><span class="n"></span></div>`;
    if (animal) t.insertAdjacentHTML("beforeend", `<div class="cap"><span class="ico">${ICONS.house}</span><span class="c"></span></div>`);
    else if (key.startsWith("kit_") || FEEDS.includes(key) || SEEDS.includes(key)) t.insertAdjacentHTML("beforeend", `<span class="count"></span>`);
    t.addEventListener("pointerdown", (e) => startHold(e, t, key));
    t.addEventListener("pointerup", stopHold);
    t.addEventListener("pointerleave", stopHold);
    t.addEventListener("pointercancel", stopHold);
    t.addEventListener("click", (e) => e.preventDefault());
    return t;
  }

  function updateBuyTile(s, t, key, hs) {
    const animal = /^animal_(\w+)_(f|m)$/.exec(key);
    const price = buyPrice(s, key);
    t.querySelector(".n").textContent = fmt(price);
    const check = canBuy(s, key);
    const locked = check.reason === "locked";
    t.classList.toggle("locked", locked);
    t.classList.toggle("poor", check.reason === "money");
    t.classList.toggle("blocked", ["full", "max", "stack"].includes(check.reason));
    let mark = t.querySelector(".lockmark");
    if (locked && !mark) {
      t.insertAdjacentHTML("beforeend", `<div class="lockmark"><span class="ico">${ICONS.lock}</span><span class="ico">${ICONS[BUILDING_FOR[animal[1]]]}</span></div>`);
    } else if (!locked && mark && !t.classList.contains("unlocking")) mark.remove();
    if (animal) {
      const sp = animal[1];
      t.querySelector(".c").textContent = `${alive(s, sp).length}/${hs.cap[sp]}`;
      // First look at a freshly unlocked species: the padlock pops off.
      if (!locked && BUILDING_FOR[sp] && !s.celebrated[sp]) {
        s.celebrated[sp] = true;
        if (!t.querySelector(".lockmark")) t.insertAdjacentHTML("beforeend", `<div class="lockmark"><span class="ico">${ICONS.unlock}</span><span class="ico">${ICONS[BUILDING_FOR[sp]]}</span></div>`);
        t.classList.add("unlocking");
        setTimeout(() => {
          t.classList.remove("unlocking");
          t.querySelector(".lockmark")?.remove();
        }, 1200);
      }
    }
    const count = t.querySelector(".count");
    if (count) {
      const n = key.startsWith("kit_") ? ownedOf(s, key.slice(4)) : s.inv[key] ?? 0;
      count.textContent = n ? String(n) : "";
      count.style.display = n ? "" : "none";
    }
  }

  function attemptBuy(t, key) {
    const r = game.act("buy", key);
    const p = juice.center(t);
    if (r.ok) {
      juice.coinPop(p.x, p.y - 20, -r.price, hud.moneyEl);
      juice.bump(t, "got");
      if (key.startsWith("kit_")) {
        close();
        onKit(key);
      } else if (!key.startsWith("animal_")) juice.fly(p.x, p.y, itemIcon(key), hud.slotEl(key));
      render();
      return true;
    }
    juice.shake(t);
    if (r.reason === "money") juice.shake(hud.moneyEl);
    return false;
  }

  function startHold(e, t, key) {
    stopHold();
    audio.start?.().catch?.(() => {});
    attemptBuy(t, key);
    if (!SEEDS.includes(key) && !FEEDS.includes(key)) return;
    hold = setTimeout(function repeat() {
      if (!attemptBuy(t, key)) return stopHold();
      hold = setTimeout(repeat, B.ui.holdRepeatMs);
    }, B.ui.holdRepeatStartMs);
  }
  function stopHold() {
    clearTimeout(hold);
    hold = null;
  }

  // ---------- sell ----------
  function sellEntries(s) {
    const out = GOODS.filter((k) => (s.inv[k] ?? 0) > 0).map((k) => ({ key: k, n: s.inv[k], unit: sellPrice(s, k), drift: driftOf(s, k) }));
    for (const sp of SPECIES)
      for (const sex of ["f", "m"]) {
        const n = sellableAnimals(s, sp, sex).length;
        if (n) out.push({ key: `animal_${sp}_${sex}`, n, unit: B.species[sp].sell[sex], sp, sex });
      }
    return out;
  }

  function sellTile(entry) {
    const t = document.createElement("div");
    t.className = "tile";
    t.dataset.key = entry.key;
    t.setAttribute("role", "button");
    t.setAttribute("aria-label", entry.key);
    t.innerHTML = `<div class="art">${itemIcon(entry.key)}${entry.sex ? `<span class="sex">${entry.sex === "f" ? ICONS.female : ICONS.male}</span>` : ""}</div><div class="price"><span class="ico">${ICONS.coin}</span><span class="n"></span><span class="trend"></span></div><span class="count"></span><button class="all" aria-label="Sell all">${ICONS.all}</button>`;
    t.onclick = (e) => {
      if (e.target.closest(".all")) return;
      sell(t, entry.key, 1);
    };
    t.querySelector(".all").onclick = () => sell(t, entry.key, "all");
    return t;
  }

  function sell(t, key, n) {
    audio.start?.().catch?.(() => {});
    const animal = /^animal_(\w+)_(f|m)$/.exec(key);
    const r = animal ? game.act("sellAnimal", animal[1], animal[2], n) : game.act("sellGood", key, n);
    const p = juice.center(t);
    if (r.ok) juice.coinPop(p.x, p.y - 24, r.total, hud.moneyEl);
    else juice.shake(t);
    render();
  }

  function render() {
    if (!isOpen) return;
    const s = game.state;
    numEl.textContent = fmt(s.money);
    if (tab === "buy") {
      if (signature !== "buy") {
        signature = "buy";
        body.innerHTML = "";
        for (const sec of SECTIONS) {
          body.insertAdjacentHTML("beforeend", `<div class="section"><span class="ico">${sec.icon()}</span></div>`);
          const grid = document.createElement("div");
          grid.className = "grid";
          for (const k of sec.keys) grid.append(buyTile(s, k));
          body.append(grid);
        }
      }
      const hs = housing(s);
      for (const t of body.querySelectorAll(".tile")) updateBuyTile(s, t, t.dataset.key, hs);
      return;
    }
    const entries = sellEntries(s);
    const sig = "sell:" + entries.map((e) => e.key).join(",");
    if (sig !== signature) {
      signature = sig;
      body.innerHTML = "";
      if (!entries.length) body.innerHTML = `<div class="empty"><span class="ico">${ICONS.basket}</span></div>`;
      else {
        const grid = document.createElement("div");
        grid.className = "grid";
        for (const e of entries) grid.append(sellTile(e));
        body.append(grid);
      }
    }
    for (const e of entries) {
      const t = body.querySelector(`[data-key="${e.key}"]`);
      if (!t) continue;
      t.querySelector(".n").textContent = fmt(e.unit);
      t.querySelector(".count").textContent = String(e.n);
      t.querySelector(".trend").innerHTML = e.drift === undefined || Math.abs(e.drift - 1) < 0.03 ? "" : e.drift > 1 ? ICONS.up : ICONS.down;
    }
  }

  return {
    open,
    close,
    render,
    get isOpen() {
      return isOpen;
    },
    get tab() {
      return tab;
    },
    el,
  };
}
