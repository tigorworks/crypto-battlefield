import { playChargeHorn } from '../audio/audio.js';
import { bigUnitObjs, groundPoint } from '../combat/bullets.js';
import { scene } from '../core/renderer.js';
import { UNIT_BASE_SCALE, makeBomber } from './big-units.js';
import { buyCrowd, sellCrowd } from './soldiers.js';
import { addFlash, addShake, addSlowmo } from '../fx/juice.js';
import { I18N, lang } from '../i18n.js';
import { showEvent } from '../ui/event-ticker.js';

      /* ═══════════ SERANGAN UDARA — peristiwa langka untuk order raksasa (≥ T_BOSS) ═══════════
         pembom raksasa melintas tinggi menembus barisan lawan sambil menjatuhkan bom beruntun;
         dipadukan gerak lambat sinematik, kilat layar & guncangan besar. */
      export const airstrikes = [];
      let lastAirstrike = -1e9;
      export function spawnAirstrike(side, usd) {
        const now = performance.now();
        if (now - lastAirstrike < 9000 || airstrikes.length) return;   // sangat langka — jangan spam
        lastAirstrike = now;
        const defender = side === 'buy' ? sellCrowd : buyCrowd;
        const ownSign = side === 'buy' ? -1 : 1;
        const z0 = (Math.random() - .5) * 130;
        const from = new THREE.Vector3(ownSign * 280, 150, z0);
        const to = new THREE.Vector3(-ownSign * 280, 150, z0);
        const obj = makeBomber(side);
        const sc = UNIT_BASE_SCALE.bomber * 1.9;   // jauh lebih besar dari pembom biasa
        obj.scale.set(sc, sc, sc);
        obj.rotation.y = side === 'buy' ? 0 : Math.PI;
        obj.position.copy(from);
        scene.add(obj); bigUnitObjs.push(obj);
        const drops = [];
        for (let k = 0; k < 7; k++) drops.push(.34 + k * .075);   // fraksi lintasan tempat bom jatuh
        airstrikes.push({ obj, from, to, t: 0, dur: 3.2, side, defender, drops, dropped: 0, z0 });
        // sentuhan sinematik
        addSlowmo(1.2); addFlash(.5, '#fff2c8'); addShake(3.4);
        playChargeHorn();
        showEvent(side === 'buy' ? I18N[lang].airstrikeBuy : I18N[lang].airstrikeSell, side, true);
      }

      /* ═══════════ TEMBAKAN ARTILERI — varian lain peristiwa langka untuk order raksasa (≥ T_BOSS):
         rentetan mortir jatuh dari langit ke wilayah lawan tanpa unit pembom, supaya order boss
         tak selalu terlihat sama seperti serangan udara. ═══════════ */
      export const barrages = [];
      let lastBarrage = -1e9;
      export function spawnBarrage(side, usd) {
        const now = performance.now();
        if (now - lastBarrage < 9000 || barrages.length) return;   // sangat langka — jangan spam
        lastBarrage = now;
        const defender = side === 'buy' ? sellCrowd : buyCrowd;
        const shells = [];
        let tCursor = .5;
        for (let k = 0; k < 6; k++) { tCursor += .32 + Math.random() * .18; shells.push({ at: tCursor, pos: groundPoint(defender) }); }
        const b = { t: 0, dur: shells[shells.length - 1].at + .7, shells, done: 0, side, defender, curPos: shells[0].pos.clone() };
        barrages.push(b);
        addSlowmo(1.0); addFlash(.42, '#ffe8c8'); addShake(2.8);
        playChargeHorn();
        showEvent(side === 'buy' ? I18N[lang].barrageBuy : I18N[lang].barrageSell, side, true);
      }

