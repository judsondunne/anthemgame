// Vercel serverless route: GET/PUT the single shared farm save in Vercel Blob.
// Without BLOB_READ_WRITE_TOKEN it answers { status: "unavailable" } and the
// client stays on localStorage; without SAVE_KEY every write is refused.
import { handleState } from "../src/server/state-core.js";
import { blobStore } from "../src/server/stores.js";

async function readBody(req) {
  if (req.body !== undefined) return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  const body = req.method === "GET" ? undefined : await readBody(req);
  const out = await handleState({ method: req.method, headers: req.headers, body }, blobStore(process.env), process.env);
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-type", "application/json");
  res.status(out.status).send(JSON.stringify(out.body));
}
