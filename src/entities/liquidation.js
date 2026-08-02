import { playChargeHorn } from '../audio/audio.js';
import { fireVolley, groundPoint } from '../combat/bullets.js';
import { explode } from '../combat/explosions.js';
import { C_GOLD, C_GOLD2 } from '../config.js';
import { addFlash, addHitstop, addShake, addSlowmo, floatNum } from '../fx/juice.js';
import { I18N, lang } from '../i18n.js';
import { showEvent } from '../ui/event-ticker.js';
import { logLiquidation } from '../ui/killfeed.js';
import { fmtUsd } from '../ui/market-pressure.js';
import { bigMoment } from '../ui/moments.js';
import { spawnBarrage } from './airstrike.js';
import { buyCrowd, sellCrowd } from './soldiers.js';

      /* ═══════════ LIKUIDASI — eksekusi posisi yang dipaksa tutup ═══════════
         Beda dari order biasa: di sini ada pihak yang *kalah telak*, jadi tampilannya bukan
         baku tembak biasa melainkan eksekusi — barisan sisi yang terlikuidasi tersapu ledakan
         emas, dengan skala mengikuti besar posisi yang dihanguskan. */
      const LIQ_MIN = 5000;               // di bawah ini diabaikan — likuidasi receh terjadi tiap detik
      const LIQ_BIG = 100000;             // ledakan besar + banner peristiwa
      const LIQ_MEGA = 500000;            // sapuan total: artileri, gerak lambat, kilat layar
      const MEGA_COOLDOWN = 12000;        // jarak minimum antar sapuan total (ms)
      let lastMega = -1e9;

      /* winSide = sisi yang diuntungkan (arah order likuidasinya):
         short dilikuidasi → dibeli paksa → 'buy' menang, barisan 'sell' yang tersapu. */
      export function spawnLiquidation(winSide, usd, price) {
        if (!(usd >= LIQ_MIN)) return;
        const wiped = winSide === 'buy' ? 'sell' : 'buy';
        const wipedCrowd = wiped === 'buy' ? buyCrowd : sellCrowd;
        const tier = usd >= LIQ_MEGA ? 2 : usd >= LIQ_BIG ? 1 : 0;
        const L = I18N[lang];

        // regu eksekusi: makin besar posisi yang dilikuidasi, makin banyak yang tumbang sekaligus
        const killed = tier === 2 ? 16 : tier === 1 ? 9 : 4;
        fireVolley(winSide, tier === 0 ? 1 : 2, killed);

        // ledakan emas di wilayah yang tersapu — warna emas membedakannya dari tembakan biasa
        const mag = Math.min(1, Math.log10(usd / 1000 + 1) / 2.5);
        const bursts = tier + 1;
        let firstPos = null;
        for (let i = 0; i < bursts; i++) {
          const pos = groundPoint(wipedCrowd);
          explode(pos, i % 2 ? C_GOLD2 : C_GOLD, mag, tier === 2 ? 2 : 1);
          if (!firstPos) firstPos = pos;
        }

        const label = wiped === 'buy' ? L.liqLongs : L.liqShorts;
        if (firstPos) floatNum(firstPos, `☠ ${label} ${fmtUsd(usd)}`, 'liq');
        logLiquidation(wiped, usd, price, tier);

        if (tier === 0) addShake(1);
        else if (tier === 1) { addShake(2.4); addHitstop(.08); addFlash(.35, '#ffd98a'); }
        else {
          addShake(3.6); addHitstop(.1); addFlash(.6, '#ffd98a'); addSlowmo(.9);
          playChargeHorn();
          const now = performance.now();
          if (now - lastMega > MEGA_COOLDOWN) { lastMega = now; spawnBarrage(winSide, usd); }   // artileri menghabisi sisa barisan
        }
        // banner peristiwa dipanggil setelah artileri supaya teks likuidasi yang tampil, bukan teks barrage
        if (tier >= 1) showEvent(`${wiped === 'buy' ? L.liqEventLongs : L.liqEventShorts} · ${fmtUsd(usd)}`, winSide, tier === 2);
        bigMoment('liq', winSide, usd, price);
      }
