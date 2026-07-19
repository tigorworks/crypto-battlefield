import { GLOW } from '../core/assets.js';
import { SKY, scene } from '../core/renderer.js';

      /* ═══════════ LANGIT & CUACA DINAMIS — ikut skyState.mood pasar ═══════════ */
export const skyState = { mood: 0, moodTarget: 0, lull: 0, lullActive: false, boltT: 0, lightningT: 6 + Math.random() * 3, nextStarCheck: 30 + Math.random() * 40 };
      export const SKY_STORM = new THREE.Color(0x2b3542), SKY_CALM = new THREE.Color(SKY), SKY_PUMP = new THREE.Color(0xffd9a3);
      export const SKY_NIGHT = new THREE.Color(0x0b1230);
      export const _sky = new THREE.Color();
      export const DAY_PERIOD = 240;   // detik untuk satu siklus siang→malam penuh — malam bikin tracer & ledakan menonjol
      function weatherPoints(n, color, size, additive) {
        const g = new THREE.BufferGeometry();
        const p = new Float32Array(n * 3), v = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          p[i * 3] = (Math.random() - .5) * 900; p[i * 3 + 1] = Math.random() * 320; p[i * 3 + 2] = (Math.random() - .5) * 700;
          v[i] = .5 + Math.random();
        }
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0, depthWrite: false });
        if (additive) mat.blending = THREE.AdditiveBlending;
        const m = new THREE.Points(g, mat); scene.add(m);
        return { m, v, n, attr: g.attributes.position };
      }
      export const rain = weatherPoints(520, 0xcfe0ff, 2.2, false);
      export const embers = weatherPoints(280, 0xffc46b, 3.4, true);

      /* ═══════════ AURORA — pita cahaya hijau-teal muncul tinggi di langit saat pump kuat ═══════════ */
      function auroraTexture() {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d');
        const vg = g.createLinearGradient(0, 0, 0, 256);
        vg.addColorStop(0, 'rgba(60,255,190,0)');
        vg.addColorStop(.35, 'rgba(70,255,180,.5)');
        vg.addColorStop(.6, 'rgba(120,255,210,.3)');
        vg.addColorStop(1, 'rgba(60,255,190,0)');
        g.fillStyle = vg; g.fillRect(0, 0, 256, 256);
        // pudarkan tepi kiri-kanan lewat 'destination-in' — tanpa ini siluetnya jadi kotak keras, bukan pita berkabut
        g.globalCompositeOperation = 'destination-in';
        const hg = g.createLinearGradient(0, 0, 256, 0);
        hg.addColorStop(0, 'rgba(255,255,255,0)');
        hg.addColorStop(.3, 'rgba(255,255,255,1)');
        hg.addColorStop(.7, 'rgba(255,255,255,1)');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = hg; g.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(c);
      }
      const AURORA_TEX = auroraTexture();
      function makeAuroraRibbon(x, z, w, h, speed, phase) {
        const geo = new THREE.PlaneGeometry(w, h, 24, 1);
        const mat = new THREE.MeshBasicMaterial({ map: AURORA_TEX, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, 160, z); scene.add(m);   // cukup rendah supaya masuk bidang pandang kamera, bukan terpotong tepi atas layar
        return { m, speed, phase, base: geo.attributes.position.array.slice() };
      }
      // disebar di sumbu x (bukan ditumpuk lurus di belakang satu sama lain) supaya blending aditifnya tak saling menumpuk jadi kotak putih pekat
      export const aurora = [
        makeAuroraRibbon(-40, -850, 620, 200, .6, 0),
        makeAuroraRibbon(340, -900, 520, 170, .8, 2.1),
        makeAuroraRibbon(-360, -800, 480, 150, .5, 4.4),
      ];

      /* ═══════════ KABUT BADAI RENDAH — merayap di tanah, menebal saat dump keras ═══════════ */
      function fogLayer(y, weight, speed) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900),
          new THREE.MeshBasicMaterial({ color: 0x717d8a, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m);
        return { m, weight, speed };
      }
      export const stormFog = [fogLayer(14, 1, .12), fogLayer(28, 1.3, .08), fogLayer(42, .8, .16)];

      /* ═══════════ BAYANGAN AWAN — melintas pelan lewat lapangan saat pasar tenang ═══════════ */
      function cloudShadow(z, w, speed) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * .55),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(-500, .6, z); scene.add(m);
        return { m, speed };
      }
      export const cloudShadows = [cloudShadow(-60, 260, 9), cloudShadow(120, 340, 6.4), cloudShadow(-180, 220, 11)];

      /* ═══════════ BULAN & PETIR — untuk siklus malam & badai (dump keras) ═══════════ */
      export const moonMat = new THREE.SpriteMaterial({ map: GLOW, color: 0xd4e2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const moon = new THREE.Sprite(moonMat); moon.scale.set(140, 140, 1); moon.position.set(360, 380, -980); scene.add(moon);
      export const boltMat = new THREE.LineBasicMaterial({ color: 0xe4eeff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const boltGeo = new THREE.BufferGeometry();
      const boltPts = new Float32Array(9 * 3);
      boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPts, 3).setUsage(THREE.DynamicDrawUsage));
      export const bolt = new THREE.Line(boltGeo, boltMat); bolt.visible = false; scene.add(bolt);
      export function strikeBolt() {
        const x0 = (Math.random() - .5) * 720; let y = 350;
        const z0 = -260 - Math.random() * 460;
        for (let i = 0; i < 9; i++) {
          boltPts[i * 3] = x0 + (Math.random() - .5) * 80 * (i / 8);
          boltPts[i * 3 + 1] = y;
          boltPts[i * 3 + 2] = z0 + (Math.random() - .5) * 44;
          y -= 38 + Math.random() * 22;
        }
        boltGeo.attributes.position.needsUpdate = true;
        bolt.visible = true; boltMat.opacity = 1; skyState.boltT = 0.18;
        return z0;   // dipakai untuk menjauhkan/meredam suara guntur sesuai jarak sambaran
      }

      /* ═══════════ BINTANG JATUH — kejutan visual langka saat malam, tak terkait pasar sama sekali ═══════════ */
      const starMat = new THREE.SpriteMaterial({ map: GLOW, color: 0xfff6d9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const shootingStar = new THREE.Sprite(starMat); shootingStar.scale.set(10, 3, 1); scene.add(shootingStar);
      export let starT = 0, starDur = 0;
      const starFrom = new THREE.Vector3(), starTo = new THREE.Vector3();
      export function updateShootingStar(dt, daylight) {
        if (starT > 0) {
          starT -= dt;
          const k = 1 - Math.max(0, starT) / starDur;
          shootingStar.position.lerpVectors(starFrom, starTo, k);
          const fadeIn = Math.min(1, k / 0.15), fadeOut = Math.min(1, (1 - k) / 0.3);
          starMat.opacity = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.9;
          if (starT <= 0) { starT = 0; starMat.opacity = 0; }
          return;
        }
        if (daylight > 0.28) return;   // hanya muncul saat cukup gelap
        skyState.nextStarCheck -= dt;
        if (skyState.nextStarCheck > 0) return;
        skyState.nextStarCheck = 45 + Math.random() * 75;   // rata-rata sekali per ~1-2 menit selama malam
        const side = Math.random() < .5 ? -1 : 1;
        starFrom.set(side * 700, 260 + Math.random() * 120, -500 - Math.random() * 300);
        starTo.set(-side * 500, 60 + Math.random() * 60, -200 - Math.random() * 300);
        starDur = 1.1 + Math.random() * .5; starT = starDur;
      }

      /* penanda kematian: kepulan debu lembut (bukan emoji) */
      const puffMat = new THREE.SpriteMaterial({ map: GLOW, color: 0x2a2620, transparent: true, opacity: .5, depthWrite: false });
      export const skulls = [];
      export function spawnSkull(pos) {
        const spr = new THREE.Sprite(puffMat.clone());
        spr.position.set(pos.x, 4, pos.z);
        spr.scale.set(.1, .1, 1);
        scene.add(spr);
        skulls.push({ spr, t: 0, dur: .7 });
      }

