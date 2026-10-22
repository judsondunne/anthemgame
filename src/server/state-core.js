// Store-agnostic handler for the single shared save document. Responses are
// always HTTP 200 with a status field so the client (and browser console) stay
// quiet when storage is not configured or a write is refused.
import { timingSafeEqual } from "node:crypto";
import { BALANCE as B } from "../config/balance.js";

const SCHEMA = B.save.schemaVersion;

function keyMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected) return false;
  const a = Buffer.from(given),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseBody(body) {
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  try {
    return JSON.parse(Buffer.isBuffer(body) ? body.toString("utf8") : String(body ?? ""));
  } catch {
    return null;
  }
}

const reply = (body) => ({ status: 200, body });

export async function handleState({ method, headers = {}, body }, store, env = {}) {
  if (!store) return reply({ ok: false, status: "unavailable" });
  try {
    if (method === "GET") {
      const cur = await store.read();
      return reply({ ok: true, status: "ok", rev: cur?.data?.rev ?? 0, savedAt: cur?.data?.savedAt ?? 0, doc: cur?.data?.doc ?? null });
    }
    if (method !== "PUT" && method !== "POST") return reply({ ok: false, status: "method" });
    if (!env.SAVE_KEY) return reply({ ok: false, status: "unavailable" });
    const key = headers["x-save-key"] ?? headers["X-Save-Key"];
    if (!keyMatches(key, env.SAVE_KEY)) return reply({ ok: false, status: "unauthorized" });
    const raw = typeof body === "string" ? body : Buffer.isBuffer(body) ? body.toString("utf8") : JSON.stringify(body ?? null);
    if (raw.length > B.save.maxBytes) return reply({ ok: false, status: "invalid" });
    const msg = parseBody(body);
    const doc = msg?.doc;
    if (!msg || !Number.isInteger(msg.baseRev) || !doc || typeof doc !== "object" || doc.schemaVersion !== SCHEMA || !Array.isArray(doc.animals) || !Array.isArray(doc.beds))
      return reply({ ok: false, status: "invalid" });
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await store.read();
      const rev = cur?.data?.rev ?? 0;
      // Revision counter: a tab holding an older revision cannot overwrite a newer save.
      if (msg.baseRev !== rev) return reply({ ok: false, status: "conflict", rev, doc: cur?.data?.doc ?? null });
      const next = { rev: rev + 1, savedAt: Date.now(), doc };
      const written = await store.write(next, cur?.etag ?? null);
      if (written) return reply({ ok: true, status: "ok", rev: next.rev });
    }
    const cur = await store.read();
    return reply({ ok: false, status: "conflict", rev: cur?.data?.rev ?? 0, doc: cur?.data?.doc ?? null });
  } catch {
    return reply({ ok: false, status: "error" });
  }
}
