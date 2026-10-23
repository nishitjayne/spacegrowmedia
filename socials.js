import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/*
  Social planets and client orbs: one glossy sphere per link, drawn over the link's ball slot.
  The links stay real <a> elements; this canvas only paints. The logo is kept facing the viewer,
  so each ball reads as its network or brand at a glance.
*/

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BRAND = {
  ig: (g) => { // Instagram's app-icon gradient, lit from the bottom left
    const r = g.createRadialGradient(150, 470, 0, 150, 470, 520);
    [[0, '#feda75'], [0.25, '#fa7e1e'], [0.5, '#d62976'], [0.75, '#962fbf'], [1, '#4f5bd5']].forEach(([o, c]) => r.addColorStop(o, c));
    return r;
  },
  in: () => '#0a66c2',
  fb: () => '#0866ff',
};

// Equirectangular map with the glyph centred at u = 0.25, the side of a three.js sphere that faces +Z.
function texture(net, path) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = BRAND[net](g);
  g.fillRect(0, 0, 1024, 512);
  g.translate(256 - 84, 256 - 84);
  g.scale(7, 7); // the 24-unit icon becomes 168 px, about 60 degrees of the sphere
  g.fillStyle = '#fff';
  g.fill(new Path2D(path));
  return canvasTexture(c);
}

function canvasTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A logo projected onto the sphere's front so it reads undistorted face-on, on its own edge colour.
async function decal(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const N = 256, s = document.createElement('canvas');
  s.width = s.height = N;
  const sg = s.getContext('2d', { willReadFrequently: true });
  sg.drawImage(img, 0, 0, N, N);
  const px = sg.getImageData(0, 0, N, N).data;
  const bg = [0, 0, 0];
  for (let i = 0; i < N; i++) for (const [x, y] of [[i, 2], [i, N - 3], [2, i], [N - 3, i]]) for (let k = 0; k < 3; k++) bg[k] += px[(y * N + x) * 4 + k] / (N * 4);
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${bg.map(Math.round).join(',')})`;
  g.fillRect(0, 0, 1024, 512);
  // Only the front band can show the logo: u in [0, 0.5] (facing +Z) and rows where |Y| < R.
  const R = 0.72, j0 = Math.floor((Math.acos(R) / Math.PI) * 512), j1 = Math.ceil(((Math.PI - Math.acos(R)) / Math.PI) * 512);
  const out = g.getImageData(0, j0, 512, j1 - j0), d = out.data;
  for (let j = j0; j < j1; j++) {
    const th = (j / 512) * Math.PI, st = Math.sin(th), Y = Math.cos(th);
    for (let i = 0; i < 512; i++) {
      const X = -Math.cos((i / 1024) * Math.PI * 2) * st;
      if (X * X + Y * Y >= R * R) continue;
      const q = (Math.floor((0.5 - Y / R / 2) * N) * N + Math.floor((X / R / 2 + 0.5) * N)) * 4, o = ((j - j0) * 512 + i) * 4;
      d[o] = px[q]; d[o + 1] = px[q + 1]; d[o + 2] = px[q + 2];
    }
  }
  g.putImageData(out, 0, j0);
  return canvasTexture(c);
}

export async function initOrbs(root) {
  const canvas = root.querySelector('.orbs-canvas');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-1, 1.3, 1.6);
  const rim = new THREE.DirectionalLight(0x6fb8ff, 1.6); // a cool edge light, like the Sun-side of the scene
  rim.position.set(1.4, -0.3, -1);
  scene.add(key, rim);
  // Pixel units with y pointing down the page, so balls sit exactly on their slots.
  const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -1000, 1000);
  const geo = new THREE.SphereGeometry(1, 96, 64);

  const links = [...root.querySelectorAll('.orb')];
  const maps = await Promise.all(links.map((a) => (a.dataset.img ? decal(a.dataset.img) : texture(a.dataset.net, document.querySelector(`#i-${a.dataset.net} path`).getAttribute('d')))));
  const orbs = links.map((a, i) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: maps[i], roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.8 }));
    scene.add(mesh);
    const o = { a, ball: a.querySelector('.orb-ball'), mesh, on: 0, in: false, tx: 0, ty: 0, rx: 0, ry: 0, turn: 0, goal: 0, v: 0, phase: Math.random() * 6.28 };
    const enter = () => { o.in = true; if (!REDUCED) o.goal += Math.PI * 2; };
    const leave = () => { o.in = false; o.tx = o.ty = 0; };
    a.addEventListener('pointerenter', enter);
    a.addEventListener('pointerleave', leave);
    a.addEventListener('focus', enter);
    a.addEventListener('blur', leave);
    a.addEventListener('pointermove', (e) => {
      const r = o.ball.getBoundingClientRect();
      o.tx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / r.width));
      o.ty = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / r.height));
    });
    return o;
  });

  let w = 0, h = 0, last = performance.now(), raf = 0;
  const fit = () => {
    if (w === root.clientWidth && h === root.clientHeight) return; // re-allocating the canvas is costly
    w = root.clientWidth; h = root.clientHeight;
    renderer.setSize(w, h, false);
    cam.right = w; cam.bottom = -h;
    cam.updateProjectionMatrix();
  };
  fit();
  new ResizeObserver(fit).observe(root);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.documentElement.classList.contains('exploring')) return;
    const dt = Math.min((now - last) / 1000, 0.05), t = now / 1000;
    last = now;
    const k = (rate) => 1 - Math.exp(-rate * dt);
    const box = canvas.getBoundingClientRect();
    for (const o of orbs) {
      const b = o.ball.getBoundingClientRect();
      o.on += ((o.in ? 1 : 0) - o.on) * k(8);
      // One full turn on hover that settles logo-front (a damped spring), then a lean toward the cursor.
      o.v += (o.goal - o.turn) * 60 * dt;
      o.v *= Math.exp(-9 * dt);
      o.turn += o.v * dt;
      o.ry += (o.tx * 0.55 - o.ry) * k(6);
      o.rx += (o.ty * 0.45 - o.rx) * k(6);
      const idle = REDUCED ? 0 : 1 - o.on;
      o.mesh.position.set(b.left - box.left + b.width / 2, -(b.top - box.top + b.height / 2) + Math.sin(t * 1.1 + o.phase) * 4 * idle, 0);
      o.mesh.scale.setScalar((b.width / 2) * (1 + 0.08 * o.on));
      o.mesh.rotation.set(o.rx + Math.sin(t * 0.7 + o.phase) * 0.06 * idle, o.turn + o.ry + Math.sin(t * 0.5 + o.phase) * 0.18 * idle, 0);
    }
    renderer.render(scene, cam);
  }

  // Draw only while the section is on screen.
  new IntersectionObserver(([e]) => {
    cancelAnimationFrame(raf);
    if (e.isIntersecting) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }).observe(root);
  frame(performance.now());
  root.classList.add('gl');
}
