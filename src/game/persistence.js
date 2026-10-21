// Browser persistence: localStorage for instant resume, one JSON document on the
// server (api/state) for reloads across devices and redeploys. Every failure is
// silent; the farm keeps running on whatever storage is available.
import { BALANCE as B } from "../config/balance.js";
import { createState, loadText, loadObject, serialize, toDoc, catchUp } from "../sim/index.js";

const KEYS = {
  main: "farm-save-v2",
  backup: "farm-save-backup",
  corrupt: "farm-save-corrupt",
  conflict: "farm-save-conflict",
  secret: "farm-save-key",
  epoch: "farm-save-epoch",
  legacy: "garden-progress",
};

function readLS(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

async function request(url, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), B.save.requestTimeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: init.keepalive ? undefined : ctl.signal, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class Persistence {
  constructor({ params, onReplace, onFollow }) {
    this.params = params;
    this.onReplace = onReplace; // adopt a newer state from elsewhere
    this.onFollow = onFollow; // leadership changed
    this.sync = !params.has("nosync");
    this.tab = Math.random().toString(36).slice(2);
    this.leader = true;
    this.lastLocal = 0;
    this.lastPush = 0;
    this.pushing = false;
    this.dirtyServer = false;
    this.serverRev = 0;
    this.status = { source: "fresh", server: "unknown", local: "unknown" };
    this.channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("farm-economy") : null;
  }

  // Store a one-time ?k= write key, then strip it (and the other one-shot
  // params, ?fresh and ?time) from the address bar so a reload never repeats them.
  captureKey() {
    const k = this.params.get("k");
    if (k) writeLS(KEYS.secret, k);
    const u = new URL(location.href);
    let changed = false;
    for (const one of ["k", "fresh", "time"])
      if (u.searchParams.has(one)) {
        u.searchParams.delete(one);
        changed = true;
      }
    if (changed) history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    this.key = readLS(KEYS.secret);
  }

  readLocal() {
    const text = readLS(KEYS.main);
    if (text) {
      const r = loadText(text);
      if (r.ok) return r.state;
      // Keep the unreadable copy for recovery, then fall back to the last backup.
      writeLS(KEYS.corrupt, text);
      this.status.local = "corrupt";
      const backup = loadText(readLS(KEYS.backup) ?? "");
      if (backup.ok) return backup.state;
      return null;
    }
    const legacy = readLS(KEYS.legacy);
    if (legacy) {
      const r = loadText(legacy);
      if (r.ok) return r.state;
    }
    return null;
  }

  async readServer() {
    if (!this.sync) return null;
    const r = await request("/api/state");
    if (!r || r.ok === false) {
      this.status.server = r?.status ?? "unreachable";
      return null;
    }
    this.status.server = "ok";
    this.serverRev = r.rev ?? 0;
    if (!r.doc) return null;
    const loaded = loadObject(r.doc);
    if (!loaded.ok) return null;
    loaded.state.rev = r.rev;
    return loaded.state;
  }

  // Choose the newest of local and server saves, apply capped catch-up.
  async load() {
    this.captureKey();
    const fresh = this.params.has("fresh");
    const [local, server] = await Promise.all([fresh ? null : this.readLocal(), fresh ? null : this.readServer()]);
    if (fresh) {
      const old = readLS(KEYS.main);
      if (old) writeLS(KEYS.backup, old);
    }
    if (fresh && this.sync) await this.readServer(); // learn the server revision only
    let state = null;
    if (local && server) {
      state = (server.savedAt ?? 0) > (local.savedAt ?? 0) ? server : local;
      if (state === local) local.rev = Math.max(local.rev, this.serverRev);
      this.status.source = state === server ? "server" : "local";
    } else if (local || server) {
      state = local ?? server;
      this.status.source = local ? "local" : "server";
      if (local) local.rev = Math.max(local.rev, this.serverRev);
    }
    if (!state) {
      const seed = Number(this.params.get("seed"));
      state = createState(Number.isFinite(seed) && this.params.has("seed") ? { seed } : {});
      state.rev = this.serverRev;
      this.status.source = "fresh";
    } else {
      const text = readLS(KEYS.main);
      if (text && loadText(text).ok) writeLS(KEYS.backup, text);
      const away = (Date.now() - (state.savedAt || Date.now())) / 1000;
      this.caughtUp = catchUp(state, away);
    }
    this.listen();
    this.announce(state);
    return state;
  }

  // A newly opened or refocused tab takes over; the previous leader flushes and follows.
  announce(state) {
    this.epoch = (Number(readLS(KEYS.epoch)) || 0) + 1;
    writeLS(KEYS.epoch, String(this.epoch));
    this.claimTime = performance.now();
    this.loadedSeq = state.seq;
    this.acted = false;
    this.channel?.postMessage({ type: "claim", tab: this.tab });
  }

  noteAction() {
    this.acted = true;
  }

  saveLocal(state, { now = false } = {}) {
    if (!this.leader) return false;
    const t = performance.now();
    if (!now && t - this.lastLocal < B.save.localDebounceMs) return false;
    this.lastLocal = t;
    // Only the tab holding the newest leadership epoch may write; a stale tab
    // can never overwrite the farm another tab has taken over.
    if ((Number(readLS(KEYS.epoch)) || 0) > this.epoch) {
      this.leader = false;
      this.onFollow(true);
      return false;
    }
    state.seq++;
    state.savedAt = Date.now();
    const text = serialize(state);
    const ok = writeLS(KEYS.main, text);
    this.status.local = ok ? "ok" : "unavailable";
    this.dirtyServer = true;
    // The document travels with the message: other tabs may see localStorage late.
    this.channel?.postMessage({ type: "saved", tab: this.tab, seq: state.seq, text });
    return ok;
  }

  // Debounced server push; conflicts resolve to the newest document.
  async push(state, { now = false, keepalive = false } = {}) {
    if (!this.sync || !this.key || !this.leader || !this.dirtyServer) return;
    const t = performance.now();
    if (!now && (t - this.lastPush < B.save.serverDebounceMs || this.pushing)) return;
    this.lastPush = t;
    this.pushing = true;
    this.dirtyServer = false;
    const doc = toDoc(state);
    const body = JSON.stringify({ baseRev: state.rev, doc });
    if (body.length > B.save.maxBytes) {
      this.pushing = false;
      return;
    }
    const r = await request("/api/state", {
      method: "PUT",
      keepalive,
      headers: { "content-type": "application/json", "x-save-key": this.key },
      body,
    });
    this.pushing = false;
    if (!r) {
      this.status.server = "unreachable";
      this.dirtyServer = true;
      return;
    }
    this.status.server = r.status ?? (r.ok ? "ok" : "error");
    if (r.ok) {
      state.rev = r.rev;
      this.serverRev = r.rev;
      return;
    }
    if (r.status === "conflict") {
      this.serverRev = r.rev;
      const theirs = r.doc ? loadObject(r.doc) : null;
      if (theirs?.ok && (theirs.state.savedAt ?? 0) > (state.savedAt ?? 0)) {
        writeLS(KEYS.conflict, serialize(state)); // nothing is lost: keep ours aside
        theirs.state.rev = r.rev;
        this.onReplace(theirs.state, "server");
      } else {
        if (theirs?.ok) writeLS(KEYS.conflict, JSON.stringify(r.doc));
        state.rev = r.rev;
        this.dirtyServer = true;
        this.lastPush = 0;
      }
    } else if (r.status !== "unauthorized" && r.status !== "unavailable") this.dirtyServer = true;
  }

  flush(state) {
    if (!this.leader) return;
    this.saveLocal(state, { now: true });
    this.push(state, { now: true, keepalive: true });
  }

  // Single active tab: the most recently focused tab simulates and saves; others mirror.
  claim(state) {
    if (this.leader) return state;
    // Freshest of what localStorage shows and the last broadcast we received.
    const candidates = [loadText(readLS(KEYS.main) ?? ""), loadText(this.latestText ?? "")].filter((r) => r.ok);
    const latest = candidates.sort((a, b) => b.state.seq - a.state.seq)[0];
    let next = state;
    if (latest && latest.state.seq >= state.seq) {
      next = latest.state;
      catchUp(next, (Date.now() - next.savedAt) / 1000);
    }
    this.leader = true;
    this.announce(next);
    this.onFollow(false);
    return next;
  }

  listen() {
    if (!this.channel) return;
    this.channel.onmessage = (e) => {
      const m = e.data;
      if (!m || m.tab === this.tab) return;
      if (m.type === "claim" && this.leader) {
        // Our latest progress was flushed on blur/hide, before the other tab took focus.
        this.leader = false;
        this.onFollow(true);
      } else if (m.type === "saved") {
        this.latestText = m.text;
        const latest = loadText(m.text ?? "");
        if (!latest.ok) return;
        if (!this.leader) this.onReplace(latest.state, "mirror");
        // The old leader's final flush can land just after we took over.
        else if (!this.acted && performance.now() - this.claimTime < 2500 && m.seq > this.loadedSeq) {
          this.loadedSeq = m.seq;
          this.onReplace(latest.state, "handoff");
        }
      }
    };
  }
}

export { KEYS as SAVE_KEYS };
