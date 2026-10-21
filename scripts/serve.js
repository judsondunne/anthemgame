// Local production-like server: serves the Vite build and /api/state backed by
// a file mock of Vercel Blob, so reloads and "redeploys" (restarts) can be tested.
//   PORT=8095 SAVE_KEY=dev MOCK_BLOB_DIR=.data/blob node scripts/serve.js
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { handleState } from "../src/server/state-core.js";
import { blobStore, fileStore } from "../src/server/stores.js";

const root = path.resolve(process.env.DIST_DIR || "dist");
const port = Number(process.env.PORT || 8095);
const env = { SAVE_KEY: process.env.SAVE_KEY ?? "dev-save-key" };
const store = process.env.BLOB_READ_WRITE_TOKEN ? blobStore(process.env) : fileStore(path.resolve(process.env.MOCK_BLOB_DIR || ".data/mock-blob"));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".png": "image/png", ".svg": "image/svg+xml" };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/state") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const out = await handleState({ method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") }, store, env);
      res.writeHead(out.status, { "content-type": "application/json", "cache-control": "no-store" });
      return res.end(JSON.stringify(out.body));
    }
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
      const data = await fs.readFile(file);
      res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream", "x-content-type-options": "nosniff" });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`farm server http://127.0.0.1:${port} (store: ${store?.file ?? "vercel blob"})`));
