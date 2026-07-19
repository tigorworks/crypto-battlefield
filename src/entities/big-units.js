import { C_LONG, C_SHORT, MAX_UNITS, T_WHALE } from '../config.js';
import { playChargeHorn, playVolley } from '../audio/audio.js';
import { bigUnitObjs, crowdPoint, fireBullet } from '../combat/bullets.js';
import { GLOW } from '../core/assets.js';
import { scene } from '../core/renderer.js';
import { buyCrowd, sellCrowd } from './soldiers.js';
import { price } from '../feed/market-feed.js';

      /* ═══════════ UNIT BESAR — model HIGH-POLY prosedural (tank/apc/heli/jet/bomber) ═══════════
         Dibangun langsung dari primitif Three.js lengkung (silinder/bola/airfoil ber-bevel) alih-alih
         voxel .glb, lalu di-cache & di-clone tiap spawn demi performa (MAX_UNITS). Tiap model
         menghadap +x, memberi shadow, dan menyimpan node beranama (gun/rotor/tailRotor) + array roda
         supaya animasi tetap terikat. Warna tim (hijau=buy / merah=sell) dipertahankan sebagai warna
         hull + aksen emissive agar sisi tetap terbaca. */
      const tankAuraMat = {
        buy: new THREE.SpriteMaterial({ map: GLOW, color: C_LONG, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
        sell: new THREE.SpriteMaterial({ map: GLOW, color: C_SHORT, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      };
      function attachAura(g, side, scale) {
        const aura = new THREE.Sprite(tankAuraMat[side]); aura.scale.set(scale, scale, 1); g.add(aura);
        return aura;
      }
      /* baris awal posisi lokal setiap node yang bisa di-recoil disimpan supaya animasinya bisa menyentak lalu kembali */
      function markRecoilable(node) { if (node) node.userData.basePos = node.position.clone(); return node; }

      /* — palet material PBR per sisi, dibuat sekali & dipakai bersama semua clone — */
      const BIG_MAT_CACHE = {};
      function bigMats(side) {
        if (BIG_MAT_CACHE[side]) return BIG_MAT_CACHE[side];
        const team = side === 'buy' ? C_LONG : C_SHORT;
        return (BIG_MAT_CACHE[side] = {
          hull:   new THREE.MeshStandardMaterial({ color: team,    metalness: .45, roughness: .5,  emissive: team, emissiveIntensity: .1,  envMapIntensity: .5 }),
          plate:  new THREE.MeshStandardMaterial({ color: team,    metalness: .5,  roughness: .58, envMapIntensity: .5 }),
          dark:   new THREE.MeshStandardMaterial({ color: 0x2b303a, metalness: .6,  roughness: .45, envMapIntensity: .7 }),
          metal:  new THREE.MeshStandardMaterial({ color: 0x9aa2ae, metalness: .95, roughness: .3,  envMapIntensity: .9 }),
          glass:  new THREE.MeshStandardMaterial({ color: 0x0f1e28, metalness: .3,  roughness: .06, emissive: 0x0b2230, emissiveIntensity: .3, envMapIntensity: 1.0 }),
          accent: new THREE.MeshStandardMaterial({ color: team,    metalness: .3,  roughness: .35, emissive: team, emissiveIntensity: .5, envMapIntensity: .5 }),
          wing:   new THREE.MeshStandardMaterial({ color: team,    metalness: .5,  roughness: .5,  side: THREE.DoubleSide, envMapIntensity: .5 }),
        });
      }
      /* — helper: tambah mesh (default memberi & menerima bayangan) — */
      function part(group, geo, mat, pos, cast = true) {
        const m = new THREE.Mesh(geo, mat);
        if (pos) m.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0);
        m.castShadow = cast; m.receiveShadow = true;
        group.add(m); return m;
      }
      /* — nyala afterburner: sprite aditif panas di ujung nosel (selalu menyala saat unit terbang) — */
      const AB_MAT = new THREE.SpriteMaterial({ map: GLOW, color: 0xffb060, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      function addAfterburner(g, x, y, z, size) {
        const s = new THREE.Sprite(AB_MAT); s.position.set(x, y, z); s.scale.set(size, size * .7, 1);
        s.name = 'afterburner'; g.add(s); return s;
      }
      /* — helper geometri (konvensi: unit menghadap +x) — */
      function tubeX(rt, rb, len, seg = 18) { const g = new THREE.CylinderGeometry(rt, rb, len, seg); g.rotateZ(-Math.PI / 2); return g; }   // sumbu sepanjang X (fuselage/laras)
      function wheelGeo(r, w, seg = 16) { const g = new THREE.CylinderGeometry(r, r, w, seg); g.rotateX(Math.PI / 2); return g; }             // sumbu sepanjang Z (roda, berputar di sumbu z)
      function domeGeo(r, seg = 16) { return new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2); }       // kubah setengah bola
      function boxG(x, y, z) { return new THREE.BoxGeometry(x, y, z); }
      function sphG(r, a = 16, b = 12) { return new THREE.SphereGeometry(r, a, b); }
      /* sayap/ekor airfoil: trapesium tersapu (sweep) yang diekstrusi tipis + bevel; span sepanjang +z */
      function wingGeo(span, rootC, tipC, sweep, thick) {
        const s = new THREE.Shape();
        s.moveTo(rootC * .5, 0); s.lineTo(-rootC * .5, 0);
        s.lineTo(-tipC * .5 - sweep, span); s.lineTo(tipC * .5 - sweep, span);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * .5, bevelSize: thick * .5, bevelSegments: 1, steps: 1 });
        g.translate(0, 0, -thick / 2); g.rotateX(Math.PI / 2); g.computeVertexNormals();
        return g;
      }
      function collectWheels(g) { const w = []; g.traverse(o => { if (o.name === 'wheel') w.push(o); }); return w; }

      /* — TANK: hull ber-glacis miring, turret kubah, laras silinder, roda jalan berputar — */
      function buildTank(side) {
        const M = bigMats(side), g = new THREE.Group();
        part(g, boxG(5.4, 1.3, 3.0), M.hull, [0, 1.15, 0]);                                  // hull bawah
        const gl = part(g, boxG(1.7, 1.35, 3.0), M.plate, [2.7, 1.3, 0]); gl.rotation.z = -.52;  // glacis depan miring
        part(g, boxG(6.0, .7, .95), M.dark, [0, .7, -1.55]);                                 // track guard kiri
        part(g, boxG(6.0, .7, .95), M.dark, [0, .7, 1.55]);                                  // track guard kanan
        part(g, new THREE.CylinderGeometry(1.5, 1.95, 1.15, 12), M.hull, [-.2, 2.5, 0]);     // turret (silinder faset)
        part(g, domeGeo(1.5, 14), M.hull, [-.2, 3.05, 0]);                                   // kubah turret
        part(g, new THREE.CylinderGeometry(.5, .55, .4, 12), M.dark, [-1.05, 3.35, .35]);    // hatch komandan
        part(g, boxG(.45, .35, .35), M.accent, [1.15, 2.75, 0], false);                      // optik/sensor (aksen)
        for (let i = -2; i <= 2; i++) {                                                       // roda jalan (berputar di tempat)
          part(g, wheelGeo(.78, .72, 14), M.metal, [i * 1.15, .78, -1.55], false).name = 'wheel';
          part(g, wheelGeo(.78, .72, 14), M.metal, [i * 1.15, .78, 1.55], false).name = 'wheel';
        }
        const gun = new THREE.Group(); gun.name = 'gun'; gun.position.set(.6, 2.6, 0);
        part(gun, boxG(.8, .7, .95), M.dark, [.2, 0, 0]);                                     // mantlet
        part(gun, tubeX(.26, .3, 3.6, 14), M.metal, [2.0, 0, 0]);                             // laras
        part(gun, tubeX(.42, .42, .55, 14), M.dark, [3.9, 0, 0]);                             // muzzle brake
        g.add(gun);
        return g;
      }

      /* — APC beroda: hull miring, turret kecil laras tipis, 3 roda per sisi berputar — */
      function buildAPC(side) {
        const M = bigMats(side), g = new THREE.Group();
        part(g, boxG(4.6, 1.5, 2.4), M.hull, [-.2, 1.6, 0]);                                 // hull
        const nose = part(g, boxG(1.5, 1.3, 2.2), M.plate, [2.3, 1.5, 0]); nose.rotation.z = -.32;  // hidung miring
        part(g, boxG(.5, .45, 1.7), M.glass, [2.7, 1.95, 0]);                                // kaca depan
        part(g, boxG(4.8, .35, .35), M.accent, [-.2, 2.4, 0], false);                        // garis aksen atap
        part(g, new THREE.CylinderGeometry(.7, .85, .7, 12), M.hull, [-.4, 2.65, 0]);        // dudukan turret
        part(g, domeGeo(.75, 12), M.hull, [-.4, 3.0, 0]);
        const gun = new THREE.Group(); gun.name = 'gun'; gun.position.set(-.4, 2.9, 0);
        part(gun, tubeX(.14, .16, 2.2, 12), M.metal, [1.3, 0, 0]);                            // laras tipis
        g.add(gun);
        for (let i = -1; i <= 1; i++) {                                                       // 3 roda per sisi
          part(g, wheelGeo(.95, .55, 16), M.dark, [i * 1.7, .95, -1.3], false).name = 'wheel';
          part(g, wheelGeo(.95, .55, 16), M.dark, [i * 1.7, .95, 1.3], false).name = 'wheel';
        }
        return g;
      }

      /* — HELIKOPTER: fuselage ellipsoid, kanopi kaca, boom ekor silinder, rotor utama & ekor — */
      function buildHelicopter(side) {
        const M = bigMats(side), g = new THREE.Group();
        const bodyGeo = sphG(1.5, 18, 14); bodyGeo.scale(2.4, 1.0, 1.0);                      // badan (ellipsoid memanjang)
        part(g, bodyGeo, M.hull, [.4, 0, 0]);
        const cg = sphG(1.15, 16, 12); cg.scale(1.5, 1.0, 1.0);
        part(g, cg, M.glass, [2.4, -.1, 0]);                                                  // kokpit kaca
        part(g, tubeX(.32, .18, 3.6, 12), M.hull, [-3.1, .35, 0]);                            // boom ekor
        part(g, wingGeo(1.3, .9, .5, .2, .16), M.hull, [-4.5, .7, 0]);                        // sirip ekor vertikal → putar
        const fin = g.children[g.children.length - 1]; fin.rotation.x = Math.PI / 2;
        part(g, tubeX(.1, .1, 3.0, 8), M.dark, [.2, -1.25, -.85]);                            // skid kiri
        part(g, tubeX(.1, .1, 3.0, 8), M.dark, [.2, -1.25, .85]);                             // skid kanan
        part(g, boxG(.16, 1.1, .16), M.dark, [0, -.65, -.85], false);
        part(g, boxG(.16, 1.1, .16), M.dark, [0, -.65, .85], false);
        part(g, tubeX(.28, .28, .6, 10), M.metal, [.4, 1.3, 0], false);                       // mast rotor
        const rotor = new THREE.Group(); rotor.name = 'rotor'; rotor.position.set(.4, 1.7, 0);
        part(rotor, new THREE.CylinderGeometry(.32, .32, .3, 10), M.metal, [0, 0, 0], false); // hub
        for (let b = 0; b < 4; b++) {                                                          // 4 bilah tipis ber-bevel
          const bl = part(rotor, boxG(4.6, .06, .34), M.dark, [0, 0, 0], false);
          bl.rotation.y = b * Math.PI / 2; bl.position.x = Math.cos(b * Math.PI / 2) * 2.3; bl.position.z = Math.sin(b * Math.PI / 2) * 2.3;
        }
        g.add(rotor);
        const tail = new THREE.Group(); tail.name = 'tailRotor'; tail.position.set(-4.7, .7, .3);
        for (let b = 0; b < 2; b++) { const bl = part(tail, boxG(.1, 1.5, .22), M.dark, [0, 0, 0], false); bl.rotation.x = b * Math.PI / 2; }
        g.add(tail);
        return g;
      }

      /* — JET tempur: fuselage silinder meruncing, kanopi, sayap delta tersapu, ekor, mesin — */
      function buildJet(side) {
        const M = bigMats(side), g = new THREE.Group();
        part(g, tubeX(.85, .85, 4.6, 20), M.hull, [-.2, 0, 0]);                               // fuselage tengah
        part(g, tubeX(.15, .85, 2.2, 20), M.hull, [3.1, 0, 0]);                               // hidung meruncing
        part(g, tubeX(.85, .7, 1.4, 20), M.metal, [-2.7, 0, 0]);                              // buritan/nozzle
        part(g, tubeX(.55, .55, .6, 16), M.dark, [-3.4, 0, 0], false);                        // afterburner
        const can = sphG(.6, 14, 10); can.scale(1.8, .9, .9); part(g, can, M.glass, [1.7, .55, 0]);  // kanopi
        part(g, wingGeo(2.6, 3.4, .6, 1.9, .18), M.wing, [-.4, 0, 0]);                         // sayap kanan
        part(g, wingGeo(2.6, 3.4, .6, 1.9, .18), M.wing, [-.4, 0, 0]).scale.z = -1;            // sayap kiri (cermin)
        part(g, wingGeo(1.2, 1.5, .35, 1.0, .14), M.wing, [-2.4, 0, 0]);                       // ekor horizontal kanan
        part(g, wingGeo(1.2, 1.5, .35, 1.0, .14), M.wing, [-2.4, 0, 0]).scale.z = -1;          // ekor horizontal kiri
        const vfin = part(g, wingGeo(1.3, 1.4, .4, 1.0, .16), M.wing, [-2.5, .2, 0]); vfin.rotation.x = Math.PI / 2;  // sirip vertikal
        part(g, boxG(.3, .18, 1.5), M.accent, [.6, .0, 0], false);                             // garis aksen
        addAfterburner(g, -3.95, 0, 0, 1.8);                                                   // nyala afterburner di nosel
        return g;
      }

      /* — BOMBER berat: fuselage besar, sayap panjang tersapu, 4 nacelle mesin, ekor tinggi — */
      function buildBomber(side) {
        const M = bigMats(side), g = new THREE.Group();
        part(g, tubeX(1.3, 1.3, 6.4, 22), M.hull, [-.2, 0, 0]);                               // fuselage
        part(g, tubeX(.3, 1.3, 2.6, 22), M.hull, [4.2, 0, 0]);                                // hidung
        part(g, tubeX(1.3, 1.0, 1.6, 22), M.metal, [-3.6, 0, 0]);                             // buritan
        const can = sphG(.55, 14, 10); can.scale(1.4, .9, .9); part(g, can, M.glass, [4.6, .55, 0]);  // kokpit
        part(g, wingGeo(5.0, 4.4, 1.0, 2.4, .28), M.wing, [-.3, 0, 0]);                        // sayap kanan panjang
        part(g, wingGeo(5.0, 4.4, 1.0, 2.4, .28), M.wing, [-.3, 0, 0]).scale.z = -1;           // sayap kiri
        part(g, wingGeo(1.9, 2.4, .6, 1.2, .2), M.wing, [-3.4, 0, 0]);                         // ekor horizontal kanan
        part(g, wingGeo(1.9, 2.4, .6, 1.2, .2), M.wing, [-3.4, 0, 0]).scale.z = -1;            // ekor horizontal kiri
        const vfin = part(g, wingGeo(2.0, 2.2, .7, 1.3, .22), M.wing, [-3.5, .3, 0]); vfin.rotation.x = Math.PI / 2;  // sirip vertikal
        for (const zs of [-2.7, -1.4, 1.4, 2.7]) {                                             // 4 nacelle mesin di bawah sayap
          part(g, tubeX(.5, .5, 1.8, 14), M.metal, [-.2, -.7, zs]);
          part(g, tubeX(.42, .42, .3, 14), M.dark, [-1.2, -.7, zs], false);
          addAfterburner(g, -1.35, -.7, zs, .95);                                              // nyala tiap mesin
        }
        part(g, boxG(.4, .2, 2.0), M.accent, [.8, 0, 0], false);
        return g;
      }

      const BIG_BUILDERS = { tank: buildTank, apc: buildAPC, helicopter: buildHelicopter, jet: buildJet, bomber: buildBomber };
      const BIG_TEMPLATE = {};
      function bigTemplate(key, side) {
        const ck = key + '_' + side;
        if (!BIG_TEMPLATE[ck]) BIG_TEMPLATE[ck] = BIG_BUILDERS[key](side);
        return BIG_TEMPLATE[ck].clone(true);   // clone berbagi geometri & material → hemat memori
      }

      /* — TANK (menghadap +x, roda berputar & laras bisa recoil saat menembak) — */
      function makeTank(side) {
        const g = bigTemplate('tank', side);
        attachAura(g, side, 18).position.y = 2;
        g.userData = { wheels: collectWheels(g), gun: markRecoilable(g.getObjectByName('gun')) };
        return g;
      }
      /* — HELIKOPTER (menghadap +x, rotor utama & rotor ekor berputar) — */
      function makeHelicopter(side) {
        const g = bigTemplate('helicopter', side);
        attachAura(g, side, 20);
        g.userData = { rotor: g.getObjectByName('rotor'), tailRotor: g.getObjectByName('tailRotor') };
        return g;
      }
      /* — PESAWAT TEMPUR (menghadap +x) — */
      function makeJet(side) {
        const g = bigTemplate('jet', side);
        attachAura(g, side, 20);
        return g;
      }
      /* — APC / KENDARAAN LAPIS BAJA RINGAN (menghadap +x) — beroda, laras tipis — */
      function makeAPC(side) {
        const g = bigTemplate('apc', side);
        attachAura(g, side, 15).position.y = 1.6;
        g.userData = { wheels: collectWheels(g), gun: markRecoilable(g.getObjectByName('gun')) };
        return g;
      }
      /* — BOMBER BERAT (menghadap +x) — puncak tingkatan, di atas jet, untuk order raksasa (≥ T_TITAN) */
      export function makeBomber(side) {
        const g = bigTemplate('bomber', side);
        attachAura(g, side, 26);
        return g;
      }

      /* ═══════════ DEBU ROTOR — kepulan tanah di bawah helikopter yang terbang rendah ═══════════ */
      function makeRotorDust() {
        const n = 36;
        const p = new Float32Array(n * 3), ph = new Float32Array(n), rad = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2; rad[i] = 2 + Math.random() * 9;
          p[i * 3] = Math.cos(a) * rad[i]; p[i * 3 + 1] = Math.random() * 2; p[i * 3 + 2] = Math.sin(a) * rad[i];
          ph[i] = Math.random() * Math.PI * 2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
        const mat = new THREE.PointsMaterial({ color: 0xcbb98a, map: GLOW, size: 5, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
        const pts = new THREE.Points(geo, mat);
        scene.add(pts);
        return { pts, base: p.slice(), ph, rad };
      }

      /* tangga tingkatan unit besar — tiap tingkat kini bisa punya beberapa varian karakter,
         dipilih acak tiap kemunculan supaya tidak monoton (mis. tank vs APC di tingkat yang sama) */
      const T_TITAN = 3000000;   // ≥ $3jt → puncak tingkatan: bomber
      const BIG_UNIT_TIERS = [
        { max: 300000, fly: 0, makers: [{ key: 'tank', maker: makeTank }, { key: 'apc', maker: makeAPC }] },
        { max: 1000000, fly: 26, makers: [{ key: 'helicopter', maker: makeHelicopter }] },   // lebih melayang tinggi di udara
        { max: T_TITAN, fly: 38, makers: [{ key: 'jet', maker: makeJet }] },
        { max: Infinity, fly: 46, makers: [{ key: 'bomber', maker: makeBomber }] },
      ];
      /* skala dasar per jenis unit — dihitung per model (bukan angka seragam) supaya tiap unit
         terlihat proporsional jauh melebihi tinggi prajurit (≈8.5 unit), bukan sekadar sedikit lebih besar.
         Kendaraan darat (tank/APC) diukur dari tinggi bodinya; pesawat (heli/jet/bomber) dari panjang
         badannya, karena bentuknya pipih — kalau dipatok dari tinggi, hasilnya jadi raksasa tak masuk akal. */
      export const UNIT_BASE_SCALE = { tank: 7.2, apc: 7.8, helicopter: 5.0, jet: 5.6, bomber: 5.2 };
      function pickBigUnit(usd) {
        const tier = BIG_UNIT_TIERS.find(t => usd < t.max);
        const pick = tier.makers[Math.floor(Math.random() * tier.makers.length)];
        return { maker: pick.maker, key: pick.key, fly: tier.fly };
      }

      /* ═══════════ UNIT (tembakan / unit besar) ═══════════ */
      export const units = [];
      export const lastImpact = new THREE.Vector3(0, 0, 0);

      export function spawnBigUnit(side, usd) {
        if (units.length >= MAX_UNITS) return;
        const color = side === 'buy' ? C_LONG : C_SHORT;
        const mag = Math.min(1, Math.log10(usd / T_WHALE + 1) / 2);
        const pick = pickBigUnit(usd);
        const sx = (side === 'buy' ? -1 : 1) * 185;
        const start = new THREE.Vector3(sx, pick.fly, (Math.random() - .5) * 180);
        const ownSign = side === 'buy' ? -1 : 1;   // sisi wilayah sendiri, sama seperti formasi prajurit (base.x)
        const ex = pick.fly > 0
          ? -ownSign * 28                          // unit udara: tetap melintas ke garis depan/wilayah lawan seperti semula
          : ownSign * (130 + Math.random() * 25);      // unit darat (tank/APC): berhenti di barisan belakang pasukan sendiri, menyerang dari sana
        const end = new THREE.Vector3(ex, pick.fly, (Math.random() - .5) * 180);
        const obj = pick.maker(side);
        const { rotor, tailRotor, wheels, gun } = obj.userData || {};
        const sc = UNIT_BASE_SCALE[pick.key] * (0.9 + mag * 0.3);   // identitas ukuran per jenis, mag cuma variasi ±
        obj.scale.set(sc, sc, sc);
        obj.rotation.y = side === 'buy' ? 0 : Math.PI;   // moncong menghadap musuh
        obj.userData = { pick: true, side, usd, price, ts: Date.now(), rotor, tailRotor, wheels, gun };
        scene.add(obj);
        bigUnitObjs.push(obj);
        playChargeHorn(start);
        const dust = pick.key === 'helicopter' ? makeRotorDust() : null;   // kepulan debu di bawah helikopter yang terbang rendah
        // fase: 'approach' (masuk) → 'hold' (menetap & menghujani lawan) → 'death' (tertembak lalu meledak)
        units.push({
          obj, start, end, apex: 0, t: 0, dur: 2.0, side, usd, mag, color, tier: 2, key: pick.key,
          fly: pick.fly, rotor, tailRotor, wheels, gun, dust, defender: side === 'buy' ? sellCrowd : buyCrowd,
          phase: 'approach', clock: 0, fireT: .2,
          approachDur: 1.2, holdDur: 3.4 + Math.random() * 1.6, deathDur: .6, deathSpin: 0,
          // parameter gerak lifelike — diacak per unit supaya tidak seragam
          bankAmp: pick.fly > 0 ? 0.5 + Math.random() * 0.35 : 0.12, bank: 0, pitch: 0,
          bobAmp: (pick.fly > 0 ? 2.4 : 0) * (0.8 + Math.random() * 0.5), bobFreq: 1.4 + Math.random() * 0.8,
          bobPhase: Math.random() * Math.PI * 2, yawWander: (Math.random() - .5) * 0.12, prevY: pick.fly, prevZ: 0, trailT: 0
        });
      }


      /* sang paus akhirnya tertembak jatuh oleh lawan → balasan peluru dari sisi musuh, lalu sekarat */
      export function enterDeath(u) {
        u.phase = 'death'; u.clock = 0;
        u.deathSpin = Math.random() < .5 ? -1 : 1;
        const target = u.obj.position.clone();
        const foe = u.side === 'buy' ? 'sell' : 'buy';                 // peluru datang DARI lawan
        for (let j = 0; j < 7; j++) {
          const from = crowdPoint(u.defender, 20);
          const to = target.clone().add(new THREE.Vector3((Math.random() - .5) * 7, (Math.random() - .5) * 7, (Math.random() - .5) * 7));
          fireBullet(foe, from, to, false, u.defender, true);       // tracer besar menghajar sang paus
        }
        playVolley(2, target);
      }

