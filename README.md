# Chicken Garden

Open `index.html` to play the garden locally. For the YouTube soundtrack, run `python3 -m http.server 8080` from this folder and open http://localhost:8080. No build or installation is needed. YouTube requires an internet connection; all garden artwork is generated locally.

The welcome card says **Welcome to the Chicken Garden!**, followed by this exact sentence:

> make sure your sound is up and take a second and relax :)

Continue starts the game and requests playback directly within the click gesture. The player prepares silently while the card is visible and always stays offscreen. The playlist contains 13 album-audio uploads from Gregory Alan Isakov's _The Weatherman_. No recordings are downloaded or included in the repository. A quiet original Web Audio soundtrack is available if streaming fails.

## Playing

The centered toolbar contains chicken grain, a watering can, fish food, affection, a day/night toggle, and mute. Keyboard shortcuts: **1–4** select care tools; **D** changes day/night; **Escape** returns to affection. The small controls at the top right retry music or select a private local audio playlist.

- **Grain:** tap open lawn. All awake chickens walk to the scattered feed, following paths around the garden's ground footprints.
- **Water:** tap or drag over flowers. Each watering gradually increases their size, with a gentle maximum so the beds stay readable.
- **Fish food:** tap the pond. All five koi swim to the pellets and nibble around the feeding point.
- **Affection:** tap a chicken to pet it. Floating need bubbles also support contextual care.
- **Night:** the scene transitions into darkness, all seven chickens hurry to the coop, and their sleeping poses and little Zs appear inside. Morning lets them emerge one by one and resume wandering.

A natural day lasts about seven minutes. Using the toggle holds the chosen time. There are no scores, penalties, or failure states. The garden and sound pause when hidden. Local music files stay on the computer and must be selected again after reload.

## Rendering and scale

`geometry.js` defines one orthographic camera (28° yaw, 35° elevation). The cottage, coop, fencing, and beds are constructed from actual width, depth, and height coordinates; their walls, roofs, windows, posts, and floors share that camera. Garden plants sit on the projected soil surface. Ground anchors and contact shadows use the actual visible foot position rather than the transparent bounds of an image.

The camera math and caching approach were informed by the official [Three.js orthographic camera documentation](https://threejs.org/docs/pages/OrthographicCamera.html) and [PixiJS cache-as-texture guidance](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture). The implementation renders these models into double-resolution Canvas sprites, preserving the buildless, local-file workflow without a runtime library dependency.

The chickens and butterflies keep their original illustrated style. The terrain, mountain layers, time-of-day lighting, fireflies, pond, and small care effects are animated on one main canvas. Retina DPR is capped at 2. Phone, tablet, and landscape layouts keep the interactive parts of the garden in view.

## Files

- `index.html`, `style.css`: welcome card, centered care toolbar, music controls, and responsive presentation.
- `sprites.js`, `art.js`: shared drawing helpers, palette, chickens, flowers, foliage, and detail sprites.
- `geometry.js`: shared 3D projection and cached cottage, coop, beds, fences, and sleeping chickens.
- `entities.js`, `navigation.js`: care, growth, fish steering, flock behavior, bedtime, day cycle, and obstacle-aware navigation.
- `landscape.js`, `renderer.js`: Vermont-inspired backdrop, canvas composition, ground anchors, lighting, and animations.
- `input.js`, `audio.js`, `youtube.js`: pointer/keyboard tools, generated ambience, private audio files, and YouTube playback.

## Verification

Current screenshots and results are in `verification/complete/`. Earlier visual passes remain in the other verification folders. Tests use Playwright with Chrome; set `PLAYWRIGHT_PATH` to the installed Playwright module if it is outside this checkout and start the local server on port 8080.

The current feature test covers the exact welcome sentence, silence before Continue, immediate music playback after Continue, all seven chickens gathering at grain, all five koi approaching fish food, incremental flower growth, full-flock bedtime and morning release, mute, hidden video, touch tools, centered controls, phone coop framing, DPR, and frame timing. Separate playback checks exercise both an immediate Continue click and a click after the player is ready in a fresh browser profile.

Visual review includes the house and its ground contact, aligned garden beds, tree/fence placement, toolbar, sleeping coop, morning/noon/sunset/dusk/night scenes, and phone/tablet/landscape layouts. `window.Garden` exposes time overrides, need previews, and performance statistics for verification; it is not visible in the game.


## Expanded farm
Arrow keys, horizontal two-finger trackpad scrolling, on-screen arrows, or touch dragging pan between Clover Pasture, Chicken Garden, and Horses. Grain calls cows and horses to their gates; they shelter in their barns at night. Click eggs with any selected tool to collect them. Care and egg collection send XP to the level bar; progress is saved in local storage. Baby chicks, calves, and foals arrive periodically during the day and grow over about 2.5 minutes. Populations are capped to keep the farm calm.

Feed is a stored quantity in each pasture trough: grain adds supply and animals consume it while eating. Feeding XP arrives on the first bite. The contextual feed tool changes to cow feed or hay as the camera moves. Pet cows and horses for hearts, or click them with another care tool to make them trot. Side labels navigate to pastures; chickens can wander higher and visit the koi pond bank for a drink.
