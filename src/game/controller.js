// Owns the simulation state in the browser: ticks it each frame (scaled by
// ?timescale), routes player actions, fans out sim events, and coordinates
// saving, tab leadership and catch-up after the tab was hidden.
import {SharedSession} from './shared-session.js';
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
    this.paused = false;
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
    // The shared command API owns cloud state; the old snapshot uploader stays off.
    this.persist.sync=false;
  }

  async load() {
    this.state = await this.persist.load();
    if(!this.params.has('nosync')){this.shared=new SharedSession(this);await this.shared.load();}
    if (this.params.has("time")) {
      const h = Number(this.params.get("time"));
      if (Number.isFinite(h)) Sim.advanceToHour(this.state, h, { offline: true });
    }
    // Deterministic test fixtures are opt-in URL parameters and render no UI.
    const money=Number(this.params.get("money"));
    if(this.params.has("money")&&Number.isFinite(money))this.state.money=Math.max(0,Math.floor(money));
    for(const spec of (this.params.get("give")??"").split(",")){
      const [key,raw]=spec.split(":"),n=Number(raw);
      if(key&&Number.isInteger(n)&&n>0)Sim.addInventory(this.state,key,Math.min(5000,n));
    }
    if(this.params.get("needs")==="1")for(const a of this.state.animals){a.hunger=Sim.BALANCE.species[a.sp].hungryAfter+1;a.thirst=Sim.BALANCE.species[a.sp].thirstyAfter+1;}
    if(this.params.get("fences")==="demo"){
      Sim.addInventory(this.state,"fence",100);Sim.addInventory(this.state,"gate",1);
      const x0=-22,x1=-12,y0=25,y1=35;
      for(let x=x0;x<x1;x++){Sim.placeFence(this.state,x,y0,"h");Sim.placeFence(this.state,x,y1,"h",x===x0+4);}
      for(let y=y0;y<y1;y++){Sim.placeFence(this.state,x0,y,"v");Sim.placeFence(this.state,x1,y,"v");}
    }
    if(["wolf","bear"].includes(this.params.get("predator"))){
      if(!Sim.clock.isNightAt(this.state.time))Sim.advanceToHour(this.state,21,{offline:true});
      Sim.forcePredator(this.state,this.params.get("predator"),{x:560,y:850});
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
    if ((this.following&&!this.shared?.enabled) || this.paused) return;
    const dt = Math.min(Math.max(0, realDt), B.time.maxFrameSeconds) * this.timescale;
    if (dt > 0) Sim.tick(this.state, dt);
    this.pump();
    this.persist.saveLocal(this.state);
    this.persist.push(this.state);
  }

  // Run a player action against the live state. Refused actions change nothing.
  act(name, ...args) {
    if(this.paused)return {ok:false,reason:"paused"};
    if(!this.shared?.enabled)this.takeOver();
    const fn = Sim[name];
    if (typeof fn !== "function") return { ok: false, reason: "unknown" };
    const r = fn(this.state, ...args);
    this.persist.noteAction();
    this.pump();
    if (r?.ok) {
      this.shared?.enqueue(name,args);
      this.persist.dirtyServer = true;
      this.persist.saveLocal(this.state, {now:true});
    }
    return r;
  }

  // A focused or touched follower tab becomes the one live farm.
  takeOver() {
    if(this.shared?.enabled)return;
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
      if(!this.paused)Sim.catchUp(this.state, (Date.now() - this.hiddenAt) / 1000);
      Sim.drainEvents(this.state);
      this.hiddenAt = null;
      this.emit({ type: "resume" });
    }
  }

  setPaused(value){this.paused=!!value;if(this.paused)this.persist.flush(this.state);this.emit({type:"pause",paused:this.paused});}

  setTimescale(n) {
    this.timescale = Math.min(B.time.maxTimescale, Math.max(0, Number(n) || 0));
  }

  get clock() {
    return Sim.clock.clockOf(this.state.time);
  }
}
