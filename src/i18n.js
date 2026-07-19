import { musicLabelEl, sfxLabelEl, syncAudioBtn } from './audio/audio.js';
import { feedState, retryBtn, setBadge } from './feed/market-feed.js';
import { lockText, lockUnit } from './input/interaction.js';
import { fsBtn, fsElement, syncWidgetsBtn } from './ui/controls.js';
import { renderRecord } from './ui/killfeed.js';

      /* ═══════════ BAHASA — EN/ID, default EN, tersimpan di localStorage ═══════════ */
      export const I18N = {
        en: {
          connecting: 'CONNECTING…', live: 'LIVE', dead: 'DISCONNECTED', retry: 'RECONNECT',
          fsEnter: 'Fullscreen', fsExit: 'Exit fullscreen',
          widgetsShow: 'Show widgets', widgetsHide: 'Hide widgets',
          pressureLabel: 'MARKET PRESSURE · 60s ·', long: 'BUY', short: 'SELL',
          ordersLong: 'buy orders', ordersShort: 'sell orders',
          camCinematic: 'CINEMATIC', camFollow: 'FOLLOW', camFree: 'FREE',
          keysLine1: '<b>drag</b> rotate · <b>scroll</b> zoom',
          keysLine2: '<b>1/2/3</b> camera · <b>WASD</b> pan · <b>Q/E</b> height',
          keysLine3: '<b>tap ground</b> rally · <b>tap soldier</b> follow',
          followBuy: 'FOLLOWING · BUYER', followSell: 'FOLLOWING · SELLER',
          followBigBuy: 'FOLLOWING · BIG BUY', followBigSell: 'FOLLOWING · BIG SELL',
          musicLabel: 'MUSIC', sfxLabel: 'SFX', muteTitle: 'Click to mute',
          bigBuy: 'BIG BUY ORDER', bigSell: 'BIG SELL ORDER',
          buyer: 'BUYERS', seller: 'SELLERS', streakSuffix: '× STREAK',
          streakSuffixT2: '× ON A TEAR', streakSuffixT3: '× UNSTOPPABLE',
          whaleTag: 'WHALE', liqTag: 'LIQUIDATION',
          topBuy: 'TOP BUY', topSell: 'TOP SELL',
          langBtnTitle: 'Switch language',
          shareBtn: 'SHARE MOMENT', momentSave: 'Save card', cardDownload: 'Download', cardShare: 'Share', cardClose: 'Close',
          momentWhaleBuy: 'WHALE BUY', momentWhaleSell: 'WHALE SELL', momentLiq: 'LIQUIDATION', momentSnap: 'BATTLE SNAPSHOT',
          momentToastWhale: 'Big whale spotted', momentToastLiq: 'Big liquidation',
          routBuyers: 'Buyers routed', routSellers: 'Sellers routed',
          airstrikeBuy: 'Buy airstrike inbound', airstrikeSell: 'Sell airstrike inbound',
          barrageBuy: 'Buy artillery barrage', barrageSell: 'Sell artillery barrage',
          lull: 'Market quiet · ceasefire', lullEnd: 'Battle resumes',
          audioMute: 'Mute sound', audioUnmute: 'Turn sound on',
        },
        id: {
          connecting: 'MENYAMBUNG…', live: 'LANGSUNG', dead: 'TERPUTUS', retry: 'SAMBUNG ULANG',
          fsEnter: 'Layar penuh', fsExit: 'Keluar layar penuh',
          widgetsShow: 'Tampilkan widget', widgetsHide: 'Sembunyikan widget',
          pressureLabel: 'TEKANAN PASAR · 60 DETIK ·', long: 'BELI', short: 'JUAL',
          ordersLong: 'order beli', ordersShort: 'order jual',
          camCinematic: 'SINEMATIK', camFollow: 'IKUTI', camFree: 'BEBAS',
          keysLine1: '<b>drag</b> putar · <b>scroll</b> zoom',
          keysLine2: '<b>1/2/3</b> kamera · <b>WASD</b> geser · <b>Q/E</b> tinggi',
          keysLine3: '<b>ketuk tanah</b> sorak · <b>ketuk prajurit</b> ikuti',
          followBuy: 'MENGIKUTI · PEMBELI', followSell: 'MENGIKUTI · PENJUAL',
          followBigBuy: 'MENGIKUTI · BELI BESAR', followBigSell: 'MENGIKUTI · JUAL BESAR',
          musicLabel: 'MUSIK', sfxLabel: 'EFEK', muteTitle: 'Klik untuk bisukan',
          bigBuy: 'ORDER BELI BESAR', bigSell: 'ORDER JUAL BESAR',
          buyer: 'PEMBELI', seller: 'PENJUAL', streakSuffix: '× BERUNTUN',
          streakSuffixT2: '× SEDANG PANAS', streakSuffixT3: '× TAK TERBENDUNG',
          whaleTag: 'PAUS', liqTag: 'LIKUIDASI',
          topBuy: 'BELI TERBESAR', topSell: 'JUAL TERBESAR',
          langBtnTitle: 'Ganti bahasa',
          shareBtn: 'BAGIKAN MOMEN', momentSave: 'Simpan kartu', cardDownload: 'Unduh', cardShare: 'Bagikan', cardClose: 'Tutup',
          momentWhaleBuy: 'PAUS BELI', momentWhaleSell: 'PAUS JUAL', momentLiq: 'LIKUIDASI', momentSnap: 'CUPLIKAN MEDAN',
          momentToastWhale: 'Paus besar terdeteksi', momentToastLiq: 'Likuidasi besar',
          routBuyers: 'Pembeli kabur', routSellers: 'Penjual kabur',
          airstrikeBuy: 'Serangan udara beli', airstrikeSell: 'Serangan udara jual',
          barrageBuy: 'Tembakan artileri beli', barrageSell: 'Tembakan artileri jual',
          lull: 'Pasar sunyi · gencatan', lullEnd: 'Pertempuran berlanjut',
          audioMute: 'Bisukan suara', audioUnmute: 'Nyalakan suara',
        },
      };
      export let lang = 'en';
      try { const saved = localStorage.getItem('bf-lang'); if (saved === 'en' || saved === 'id') lang = saved; } catch (e) { }
      const langBtn = document.getElementById('lang-btn');
      export function applyLanguage() {
        const L = I18N[lang];
        document.documentElement.lang = lang;
        langBtn.textContent = lang.toUpperCase();
        langBtn.title = L.langBtnTitle;
        retryBtn.textContent = L.retry;
        setBadge(feedState);
        fsBtn.title = fsElement() ? L.fsExit : L.fsEnter;
        syncWidgetsBtn();
        document.getElementById('pp-head-label').textContent = L.pressureLabel;
        document.getElementById('pp-long-word').textContent = L.long;
        document.getElementById('pp-short-word').textContent = L.short;
        document.getElementById('pp-long-orders').textContent = L.ordersLong;
        document.getElementById('pp-short-orders').textContent = L.ordersShort;
        const camLabels = [L.camCinematic, L.camFollow, L.camFree];
        document.querySelectorAll('.btn[data-m]').forEach(b => { b.textContent = camLabels[+b.dataset.m]; });
        document.getElementById('keys-hint').innerHTML = L.keysLine1 + '<br>' + L.keysLine2 + '<br>' + L.keysLine3;
        if (lockUnit) {   // segarkan teks lencana kunci saat bahasa berganti
          if (lockUnit.type === 'big') lockText.textContent = lockUnit.side === 'buy' ? L.followBigBuy : L.followBigSell;
          else lockText.textContent = lockUnit.side === 'buy' ? L.followBuy : L.followSell;
        }
        musicLabelEl.textContent = L.musicLabel; musicLabelEl.title = L.muteTitle;
        sfxLabelEl.textContent = L.sfxLabel; sfxLabelEl.title = L.muteTitle;
        syncAudioBtn();   // segarkan title/aria toggle audio saat bahasa berganti
        document.getElementById('share-btn').textContent = L.shareBtn;
        renderRecord('buy'); renderRecord('sell');
      }
      langBtn.onclick = () => {
        lang = lang === 'en' ? 'id' : 'en';
        try { localStorage.setItem('bf-lang', lang); } catch (e) { }
        applyLanguage();
      };

