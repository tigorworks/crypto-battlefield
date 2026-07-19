# BTC Battlefield — Live

A live BTC/USDT trade feed, visualized as a real-time 3D battle between a
"buy" army and a "sell" army. Buy pressure pushes the front line one way,
sell pressure the other; big trades spawn tanks, helicopters, jets, and
bombers; huge trades trigger airstrikes or artillery barrages. Built with
[Three.js](https://threejs.org/), no framework, no build step.

## Live demo

Deployed to GitHub Pages automatically on every push to `main`
(`.github/workflows/static.yml`).

## Running locally

This is a static site — no `npm install`, no bundler. Serve the repo root
over HTTP (module imports and textures won't load from `file://`) and open
`index.html`:

```sh
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

If your network can't reach Binance/Gate.io (e.g. a sandboxed or offline
dev environment), the badge just shows "DISCONNECTED" and the scene sits
idle — the app still renders and is fully interactive, there just aren't
any trades happening.

## Features

- Live order-flow feed from Binance (falls back to Gate.io on failure, with
  automatic retry) driving buy/sell army size, front-line position, and
  market mood.
- Procedurally built, high-poly soldiers and vehicles (tank, APC,
  helicopter, jet, bomber) — no external 3D model files.
- Dynamic weather/day-night cycle, aurora, lightning, shooting stars, all
  tied to market conditions.
- Killfeed, 60-second market-pressure meter, event ticker for rare events
  (airstrikes, artillery barrages).
- Cinematic/follow/free camera modes, tap-to-select and tap-to-rally.
- Generative background music + sound effects, positional audio.
- Shareable "moment" cards (canvas-rendered snapshot + stats) for big
  trades.
- EN/ID language toggle, fullscreen, wake-lock (keeps the screen on).
- Optional live viewer count + chat via Firebase Realtime Database.

## Project structure

See [`CLAUDE.md`](./CLAUDE.md) for a full breakdown of the `src/` module
layout and the conventions used when wiring modules together (in
particular, how mutable state is shared across ES modules).

```
index.html     thin shell: markup + <link> stylesheets + module entry points
styles/        base.css, boot.css, hud.css, chat.css
src/           the simulation, split into ~25 ES modules by responsibility
```

## History

`index.html` originally held the entire simulation — markup, styles, and a
single ~2,780-line script — in one file. It was split into the current
modular `src/` layout following the plan in
[`redesign-modular.md`](./redesign-modular.md); `index.html.bak` is kept as
a snapshot of the pre-refactor file for reference/diffing.

## License

No license file is currently included in this repository.
