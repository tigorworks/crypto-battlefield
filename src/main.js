import { C_GOLD, C_GOLD2, C_LONG, C_SHORT, T_BOSS } from './config.js';
import { playBoom, playCannon, playChargeHorn, playThunder, setMusicLayer } from './audio/audio.js';
import { AXIS_X, _bdir, _bq, ambientFire, bigUnitObjs, bullets, crowdPoint, emitPuff, fireBullet, lastFireT, makeSpark, muzzleLights, puffs, sparks } from './combat/bullets.js';
import { booms, craters, debris, explode, rings } from './combat/explosions.js';
import { bloom } from './core/postfx/bloom.js';
import { camera, renderer, scene, sun } from './core/renderer.js';
import { airstrikes, barrages, spawnAirstrike, spawnBarrage } from './entities/airstrike.js';
import { enterDeath, lastImpact, units } from './entities/big-units.js';
import { buyCrowd, initCrowds, killSoldier, loadAllModels, reviveSoldier, sellCrowd, updateCrowd } from './entities/soldiers.js';
import { _pv, addFlash, addShake, bumpStreak, flashColor, flashEl, floatNum, juiceState } from './fx/juice.js';
import { I18N, applyLanguage, lang } from './i18n.js';
import { CINE_SHOTS, _camTgt, camMode, camState, followPos, keys, orbit } from './input/camera.js';
import { _lockPos, interactState, lockBadge, lockColor, lockPosNow, lockRing, lockUnit } from './input/interaction.js';
import { showEvent } from './ui/event-ticker.js';
import { flow, pressureState } from './ui/market-pressure.js';
import { TERR_HALF, buyTerr, clashLine, fieldState, sellTerr } from './world/field.js';
import { DAY_PERIOD, SKY_CALM, SKY_NIGHT, SKY_PUMP, SKY_STORM, _sky, aurora, bolt, boltMat, cloudShadows, embers, moonMat, rain, skulls, skyState, spawnSkull, stormFog, strikeBolt, updateShootingStar } from './world/sky.js';
import { connect } from './feed/market-feed.js';
      /* ═══════════ MAIN LOOP ═══════════ */
      const clock = new THREE.Clock();
      let regenTimer = 1;
      export function tick() {
        requestAnimationFrame(tick);
        const dt = Math.min(clock.getDelta(), .05);
        const t = clock.elapsedTime;
        if (juiceState.hitstop > 0) juiceState.hitstop -= dt;
        if (juiceState.slowmo > 0) juiceState.slowmo -= dt;
        // jeda hantam melambatkan simulasi sesaat; gerak lambat (serangan udara) menahan lebih lama & tak sekeras
        const sdt = juiceState.hitstop > 0 ? dt * 0.12 : (juiceState.slowmo > 0 ? dt * 0.4 : dt);

        // garis depan bergerak mengikuti tekanan; pasukan maju/mundur
        // sorak penonton (interactState.cheerBias) mendorong sesaat lalu meluruh kembali ke tekanan pasar sebenarnya
        interactState.cheerBias *= Math.pow(0.5, dt / 1.6);              // paruh-waktu ~1.6 dtk
        if (Math.abs(interactState.cheerBias) < 0.5) interactState.cheerBias = 0;
        const targetFront = (fieldState.buyShare - 0.5) * 2 * 180 + interactState.cheerBias;
        fieldState.frontX += (targetFront - fieldState.frontX) * Math.min(1, dt * 0.8);
        buyCrowd.pressBias = fieldState.frontX * 0.55;
        sellCrowd.pressBias = fieldState.frontX * 0.55;
        const bw = Math.max(2, fieldState.frontX + TERR_HALF);
        buyTerr.scale.set(bw, 480, 1); buyTerr.position.x = -TERR_HALF + bw / 2;
        const sw = Math.max(2, TERR_HALF - fieldState.frontX);
        sellTerr.scale.set(sw, 480, 1); sellTerr.position.x = fieldState.frontX + sw / 2;
        clashLine.position.x = fieldState.frontX;
        clashLine.material.color.setHex(fieldState.buyShare >= 0.5 ? C_LONG : C_SHORT);
        clashLine.material.opacity = (.3 + Math.abs(fieldState.buyShare - 0.5) * 1.1 + Math.sin(t * 4) * .05) * (1 - skyState.lull * 0.7);

        // langit & cuaca ikut skyState.mood
        skyState.mood += (skyState.moodTarget - skyState.mood) * Math.min(1, dt * 0.5);
        _sky.copy(SKY_CALM);
        if (skyState.mood < 0) _sky.lerp(SKY_STORM, -skyState.mood); else _sky.lerp(SKY_PUMP, skyState.mood);
        // siklus siang–malam (independen dari pasar): malam bikin tracer & ledakan makin menonjol
        const daylight = 0.5 + 0.5 * Math.cos((t % DAY_PERIOD) / DAY_PERIOD * Math.PI * 2);   // 1=siang, 0=malam
        _sky.lerp(SKY_NIGHT, (1 - daylight) * 0.82);
        _sky.multiplyScalar(0.5 + 0.5 * daylight);
        scene.background.copy(_sky); scene.fog.color.copy(_sky);
        sun.intensity = (.7 + skyState.mood * .22) * (0.3 + 0.7 * daylight);
        sun.color.setHex(skyState.mood < 0 ? 0xa7bcd6 : 0xfff0cf);
        moonMat.opacity = (1 - daylight) * 0.85;
        updateShootingStar(dt, daylight);

        // petir saat badai (dump keras) — kilat menyeluruh + guntur asli; makin keras dump, makin sering & makin ganda
        if (skyState.mood < -0.32) {
          const stormK = Math.min(1, (-skyState.mood - .32) / .68);
          skyState.lightningT -= dt;
          if (skyState.lightningT <= 0) {
            skyState.lightningT = (7 - stormK * 5.5) + Math.random() * (4 - stormK * 2.5);
            addFlash(.32 + Math.random() * .15 + stormK * .2, '#dfeaff');
            setTimeout(() => addFlash(.2, '#dfeaff'), 90);   // kilat ganda, lebih redup
            const z0 = strikeBolt();
            playThunder(z0);
            if (stormK > .6) setTimeout(() => { const z1 = strikeBolt(); playThunder(z1); }, 220 + Math.random() * 160);   // sambaran susulan saat dump sangat keras
          }
        } else skyState.lightningT = 4 + Math.random() * 3;
        if (bolt.visible) { skyState.boltT -= dt; boltMat.opacity = Math.max(0, skyState.boltT / 0.18); if (skyState.boltT <= 0) bolt.visible = false; }
        // kilat layar meluruh
        if (juiceState.flashV > .001) { flashEl.style.background = flashColor; flashEl.style.opacity = juiceState.flashV; juiceState.flashV = Math.max(0, juiceState.flashV - dt * 3.2); }
        else if (flashEl.style.opacity !== '0') { flashEl.style.opacity = '0'; }
        const rainOp = Math.max(0, -skyState.mood), embOp = Math.max(0, skyState.mood);
        const rainSpeedMul = 1 + rainOp * 1.6;   // dump keras → hujan turun jauh lebih deras
        rain.m.material.opacity = rainOp * .55;
        if (rainOp > .02) {
          const a = rain.attr.array;
          for (let i = 0; i < rain.n; i++) {
            a[i * 3 + 1] -= (320 + rain.v[i] * 520) * dt * rainSpeedMul;
            if (a[i * 3 + 1] < 0) { a[i * 3 + 1] = 320; a[i * 3] = (Math.random() - .5) * 900; a[i * 3 + 2] = (Math.random() - .5) * 700; }
          }
          rain.attr.needsUpdate = true;
        }
        embers.m.material.opacity = embOp * .75 * (1 - Math.min(1, embOp) * .4);   // aurora jadi sinyal utama pump, embers dikurangi bobotnya
        if (embOp > .02) {
          const a = embers.attr.array;
          for (let i = 0; i < embers.n; i++) {
            a[i * 3 + 1] += (28 + embers.v[i] * 58) * dt;
            a[i * 3] += Math.sin(t * 1.3 + i) * 7 * dt;
            if (a[i * 3 + 1] > 320) { a[i * 3 + 1] = 0; a[i * 3] = (Math.random() - .5) * 900; a[i * 3 + 2] = (Math.random() - .5) * 700; }
          }
          embers.attr.needsUpdate = true;
        }

        // kabut badai merayap di tanah — menebal & lapisan kian tampak seiring dump makin keras
        const stormFogK = Math.pow(rainOp, 1.2);
        scene.fog.near = 500 - stormFogK * 260;
        scene.fog.far = 2400 - stormFogK * 1000;
        for (const fl of stormFog) {
          fl.m.material.opacity = stormFogK * .2 * fl.weight;   // dijaga tetap tipis — kabut, bukan tirai yang menutupi seluruh lapangan
          fl.m.material.color.copy(_sky).multiplyScalar(1.2);   // ikuti warna langit saat ini (gelap di malam hari) — warna abu-abu tetap akan tampak pucat & aneh saat malam kalau dipatok
          fl.m.position.x = Math.sin(t * fl.speed) * 260;
        }

        // aurora tinggi di langit — sinyal utama pump, bergelombang pelan
        const auroraOp = Math.pow(embOp, 1.3) * Math.max(0, 1 - daylight / 0.45);   // aurora nyata cuma kelihatan malam hari — pudar total begitu langit mulai terang
        for (const rb of aurora) {
          rb.m.material.opacity = auroraOp * .4;
          if (auroraOp > .01) {
            const pos = rb.m.geometry.attributes.position, base = rb.base;
            for (let i = 0; i < pos.count; i++) {
              const bx = base[i * 3], by = base[i * 3 + 1];
              pos.array[i * 3] = bx + Math.sin(t * rb.speed + i * .5 + rb.phase) * 26 * (1 - Math.abs(by) / (rb.m.geometry.parameters.height * .5));
            }
            pos.needsUpdate = true;
          }
        }

        // bayangan awan melintas pelan lewat lapangan — hanya terlihat jelas saat pasar tenang (skyState.mood ≈ 0)
        const calmK = Math.max(0, 1 - Math.abs(skyState.mood) * 2.2);
        for (const cs of cloudShadows) {
          cs.m.material.opacity = calmK * .1;
          cs.m.position.x += cs.speed * dt;
          if (cs.m.position.x > 560) cs.m.position.x = -560;
        }

        const nowMs = performance.now();

        // JEDA TENANG — dinilai relatif terhadap rerata laju transaksi sesi berjalan (bukan angka mutlak),
        // supaya tetap peka baik di pasangan cepat (BTC, puluhan transaksi/detik) maupun lambat: dianggap
        // "sepi" saat laju 15 detik terakhir jatuh jauh di bawah rerata adaptifnya sendiri.
        let recentCnt = 0, cnt15 = 0;
        for (let i = flow.length - 1; i >= 0; i--) {
          const age = nowMs - flow[i].t;
          if (age >= 15000) break;
          cnt15++;
          if (age < 6000) recentCnt++;
        }
        const rate15 = cnt15 / 15;
        pressureState.flowRateEMA = pressureState.flowRateEMA === null ? rate15 : pressureState.flowRateEMA + (rate15 - pressureState.flowRateEMA) * Math.min(1, dt / 45);
        const lullTarget = (recentCnt < 4 || (pressureState.flowRateEMA > 0.15 && rate15 < pressureState.flowRateEMA * 0.4)) ? 1 : 0;
        skyState.lull += (lullTarget - skyState.lull) * Math.min(1, dt * (lullTarget ? 0.7 : 2.5));
        if (!skyState.lullActive && skyState.lull > 0.7) { skyState.lullActive = true; showEvent(I18N[lang].lull, 'neutral'); setMusicLayer('calm'); }
        else if (skyState.lullActive && skyState.lull < 0.3) { skyState.lullActive = false; showEvent(I18N[lang].lullEnd, 'neutral'); playChargeHorn(); setMusicLayer('busy'); }

        updateCrowd(buyCrowd, sdt, t);
        updateCrowd(sellCrowd, sdt, t);
        // bala bantuan HANYA masuk saat jumlah di bawah target (persentase buy/sell).
        // pengurangan jumlah terjadi lewat peluru lawan — prajurit mati karena tertembak, bukan kabur.
        // isi cepat beberapa sekaligus supaya seimbang dengan laju kematian → banyak pergerakan masuk/mati.
        regenTimer -= dt;
        if (regenTimer <= 0) {
          regenTimer = .05;
          for (const c of [buyCrowd, sellCrowd]) {
            let n = Math.min(14, c.target - c.count);   // isi cepat agar seimbang dengan laju kematian
            while (n-- > 0) reviveSoldier(c);
          }
        }
        // jangan pernah ada jeda tembakan lebih dari ~0.25 detik — KECUALI saat gencatan (pasar sunyi)
        if (skyState.lull < 0.6 && performance.now() - lastFireT > 250) ambientFire();

        for (let i = skulls.length - 1; i >= 0; i--) {
          const s = skulls[i];
          s.t += sdt / s.dur;
          if (s.t >= 1) { scene.remove(s.spr); s.spr.material.dispose(); skulls.splice(i, 1); continue; }
          const e = s.t < .3 ? s.t / .3 : 1;
          const g = 3 + e * 3.5;
          s.spr.scale.set(g, g, 1);
          s.spr.position.y = 4 + s.t * 6;
          s.spr.material.opacity = (s.t < .4 ? .5 : .5 * (1 - (s.t - .4) / .6));
        }

        for (let i = units.length - 1; i >= 0; i--) {
          const u = units[i];
          if (u.tier === 2) {
            u.clock += sdt;
            if (u.phase === 'approach') {
              const k = Math.min(1, u.clock / u.approachDur);
              // easing berbobot: easeOutBack — melambat lalu sedikit menyusul & mengendap, terasa bermassa
              const c1 = 1.70158, c3 = c1 + 1, km = k - 1;
              const e = 1 + c3 * km * km * km + c1 * km * km;
              u.obj.position.lerpVectors(u.start, u.end, e);
              if (k >= 1) { u.phase = 'hold'; u.clock = 0; }
            } else if (u.phase === 'hold') {
              // MENETAP di garis depan sambil menghujani lawan — efeknya jadi terlihat
              u.obj.position.x = u.end.x;
              u.obj.position.z = u.end.z + Math.sin(t * 0.7 + u.start.z) * 4;   // menggeser pelan, terlihat hidup
              if (u.clock >= u.holdDur) enterDeath(u);
            } else {                                                   // death — sudah tertembak, sekarat sebelum meledak
              u.obj.rotation.z += sdt * 2.6 * u.deathSpin;                 // oleng (pitch)
              u.obj.rotation.x += sdt * 1.9 * u.deathSpin;                 // gulung (roll) → tumbling multi-sumbu
              u.obj.position.y -= sdt * (u.fly > 0 ? 14 : 3);              // tersungkur / jatuh
              // ASAP KEMATIAN — kepulan gelap membumbung dari bangkai yang jatuh
              u.trailT -= sdt;
              if (u.trailT <= 0) {
                u.trailT = .045;
                const sz = u.obj.scale.x * (5 + Math.random() * 3);
                emitPuff(u.obj.position.x + (Math.random() - .5) * 4, u.obj.position.y, u.obj.position.z + (Math.random() - .5) * 4,
                  0x2b2b30, sz, 1.1 + Math.random() * .5, 10 + Math.random() * 6, .55, false);
              }
              if (u.clock >= u.deathDur) {
                scene.remove(u.obj);
                if (u.dust) scene.remove(u.dust.pts);
                const bi = bigUnitObjs.indexOf(u.obj); if (bi >= 0) bigUnitObjs.splice(bi, 1);
                explode(u.obj.position, u.color, u.mag, u.tier);
                units.splice(i, 1); continue;
              }
            }
            if (u.phase !== 'death') {
              // melayang & mengambang untuk unit udara — amplitudo/frekuensi diacak per unit agar tak seragam
              u.obj.position.y = u.fly + (u.fly > 0 ? Math.sin(t * u.bobFreq + u.bobPhase) * u.bobAmp : 0);
              // BANKING & PITCH — dihitung dari kecepatan lateral/vertikal sesaat, lalu dihaluskan (berbobot).
              // Konvensi model (menghadap +x): rotation.x = roll, rotation.z = pitch, rotation.y = yaw.
              const s = u.side === 'buy' ? 1 : -1;
              const vz = (u.obj.position.z - u.prevZ) / Math.max(sdt, 1e-3);
              const vy = (u.obj.position.y - u.prevY) / Math.max(sdt, 1e-3);
              u.prevZ = u.obj.position.z; u.prevY = u.obj.position.y;
              const tgtBank = Math.max(-1, Math.min(1, -vz * 0.02)) * u.bankAmp;   // miring ke arah belok
              const tgtPitch = Math.max(-0.45, Math.min(0.45, vy * 0.016));        // mendongak saat naik
              u.bank += (tgtBank - u.bank) * Math.min(1, sdt * 4);
              u.pitch += (tgtPitch - u.pitch) * Math.min(1, sdt * 4);
              const baseYaw = u.side === 'buy' ? 0 : Math.PI;
              u.obj.rotation.set(u.bank * s, baseYaw + Math.sin(t * 0.5 + u.bobPhase) * u.yawWander, u.pitch * s);
              // KONTRAIL — jejak tipis bercahaya di belakang jet & bomber
              if (u.key === 'jet' || u.key === 'bomber') {
                u.trailT -= sdt;
                if (u.trailT <= 0) {
                  u.trailT = .05;
                  const back = u.obj.scale.x * 4.2;
                  emitPuff(u.obj.position.x - s * back, u.obj.position.y, u.obj.position.z + (Math.random() - .5) * 2.5,
                    0xdfeaff, u.obj.scale.x * 1.7, .7, 2.5, .22, true);
                }
              }
            }
            if (u.rotor) u.rotor.rotation.y += sdt * 40;                 // baling-baling berputar
            if (u.tailRotor) u.tailRotor.rotation.x += sdt * 55;         // rotor ekor berputar sumbu lain
            if (u.phase !== 'death' && u.wheels) {                       // roda tank & APC menggelinding di tempat
              for (const w of u.wheels) w.rotation.z += sdt * 5.5;
            }
            if (u.gun && u.gun.userData.basePos) {                       // laras menyentak balik tiap kali menembak, lalu kembali
              u.gun.userData.recoilT = Math.max(0, (u.gun.userData.recoilT || 0) - sdt);
              const rk = u.gun.userData.recoilT / .16;
              const bp = u.gun.userData.basePos;
              u.gun.position.set(bp.x - rk * .55, bp.y, bp.z);
            }
            if (u.dust) {                                               // debu rotor — pekat saat helikopter aktif, reda saat sekarat
              const targetOp = u.phase !== 'death' ? .4 : 0;
              u.dust.pts.material.opacity += (targetOp - u.dust.pts.material.opacity) * Math.min(1, dt * 3);
              const pos = u.dust.pts.geometry.attributes.position;
              for (let k = 0; k < u.dust.ph.length; k++) {
                u.dust.ph[k] += dt * 1.6;
                const wob = 1 + Math.sin(u.dust.ph[k]) * .18;
                pos.array[k * 3] = u.obj.position.x + u.dust.base[k * 3] * wob;
                pos.array[k * 3 + 1] = 1 + Math.abs(Math.sin(u.dust.ph[k] * .7)) * 1.6;
                pos.array[k * 3 + 2] = u.obj.position.z + u.dust.base[k * 3 + 2] * wob;
              }
              pos.needsUpdate = true;
            }
            if (u.phase !== 'death') {                                    // masih hidup → terus menyerang
              u.fireT -= sdt;
              if (u.fireT <= 0) {
                u.fireT = .16;
                // tembakan keluar dari moncong senjata (node 'gun') kalau ada — bukan dari dasar unit
                const from = u.gun ? u.gun.getWorldPosition(new THREE.Vector3()) : u.obj.position.clone();
                if (!u.gun) from.y += u.fly > 0 ? 2 : 16;   // unit tanpa node 'gun' eksplisit (heli/jet/bomber) — perkiraan tinggi moncong
                fireBullet(u.side, from, crowdPoint(u.defender, 14), true, u.defender, true); // peluru besar, jangkauan jauh
                if (u.gun) u.gun.userData.recoilT = .16;
                playCannon(from);
              }
            }
          } else {
            u.t += sdt / u.dur;
            if (u.t >= 1) {
              scene.remove(u.obj);
              if (u.obj.material) u.obj.material.dispose();
              explode(u.end, u.color, u.mag, u.tier);
              units.splice(i, 1); continue;
            }
            const k = u.t;
            u.obj.position.lerpVectors(u.start, u.end, k);
            u.obj.position.y = u.start.y + Math.sin(k * Math.PI) * u.apex;
          }
        }

        // serangan udara — pembom melintas menjatuhkan bom beruntun di garis lawan
        for (let i = airstrikes.length - 1; i >= 0; i--) {
          const a = airstrikes[i];
          a.t += sdt / a.dur;
          const k = Math.min(1, a.t);
          a.obj.position.lerpVectors(a.from, a.to, k);
          a.obj.position.y = 150 + Math.sin(k * Math.PI) * 8;
          if (a.rotor) a.rotor.rotation.y += sdt * 40;
          while (a.dropped < a.drops.length && k >= a.drops[a.dropped]) {
            a.dropped++;
            const gp = new THREE.Vector3(a.obj.position.x, 1, a.z0 + (Math.random() - .5) * 42);
            explode(gp, a.side === 'buy' ? C_LONG : C_SHORT, .9, 2);
            makeSpark(gp, C_GOLD, 34, .4);
            killSoldier(a.defender, 5);
            spawnSkull(gp);
            addShake(1.6); addFlash(.26, '#ffd9a3');
            playBoom(.9, 2, gp);
          }
          if (a.t >= 1) {
            scene.remove(a.obj);
            const bi = bigUnitObjs.indexOf(a.obj); if (bi >= 0) bigUnitObjs.splice(bi, 1);
            airstrikes.splice(i, 1);
          }
        }

        // tembakan artileri — mortir jatuh beruntun ke wilayah lawan (varian lain order boss)
        for (let i = barrages.length - 1; i >= 0; i--) {
          const b = barrages[i];
          b.t += sdt;
          while (b.done < b.shells.length && b.t >= b.shells[b.done].at) {
            const s = b.shells[b.done++];
            b.curPos.copy(s.pos);
            explode(s.pos, C_GOLD2, .85 + Math.random() * .25, 2);
            makeSpark(s.pos, C_GOLD, 26, .3);
            killSoldier(b.defender, 4);
            spawnSkull(s.pos);
            addShake(1.3); addFlash(.2, '#ffcf8c');
            playBoom(.85, 2, s.pos);
          }
          if (b.t >= b.dur) {
            barrages.splice(i, 1);
          }
        }

        // peluru pelacak
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          const step = b.speed * sdt;
          b.traveled += step;
          b.pos.addScaledVector(b.vel, step);
          _bdir.copy(b.vel);
          _bq.setFromUnitVectors(AXIS_X, _bdir);
          b.m.quaternion.copy(_bq);
          b.m.position.copy(b.pos);
          b.m.scale.set(b.len, b.w, b.w);
          if (b.traveled >= b.dist) {
            const killN = b.big ? 3 : 1;                               // peluru besar = ledakan area
            if (b.kills || b.big || Math.random() < .22) makeSpark(b.target, b.color, b.big ? 28 : 12, b.big ? .32 : .18);
            if (b.kills) {
              killSoldier(b.defender, killN);
              spawnSkull(b.target);
              floatNum(b.target, '-' + killN, b.side === 'buy' ? 'up' : 'dn');
              if (b.big) addShake(.6);
            }
            scene.remove(b.m);
            bullets.splice(i, 1);
          }
        }

        // percikan / kilatan moncong
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.t += sdt / s.dur;
          if (s.t >= 1) { scene.remove(s.spr); s.spr.material.dispose(); sparks.splice(i, 1); continue; }
          const g = s.size * (1 + s.t * 1.3);
          s.spr.scale.set(g, g, 1);
          s.spr.material.opacity = 1 - s.t;
        }

        // kepulan — kontrail & asap kematian (naik, melebar, memudar)
        for (let i = puffs.length - 1; i >= 0; i--) {
          const p = puffs[i];
          p.t += sdt / p.dur;
          if (p.t >= 1) { scene.remove(p.spr); p.spr.material.dispose(); puffs.splice(i, 1); continue; }
          p.spr.position.y += p.rise * sdt;
          p.spr.position.x += p.drift * sdt;
          const g = p.size * (1 + p.t * 1.4);
          p.spr.scale.set(g, g, 1);
          p.spr.material.opacity = (p.t < .2 ? p.t / .2 : 1 - (p.t - .2) / .8) * p.peak;
        }

        // kilatan moncong — denyut PointLight meluruh cepat
        for (const ml of muzzleLights) {
          if (ml.t > 0) { ml.t -= sdt; ml.l.intensity = ml.peak * Math.max(0, ml.t / ml.dur); }
        }

        for (let i = booms.length - 1; i >= 0; i--) {
          const b = booms[i];
          b.t += dt / b.dur;
          if (b.t >= 1) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); booms.splice(i, 1); continue; }
          const pos = b.pts.geometry.attributes.position;
          for (let j = 0; j < b.vel.length; j++) {
            b.vel[j].y -= 160 * dt;
            pos.array[j * 3] += b.vel[j].x * dt;
            pos.array[j * 3 + 1] = Math.max(1, pos.array[j * 3 + 1] + b.vel[j].y * dt);
            pos.array[j * 3 + 2] += b.vel[j].z * dt;
          }
          pos.needsUpdate = true;
          b.pts.material.opacity = 1 - b.t;
        }

        for (let i = rings.length - 1; i >= 0; i--) {
          const r = rings[i];
          r.t += dt / r.dur;
          if (r.t >= 1) { scene.remove(r.rm); r.rm.material.dispose(); rings.splice(i, 1); continue; }
          const s = 1 + r.t * r.max;
          r.rm.scale.set(s, s, 1);
          r.rm.material.opacity = .8 * (1 - r.t);
        }

        for (let i = craters.length - 1; i >= 0; i--) {
          const c = craters[i];
          c.t += dt / c.dur;
          if (c.t >= 1) { scene.remove(c.m); c.m.material.dispose(); craters.splice(i, 1); continue; }
          c.m.material.opacity = .85 * (1 - Math.max(0, (c.t - .6) / .4));   // tetap pekat dulu, baru meredup di akhir
        }

        for (let i = debris.length - 1; i >= 0; i--) {
          const d = debris[i];
          d.t += dt / d.dur;
          if (d.t >= 1) { scene.remove(d.m); d.m.material.dispose(); debris.splice(i, 1); continue; }
          d.vel.y -= 220 * dt;
          d.m.position.addScaledVector(d.vel, dt);
          if (d.m.position.y < .5) {
            d.m.position.y = .5;
            if (!d.bounced) { d.bounced = true; d.vel.y *= -.35; d.vel.x *= .6; d.vel.z *= .6; }
            else d.vel.y = 0;
          }
          d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; d.m.rotation.z += d.spin.z * dt;
          const fadeStart = .65, k = d.t > fadeStart ? 1 - (d.t - fadeStart) / (1 - fadeStart) : 1;
          d.m.material.opacity = k;
          d.m.scale.copy(d.baseScale).multiplyScalar(.4 + k * .6);
        }

        if (lockUnit && lockPosNow(_lockPos)) {
          // A2: kunci — kamera merapat & mengorbit pelan unit yang dipilih, di atas mode apa pun
          _camTgt.copy(_lockPos); _camTgt.y += 6;
          orbit.target.lerp(_camTgt, Math.min(1, dt * 4));
          orbit.phi += (0.32 - orbit.phi) * Math.min(1, dt * 2.2);
          orbit.radius += (72 - orbit.radius) * Math.min(1, dt * 2.2);
          orbit.theta += dt * 0.25 * (lockUnit.side === 'buy' ? 1 : -1);
        } else if (camMode === 0) {
          const shotDef = CINE_SHOTS[camState.cineIdx];
          if (t - camState.cineShotStart > shotDef.dur) {
            let ni; do { ni = (Math.random() * CINE_SHOTS.length) | 0; } while (ni === camState.cineIdx && CINE_SHOTS.length > 1);
            camState.cineIdx = ni; camState.cineShotStart = t;
          }
          const shot = shotDef.run(t - camState.cineShotStart, t, fieldState.frontX, shotDef.dur);
          orbit.theta += (shot.theta - orbit.theta) * dt * .8;
          orbit.phi += (shot.phi - orbit.phi) * dt * .8;
          orbit.radius += (shot.radius - orbit.radius) * dt * .7;
          _camTgt.set(shot.tx, shot.ty, shot.tz);
          orbit.target.lerp(_camTgt, dt * .8);
        } else if (camMode === 1) {
          followPos.lerp(lastImpact, dt * 2.2);
          orbit.target.lerp(new THREE.Vector3(followPos.x, 15, followPos.z), dt * 2.2);
          orbit.radius += (340 - orbit.radius) * dt * .8;
        } else {
          const sp = 300 * dt;
          const fwd = new THREE.Vector3(Math.sin(orbit.theta), 0, Math.cos(orbit.theta));
          const rgt = new THREE.Vector3(fwd.z, 0, -fwd.x);
          if (keys['w']) orbit.target.addScaledVector(fwd, -sp);
          if (keys['s']) orbit.target.addScaledVector(fwd, sp);
          if (keys['a']) orbit.target.addScaledVector(rgt, -sp);
          if (keys['d']) orbit.target.addScaledVector(rgt, sp);
          if (keys['q']) orbit.target.y = Math.max(5, orbit.target.y - sp);
          if (keys['e']) orbit.target.y += sp;
        }
        camera.position.set(
          orbit.target.x + orbit.radius * Math.cos(orbit.phi) * Math.sin(orbit.theta),
          orbit.target.y + orbit.radius * Math.sin(orbit.phi),
          orbit.target.z + orbit.radius * Math.cos(orbit.phi) * Math.cos(orbit.theta)
        );
        camera.lookAt(orbit.target);
        if (juiceState.shake > .01) {
          const k = juiceState.shake * (orbit.radius / 540);
          camera.position.x += (Math.random() - .5) * k * 2.2;
          camera.position.y += (Math.random() - .5) * k * 2.2;
          camera.position.z += (Math.random() - .5) * k * 2.2;
          juiceState.shake = Math.max(0, juiceState.shake - dt * 14);
        }

        // penanda cincin & lencana untuk unit yang terkunci (A2)
        if (lockUnit && lockPosNow(_lockPos)) {
          lockRing.visible = true;
          lockRing.position.set(_lockPos.x, 1.4, _lockPos.z);
          const pl = 3 + Math.sin(t * 6) * .5;
          lockRing.scale.set(pl, pl, 1);
          lockRing.material.color.setHex(lockColor());
          _pv.copy(_lockPos); _pv.y += 10; _pv.project(camera);
          if (_pv.z < 1) {
            lockBadge.style.left = ((_pv.x * .5 + .5) * innerWidth) + 'px';
            lockBadge.style.top = ((-_pv.y * .5 + .5) * innerHeight) + 'px';
          }
        } else if (lockRing.visible) {
          lockRing.visible = false;
          lockBadge.className = '';
        }

        // bloom: lebih kuat di malam hari (highlight menyala), lebih halus di siang; sedikit naik saat pump/badai
        const bloomStrength = 0.42 + (1 - daylight) * 0.75 + Math.abs(skyState.mood) * 0.15;
        bloom.render(bloomStrength);
      }

      addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
        bloom.setSize(innerWidth, innerHeight);
      });


      applyLanguage();

      /* bantuan uji manual dari console (peristiwa langka sulit ditunggu secara alami di pasar nyata):
         __testEvent('airstrike' | 'barrage' | 'streak' | 'star') */
      window.__testEvent = (name) => {
        const usd = T_BOSS * 1.5, side = Math.random() < .5 ? 'buy' : 'sell';
        if (name === 'airstrike') spawnAirstrike(side, usd);
        else if (name === 'barrage') spawnBarrage(side, usd);
        else if (name === 'streak') { for (let i = 0; i < 20; i++) bumpStreak(side); }
        else if (name === 'star') skyState.nextStarCheck = 0;
        else return 'unknown — use: airstrike | barrage | streak | star';
        return 'triggered: ' + name;
      };

      loadAllModels().then(() => {
        initCrowds();
        connect();
        tick();
      });
