import { C_LONG, C_SHORT } from '../config.js';
import { renderer, scene } from '../core/renderer.js';

      /* ═══════════ LAPANGAN — foto rumput asli (land.png), ubin diulang di seluruh lapangan ═══════════ */
      /* peta normal dari kecerahan kanvas — memberi rumput kesan bergelombang di bawah cahaya matahari */
      function normalFromCanvas(src, strength) {
        const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
        const out = document.createElement('canvas'); out.width = w; out.height = h;
        const octx = out.getContext('2d'), img = octx.createImageData(w, h);
        const lum = (x, y) => { x = (x + w) % w; y = (y + h) % h; const i = (y * w + x) * 4; return (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255; };
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const nx = (lum(x - 1, y) - lum(x + 1, y)) * strength, ny = (lum(x, y - 1) - lum(x, y + 1)) * strength, nz = 1;
          const len = Math.hypot(nx, ny, nz), i = (y * w + x) * 4;
          img.data[i] = (nx / len * .5 + .5) * 255; img.data[i + 1] = (ny / len * .5 + .5) * 255; img.data[i + 2] = (nz / len * .5 + .5) * 255; img.data[i + 3] = 255;
        }
        octx.putImageData(img, 0, 0);
        return out;
      }
      const GROUND_REPEAT = 22;
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a5c30, roughness: 1, metalness: 0 });
      groundMat.envMapIntensity = 0;             // lapangan tak ikut IBL env map → warna rumput tetap pekat, tak tercuci
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;               // lapangan menampung bayangan unit besar
      scene.add(ground);
      /* sembunyikan layar muat begitu lapangan siap; jaring pengaman agar tak pernah nyangkut */
      function bootHide() { const b = document.getElementById('boot'); if (b && !b.classList.contains('gone')) { b.classList.add('gone'); setTimeout(() => { if (b.parentNode) b.remove(); }, 650); } }
      setTimeout(bootHide, 6000);
      new THREE.TextureLoader().load('land.jpg', (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        groundMat.color.set(0xffffff);   // biarkan warna asli foto, jangan ditimpa tint hijau
        groundMat.map = tex;
        groundMat.needsUpdate = true;
        bootHide();
        try {
          // dibuka lewat file:// (bukan server lokal) membuat kanvas "tainted" — baca piksel gagal,
          // tapi foto tanahnya sendiri (di atas) sudah tampil, jadi peta normal ini cukup dilewati saja
          const nCanvas = document.createElement('canvas'); nCanvas.width = nCanvas.height = 512;
          nCanvas.getContext('2d').drawImage(tex.image, 0, 0, 512, 512);
          const normalMap = new THREE.CanvasTexture(normalFromCanvas(nCanvas, 1.8));
          normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
          normalMap.repeat.copy(tex.repeat);
          groundMat.normalMap = normalMap;
          groundMat.needsUpdate = true;
        } catch (e) { }
      }, undefined, bootHide);   // tekstur gagal → tetap lanjut (lapangan warna solid)

      function patchTexture() {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d');
        const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
        r.addColorStop(0, 'rgba(70,58,32,.4)');
        r.addColorStop(.6, 'rgba(58,50,30,.2)');
        r.addColorStop(1, 'rgba(58,50,30,0)');
        g.fillStyle = r; g.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(c);
      }
      const field = new THREE.Mesh(
        new THREE.PlaneGeometry(560, 440),
        new THREE.MeshBasicMaterial({ map: patchTexture(), transparent: true, depthWrite: false })
      );
      field.rotation.x = -Math.PI / 2;
      field.position.y = .4;
      scene.add(field);

      /* ═══════════ GARIS DEPAN & WILAYAH — bergerak mengikuti tekanan ═══════════ */
export const fieldState = { buyShare: 0.5, frontX: 0 };
      export const TERR_HALF = 300;
      function terrPlane(color) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .14, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.y = .45; scene.add(m); return m;
      }
      export const buyTerr = terrPlane(C_LONG), sellTerr = terrPlane(C_SHORT);
      export const clashLine = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, 480),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      clashLine.position.y = 1.4; scene.add(clashLine);

