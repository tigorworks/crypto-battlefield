import { I18N, lang } from '../i18n.js';

      /* ═══════════ LAYAR PENUH ═══════════ */
      export const fsBtn = document.getElementById('fs-btn');
      /* iPhone Safari tak mendukung requestFullscreen() untuk elemen sembarang (hanya <video>) —
         sembunyikan tombolnya di situ, tapi tetap tampil di Android/iPad/desktop yang mendukung */
      const FS_SUPPORTED = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)
        && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true);
      if (!FS_SUPPORTED) fsBtn.style.display = 'none';
      const FS_ENTER = '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
      const FS_EXIT = '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';
      export function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
      fsBtn.onclick = () => {
        const el = document.documentElement;
        if (!fsElement()) {
          (el.requestFullscreen || el.webkitRequestFullscreen || (() => { })).call(el);
        } else {
          (document.exitFullscreen || document.webkitExitFullscreen || (() => { })).call(document);
        }
      };
      function syncFsIcon() {
        const on = !!fsElement();
        fsBtn.innerHTML = on ? FS_EXIT : FS_ENTER;
        fsBtn.title = on ? I18N[lang].fsExit : I18N[lang].fsEnter;
        document.body.classList.toggle('is-fs', on);
      }
      addEventListener('fullscreenchange', syncFsIcon);
      addEventListener('webkitfullscreenchange', syncFsIcon);

      /* ═══════════ TOGGLE WIDGET — kontrol, tekanan pasar & killfeed jadi satu tombol; aktif (tampil) tiap kali halaman dimuat ═══════════ */
      const widgetsBtn = document.getElementById('widgets-btn');
      const WIDGET_PANELS = ['controls', 'pressure', 'killfeed'].map(id => document.getElementById(id));
      let widgetsOn = true;
      export function syncWidgetsBtn() {
        widgetsBtn.classList.toggle('active', widgetsOn);
        const L = I18N[lang];
        widgetsBtn.title = widgetsOn ? L.widgetsHide : L.widgetsShow;
        widgetsBtn.setAttribute('aria-label', widgetsBtn.title);
        WIDGET_PANELS.forEach(el => { if (el) el.style.display = widgetsOn ? '' : 'none'; });
      }
      widgetsBtn.onclick = () => { widgetsOn = !widgetsOn; syncWidgetsBtn(); };

