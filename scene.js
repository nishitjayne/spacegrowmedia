import * as THREE from 'three';

/*
  SpaceGrow v3 scene.
  One realistic hero (Earth: day, night lights, clouds, ocean glint, atmosphere) and a scroll-driven
  journey past the Moon, Mars, Jupiter, Saturn and Neptune toward the Sun. The Milky Way and nebula are
  rendered once into a cube map, so the sky costs nothing per frame. Bloom only on capable screens.
*/

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const UP = new THREE.Vector3(0, 1, 0);
// Lat/long to a point on a three.js SphereGeometry (u = 0 at longitude -180).
function latLon(lat, lon) {
  const phi = ((lon + 180) / 360) * Math.PI * 2, th = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
}
const MUMBAI = latLon(19.08, 72.88);
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
    varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vL;
    void main(){ vUv = uv; vL = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `
    uniform sampler2D uDay, uNight, uSpec, uClouds; uniform vec3 uSun; uniform float uCloudShift;
    uniform vec3 uIndia, uMumbai; uniform float uTime;
    varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vL;
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
      // India glows softly (land only), Mumbai gets a pin with an expanding ring.
      vec3 l = normalize(vL);
      float india = (1.0 - ocean) * smoothstep(0.28, 0.17, acos(clamp(dot(l, uIndia), -1.0, 1.0)));
      col += vec3(0.25, 0.72, 1.0) * india * (0.16 + 0.08 * sin(uTime * 1.6));
      float dm = acos(clamp(dot(l, uMumbai), -1.0, 1.0)), rr = fract(uTime * 0.45) * 0.09;
      col += vec3(0.45, 0.9, 1.0) * (exp(-pow((dm - rr) * 150.0, 2.0)) * (1.0 - rr / 0.09) * 1.3 + smoothstep(0.011, 0.004, dm) * 2.2);
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
      vec3 hot = vec3(2.6, 1.9, 1.15), warm = vec3(1.9, 0.9, 0.32), deep = vec3(0.7, 0.2, 0.05);
      vec3 col = mix(warm, hot, smoothstep(-0.4, 0.6, gran * 0.7 + flow * 0.5));
      col = mix(col, deep, spots * 0.85);
      col *= mix(0.45, 1.0, limb);
      col += vec3(0.8, 0.3, 0.08) * pow(1.0 - mu, 3.0);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
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
      vec3 col = vec3(1.0, 0.62, 0.3) * corona * 0.22 + vec3(1.0, 0.7, 0.4) * flares * 0.18 + vec3(1.0, 0.45, 0.2) * prom * 0.75;
      col *= inside * smoothstep(1.0, 0.7, r) * uFade;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
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
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.spinVel = 0;
    this.tiltVel = 0;
    this.tilt = 0;
    this.view = { yaw: 0, pitch: 0 };
    this.pickables = [];
    this.labels = [];
    this.grabbed = null;
    this.explore = false;
    this.keys = {};
    this.flyVel = new THREE.Vector3();
    this.flight = null;
    this.ray = new THREE.Raycaster();
    this.labelRoot = document.getElementById('labels');
    this.tmp = { pos: new THREE.Vector3(), look: new THREE.Vector3(), off: new THREE.Vector3(), side: new THREE.Vector3() };
    this.clock = new THREE.Clock();
    this.time = 0;
    this.stops = [0, 0.14, 0.3, 0.46, 0.64, 0.8, 1];

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this.buildPath();
    this.ready = Promise.all([this.buildEarth(), this.buildMoon(), this.buildPlanets()]);
    this.buildPath();
    this.buildSun();
    this.buildWarp();
    this.lastY = window.scrollY || 0;
    this.vel = 0;
    this.baseFov = this.fov();

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
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(0.32, 0.24, 0.18),
    }));
    halo.scale.setScalar(R * 4.2);
    this.sun.add(halo);
    this.scene.add(this.sun);
    this.named(this.sun.children[0], 'Sun', R);
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
    const uniforms = { uDay: { value: day }, uNight: { value: night }, uSpec: { value: spec }, uClouds: { value: clouds }, uSun: { value: SUN_DIR }, uCloudShift: { value: 0 }, uIndia: { value: latLon(22, 79) }, uMumbai: { value: MUMBAI }, uTime: { value: 0 } };
    this.earthUniforms = uniforms;
    this.earthBody = new THREE.Mesh(new THREE.SphereGeometry(R, seg, seg / 2), new THREE.ShaderMaterial({ ...EARTH, uniforms }));
    this.earthBody.rotation.y = -3.05;
    const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, seg, seg / 2), new THREE.ShaderMaterial({
      ...CLOUDS, uniforms, transparent: true, depthWrite: false,
    }));
    this.earthBody.add(cloudMesh);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.018, 128, 64), new THREE.ShaderMaterial({
      ...ATMOSPHERE, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSun: { value: SUN_DIR }, uColor: { value: new THREE.Color(0.35, 0.62, 1.0) }, uPower: { value: 5.5 }, uStrength: { value: 0.7 } },
    }));
    this.earth.add(this.earthBody, atmo);
    this.scene.add(this.earth);
    this.earthBody.userData.name = 'Earth';
    this.pickables.push(this.earthBody);
    this.label(this.earthBody, 'Mumbai, India', MUMBAI.clone().multiplyScalar(R * 1.01), true);
  }

  async buildMoon() {
    const map = await this.tex('/textures/hd/moon-1k.webp');
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(4, 96, 48), new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, roughness: 1, metalness: 0 }));
    this.moon.position.set(-38, 8, -62);
    this.scene.add(this.moon);
    this.fades.push({ obj: this.moon, r: 4 });
    this.named(this.moon, 'Moon', 4);
  }

  async buildPlanets() {
    const seg = this.isMobile ? 64 : 96;
    const make = async (file, r, pos, name) => {
      const map = await this.tex('/textures/' + file);
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 }));
      m.position.copy(pos);
      this.scene.add(m);
      this.fades.push({ obj: m, r });
      this.named(m, name, r);
      return m;
    };
    this.planets = await Promise.all([
      make('mars.jpg', 5, new THREE.Vector3(55, -6, -260), 'Mars'),
      make('jupiter.jpg', 26, new THREE.Vector3(-112, 18, -560), 'Jupiter'),
      make('saturn.jpg', 20, new THREE.Vector3(122, -8, -880), 'Saturn'),
      make('neptune.jpg', 9, new THREE.Vector3(-62, 12, -1180), 'Neptune'),
    ]);
    const saturn = this.planets[2];
    const inner = 25, outer = 46;
    const ringGeo = new THREE.RingGeometry(inner, outer, 160, 1);
    const p = ringGeo.attributes.position, uv = ringGeo.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5); }
    const ringMap = ringTexture();
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ map: ringMap, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false }));
    ring.customDepthMaterial = new THREE.MeshDepthMaterial({ map: ringMap, alphaTest: 0.35, depthPacking: THREE.RGBADepthPacking });
    ring.rotation.set(Math.PI / 2 - 0.42, 0.1, 0.15);
    ring.renderOrder = 1;
    ring.castShadow = ring.receiveShadow = saturn.castShadow = saturn.receiveShadow = true;
    saturn.add(ring);
    // The scene light sits beside Saturn (same direction everywhere) so its shadow box covers the rings.
    this.light.position.copy(saturn.position).addScaledVector(SUN_DIR, 150);
    this.light.target = saturn;
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(this.isMobile ? 1024 : 2048, this.isMobile ? 1024 : 2048);
    Object.assign(this.light.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 80, far: 230 });
    this.light.shadow.bias = -0.0005;
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
    const dir = SUN_DIR.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), portrait ? 0.0 : 0.36);
    dir.y -= portrait ? 0.2 : 0.17;
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
    const targetPos = this.posCurve.getPoint(u, this.tmp.pos);
    const targetLook = this.lookCurve.getPoint(u, this.tmp.look);
    this.pointer.x += (this.pointer.tx - this.pointer.x) * k(2.5);
    this.pointer.y += (this.pointer.ty - this.pointer.y) * k(2.5);
    targetPos.x += this.pointer.x * 2.6;
    targetPos.y -= this.pointer.y * 1.6;

    const cam = this.camera;
    if (this.explore) this.fly(dt);
    else {
      const before = cam.position.x;
      cam.position.lerp(targetPos, REDUCED ? 1 : k(3.2));
      this.look.lerp(targetLook, REDUCED ? 1 : k(3.6));
      cam.lookAt(this.look);
      cam.rotateZ(THREE.MathUtils.clamp((cam.position.x - before) * -0.04, -0.06, 0.06));
      // Looking around stays put until you scroll on.
      if (Math.abs(this.vel) > 60 && !this.grabbed) { const e = Math.exp(-4 * dt); this.view.yaw *= e; this.view.pitch *= e; }
      cam.rotateOnWorldAxis(UP, this.view.yaw);
      cam.rotateX(this.view.pitch);
    }

    this.stars.position.copy(cam.position);
    const speed = this.explore ? this.flyVel.length() * 18 : Math.abs(this.vel);
    if (!REDUCED) this.updateWarp(dt, this.explore ? speed : this.vel); else this.warp.visible = false;
    const surge = REDUCED ? 0 : THREE.MathUtils.smoothstep(speed, 400, 4000);
    const fov = this.baseFov + surge * 9;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * k(5); cam.updateProjectionMatrix(); }
    this.corona.quaternion.copy(cam.quaternion);
    const sunNear = THREE.MathUtils.clamp(1 - (cam.position.distanceTo(this.sun.position) - 700) / 500, 0, 1);
    this.coronaMat.uniforms.uFade.value = sunNear;
    this.sun.visible = sunNear > 0.01;
    this.coronaMat.uniforms.uTime.value = this.time;
    this.starMat.uniforms.uTime.value = this.time;
    this.sunMat.uniforms.uTime.value = this.time;

    if (this.earthBody) {
      this.earthBody.rotation.y += this.spinVel * dt;
      this.spinVel *= Math.exp(-1.8 * dt);
      this.tilt = THREE.MathUtils.clamp(this.tilt + this.tiltVel * dt, -0.7, 0.7);
      this.tiltVel *= Math.exp(-2.5 * dt);
      this.tilt *= Math.exp(-0.25 * dt);
      const lean = REDUCED ? 0 : this.pointer.y * 0.12;
      this.earthBody.rotation.x = this.tilt + lean;
      this.earthBody.rotation.z = REDUCED ? 0 : -this.pointer.x * 0.06;
      if (!REDUCED) this.earthBody.rotation.y += dt * 0.018;
      this.earthUniforms.uCloudShift.value = (this.time * 0.0016) % 1;
      this.earthUniforms.uTime.value = this.time;
    }
    if (this.moon && !REDUCED) this.moon.rotation.y += dt * 0.01;
    for (const p of this.pickables) {
      if (p === this.earthBody) continue;
      if (!REDUCED) p.rotation.y += dt * 0.02;
      if (p.userData.spin) { p.rotation.y += p.userData.spin * dt; p.userData.spin *= Math.exp(-1.6 * dt); }
    }

    // Planets fade in only as the camera approaches, so none of them sit behind earlier sections.
    for (const f of this.fades) {
      const t = this.explore ? 1 : THREE.MathUtils.clamp((f.r * 12 - cam.position.distanceTo(f.obj.position)) / (f.r * 5), 0, 1);
      const a = t * t * (3 - 2 * t), m = f.obj.material;
      f.obj.visible = a > 0.002;
      if (m.transparent !== a < 0.999) { m.transparent = a < 0.999; m.needsUpdate = true; }
      m.opacity = a;
    }

    this.updateLabels();
    this.renderer.render(this.scene, cam);
  }

  /* ───────── interaction ───────── */
  pick(x, y) {
    this.tmp.off.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1, 0);
    this.ray.setFromCamera(this.tmp.off, this.camera);
    const hit = this.ray.intersectObjects(this.pickables.filter((p) => p.visible && p.parent.visible), false)[0];
    return hit ? hit.object : null;
  }

  // Press: grab a planet to spin it, or empty space to look around.
  grab(x, y) { this.grabbed = this.pick(x, y); return this.grabbed ? 'planet' : 'look'; }

  drag(dx, dy, dt) {
    const g = this.grabbed, s = Math.max(dt, 0.008);
    if (g === this.earthBody) {
      g.rotation.y += dx * 0.006;
      this.tilt = THREE.MathUtils.clamp(this.tilt + dy * 0.004, -0.7, 0.7);
      this.spinVel = THREE.MathUtils.clamp((dx * 0.006) / s, -4, 4);
      this.tiltVel = THREE.MathUtils.clamp((dy * 0.004) / s, -2, 2);
    } else if (g) {
      g.rotation.y += dx * 0.006;                      // only on its own axis
      g.userData.spin = THREE.MathUtils.clamp((dx * 0.006) / s, -4, 4);
    } else {
      this.view.yaw += dx * 0.0022;                    // turn your head, the world stays put
      this.view.pitch = THREE.MathUtils.clamp(this.view.pitch + dy * 0.0022, -1.35, 1.35);
    }
  }

  release() { this.grabbed = null; }

  /* ───────── explore mode ───────── */
  setExplore(on) {
    this.explore = on;
    this.flight = null;
    this.flyVel.set(0, 0, 0);
    if (on) {
      this.baseQuat = this.camera.quaternion.clone();
      this.view.yaw = this.view.pitch = 0;
    } else {
      this.view.yaw = this.view.pitch = 0;
      this.look.copy(this.camera.position).add(this.tmp.off.set(0, 0, -50).applyQuaternion(this.camera.quaternion));
    }
  }

  thrust(amount) { if (this.explore && !this.flight) this.flyVel.addScaledVector(this.tmp.off.set(0, 0, -1).applyQuaternion(this.camera.quaternion), amount); }

  // Click a planet: travel to it.
  travel(x, y) {
    const obj = this.pick(x, y);
    if (!obj) return null;
    const target = obj.getWorldPosition(new THREE.Vector3());
    const r = obj.geometry.boundingSphere?.radius ?? (obj.geometry.computeBoundingSphere(), obj.geometry.boundingSphere.radius);
    const from = this.camera.position.clone();
    const to = target.clone().add(from.clone().sub(target).normalize().multiplyScalar(r * 3.4));
    const endQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(to, target, UP));
    this.flight = { from, to, q0: this.camera.quaternion.clone(), q1: endQuat, t: 0, dur: THREE.MathUtils.clamp(from.distanceTo(to) / 300, 1.6, 4) };
    this.flyVel.set(0, 0, 0);
    return obj.userData.name;
  }

  fly(dt) {
    const cam = this.camera;
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t * f.t * f.t * (f.t * (f.t * 6 - 15) + 10);
      cam.position.lerpVectors(f.from, f.to, e);
      cam.quaternion.slerpQuaternions(f.q0, f.q1, Math.min(1, e * 1.6));
      if (f.t >= 1) { this.flight = null; this.baseQuat.copy(cam.quaternion); this.view.yaw = this.view.pitch = 0; }
      return;
    }
    cam.quaternion.copy(this.baseQuat);
    cam.rotateOnWorldAxis(UP, this.view.yaw);
    cam.rotateX(this.view.pitch);
    const k = this.keys, boost = k.Shift ? 4 : 1, acc = 160 * boost * dt;
    const fwd = this.tmp.off.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = this.tmp.side.set(1, 0, 0).applyQuaternion(cam.quaternion);
    if (k.w || k.ArrowUp) this.flyVel.addScaledVector(fwd, acc);
    if (k.s || k.ArrowDown) this.flyVel.addScaledVector(fwd, -acc);
    if (k.d || k.ArrowRight) this.flyVel.addScaledVector(right, acc);
    if (k.a || k.ArrowLeft) this.flyVel.addScaledVector(right, -acc);
    if (k.e || k[' ']) this.flyVel.y += acc;
    if (k.q) this.flyVel.y -= acc;
    this.flyVel.multiplyScalar(Math.exp(-1.6 * dt));
    cam.position.addScaledVector(this.flyVel, dt);
  }

  /* ───────── labels (DOM, positioned from 3D) ───────── */
  label(obj, text, local, pin) {
    if (!this.labelRoot) return;
    const el = document.createElement('div');
    el.className = 'label3d' + (pin ? ' pin' : '');
    el.textContent = text;
    this.labelRoot.appendChild(el);
    this.labels.push({ obj, local, el, pin, on: false });
  }

  named(obj, name, r) {
    obj.userData.name = name;
    this.pickables.push(obj);
    this.label(obj, name, null, false);
    obj.userData.labelR = r;
  }

  updateLabels() {
    const cam = this.camera, w = window.innerWidth, h = window.innerHeight;
    for (const L of this.labels) {
      const p = this.tmp.pos;
      let show = L.obj.visible && L.obj.parent?.visible !== false;
      if (L.pin) {
        p.copy(L.local);
        L.obj.localToWorld(p);
        const normal = this.tmp.look.copy(p).sub(L.obj.getWorldPosition(this.tmp.side)).normalize();
        show = show && normal.dot(this.tmp.side.copy(cam.position).sub(p).normalize()) > 0.15 && (this.explore || this.progress() < this.stops[1] * 0.7);
      } else {
        L.obj.getWorldPosition(p);
        p.y += L.obj.userData.labelR * 1.3;
        show = show && this.explore;
      }
      p.project(cam);
      show = show && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      if (show !== L.on) { L.on = show; L.el.classList.toggle('on', show); }
      if (show) L.el.style.transform = `translate3d(${((p.x + 1) / 2 * w).toFixed(1)}px, ${((1 - p.y) / 2 * h).toFixed(1)}px, 0)`;
    }
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
