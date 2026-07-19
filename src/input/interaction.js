import { C_GOLD, C_LONG, C_SHORT } from '../config.js';
import { playCheer, playVolley } from '../audio/audio.js';
import { bigUnitObjs, crowdPoint, fireBullet, groundPoint } from '../combat/bullets.js';
import { rings } from '../combat/explosions.js';
import { ringGeo } from '../core/assets.js';
import { camera, scene } from '../core/renderer.js';
import { buyCrowd, sellCrowd } from '../entities/soldiers.js';
import { addShake, floatNum } from '../fx/juice.js';
import { I18N, lang } from '../i18n.js';
import { cv } from '../platform/wake-lock.js';
import { fmtUsd } from '../ui/market-pressure.js';
import { fieldState } from '../world/field.js';

      /* ═══════════ INTERAKSI — periksa unit paus & sorak di lapangan ═══════════ */
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const _hitPt = new THREE.Vector3();
      const tip = document.getElementById('unit-tip');
      let pinnedT = 0;

      /* ── A1: dorongan garis depan dari ketukan penonton (sorak "rally") — sementara, meluruh ── */
// pergeseran garis depan dari sorak; kembali ke 0 sendiri
export const interactState = { cheerBias: 0 };
      const CHEER_MAX = 90, CHEER_STEP = 20;

      /* ── A2: kunci kamera ke satu unit (prajurit biasa atau unit paus) sampai gugur ── */
      export let lockUnit = null;             // { type:'soldier', crowd, idx } | { type:'big', obj }
      export const lockBadge = document.getElementById('lock-badge');
      export const lockText = document.getElementById('lock-text');
      export const _lockPos = new THREE.Vector3();
      export const lockRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      lockRing.rotation.x = -Math.PI / 2; lockRing.visible = false; lockRing.renderOrder = 5;
      scene.add(lockRing);

      export function lockColor() { return (lockUnit && lockUnit.side === 'sell') ? C_SHORT : C_LONG; }
      export function releaseLock() { lockUnit = null; lockRing.visible = false; lockBadge.className = ''; }
      /* posisi dunia unit terkunci saat ini; false bila unit sudah tak ada → lepas kunci */
      export function lockPosNow(out) {
        if (!lockUnit) return false;
        if (lockUnit.type === 'big') {
          if (!lockUnit.obj.parent) { releaseLock(); return false; }
          out.copy(lockUnit.obj.position); return true;
        }
        const s = lockUnit.crowd.slots[lockUnit.idx];
        if (!s || (!s.active && !s.dying)) { releaseLock(); return false; }   // prajurit gugur → lepas
        const gi = lockUnit.idx * 3, gp = lockUnit.crowd.glowPos;
        out.set(gp[gi], Math.max(2, gp[gi + 1] - 4), gp[gi + 2]);
        return true;
      }
      function lockOnSoldier(crowd, idx) {
        const L = I18N[lang];
        lockUnit = { type: 'soldier', crowd, idx, side: crowd.sign < 0 ? 'buy' : 'sell' };
        lockBadge.className = 'show ' + lockUnit.side;
        lockText.textContent = lockUnit.side === 'buy' ? L.followBuy : L.followSell;
      }
      function lockOnBig(obj) {
        const L = I18N[lang];
        lockUnit = { type: 'big', obj, side: obj.userData.side };
        lockBadge.className = 'show ' + lockUnit.side;
        lockText.textContent = lockUnit.side === 'buy' ? L.followBigBuy : L.followBigSell;
      }
      lockBadge.onclick = (e) => { e.stopPropagation(); releaseLock(); };
      lockBadge.addEventListener('pointerdown', e => e.stopPropagation());
      lockBadge.addEventListener('pointerup', e => e.stopPropagation());   // jangan bocor jadi ketukan kanvas

      /* raycast ke kerumunan ber-instance → prajurit aktif terdekat yang di-klik */
      function pickSoldier(e) {
        setRay(e);
        let best = null, bestD = Infinity;
        for (const crowd of [buyCrowd, sellCrowd]) {
          const hits = raycaster.intersectObject(crowd.mesh);
          for (const h of hits) {
            const idx = h.instanceId;
            if (idx == null) continue;
            const s = crowd.slots[idx];
            if (s && s.active && !s.dying && h.distance < bestD) { best = { crowd, idx }; bestD = h.distance; break; }
          }
        }
        return best;
      }

      /* A1: dorong garis depan ke arah sisi yang di-sorak + bala bantuan & tembakan semangat */
      function pushFront(pt) {
        const side = pt.x < fieldState.frontX ? 'buy' : 'sell';
        const dir = side === 'buy' ? 1 : -1;                      // beli (kiri) mendorong garis ke kanan
        interactState.cheerBias = Math.max(-CHEER_MAX, Math.min(CHEER_MAX, interactState.cheerBias + dir * CHEER_STEP));
        const crowd = side === 'buy' ? buyCrowd : sellCrowd;
        // catatan: JANGAN menambah prajurit di sini — jumlah pasukan tiap sisi harus tetap
        // mencerminkan porsi beli/jual (crowd.target). rally hanya mendorong garis depan sesaat
        // (interactState.cheerBias, meluruh sendiri) + salvo semangat, tanpa mengubah jumlah army.
        const defender = side === 'buy' ? sellCrowd : buyCrowd;
        for (let i = 0; i < 4; i++) fireBullet(side, crowdPoint(crowd, 8), groundPoint(defender), false, defender);  // salvo semangat
        playVolley(1);
        spawnCheer(pt, side);
        floatNum(pt, '▲ RALLY', side === 'buy' ? 'up' : 'dn');
        addShake(.5);
      }

      function setRay(e) { ndc.x = (e.clientX / innerWidth) * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1; raycaster.setFromCamera(ndc, camera); }
      function pickUnit(e) {
        if (!bigUnitObjs.length) return null;
        setRay(e);
        const hits = raycaster.intersectObjects(bigUnitObjs, true);
        if (!hits.length) return null;
        let o = hits[0].object;
        while (o && !(o.userData && o.userData.pick)) o = o.parent;
        return o;
      }
      function showTip(u, x, y) {
        const d = u.userData, L = I18N[lang];
        tip.innerHTML =
          `<b class="${d.side}">${d.side === 'buy' ? L.bigBuy : L.bigSell}</b>` +
          `<span>${fmtUsd(d.usd)}</span>` +
          `<span>@ $${d.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>` +
          `<span class="tt">${new Date(d.ts).toLocaleTimeString('en-GB')}</span>`;
        tip.style.left = Math.min(innerWidth - 150, x + 14) + 'px';
        tip.style.top = Math.max(8, y - 8) + 'px';
        tip.classList.add('show');
      }
      function hideTip() { tip.classList.remove('show'); }
      export function hoverUnit(e) {
        const u = pickUnit(e);
        if (u) { showTip(u, e.clientX, e.clientY); cv.style.cursor = 'pointer'; }
        else { cv.style.cursor = ''; if (performance.now() > pinnedT) hideTip(); }
      }
      function spawnCheer(pos, side) {
        const col = side === 'buy' ? C_LONG : side === 'sell' ? C_SHORT : C_GOLD;
        const rm = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .75, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        rm.rotation.x = -Math.PI / 2; rm.position.copy(pos); rm.position.y = 1.5;
        scene.add(rm);
        rings.push({ rm, t: 0, dur: .7, max: 20 });
        playCheer();
      }
      export function onTap(e) {
        const u = pickUnit(e);
        if (u) { lockOnBig(u); showTip(u, e.clientX, e.clientY); pinnedT = performance.now() + 1800; return; }  // klik unit paus → tooltip + kunci kamera
        const sol = pickSoldier(e);
        if (sol) { lockOnSoldier(sol.crowd, sol.idx); return; }                    // klik prajurit → kunci kamera ke dia
        setRay(e);
        if (raycaster.ray.intersectPlane(groundPlane, _hitPt)) {
          if (lockUnit) releaseLock();                                            // ketuk tanah kosong saat terkunci → lepas kunci dulu
          else pushFront(_hitPt);                                                 // kalau tidak, sorak & dorong garis depan
        }
      }

