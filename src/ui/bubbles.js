// Floating request bubbles: animal food/water needs (urgent ones pulse warm red),
// ripe or dry beds, and the original ambient affection/koi bubbles.
import { NIGHT_ICONS as N } from "./night-icons.js";
import { ICONS, itemIcon } from "./icons.js";
import { BALANCE as B } from "../config/balance.js";
import { needsOf, plotStage, foodsFor, isPenned, layout } from "../sim/index.js";

const { footprintCenter, footprintOf, plotPosition } = layout;
const HEIGHT = { chicken: 1.1, cow: 1.75, horse: 2.05 };
const foodIcon = (sp) => itemIcon(foodsFor(sp)[0]);

export function createBubbles({ G, game, bridge, screen, onAnimal, onBed, onAmbient }) {
  const layer = document.querySelector("#needs");
  const els = new Map();

  function element(id, html, cls, handlers) {
    let e = els.get(id);
    if (!e) {
      e = document.createElement("div");
      e.className = "bubble";
      layer.append(e);
      els.set(id, e);
    }
    if (e.dataset.html !== html) {
      e.dataset.html = html;
      e.innerHTML = html;
      e.querySelectorAll("button").forEach((b) => {
        b.onclick = (ev) => {
          ev.stopPropagation();
          G.startAudio();
          handlers[b.dataset.act]?.(b, e);
        };
      });
    }
    e.className = "bubble " + cls;
    e.seen = true;
    return e;
  }

  function position(e, x, y, h, bob) {
    const p = screen(x, y, h);
    e.style.visibility = p.visible === false ? "hidden" : "visible";
    e.style.left = p.x + "px";
    e.style.top = p.y + Math.sin(G.world.elapsed * 2 + bob) * 3 + "px";
  }

  function update() {
    for (const e of els.values()) e.seen = false;
    const s = game.state;
    for (const a of s.animals) {
      if (a.state !== "alive") continue;
      const n = needsOf(a);
      if (!n.hungry && !n.thirsty && !a.injured) continue;
      const agent = bridge.agentOf(a.id);
      if (!agent) continue;
      const hidden = agent.sheltered || agent.sleeping;
      const at = agent.sheltered ? agent.home.door : agent.sleeping && !agent.simMotion ? { x: agent.home.x + ((agent.sleepSlot % 4) - 1.5) * 26, y: agent.home.y - 30 } : agent;
      const html = (a.injured ? `<span class="injured ico">${N.bandage}</span>` : "") + (n.hungry ? `<button data-act="food" aria-label="Feed">${foodIcon(a.sp)}</button>` : "") + (n.thirsty ? `<button data-act="water" aria-label="Water">${ICONS.drop}</button>` : "");
      const e = element("a" + a.id, html, (n.unmet >= B.neglect.deathDays*B.time.cycleSeconds*.70 ? "urgent" : n.unmet >= B.neglect.deathDays*B.time.cycleSeconds*.30 ? "warning" : "") + (hidden ? " small" : ""), {
        food: (b, el) => onAnimal(a.id, "food", b, el),
        water: (b, el) => onAnimal(a.id, "water", b, el),
      });
      position(e, at.x, at.y, (HEIGHT[a.sp] ?? 1.2) * (agent.juvenile ? 0.75 : 1) * (hidden ? 0.8 : 1), a.id);
    }
    if(game.clock.hour>=B.coop.callHour||game.clock.hour<6){
      const chickens=s.animals.filter(a=>a.sp==='chicken'&&a.state==='alive');
      if(chickens.length){const inside=chickens.filter(a=>a.indoors).length;
        for(const coop of [{id:null,x:layout.BASE_COOP.x,y:layout.BASE_COOP.y},...s.buildings.filter(b=>b.type==='coop').map(b=>({id:b.id,...layout.frontOf(b)}))]){
          const html=`<button data-act="inside" aria-label="Call chickens into coop">${inside===chickens.length?ICONS.moon:ICONS.hen}<span class="coop-arrow">${N.arrow}</span>${ICONS.coop}<span class="coop-count">${inside}/${chickens.length}</span></button>`;
          const e=element('coop-call'+coop.id,html,'coop-call '+(inside===chickens.length?'settled':'calling'),{inside:()=>game.act('callChickensIn')});position(e,coop.x,coop.y,2.15,0);
        }
      }
    }
    if(['fence','gate'].includes(game.state.ui.tool)){
      const vertices=new Map();for(const f of s.fences??[]){if(f.gate&&f.open)continue;for(const [gx,gy]of[[f.gx,f.gy],[f.gx+(f.axis==='h'?1:0),f.gy+(f.axis==='v'?1:0)]]){const key=`${gx},${gy}`;const v=vertices.get(key)??{gx,gy,n:0};v.n++;vertices.set(key,v);}}
      const ends=[...vertices.values()].filter(v=>v.n===1);if(ends.length>=2){const a=ends[0],b=ends[1];const e=element('pen-gap',`<span class="ico">${N.brokenLink}</span>`,'small pen-gap',{});position(e,(a.gx+b.gx)*20,(a.gy+b.gy)*20/1.65,.65,0);}
      for(const b of s.buildings){const at=layout.frontOf(b);if(isPenned(s,at.approach))continue;const e=element('pen-suggest'+b.id,`<span class="ico">${N.fence}</span>`,'small pen-suggestion',{});position(e,at.x,at.y,2.9,b.id);}
    }
    for (const bed of s.beds) {
      const ripe = bed.plots.find((p) => plotStage(p) === 2);
      const dry = bed.plots.some((p) => p.crop && plotStage(p) < 2 && p.w <= 0);
      if (!ripe && !dry) continue;
      const html = (ripe ? `<button data-act="harvest" aria-label="Harvest">${itemIcon(ripe.crop === "wheat" ? "hay" : ripe.crop)}</button>` : "") + (dry ? `<button data-act="water" aria-label="Water">${ICONS.drop}</button>` : "");
      const e = element("b" + bed.id, html, ripe ? "ripe" : "", {
        harvest: (b, el) => onBed(bed.id, "harvest", b, el),
        water: (b, el) => onBed(bed.id, "water", b, el),
      });
      const [w, h] = footprintOf("bed");
      const c = footprintCenter(bed.gx, bed.gy, w, h);
      position(e, c.x, c.y - 18, 0.95, bed.id);
    }
    for (const n of G.world.needs) {
      if (n.target.dead || n.target.sleeping) continue;
      const id = "n" + (n.id ??= Math.random().toString(36).slice(2));
      const html = `<button data-act="go" aria-label="Care">${n.kind === "heart" ? ICONS.heart : ICONS.fishfood}</button>`;
      const e = element(id, html, "small", { go: () => onAmbient(n) });
      position(e, n.target.x, n.target.y, n.target.koi ? 1.2 : 1.05, 0.5);
    }
    for (const [id, e] of els)
      if (!e.seen) {
        e.remove();
        els.delete(id);
      }
  }

  return { update, els };
}

export { plotPosition };
