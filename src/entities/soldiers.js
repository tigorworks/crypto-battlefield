import { CROWD_MAX, CROWD_START, C_LONG, C_SHORT } from '../config.js';
import { GLOW } from '../core/assets.js';
import { scene } from '../core/renderer.js';
import { spawnSkull } from '../world/sky.js';
import { fieldState } from '../world/field.js';

      /* ═══════════ MODEL — semua karakter (prajurit & unit whale) kini dibangun high-poly
         secara prosedural di runtime; tak ada lagi aset .glb yang perlu dimuat.
         loadAllModels dipertahankan hanya agar alur bootstrap (di akhir berkas) tak berubah. ═══════════ */
      export function loadAllModels() { return Promise.resolve(); }

      /* ═══════════ PASUKAN — prajurit high-poly yang saling menembak ═══════════ */
      const smx = new THREE.Matrix4(), spos = new THREE.Vector3(), sscl = new THREE.Vector3();
      const slocal = new THREE.Matrix4(), sworld = new THREE.Matrix4(), srot = new THREE.Matrix4();   // scratch untuk matriks bagian tubuh beranimasi
      const sq = new THREE.Quaternion(), toppleQ = new THREE.Quaternion(), recoilQ = new THREE.Quaternion(), AXIS_Z = new THREE.Vector3(0, 0, 1);
      const faceQ = new THREE.Quaternion(), AXIS_Y = new THREE.Vector3(0, 1, 0);
      const gaitQ = new THREE.Quaternion(), gaitE = new THREE.Euler();
      const _skullPos = new THREE.Vector3();

      /* ═══════════ PRAJURIT HIGH-POLY — geometri prosedural digabung jadi satu BufferGeometry
         (dengan vertex color di-bake) supaya tetap kompatibel dengan InstancedMesh. Menghadap +x,
         origin di kaki (tinggi ≈ 8.5) agar rotasi hadap, tumbang (pivot kaki) & recoil tetap benar.
         Warna tim (hijau=buy / merah=sell) di-bake ke rompi/helm → dibangun terpisah per sisi. */
      function soldierPart(geo, hex, tx, ty, tz, rot) {
        if (rot) { if (rot[0]) geo.rotateX(rot[0]); if (rot[1]) geo.rotateY(rot[1]); if (rot[2]) geo.rotateZ(rot[2]); }
        geo.translate(tx || 0, ty || 0, tz || 0);
        const g = geo.index ? geo.toNonIndexed() : geo;   // seragamkan agar bisa dikonkat
        const n = g.attributes.position.count;
        const r = ((hex >> 16) & 255) / 255, gg = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return g;
      }
      function mergeSoldierGeos(list) {   // konkat position/normal/color — tak bergantung BufferGeometryUtils
        let pc = 0; for (const g of list) pc += g.attributes.position.count;
        const pos = new Float32Array(pc * 3), nor = new Float32Array(pc * 3), col = new Float32Array(pc * 3);
        let o = 0;
        for (const g of list) {
          pos.set(g.attributes.position.array, o * 3);
          nor.set(g.attributes.normal.array, o * 3);
          col.set(g.attributes.color.array, o * 3);
          o += g.attributes.position.count;
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        out.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return out;
      }
      /* Prajurit dipecah jadi beberapa bagian supaya kaki & lengan bisa dianimasikan sendiri
         (InstancedMesh tak bisa menganimasikan sub-bagian dari satu mesh — jadi tiap bagian
         punya InstancedMesh sendiri, digerakkan per-instance di updateCrowd). "core" (torso+
         kepala) dipakai sebagai mesh utama untuk raycast tap-soldier. Bagian yang berayun
         (kaki/lengan) diautor dengan PIVOT sendinya di titik asal (pinggul/bahu) supaya rotasi
         mengayun benar. */
      const RIFLE = Math.PI / 2;   // rotasi silinder Y→X (laras menghadap +x)
      const S_DARK = 0x2b303a, S_METAL = 0x3a3f4a, S_SKIN = 0xc79a72, S_STRAP = 0x1c1f26, S_BRIM = 0x1c1f26;
      const SOLDIER = { hipY: 3.3, legZ: 0.6, shoulderY: 5.7, armBackX: 0.15, armBackZ: -0.9, armFrontX: 0.2, armFrontZ: 0.82 };
      function buildSoldierCore(side) {   // batang tubuh statis (ruang prajurit, origin di kaki)
        const team = side === 'buy' ? C_LONG : C_SHORT;
        return mergeSoldierGeos([
          soldierPart(new THREE.CylinderGeometry(1.05, .95, 3.0, 12), team, 0, 4.7, 0),        // torso/rompi
          soldierPart(new THREE.SphereGeometry(1.05, 12, 10), team, 0, 6.0, 0),                // bahu membulat
          soldierPart(new THREE.CylinderGeometry(1.08, 1.08, .45, 12), S_STRAP, 0, 3.35, 0),   // sabuk
          soldierPart(new THREE.CylinderGeometry(.35, .35, .8, 8), S_SKIN, 0, 6.7, 0),         // leher
          soldierPart(new THREE.SphereGeometry(.78, 14, 12), S_SKIN, .05, 7.5, 0),             // kepala
          soldierPart(new THREE.SphereGeometry(.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), team, .05, 7.85, 0),  // kubah helm
          soldierPart(new THREE.CylinderGeometry(.95, .95, .18, 14), S_BRIM, .05, 7.9, 0),     // pinggir helm
        ]);
      }
      function buildSoldierLeg() {        // pivot di pinggul (origin), menjuntai ke bawah
        return mergeSoldierGeos([
          soldierPart(new THREE.CylinderGeometry(.45, .42, 3.3, 10), S_DARK, 0, -1.65, 0),     // tungkai
          soldierPart(new THREE.BoxGeometry(1.3, .5, .8), S_DARK, .25, -3.05, 0),              // sepatu
        ]);
      }
      // warna senjata (gaya AK-47): kayu popor/handguard + logam gelap
      const S_WOOD = 0x6b4a2b, S_GUN = 0x23252b, S_GUNMET = 0x55585f;
      // helper "tulang": silinder yang membentang dari (p0)→(p1) — untuk lengan yang mengarah bebas di 3D
      const _boneUp = new THREE.Vector3(0, 1, 0), _boneDir = new THREE.Vector3(), _boneQ = new THREE.Quaternion(), _boneM = new THREE.Matrix4();
      function soldierBone(color, x0, y0, z0, x1, y1, z1, r) {
        _boneDir.set(x1 - x0, y1 - y0, z1 - z0); const len = _boneDir.length(); _boneDir.normalize();
        const g = new THREE.CylinderGeometry(r, r * .9, len, 8);
        _boneQ.setFromUnitVectors(_boneUp, _boneDir); g.applyMatrix4(_boneM.makeRotationFromQuaternion(_boneQ));
        g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        return soldierPart(g, color, 0, 0, 0);   // tanpa transform tambahan → cuma bake warna
      }
      /* Pose SIAP-TEMBAK: senapan AK-47 diangkat setinggi bahu/dagu (bukan di pinggang), moncong ke +x.
         Senapan menyatu di lengan DEPAN (tangan pemicu); lengan BELAKANG menopang handguard di depan. */
      const RY = 0.72;   // ketinggian sumbu senapan pada ruang-bahu (world ≈ shoulderY + RY ≈ 6.4, area dada/dagu)
      function buildSoldierArmBack() {    // lengan penopang — menjulur ke depan-atas ke handguard
        return mergeSoldierGeos([
          soldierBone(S_SKIN, 0, 0, 0, 1.85, RY - .1, 1.15, .26),     // lengan
          soldierPart(new THREE.SphereGeometry(.24, 8, 6), S_SKIN, 1.9, RY - .1, 1.2),   // tangan menggenggam
        ]);
      }
      function buildSoldierArmFront() {   // lengan pemicu + senapan AK-47 terangkat
        return mergeSoldierGeos([
          soldierBone(S_SKIN, 0, 0, 0, .7, RY - .35, .05, .26),        // lengan pemicu menekuk ke pegangan
          soldierPart(new THREE.SphereGeometry(.22, 8, 6), S_SKIN, .78, RY - .3, .05),   // tangan
          // — senapan AK-47 (moncong +x) —
          soldierPart(new THREE.BoxGeometry(1.5, .34, .3), S_GUN, 1.0, RY, 0),           // receiver
          soldierPart(new THREE.BoxGeometry(1.15, .26, .24), S_WOOD, .1, RY, 0),         // popor kayu (ke arah bahu)
          soldierPart(new THREE.BoxGeometry(1.0, .28, .26), S_WOOD, 2.2, RY, 0),         // handguard kayu
          soldierPart(new THREE.CylinderGeometry(.07, .07, 1.5, 8), S_GUNMET, 3.15, RY + .02, 0, [0, 0, RIFLE]),  // laras
          soldierPart(new THREE.BoxGeometry(.1, .3, .1), S_GUN, 2.75, RY + .22, 0),      // pisir depan
          soldierPart(new THREE.BoxGeometry(.28, .82, .24), S_GUNMET, .95, RY - .5, 0, [0, 0, .5]),   // magasin melengkung (banana)
          soldierPart(new THREE.BoxGeometry(.2, .5, .2), S_GUN, .78, RY - .32, 0, [0, 0, -.35]),      // pegangan pistol
        ]);
      }

      export function makeCrowd(color, sign, side) { // sign: -1 = beli (kiri), 1 = jual (kanan)
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: color, emissiveIntensity: .28, metalness: .08, roughness: .82, envMapIntensity: .3, fog: false });
        function partMesh(geo) {
          const m = new THREE.InstancedMesh(geo, mat, CROWD_MAX);
          m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          m.castShadow = true;   // tiap bagian ikut menjatuhkan bayangan
          scene.add(m);
          return m;
        }
        const mesh = partMesh(buildSoldierCore(side));   // core = mesh utama (dipakai raycast tap-soldier)
        const legGeo = buildSoldierLeg();                 // kaki kiri & kanan berbagi geometri
        const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
        // bagian beranimasi — amp = pengali ayun (kaki kiri +, kaki kanan −; lengan kontralateral;
        // lengan depan memegang senapan → ayun kecil)
        const parts = [
          { mesh: partMesh(legGeo), attach: T(0, SOLDIER.hipY, -SOLDIER.legZ), amp: 1.0 },
          { mesh: partMesh(legGeo), attach: T(0, SOLDIER.hipY, SOLDIER.legZ), amp: -1.0 },
          // lengan memegang senapan terangkat → ayun sangat kecil supaya bidikan tetap mantap
          { mesh: partMesh(buildSoldierArmBack()), attach: T(SOLDIER.armBackX, SOLDIER.shoulderY, SOLDIER.armBackZ), amp: 0.05 },
          { mesh: partMesh(buildSoldierArmFront()), attach: T(SOLDIER.armFrontX, SOLDIER.shoulderY, SOLDIER.armFrontZ), amp: 0.05 },
        ];
        const allMeshes = [mesh, ...parts.map(p => p.mesh)];

        // titik cahaya aditif di atas tiap prajurit — tanpa ini, saat kamera zoom out
        // prajurit jadi kecil & ke-antialias sampai warnanya (terutama merah) tenggelam di rumput hijau
        const glowPos = new Float32Array(CROWD_MAX * 3);
        const glowGeo = new THREE.BufferGeometry();
        glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3).setUsage(THREE.DynamicDrawUsage));
        const glowMat = new THREE.PointsMaterial({ color, map: GLOW, size: 9, sizeAttenuation: true, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const glow = new THREE.Points(glowGeo, glowMat);
        scene.add(glow);

        const baseYaw = sign < 0 ? 0 : Math.PI;   // arah hadap dasar: sisi kanan menghadap kiri
        const slots = [];
        for (let i = 0; i < CROWD_MAX; i++) {
          const x = sign * (40 + Math.random() * 120);
          const z = (Math.random() - .5) * 230;
          slots.push({
            base: new THREE.Vector3(x, 0, z),
            spawnFrom: new THREE.Vector3(x + sign * 170, 0, z + (Math.random() - .5) * 50),
            active: i < CROWD_START,
            dying: false, dieT: 0,
            walking: i < CROWD_START, walkT: 0,
            phase: Math.random() * Math.PI * 2,
            recoilT: 0,   // kickback singkat saat prajurit ini yang baru saja menembak
            size: 0.9 + Math.random() * 0.2,          // #5 variasi ukuran per prajurit
            // ── JELAJAH: prajurit tak mematung di satu titik — ia bergeser maju/mundur/menyamping
            //    di sekitar titik jangkarnya (base), lalu berhenti sejenak sebelum pindah lagi
            ox: 0, oz: 0,                             // pergeseran sekarang terhadap jangkar
            tox: 0, toz: 0,                           // tujuan pergeseran berikutnya
            moving: false,
            roamT: Math.random() * 5,                 // hitung mundur ke keputusan gerak berikutnya
            speed: 0,
            vx: 0, vz: 0,                             // kecepatan sekarang — dipercepat/diperlambat, tak pernah patah
            wander: Math.random() * Math.PI * 2,      // fase belokan halus → lintasan melengkung, bukan garis lurus
            idleYaw: (Math.random() - .5) * .5,       // arah pandang saat berhenti (tak semua lurus ke depan)
            yaw: baseYaw,                             // hadap sekarang (dihaluskan tiap frame)
            stride: Math.random() * Math.PI * 2,      // fase langkah — maju mengikuti kecepatan sebenarnya
            px: x, pz: z,                             // posisi dunia terakhir (dibaca modul lain: peluru, tengkorak)
          });
        }
        // #5 variasi kecerahan per prajurit (instanceColor mengalikan vertex color → tiap prajurit sedikit beda)
        const scol = new THREE.Color();
        for (let i = 0; i < CROWD_MAX; i++) {
          const b = 0.82 + Math.random() * 0.3;
          scol.setRGB(b, b, b);
          for (const m of allMeshes) m.setColorAt(i, scol);
        }
        for (const m of allMeshes) m.instanceColor.needsUpdate = true;
        // gaya saling hindar antar prajurit, dihitung sekali per frame (lihat separate())
        const sepX = new Float32Array(CROWD_MAX), sepZ = new Float32Array(CROWD_MAX);
        return { mesh, parts, glow, glowPos, slots, sepX, sepZ, count: CROWD_START, target: CROWD_START, sign };
      }
      export let buyCrowd, sellCrowd;   // dibuat setelah model voxel prajurit selesai dimuat — lihat bootstrap di akhir berkas
      export function initCrowds() {
        buyCrowd = makeCrowd(C_LONG, -1, 'buy');
        sellCrowd = makeCrowd(C_SHORT, 1, 'sell');
      }

      /* mati HANYA karena tertembak (dipanggil saat peluru mendarat) */
      export function killSoldier(crowd, n) {
        for (let k = 0; k < n; k++) {
          let idx = -1;
          for (let i = 0; i < crowd.slots.length; i++) { if (crowd.slots[i].active && !crowd.slots[i].dying) { idx = i; if (Math.random() < .4) break; } }
          if (idx < 0) break;
          const s = crowd.slots[idx];
          s.dying = true; s.dieT = 0; s.moving = false;
          crowd.count = Math.max(0, crowd.count - 1);
          spawnSkull(_skullPos.set(s.px, 0, s.pz));   // tengkorak muncul di tempat ia benar-benar berdiri, bukan di jangkarnya
        }
      }
      /* keadaan jelajah dikembalikan ke nol — dipakai saat prajurit baru masuk lapangan */
      function resetRoam(s) {
        s.ox = 0; s.oz = 0; s.tox = 0; s.toz = 0;
        s.moving = false; s.roamT = .5 + Math.random() * 3; s.speed = 0;
        s.vx = 0; s.vz = 0;
      }
      /* bala bantuan masuk (order baru di sisi ini) */
      export function reviveSoldier(crowd) {
        if (crowd.count >= CROWD_MAX) return;
        let idx = -1;
        for (let i = 0; i < crowd.slots.length; i++) { const c = crowd.slots[i]; if (!c.active && !c.dying) { idx = i; if (Math.random() < .4) break; } }
        if (idx < 0) return;
        const s = crowd.slots[idx];
        s.active = true; s.walking = true; s.walkT = 0;
        // titik masuk diacak ulang tiap kali → bala bantuan tak selalu datang dari jalur yang sama
        s.spawnFrom.set(s.base.x + crowd.sign * (140 + Math.random() * 70), 0, s.base.z + (Math.random() - .5) * 50);
        resetRoam(s);
        crowd.count++;
      }
      function resetCrowd(crowd) {
        crowd.count = CROWD_START;
        crowd.slots.forEach((s, i) => {
          s.active = i < CROWD_START;
          s.dying = false; s.dieT = 0;
          s.walking = i < CROWD_START; s.walkT = 0;
          resetRoam(s);
        });
      }

      /* ── JELAJAH PASUKAN ──────────────────────────────────────────────────────────
         Tiap prajurit punya titik jangkar (base) dan bergeser bebas di sekitarnya:
         maju menekan garis depan, mundur mengambil jarak, atau bergeser menyamping.
         Yang bergerak selalu cuma sebagian pasukan (sisanya menahan posisi & menembak),
         jadi barisan terlihat hidup tanpa pernah bergerak serentak seperti satu blok. */
      const ROAM_X = 34, ROAM_Z = 26;      // batas jelajah dari jangkar (searah & melintang garis depan)
      const MAX_TURN = 1.15;               // batas belok dari arah hadap lawan — senapan tetap mengarah ke musuh
      const ROAM_ACCEL = 26;               // percepatan/perlambatan (unit/detik²) — mulai & berhenti melandai
      const ROAM_VMAX = 26;                // batas laju gabungan (langkah + dorongan saling hindar)
      const SEP_R = 8, SEP_PUSH = 12;      // radius & kuat dorongan agar prajurit tak berdiri saling tumpuk
      const ANCHOR_X0 = 34, ANCHOR_X1 = 168, ANCHOR_Z = 118;   // batas geser jangkar (band pasukan)
      const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
      const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      /* jangkar ikut hanyut pelan ke arah prajurit berada sekarang → formasi perlahan berubah bentuk,
         jadi ia tak selalu tertarik pulang ke petak yang sama seumur hidupnya. Posisi dunia tak
         berubah saat ini juga (pergeseran ox/oz dikurangi sebesar hanyutnya). */
      function driftAnchor(s, sign) {
        const lo = sign < 0 ? -ANCHOR_X1 : ANCHOR_X0, hi = sign < 0 ? -ANCHOR_X0 : ANCHOR_X1;
        const dx = clamp(s.ox * .4, -6, 6), dz = clamp(s.oz * .4, -6, 6);   // hanyut sedikit demi sedikit
        const bx = clamp(s.base.x + dx, lo, hi), bz = clamp(s.base.z + dz, -ANCHOR_Z, ANCHOR_Z);
        s.ox = clamp(s.ox - (bx - s.base.x), -ROAM_X, ROAM_X);
        s.oz = clamp(s.oz - (bz - s.base.z), -ROAM_Z, ROAM_Z);
        s.base.x = bx; s.base.z = bz;
      }
      function pickRoam(s, sign) {
        if (Math.random() < .22) {   // menahan posisi — hanya sebagian kecil keputusan, dan tak lama
          s.moving = false; s.roamT = 1.0 + Math.random() * 2.4;
          s.idleYaw = (Math.random() - .5) * .5;   // sesekali menoleh menyapu medan
          return;
        }
        if (Math.random() < .2) driftAnchor(s, sign);
        const fwd = -sign;                                                        // arah menuju musuh
        const winning = sign < 0 ? fieldState.frontX > 0 : fieldState.frontX < 0; // sisinya sedang mendesak?
        const lateral = Math.random() < .4;                                       // geser menyamping (menyebar barisan)
        const goFwd = Math.random() < (winning ? .72 : .38);                      // menang → lebih berani maju
        const dx = lateral ? (Math.random() - .5) * 16 : fwd * (goFwd ? 1 : -1) * (10 + Math.random() * 22);
        const dz = lateral ? (Math.random() < .5 ? -1 : 1) * (9 + Math.random() * 18) : (Math.random() - .5) * 14;
        s.tox = clamp(s.ox + dx, -ROAM_X, ROAM_X);
        s.toz = clamp(s.oz + dz, -ROAM_Z, ROAM_Z);
        // maju menyerbu paling tegas; menyamping sedang; mundur pelan sambil tetap membidik
        s.speed = lateral ? 9 + Math.random() * 6 : goFwd ? 14 + Math.random() * 10 : 7 + Math.random() * 5;
        s.moving = true;
        s.roamT = 6;   // batas waktu — kalau tersendat (mis. tertahan garis depan) tetap ambil keputusan baru
      }
      /* dorongan saling hindar: tiap pasang prajurit yang terlalu rapat saling menolak.
         Efeknya barisan padat terus bergeser-geser sendiri — tak ada yang membeku di satu titik,
         dan dua prajurit tak pernah berdiri menempel di posisi yang sama. */
      function separate(crowd) {
        const slots = crowd.slots, sx = crowd.sepX, sz = crowd.sepZ, n = slots.length;
        sx.fill(0); sz.fill(0);
        for (let i = 0; i < n; i++) {
          const a = slots[i];
          if (!a.active || a.dying || a.walking) continue;
          for (let j = i + 1; j < n; j++) {
            const b = slots[j];
            if (!b.active || b.dying || b.walking) continue;
            let dx = a.px - b.px, dz = a.pz - b.pz, d2 = dx * dx + dz * dz;
            if (d2 > SEP_R * SEP_R) continue;
            if (d2 < 1e-4) { dx = (i % 3) - 1 || 1; dz = (j % 3) - 1; d2 = dx * dx + dz * dz; }   // tepat menumpuk → dorong ke arah tetap
            const w = (1 - Math.sqrt(d2) / SEP_R) / Math.sqrt(d2);   // makin rapat makin kuat, sekalian normalisasi arah
            const ux = dx * w, uz = dz * w;
            sx[i] += ux; sz[i] += uz; sx[j] -= ux; sz[j] -= uz;
          }
        }
      }

      export function updateCrowd(crowd, dt, t) {
        const bias = crowd.pressBias || 0;
        const baseYaw = crowd.sign < 0 ? 0 : Math.PI;
        separate(crowd);
        for (let i = 0; i < crowd.slots.length; i++) {
          const s = crowd.slots[i];
          let x = s.base.x + bias + s.ox, z = s.base.z + s.oz, sc = 0, bob = 0, topple = 0;
          let mvx = 0, mvz = 0, spd = 0;   // arah & laju jalan frame ini (0 = sedang diam)

          if (s.dying) {
            s.dieT = Math.min(1, s.dieT + dt * 2.6);
            topple = Math.min(1, s.dieT * 1.5) * 1.5 * crowd.sign;   // tumbang ke belakang
            sc = s.dieT < .55 ? 1 : Math.max(0, 1 - (s.dieT - .55) / .45);
            bob = -s.dieT * 1.2;
            if (s.dieT >= 1) { s.dying = false; s.active = false; }
          } else if (s.walking) {
            s.walkT = Math.min(1, s.walkT + dt * .75);
            const e = 1 - (1 - s.walkT) * (1 - s.walkT);
            const tx = s.base.x + bias + s.ox, tz = s.base.z + s.oz;
            x = s.spawnFrom.x + (tx - s.spawnFrom.x) * e;
            z = s.spawnFrom.z + (tz - s.spawnFrom.z) * e;
            mvx = tx - s.spawnFrom.x; mvz = tz - s.spawnFrom.z;
            spd = 16 * (1 - s.walkT * .5);   // melambat menjelang sampai
            sc = 1;
            if (s.walkT >= 1) { s.walking = false; s.roamT = .8 + Math.random() * 3; }
          } else if (s.active) {
            // langkah jelajah: bergerak ke tujuan, sampai, jeda, lalu pilih tujuan baru.
            // Kecepatan tak dipasang langsung — ia dikejar lewat percepatan, jadi prajurit
            // mulai melangkah & berhenti secara melandai, bukan hidup-mati seperti robot.
            s.roamT -= dt;
            let dvx = 0, dvz = 0;   // kecepatan yang DIINGINKAN frame ini
            if (s.moving) {
              const dx = s.tox - s.ox, dz = s.toz - s.oz, d = Math.hypot(dx, dz);
              if (d < 1.2 || s.roamT <= 0) { s.moving = false; s.roamT = .6 + Math.random() * 2.6; }
              else {
                s.wander += dt * 1.1;
                const w = Math.sin(s.wander + s.phase) * .35;     // menyerong halus → lintasan melengkung
                const ux = dx / d, uz = dz / d, v = s.speed * Math.min(1, d / 6);   // melandai saat hampir sampai
                dvx = (ux - uz * w) * v; dvz = (uz + ux * w) * v;
              }
            } else if (s.roamT <= 0) pickRoam(s, crowd.sign);
            dvx += crowd.sepX[i] * SEP_PUSH; dvz += crowd.sepZ[i] * SEP_PUSH;   // menghindar dari yang terlalu rapat
            const dv = Math.hypot(dvx, dvz);
            if (dv > ROAM_VMAX) { dvx = dvx / dv * ROAM_VMAX; dvz = dvz / dv * ROAM_VMAX; }
            const ax = dvx - s.vx, az = dvz - s.vz, am = Math.hypot(ax, az);
            if (am > 1e-4) { const st = Math.min(am, ROAM_ACCEL * dt); s.vx += ax / am * st; s.vz += az / am * st; }
            const nx = s.ox + s.vx * dt, nz = s.oz + s.vz * dt;
            const cx = clamp(nx, -ROAM_X, ROAM_X), cz = clamp(nz, -ROAM_Z, ROAM_Z);
            if (cx !== nx) s.vx = 0;   // mentok batas jelajah → berhenti mendorong, bukan menggesek terus
            if (cz !== nz) s.vz = 0;
            s.ox = cx; s.oz = cz;
            x = s.base.x + bias + s.ox; z = s.base.z + s.oz;
            sc = 1;
          }

          // recoil singkat — prajurit ini baru saja menembak, senapannya menyentak ke belakang
          let kick = 0;
          if (s.recoilT > 0) {
            s.recoilT = Math.max(0, s.recoilT - dt);
            kick = s.recoilT / .15;
            x += crowd.sign * kick * 1.3;
          }

          // jangan biarkan prajurit melewati garis depan ke wilayah lawan
          const wantX = x;
          if (crowd.sign < 0) x = Math.min(x, fieldState.frontX - 16);
          else x = Math.max(x, fieldState.frontX + 16);
          if (x !== wantX && !s.dying && !s.walking) {
            // tertahan garis depan → pergeseran ikut dipangkas (pasukan menumpuk rapat di depan)
            // dan langkah maju dihentikan supaya tak terus mendorong tembok tak kasat mata
            s.ox = clamp(s.ox + (x - wantX), -ROAM_X, ROAM_X);
            s.vx = 0;   // laju searah garis depan padam; geser menyamping masih boleh jalan
            if (s.moving) { s.moving = false; s.roamT = .8 + Math.random() * 2.5; }
          }
          // arah & laju jalan diturunkan dari kecepatan sebenarnya → dorongan saling hindar pun
          // ikut menganimasikan langkah, bukan cuma menggeser prajurit tanpa kaki bergerak
          if (s.active && !s.dying && !s.walking) {
            spd = Math.hypot(s.vx, s.vz);
            if (spd > .2) { mvx = s.vx / spd; mvz = s.vz / spd; } else spd = 0;
          }
          s.px = x; s.pz = z;   // posisi nyata — dipakai peluru & tengkorak agar ikut prajurit yang berpindah

          const hidden = sc <= .002 && !s.active && !s.dying;
          if (hidden) sscl.set(.0001, .0001, .0001);
          else { const ssz = sc * s.size; sscl.set(ssz, ssz, ssz); }   // #5 skala per prajurit sedikit acak

          // HADAP — mengikuti arah jalan, tapi dibatasi ±MAX_TURN dari arah lawan: prajurit
          // menyerong/mundur sambil tetap membidik musuh, bukan membalikkan badan
          let tgtYaw = baseYaw + s.idleYaw + Math.sin(t * .6 + s.phase) * .06;
          if (spd > 0.01 && (mvx || mvz)) {
            const rel = clamp(angWrap(Math.atan2(-mvz, mvx) - baseYaw), -MAX_TURN, MAX_TURN);
            tgtYaw = baseYaw + rel;
          }
          if (s.dying) tgtYaw = s.yaw;
          s.yaw += angWrap(tgtYaw - s.yaw) * Math.min(1, dt * 5);

          // GAIT — fase langkah maju mengikuti laju sebenarnya (diam = ayun napas pelan).
          // Karena hadap dibatasi ±MAX_TURN, prajurit sering bergerak menyerong/mundur sambil tetap
          // membidik: langkah mundur mengayun terbalik, langkah menyamping mengayun lebih pendek.
          let gaitDir = 1, strafe = 0;
          if (spd > 0.01) {
            const dot = mvx * Math.cos(s.yaw) - mvz * Math.sin(s.yaw);   // searah hadap? (hadap = +x lokal)
            gaitDir = dot < 0 ? -1 : 1;
            strafe = 1 - Math.min(1, Math.abs(dot));
          }
          const speedK = Math.min(1, spd / 16);
          s.stride += dt * (spd > 0.01 ? (3.4 + spd * .42) * gaitDir : 2.4);
          let gaitAmp = 0;   // (bob prajurit yang sedang tumbang sudah dihitung di blok dying — jangan ditimpa)
          if (hidden || s.dying) gaitAmp = 0;
          else if (spd > 0.01) { gaitAmp = (.35 + speedK * .75) * (1 - strafe * .45); bob = Math.abs(Math.sin(s.stride)) * (.35 + speedK * .55) * (1 - strafe * .35); }
          else { gaitAmp = .16; bob = Math.abs(Math.sin(s.stride)) * .45; }   // ayun ringan berdiri

          faceQ.setFromAxisAngle(AXIS_Y, s.yaw);
          sq.copy(faceQ);
          if (!s.dying && gaitAmp > 0) {
            // condong ke depan + guling badan mengikuti langkah — berjalan jadi berbobot, tak kaku
            // condong ke depan saat maju, sedikit ke belakang saat mundur; menyamping → badan miring
            gaitE.set(Math.sin(s.stride) * .05 * speedK, 0, -.12 * speedK * gaitDir * (1 - strafe * .6));
            sq.multiply(gaitQ.setFromEuler(gaitE));
          }
          if (topple) { toppleQ.setFromAxisAngle(AXIS_Z, topple); sq.premultiply(toppleQ); }
          else if (kick > 0) { recoilQ.setFromAxisAngle(AXIS_Z, kick * .18 * crowd.sign); sq.premultiply(recoilQ); }
          spos.set(x, bob, z);
          smx.compose(spos, sq, sscl);
          crowd.mesh.setMatrixAt(i, smx);   // core (mesh utama)

          const legSwing = Math.sin(s.stride) * gaitAmp * 0.55;
          for (let pi = 0; pi < crowd.parts.length; pi++) {
            const part = crowd.parts[pi];
            srot.makeRotationZ(legSwing * part.amp);       // ayun bagian di sekitar pivotnya (pinggul/bahu)
            slocal.multiplyMatrices(part.attach, srot);    // tempatkan pivot lalu putar
            sworld.multiplyMatrices(smx, slocal);          // ikut transform badan (posisi/hadap/tumbang/skala)
            part.mesh.setMatrixAt(i, sworld);
          }

          const gi = i * 3;
          if (hidden) {
            crowd.glowPos[gi + 1] = -500; // sembunyikan di bawah tanah saat tidak aktif
          } else {
            crowd.glowPos[gi] = x; crowd.glowPos[gi + 1] = bob + 5.5; crowd.glowPos[gi + 2] = z;
          }
        }
        crowd.mesh.instanceMatrix.needsUpdate = true;
        for (const part of crowd.parts) part.mesh.instanceMatrix.needsUpdate = true;
        crowd.glow.geometry.attributes.position.needsUpdate = true;
      }

