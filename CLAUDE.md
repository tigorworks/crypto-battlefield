# BTC Battlefield — CLAUDE.md

Live BTC/USDT trade feed visualized as a real-time 3D battle between "buy" and
"sell" armies (Three.js). Buy pressure pushes the front line one way, sell
pressure the other; big trades spawn tanks/helicopters/jets/bombers; huge
trades trigger airstrikes/artillery barrages. Static site, no backend, no
build step — deployed to GitHub Pages as-is on every push to `main`
(`.github/workflows/static.yml` uploads the whole repo).

## Running it locally

No build step. Serve the repo root over HTTP (not `file://`, or textures and
ES module imports won't load) and open `index.html`:

```
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

WebSocket connections to Binance/Gate.io won't work from network-sandboxed
environments — the feed falls back to a dummy simulated trade generator in
that case (`src/feed/market-feed.js`), so the app still renders and runs.

## Structure

```
index.html            thin shell: markup, <link> stylesheets, module entry points
styles/                base.css, boot.css, hud.css, chat.css
src/
├─ config.js           tuning constants (thresholds, palette, unit caps)
├─ main.js             composition root: imports every system, owns the game loop + bootstrap
├─ i18n.js              EN/ID strings + language switch (also wires several cross-module UI refreshes)
├─ boot/boot-screen.js  boot-screen title/quote (loads before three.min.js)
├─ core/                renderer.js (scene/camera/renderer/lights), postfx/bloom.js, assets.js (shared textures/geometry)
├─ world/               field.js (ground/front-line/territory), sky.js (weather/aurora/moon/lightning/shooting star)
├─ entities/            soldiers.js, big-units.js (tank/apc/heli/jet/bomber), airstrike.js
├─ combat/              bullets.js (tracers/muzzle flash/puffs), explosions.js (craters/debris)
├─ fx/juice.js          screen shake, hitstop, floating damage numbers, streaks, flash/slowmo
├─ ui/                  killfeed.js, market-pressure.js, event-ticker.js, moments.js (share card), controls.js
├─ input/               camera.js (cinematic shots/orbit), interaction.js (raycast tap-to-select/rally)
├─ audio/audio.js       generative music + sfx, positional audio
├─ platform/wake-lock.js
└─ feed/market-feed.js  Binance/Gate.io WebSocket + dummy fallback, trade → sim event routing
```

`three.min.js` is loaded as a classic global `<script>` (UMD), not an ES
module — this app depends on a specific locked `three` revision, and no
matching `three.module.js` ESM build is vendored. Module code just reads
`THREE` off the global.

The Firebase online-count/chat feature (`<script type="module">` at the
bottom of `index.html`, around the `ONLINE COUNT & OBROLAN` section) is
separate from `src/` and loads Firebase straight from `gstatic.com` — it's
already self-contained ESM and fails soft if offline.

## Module wiring conventions

This codebase was split (see `redesign-modular.md` for the original plan and
rationale) out of a single ~4,660-line `index.html` where everything lived in
one giant IIFE sharing one scope. The split follows one rule: **each value is
exported once, from the file that owns it, and imported by name wherever
it's used** — no globals, no shared mutable scope.

One wrinkle: ES module imports are *live but read-only* — an importing file
can read an exported `let`, but cannot assign to it (`TypeError: Assignment
to constant variable`). Several values are mutated from files other than
their owner (e.g. the game loop in `main.js` decrementing timers that live in
`fx/juice.js` or `world/sky.js`). For those, the owning file exports a small
mutable **state object** instead of a bare binding, and everyone (including
the owner) accesses it through that object:

- `skyState` (`world/sky.js`) — `mood`, `moodTarget`, `lull`, `lullActive`, `boltT`, `lightningT`, `nextStarCheck`
- `fieldState` (`world/field.js`) — `frontX`, `buyShare`
- `juiceState` (`fx/juice.js`) — `shake`, `hitstop`, `flashV`, `slowmo`
- `camState` (`input/camera.js`) — `cineIdx`, `cineShotStart`
- `interactState` (`input/interaction.js`) — `cheerBias`
- `pressureState` (`ui/market-pressure.js`) — `flowRateEMA`

`buyCrowd`/`sellCrowd` (`entities/soldiers.js`) follow the same idea but as a
function instead of an object: they're created once via `initCrowds()`
(called from `main.js`'s bootstrap) rather than assigned directly from
outside the owning module.

If you add a new piece of state that another module needs to *mutate* (not
just read), follow this pattern — don't export a bare `let` for it.

## What's NOT done from the original plan

- **Event bus decoupling** (redesign-modular.md §4, principle 5): modules
  still call each other directly via imports rather than publish/subscribe.
  The current direct-import wiring is behavior-identical to the original and
  fully explicit, so this is a nice-to-have, not a correctness gap.
- Real network verification of the live feed: sandboxed dev environments
  can't reach Binance/Gate.io, so whale-spawn/killfeed/market-pressure
  behavior driven by *real* trades should get a manual pass with real
  network access before trusting feed-side changes.

## Verifying changes

There's no test suite (it's a real-time visual/audio simulation). Verify with
a headless-browser smoke pass instead:

1. Serve the repo (see above) and load the page in Chromium/Playwright.
2. Console should be clean except WebSocket connection failures if sandboxed.
3. Visually confirm: field/soldiers/HUD render, camera modes (1/2/3 keys or
   the CINEMATIC/FOLLOW/FREE buttons) switch, language toggle (EN/ID)
   updates text, audio mute toggles.
4. Force rare events from the console instead of waiting for real trades:
   `window.__testEvent('airstrike' | 'barrage' | 'streak' | 'star')`.

## Files kept for historical reference

- `index.html.bak` — the pre-refactor monolithic file, kept for diffing.
- `redesign-modular.md` — the original modularization plan this refactor follows.
