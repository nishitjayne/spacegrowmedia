import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

/*
  SpaceGrow v3 scene.
  One realistic hero (Earth: day, night lights, clouds, ocean glint, atmosphere) and a scroll-driven
  journey past the Moon, Mars, Jupiter, Saturn and Neptune toward the Sun. The Milky Way and nebula are
  rendered once into a cube map, so the sky costs nothing per frame. Bloom only on capable screens.
*/

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SUN_DIR = new THREE.Vector3(-0.85, 0.24, 0.3).normalize();

/* ───────── GLSL helpers ───────── */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*snoise(p); p*=2.03; a*=0.5; } return s; }
`;

/* Milky Way and nebula, baked once into a cube map. */
const SKY = {
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `${NOISE}
    varying vec3 vDir;
    uniform vec3 uSun;
    void main(){
      vec3 d = normalize(vDir);
      vec3 G = normalize(vec3(0.25, 1.0, 0.35));            // galactic plane normal
      float h = dot(d, G);
      float band = exp(-pow(h / 0.2, 2.0));                  // Milky Way band
      float core = exp(-pow(h / 0.07, 2.0));
      float n1 = fbm(d * 2.2);
      float n2 = fbm(d * 5.5 + 7.3);
      float dust = smoothstep(0.05, 0.55, fbm(d * 4.0 + 2.1)) * core;   // dark dust lanes
      vec3 deep = vec3(0.006, 0.009, 0.022);
      vec3 milk = vec3(0.55, 0.52, 0.62) * band * (0.22 + 0.3 * n2) + vec3(0.9, 0.78, 0.62) * core * 0.18 * (0.6 + 0.6 * n1);
      milk *= 1.0 - 0.85 * dust;
      // Two soft nebula clouds, violet and teal, away from the band.
      float neb1 = smoothstep(0.15, 0.9, fbm(d * 1.6 + 3.0)) * smoothstep(0.4, 1.0, dot(d, normalize(vec3(0.7, 0.25, -0.65))));
      float neb2 = smoothstep(0.2, 0.9, fbm(d * 1.9 - 5.0)) * smoothstep(0.35, 1.0, dot(d, normalize(vec3(-0.5, -0.3, -0.8))));
      vec3 col = deep + milk * 0.55 + vec3(0.32, 0.12, 0.5) * neb1 * 0.22 + vec3(0.05, 0.3, 0.42) * neb2 * 0.2;
      // Warm scatter around the sun's direction.
      float s = max(dot(d, uSun), 0.0);
      col += vec3(1.0, 0.75, 0.45) * pow(s, 12.0) * 0.12;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const EARTH = {
  vertexShader: `
    varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `
    uniform sampler2D uDay, uNight, uSpec, uClouds; uniform vec3 uSun; uniform float uCloudShift;
    varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main(){
      vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP);
      float ndl = dot(n, uSun);
      float day = smoothstep(-0.12, 0.22, ndl);
      vec3 albedo = texture2D(uDay, vUv).rgb;
      vec3 lights = texture2D(uNight, vUv).rgb;
      float ocean = texture2D(uSpec, vUv).r;
      float cloudShadow = texture2D(uClouds, vUv + vec2(uCloudShift - 0.003, 0.0)).r;
      vec3 col = albedo * max(ndl, 0.0) * vec3(1.0, 0.97, 0.92) * 1.75 * (1.0 - 0.45 * cloudShadow) + albedo * 0.012;
      vec3 hv = normalize(uSun + v);
      col += vec3(1.0, 0.92, 0.8) * ocean * pow(max(dot(n, hv), 0.0), 140.0) * 0.45 * day;          // sun glint on oceans
      col += lights * vec3(1.0, 0.78, 0.48) * 1.6 * (1.0 - day) * (1.0 - cloudShadow * 0.7);       // city lights
      float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
      col = mix(col, vec3(0.32, 0.58, 1.0) * (0.2 + 0.8 * day), fres * 0.4 * smoothstep(-0.35, 0.4, ndl)); // inner haze
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

const CLOUDS = {
  vertexShader: EARTH.vertexShader,
  fragmentShader: `
    uniform sampler2D uClouds; uniform vec3 uSun; uniform float uCloudShift;
    varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main(){
      vec3 n = normalize(vN);
      float a = texture2D(uClouds, vUv + vec2(uCloudShift, 0.0)).r;
      float ndl = dot(n, uSun);
      float lit = smoothstep(-0.1, 0.45, ndl);
      vec3 col = vec3(1.0) * (0.02 + 1.9 * max(ndl, 0.0)) + vec3(1.0, 0.55, 0.3) * 0.25 * (1.0 - abs(ndl * 3.0 - 0.15)) * step(0.0, ndl + 0.3);
      gl_FragColor = vec4(col, a * (0.15 + 0.85 * lit) * 0.92);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

const ATMOSPHERE = {
  vertexShader: `
    varying vec3 vN; varying vec3 vNW; varying vec3 vView;
    void main(){ vN = normalize(normalMatrix * normal); vNW = normalize(mat3(modelMatrix) * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `
    uniform vec3 uSun; uniform vec3 uColor; uniform float uPower; uniform float uStrength;
    varying vec3 vN; varying vec3 vNW; varying vec3 vView;
    void main(){
      float rim = pow(max(0.74 - dot(vN, vView), 0.0), uPower);
      float s = smoothstep(-0.45, 0.55, dot(vNW, uSun));
      vec3 col = mix(vec3(0.02, 0.05, 0.14), uColor, s);
      gl_FragColor = vec4(col * rim * uStrength * (0.12 + 0.88 * s), 1.0);
    }`,
};

const STARS = {
  vertexShader: `
    attribute float aSize; attribute vec3 aColor; attribute float aTw;
    uniform float uTime; uniform float uPR;
    varying vec3 vColor; varying float vA;
    void main(){
      vColor = aColor;
      vA = 0.78 + 0.22 * sin(uTime * (0.6 + aTw * 2.4) + aTw * 60.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPR;
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vA;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d); a *= a;
      gl_FragColor = vec4(vColor * a * vA, 1.0);
    }`,
};

const SUN = {
  vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV;
    void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `${NOISE}
    uniform float uTime; varying vec3 vP; varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 p = normalize(vP);
      float t = uTime;
      float gran = fbm(p * 18.0 + vec3(t * 0.05, -t * 0.04, t * 0.03));
      float flow = fbm(p * 4.0 + vec3(0.0, t * 0.02, t * 0.015));
      float spots = smoothstep(0.55, 0.75, fbm(p * 2.5 + 11.0 + t * 0.004));
      float mu = clamp(dot(vN, vV), 0.0, 1.0);
      float limb = pow(mu, 0.45);
      vec3 hot = vec3(9.0, 6.4, 3.4), warm = vec3(5.2, 2.1, 0.55), deep = vec3(2.2, 0.5, 0.08);
      vec3 col = mix(warm, hot, smoothstep(-0.4, 0.6, gran * 0.7 + flow * 0.5));
      col = mix(col, deep, spots * 0.85);
      col *= mix(0.45, 1.0, limb);
      col += vec3(3.0, 1.0, 0.2) * pow(1.0 - mu, 3.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* Corona, flares and prominences on a camera-facing plane around the sun. */
const CORONA = {
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `${NOISE}
    uniform float uTime; uniform float uR; uniform float uFade; varying vec2 vUv;
    void main(){
      float r = length(vUv);
      float a = atan(vUv.y, vUv.x);
      float t = uTime;
      vec2 dir = vec2(cos(a), sin(a));
      float h = max(r - uR, 0.0);
      float stream = fbm(vec3(dir * 2.2, t * 0.05)) * 0.5 + 0.5;
      float corona = exp(-h * (7.0 - 3.0 * stream)) * (0.55 + 0.6 * stream);
      float fil = fbm(vec3(dir * 7.0, h * 5.0 - t * 0.35));
      float flares = pow(max(fil, 0.0), 2.4) * exp(-h * 5.5) * 3.2;
      float prom = 0.0;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float ang = fi * 1.7 + 0.6 + sin(t * 0.05 + fi) * 0.3;
        float life = 0.5 + 0.5 * sin(t * (0.18 + fi * 0.05) + fi * 2.1);
        float da = abs(atan(sin(a - ang), cos(a - ang)));
        float height = 0.06 + 0.16 * life;
        float arc = height * sqrt(max(1.0 - pow(da / 0.22, 2.0), 0.0));
        float d = abs(h - arc);
        prom += exp(-d * 60.0) * step(da, 0.22) * life * (0.6 + 0.4 * fbm(vec3(a * 12.0, h * 20.0, t * 0.6)));
      }
      float inside = smoothstep(uR - 0.01, uR + 0.005, r);
      vec3 col = vec3(1.0, 0.62, 0.28) * corona * 0.55 + vec3(1.0, 0.75, 0.4) * flares * 0.5 + vec3(1.0, 0.42, 0.15) * prom * 1.2;
      col *= inside * smoothstep(1.0, 0.7, r) * uFade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* Light-speed streaks: head bright, tail transparent. */
const WARP = {
  vertexShader: `attribute float aHead; varying float vHead; void main(){ vHead = aHead; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float uAlpha; varying float vHead; void main(){ gl_FragColor = vec4(vec3(0.7, 0.88, 1.0) * vHead * uAlpha, 1.0); }`,
};

/* ───────── helpers ───────── */
function glowTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 4;
  const g = c.getContext('2d');
  for (let x = 0; x < 1024; x++) {
    const t = x / 1024;
    const gap = (t > 0.58 && t < 0.62) ? 0.1 : 1; // Cassini division
    const band = 0.55 + 0.45 * Math.sin(t * 90 + Math.sin(t * 23) * 2) * Math.sin(t * 17);
    const a = Math.max(0, Math.min(1, (0.25 + 0.6 * band) * gap * Math.min(1, t * 6) * Math.min(1, (1 - t) * 5)));
    const l = Math.round(170 + 60 * band);
    g.fillStyle = `rgba(${l + 20},${l + 5},${l - 25},${a})`;
    g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ───────── scene ───────── */
class Universe {
  constructor(canvas) {
    this.canvas = canvas;
    this.isMobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    this.useBloom = !this.isMobile && (navigator.hardwareConcurrency || 4) >= 4;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.clock = new THREE.Clock();
    this.time = 0;
    this.stops = [0, 0.14, 0.3, 0.46, 0.64, 0.8, 1];

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.useBloom, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 1.75));
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    this.maxAniso = r.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov(), window.innerWidth / window.innerHeight, 0.1, 6000);

    this.buildSky();
    this.buildStars();
    this.light = new THREE.DirectionalLight(0xfff1e0, 2.6);
    this.light.position.copy(SUN_DIR).multiplyScalar(100);
    this.scene.add(this.light, new THREE.AmbientLight(0x8899ff, 0.035));

    this.loader = new THREE.TextureLoader();
    this.fades = [];
    this.ready = Promise.all([this.buildEarth(), this.buildMoon(), this.buildPlanets()]);
    this.buildPath();
    this.buildSun();
    this.buildWarp();
    this.lastY = window.scrollY || 0;
    this.vel = 0;
    this.baseFov = this.fov();

    if (this.useBloom) {
      this.composer = new EffectComposer(r);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.55, 0.6, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.bind();
    this.measure();
    const p = this.progress();
    this.camera.position.copy(this.posCurve.getPoint(this.curveU(p)));
    this.look = this.lookCurve.getPoint(this.curveU(p));
    this.camera.lookAt(this.look);
    r.setAnimationLoop(() => this.frame());
  }

  fov() { return window.innerWidth / window.innerHeight < 0.8 ? 58 : 38; }

  tex(url, color = true) {
    return new Promise((resolve) => {
      this.loader.load(url, (t) => {
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = Math.min(8, this.maxAniso);
        resolve(t);
      }, undefined, () => resolve(null));
    });
  }

  buildSky() {
    const size = this.isMobile ? 768 : 1536;
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
    const skyScene = new THREE.Scene();
    skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), new THREE.ShaderMaterial({
      ...SKY, side: THREE.BackSide, depthWrite: false, uniforms: { uSun: { value: SUN_DIR } },
    })));
    new THREE.CubeCamera(0.1, 100, rt).update(this.renderer, skyScene);
    this.scene.background = rt.texture;
    skyScene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  buildStars() {
    const n = this.isMobile ? 6000 : 14000;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), tw = new Float32Array(n);
    const G = new THREE.Vector3(0.25, 1, 0.35).normalize();
    const temps = [[0.62, 0.72, 1.0], [0.8, 0.86, 1.0], [1, 1, 1], [1, 0.95, 0.85], [1, 0.82, 0.62], [1, 0.68, 0.5]];
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      if (Math.random() < 0.55) { // pull toward the galactic plane for a Milky Way band
        const h = v.dot(G);
        v.addScaledVector(G, -h * (0.75 + Math.random() * 0.2)).normalize();
      }
      v.multiplyScalar(2400);
      pos.set([v.x, v.y, v.z], i * 3);
      const t = temps[Math.min(temps.length - 1, Math.floor(Math.pow(Math.random(), 1.3) * temps.length))];
      const b = 0.35 + Math.pow(Math.random(), 3) * 1.4;
      col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
      size[i] = (Math.random() < 0.015 ? 3.2 : 1.1 + Math.pow(Math.random(), 4) * 2.2) * (this.isMobile ? 1.1 : 1);
      tw[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
    this.starMat = new THREE.ShaderMaterial({
      ...STARS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPR: { value: this.renderer.getPixelRatio() } },
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  buildSun() {
    // The Sun waits at the end of the journey, along the light direction, so lighting and sun agree.
    const R = 70;
    this.sun = new THREE.Group();
    this.sun.position.set(-60, 30, -1290).addScaledVector(SUN_DIR, 650);
    this.sunMat = new THREE.ShaderMaterial({ ...SUN, uniforms: { uTime: { value: 0 } } });
    this.sun.add(new THREE.Mesh(new THREE.SphereGeometry(R, this.isMobile ? 64 : 128, this.isMobile ? 32 : 64), this.sunMat));
    this.coronaMat = new THREE.ShaderMaterial({
      ...CORONA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uR: { value: 1 / 3.2 }, uFade: { value: 0 } },
    });
    this.corona = new THREE.Mesh(new THREE.PlaneGeometry(R * 6.4, R * 6.4), this.coronaMat);
    this.sun.add(this.corona);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture([[0, 'rgba(255,220,170,0.9)'], [0.2, 'rgba(255,150,70,0.35)'], [0.5, 'rgba(255,90,30,0.08)'], [1, 'rgba(255,60,10,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(0.7, 0.55, 0.45),
    }));
    halo.scale.setScalar(R * 6);
    this.sun.add(halo);
    if (!this.isMobile) {
      const flare = new Lensflare();
      const main = glowTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,230,190,0.5)'], [1, 'rgba(255,200,150,0)']], 256);
      const ring = glowTexture([[0, 'rgba(120,170,255,0)'], [0.7, 'rgba(120,170,255,0)'], [0.85, 'rgba(140,190,255,0.35)'], [1, 'rgba(120,170,255,0)']], 256);
      const dot = glowTexture([[0, 'rgba(160,140,255,0.5)'], [1, 'rgba(160,140,255,0)']], 128);
      flare.addElement(new LensflareElement(main, 220, 0, new THREE.Color(0.6, 0.5, 0.45)));
      flare.addElement(new LensflareElement(dot, 60, 0.5));
      flare.addElement(new LensflareElement(ring, 160, 0.7));
      flare.addElement(new LensflareElement(dot, 90, 0.9));
      flare.addElement(new LensflareElement(ring, 260, 1.1));
      this.sun.add(flare);
    }
    this.scene.add(this.sun);
  }

  buildWarp() {
    const n = this.isMobile ? 420 : 900;
    this.warpN = n;
    const pos = new Float32Array(n * 6), head = new Float32Array(n * 2);
    this.warpSeeds = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rad = 3 + Math.pow(Math.random(), 0.6) * 46;
      this.warpSeeds.set([Math.cos(a) * rad, Math.sin(a) * rad, -Math.random() * 220], i * 3);
      head[i * 2] = 1; head[i * 2 + 1] = 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aHead', new THREE.BufferAttribute(head, 1));
    this.warpMat = new THREE.ShaderMaterial({ ...WARP, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAlpha: { value: 0 } } });
    this.warp = new THREE.LineSegments(geo, this.warpMat);
    this.warp.frustumCulled = false;
    this.camera.add(this.warp);
    this.scene.add(this.camera);
  }

  // Light-speed streaks: length and brightness follow scroll speed, direction follows scroll direction.
  updateWarp(dt, v) {
    const speed = THREE.MathUtils.clamp(Math.abs(v), 0, 9000);
    const dirSign = v >= 0 ? 1 : -1;
    const strength = THREE.MathUtils.smoothstep(speed, 250, 3200);
    this.warpMat.uniforms.uAlpha.value = strength * 0.9;
    this.warp.visible = strength > 0.01;
    if (!this.warp.visible) return;
    const pos = this.warp.geometry.attributes.position.array, sd = this.warpSeeds;
    const travel = (60 + speed * 0.09) * dt * dirSign;
    const len = 2 + strength * 38;
    for (let i = 0; i < this.warpN; i++) {
      const k = i * 3;
      sd[k + 2] += travel;
      if (sd[k + 2] > 2) { sd[k + 2] -= 222; const a = Math.random() * 6.2832, r = 3 + Math.pow(Math.random(), 0.6) * 46; sd[k] = Math.cos(a) * r; sd[k + 1] = Math.sin(a) * r; }
      if (sd[k + 2] < -220) sd[k + 2] += 222;
      const o = i * 6;
      pos[o] = sd[k]; pos[o + 1] = sd[k + 1]; pos[o + 2] = sd[k + 2];
      pos[o + 3] = sd[k]; pos[o + 4] = sd[k + 1]; pos[o + 5] = sd[k + 2] - len * dirSign;
    }
    this.warp.geometry.attributes.position.needsUpdate = true;
  }

  async buildEarth() {
    const hd = !this.isMobile;
    const [day, night, spec, clouds] = await Promise.all([
      this.tex(`/textures/hd/earth-day-${hd ? '2k' : '1k'}.webp`),
      this.tex(`/textures/hd/earth-night-${hd ? '2k' : '1k'}.webp`),
      this.tex('/textures/hd/earth-spec-1k.webp', false),
      this.tex('/textures/hd/earth-clouds-1k.webp', false),
    ]);
    if (clouds) clouds.wrapS = THREE.RepeatWrapping;
    const R = 10, seg = this.isMobile ? 96 : 160;
    this.earth = new THREE.Group();
    this.earth.rotation.z = THREE.MathUtils.degToRad(23.4);
    const uniforms = { uDay: { value: day }, uNight: { value: night }, uSpec: { value: spec }, uClouds: { value: clouds }, uSun: { value: SUN_DIR }, uCloudShift: { value: 0 } };
    this.earthUniforms = uniforms;
    this.earthBody = new THREE.Mesh(new THREE.SphereGeometry(R, seg, seg / 2), new THREE.ShaderMaterial({ ...EARTH, uniforms }));
    this.earthBody.rotation.y = -3.05;
    const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, seg, seg / 2), new THREE.ShaderMaterial({
      ...CLOUDS, uniforms, transparent: true, depthWrite: false,
    }));
    this.earthBody.add(cloudMesh);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 96, 48), new THREE.ShaderMaterial({
      ...ATMOSPHERE, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSun: { value: SUN_DIR }, uColor: { value: new THREE.Color(0.32, 0.6, 1.0) }, uPower: { value: 3.2 }, uStrength: { value: 1.25 } },
    }));
    this.earth.add(this.earthBody, atmo);
    this.scene.add(this.earth);
  }

  async buildMoon() {
    const map = await this.tex('/textures/hd/moon-1k.webp');
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(4, 96, 48), new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, roughness: 1, metalness: 0 }));
    this.moon.position.set(-38, 8, -62);
    this.moon.material.transparent = true;
    this.scene.add(this.moon);
    this.fades.push({ obj: this.moon, r: 4 });
  }

  atmosphere(radius, color, power = 6.0, strength = 0.45) {
    return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.025, 64, 32), new THREE.ShaderMaterial({
      ...ATMOSPHERE, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSun: { value: SUN_DIR }, uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uStrength: { value: strength } },
    }));
  }

  async buildPlanets() {
    const seg = this.isMobile ? 64 : 96;
    const make = async (file, r, pos, glow) => {
      const map = await this.tex('/textures/' + file);
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 }));
      m.position.copy(pos);
      m.material.transparent = true;
      if (glow) m.add(this.atmosphere(r, glow));
      this.scene.add(m);
      this.fades.push({ obj: m, r });
      return m;
    };
    this.planets = await Promise.all([
      make('mars.jpg', 5, new THREE.Vector3(55, -6, -260), 0xff9a6a),
      make('jupiter.jpg', 26, new THREE.Vector3(-112, 18, -560), 0xffc896),
      make('saturn.jpg', 20, new THREE.Vector3(122, -8, -880), 0xf5dca8),
      make('neptune.jpg', 9, new THREE.Vector3(-62, 12, -1180), 0x6f9bff),
    ]);
    const saturn = this.planets[2];
    const inner = 25, outer = 46;
    const ringGeo = new THREE.RingGeometry(inner, outer, 160, 1);
    const p = ringGeo.attributes.position, uv = ringGeo.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5); }
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false }));
    ring.rotation.set(Math.PI / 2 - 0.42, 0.1, 0.15);
    saturn.add(ring);
    this.planets.forEach((m) => { m.rotation.y = Math.random() * 6; m.rotation.z = 0.05; });
  }

  /* Camera path: one keyframe per page section (hero, about, services, process, cases, why, contact). */
  buildPath() {
    const portrait = window.innerWidth / window.innerHeight < 0.8;
    const k = portrait
      ? [ // phones: planet low in the frame, under the text
          [[-4, 14, 44], [-2, 11, 0]],
          [[-46, 15, -32], [-40, 13.5, -62]],
          [[46, 3, -228], [53, 1, -260]],
          [[-150, 58, -460], [-118, 50, -560]],
          [[90, 30, -770], [116, 24, -880]],
          [[-76, 22, -1138], [-64, 20, -1180]],
          [[-60, 30, -1290], null],
        ]
      : [
          [[-12, 3, 31], [-12, 2.4, 0]],
          [[-50, 11, -36], [-47, 9.5, -62]],
          [[40, -1, -233], [45, -3.5, -260]],
          [[-150, 30, -478], [-142, 24, -560]],
          [[84, 8, -790], [96, 2, -880]],
          [[-82, 17, -1140], [-74, 15, -1180]],
          [[-60, 30, -1290], null],
        ];
    // Finale: turn toward the sun, keeping it right of centre.
    const last = k[k.length - 1];
    const dir = SUN_DIR.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), portrait ? 0.0 : 0.2);
    if (portrait) dir.y -= 0.12;
    last[1] = new THREE.Vector3(...last[0]).addScaledVector(dir, 300).toArray();
    this.posCurve = new THREE.CatmullRomCurve3(k.map((x) => new THREE.Vector3(...x[0])), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(k.map((x) => new THREE.Vector3(...x[1])), false, 'centripetal');
  }

  measure() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    this.max = max;
    const marks = [...document.querySelectorAll('[data-scene]')].sort((a, b) => a.dataset.scene - b.dataset.scene);
    if (marks.length === 7) {
      this.stops = marks.map((m, i) => (i === 0 ? 0 : i === 6 ? 1 : Math.min(1, Math.max(0, (m.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.15) / max))));
    }
  }

  progress() { return Math.min(1, Math.max(0, (window.scrollY || 0) / this.max)); }

  curveU(p) {
    const s = this.stops;
    let i = 0;
    while (i < s.length - 2 && p > s[i + 1]) i++;
    const t = Math.min(1, Math.max(0, (p - s[i]) / Math.max(1e-4, s[i + 1] - s[i])));
    const e = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep: lingers at each planet, glides between
    return (i + e) / (s.length - 1);
  }

  bind() {
    this.ro = new ResizeObserver(() => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.fov = this.baseFov = this.fov();
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      this.composer?.setSize(w, h);
      this.bloom?.setSize(w / 2, h / 2);
      this.buildPath();
      this.measure();
    });
    this.ro.observe(document.documentElement);
    if (matchMedia('(pointer: fine)').matches && !REDUCED) {
      this.onMove = (e) => { this.pointer.tx = e.clientX / window.innerWidth - 0.5; this.pointer.ty = e.clientY / window.innerHeight - 0.5; };
      window.addEventListener('pointermove', this.onMove, { passive: true });
    }
    this.onVis = () => {
      this.renderer.setAnimationLoop(document.hidden ? null : () => this.frame());
      this.clock.getDelta();
    };
    document.addEventListener('visibilitychange', this.onVis);
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!REDUCED) this.time += dt;
    const k = (rate) => 1 - Math.exp(-rate * dt);

    const y = window.scrollY || 0;
    const rawV = (y - this.lastY) / Math.max(dt, 1e-3);
    this.lastY = y;
    this.vel += (rawV - this.vel) * k(REDUCED ? 30 : 6);
    const u = this.curveU(this.progress());
    const targetPos = this.posCurve.getPoint(u);
    const targetLook = this.lookCurve.getPoint(u);
    this.pointer.x += (this.pointer.tx - this.pointer.x) * k(2.5);
    this.pointer.y += (this.pointer.ty - this.pointer.y) * k(2.5);
    targetPos.x += this.pointer.x * 1.6;
    targetPos.y -= this.pointer.y * 1.0;

    const cam = this.camera;
    const before = cam.position.x;
    cam.position.lerp(targetPos, REDUCED ? 1 : k(3.2));
    this.look.lerp(targetLook, REDUCED ? 1 : k(3.6));
    cam.lookAt(this.look);
    cam.rotateZ(THREE.MathUtils.clamp((cam.position.x - before) * -0.04, -0.06, 0.06));

    this.stars.position.copy(cam.position);
    if (!REDUCED) this.updateWarp(dt, this.vel); else this.warp.visible = false;
    const surge = REDUCED ? 0 : THREE.MathUtils.smoothstep(Math.abs(this.vel), 400, 4000);
    const fov = this.baseFov + surge * 9;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * k(5); cam.updateProjectionMatrix(); }
    this.corona.quaternion.copy(cam.quaternion);
    const sunNear = THREE.MathUtils.clamp(1 - (cam.position.distanceTo(this.sun.position) - 700) / 500, 0, 1);
    this.coronaMat.uniforms.uFade.value = sunNear;
    this.coronaMat.uniforms.uTime.value = this.time;
    if (this.bloom) this.bloom.strength = 0.55 + surge * 0.35;
    this.starMat.uniforms.uTime.value = this.time;
    this.sunMat.uniforms.uTime.value = this.time;

    if (this.earthBody && !REDUCED) {
      this.earthBody.rotation.y += dt * 0.018;
      this.earthUniforms.uCloudShift.value = (this.time * 0.0016) % 1;
    }
    if (this.moon && !REDUCED) this.moon.rotation.y += dt * 0.01;
    if (this.planets && !REDUCED) this.planets.forEach((p, i) => { p.rotation.y += dt * (0.02 + i * 0.006); });

    // Planets fade in only as the camera approaches, so none of them sit behind earlier sections.
    this.fades.forEach((f) => {
      const d = cam.position.distanceTo(f.obj.position);
      const t = THREE.MathUtils.clamp((f.r * 12 - d) / (f.r * 5), 0, 1);
      const a = t * t * (3 - 2 * t);
      f.obj.visible = a > 0.002;
      f.obj.traverse((o) => {
        if (!o.material) return;
        if (o.material.uniforms?.uStrength) { o.material.uniforms.uStrength.value = (o.userData.base ??= o.material.uniforms.uStrength.value) * a; return; }
        o.material.opacity = (o.userData.baseOpacity ??= o.material.opacity) * a;
        o.material.depthWrite = a > 0.98;
      });
    });

    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, cam);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.onMove) window.removeEventListener('pointermove', this.onMove);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => {
        Object.values(m.uniforms || {}).forEach((u) => u.value?.isTexture && u.value.dispose());
        m.map?.dispose(); m.dispose();
      });
    });
    this.scene.background?.dispose?.();
    this.composer?.dispose?.();
    this.renderer.dispose();
  }
}

let instance = null;

export function initScene() {
  const canvas = document.getElementById('space-canvas');
  if (!canvas || instance) return Promise.resolve(null);
  try {
    instance = new Universe(canvas);
    window.addEventListener('pagehide', () => { instance?.dispose(); instance = null; });
    return instance.ready.then(() => instance);
  } catch (e) {
    console.warn('WebGL scene failed, keeping the CSS sky.', e);
    return Promise.resolve(null);
  }
}
