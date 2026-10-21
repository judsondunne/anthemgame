// Keeps the original behaviour agents (A* hens, grazing herds) in step with the
// simulation: one agent per simulated animal, with its home, age and state.
import { BALANCE as B } from "../config/balance.js";
import { housing, needsOf, setPositions, layout } from "../sim/index.js";

const { BASE_COOP, frontOf, footprintCenter, footprintOf } = layout;

export function createBridge(G, game) {
  const { world, Farm } = G;
  const agents = new Map(); // sim id -> agent
  let positionClock = 0;

  function homeOf(b) {
    if (!b) return { x: BASE_COOP.x, y: BASE_COOP.y, door: BASE_COOP.door, approach: BASE_COOP.approach };
    const f = frontOf(b);
    const [w, h] = footprintOf(b.type);
    const c = footprintCenter(b.gx, b.gy, w, h);
    return { x: c.x, y: f.y - 22, door: f.door, approach: f.approach };
  }

  function create(a, night, initial) {
    if (a.sp === "chicken") {
      const agent = G.makeChickenAgent(a.x, a.y, a.var);
      if (initial && night && a.state === "alive") {
        agent.sleeping = true;
        agent.mode = "sleeping";
      }
      world.chickens.push(agent);
      return agent;
    }
    const agent = Farm.makeHerdAgent(a.sp, a.x, a.y);
    agent.breed = a.var;
    Farm.animals.push(agent);
    return agent;
  }

  function sync(realDt, { initial = false } = {}) {
    const s = game.state,
      hs = housing(s),
      night = G.isNight();
    const seen = new Set();
    for (const a of s.animals) {
      seen.add(a.id);
      let agent = agents.get(a.id);
      if (!agent) {
        agent = create(a, night, initial);
        agent.popIn = !initial && a.state === "alive";
        agents.set(a.id, agent);
      }
      const n = needsOf(a);
      agent.simId = a.id;
      agent.sp = a.sp;
      agent.sex = a.sex;
      agent.breed = a.var;
      agent.age = a.age;
      agent.juvenile = a.age < 1;
      agent.home = homeOf(hs.homes.get(a.id) ?? null);
      agent.simThirsty = n.thirsty;
      agent.sad = n.level === "sad";
      agent.injured = !!a.injured; agent.health = a.health; agent.simMotion = true;
      agent.urgent = n.level === "urgent" || n.level === "sad";
      const wasDead = agent.dead;
      agent.dead = a.state !== "alive";
      agent.bones = a.state === "bones";
      if (agent.dead) {
        if (!wasDead) {
          // Pin the remains where the animal actually collapsed.
          setPositions(s, [{ id: a.id, x: agent.x, y: agent.y }], { includeDead: true });
          agent.diedRecently = !initial;
        }
        agent.x = a.x;
        agent.y = a.y;
        agent.sleeping = false;
        agent.path = [];
        agent.mode = "dead";
      }
    }
    for (const [id, agent] of agents)
      if (!seen.has(id)) {
        agents.delete(id);
        const list = agent.sp === "chicken" ? world.chickens : Farm.animals;
        const i = list.indexOf(agent);
        if (i >= 0) list.splice(i, 1);
        world.needs = world.needs.filter((n) => n.target !== agent);
      }
    constrain(realDt);

  }

  // State owns motion: visual-only behaviour can animate and choose poses, but
  // cannot cross a fence, deep water or a building between sim ticks.
  function constrain(dt) {
    for (const a of game.state.animals) {
      const agent = agents.get(a.id); if (!agent) continue;
      const previous = agent.simPrevious ?? {x:a.x,y:a.y};
      const moved = Math.hypot(a.x-previous.x,(a.y-previous.y)*1.65) > .01;
      agent.x=a.x; agent.y=a.y; agent.moving=moved; agent.heading=a.heading;
      agent.simPrevious={x:a.x,y:a.y};
      if (moved) agent.dir=Math.cos(a.heading??0)>=0?1:-1;
      if (agent.sp!=='chicken') agent.sheltered=false;
      else if (Math.hypot(a.x-agent.home.approach.x,(a.y-agent.home.approach.y)*1.65)>70){agent.sleeping=false;agent.sheltered=false;}
      if (a.injured) agent.sad=true;
    }
  }

  // A replaced state (another tab, server conflict) brings different animals.
  function reset() {
    for (const [, agent] of agents) {
      const list = agent.sp === "chicken" ? world.chickens : Farm.animals;
      const i = list.indexOf(agent);
      if (i >= 0) list.splice(i, 1);
    }
    agents.clear();
    world.needs = [];
    sync(0, { initial: true });
  }

  return { sync, constrain, reset, agentOf: (id) => agents.get(id), agents };
}
