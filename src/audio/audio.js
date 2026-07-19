import { camera } from '../core/renderer.js';
import { I18N, lang } from '../i18n.js';
import { requestWakeLock } from '../platform/wake-lock.js';
import { skyState } from '../world/sky.js';

      /* ═══════════ AUDIO — musik latar (dua lapis, berpindah sesuai keramaian pasar) & efek suara (generatif), masing-masing slider volume sendiri ═══════════ */
      let AC = null, masterG, musicG, sfxG;
      let musicOn = false, sfxOn = false;   // turunan dari volume > 0 — dipakai agar tak kerja sia-sia saat senyap
      const musicVolEl = document.getElementById('music-vol');
      const sfxVolEl = document.getElementById('sfx-vol');
      export const musicLabelEl = document.getElementById('music-label');
      export const sfxLabelEl = document.getElementById('sfx-label');
      let musicLastVol = 100, sfxLastVol = 100;   // volume terakhir sebelum dibisukan, untuk tombol mute
      const MUSIC_LEVEL = .55, SFX_LEVEL = .85;
      let musicTargetGain = MUSIC_LEVEL;   // gain yang dituju musik (sebelum diredam sesaat oleh tembakan)
      const MUSIC_SRC_BUSY = 'bgm.m4a';        // "Determined Pursuit" oleh Emma_MA (CC0, opengameart.org) — di-loop gapless, untuk pasar ramai
      const MUSIC_SRC_CALM = 'bgm_calm.m4a';   // "Ambient Relaxing Loop" oleh isaiah658 (CC0, opengameart.org) — untuk pasar sepi/gencatan
      const SFX_GUNSHOT_SRC = 'sfx_gunshot.mp3', SFX_CANNON_SRC = 'sfx_cannon.mp3';   // CC0, "Basic Sound Effects" oleh n4 (opengameart.org)
      const SFX_THUNDER_SRC = 'sfx_thunder.m4a';   // rekaman asli guntur dari paket "100 CC0 SFX #2" oleh rubberduck (CC0, opengameart.org)
      let sfxBufGunshot = null, sfxBufCannon = null, sfxBufThunder = null;
      /* dua lapis musik diputar bersamaan terus-menerus; hanya gain-nya yang di-crossfade,
         supaya perpindahan mulus tanpa jeda decode/restart saat keramaian pasar berubah */
      let musicBusyG = null, musicCalmG = null, musicLayer = 'busy';
      let busySrc = null, calmSrc = null, musicBuffers = null, musicSourcesAlive = false;   // sumber loop bisa dibangun ulang (iOS mematikannya saat context di-interupsi)

      function initAudio() {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        masterG = AC.createGain(); masterG.connect(AC.destination);
        musicG = AC.createGain(); musicG.gain.value = MUSIC_LEVEL; musicG.connect(masterG);
        sfxG = AC.createGain(); sfxG.gain.value = SFX_LEVEL; sfxG.connect(masterG);
        startMusic();
        loadSfxBuffers();
      }

      /* efek tembakan & guntur: sampel rekaman asli (bukan noise sintetis) di-decode sekali lalu diputar berulang */
      async function loadSfxBuffers() {
        try {
          const [gRes, cRes, tRes] = await Promise.all([fetch(SFX_GUNSHOT_SRC), fetch(SFX_CANNON_SRC), fetch(SFX_THUNDER_SRC)]);
          [sfxBufGunshot, sfxBufCannon, sfxBufThunder] = await Promise.all([
            AC.decodeAudioData(await gRes.arrayBuffer()),
            AC.decodeAudioData(await cRes.arrayBuffer()),
            AC.decodeAudioData(await tRes.arrayBuffer()),
          ]);
        } catch (e) { console.warn('sfx tembakan/guntur gagal dimuat:', e); }
      }

      /* musik latar: kedua file di-decode lalu diputar lewat AudioBufferSourceNode (loop=true) agar
         sambungan loop mulus, bukan <audio loop> yang bisa berjeda sekejap di titik ulang.
         Keduanya berjalan bersamaan sejak awal — hanya gain masing-masing yang di-crossfade. */
      async function startMusic() {
        try {
          if (!musicBuffers) {
            const [busyBuf, calmBuf] = await Promise.all([
              fetch(MUSIC_SRC_BUSY, { cache: 'force-cache' }).then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b)),
              fetch(MUSIC_SRC_CALM, { cache: 'force-cache' }).then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b)),
            ]);
            musicBuffers = { busy: busyBuf, calm: calmBuf };
          }
          if (!musicBusyG) { musicBusyG = AC.createGain(); musicBusyG.gain.value = 1; musicBusyG.connect(musicG); }
          if (!musicCalmG) { musicCalmG = AC.createGain(); musicCalmG.gain.value = 0; musicCalmG.connect(musicG); }
          spawnMusicSources();
        } catch (e) { console.warn('musik latar gagal dimuat:', e); }
      }
      /* (Re)buat node sumber loop musik & sambungkan ke gain crossfade yang sudah ada.
         Dipakai saat mulai DAN saat memulihkan audio setelah iOS mematikan sumber (interupsi). */
      function spawnMusicSources() {
        if (!musicBuffers || !musicBusyG || !AC) return;
        if (busySrc) { busySrc.onended = null; try { busySrc.stop(); } catch (e) { } }
        if (calmSrc) { calmSrc.onended = null; try { calmSrc.stop(); } catch (e) { } }
        busySrc = AC.createBufferSource(); busySrc.buffer = musicBuffers.busy; busySrc.loop = true; busySrc.connect(musicBusyG);
        calmSrc = AC.createBufferSource(); calmSrc.buffer = musicBuffers.calm; calmSrc.loop = true; calmSrc.connect(musicCalmG);
        const onEnd = () => { musicSourcesAlive = false; };   // iOS memanggil ini saat context di-interupsi → tandai perlu dibangun ulang
        busySrc.onended = onEnd; calmSrc.onended = onEnd;
        busySrc.start(); calmSrc.start();
        musicSourcesAlive = true;
      }
      /* Pulihkan audio setelah kembali dari background / interupsi (iOS): resume context,
         lalu bangun ulang loop musik bila iOS sudah mematikannya (kalau tidak → tetap senyap). */
      export async function resumeAudio() {
        if (!AC) return;
        try { await AC.resume(); } catch (e) { }
        if (musicBuffers && !musicSourcesAlive) spawnMusicSources();
      }
      /* pindah lapis musik ('busy'/'calm') dengan crossfade mulus, dipicu oleh gencatan (skyState.lull) saat pasar sepi */
      export function setMusicLayer(layer) {
        if (layer === musicLayer || !musicBusyG || !musicCalmG) return;
        musicLayer = layer;
        const t = AC.currentTime, dur = 3.2;
        const inG = layer === 'calm' ? musicCalmG : musicBusyG;
        const outG = layer === 'calm' ? musicBusyG : musicCalmG;
        inG.gain.cancelScheduledValues(t); inG.gain.setValueAtTime(inG.gain.value, t); inG.gain.linearRampToValueAtTime(1, t + dur);
        outG.gain.cancelScheduledValues(t); outG.gain.setValueAtTime(outG.gain.value, t); outG.gain.linearRampToValueAtTime(0, t + dur);
      }
      window.__testMusicLayer = setMusicLayer;   // bantuan uji manual dari console: __testMusicLayer('calm') / ('busy')
      /* mengecat isian slider (hijau sampai posisi thumb) & tandai bisu lewat CSS class */
      function paintVol(el, muted) {
        const pct = +el.value, col = muted ? 'var(--muted)' : 'var(--long)';
        el.classList.toggle('muted', muted);
        el.style.background = `linear-gradient(to right, ${col} 0%, ${col} ${pct}%, rgba(255,255,255,.14) ${pct}%, rgba(255,255,255,.14) 100%)`;
      }
      function applyMusicVol() {
        const pct = +musicVolEl.value, muted = pct === 0;
        musicOn = !muted;
        musicTargetGain = (pct / 100) * MUSIC_LEVEL;
        if (musicG) { musicG.gain.cancelScheduledValues(AC.currentTime); musicG.gain.value = musicTargetGain; }
        musicLabelEl.classList.toggle('muted', muted);
        paintVol(musicVolEl, muted);
        syncAudioBtn();
      }
      /* "duck" musik sesaat tiap ada tembakan, supaya efek suara tetap terdengar tembus di atas musik latar */
      function duckMusic(depth, atk, hold, rel) {
        if (!musicG || !musicOn) return;
        const t = AC.currentTime, g = musicG.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(musicTargetGain * (1 - depth), t + atk);
        g.setValueAtTime(musicTargetGain * (1 - depth), t + atk + hold);
        g.linearRampToValueAtTime(musicTargetGain, t + atk + hold + rel);
      }
      function applySfxVol() {
        const pct = +sfxVolEl.value, muted = pct === 0;
        sfxOn = !muted;
        if (sfxG) sfxG.gain.value = (pct / 100) * SFX_LEVEL;
        sfxLabelEl.classList.toggle('muted', muted);
        paintVol(sfxVolEl, muted);
        syncAudioBtn();
      }
      musicVolEl.oninput = () => { if (!AC) initAudio(); if (+musicVolEl.value > 0) musicLastVol = +musicVolEl.value; applyMusicVol(); };
      sfxVolEl.oninput = () => { if (!AC) initAudio(); if (+sfxVolEl.value > 0) sfxLastVol = +sfxVolEl.value; applySfxVol(); };
      musicLabelEl.onclick = () => { if (!AC) initAudio(); musicVolEl.value = (+musicVolEl.value > 0) ? 0 : musicLastVol; applyMusicVol(); };
      sfxLabelEl.onclick = () => { if (!AC) initAudio(); sfxVolEl.value = (+sfxVolEl.value > 0) ? 0 : sfxLastVol; applySfxVol(); };

      /* ═══════════ TOGGLE AUDIO MASTER — satu tombol untuk musik + efek sekaligus ═══════════
         Di ponsel, panel kontrol sering disembunyikan dan browser butuh gestur pengguna sebelum
         audio boleh bunyi — tombol ini selalu terlihat di kanan atas dan ketukannya sekaligus
         menjadi gestur yang membuka AudioContext. Ikon mute tampil hanya bila KEDUA volume 0. */
      const audioBtn = document.getElementById('audio-btn');
      const AUDIO_ON_ICON = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.7a4.4 4.4 0 010 6.6M18.3 6a8.4 8.4 0 010 12"/></svg>';
      const AUDIO_MUTE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
      function audioAllMuted() { return +musicVolEl.value === 0 && +sfxVolEl.value === 0; }
      export function syncAudioBtn() {
        const muted = audioAllMuted();
        audioBtn.classList.toggle('muted', muted);
        audioBtn.innerHTML = muted ? AUDIO_MUTE_ICON : AUDIO_ON_ICON;
        try {   // pemanggilan pertama terjadi saat init, sebelum I18N dideklarasikan — title bawaan HTML dipakai dulu
          const L = I18N[lang];
          audioBtn.title = muted ? L.audioUnmute : L.audioMute;
          audioBtn.setAttribute('aria-label', audioBtn.title);
        } catch (e) { }
      }
      audioBtn.onclick = () => {
        if (!AC) initAudio();
        resumeAudio();   // klik = gestur pengguna → resume context + bangun ulang loop musik bila mati (mis. balik dari app lain di iOS)
        if (audioAllMuted()) {
          // nyalakan kembali kedua kanal ke volume terakhir sebelum dibisukan
          musicVolEl.value = musicLastVol;
          sfxVolEl.value = sfxLastVol;
        } else {
          // simpan volume saat ini supaya unmute kembali ke posisi semula
          if (+musicVolEl.value > 0) musicLastVol = +musicVolEl.value;
          if (+sfxVolEl.value > 0) sfxLastVol = +sfxVolEl.value;
          musicVolEl.value = 0; sfxVolEl.value = 0;
        }
        applyMusicVol(); applySfxVol();
      };

      /* musik & efek aktif otomatis — browser mensyaratkan satu gestur pengguna
         sebelum AudioContext bisa benar-benar bersuara, jadi kita siapkan
         di awal lalu resume pada interaksi pertama apa pun */
      initAudio();
      if (AC && AC.state !== 'running') {
        // autoplay diblokir browser (a.l. Safari) — bisukan dulu supaya UI tak menampilkan "menyala"
        // padahal sebenarnya senyap; musicLastVol/sfxLastVol tetap tersimpan, tinggal klik label untuk menyalakan
        musicVolEl.value = 0; sfxVolEl.value = 0;
      }
      applyMusicVol(); applySfxVol();
      /* Browser memblokir suara sampai ada satu interaksi pengguna. Kita coba
         resume sedini mungkin pada gerakan/gesture apa pun (bergerak mouse,
         scroll, sentuh, tekan tombol) supaya musik nyala secepatnya. */
      const RESUME_EVENTS = ['pointerdown', 'pointerup', 'pointermove', 'keydown', 'touchstart', 'touchend', 'wheel', 'scroll', 'click'];
      const resumeAudioOnce = () => {
        if (AC) {
          if (AC.state === 'suspended') AC.resume();
          try { const s = AC.createBufferSource(); s.buffer = AC.createBuffer(1, 1, AC.sampleRate); s.connect(AC.destination); s.start(0); } catch (e) { } // buka audio di iOS/Safari
        }
        if (AC && AC.state === 'running') RESUME_EVENTS.forEach(ev => removeEventListener(ev, resumeAudioOnce));
      };
      RESUME_EVENTS.forEach(ev => addEventListener(ev, resumeAudioOnce, { passive: true }));
      if (AC) AC.resume().catch(() => { });   // sebagian browser mengizinkan langsung
      // Pendengar gestur PERMANEN (tak melepas diri) — memulihkan audio & MENGUNCI layar (wake lock)
      // pada tiap gestur. Safari mensyaratkan wake lock diminta di dalam gestur, dan iOS men-suspend
      // audio context saat pindah app; ketukan berikutnya membangunkan keduanya lagi.
      ['pointerdown', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { resumeAudio(); requestWakeLock(); }, { passive: true }));

      /* ═══════════ AUDIO POSISIONAL — pan kiri/kanan mengikuti posisi kejadian di layar ═══════════
         Node tujuan SFX: StereoPanner (jika ada posisi & didukung) → sfxG, atau sfxG langsung.
         Pan dihitung dari proyeksi posisi dunia ke NDC-x kamera, jadi ikut arah pandang/zoom saat ini. */
      const _sfxV = new THREE.Vector3();
      function sfxOut(pos) {
        if (!pos || !AC.createStereoPanner) return sfxG;
        const p = AC.createStereoPanner();
        _sfxV.copy(pos).project(camera);
        p.pan.value = Math.max(-1, Math.min(1, (isFinite(_sfxV.x) ? _sfxV.x : 0) * 0.9));
        p.connect(sfxG);
        return p;
      }

      export function playBoom(mag, tier, pos) {
        if (!sfxOn || !AC) return;
        const out = sfxOut(pos);
        const t = AC.currentTime;
        // sub thump
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(tier === 2 ? 60 : 90 + mag * 60, t);
        o.frequency.exponentialRampToValueAtTime(24, t + .5 + mag * .4);
        g.gain.setValueAtTime(.001, t);
        g.gain.exponentialRampToValueAtTime(.14 + mag * .25, t + .015);
        g.gain.exponentialRampToValueAtTime(.001, t + .6 + mag * .5);
        o.connect(g).connect(out); o.start(t); o.stop(t + 1.3);
        // debris noise
        const dur = .3 + mag * .5;
        const buf = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2);
        const src = AC.createBufferSource(); src.buffer = buf;
        const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200 + mag * 2500;
        const ng = AC.createGain(); ng.gain.value = .1 + mag * .2;
        src.connect(f).connect(ng).connect(out); src.start(t);
      }
      export function playChargeHorn(pos) {
        if (!sfxOn || !AC) return;
        const out = sfxOut(pos);
        const t = AC.currentTime;
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(46, t);
        o.frequency.linearRampToValueAtTime(66, t + 1.2);
        o.frequency.linearRampToValueAtTime(40, t + 2.2);
        const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
        g.gain.setValueAtTime(.001, t);
        g.gain.exponentialRampToValueAtTime(.16, t + .3);
        g.gain.exponentialRampToValueAtTime(.001, t + 2.4);
        o.connect(f).connect(g).connect(out);
        o.start(t); o.stop(t + 2.5);
      }
      export function playCannon(pos) {                   // tembakan unit paus (tank/heli/jet) — berat & dalam, beda dari rentetan prajurit biasa
        if (!sfxOn || !AC || !sfxBufCannon) return;
        const t = AC.currentTime;
        const src = AC.createBufferSource(); src.buffer = sfxBufCannon;
        src.playbackRate.value = .95 + Math.random() * .1;
        const g = AC.createGain(); g.gain.value = .9;
        src.connect(g).connect(sfxOut(pos)); src.start(t);
        duckMusic(.7, .03, .1, .5);
      }
      export function playThunder(z0) {                   // guntur saat badai (dump keras) — z0 sambaran menentukan jarak & kesan redam
        if (!sfxOn || !AC || !sfxBufThunder) return;
        const dist = Math.min(1, Math.max(0, (-z0 - 260) / 460));   // 0=dekat, 1=jauh
        const t = AC.currentTime + dist * 0.35;                    // jeda mengikuti kecepatan suara (dibuat-buat, bukan fisik akurat)
        const src = AC.createBufferSource(); src.buffer = sfxBufThunder;
        src.playbackRate.value = .92 - dist * .12 + Math.random() * .1;
        const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 7200 - dist * 5200;
        const g = AC.createGain(); g.gain.value = .8 - dist * .35;
        src.connect(f).connect(g).connect(sfxG); src.start(t);
        duckMusic(.35, .05, .3, 1.1);
      }
      export function playVolley(tier, pos) {
        if (!sfxOn || !AC || !sfxBufGunshot) return;
        const out = sfxOut(pos);
        const t0 = AC.currentTime;
        const shots = tier === 2 ? 5 : tier === 1 ? 3 : 1;
        for (let i = 0; i < shots; i++) {
          const t = t0 + i * (.02 + Math.random() * .03);
          const src = AC.createBufferSource(); src.buffer = sfxBufGunshot;
          src.playbackRate.value = .92 + Math.random() * .22;
          const g = AC.createGain(); g.gain.value = .85 + Math.random() * .25;
          src.connect(g).connect(out); src.start(t);
        }
        duckMusic(.45, .02, .06, .35);
      }
      export function playCheer() {
        if (!sfxOn || !AC) return;
        const t = AC.currentTime;
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(520, t);
        o.frequency.exponentialRampToValueAtTime(880, t + .14);
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(.12, t + .03);
        g.gain.exponentialRampToValueAtTime(.0001, t + .3);
        o.connect(g).connect(sfxG); o.start(t); o.stop(t + .32);
      }

