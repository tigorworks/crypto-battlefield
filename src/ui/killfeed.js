import { I18N, lang } from '../i18n.js';
import { fmtUsd } from './market-pressure.js';

      /* ═══════════ KILLFEED — gabungan order flow & sorotan ═══════════ */
      const killsEl = document.getElementById('kills');
      /* jumlah koin: desimal menyesuaikan besaran agar order kecil (< 0,001) tetap terbaca,
         bukan membulat jadi 0,000. Nol di ekor dipangkas supaya tetap ringkas. */
      function fmtQty(q) {
        const a = Math.abs(q);
        const dec = a >= 1 ? 3 : a >= 0.001 ? 5 : 8;   // makin kecil → makin banyak desimal
        const s = q.toFixed(dec);
        return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
      }
      function fmtPrice(p) { return '$' + p.toLocaleString('en-US', { maximumFractionDigits: p < 10 ? 4 : 2 }); }

      /* rekor order terbesar (berdasar nilai USD) sepanjang sesi — dipatri di atas killfeed */
      const krecEls = {
        buy: { label: document.querySelector('#krec-buy .krec-label'), val: document.querySelector('#krec-buy .krec-val') },
        sell: { label: document.querySelector('#krec-sell .krec-label'), val: document.querySelector('#krec-sell .krec-val') },
      };
      const sessionMax = { buy: null, sell: null };
      export function renderRecord(side) {
        const rec = sessionMax[side];
        const L = I18N[lang];
        krecEls[side].label.textContent = side === 'buy' ? L.topBuy : L.topSell;
        krecEls[side].val.textContent = rec ? `${fmtUsd(rec.usd)} · ${fmtQty(rec.qty)} @ ${fmtPrice(rec.price)}` : '—';
      }
      export function considerRecord(side, usd, qty, price) {
        const cur = sessionMax[side];
        if (!cur || usd > cur.usd) { sessionMax[side] = { usd, qty, price }; renderRecord(side); }
      }


      export function logKill(side, qty, price, tag) {
        const d = document.createElement('div');
        const time = new Date().toLocaleTimeString('en-GB');
        const L = I18N[lang];
        const tagText = tag === 'whale' ? L.whaleTag : tag === 'liq' ? L.liqTag : null;
        d.className = 'kill ' + (tag === 'liq' ? 'liq' : side);
        d.innerHTML = `<span class="kt">[${time}]</span>` +
          (tagText ? `<span class="tag">${tagText} </span>` : '') +
          (side === 'buy' ? L.long + ' ' : L.short + ' ') + fmtQty(qty) +
          ` @ $${price.toLocaleString('en-US', { maximumFractionDigits: price < 10 ? 4 : 2 })}`;
        killsEl.prepend(d);
        while (killsEl.children.length > 4) killsEl.lastChild.remove();
        setTimeout(() => { if (d.parentNode) { d.style.opacity = '0'; d.style.transition = 'opacity .5s'; setTimeout(() => d.remove(), 550); } }, 7000);
      }

