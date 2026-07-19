import { C_GOLD, C_GOLD2, STREAM, T_BOSS, T_HEAVY, T_SHELL, T_WHALE } from '../config.js';
import { fireVolley } from '../combat/bullets.js';
import { explode } from '../combat/explosions.js';
import { spawnAirstrike, spawnBarrage } from '../entities/airstrike.js';
import { spawnBigUnit } from '../entities/big-units.js';
import { buyCrowd, sellCrowd } from '../entities/soldiers.js';
import { addHitstop, addShake, bumpStreak } from '../fx/juice.js';
import { I18N, lang } from '../i18n.js';
import { considerRecord, logKill } from '../ui/killfeed.js';
import { flow, meterUpdate } from '../ui/market-pressure.js';
import { bigMoment } from '../ui/moments.js';

      /* ═══════════ DATA FEED — REAL (Binance) atau DUMMY (simulasi lokal) ═══════════ */
      const priceEl = document.getElementById('cp-value');
      const cpPctEl = document.getElementById('cp-pct');
      const badgeEl = document.getElementById('feed-badge');
      const badgeTextEl = document.getElementById('feed-text');
      export const retryBtn = document.getElementById('retry');

      export let price = NaN, lastPrice = NaN, pct24 = 0;
      let ws = null, wsLiq = null, wsTicker = null, live = false, retries = 0, connectGuard = null;

      /* persentase perubahan 24 jam dari ticker Binance (bukan sejak halaman dibuka) */
      function updatePct() {
        cpPctEl.textContent = (pct24 >= 0 ? '▲ ' : '▼ ') + Math.abs(pct24).toFixed(2) + '%';
        cpPctEl.className = pct24 >= 0 ? 'up' : 'down';
      }

      function onTrade(p, qty, isBuy) {
        lastPrice = price; price = p;
        const usd = p * qty;
        flow.push({ t: performance.now(), usd, buy: isBuy });
        priceEl.textContent = '$' + p.toLocaleString('en-US', { maximumFractionDigits: p < 10 ? 4 : 2 });
        if (p > lastPrice) priceEl.className = 'up';        // harga naik → hijau
        else if (p < lastPrice) priceEl.className = 'down'; // harga turun → merah
        // harga sama → warna dipertahankan

        const side = isBuy ? 'buy' : 'sell';
        const defender = isBuy ? sellCrowd : buyCrowd;
        const tier = usd >= T_WHALE ? 2 : usd >= T_HEAVY ? 1 : 0;
        const killed = tier === 2 ? 14 : tier === 1 ? 6 : 2;
        bumpStreak(side);
        if (usd >= T_WHALE) {
          spawnBigUnit(side, usd);
          fireVolley(side, 2, Math.min(killed, 16));
          addShake(2.2); addHitstop(.09);
          if (usd >= T_BOSS) { if (Math.random() < .5) spawnAirstrike(side, usd); else spawnBarrage(side, usd); }   // order raksasa → variasi peristiwa langka
          bigMoment('whale', side, usd, p);
        } else if (usd >= T_SHELL) {
          fireVolley(side, tier, killed);        // peluru yang membunuh saat mendarat
          if (tier === 1) addShake(.5);
        }
        // order debu (<T_SHELL): hanya menambah tekanan/jumlah, tidak membunuh tanpa peluru
        logKill(side, qty, p, tier === 2 ? 'whale' : null);
        considerRecord(side, usd, qty, p);
      }

      export let feedState = 'connecting';
      export function setBadge(state) {
        feedState = state;
        const L = I18N[lang];
        badgeEl.className = 'hud' + (state === 'connecting' ? '' : ' ' + state);
        badgeTextEl.textContent = state === 'live' ? L.live : state === 'dead' ? L.dead : L.connecting;
        retryBtn.style.display = state === 'dead' ? 'inline-block' : 'none';
      }

      /* ═══════════ SUMBER DATA — utama Binance Vision, otomatis pindah ke Gate.io ═══════════ */
      /* Sebagian ISP (mis. Indonesia) memblokir stream.binance.com. data-stream.binance.vision
         adalah domain data-pasar resmi Binance (format identik) yang biasanya lolos; kalau pun
         itu gagal, kita jatuh ke Gate.io. */
      const FEEDS = [
        { name: 'Binance Vision', go: connectBinanceVision },
        { name: 'Gate.io', go: connectGate },
      ];
      let feedIdx = 0;

      function markLive() {
        if (live) return;
        live = true; retries = 0;
        if (connectGuard) { clearTimeout(connectGuard); connectGuard = null; }
        setBadge('live');
      }

      function connectBinanceVision() {
        ws = new WebSocket(`wss://data-stream.binance.vision/ws/${STREAM}@aggTrade`);
        ws.onmessage = (ev) => {
          markLive();
          try { const d = JSON.parse(ev.data); onTrade(parseFloat(d.p), parseFloat(d.q), d.m === false); } catch (e) { } /* m=false → taker beli */
        };
        ws.onerror = () => { if (!live) failover(); };
        ws.onclose = () => { if (live) { live = false; setBadge('dead'); autoRetry(); } };

        wsTicker = new WebSocket(`wss://data-stream.binance.vision/ws/${STREAM}@ticker`);
        wsTicker.onmessage = (ev) => { try { const d = JSON.parse(ev.data); pct24 = parseFloat(d.P); updatePct(); } catch (e) { } };

        /* likuidasi futures — fstream sering diblokir; dicoba saja, diabaikan bila gagal */
        try {
          wsLiq = new WebSocket(`wss://fstream.binance.com/ws/${STREAM}@forceOrder`);
          wsLiq.onmessage = (ev) => {
            try {
              const o = JSON.parse(ev.data).o;
              const qty = parseFloat(o.q);
              const liqPrice = parseFloat(o.ap);
              const usd = liqPrice * qty;
              const isBuy = o.S === 'BUY'; /* BUY = short terlikuidasi */
              const side = isBuy ? 'buy' : 'sell';
              const n = usd >= T_WHALE ? 10 : 4;
              fireVolley(side, usd >= T_WHALE ? 2 : 1, n);
              const pos = new THREE.Vector3((side === 'buy' ? 1 : -1) * (20 + Math.random() * 80), 0, (Math.random() - .5) * 200);
              explode(pos, isBuy ? C_GOLD : C_GOLD2, Math.min(1, Math.log10(usd / 1000 + 1) / 2.5), usd >= T_WHALE ? 2 : 1);
              logKill(side, qty, liqPrice, 'liq');
              bigMoment('liq', side, usd, liqPrice);
            } catch (e) { }
          };
        } catch (e) { }
      }

      function connectGate() {
        ws = new WebSocket('wss://api.gateio.ws/ws/v4/');
        ws.onopen = () => {
          const t = Math.floor(Date.now() / 1000);
          try {
            ws.send(JSON.stringify({ time: t, channel: 'spot.trades', event: 'subscribe', payload: ['BTC_USDT'] }));
            ws.send(JSON.stringify({ time: t, channel: 'spot.tickers', event: 'subscribe', payload: ['BTC_USDT'] }));
          } catch (e) { }
        };
        ws.onmessage = (ev) => {
          try {
            const d = JSON.parse(ev.data);
            if (d.event !== 'update' || !d.result) return;          /* abaikan ack langganan */
            if (d.channel === 'spot.trades') {
              markLive();
              const r = d.result;
              onTrade(parseFloat(r.price), parseFloat(r.amount), r.side === 'buy'); /* side = sisi taker */
            } else if (d.channel === 'spot.tickers') {
              pct24 = parseFloat(d.result.change_percentage); updatePct();
            }
          } catch (e) { }
        };
        ws.onerror = () => { if (!live) failover(); };
        ws.onclose = () => { if (live) { live = false; setBadge('dead'); autoRetry(); } };
      }

      export function connect() {
        disconnect();
        setBadge('connecting');
        try { FEEDS[feedIdx].go(); }
        catch (e) { failover(); return; }
        connectGuard = setTimeout(() => { if (!live) failover(); }, 6000);   // tak ada data → coba sumber lain
      }
      function failover() {
        if (connectGuard) { clearTimeout(connectGuard); connectGuard = null; }
        disconnect();
        if (feedIdx < FEEDS.length - 1) { feedIdx++; connect(); }         // coba sumber berikutnya
        else { feedIdx = 0; setBadge('dead'); autoRetry(); }             // semua gagal → jeda lalu ulang
      }
      function disconnect() {
        live = false;
        if (connectGuard) { clearTimeout(connectGuard); connectGuard = null; }
        for (const s of [ws, wsLiq, wsTicker]) {
          if (s) { s.onopen = null; s.onclose = null; s.onerror = null; s.onmessage = null; try { s.close(); } catch (e) { } }
        }
        ws = wsLiq = wsTicker = null;
      }
      function autoRetry() {
        if (retries >= 5) return;
        retries++;
        setTimeout(() => { if (!live) { feedIdx = 0; connect(); } }, 4000);  // ulang dari sumber utama
      }
      retryBtn.onclick = () => { retries = 0; feedIdx = 0; connect(); };

      /* stats tiap detik */
      setInterval(meterUpdate, 1000);

