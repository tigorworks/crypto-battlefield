import { camera } from '../core/renderer.js';
import { I18N, lang } from '../i18n.js';

      /* ═══════════ JUICE — getar layar, jeda hantam, angka melayang, streak ═══════════ */
export const juiceState = { shake: 0, hitstop: 0, flashV: 0, slowmo: 0 };
      export let  lastHitstopT = -10;
      export function addShake(a) { juiceState.shake = Math.min(5, juiceState.shake + a); }
      export function addHitstop(s) {
        // jeda-hantam hanya sesekali; jangan menumpuk/berantai sampai simulasi macet
        const now = performance.now() / 1000;
        if (juiceState.hitstop > 0 || now - lastHitstopT < 0.6) return;
        lastHitstopT = now; juiceState.hitstop = s;
      }

      const fxLayer = document.getElementById('fx-layer');
      export const _pv = new THREE.Vector3();
      export function floatNum(worldPos, text, cls) {
        _pv.copy(worldPos); _pv.y += 8; _pv.project(camera);
        if (_pv.z > 1) return;
        const el = document.createElement('div');
        el.className = 'fnum ' + (cls || '');
        el.textContent = text;
        el.style.left = ((_pv.x * .5 + .5) * innerWidth) + 'px';
        el.style.top = ((-_pv.y * .5 + .5) * innerHeight) + 'px';
        fxLayer.appendChild(el);
        requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-140%)'; el.style.opacity = '0'; });
        setTimeout(() => el.remove(), 950);
      }

      const streakEl = document.getElementById('streak');
      let streakSide = null, streakCount = 0, streakHide = null;
      export function bumpStreak(side) {
        if (side === streakSide) streakCount++;
        else { streakSide = side; streakCount = 1; }
        if (streakCount >= 5 && streakCount % 5 === 0) {
          const L = I18N[lang];
          const who = side === 'buy' ? L.buyer : L.seller;
          // eskalasi visual: makin panjang beruntun, makin besar & menyala tampilannya (bukan cuma teks berulang)
          const tier = streakCount >= 20 ? 3 : streakCount >= 10 ? 2 : 1;
          const suffix = tier === 3 ? L.streakSuffixT3 : tier === 2 ? L.streakSuffixT2 : L.streakSuffix;
          streakEl.textContent = `${who} ${streakCount}${suffix}`;
          streakEl.className = `show t${tier} ` + side;
          addShake(.8 + Math.min(2, streakCount * .05));
          clearTimeout(streakHide);
          streakHide = setTimeout(() => { streakEl.className = ''; }, 2200);
        }
      }

      /* ═══════════ KILAT LAYAR & GERAK LAMBAT — untuk peristiwa besar/petir ═══════════ */
      export const flashEl = document.getElementById('flash');
      export let  flashColor = '#ffffff';
      export function addFlash(v, color) { juiceState.flashV = Math.max(juiceState.flashV, v); if (color) flashColor = color; }
      export function addSlowmo(s) { juiceState.slowmo = Math.max(juiceState.slowmo, s); }

