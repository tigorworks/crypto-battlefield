import { releaseLock } from './interaction.js';
import { fieldState } from '../world/field.js';

      /* ═══════════ CAMERA ═══════════ */
      export let camMode = 0;
      export const orbit = { theta: .22, phi: .4, radius: 540, target: new THREE.Vector3(0, 10, 0) };
      export const _camTgt = new THREE.Vector3();
      /* mode SINEMATIK: beberapa preset shot yang bergantian tiap belasan detik, menyatu lewat lerp
         supaya terasa seperti editor memotong-motong sudut kamera, bukan satu kamera yang goyang terus */
      function cineWide(lt, t, frontX, dur) {
        const portrait = innerHeight > innerWidth;
        return {
          theta: .22 + Math.sin(t * .05) * .12, phi: .4 + Math.sin(t * .08) * .03,
          radius: 560 + Math.abs(frontX) * (portrait ? 1.7 : 1.1), tx: frontX * .6, ty: 10, tz: 0
        };
      }
      function cineClash(lt, t, frontX, dur) {                          // dolly rendah menyusuri garis bentrok
        const sweep = Math.sin(lt / dur * Math.PI * 2) * 90;
        return {
          theta: Math.PI / 2 + Math.sin(lt * .15) * .2, phi: .17 + Math.sin(lt * .2) * .02,
          radius: 230, tx: frontX, ty: 7, tz: sweep
        };
      }
      function cineTrack(lt, t, frontX, dur) {                          // dari belakang pasukan yang sedang menang
        const side = fieldState.buyShare >= 0.5 ? -1 : 1;
        const baseTheta = side < 0 ? -1.3 : 1.3;
        return {
          theta: baseTheta + Math.sin(lt * .25) * .2, phi: .2 + Math.sin(lt * .3) * .025,
          radius: 300, tx: frontX - side * 25, ty: 12, tz: Math.sin(lt * .2) * 55
        };
      }
      function cineAerial(lt, t, frontX, dur) {                         // sapuan tinggi ala drone
        return {
          theta: -.6 + (lt / dur) * 1.8, phi: .56 + Math.sin(lt * .1) * .03,
          radius: 760 + Math.abs(frontX) * .6, tx: frontX * .4, ty: 10, tz: 0
        };
      }
      export const CINE_SHOTS = [
        { run: cineWide, dur: 18 },
        { run: cineClash, dur: 12 },
        { run: cineTrack, dur: 14 },
        { run: cineAerial, dur: 16 },
      ];
export const camState = { cineIdx: 0, cineShotStart: 0 };
      export const followPos = new THREE.Vector3(0, 10, 0);
      export const keys = {};
      export function setCamMode(m) {
        camMode = m;
        if (typeof releaseLock === 'function') releaseLock();   // ambil alih kamera → lepas kunci unit
        document.querySelectorAll('.btn[data-m]').forEach(b => b.classList.toggle('active', +b.dataset.m === m));
      }
      document.querySelectorAll('.btn[data-m]').forEach(b => b.onclick = () => setCamMode(+b.dataset.m));

