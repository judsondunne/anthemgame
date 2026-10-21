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
    positionClock += realDt;
    if (positionClock >= B.save.positionSyncSeconds) {
      positionClock = 0;
      const list = [];
      for (const [id, agent] of agents) if (!agent.dead && !agent.sleeping && !agent.sheltered) list.push({ id, x: agent.x, y: agent.y });
      setPositions(s, list);
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

  return { sync, reset, agentOf: (id) => agents.get(id), agents };
}
