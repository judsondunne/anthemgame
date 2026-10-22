import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { handleState } from "../src/server/state-core.js";
import { fileStore, blobStore } from "../src/server/stores.js";
import { S, fresh } from "./helpers.js";

const env = { SAVE_KEY: "secret-key" };
const put = (store, baseRev, doc, key = "secret-key") =>
  handleState({ method: "PUT", headers: { "x-save-key": key }, body: JSON.stringify({ baseRev, doc }) }, store, env);
const get = (store) => handleState({ method: "GET", headers: {} }, store, env);

test("api: empty store, first write, revision counter, newest wins", async () => {
  const store = fileStore(mkdtempSync(path.join(tmpdir(), "farm-")));
  assert.deepEqual((await get(store)).body, { ok: true, status: "ok", rev: 0, savedAt: 0, doc: null });
  const doc = S.toDoc(fresh());
  const w1 = await put(store, 0, doc);
  assert.deepEqual(w1.body, { ok: true, status: "ok", rev: 1 });
  doc.money = 555;
  assert.equal((await put(store, 1, doc)).body.rev, 2);
  // A tab still holding revision 1 is refused and handed the newer save.
  const stale = { ...doc, money: 1 };
  const c = await put(store, 1, stale);
  assert.equal(c.body.status, "conflict");
  assert.equal(c.body.rev, 2);
  assert.equal(c.body.doc.money, 555);
  const g = await get(store);
  assert.equal(g.body.rev, 2);
  assert.equal(g.body.doc.money, 555, "older tab could not overwrite");
  assert.equal(g.status, 200);
});

test("api: write key is required and compared exactly", async () => {
  const store = fileStore(mkdtempSync(path.join(tmpdir(), "farm-")));
  const doc = S.toDoc(fresh());
  assert.equal((await put(store, 0, doc, "wrong")).body.status, "unauthorized");
  assert.equal((await put(store, 0, doc, null)).body.status, "unauthorized");
  assert.equal((await handleState({ method: "PUT", headers: { "x-save-key": "x" }, body: "{}" }, store, {})).body.status, "unavailable", "no SAVE_KEY means no writes");
  assert.equal((await get(store)).body.doc, null);
});

test("api: malformed, oversized or wrong-schema bodies are rejected", async () => {
  const store = fileStore(mkdtempSync(path.join(tmpdir(), "farm-")));
  const bad = (body) => handleState({ method: "PUT", headers: { "x-save-key": "secret-key" }, body }, store, env);
  assert.equal((await bad("{nope")).body.status, "invalid");
  assert.equal((await bad(JSON.stringify({ baseRev: 0, doc: { schemaVersion: 1, beds: [], animals: [] } }))).body.status, "invalid");
  assert.equal((await bad(JSON.stringify({ baseRev: "0", doc: S.toDoc(fresh()) }))).body.status, "invalid");
  assert.equal((await bad("x".repeat(300000))).body.status, "invalid");
});

test("api: degrades to unavailable without Blob credentials", async () => {
  assert.equal(blobStore({}), null);
  const r = await handleState({ method: "GET", headers: {} }, blobStore({}), env);
  assert.deepEqual(r, { status: 200, body: { ok: false, status: "unavailable" } });
});

test("api: concurrent writers cannot both win the same revision", async () => {
  const store = fileStore(mkdtempSync(path.join(tmpdir(), "farm-")));
  const doc = S.toDoc(fresh());
  await put(store, 0, doc);
  const results = await Promise.all([put(store, 1, { ...doc, money: 10 }), put(store, 1, { ...doc, money: 20 })]);
  const winners = results.filter((r) => r.body.ok);
  assert.ok(winners.length <= 1);
  assert.equal((await get(store)).body.rev, 1 + winners.length);
});
