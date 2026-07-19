import { CROWD_MAX, CROWD_START } from '../config.js';
import { buyCrowd, sellCrowd } from '../entities/soldiers.js';
import { fieldState } from '../world/field.js';
import { skyState } from '../world/sky.js';

      /* ═══════════ TEKANAN PASAR (panjang vs pendek, 60s) ═══════════ */
      export let flow = [];   // {t, usd, buy}
// rerata laju transaksi adaptif (transaksi/detik) — dasar pembanding pasar "sepi"
export const pressureState = { flowRateEMA: null };
      export function fmtUsd(n) {
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
        return '$' + Math.round(n);
      }
      export function meterUpdate() {
        const now = performance.now();
        flow = flow.filter(f => now - f.t < 60000);
        let bu = 0, su = 0, bc = 0, sc = 0;
        for (const f of flow) { if (f.buy) { bu += f.usd; bc++; } else { su += f.usd; sc++; } }
        const tot = bu + su || 1;
        const lp = Math.round(bu / tot * 100);
        if (tot > 1) {
          fieldState.buyShare = bu / tot;
          skyState.moodTarget = Math.max(-1, Math.min(1, (fieldState.buyShare - 0.5) * 3));
          // jumlah prajurit tiap sisi mencerminkan persentase buy/sell
          buyCrowd.target = Math.max(8, Math.min(CROWD_MAX, Math.round(fieldState.buyShare * 2 * CROWD_START)));
          sellCrowd.target = Math.max(8, Math.min(CROWD_MAX, Math.round((1 - fieldState.buyShare) * 2 * CROWD_START)));
        }
        document.getElementById('pp-long').style.width = lp + '%';
        document.getElementById('pp-long-pct').textContent = lp + '%';
        document.getElementById('pp-short-pct').textContent = (100 - lp) + '%';
        document.getElementById('pp-long-usd').textContent = fmtUsd(bu);
        document.getElementById('pp-short-usd').textContent = fmtUsd(su);
        document.getElementById('pp-long-cnt').textContent = bc;
        document.getElementById('pp-short-cnt').textContent = sc;
      }

