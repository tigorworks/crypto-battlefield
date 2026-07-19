import { playBoom } from '../audio/audio.js';
import { GLOW, ringGeo } from '../core/assets.js';
import { scene } from '../core/renderer.js';
import { lastImpact } from '../entities/big-units.js';

      /* ═══════════ LEDAKAN ═══════════ */
      export const booms = [], rings = [];

      /* ═══════════ KAWAH & PUING — bekas ledakan tank/pesawat/bom, tersisa di tanah lalu meredup ═══════════ */
      export const craters = [], debris = [];
      function craterTexture() {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        r.addColorStop(0, 'rgba(18,15,13,.85)');
        r.addColorStop(.45, 'rgba(26,21,17,.6)');
        r.addColorStop(.75, 'rgba(30,26,20,.26)');
        r.addColorStop(1, 'rgba(30,26,20,0)');
        g.fillStyle = r; g.fillRect(0, 0, 128, 128);
        g.fillStyle = 'rgba(14,11,9,.55)';   // percikan gosong tak beraturan di sekitar inti
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 26;
          g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 6 + Math.random() * 10, 0, Math.PI * 2); g.fill();
        }
        return new THREE.CanvasTexture(c);
      }
      const CRATER_TEX = craterTexture();
      const craterGeo = new THREE.PlaneGeometry(1, 1);
      const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
      const debrisMatBase = new THREE.MeshLambertMaterial({ color: 0x2a2a2e, transparent: true });

      function spawnCrater(pos, mag) {
        const s = 16 + mag * 26;
        const m = new THREE.Mesh(craterGeo, new THREE.MeshBasicMaterial({ map: CRATER_TEX, transparent: true, opacity: .85, depthWrite: false, fog: false }));
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = Math.random() * Math.PI * 2;
        m.scale.set(s, s, 1);
        m.position.set(pos.x, .5, pos.z);
        scene.add(m);
        craters.push({ m, t: 0, dur: 5 + mag * 3 });
      }

      function spawnDebris(pos, mag) {
        const n = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const sc = new THREE.Vector3(.8 + Math.random() * 1.6, .6 + Math.random() * 1.4, .8 + Math.random() * 1.6);
          const m = new THREE.Mesh(debrisGeo, debrisMatBase.clone());
          m.scale.copy(sc);
          m.position.set(pos.x, pos.y + 2, pos.z);
          scene.add(m);
          const a = Math.random() * Math.PI * 2, e = .25 + Math.random() * .5;
          const sp = 14 + Math.random() * (18 + mag * 20);
          debris.push({
            m, t: 0, dur: 2.2 + Math.random() * 1.2, baseScale: sc, bounced: false,
            vel: new THREE.Vector3(Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * 1.3, Math.sin(a) * Math.cos(e) * sp),
            spin: new THREE.Vector3((Math.random() - .5) * 6, (Math.random() - .5) * 6, (Math.random() - .5) * 6)
          });
        }
      }

      export function explode(pos, color, mag, tier) {
        const n = 22 + Math.floor(mag * (tier === 2 ? 90 : 36));
        const geo = new THREE.BufferGeometry();
        const px = new Float32Array(n * 3), vel = [];
        for (let i = 0; i < n; i++) {
          px[i * 3] = pos.x; px[i * 3 + 1] = pos.y + 2; px[i * 3 + 2] = pos.z;
          const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * .5;
          const sp = 20 + Math.random() * (40 + mag * (tier === 2 ? 110 : 55));
          vel.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * 1.4, Math.sin(a) * Math.cos(e) * sp));
        }
        geo.setAttribute('position', new THREE.BufferAttribute(px, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 2.5 + mag * (tier === 2 ? 6 : 3), map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        scene.add(pts);
        booms.push({ pts, vel, t: 0, dur: .6 + mag * (tier === 2 ? .8 : .5) });

        const rm = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        rm.rotation.x = -Math.PI / 2;
        rm.position.copy(pos); rm.position.y = 1.2;
        scene.add(rm);
        rings.push({ rm, t: 0, dur: tier === 2 ? .85 : .5, max: (tier === 2 ? 32 : 10) + mag * 20 });

        if (mag > .45 || tier === 2) {
          const l = new THREE.PointLight(color, 3 + mag * (tier === 2 ? 10 : 5), 400 + mag * 700, 2);
          l.position.copy(pos); l.position.y = 30;
          scene.add(l);
          setTimeout(() => scene.remove(l), tier === 2 ? 400 : 220);
        }
        if (tier === 2) { spawnCrater(pos, mag); spawnDebris(pos, mag); }   // kawah & puing hanya untuk tank/pesawat/bom, bukan tiap tembakan kecil
        lastImpact.copy(pos);
        playBoom(mag, tier, pos);
      }

