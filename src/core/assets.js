      /* ═══════════ TEXTURES / GEOMETRY BERSAMA ═══════════ */
      function glowTexture() {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d');
        const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        r.addColorStop(0, 'rgba(255,255,255,1)');
        r.addColorStop(.35, 'rgba(255,255,255,.55)');
        r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r; g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      }
      export const GLOW = glowTexture();
      export const ringGeo = new THREE.RingGeometry(1, 1.35, 48);
      const IDENT_Q = new THREE.Quaternion();

