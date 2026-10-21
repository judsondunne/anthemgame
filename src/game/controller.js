// Owns the simulation state in the browser: ticks it each frame (scaled by
// ?timescale), routes player actions, fans out sim events, and coordinates
// saving, tab leadership and catch-up after the tab was hidden.
import * as Sim from "../sim/index.js";
import { BALANCE as B } from "../config/balance.js";
import { Persistence } from "./persistence.js";

export class Game {
  constructor(params) {
    this.params = params;
    const ts = Number(params.get("timescale"));
    this.timescale = params.has("timescale") && Number.isFinite(ts) ? Math.min(B.time.maxTimescale, Math.max(0, ts)) : 1;
    this.listeners = new Set();
    this.following = false;
    this.hiddenAt = null;
    this.persist = new Persistence({
      params,
      onReplace: (state, why) => this.replace(state, why),
      onFollow: (following, flush) => {
        if (following && flush) this.persist.flush(this.state);
        this.following = following;
        this.emit({ type: "leader", leader: !following });
      },
    });
  }

  async load() {
    this.state = await this.persist.load();
    if (this.params.has("time")) {
      const h = Number(this.params.get("time"));
      if (Number.isFinite(h)) Sim.advanceToHour(this.state, h, { offline: true });
    }
    Sim.drainEvents(this.state);
    addEventListener("visibilitychange", () => this.visibility(document.hidden));
    addEventListener("pagehide", () => this.persist.flush(this.state));
    addEventListener("blur", () => this.persist.flush(this.state));
    addEventListener("focus", () => this.takeOver());
    return this.state;
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(e) {
    for (const fn of this.listeners) fn(e, this);
  }

  pump() {
    for (const e of Sim.drainEvents(this.state)) this.emit(e);
  }

  frame(realDt) {
    if (this.following) return;
    const dt = Math.min(Math.max(0, realDt), B.time.maxFrameSeconds) * this.timescale;
    if (dt > 0) Sim.tick(this.state, dt);
    this.pump();
    this.persist.saveLocal(this.state);
    this.persist.push(this.state);
  }

  // Run a player action against the live state. Refused actions change nothing.
  act(name, ...args) {
    this.takeOver();
    const fn = Sim[name];
    if (typeof fn !== "function") return { ok: false, reason: "unknown" };
    const r = fn(this.state, ...args);
    this.persist.noteAction();
    this.pump();
    if (r?.ok) this.persist.dirtyServer = true;
    return r;
  }

  // A focused or touched follower tab becomes the one live farm.
  takeOver() {
    if (!this.following) return;
    const next = this.persist.claim(this.state);
    if (next !== this.state) this.replace(next, "claim");
  }

  replace(state, why) {
    Sim.drainEvents(state);
    this.state = state;
    this.emit({ type: "replace", why });
  }

  visibility(hidden) {
    if (hidden) {
      this.hiddenAt = Date.now();
      this.persist.flush(this.state);
      return;
    }
    if (this.following) return this.takeOver();
    if (this.hiddenAt !== null) {
      // Hidden for minutes or hours: capped catch-up, never fatal.
      Sim.catchUp(this.state, (Date.now() - this.hiddenAt) / 1000);
      Sim.drainEvents(this.state);
      this.hiddenAt = null;
      this.emit({ type: "resume" });
    }
  }

  setTimescale(n) {
    this.timescale = Math.min(B.time.maxTimescale, Math.max(0, Number(n) || 0));
  }

  get clock() {
    return Sim.clock.clockOf(this.state.time);
  }
}
