import { defineConfig } from "vite";
import path from "node:path";
import { handleState } from "./src/server/state-core.js";
import { fileStore } from "./src/server/stores.js";

// Serve /api/state from a local file mock of Vercel Blob during `vite` and
// `vite preview`, so development matches the deployed route.
function farmApi() {
  const store = fileStore(path.resolve(process.env.MOCK_BLOB_DIR || ".data/dev-blob"));
  const env = { SAVE_KEY: process.env.SAVE_KEY ?? "dev-save-key" };
  const mount = (server) => {
    server.middlewares.use("/api/state", async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const out = await handleState({ method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") }, store, env);
      res.writeHead(out.status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(out.body));
    });
  };
  return { name: "farm-api", configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig({
  plugins: [farmApi()],
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: "index.html",
        garden: "three.html",
        contact: "contact.html",
      },
    },
  },
});
