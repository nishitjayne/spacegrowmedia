import * as THREE from 'three';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Fresnel rim shader: a back-faced shell that glows at the planet's edge (additive). */
const ATMOSPHERE = {
  // Normal and view vector both in view space, so the rim is right wherever the camera is.
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uPower;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float rim = pow(max(0.72 - dot(vNormal, vView), 0.0), uPower);
      gl_FragColor = vec4(uColor, 1.0) * clamp(rim * 0.55, 0.0, 1.0);
    }`,
};

class SpaceScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.isMobile = window.innerWidth < 768;
    this.size = { w: canvas.clientWidth || window.innerWidth, h: canvas.clientHeight || window.innerHeight };
    this.cursor = { x: 0, y: 0 };
    this.totalDepth = 250;
    this.clock = new THREE.Clock();
    this.dummy = new THREE.Object3D();
    this.lastScroll = this.scrollY();
    this.scrollVelocity = 0;
    this.visible = true;
    this.disposables = [];

    this.init();
    this.createStarfield();
    this.createSolarSystem();
    if (!this.isMobile) this.createAsteroids();
    this.createLights();
    this.bind();

    this.updateTarget();
    this.camera.position.set(this.targetX, this.targetY, this.targetZ);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  scrollY() { return window.scrollY || document.documentElement.scrollTop || 0; }

  init() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050510, 0.0015);
    this.camera = new THREE.PerspectiveCamera(60, this.size.w / this.size.h, 0.1, 1000);
    this.camera.position.z = 20;
    this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: true, antialias: !this.isMobile,
      powerPreference: this.isMobile ? 'low-power' : 'high-performance',
    });
    this.renderer.setPixelRatio(this.isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.size.w, this.size.h, false);
  }

  glowTexture(size = 64, stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => grad.addColorStop(o, col));
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  createStarfield() {
    const n = this.isMobile ? 3000 : 8000;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    // Brand-led palette: mostly white, then cyan and violet, a few warm.
    const palette = [[0xffffff, 0.5], [0x9be9ff, 0.2], [0xc9a0ff, 0.2], [0xfde68a, 0.1]];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      pos[k] = (Math.random() - 0.5) * 350;
      pos[k + 1] = (Math.random() - 0.5) * 350;
      pos[k + 2] = (Math.random() - 1.0) * 1500 + 200;
      let r = Math.random(), hex = 0xffffff;
      for (const [h, w] of palette) { if ((r -= w) <= 0) { hex = h; break; } }
      c.setHex(hex);
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const map = this.glowTexture(16);
    const mat = new THREE.PointsMaterial({
      size: this.isMobile ? 1.5 : 2.5, map, transparent: true, vertexColors: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  atmosphere(radius, color, power = 4.0, scale = 1.14) {
    const mat = new THREE.ShaderMaterial({
      ...ATMOSPHERE, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power } },
    });
    return new THREE.Mesh(new THREE.SphereGeometry(radius * scale, this.isMobile ? 24 : 48, this.isMobile ? 24 : 48), mat);
  }

  createSolarSystem() {
    this.planets = [];
    const loader = new THREE.TextureLoader();
    const seg = this.isMobile ? 16 : 64;

    const make = (radius, file, z, x, opts = {}) => {
      const tex = loader.load('/textures/' + file);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.isMobile ? 1 : 4;
      const mat = opts.sun
        ? new THREE.MeshBasicMaterial({ map: tex })
        : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.2 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, seg, seg), mat);
      mesh.rotation.set(Math.random() * 0.4, 0, Math.random() * 0.2);
      mesh.position.set(x, 0, z);
      if (opts.glow) mesh.add(this.atmosphere(radius, opts.glow, opts.power, opts.scale));
      this.scene.add(mesh);
      this.planets.push(mesh);
      return mesh;
    };

    const spread = this.isMobile ? 0.4 : 1.0;
    const sun = make(7, 'sun.jpg', -5, this.isMobile ? 5 : 14, { sun: true });
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture(128, [[0, 'rgba(255,214,140,0.95)'], [0.25, 'rgba(255,150,60,0.45)'], [1, 'rgba(255,90,20,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    corona.scale.setScalar(44);
    sun.add(corona);
    const sunLight = new THREE.PointLight(0xffffff, 8, 800);
    sunLight.position.copy(sun.position);
    this.scene.add(sunLight);

    make(0.3, 'mercury.jpg', -25, -4 * spread);
    make(0.7, 'venus.jpg', -50, 6 * spread, { glow: 0xffc27a, power: 3.0 });
    make(0.8, 'earth.jpg', -75, -5 * spread, { glow: 0x4cc9ff, power: 3.2, scale: 1.18 });
    make(0.5, 'mars.jpg', -100, 4 * spread, { glow: 0xff7a50, power: 4.0 });
    make(3.0, 'jupiter.jpg', -150, -12 * spread, { glow: 0xffb27a, power: 4.5 });
    const saturn = make(2.5, 'saturn.jpg', -175, 14 * spread, { glow: 0xf3d9a0, power: 4.5 });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 5.0, seg),
      new THREE.MeshStandardMaterial({ color: 0xcfb590, side: THREE.DoubleSide, transparent: true, opacity: 0.8, roughness: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2 + 0.3;
    saturn.add(ring);
    make(1.2, 'uranus.jpg', -200, -8 * spread, { glow: 0x7df3ff, power: 3.4 });
    make(1.1, 'neptune.jpg', -225, 6 * spread, { glow: 0x6f8cff, power: 3.4 });
  }

  createAsteroids() {
    this.asteroidCount = 1200;
    this.asteroids = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.15, 0),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.3 }),
      this.asteroidCount,
    );
    this.asteroidData = Array.from({ length: this.asteroidCount }, () => ({
      angle: Math.random() * Math.PI * 2, radius: 8 + Math.random() * 12, y: (Math.random() - 0.5) * 4,
      rx: Math.random() * Math.PI, ry: Math.random() * Math.PI, rz: Math.random() * Math.PI,
      sx: (Math.random() - 0.5) * 2, sy: (Math.random() - 0.5) * 2, sz: (Math.random() - 0.5) * 2,
      orbit: 0.05 + Math.random() * 0.1, scale: 0.4 + Math.random() * 0.9,
    }));
    this.updateAsteroids(0);
    this.scene.add(this.asteroids);
  }

  updateAsteroids(dt) {
    const d = this.dummy;
    for (let i = 0; i < this.asteroidCount; i++) {
      const a = this.asteroidData[i];
      a.angle += a.orbit * dt; a.rx += a.sx * dt; a.ry += a.sy * dt; a.rz += a.sz * dt;
      d.position.set(Math.cos(a.angle) * a.radius, a.y, -125 + Math.sin(a.angle) * a.radius * 0.5);
      d.rotation.set(a.rx, a.ry, a.rz);
      d.scale.setScalar(a.scale);
      d.updateMatrix();
      this.asteroids.setMatrixAt(i, d.matrix);
    }
    this.asteroids.instanceMatrix.needsUpdate = true;
  }

  createLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const galactic = new THREE.DirectionalLight(0x818cf8, 1);
    galactic.position.set(50, 20, 50);
    this.scene.add(galactic);
  }

  bind() {
    // ResizeObserver on the canvas instead of window.resize; no scroll listener at all (scroll is read per frame).
    const measure = () => { this.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
    measure();
    this.ro = new ResizeObserver(() => {
      measure();
      this.size.w = window.innerWidth; this.size.h = window.innerHeight;
      this.camera.aspect = this.size.w / this.size.h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.size.w, this.size.h, false);
    });
    this.ro.observe(document.documentElement);
    if (!this.isMobile && !REDUCED) {
      this.onMove = (e) => { this.cursor.x = e.clientX / this.size.w - 0.5; this.cursor.y = e.clientY / this.size.h - 0.5; };
      window.addEventListener('pointermove', this.onMove, { passive: true });
    }
    this.onVis = () => {
      this.visible = !document.hidden;
      this.renderer.setAnimationLoop(this.visible ? () => this.frame() : null);
      if (this.visible) this.clock.getDelta();
    };
    document.addEventListener('visibilitychange', this.onVis);
  }

  updateTarget() {
    const p = Math.min(1, Math.max(0, this.scrollY() / (this.max || 1)));
    this.targetZ = 20 - p * this.totalDepth;
    this.targetX = Math.sin(p * Math.PI * 4) * 8;
    this.targetY = Math.cos(p * Math.PI * 3) * 4 - 2;
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const y = this.scrollY();
    this.scrollVelocity += ((y - this.lastScroll) - this.scrollVelocity) * 0.15;
    this.lastScroll = y;
    this.updateTarget();

    if (!REDUCED) {
      this.planets.forEach((p, i) => { p.rotation.y += dt * (i === 0 ? 0.02 : 0.15); });
      if (this.asteroids) this.updateAsteroids(dt);
    }

    // Frame-rate independent damping: the same feel at 30, 60 or 144 fps.
    const k = (rate) => 1 - Math.exp(-rate * dt);
    const cam = this.camera;
    const prevX = cam.position.x;
    cam.position.x += (this.targetX + this.cursor.x * 2 - cam.position.x) * k(2);
    cam.position.y += (this.targetY - this.cursor.y * 2 - cam.position.y) * k(2);
    cam.position.z += (this.targetZ - cam.position.z) * k(5);
    cam.rotation.z = -(cam.position.x - prevX) * 0.1;
    cam.lookAt(cam.position.x * 0.5, cam.position.y * 0.5, cam.position.z - 20);

    // Stars stream past; reduced motion keeps them still.
    const speed = REDUCED ? 0 : 150 + Math.abs(this.scrollVelocity) * 3;
    const a = this.stars.geometry.attributes.position, arr = a.array;
    if (speed) {
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 2] += speed * dt;
        if (arr[i + 2] > cam.position.z + 50) {
          arr[i + 2] -= 1500; arr[i] = (Math.random() - 0.5) * 350; arr[i + 1] = (Math.random() - 0.5) * 350;
        } else if (arr[i + 2] < cam.position.z - 1450) arr[i + 2] += 1500;
      }
      a.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.onMove) window.removeEventListener('pointermove', this.onMove);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.renderer.dispose();
  }
}

let instance = null;

export function initSpaceBackground() {
  const canvas = document.getElementById('space-canvas');
  if (!canvas || instance) return;
  try {
    instance = new SpaceScene(canvas);
    window.addEventListener('pagehide', () => { instance?.dispose(); instance = null; });
  } catch (e) {
    console.warn('Three.js solar system failed. Falling back to the CSS grid.', e);
  }
}
