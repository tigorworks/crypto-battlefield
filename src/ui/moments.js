import { renderer } from '../core/renderer.js';
import { price } from '../feed/market-feed.js';
import { I18N, lang } from '../i18n.js';
import { fmtUsd } from './market-pressure.js';
import { fieldState } from '../world/field.js';

      /* ═══════════════════════════════════════════════════════════
         FITUR: KARTU MOMEN — tangkap & bagikan momen besar
         ═══════════════════════════════════════════════════════════ */
      const RFONT = "'SF Pro Rounded','SFRounded',ui-rounded,system-ui,sans-serif";
      const MFONT = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
      const cardModal = document.getElementById('card-modal'), cardImg = document.getElementById('card-img');
      const shareBtn = document.getElementById('share-btn');
      const mtEl = document.getElementById('moment-toast'), mtTxt = document.getElementById('mt-txt'),
        mtSave = document.getElementById('mt-save'), mtClose = document.getElementById('mt-close');
      const cardDownloadBtn = document.getElementById('card-download'), cardShareBtn = document.getElementById('card-share'), cardCloseBtn = document.getElementById('card-close');
      let lastToast = -1e9, pendingMoment = null, cardCanvas = null, mtTimer = null;
      function grabSnap() {
        const s = renderer.domElement, c = document.createElement('canvas');
        c.width = s.width; c.height = s.height;
        try { c.getContext('2d').drawImage(s, 0, 0); } catch (e) { }
        return c;
      }
      export function bigMoment(type, side, usd, p) {
        const huge = type === 'liq' ? usd >= 200000 : usd >= 1500000;   // hanya yang benar-benar besar
        if (!huge) return;
        const now = performance.now();
        if (now - lastToast < 12000) return;                        // jangan spam
        lastToast = now;
        pendingMoment = { type, side, usd, price: p, ts: Date.now(), snap: grabSnap() };
        const L = I18N[lang];
        mtTxt.innerHTML = (type === 'liq' ? L.momentToastLiq : L.momentToastWhale) + ' · <b>' + fmtUsd(usd) + '</b>';
        mtSave.textContent = L.momentSave;
        mtEl.classList.add('show');
        clearTimeout(mtTimer); mtTimer = setTimeout(() => mtEl.classList.remove('show'), 8000);
      }
      function buildCard(m) {
        const cw = 1200, ch = 630, c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const x = c.getContext('2d'), L = I18N[lang];
        const snap = m.snap || grabSnap();
        if (snap && snap.width) {
          const sr = snap.width / snap.height, cr = cw / ch; let sw, sh, sx, sy;
          if (sr > cr) { sh = ch; sw = ch * sr; sx = (cw - sw) / 2; sy = 0; } else { sw = cw; sh = cw / sr; sx = 0; sy = (ch - sh) / 2; }
          x.drawImage(snap, sx, sy, sw, sh);
        } else { x.fillStyle = '#0e1226'; x.fillRect(0, 0, cw, ch); }
        const gr = x.createLinearGradient(0, ch * 0.4, 0, ch); gr.addColorStop(0, 'rgba(10,12,24,0)'); gr.addColorStop(1, 'rgba(10,12,24,.94)');
        x.fillStyle = gr; x.fillRect(0, 0, cw, ch);
        x.fillStyle = 'rgba(10,12,24,.55)'; x.fillRect(0, 0, cw, 72);
        x.textBaseline = 'alphabetic'; x.textAlign = 'left';
        x.font = '800 30px ' + RFONT; x.fillStyle = '#eef1fb'; x.fillText('BTC BATTLEFIELD', 40, 47);
        x.textAlign = 'right'; x.font = '700 18px ' + MFONT; x.fillStyle = '#8891b8';
        x.fillText(new Date(m.ts).toLocaleString(), cw - 40, 46);
        const col = m.type === 'liq' ? '#ffc857' : (m.side === 'buy' ? '#2dd6a5' : '#ff6584');
        const label = m.type === 'liq' ? L.momentLiq : m.type === 'snapshot' ? L.momentSnap : (m.side === 'buy' ? L.momentWhaleBuy : L.momentWhaleSell);
        x.textAlign = 'left'; x.font = '800 60px ' + RFONT; x.fillStyle = col;
        x.fillText(m.usd ? label + '   ' + fmtUsd(m.usd) : label, 40, ch - 118);
        x.font = '700 32px ' + MFONT; x.fillStyle = '#eef1fb';
        x.fillText('@ $' + (m.price || price || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }), 40, ch - 70);
        const lp = Math.round(fieldState.buyShare * 100);
        x.font = '800 22px ' + RFONT;
        x.fillStyle = '#2dd6a5'; x.fillText('BUY ' + lp + '%', 40, ch - 28);
        const w1 = x.measureText('BUY ' + lp + '%').width;
        x.fillStyle = '#8891b8'; x.fillText('  vs  ', 40 + w1, ch - 28);
        const w2 = x.measureText('  vs  ').width;
        x.fillStyle = '#ff6584'; x.fillText((100 - lp) + '% SELL', 40 + w1 + w2, ch - 28);
        x.textAlign = 'right'; x.font = '700 16px ' + MFONT; x.fillStyle = 'rgba(255,255,255,.4)';
        x.fillText('live BTC/USDT', cw - 40, ch - 28);
        return c;
      }
      function safeDataURL(c) { try { return c.toDataURL('image/png'); } catch (e) { return ''; } }
      function openCard(m) {
        const L = I18N[lang];
        cardCanvas = buildCard(m);
        const url = safeDataURL(cardCanvas);
        if (url) cardImg.src = url; else cardImg.removeAttribute('src');
        cardDownloadBtn.textContent = L.cardDownload; cardShareBtn.textContent = L.cardShare; cardCloseBtn.textContent = L.cardClose;
        cardShareBtn.style.display = (navigator.canShare) ? '' : 'none';
        cardModal.classList.add('show');
      }
      shareBtn.onclick = () => openCard({ type: 'snapshot', side: fieldState.buyShare >= .5 ? 'buy' : 'sell', usd: null, price, ts: Date.now(), snap: grabSnap() });
      mtSave.onclick = () => { mtEl.classList.remove('show'); if (pendingMoment) openCard(pendingMoment); };
      mtClose.onclick = () => mtEl.classList.remove('show');
      cardCloseBtn.onclick = () => cardModal.classList.remove('show');
      cardModal.onclick = (e) => { if (e.target === cardModal) cardModal.classList.remove('show'); };
      cardDownloadBtn.onclick = () => { if (cardCanvas) { const u = safeDataURL(cardCanvas); if (u) { const a = document.createElement('a'); a.href = u; a.download = 'btc-battlefield.png'; a.click(); } } };
      cardShareBtn.onclick = () => {
        if (!cardCanvas) return; cardCanvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], 'btc-battlefield.png', { type: 'image/png' });
          try { if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'BTC Battlefield' }); } catch (e) { }
        }, 'image/png');
      };

