import { C_GOLD, C_GOLD2 } from '../config.js';
import { emitPuff, makeSpark } from '../combat/bullets.js';
import { explode } from '../combat/explosions.js';
import { GLOW } from '../core/assets.js';
import { scene } from '../core/renderer.js';
import { addFlash, addShake, floatNum } from '../fx/juice.js';
import { killSoldier } from './soldiers.js';
import { spawnSkull } from '../world/sky.js';

      /* ═══════════ BOLA API — senjata khusus T-Rex ═══════════
         Kebalikan dari tracer unit besar lain yang menyembur tiap 0.16 detik: bola api dilontarkan
         jarang dan jatahnya cuma 3–5 kali seumur hidup unit (lihat UNIT_WEAPON di big-units.js),
         tapi tiap tumbukan sekelas bom serangan udara — ledakan tier 2 lengkap dengan kawah, puing,
         guncangan layar, dan korban jauh lebih banyak daripada satu peluru.

         Modul ini hanya memiliki kolam & pemunculan + peledakannya; lintasannya dimajukan game loop
         di main.js, mengikuti pola yang sama dengan airstrike/barrage. */
      export const fireballs = [];
      const MAXFIREBALLS = 24;
      /* dua sprite aditif bertumpuk: cangkang jingga besar + inti putih-panas kecil di dalamnya.
         material dibuat sekali & dipakai bersama semua bola api (sama seperti material unit besar) */
      const FB_SHELL_MAT = new THREE.SpriteMaterial({ map: GLOW, color: 0xff6a1e, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const FB_CORE_MAT = new THREE.SpriteMaterial({ map: GLOW, color: 0xffe0a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      export const FB_SHELL_SIZE = 30, FB_CORE_SIZE = 15;

      export function spawnFireball(side, from, to, defender) {
        if (fireballs.length >= MAXFIREBALLS) return;
        const g = new THREE.Group();
        const shell = new THREE.Sprite(FB_SHELL_MAT); shell.scale.set(FB_SHELL_SIZE, FB_SHELL_SIZE, 1);
        const core = new THREE.Sprite(FB_CORE_MAT); core.scale.set(FB_CORE_SIZE, FB_CORE_SIZE, 1);
        g.add(shell); g.add(core);
        g.position.copy(from);
        scene.add(g);
        const dist = from.distanceTo(to);
        fireballs.push({
          g, core, shell, defender, side,
          from: from.clone(), to: to.clone(),
          t: 0, dur: .5 + dist / 640,        // dilempar, bukan ditembak — makin jauh sasaran makin lama melayang
          apex: 24 + dist * .07,             // lengkung lintasan ikut jarak supaya busurnya konsisten
          trailT: 0, phase: Math.random() * Math.PI * 2
        });
      }

      /* Korban per tumbukan dipatok dari total sepanjang hidup unit, bukan dari "rasanya besar":
         tank menembak ~30 kali × 3 korban ≈ 90 korban seumur hidupnya, jadi bola api yang cuma
         keluar 3–5 kali butuh belasan korban sekali hantam supaya T-Rex tidak jadi unit paling
         lemah di tingkatnya justru karena tembakannya paling jarang. Angka ini tetap di bawah
         total satu serangan udara (7 bom × 5), sehingga peristiwa langka tetap yang terbesar. */
      export const FB_KILLS = 14;
      export function detonateFireball(f) {
        const p = f.g.position;
        explode(p, C_GOLD2, 1, 2);           // tier 2 → kawah, puing, dentuman & partikel terbesar
        makeSpark(p, C_GOLD, 46, .45);
        killSoldier(f.defender, FB_KILLS);
        spawnSkull(p);
        floatNum(p, '-' + FB_KILLS, f.side === 'buy' ? 'up' : 'dn');   // angka korban, sama seperti peluru unit besar
        for (let i = 0; i < 6; i++)          // lidah api lalu asap gelap yang membumbung dari titik jatuh
          emitPuff(p.x + (Math.random() - .5) * 20, 2, p.z + (Math.random() - .5) * 20,
            i < 3 ? 0xff8a3c : 0x2b2b30, 16 + Math.random() * 14, 1.2 + Math.random() * .6, 16, .6, i < 3);
        addShake(1.9); addFlash(.3, '#ffb066');
        scene.remove(f.g);
      }
