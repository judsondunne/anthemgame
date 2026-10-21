// Two interchangeable stores for the one save document: Vercel Blob in
// production, and a file-backed mock with the same ETag semantics for local runs.
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const SAVE_PATHNAME = "farm/save.json";

export function blobStore(env = process.env) {
  if (!env.BLOB_READ_WRITE_TOKEN) return null;
  const access = env.BLOB_ACCESS === "public" ? "public" : "private";
  let sdk;
  const load = async () => (sdk ??= await import("@vercel/blob"));
  return {
    async read() {
      const { get } = await load();
      const r = await get(SAVE_PATHNAME, { access, useCache: false });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      const text = await new Response(r.stream).text();
      return { data: JSON.parse(text), etag: r.blob.etag };
    },
    async write(data, etag) {
      const { put, BlobPreconditionFailedError } = await load();
      try {
        await put(SAVE_PATHNAME, JSON.stringify(data), {
          access,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
          cacheControlMaxAge: 60,
          ...(etag ? { ifMatch: etag } : {}),
        });
        return true;
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) return false;
        throw e;
      }
    },
  };
}

// Mock of Blob storage for local servers and tests: one JSON file, ETag = hash.
export function fileStore(dir) {
  const file = path.join(dir, SAVE_PATHNAME);
  const etagOf = (text) => createHash("sha1").update(text).digest("hex");
  return {
    file,
    async read() {
      try {
        const text = await fs.readFile(file, "utf8");
        return { data: JSON.parse(text), etag: etagOf(text) };
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async write(data, etag) {
      const cur = await this.read();
      if (etag && cur?.etag !== etag) return false;
      if (!etag && cur) return false;
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + "." + process.pid + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(data));
      await fs.rename(tmp, file);
      return true;
    },
  };
}
