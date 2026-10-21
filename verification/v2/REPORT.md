# Farm economy verification (v2)

Branch `claude/farm-economy`. Browser: Playwright's bundled headless **Chromium 156** (`channel: "chromium"`) launched with `--enable-webgl --enable-unsafe-swiftshader --ignore-gpu-blocklist`. On this Mac (Apple M2 Pro) that configuration renders WebGL through ANGLE/Metal on the GPU, with SwiftShader permitted as fallback; a separate forced-SwiftShader run is reported for transparency. Server: `scripts/serve.js` serving the production build (`npm run build`) plus `/api/state` backed by a **file mock of Vercel Blob** (same handler as the Vercel function; no real Blob credentials exist in this environment).

Run everything: `npm run build && npm run verify`.

<!-- RESULTS -->
