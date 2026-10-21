// Animal views: picks the downloaded model for species/sex/age, and shows
// juvenile growth, sadness, the collapse into a dead pose and sleeping hens.
import * as THREE from "three";
import { model, play, playOnce, softTone, batchFlatRig } from "../../assets.js";
import { BALANCE as B } from "../config/balance.js";

export const HEN_COATS = [
  { "Brown fur": "#e8d9bc", "Bread crust": "#d5ba8e", "Comb red": "#c57866", Beak: "#e3bf73" },
  { "Brown fur": "#a66c4c", "Bread crust": "#c28e62", "Comb red": "#b85f50", Beak: "#dfb76b" },
  { "Brown fur": "#66726e", "Bread crust": "#8b9690", "Comb red": "#c78470", Beak: "#dec585" },
  { "Brown fur": "#d2b477", "Bread crust": "#e6ce98", "Comb red": "#c87d69", Beak: "#dba959" },
];
const ROOSTER_COAT = { "Brown fur": "#a76543", "Bread crust": "#536f65", "Comb red": "#c46656", Beak: "#e3bd72" };
const CHICK_COAT = { "Brown fur": "#f0d78e", "Bread crust": "#e3bf70", Beak: "#d8a356" };
const HORSE_COATS = {
  f: [
    { Main: "#b97f57", Main_Dark: "#8e5d3e", Hair: "#5b3d2b", Main_Light: "#d9b28c" },
    { Main: "#d8b77f", Main_Dark: "#b8945e", Hair: "#f1e6cb", Main_Light: "#efdcb5" },
    { Main: "#cfc8bb", Main_Dark: "#aaa293", Hair: "#efe9dd", Main_Light: "#e9e3d7" },
    { Main: "#a7714d", Main_Dark: "#7c5136", Hair: "#2f2722", Main_Light: "#cfa27c" },
  ],
  m: [
    { Main: "#5e4234", Main_Dark: "#3f2c23", Hair: "#211b17", Main_Light: "#8d6b56" },
    { Main: "#6f4b37", Main_Dark: "#4b3125", Hair: "#2a201b", Main_Light: "#9c785f" },
    { Main: "#4d4a48", Main_Dark: "#353331", Hair: "#1f1d1c", Main_Light: "#8a8682" },
    { Main: "#7a5440", Main_Dark: "#55392b", Hair: "#e9dfcd", Main_Light: "#a9846b" },
  ],
};
const COW_TINTS = ["#ffffff", "#f3e1cc", "#e7d3c3", "#fff4e6"];

function spec(agent, isChicken) {
  if (isChicken) {
    if (agent.juvenile) return { type: "chick", name: "chicken-pixor", height: 0.44, opts: { recolor: CHICK_COAT } };
    const rooster = agent.sex === "m";
    return { type: rooster ? "rooster" : "hen", name: "chicken-pixor", height: rooster ? 0.82 : 0.69, opts: { recolor: rooster ? ROOSTER_COAT : HEN_COATS[(agent.breed ?? 0) % HEN_COATS.length] } };
  }
  if (agent.kind === "cow") {
    const bull = agent.sex === "m";
    return { type: bull ? "bull" : "cow", name: bull ? "bull" : "cow", height: bull ? 1.32 : 1.22, opts: { tint: COW_TINTS[agent.breed ?? 0] } };
  }
  return { type: "horse", name: "horse", height: agent.sex === "m" ? 1.7 : 1.6, opts: { recolor: HORSE_COATS[agent.sex ?? "f"][agent.breed ?? 0] } };
}

export function createAnimalRenderer(ctx) {
  const { group, world, Farm, logical, henUniform, burst } = ctx;
  const views = new Map();
  let now = 0;

  function make(agent, isChicken, fish = false) {
    const s = fish ? { type: "fish", name: "animal-fish", height: 0.48, opts: {} } : spec(agent, isChicken);
    const o = model(s.name, { height: s.height, ...s.opts });
    if (isChicken) {
      // Matching life stages retain the downloaded rounded hen's silhouette.
      // The baby has no comb; a rooster has a fuller comb and taller tail.
      const comb = o.getObjectByName("Hen_comb") ?? o.getObjectByName("Hen comb");
      if (comb) {
        if (s.type === "chick") comb.visible = false;
        else if (s.type === "rooster") comb.scale.set(1.12, 1.3, 1.12);
      }
      const tail = o.getObjectByName("Hen_tail") ?? o.getObjectByName("Hen tail");
      if (tail && s.type === "rooster") tail.scale.set(1.2, 1.25, 1.25);
      const legL = o.getObjectByName("LegL") ?? o.getObjectByName("Leg.L");
      const legR = o.getObjectByName("LegR") ?? o.getObjectByName("Leg.R");
      o.userData.chickenLegs = [legL, legR].filter(Boolean).map((bone) => ({ bone, rotation: bone.rotation.clone() }));
      o.userData.chickenHead = o.getObjectByName("Head");
    }
    if(!fish&&(!isChicken||(!agent.juvenile&&agent.sex!=="m")))batchFlatRig(o);
    group.add(o);
    const view = { o, type: s.type, chicken: isChicken, fish, born: now, deadAt: null, dimmed: 0, collapsed: false };
    o.userData.agent = agent;
    views.set(agent, view);
    return view;
  }

  function remove(agent) {
    const v = views.get(agent);
    if (!v) return;
    group.remove(v.o);
    v.o.userData.mixer?.stopAllAction();
    views.delete(agent);
  }

  function update(dt) {
    now += dt;
    const t = world.elapsed;
    const live = new Set([...world.chickens, ...Farm.animals, ...world.koi]);
    for (const a of [...views.keys()]) if (!live.has(a)) remove(a);
    for (const a of world.koi) if (!views.has(a)) make(a, false, true);
    let hen = 0;
    for (const a of [...world.chickens, ...Farm.animals]) {
      const chicken = world.chickens.includes(a);
      let v = views.get(a);
      const wanted = spec(a, chicken).type;
      if (v && v.type !== wanted) {
        // A chick has grown into a hen or rooster: swap models under a feather puff.
        burst(a.x, a.y - 12, "feather");
        remove(a);
        v = null;
      }
      if (!v) v = make(a, chicken);
      const o = v.o,
        base = o.userData.baseScale;
      const moving = a.simMotion ? a.moving : chicken ? a.path.length > 0 : a.moving;
      o.position.copy(logical(a.x, a.y, a.roostHeight??0));
      o.visible = !(a.bones || a.sheltered || (a.mode === "waking" && a.wakeDelay > 0));
      const juvenileScale = a.juvenile ? (chicken ? 0.66 + 0.34 * (a.age ?? 0) : 0.5 + 0.5 * (a.age ?? 0)) : 1;
      const pop = Math.min(1, (now - v.born) / B.ui.popInSeconds);
      const popScale = a.popIn ? 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2) : 1;
      if (pop >= 1) a.popIn = false;

      if (a.dead) {
        // Collapse: the downloaded death clip plays once and holds, colour softens.
        if (v.deadAt === null) {
          v.deadAt = now;
          const fresh = a.diedRecently;
          const ok = playOnce(o, "death");
          if (!fresh) o.userData.mixer?.update(10);
          if (!ok) v.noClip = true;
          v.dimFrom = fresh ? 0 : 1;
        }
        const u = Math.min(1, v.dimFrom + (now - v.deadAt) / B.ui.collapseSeconds);
        if (Math.abs(u - v.dimmed) > 0.02 || (u === 1 && v.dimmed !== 1)) {
          softTone(o, v.cream ?? 0, 0.55 * u);
          v.dimmed = u;
        }
        if (v.noClip) o.rotation.z = (Math.PI / 2) * (1 - Math.pow(1 - u, 3)); // chicks tip onto their side
        o.scale.setScalar(base * juvenileScale);
        if (!v.mixerDone) {
          o.userData.mixer?.update(dt);
          if (now - v.deadAt > 3) v.mixerDone = true;
        }
        continue;
      }
      // Calves and foals: the adult model, smaller and softly lighter.
      if (!chicken) {
        const cream = a.juvenile ? 0.38 * (1 - (a.age ?? 0)) : 0;
        const injuredGrey = a.injured ? .18 : 0;
        if (Math.abs(cream - (v.cream ?? -1)) > 0.015 || injuredGrey !== v.injuredGrey) {
          softTone(o, cream, injuredGrey);
          v.cream = cream;
          v.injuredGrey = injuredGrey;
        }
      }
      if (a.sleeping) {
        const home = a.home ?? world.coop;
        if (!a.simMotion) o.position.copy(logical(home.x + ((a.sleepSlot % 4) - 1.5) * 26, (home.y ?? home.door.y) - 30, 0));
        o.scale.set(base * juvenileScale, base * juvenileScale * 0.65, base * juvenileScale);
      } else {
        const squash = a.pet ? Math.sin(a.pet * 12) * 0.06 : 0;
        const s = base * juvenileScale * popScale;
        o.scale.set(s * (1 + squash), s * (1 - squash) * (a.sad ? 0.88 : 1), s);
      }
      const angle = a.simMotion && Number.isFinite(a.heading) ? Math.PI / 2 - a.heading : chicken ? (a.path.length ? Math.atan2(a.path[0].x - a.x, (a.path[0].y - a.y) * 1.65) : (a.dir * Math.PI) / 2) : (a.dir * Math.PI) / 2;
      o.rotation.y += Math.atan2(Math.sin(angle - o.rotation.y), Math.cos(angle - o.rotation.y)) * (1 - Math.exp(-dt * 7));
      o.rotation.x = a.sad ? (chicken ? 0.38 : 0.12) : 0; // drooped posture
      o.rotation.z = a.injured && moving ? Math.sin(t * 7 + (a.phase ?? 0)) * .045 : 0;
      if (a.injured && moving) o.position.y += Math.max(0, Math.sin(t * 7 + (a.phase ?? 0))) * .025;
      const mixer = o.userData.mixer;
      if (mixer) mixer.timeScale = a.sad ? 0.45 : 1;
      if (chicken) {
        const pecking = !moving && !a.sleeping && (a.mode === "feeding" || a.mode === "drinking");
        play(o, pecking ? "peck" : "idle");
      } else play(o, moving ? ((a.boltUntil ?? 0) > world.elapsed ? "gallop" : "walk") : a.eating ? "eating" : a.sad ? "idle_headlow" : "idle");
      a.shake = Math.max(0, (a.shake ?? 0) - dt);
      v.clipTime=(v.clipTime??0)+dt;
      const far=ctx.getQuality?.()==='low'&&ctx.camera&&o.position.distanceTo(ctx.camera.position)>9;
      if(!far||v.clipTime>.085){mixer?.update(v.clipTime);v.clipTime=0;}
      if (chicken) {
        // The chosen CC0 hen includes a peck clip. Its existing leg bones get a
        // restrained alternating gait; no extra object geometry is generated.
        const last=v.lastPosition??{x:a.x,y:a.y};const travelled=Math.hypot(a.x-last.x,(a.y-last.y)*1.65)/50;
        v.walkPhase=(v.walkPhase??a.phase??0)+travelled*24;v.lastPosition={x:a.x,y:a.y};
        const gait=moving&&!a.sleeping?Math.sin(v.walkPhase)*.24:0;
        if(moving){o.rotation.z+=Math.sin(v.walkPhase)*.035;o.position.y+=Math.abs(Math.sin(v.walkPhase))*.012;}
        for (let i = 0; i < o.userData.chickenLegs.length; i++) {
          const { bone, rotation } = o.userData.chickenLegs[i];
          bone.rotation.x = rotation.x + gait * (i ? -1 : 1);
        }
      }
      if (chicken && !a.sleeping) {
        if (hen < henUniform.value.length) henUniform.value[hen++].copy(o.position);

      }
    }
    for (; hen < henUniform.value.length; hen++) henUniform.value[hen].set(999, 0, 999);
    for (const a of world.koi) {
      const o = views.get(a).o;
      o.position.copy(logical(a.x, a.y, -0.41));
      const angle = -a.angle + Math.PI / 2;
      o.rotation.y += Math.atan2(Math.sin(angle - o.rotation.y), Math.cos(angle - o.rotation.y)) * (1 - Math.exp(-dt * 7));
      o.rotation.z = Math.sin(t * 3 + a.phase) * 0.06;
      play(o, "walk");
      o.userData.mixer?.update(dt);
    }
  }

  return { update, views, objectOf: (agent) => views.get(agent)?.o };
}
