// Feedback flourishes: coin pops that fly to the money pill, items flying to
// their hotbar slot, shakes, and the building-unlock celebration.
import { ICONS } from "./icons.js";
import { BALANCE as B } from "../config/balance.js";

export const fmt = (n) => Math.round(n).toLocaleString("en-US");

export function createJuice({ audio }) {
  const fx = document.createElement("div");
  fx.id = "fx";
  document.body.append(fx);
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  function bump(el, cls = "bump") {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function shake(el) {
    bump(el, "shake");
    audio?.soft?.();
  }

  // "+12" with a coin, rising from a point then sweeping into the money pill.
  function coinPop(x, y, delta, moneyEl) {
    const el = document.createElement("div");
    el.className = "pop" + (delta < 0 ? " minus" : "");
    el.innerHTML = `<span class="ico">${ICONS.coin}</span>${delta < 0 ? "−" : "+"}${fmt(Math.abs(delta))}`;
    el.style.left = x + "px";
    el.style.top = y + "px";
    fx.append(el);
    const to = moneyEl ? center(moneyEl) : { x, y: y - 80 };
    const anim =
      delta > 0
        ? [
            { transform: "translate(-50%,-50%) scale(.6)", opacity: 0 },
            { transform: "translate(-50%,-160%) scale(1.15)", opacity: 1, offset: 0.25 },
            { transform: "translate(-50%,-170%) scale(1)", opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${to.x - x}px), calc(-50% + ${to.y - y}px)) scale(.55)`, opacity: 0.2 },
          ]
        : [
            { transform: "translate(-50%,-50%) scale(.7)", opacity: 0 },
            { transform: "translate(-50%,-120%) scale(1.05)", opacity: 1, offset: 0.3 },
            { transform: "translate(-50%,-180%) scale(.9)", opacity: 0 },
          ];
    el.animate(anim, { duration: B.ui.coinPopMs, easing: "cubic-bezier(.3,.7,.4,1)" }).onfinish = () => {
      el.remove();
      if (delta > 0) bump(moneyEl);
    };
    if (delta > 0) audio?.coin?.();
  }

  // An item icon arcs from a world point to its hotbar slot.
  function fly(x, y, icon, target) {
    if (!target) return;
    const el = document.createElement("div");
    el.className = "fly";
    el.innerHTML = icon;
    el.style.left = x + "px";
    el.style.top = y + "px";
    fx.append(el);
    const to = center(target);
    const mx = (x + to.x) / 2,
      my = Math.min(y, to.y) - 90;
    el.animate(
      [
        { transform: "translate(-50%,-50%) scale(.4)", opacity: 0 },
        { transform: `translate(calc(-50% + ${mx - x}px), calc(-50% + ${my - y}px)) scale(1.2)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${to.x - x}px), calc(-50% + ${to.y - y}px)) scale(.7)`, opacity: 0.9 },
      ],
      { duration: 650, easing: "cubic-bezier(.4,0,.3,1)" },
    ).onfinish = () => {
      el.remove();
      bump(target, "got");
    };
    audio?.pop?.();
  }

  function flourish(icons) {
    const el = document.createElement("div");
    el.className = "flourish";
    el.innerHTML = `<div class="rays"></div><div class="disc"><div class="pair">${icons.map((ic, i) => `<span class="ico${i ? " small" : ""}">${ic}</span>`).join("")}</div></div>`;
    fx.append(el);
    const colors = ["#e3bf73", "#cf8273", "#8fae7e", "#a993cf", "#78a9b0", "#fff3d9"];
    for (let i = 0; i < 46; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.background = colors[i % colors.length];
      c.style.left = "50%";
      c.style.top = "42%";
      fx.append(c);
      const a = Math.random() * Math.PI * 2,
        r = 140 + Math.random() * 260;
      c.animate(
        [
          { transform: "translate(-50%,-50%) rotate(0deg)", opacity: 1 },
          { transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r * 0.75 + 140}px) rotate(${720 * (Math.random() - 0.5)}deg)`, opacity: 0 },
        ],
        { duration: 1500 + Math.random() * 900, easing: "cubic-bezier(.15,.7,.4,1)", delay: 120 },
      ).onfinish = () => c.remove();
    }
    setTimeout(() => el.remove(), B.ui.flourishMs);
    audio?.fanfare?.();
  }

  return { coinPop, fly, flourish, shake, bump, center, fx };
}
