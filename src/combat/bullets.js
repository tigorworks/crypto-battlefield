import { C_LONG, C_SHORT } from '../config.js';
import { playVolley } from '../audio/audio.js';
import { GLOW } from '../core/assets.js';
import { scene } from '../core/renderer.js';
import { buyCrowd, sellCrowd } from '../entities/soldiers.js';
import { fieldState } from '../world/field.js';

      /* ═══════════ TEMBAK-TEMBAKAN — peluru pelacak, kilatan moncong & percikan ═══════════ */
      export const bullets = [], sparks = [], bigUnitObjs = [];
      export let lastFireT = 0;   // waktu tembakan terakhir (ms) — agar tak pernah ada jeda kosong
      // tekstur tracer: gradien memanjang — inti terang di kepala, memudar jadi ekor komet
      const TRACER_TEX = (() => {
        const c = document.createElement('canvas'); c.width = 8; c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, 64);   // v=0 (kepala/atas) → v=1 (ekor/bawah)
        grad.addColorStop(0.00, 'rgba(255,255,255,1)');
        grad.addColorStop(0.12, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1.00, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 8, 64);
        const tex = new THREE.CanvasTexture(c);
        return tex;
      })();
      // silinder ramping sepanjang +x (kepala di +x) — di-skala len×w×w saat terbang
      const bulletGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true);
      bulletGeo.rotateZ(-Math.PI / 2);   // sumbu Y→X: kepala tracer di +x (searah kecepatan)
      const bulletMat = {
        buy: new THREE.MeshBasicMaterial({ map: TRACER_TEX, color: 0x9dffe0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
        sell: new THREE.MeshBasicMaterial({ map: TRACER_TEX, color: 0xffb4c6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      };
      export const AXIS_X = new THREE.Vector3(1, 0, 0);
      export const _bq = new THREE.Quaternion(), _bdir = new THREE.Vector3();
      const MAXBULLETS = 360, MAXSPARKS = 200;

      export function makeSpark(pos, color, size, dur) {
        if (sparks.length >= MAXSPARKS) return;
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        spr.position.copy(pos); spr.scale.set(size, size, 1);
        scene.add(spr);
        sparks.push({ spr, t: 0, dur, size });
      }

      /* ═══════════ KEPULAN — kontrail jet/bomber & asap saat unit jatuh ═══════════
         satu kolam sprite dipakai bersama: kontrail (aditif, terang) & asap kematian (normal, gelap). */
      export const puffs = [];
      const MAXPUFFS = 200;
      export function emitPuff(x, y, z, color, size, dur, rise, peak, additive) {
        if (puffs.length >= MAXPUFFS) { const old = puffs.shift(); scene.remove(old.spr); old.spr.material.dispose(); }
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, fog: false }));
        spr.position.set(x, y, z); spr.scale.set(size, size, 1);
        scene.add(spr);
        puffs.push({ spr, t: 0, dur, size, rise, peak, drift: (Math.random() - .5) * 6 });
      }

      /* ═══════════ KILATAN MONCONG — kolam kecil PointLight (jumlah tetap → tak memicu rekompilasi shader),
         didenyutkan saat unit besar / salvo menembak supaya moncong benar-benar menyorot sekitarnya. ═══════════ */
      export const muzzleLights = [];
      for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 150, 2); scene.add(l); muzzleLights.push({ l, t: 0, dur: 1, peak: 0 }); }
      let mlIdx = 0;
      function flashLight(pos, color, peak, dur) {
        const ml = muzzleLights[mlIdx = (mlIdx + 1) % muzzleLights.length];
        ml.l.color.setHex(color); ml.l.position.set(pos.x, pos.y + 2, pos.z);
        ml.l.intensity = peak; ml.t = dur; ml.dur = dur; ml.peak = peak;
      }
      export function fireBullet(side, from, to, kills, defender, big) {
        if (bullets.length >= MAXBULLETS) { const old = bullets.shift(); scene.remove(old.m); } // buang tertua, jangan berhenti menembak
        const m = new THREE.Mesh(bulletGeo, bulletMat[side]);
        m.position.copy(from);
        scene.add(m);
        lastFireT = performance.now();
        const vel = to.clone().sub(from); const dist = vel.length(); vel.normalize();
        const col = side === 'buy' ? C_LONG : C_SHORT;
        bullets.push({
          m, pos: from.clone(), vel, speed: (big ? 520 : 640) + Math.random() * 180, kills, defender, side,
          target: to.clone(), traveled: 0, dist, color: col,
          len: big ? 46 : 16, w: big ? 2.1 : .55, big: !!big
        });
        if (big) { makeSpark(from, col, 26, .2); flashLight(from, col, 6, .13); }   // ledakan moncong unit besar + sorotan
        else { if (Math.random() < .6) makeSpark(from, col, 10, .1); if (Math.random() < .12) flashLight(from, col, 2.2, .08); }
      }
      /* titik di posisi pasukan saat ini — ikut garis depan yang bergerak */
      export function crowdPoint(crowd, jitter) {
        const bias = crowd.pressBias || 0;
        const N = crowd.slots.length, start = Math.floor(Math.random() * N);
        let s = null;
        for (let k = 0; k < N; k++) { const c = crowd.slots[(start + k) % N]; if (c.active && !c.dying) { s = c; break; } }
        if (s) s.recoilT = .15;   // prajurit ini yang menembak → picu animasi recoil singkat
        let x, z;
        if (s) { x = s.base.x + bias; z = s.base.z; }
        else { x = crowd.sign * (40 + Math.random() * 80) + bias; z = (Math.random() - .5) * 230; }
        // tetap di sisi pasukannya sendiri terhadap garis depan (sama seperti clamp prajurit)
        if (crowd.sign < 0) x = Math.min(x, fieldState.frontX - 16); else x = Math.max(x, fieldState.frontX + 16);
        return new THREE.Vector3(x + (Math.random() - .5) * jitter, 5 + Math.random() * 3, z + (Math.random() - .5) * jitter);
      }
      /* titik tanah kosong di sisi lawan — target peluru yang TIDAK membunuh (meleset ke tanah) */
      export function groundPoint(defender) {
        const bias = defender.pressBias || 0;
        let x = defender.sign * (50 + Math.random() * 150) + bias;
        if (defender.sign < 0) x = Math.min(x, fieldState.frontX - 22); else x = Math.max(x, fieldState.frontX + 22);
        return new THREE.Vector3(x, 1.4, (Math.random() - .5) * 260);
      }
      export function fireVolley(side, tier, killed) {
        const attacker = side === 'buy' ? buyCrowd : sellCrowd;
        const defender = side === 'buy' ? sellCrowd : buyCrowd;
        const n = killed + (tier === 2 ? 3 : 1);   // sebagian besar peluru mengenai prajurit; hanya sedikit yang meleset
        let firePos = null;
        for (let i = 0; i < n; i++) {
          const kills = i < killed;
          const from = crowdPoint(attacker, 8);                              // dari prajurit penyerang
          const to = kills ? crowdPoint(defender, 10) : groundPoint(defender); // yang membunuh → prajurit, meleset → tanah
          fireBullet(side, from, to, kills, defender);
          firePos = from;
        }
        playVolley(tier, firePos);
      }
      /* tembakan latar saat pasar sepi — mengisi jeda supaya baku tembak tak pernah kosong.
         hanya visual (tidak membunuh) agar jumlah pasukan tetap mewakili persentase buy/sell. */
      export function ambientFire() {
        for (const side of ['buy', 'sell']) {
          const attacker = side === 'buy' ? buyCrowd : sellCrowd;
          const defender = side === 'buy' ? sellCrowd : buyCrowd;
          if (attacker.count <= 0) continue;
          const n = 1 + (Math.random() < .4 ? 1 : 0);   // sedikit saja — cukup agar tak sepi, tidak boros peluru
          for (let i = 0; i < n; i++) fireBullet(side, crowdPoint(attacker, 8), groundPoint(defender), false, defender);  // ke tanah, tidak kena prajurit
        }
        playVolley(0);
      }
