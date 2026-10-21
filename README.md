# Chicken Garden — Three.js rebuild

Install Node.js 22+ dependencies with `npm install`, then `npm run dev`. Open the local URL printed by Vite. Production: `npm run build`, then `npm run preview`. The garden silently fades in after its first real WebGL frame. It has no visible text or toolbar.

Tap an animal to pet it, a flower to water it, the pond to feed fish, or open lawn to scatter grain. Tap icon bubbles for their exact contextual care. Swipe horizontally, scroll horizontally, or hold Left/Right to visit cows and horses. Eggs can be collected by tapping them. Feeding, age progression, births, flock navigation and saved XP use the existing simulation.

Keyboard: 1 grain, 2 water, 3 fish food, 4/Escape affection, D day/night, M mute, R optional YouTube album streaming, L private local audio files. Local ambient audio starts on the first garden gesture. Streaming contacts YouTube only on explicit R; its playback depends on the remote service and browser policy. Audio sources are not downloaded.

Verification hooks: `?time=7`, `?time=12`, `?time=18`, `?time=19.5`, `?time=23` freeze the requested hour without altering the original simulation's day/night boundaries. `?needs=1` forces one chicken, one pond and one plant bubble. `?seed=42` seeds layout randomness. `?quality=low|high` selects initial quality; sustained slow frames automatically reduce grass/shadow resolution/DPR and disable bloom. Optional `?close=house|pond|chickens` is for evidence captures. No hook creates visible UI.

Sources/licenses/triangle counts: ASSETS.md. Current visual inventory: INVENTORY.md. Asset comparisons and compromises: SOURCING.md. Verification evidence and measurements: verification/REPORT.md.

Run `npm run dev -- --port 8082`, then `npm run verify` in another terminal for the deterministic checks. Tests use installed Chrome through Playwright. Additional capture, extended-farm and asset-audit commands are in verification/REPORT.md. Physical phone performance remains unmeasured; forced software WebGL is much slower than the hardware-backed browser run.
