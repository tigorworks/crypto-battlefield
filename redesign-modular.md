# Redesign: Memodularkan `index.html`

> Dokumen arsitektur — rencana memecah satu berkas `index.html` (±4.660 baris) menjadi
> modul-modul yang terpisah, teruji, dan mudah dirawat, **tanpa mengubah perilaku aplikasi**
> dan **tanpa mengganggu deploy GitHub Pages** yang sekarang.

---

## 1. Ringkasan Eksekutif

`index.html` saat ini menampung **segalanya**: ±1.475 baris CSS, satu boot-script, satu
**IIFE raksasa ±2.780 baris** (146 fungsi, 182 variabel scope-atas, 50 "section"), plus satu
modul Firebase. Semua fungsi berbagi satu lexical scope — inilah sumber utama kekakuan.

**Rekomendasi:** migrasi **bertahap** ke **ES Modules native** (tanpa bundler dulu), dengan
tiga pilar:

1. **Composition root** (`src/main.js`) yang membuat *context* render + *store* state + *event bus*, lalu merangkai semua sistem dan memiliki satu-satunya game loop.
2. **Pola "system"**: tiap domain (langit, prajurit, unit, peluru, audio, feed, UI…) jadi modul `createXSystem(ctx, state, events)` yang mengembalikan `{ update(dt, t) }` + API spesifik.
3. **Arah dependensi searah**: sistem hanya bergantung pada `ctx/state/events` (ke bawah), tidak saling meng-`import` (menghindari siklus). Komunikasi antar-domain lewat *event bus*.

Bundler (**Vite**) ditawarkan sebagai peningkatan opsional di akhir, bukan prasyarat.

---

## 2. Kondisi Saat Ini (Assessment)

| Metrik | Nilai | Implikasi |
|---|---|---|
| Total baris `index.html` | ±4.662 | Satu berkas untuk semua concern |
| CSS inline (`<style>`) | ±1.475 baris | Tak ada pemisahan style/logic |
| IIFE utama | baris 1.673–4.454 (±2.780) | Semua logic di satu scope |
| Deklarasi fungsi di IIFE | **146** | Sulit dinavigasi & diuji satuan |
| `let`/`const` scope-atas IIFE | **182** | **State bersama implisit — akar coupling** |
| "Section" (penanda `═══`) | **50** | Batas modul alami sudah terlihat |
| `getElementById` | 55 | DOM diakses tersebar |
| Modul Firebase (`<script type=module>`) | baris 4.456–4.659 | Sudah ESM & terisolasi (contoh yang baik) |
| Perkakas build | **tidak ada** | Deploy = unggah statis apa adanya (Pages) |

**Diagnosis inti.** Bukan "kode jelek", tapi **semua state hidup di satu scope**. Contoh nyata:
`scene`, `camera`, `renderer`, `bloom`, `frontX`, `mood`, `lull`, `buyCrowd/sellCrowd`,
`units/bullets/sparks/puffs`, `AC` (audio) — semua variabel bebas yang dipakai lintas
"section". Fungsi mana pun bisa menyentuh apa pun. Memodularkan = **mengubah akses scope
implisit menjadi dependensi eksplisit**.

**Yang sudah bagus & harus dipertahankan:**
- Batas "section" sudah rapi (50 penanda `═══`) → peta modul hampir jadi.
- `three.min.js` di-vendor lokal (revisi terkunci) — perilaku deterministik.
- Modul Firebase sudah dipisah & *fail-soft* — teladan pola isolasi.
- Semua karakter kini **prosedural** (tak ada lagi `.glb`/GLTFLoader) → satu-satunya dependensi runtime adalah `THREE` core.

---

## 3. Tujuan & Batasan

**Tujuan**
- Berkas kecil dengan tanggung jawab tunggal; navigasi & review mudah.
- Batas modul jelas; dependensi eksplisit & searah (mudah diuji).
- Setiap langkah migrasi **aman & bisa diverifikasi** (aplikasi tetap jalan).

**Batasan (wajib dijaga)**
- **Perilaku identik** — ini aplikasi produksi yang hidup. Tak boleh ada regresi visual/audio/feed.
- **Deploy GitHub Pages tetap sederhana** (`.github/workflows/static.yml` mengunggah statis saat push ke `main`).
- **Revisi `three` terkunci** — kode bergantung pada API spesifik build ini (mis. `PMREMGenerator`, `ShaderMaterial`, tanpa `outputColorSpace`, geometri tanpa `applyQuaternion`). Ganti versi = risiko.
- **Jangan over-engineer** — tak perlu framework, state-management library, atau ECS penuh. Cukup context + store + event bus ringan.

**Non-Goals**
- Bukan penulisan ulang (*rewrite*) — ini *refactor* bertahap.
- Bukan mengubah gameplay, tuning, atau tampilan.
- Bukan menambah TypeScript di fase awal (boleh menyusul, lihat §11).

---

## 4. Prinsip Arsitektur

1. **Composition root tunggal.** Hanya `main.js` yang "mengetahui" semua sistem dan merangkainya. Modul lain tidak saling kenal.
2. **Context vs State vs Config.**
   - **Context (`ctx`)** — objek yang dibuat sekali: `{ THREE, scene, camera, renderer, bloom, clock }`. Read-mostly.
   - **State (`state`)** — satu store mutable untuk simulasi: `mood, lull, frontX, price, flow, …` + referensi entitas.
   - **Config** — konstanta immutable (thresholds, palet, tuning) → modul `config.js`.
3. **Sistem = fungsi pabrik.** `createSkySystem(ctx, state, events) → { update(dt,t), … }`. Menyimpan state internalnya sendiri (mesh, pool) di closure, mengekspos hanya yang perlu.
4. **Dependensi searah, tanpa siklus.** Sistem → (ctx, state, events, config). Sistem **tidak** meng-`import` sistem lain.
5. **Event bus untuk lintas-domain.** Feed pasar mem-*publish* peristiwa; sistem lain *subscribe*. Ini memutus panggilan langsung antar-section yang sekarang ada.
6. **DOM ter-enkapsulasi.** Tiap modul UI meng-`querySelector` elemennya sendiri; tak ada kamus DOM global.
7. **Loop dimiliki root.** `main.js` menghitung `dt`, memanggil `system.update(dt, t)` berurutan, lalu `bloom.render()`. `tick()` raksasa terurai jadi daftar pemanggilan.

---

## 5. Arsitektur Target

### 5.1 Struktur direktori

```
/
├─ index.html                 # shell tipis: <head>, markup boot, <link> CSS, <script type=module src=src/main.js>
├─ vendor/
│  └─ three.module.js         # build ESM three revisi TERKUNCI (dipetakan via import map)
├─ src/
│  ├─ main.js                 # composition root + game loop (dulu: MAIN LOOP)
│  ├─ config.js               # CONFIG: threshold, palet, MAX_UNITS, tuning
│  ├─ state.js                # store state simulasi (factory createState())
│  ├─ events.js               # event bus mini (on/off/emit)
│  ├─ core/
│  │  ├─ renderer.js          # scene, camera, renderer, cahaya, env map (THREE SETUP + ENV MAP)
│  │  ├─ assets.js            # GLOW & tekstur/geometri bersama (TEXTURES/GEOMETRY BERSAMA)
│  │  └─ postfx/bloom.js      # BLOOM
│  ├─ world/
│  │  ├─ field.js             # lapangan, garis depan, wilayah
│  │  └─ sky.js               # langit, cuaca, aurora, kabut, awan, bulan, petir, bintang jatuh, siang-malam
│  ├─ entities/
│  │  ├─ soldiers.js          # build prajurit high-poly + makeCrowd/updateCrowd/kill/revive
│  │  ├─ big-units.js         # builder whale (tank/apc/heli/jet/bomber) + spawn/update + kontrail/asap
│  │  └─ airstrike.js         # serangan udara + tembakan artileri
│  ├─ combat/
│  │  ├─ bullets.js           # tracer, fireBullet, sparks, kepulan, kilatan moncong
│  │  └─ explosions.js        # ledakan, kawah, puing
│  ├─ fx/
│  │  └─ juice.js             # getar layar, hitstop, angka melayang, streak, flash, slowmo
│  ├─ ui/
│  │  ├─ killfeed.js
│  │  ├─ market-pressure.js
│  │  ├─ event-ticker.js      # KABAR PERISTIWA
│  │  ├─ moments.js           # SHARE MOMENT
│  │  └─ controls.js          # fullscreen, toggle widget, toggle audio
│  ├─ input/
│  │  ├─ camera.js            # mode kamera, orbit, wheel/drag/keys
│  │  └─ interaction.js       # raycast pilih prajurit, tap-ground rally, follow
│  ├─ audio/
│  │  └─ audio.js             # AudioContext, musik 2-lapis, sfx, audio posisional, resume/unmute
│  ├─ platform/
│  │  └─ wake-lock.js         # wake lock + fallback video no-sleep
│  ├─ feed/
│  │  ├─ market-feed.js       # WebSocket Binance/Gate.io + simulasi dummy + reconnect
│  │  └─ trade-router.js      # memetakan trade → aksi simulasi (emit event)
│  ├─ i18n.js                 # I18N EN/ID + ganti bahasa
│  ├─ boot/boot-screen.js     # kutipan boot (dulu script inline pertama)
│  └─ social/firebase-chat.js # online count + chat (sudah ESM)
└─ styles/
   ├─ base.css   ├─ hud.css   ├─ boot.css   └─ chat.css
```

### 5.2 Peta migrasi "section → modul" (ringkas)

| Section (baris) | Modul target |
|---|---|
| CONFIG (1677) | `config.js` |
| THREE SETUP (1688), ENV MAP (1722) | `core/renderer.js` |
| BLOOM (1741) | `core/postfx/bloom.js` |
| TEXTURES/GEOMETRY BERSAMA (1957) | `core/assets.js` |
| LAPANGAN (1803), GARIS DEPAN & WILAYAH (1867) | `world/field.js` |
| LANGIT/CUACA/AURORA/KABUT/AWAN/BULAN-PETIR/BINTANG (1882–1995) | `world/sky.js` |
| PASUKAN/PRAJURIT (2031–2299) | `entities/soldiers.js` |
| UNIT BESAR + DEBU ROTOR + update UNIT (2299–2603) | `entities/big-units.js` |
| SERANGAN UDARA + ARTILERI (2604–2652) | `entities/airstrike.js` |
| TEMBAK-TEMBAKAN + KEPULAN + KILATAN MONCONG (2653–2773) | `combat/bullets.js` |
| LEDAKAN + KAWAH & PUING (2837–2923) | `combat/explosions.js` |
| JUICE (2774), KILAT/GERAK-LAMBAT (2831) | `fx/juice.js` |
| KABAR PERISTIWA (2818) | `ui/event-ticker.js` |
| KILLFEED (2924) | `ui/killfeed.js` |
| TEKANAN PASAR (2969) | `ui/market-pressure.js` |
| AUDIO + TOGGLE AUDIO + AUDIO POSISIONAL (3000–3287) | `audio/audio.js` |
| DATA FEED + SUMBER DATA (3288–3449) | `feed/market-feed.js` + `feed/trade-router.js` |
| CAMERA (3450), LAYAR PENUH (3500), TOGGLE WIDGET (3527) | `input/camera.js` + `ui/controls.js` |
| WAKE LOCK (3540) | `platform/wake-lock.js` |
| INTERAKSI (3627) | `input/interaction.js` |
| MAIN LOOP (3759) | `main.js` |
| BAHASA (4251) | `i18n.js` |
| boot script (1497) | `boot/boot-screen.js` |
| Firebase (4456) | `social/firebase-chat.js` |
| `<style>` (11–1486) | `styles/*.css` |

### 5.3 Menangani 182 state bersama

Kelompokkan, lalu tempatkan:

| Kategori | Contoh sekarang | Ke mana |
|---|---|---|
| **Config immutable** | `T_WHALE`, `MAX_UNITS`, `CROWD_MAX`, palet warna, tuning | `config.js` (export const) |
| **Context render (sekali buat)** | `scene`, `camera`, `renderer`, `bloom`, `sun`, `GLOW`, geometri bersama | `ctx` dari `core/` |
| **State simulasi mutable** | `mood`, `lull`, `frontX`, `price`, `flow`, `flowRateEMA`, `streakCount`, `cheerBias`, `buyCrowd`, `sellCrowd`, `units`, `bullets`, `sparks`, `puffs` | `state` store (dibagikan ke sistem yang butuh) |
| **Referensi DOM** | 55 `getElementById` | di-`querySelector` di modul UI masing-masing |
| **Pool/scratch** | `Vector3`/`Matrix4`/`Quaternion` yang dipakai ulang | modul-lokal (closure), bukan global |

### 5.4 Sketsa kode composition root

```js
// src/main.js
import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { createBloom }    from './core/postfx/bloom.js';
import { createState }    from './state.js';
import { createEvents }   from './events.js';
import { createSky }      from './world/sky.js';
import { createSoldiers } from './entities/soldiers.js';
import { createBigUnits } from './entities/big-units.js';
import { createBullets }  from './combat/bullets.js';
import { createMarketFeed } from './feed/market-feed.js';
// … dst

const ctx    = createRenderer(THREE);          // { scene, camera, renderer, sun, … }
ctx.bloom    = createBloom(ctx);
ctx.THREE    = THREE;
const state  = createState();                  // mood, lull, frontX, pools, …
const events = createEvents();                 // on / off / emit

// tiap sistem menerima context/state/events, mengembalikan { update, …API }
const systems = [
  createSky(ctx, state, events),
  createSoldiers(ctx, state, events),
  createBigUnits(ctx, state, events),
  createBullets(ctx, state, events),
  createExplosions(ctx, state, events),
  createJuice(ctx, state, events),
  /* ui, camera, audio, dst */
];
createMarketFeed(ctx, state, events);          // hanya publish event trade/whale/lull

let prev = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  state.t += dt;
  for (const s of systems) s.update?.(dt, state.t);
  ctx.bloom.render(computeBloomStrength(state));   // dulu di akhir MAIN LOOP
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

### 5.5 Contoh event bus (lintas-domain tanpa coupling)

```js
// src/events.js
export function createEvents() {
  const map = new Map();
  return {
    on(type, fn){ (map.get(type) ?? map.set(type,new Set()).get(type)).add(fn); return () => map.get(type)?.delete(fn); },
    emit(type, payload){ map.get(type)?.forEach(fn => fn(payload)); },
  };
}
```

```js
// feed/trade-router.js — dulu memanggil spawnBigUnit()/fireVolley()/bigMoment() langsung
events.emit('trade', { side, usd, price });
events.emit('whale', { side, usd, price });     // ≥ T_WHALE

// entities/big-units.js
events.on('whale', ({ side, usd }) => spawnBigUnit(side, usd));
// combat/bullets.js
events.on('trade', ({ side, tier, killed }) => fireVolley(side, tier, killed));
```

---

## 6. Keputusan Perkakas

**Rekomendasi utama: ES Modules native, TANPA bundler (untuk fase 1–8).**

- Peramban modern (target aplikasi ini: Safari iOS/macOS, Chrome) mendukung `<script type="module">` + `import`/`export` langsung.
- **Deploy Pages tidak berubah** — tetap unggah statis apa adanya; tak ada langkah build baru.
- `three` dipetakan via **import map** ke build ESM lokal (revisi tetap terkunci):

```html
<script type="importmap">
  { "imports": { "three": "./vendor/three.module.js" } }
</script>
<script type="module" src="./src/main.js"></script>
```

> Vendor `three.module.js` pada **revisi yang sama** dengan `three.min.js` sekarang, agar API identik. Aplikasi hanya butuh `THREE` core (tak ada addon), jadi build core sudah cukup.

- CSS: pecah `<style>` jadi beberapa `styles/*.css`, dimuat via `<link>`. Tanpa bundler, ini paling sederhana.

**Peningkatan opsional (fase 9, jika perlu): Vite.**

| Aspek | Native ESM (rekomendasi) | Vite (opsional) |
|---|---|---|
| Langkah build | Tidak ada | `npm run build` |
| Deploy Pages | Tak berubah | `static.yml` build dulu → unggah `dist/` |
| DX (HMR, dev server) | Sederhana | Cepat, hot-reload |
| Optimasi (minify, tree-shake, bundle) | Manual | Otomatis |
| Jumlah request runtime | ±30 modul (HTTP/2 OK) | 1–2 bundel |
| Risiko & tooling baru | Minimal | Perlu Node/CI |

Ambil Vite **hanya** bila tim ingin DX/optimasi lebih; ia tetap menghasilkan output statis untuk Pages. Env-secret Firebase juga bisa dipindah ke `import.meta.env`.

---

## 7. Strategi Migrasi Bertahap

Prinsip: **daun dulu** (dependensi paling sedikit), setiap fase = 1 PR kecil yang **tetap membuat aplikasi jalan** dan **diverifikasi** sebelum lanjut. Perilaku identik di tiap langkah.

- **Fase 0 — Persiapan.** Vendor `three.module.js` (revisi terkunci) + import map. Ubah IIFE jadi `<script type="module">` (sementara isinya tetap sama; hanya membuktikan modul + import map jalan). *Verifikasi: aplikasi identik.*
- **Fase 1 — Ekstraksi daun murni.** `config.js`, `i18n.js`, `boot/boot-screen.js`, `core/postfx/bloom.js`, `platform/wake-lock.js`. Semua minim dependensi. *Verifikasi per PR.*
- **Fase 2 — Context inti.** `core/renderer.js` (scene/camera/renderer/cahaya/env) + `core/assets.js` (GLOW/geometri). Perkenalkan objek `ctx`.
- **Fase 3 — Store + Event bus.** `state.js`, `events.js`. Belum memindah logic — hanya menyediakan wadah.
- **Fase 4 — Platform & UI terisolasi.** `audio/audio.js`, `ui/*` (killfeed, market-pressure, event-ticker, moments, controls). Tiap UI pegang DOM-nya sendiri.
- **Fase 5 — Dunia.** `world/field.js`, `world/sky.js`.
- **Fase 6 — Entitas & combat.** `entities/soldiers.js`, `entities/big-units.js`, `entities/airstrike.js`, `combat/bullets.js`, `combat/explosions.js`, `fx/juice.js`. Ubah panggilan lintas-section jadi *emit/subscribe* event.
- **Fase 7 — Input & feed.** `input/camera.js`, `input/interaction.js`, `feed/market-feed.js`, `feed/trade-router.js`. Feed hanya *publish* event.
- **Fase 8 — Urai `tick()` & tipiskan `index.html`.** `main.js` jadi composition root; `tick()` raksasa jadi daftar `system.update()`. `index.html` tinggal shell + markup boot + `<link>` CSS + `<script type=module>`.
- **Fase 9 (opsional) — Adopsi Vite + (opsional) TypeScript incremental.**

Urutan ini menjaga agar tiap PR **kecil, mandiri, reversible**.

---

## 8. Verifikasi & Testing (gerbang tiap fase)

Aplikasi ini visual & real-time; verifikasi utamanya **end-to-end via peramban headless** (pola yang sudah dipakai di repo ini): server statis lokal + Playwright/Chromium.

1. **Gerbang error konsol.** Muat halaman; **nol** error konsol (selain WebSocket feed yang wajar diblokir di sandbox).
2. **Smoke checklist fungsional** tiap fase:
   - Prajurit muncul, berjalan masuk, mengayun kaki, memegang AK terangkat.
   - Whale ter-spawn (paksa via hook debug sementara) → tank/heli/jet/bomber + afterburner/kontrail/asap.
   - Tracer bercahaya, ledakan, kawah, kilatan moncong.
   - Bloom aktif (siang halus, malam kuat).
   - Audio init; resume setelah simulasi hidden→visible; mute/unmute.
   - Feed connect/reconnect (atau dummy); tekanan pasar & killfeed terupdate.
   - Ganti bahasa EN/ID; mode kamera 1/2/3; fullscreen; wake lock.
3. **Diff visual.** Screenshot sebelum/sesudah tiap fase pada scene yang sama (di-spawn deterministik) — bandingkan.
4. **Unit test logika murni (opsional, bertumbuh).** Setelah modular, fungsi murni (mis. pemetaan tier `pickBigUnit`, easing, `computeBloomStrength`, parsing trade) mudah diuji dengan Vitest/Node test runner.

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Siklus import** akibat coupling lama | Modul gagal muat | `ctx/state/events` searah; **larang** sistem meng-`import` sistem lain; komunikasi via event bus |
| **Urutan inisialisasi berubah** (ESM defer) | Bug halus saat boot | Urutan eksplisit di `main.js`; pastikan DOM siap; pertahankan urutan setup lama |
| **Revisi `three` tak cocok** (ESM vs min) | Regresi render | Vendor `three.module.js` revisi **sama**; smoke test render tiap fase |
| **Regresi perilaku tak kasat mata** | Kualitas turun | PR kecil + diff visual + smoke checklist tiap fase |
| **Deploy Pages rusak** | Situs mati | Native ESM tak mengubah pipeline; kalau Vite, uji `static.yml` di branch |
| **Firebase config ter-hardcode** | (Sudah publik utk Firebase, low) | Pindah ke env saat adopsi Vite (fase 9); amankan lewat Firebase Security Rules, bukan menyembunyikan key |
| **Ledakan jumlah request** (native ESM) | Latensi muat | HTTP/2 di Pages; jika perlu, adopsi Vite (fase 9) untuk bundling |

---

## 10. Estimasi & Urutan Kerja

Fase 0–3 (fondasi) lebih cepat; Fase 6 (entitas/combat) paling besar karena memindah state
bersama & mengubah panggilan langsung jadi event. Setiap fase = 1 PR terpisah, diverifikasi,
mergeable sendiri. Rekomendasi: kerjakan berurutan 0 → 8; hentikan/lanjut ke Vite (9) sesuai
kebutuhan tim.

**Definition of Done tiap PR:** modul terekstraksi; import/export eksplisit; nol error konsol;
smoke checklist lolos; diff visual bersih; tak ada perubahan perilaku.

---

## 11. Non-Goals & Prinsip "Secukupnya"

- **Tanpa framework UI / state library** — context + store + event bus buatan sendiri sudah cukup untuk skala ini.
- **Tanpa ECS penuh** — pola "system + update(dt,t)" ringan sudah memetakan `tick()` dengan pas.
- **TypeScript menyusul, tidak wajib** — setelah batas modul stabil, TS bisa diadopsi bertahap (`.js` → `.ts` dengan `checkJs`), bukan di fase awal.
- **Jangan** mengubah gameplay/tuning/tampilan selama refactor — itu pekerjaan terpisah.
```
