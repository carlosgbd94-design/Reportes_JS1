/*
 * liquidGL – Ultra-light glassmorphism for the web
 * -----------------------------------------------------------------------------
 *
 * Author: NaughtyDuk© – https://liquidgl.naughtyduk.com
 * Licence: MIT
 */

(() => {
  "use strict";

  /* --------------------------------------------------
   *  Utilities
   * ------------------------------------------------*/
  function debounce(fn, wait) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, a), wait);
    };
  }

  /* --------------------------------------------------
   *  Helper : Effective z-index (highest stacking context)
   * ------------------------------------------------*/
  function effectiveZ(el) {
    let node = el;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      if (style.position !== "static" && style.zIndex !== "auto") {
        const z = parseInt(style.zIndex, 10);
        if (!isNaN(z)) return z;
      }
      node = node.parentElement;
    }
    return 0;
  }

  /* --------------------------------------------------
   *  WebGL helpers
   * ------------------------------------------------*/
  function compileShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src.trim());
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Shader error", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("Program link error", gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  /* --------------------------------------------------
   *  Shared renderer (one per page)
   * ------------------------------------------------*/
  class liquidGLRenderer {
    constructor(snapshotSelector, snapshotResolution = 1.0) {
      this.canvas = document.createElement("canvas");
      this.canvas.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;`;
      this.canvas.setAttribute("data-liquid-ignore", "");
      document.body.appendChild(this.canvas);

      const ctxAttribs = {
        alpha: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
      };
      this.gl =
        this.canvas.getContext("webgl2", ctxAttribs) ||
        this.canvas.getContext("webgl", ctxAttribs) ||
        this.canvas.getContext("experimental-webgl", ctxAttribs);
      if (!this.gl) throw new Error("liquidGL: WebGL unavailable");

      this.lenses = [];
      this.texture = null;
      this.textureWidth = 0;
      this.textureHeight = 0;
      this.scaleFactor = 1;
      this.startTime = Date.now();
      this._scrollUpdateCounter = 0;

      this._initGL();

      this.snapshotTarget =
        document.querySelector(snapshotSelector) || document.body;
      if (!this.snapshotTarget) this.snapshotTarget = document.body;

      this._isScrolling = false;
      let lastScrollY = window.scrollY;
      let scrollTimeout;
      const scrollCheck = () => {
        if (window.scrollY !== lastScrollY) {
          this._isScrolling = true;
          lastScrollY = window.scrollY;
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            this._isScrolling = false;
          }, 200);
        }
        requestAnimationFrame(scrollCheck);
      };
      requestAnimationFrame(scrollCheck);

      const onResize = debounce(() => {
        if (this._capturing || this._isScrolling) return;

        if (window.visualViewport && window.visualViewport.scale !== 1) {
          return;
        }

        this._dynamicNodes.forEach((node) => {
          const meta = this._dynMeta.get(node.el);
          if (meta) {
            meta.needsRecapture = true;
            meta.prevDrawRect = null;
            meta.lastCapture = null;
          }
        });

        this._resizeCanvas();
        this.lenses.forEach((l) => l.updateMetrics());
        this.captureSnapshot();
      }, 250);
      window.addEventListener("resize", onResize, { passive: true });

      if ("ResizeObserver" in window) {
        new ResizeObserver(onResize).observe(this.snapshotTarget);
      }

      this._dynamicNodes = [];
      this._dynMeta = new WeakMap();
      this._lastDynamicUpdate = 0;

      const styleEl = document.createElement("style");
      styleEl.id = "liquid-gl-dynamic-styles";
      document.head.appendChild(styleEl);
      this._dynamicStyleSheet = styleEl.sheet;

      this._resizeCanvas();
      this.captureSnapshot();

      this._pendingReveal = [];

      this._videoNodes = Array.from(
        this.snapshotTarget.querySelectorAll("video")
      );
      this._videoNodes = this._videoNodes.filter((v) => !this._isIgnored(v));
      this._tmpCanvas = document.createElement("canvas");
      this._tmpCtx = this._tmpCanvas.getContext("2d");

      this.canvas.style.opacity = "0";

      this._snapshotResolution = Math.max(
        0.1,
        Math.min(3.0, snapshotResolution)
      );

      this.useExternalTicker = false;

      this._workerEnabled =
        typeof OffscreenCanvas !== "undefined" &&
        typeof Worker !== "undefined" &&
        typeof ImageBitmap !== "undefined";

      if (this._workerEnabled) {
        const workerSrc = `
          self.onmessage = async (e) => {
            const { id, width, height, snap, dyn } = e.data;
            const off = new OffscreenCanvas(width, height);
            const ctx = off.getContext('2d');
            ctx.drawImage(snap, 0, 0, width, height);
            ctx.drawImage(dyn, 0, 0, width, height);
            const bmp = await off.transferToImageBitmap();
            self.postMessage({ id, bmp }, [bmp]);
          };
        `;
        const blob = new Blob([workerSrc], { type: "application/javascript" });
        this._dynWorker = new Worker(URL.createObjectURL(blob), {
          type: "module",
        });

        this._dynJobs = new Map();

        this._dynWorker.onmessage = (e) => {
          const { id, bmp } = e.data;
          const meta = this._dynJobs.get(id);
          if (!meta) return;
          this._dynJobs.delete(id);

          const { x, y, w, h } = meta;
          const gl = this.gl;
          gl.bindTexture(gl.TEXTURE_2D, this.texture);
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            x,
            y,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            bmp
          );
        };
      }
    }

    _initGL() {
      const vsSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main(){
          v_uv = (a_position + 1.0) * 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }`;

      const fsSource = `
        precision mediump float;
        varying vec2 v_uv;
        uniform sampler2D u_tex;
        uniform vec2  u_resolution;
        uniform vec2  u_textureResolution;
        uniform vec4  u_bounds;
        uniform float u_refraction;
        uniform float u_bevelDepth;
        uniform float u_bevelWidth;
        uniform float u_frost;
        uniform float u_radius;
        uniform float u_time;
        uniform bool  u_specular;
        uniform float u_revealProgress;
        uniform int   u_revealType;
        uniform float u_tiltX;
        uniform float u_tiltY;
        uniform float u_magnify;

        float udRoundBox( vec2 p, vec2 b, float r ) {
          return length(max(abs(p)-b+r,0.0))-r;
        }

        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        float edgeFactor(vec2 uv, float radius_px){
          vec2 p_px = (uv - 0.5) * u_resolution;
          vec2 b_px = 0.5 * u_resolution;
          float d = -udRoundBox(p_px, b_px, radius_px);
          float bevel_px = u_bevelWidth * min(u_resolution.x, u_resolution.y);
          return 1.0 - smoothstep(0.0, bevel_px, d);
        }
        void main(){
          vec2 p = v_uv - 0.5;
          p.x *= u_resolution.x / u_resolution.y;

          float edge = edgeFactor(v_uv, u_radius);
          float min_dimension = min(u_resolution.x, u_resolution.y);
          float offsetAmt = (edge * u_refraction + pow(edge, 10.0) * u_bevelDepth);
          float centreBlend = smoothstep(0.15, 0.45, length(p));
          vec2 offset = normalize(p) * offsetAmt * centreBlend;

          float tiltRefractionScale = 0.05;
          vec2 tiltOffset = vec2(tan(radians(u_tiltY)), -tan(radians(u_tiltX))) * tiltRefractionScale;

          vec2 localUV = (v_uv - 0.5) / u_magnify + 0.5;
          vec2 flippedUV = vec2(localUV.x, 1.0 - localUV.y);
          vec2 mapped = u_bounds.xy + flippedUV * u_bounds.zw;
          vec2 refracted = mapped + offset - tiltOffset;

          float oob = max(max(-refracted.x, refracted.x - 1.0), max(-refracted.y, refracted.y - 1.0));
          float blend = 1.0 - smoothstep(0.0, 0.01, oob);
          vec2 sampleUV = mix(mapped, refracted, blend);

          vec4 baseCol   = texture2D(u_tex, mapped);

          vec2 texel = 1.0 / u_textureResolution;
          vec4 refrCol;

          if (u_frost > 0.0) {
              float radius = u_frost * 4.0;
              vec4 sum = vec4(0.0);
              const int SAMPLES = 16;
              for (int i = 0; i < SAMPLES; i++) {
                  float angle = random(v_uv + float(i)) * 6.283185;
                  float dist = sqrt(random(v_uv - float(i))) * radius;
                  vec2 offset = vec2(cos(angle), sin(angle)) * texel * dist;
                  sum += texture2D(u_tex, sampleUV + offset);
              }
              refrCol = sum / float(SAMPLES);
          } else {
              refrCol = texture2D(u_tex, sampleUV);
              refrCol += texture2D(u_tex, sampleUV + vec2( texel.x, 0.0));
              refrCol += texture2D(u_tex, sampleUV + vec2(-texel.x, 0.0));
              refrCol += texture2D(u_tex, sampleUV + vec2(0.0,  texel.y));
              refrCol += texture2D(u_tex, sampleUV + vec2(0.0, -texel.y));
              refrCol /= 5.0;
          }

          if (refrCol.a < 0.1) {
              refrCol = baseCol;
          }

          float diff = clamp(length(refrCol.rgb - baseCol.rgb) * 4.0, 0.0, 1.0);
          float antiHalo = (1.0 - centreBlend) * diff;

          vec4 final    = refrCol;

          vec2 p_px = (v_uv - 0.5) * u_resolution;
          vec2 b_px = 0.5 * u_resolution;
          float dmask = udRoundBox(p_px, b_px, u_radius);
          float inShape = 1.0 - step(0.0, dmask);

          if (u_specular) {
            vec2 lp1 = vec2(sin(u_time*0.2), cos(u_time*0.3))*0.6 + 0.5;
            vec2 lp2 = vec2(sin(u_time*-0.4+1.5), cos(u_time*0.25-0.5))*0.6 + 0.5;
            float h = 0.0;
            h += smoothstep(0.4,0.0,distance(v_uv, lp1))*0.1;
            h += smoothstep(0.5,0.0,distance(v_uv, lp2))*0.08;
            final.rgb += h;
          }

          if (u_revealType == 1) {
              final.rgb *= u_revealProgress;
              final.a  *= u_revealProgress;
          }

          final.rgb *= inShape;
          final.a   *= inShape;

          gl_FragColor = final;
        }`;

      this.program = createProgram(this.gl, vsSource, fsSource);
      const gl = this.gl;
      if (!this.program) throw new Error("liquidGL: Shader failed");

      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      const posLoc = gl.getAttribLocation(this.program, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      this.u = {
        tex: gl.getUniformLocation(this.program, "u_tex"),
        res: gl.getUniformLocation(this.program, "u_resolution"),
        textureResolution: gl.getUniformLocation(this.program, "u_textureResolution"),
        bounds: gl.getUniformLocation(this.program, "u_bounds"),
        refraction: gl.getUniformLocation(this.program, "u_refraction"),
        bevelDepth: gl.getUniformLocation(this.program, "u_bevelDepth"),
        bevelWidth: gl.getUniformLocation(this.program, "u_bevelWidth"),
        frost: gl.getUniformLocation(this.program, "u_frost"),
        radius: gl.getUniformLocation(this.program, "u_radius"),
        time: gl.getUniformLocation(this.program, "u_time"),
        specular: gl.getUniformLocation(this.program, "u_specular"),
        revealProgress: gl.getUniformLocation(this.program, "u_revealProgress"),
        revealType: gl.getUniformLocation(this.program, "u_revealType"),
        tiltX: gl.getUniformLocation(this.program, "u_tiltX"),
        tiltY: gl.getUniformLocation(this.program, "u_tiltY"),
        magnify: gl.getUniformLocation(this.program, "u_magnify"),
      };
    }

    _resizeCanvas() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = innerWidth * dpr;
      this.canvas.height = innerHeight * dpr;
      this.canvas.style.width = `${innerWidth}px`;
      this.canvas.style.height = `${innerHeight}px`;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    async captureSnapshot() {
      if (this._capturing || typeof html2canvas === "undefined") return;
      this._capturing = true;

      const undos = [];

      const attemptCapture = async (attempt = 1, maxAttempts = 3, delayMs = 500) => {
        try {
          const fullW = this.snapshotTarget.scrollWidth;
          const fullH = this.snapshotTarget.scrollHeight;
          const maxTex = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) || 8192;
          const MAX_MOBILE_DIM = 4096;
          const isMobileSafari = /iPad|iPhone|iPod/.test(navigator.userAgent);

          let scale = Math.min(this._snapshotResolution, maxTex / fullW, maxTex / fullH);
          if (isMobileSafari) {
            const over = (Math.max(fullW, fullH) * scale) / MAX_MOBILE_DIM;
            if (over > 1) scale = scale / over;
          }
          this.scaleFactor = Math.max(0.1, scale);

          this.canvas.style.visibility = "hidden";
          undos.push(() => (this.canvas.style.visibility = "visible"));

          const lensElements = this.lenses.flatMap((lens) => [lens.el, lens._shadowEl]).filter(Boolean);

          const ignoreElementsFunc = (element) => {
            if (!element || !element.hasAttribute) return false;
            if (element === this.canvas || lensElements.includes(element)) return true;
            const style = window.getComputedStyle(element);
            if (style.position === "fixed") return true;
            return element.hasAttribute("data-liquid-ignore") || element.closest("[data-liquid-ignore]");
          };

          const snapCanvas = await html2canvas(this.snapshotTarget, {
            allowTaint: false,
            useCORS: true,
            backgroundColor: null,
            removeContainer: true,
            width: fullW,
            height: fullH,
            scrollX: 0,
            scrollY: 0,
            scale: scale,
            ignoreElements: ignoreElementsFunc,
          });

          this._uploadTexture(snapCanvas);
          return true;
        } catch (e) {
          console.error("liquidGL snapshot failed", e);
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return await attemptCapture(attempt + 1, maxAttempts, delayMs);
          }
          return false;
        } finally {
          undos.forEach(u => u());
          this._capturing = false;
        }
      };
      return await attemptCapture();
    }

    _uploadTexture(srcCanvas) {
      if (!srcCanvas || srcCanvas.width === 0 || srcCanvas.height === 0) return;
      this.staticSnapshotCanvas = srcCanvas;
      const gl = this.gl;
      if (!this.texture) this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.textureWidth = srcCanvas.width;
      this.textureHeight = srcCanvas.height;
      this.render();
      if (this._pendingReveal.length) {
        this._pendingReveal.forEach((ln) => ln._reveal());
        this._pendingReveal.length = 0;
      }
    }

    addLens(element, options) {
      const lens = new liquidGLLens(this, element, options);
      this.lenses.push(lens);
      const maxZ = this._getMaxLensZ();
      if (maxZ > 0) this.canvas.style.zIndex = maxZ - 1;
      if (!this.texture) this._pendingReveal.push(lens);
      else lens._reveal();
      return lens;
    }

    render() {
      const gl = this.gl;
      if (!this.texture) return;
      if (this._isScrolling) this._scrollUpdateCounter++;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(this.u.tex, 0);
      const time = (Date.now() - this.startTime) / 1000;
      gl.uniform1f(this.u.time, time);
      this.lenses.forEach((lens) => {
        lens.updateMetrics();
        this._renderLens(lens);
      });
    }

    _renderLens(lens) {
      const gl = this.gl;
      const rect = lens.rectPx;
      if (!rect) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const x = rect.left * dpr;
      const y = this.canvas.height - (rect.top + rect.height) * dpr;
      const w = rect.width * dpr;
      const h = rect.height * dpr;
      gl.viewport(x, y, w, h);
      gl.uniform2f(this.u.res, w, h);
      const docX = rect.left - this.snapshotTarget.getBoundingClientRect().left;
      const docY = rect.top - this.snapshotTarget.getBoundingClientRect().top;
      const leftUV = (docX * this.scaleFactor) / this.textureWidth;
      const topUV = (docY * this.scaleFactor) / this.textureHeight;
      const wUV = (rect.width * this.scaleFactor) / this.textureWidth;
      const hUV = (rect.height * this.scaleFactor) / this.textureHeight;
      gl.uniform4f(this.u.bounds, leftUV, topUV, wUV, hUV);
      gl.uniform2f(this.u.textureResolution, this.textureWidth, this.textureHeight);
      gl.uniform1f(this.u.refraction, lens.options.refraction);
      gl.uniform1f(this.u.bevelDepth, lens.options.bevelDepth);
      gl.uniform1f(this.u.bevelWidth, lens.options.bevelWidth);
      gl.uniform1f(this.u.frost, lens.options.frost);
      gl.uniform1f(this.u.radius, lens.radiusGl);
      gl.uniform1i(this.u.specular, lens.options.specular ? 1 : 0);
      gl.uniform1f(this.u.revealProgress, lens._revealProgress || 1.0);
      gl.uniform1i(this.u.revealType, 0);
      gl.uniform1f(this.u.magnify, lens.options.magnify || 1.0);
      gl.uniform1f(this.u.tiltX, lens.tiltX || 0);
      gl.uniform1f(this.u.tiltY, lens.tiltY || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    _getMaxLensZ() {
      return this.lenses.reduce((max, l) => Math.max(max, effectiveZ(l.el)), 0);
    }

    _isIgnored(el) {
      return el.hasAttribute("data-liquid-ignore") || el.closest("[data-liquid-ignore]");
    }

    _updateDynamicVideos() {}
    _updateDynamicNodes() {}
  }

  class liquidGLLens {
    constructor(renderer, element, options = {}) {
      this.renderer = renderer;
      this.el = element;
      this.options = Object.assign({
        refraction: 0.01,
        bevelDepth: 0.08,
        bevelWidth: 0.15,
        frost: 0,
        specular: true,
        reveal: 'fade',
        tilt: false,
        tiltFactor: 5,
        magnify: 1
      }, options);

      this.rectPx = null;
      this.radiusGl = 0;
      this._revealProgress = 0;
      this.updateMetrics();

      if (this.options.tilt) {
        this.el.addEventListener('mousemove', (e) => {
          const r = this.el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          this.tiltX = y * this.options.tiltFactor;
          this.tiltY = -x * this.options.tiltFactor;
        });
        this.el.addEventListener('mouseleave', () => {
          this.tiltX = 0;
          this.tiltY = 0;
        });
      }
    }

    updateMetrics() {
      const r = this.el.getBoundingClientRect();
      this.rectPx = { left: r.left, top: r.top, width: r.width, height: r.height };
      const style = window.getComputedStyle(this.el);
      const rad = parseFloat(style.borderRadius);
      this.radiusGl = isNaN(rad) ? 0 : rad;
    }

    _reveal() {
      this.renderer.canvas.style.opacity = "1";
      if (this.options.reveal === 'fade') {
        let start = Date.now();
        const anim = () => {
          let p = (Date.now() - start) / 500;
          if (p > 1) p = 1;
          this._revealProgress = p;
          if (p < 1) requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
      } else {
        this._revealProgress = 1;
      }
    }
  }

  let instance = null;
  window.liquidGL = function(options = {}) {
    if (!instance) {
      instance = new liquidGLRenderer(options.snapshot || "body", options.resolution || 2.0);
      const loop = () => {
        instance.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    const targets = document.querySelectorAll(options.target || ".liquidGL");
    targets.forEach(t => instance.addLens(t, options));
    return instance;
  };
})();
