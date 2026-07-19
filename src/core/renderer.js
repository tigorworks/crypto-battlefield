      /* ═══════════ THREE SETUP — lapangan hijau cerah di bawah langit ═══════════ */
      export const SKY = 0x8fc6ec;
      export const scene = new THREE.Scene();
      scene.background = new THREE.Color(SKY);
      scene.fog = new THREE.Fog(SKY, 500, 2400);

      export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 6000);
      export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      renderer.setSize(innerWidth, innerHeight);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      /* bayangan halus — faktor terbesar agar unit besar terasa "menapak" di lapangan.
         (Pipeline warna global sengaja dibiarkan seperti aslinya agar langit/lapangan/mood pasar
         tak berubah — realisme difokuskan pada unit whale lewat geometri, material PBR & env map.) */
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      document.body.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x38471f, .85));
      export const sun = new THREE.DirectionalLight(0xfff3d6, .7);
      sun.position.set(-260, 420, -180);
      sun.castShadow = true;                     // matahari menjatuhkan bayangan unit besar
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0004;                 // hindari shadow-acne pada permukaan lengkung
      sun.shadow.normalBias = 0.6;
      {
        const sc = sun.shadow.camera;            // frustum ortho menutupi seluruh area main (± ~320 x, ± ~260 z)
        sc.left = -340; sc.right = 340; sc.top = 300; sc.bottom = -300;
        sc.near = 120; sc.far = 1200;
        sc.updateProjectionMatrix();
      }
      const fill = new THREE.DirectionalLight(0xffffff, .18);
      fill.position.set(300, 200, 260);
      scene.add(fill);

      /* ═══════════ ENV MAP PBR — gradient langit→tanah diolah PMREMGenerator supaya permukaan metal
         unit whale memantulkan lingkungan (refleksi realistis), bukan sekadar warna datar ═══════════ */
      (function buildEnvironment() {
        const c = document.createElement('canvas'); c.width = 16; c.height = 128;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, 128);
        grad.addColorStop(0.00, '#bfe0f4');      // langit atas
        grad.addColorStop(0.48, '#8fc6ec');      // horizon
        grad.addColorStop(0.52, '#6f7d55');      // tanah dekat horizon
        grad.addColorStop(1.00, '#3a4426');      // tanah bawah
        g.fillStyle = grad; g.fillRect(0, 0, 16, 128);
        const tex = new THREE.CanvasTexture(c);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        scene.environment = pmrem.fromEquirectangular(tex).texture;
        tex.dispose(); pmrem.dispose();
      })();

