import { resumeAudio } from '../audio/audio.js';
import { renderer } from '../core/renderer.js';
import { camMode, keys, orbit, setCamMode } from '../input/camera.js';
import { hoverUnit, onTap } from '../input/interaction.js';

      /* ═══════════ WAKE LOCK — layar tak tidur/terkunci selama tab ini aktif (seperti nonton video) ═══════════
         Safari (iPad/macOS) MENSYARATKAN wake lock diminta di dalam gestur pengguna & saat tab terlihat,
         lalu melepasnya otomatis tiap tab disembunyikan — jadi kita minta ulang pada tiap gestur & saat
         kembali terlihat. Untuk browser tanpa Wake Lock API (mis. iOS < 16.4) disediakan cadangan berupa
         pemutaran video kecil tak terlihat (trik "no-sleep"). */
      let wakeLock = null, noSleepVideo = null;
      export async function requestWakeLock() {
        if (document.visibilityState !== 'visible') return;
        if ('wakeLock' in navigator) {
          if (wakeLock) return;                                   // sudah dipegang
          try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
            return;
          } catch (e) { /* ditolak (butuh gestur / hemat baterai) — jatuh ke cadangan video */ }
        }
        playNoSleepVideo();
      }
      function playNoSleepVideo() {
        try {
          if (!noSleepVideo) {
            const v = document.createElement('video');
            v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
            v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('title', '');
            v.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
            // sumber video "hidup" dari canvas kecil yang terus di-refresh supaya track tak berhenti
            const c = document.createElement('canvas'); c.width = c.height = 2;
            const cx = c.getContext('2d');
            const draw = () => { cx.fillStyle = (Date.now() >> 9) & 1 ? '#000' : '#010101'; cx.fillRect(0, 0, 2, 2); };
            draw();
            if (c.captureStream) { v.srcObject = c.captureStream(2); setInterval(draw, 500); }
            document.body.appendChild(v);
            noSleepVideo = v;
          }
          const p = noSleepVideo.play();
          if (p && p.catch) p.catch(() => { });
        } catch (e) { }
      }
      requestWakeLock();
      addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') { requestWakeLock(); resumeAudio(); }   // balik terlihat → kunci layar lagi & bangunkan audio
      });

      addEventListener('keydown', e => {
        if (e.key === '1') setCamMode(0);
        if (e.key === '2') setCamMode(1);
        if (e.key === '3') setCamMode(2);
        keys[e.key.toLowerCase()] = true;
      });
      addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

      let dragging = false, lx = 0, ly = 0, pinchD = 0, downX = 0, downY = 0, downT = 0, moved = false;
      export const cv = renderer.domElement;
      cv.addEventListener('pointerdown', e => {
        dragging = true; lx = e.clientX; ly = e.clientY;
        downX = e.clientX; downY = e.clientY; downT = performance.now(); moved = false;
      });
      addEventListener('pointerup', e => {
        dragging = false;
        if (!moved && performance.now() - downT < 400) onTap(e);   // ketukan (bukan geser)
      });
      addEventListener('pointercancel', () => { dragging = false; });   // gesture dibatalkan browser → reset
      addEventListener('pointermove', e => {
        if (!dragging) { hoverUnit(e); return; }
        const dx = e.clientX - lx, dy = e.clientY - ly;
        if (!moved && Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) { moved = true; if (camMode !== 2) setCamMode(2); }
        if (moved) {
          orbit.theta -= dx * .005;
          orbit.phi = Math.min(1.35, Math.max(.2, orbit.phi + dy * .004));
        }
        lx = e.clientX; ly = e.clientY;
      });
      cv.addEventListener('wheel', e => {
        e.preventDefault();
        orbit.radius = Math.min(1400, Math.max(140, orbit.radius * (1 + Math.sign(e.deltaY) * .08)));
        if (camMode !== 2) setCamMode(2);
      }, { passive: false });
      cv.addEventListener('touchmove', e => {
        if (e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          if (pinchD) orbit.radius = Math.min(1400, Math.max(140, orbit.radius * pinchD / d));
          pinchD = d;
          if (camMode !== 2) setCamMode(2);
        }
      }, { passive: true });
      cv.addEventListener('touchend', () => pinchD = 0);

