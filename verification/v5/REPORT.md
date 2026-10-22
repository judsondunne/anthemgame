# Quality update verification — 21 October 2026

## Result

- Production build: PASS, zero build errors (`build.txt`).
- Node test suite: **109/109 PASS**, no failures (`unit-results.txt`). This includes growth/stage watering, breeding/maturation, seed-6 wolf arrival, every-night pack scaling, flashlight/bear immunity, pen/coop protection, automatic shelter/capacity, offline safety, migration round trips, economy, inventory, camera/water and deterministic wildlife.
- Asset/topology audit: PASS. 150 total GLBs, all CC0, complete source/path/triangle ledger; 39 new models, 15,725 new source triangles. Every solid object comes from downloaded meshes. Procedural constructors are restricted to terrain/water, grass, sky, particles, lighting volumes and UI ground overlays (`asset-audit.json`).
- Eight-view SwiftShader behavior smoke: PASS with a driver limitation. No application errors, application warnings, failed requests or HTTP errors; no visible letters. Four **SwiftShader GPU “stall due to ReadPixels” performance warnings** remain verbatim in `smoke.json`. The requested strict zero-console-warnings criterion is therefore not met in that software renderer. Tests do not suppress those messages.
- Native Metal recapture: no errors, warnings or failed requests (`revision.json`). The user's original trees were restored after the initial captures; overview/forest/interior images were refreshed for that revision.
- Mobile portrait bounds and landscape inventory scrolling: PASS. 74 total slots, 84px hotbar, no panel overlap, touch scrolling advances 80px (`ui-check.json`).

## Observed rendering/performance

A short headless native Metal sample on an Apple M2 Pro at 1280×800, high quality, DPR 1 measured 17.07ms average (~58.6 fps), p95 16.8ms and 9.37ms CPU render time. Auto fallback was not needed. The original detailed tree models and distant silhouettes are retained at the user's explicit request. This is an overview sample, not a guarantee for all farms/cameras/devices. Physical mobile 30fps was not measured. Chunked instancing, distance culling, shadow limits and automatic quality fallback remain active.

## Screenshot review

All eight screenshots were visually checked. The first capture exposed a global `.empty` selector stretching empty slots and captures taken during UI transitions; those glaring problems were fixed and all eight were recaptured. No repeated art polish loop was performed. The later explicit tree-restoration request prompted only targeted overview/forest/interior recaptures.

1. `01-golden-overview.png`: original property/forest trees restored; compact icon-only hotbar; cottage/coop/pond clear.
2. `02-coop-dusk.png`: downloaded coop/hatch, resident count and icon-only dusk guidance; all starter hens indoors.
3. `03-forest-wildlife.png`: animated forest residents, original tree silhouettes and flowing brook.
4. `04-furnished-interior.png`: living room sofa/chair, lamp, bookshelf, coffee table/books; downloaded solid floor/ceiling close slat/attic gaps.
5. `05-brook-livestock.png`: visible full-sized cow wading in the brook with water interaction.
6. `06-hotbar-backpack.png`: ten hotbar slots and 8×8 backpack, consistent bevels and safe spacing.
7. `07-market-buy.png`: active buy tab, coherent model portraits, prices, quantity stepper. Sell state also checked.
8. `08-wolf-night.png`: visible downloaded wolf, icon-only sighting and flashlight guidance.

The smoke also walked through the front threshold: closed door blocks, interaction opens, player enters; deep water supports buoyancy/underwater tint; wildlife honors tier caps; the live document round-trips through schema 4.

## Compromises and deployment

Kenney Furniture/Fantasy Town modules form the three-room cottage rather than a historically exact Victorian model. Quaternius supplies the authentic coop, forest plants, fireplace/curtains and rigged wildlife. An antlered stag is the stylized elk stand-in; framed decor/clock reuse a downloaded mirror frame with material treatment. Source texture resolution is retained instead of artificial 2K upscaling. All are CC0 and documented in ASSETS.md.

Redeploy client and `/api/state` together for schema 4. Existing Blob store/path and `SAVE_KEY` remain valid; no manual save editing or new environment variable is required. No deployment was performed.

Reproduce: `npm test`, `npm run build`, `npm run audit`, `npm run simulate`, `npm run verify`. The focused UI check uses the dev server on 5183. `npm run verify` launches its own local production server unless `FARM_URL` is supplied. Software-driver warnings are reported separately, never discarded.
