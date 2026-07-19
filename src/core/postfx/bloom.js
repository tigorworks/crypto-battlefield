import { camera, renderer, scene } from '../renderer.js';

      /* ═══════════ BLOOM — post-processing sinematik kustom (tanpa addon; API core saja) ═══════════
         Alur tiap frame: (1) render scene ke render target, (2) bright-pass menyaring highlight,
         (3) blur gaussian separable (ping-pong beberapa lintas), (4) composite aditif ke layar.
         Highlight (tracer, ledakan, afterburner, aura, malam hari) jadi bermekar/menyala. */
      export const bloom = (() => {
        const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
        const dpr = Math.min(devicePixelRatio, 2);
        const rtType = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
        const rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: rtType, depthBuffer: true };
        let sw = Math.max(2, Math.floor(innerWidth * dpr)), sh = Math.max(2, Math.floor(innerHeight * dpr));
        let bw = Math.max(1, sw >> 1), bh = Math.max(1, sh >> 1);
        const rtScene = new THREE.WebGLRenderTarget(sw, sh, rtOpt);
        const rtA = new THREE.WebGLRenderTarget(bw, bh, { ...rtOpt, depthBuffer: false });
        const rtB = new THREE.WebGLRenderTarget(bw, bh, { ...rtOpt, depthBuffer: false });
        const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); fsScene.add(fsQuad);
        const brightMat = new THREE.ShaderMaterial({
          uniforms: { tDiffuse: { value: null }, threshold: { value: 0.8 }, knee: { value: 0.35 } },
          vertexShader: VS, depthTest: false, depthWrite: false,
          fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float threshold, knee;' +
            'void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.299,0.587,0.114));' +
            'float s = smoothstep(threshold, threshold + knee, l); gl_FragColor = vec4(c * s, 1.0); }',
        });
        const blurMat = new THREE.ShaderMaterial({
          uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, texel: { value: new THREE.Vector2(1 / bw, 1 / bh) } },
          vertexShader: VS, depthTest: false, depthWrite: false,
          fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 dir, texel;' +
            'void main(){ vec2 o = dir * texel; vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227027;' +
            's += texture2D(tDiffuse, vUv + o*1.3846).rgb * 0.316216; s += texture2D(tDiffuse, vUv - o*1.3846).rgb * 0.316216;' +
            's += texture2D(tDiffuse, vUv + o*3.2308).rgb * 0.070270; s += texture2D(tDiffuse, vUv - o*3.2308).rgb * 0.070270;' +
            'gl_FragColor = vec4(s, 1.0); }',
        });
        const compMat = new THREE.ShaderMaterial({
          uniforms: { tScene: { value: null }, tBloom: { value: null }, strength: { value: 0.7 } },
          vertexShader: VS, depthTest: false, depthWrite: false,
          fragmentShader: 'varying vec2 vUv; uniform sampler2D tScene, tBloom; uniform float strength;' +
            'void main(){ vec3 c = texture2D(tScene, vUv).rgb; vec3 b = texture2D(tBloom, vUv).rgb;' +
            'gl_FragColor = vec4(c + b * strength, 1.0); }',
        });
        function blit(mat, target) { fsQuad.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }
        function render(strength) {
          const prevAutoClear = renderer.autoClear;
          renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);   // (1) scene → target
          brightMat.uniforms.tDiffuse.value = rtScene.texture; blit(brightMat, rtA);              // (2) bright-pass
          for (let i = 0; i < 3; i++) {                                                            // (3) blur ping-pong H/V
            blurMat.uniforms.tDiffuse.value = rtA.texture; blurMat.uniforms.dir.value.set(1, 0); blit(blurMat, rtB);
            blurMat.uniforms.tDiffuse.value = rtB.texture; blurMat.uniforms.dir.value.set(0, 1); blit(blurMat, rtA);
          }
          compMat.uniforms.tScene.value = rtScene.texture; compMat.uniforms.tBloom.value = rtA.texture;
          compMat.uniforms.strength.value = strength;
          blit(compMat, null);                                                                     // (4) composite → layar
          renderer.autoClear = prevAutoClear;
        }
        function setSize(w, h) {
          sw = Math.max(2, Math.floor(w * dpr)); sh = Math.max(2, Math.floor(h * dpr));
          bw = Math.max(1, sw >> 1); bh = Math.max(1, sh >> 1);
          rtScene.setSize(sw, sh); rtA.setSize(bw, bh); rtB.setSize(bw, bh);
          blurMat.uniforms.texel.value.set(1 / bw, 1 / bh);
        }
        return { render, setSize };
      })();

