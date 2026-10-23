import { nextFact } from './facts.js';
import Lenis from 'lenis';

document.documentElement.classList.add('rv');

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(any-hover: hover)').matches;
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ───────── Smooth scroll ───────── */
const lenis = reduceMotion ? null : new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
const onScrollFns = [];
const onScroll = (fn) => onScrollFns.push(fn);
const runScroll = () => onScrollFns.forEach((fn) => fn(window.scrollY));
if (lenis) {
  lenis.on('scroll', runScroll);
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
} else {
  window.addEventListener('scroll', runScroll, { passive: true });
}
const navH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
// Land the section's heading just under the nav, computed as one number so no offset is applied twice.
function scrollToHash(hash) {
  let y = 0;
  if (hash !== '#hero') {
    const el = document.querySelector(hash);
    if (!el) return;
    const pad = el.tagName === 'SECTION' ? parseFloat(getComputedStyle(el).paddingTop) || 0 : 0;
    y = Math.max(0, el.getBoundingClientRect().top + window.scrollY + pad - navH() - 28);
  }
  if (lenis) {
    if (Math.abs(lenis.scroll - window.scrollY) > 2) lenis.scrollTo(window.scrollY, { immediate: true, force: true });
    lenis.scrollTo(y, { duration: 1.6, force: true });
  }
  else window.scrollTo(0, y);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  e.preventDefault();
  scrollToHash(a.getAttribute('href'));
  history.replaceState(null, '', a.getAttribute('href'));
});

/* ───────── Split headings into masked words ───────── */
function split(el) {
  let n = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part; wi.style.setProperty('--wi', n++);
          w.appendChild(wi); frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    });
  };
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  walk(el);
  [...el.children].forEach((c) => c.setAttribute('aria-hidden', 'true'));
}
$$('[data-split]').forEach(split);

/* ───────── Reveal, counters, timeline ───────── */
function countUp(node) {
  const target = Number(node.dataset.count), suffix = node.dataset.suffix || '';
  if (reduceMotion) { node.textContent = target + suffix; return; }
  const t0 = performance.now();
  const tick = (now) => {
    const t = Math.min((now - t0) / 1800, 1);
    node.textContent = Math.round(target * (1 - Math.pow(1 - t, 4))) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function startReveals() {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    $$('[data-count]', e.target).forEach(countUp);
    io.unobserve(e.target);
  }), { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, [data-split]').forEach((el) => io.observe(el));

  const timeline = $('timeline');
  const steps = $$('.step', timeline);
  onScroll(() => {
    const r = timeline.getBoundingClientRect();
    const mid = innerHeight * 0.55;
    timeline.style.setProperty('--p', clamp((mid - r.top) / r.height, 0, 1).toFixed(4));
    let active = null;
    steps.forEach((s) => { const b = s.getBoundingClientRect(); if (b.top < mid) active = s; });
    steps.forEach((s) => s.classList.toggle('active', s === active));
  });
  runScroll();
}

/* ───────── 3D scene: starts loading during the intro so Earth is ready when it ends ───────── */
let scenePromise = null;
let universe = null;
function bootScene() {
  if (scenePromise) return scenePromise;
  scenePromise = import('./scene.js')
    .then((m) => m.initScene())
    .then((u) => { if (u) { universe = u; $('space-canvas').classList.add('on'); } return u; })
    .catch((e) => console.warn('3D scene failed:', e));
  return scenePromise;
}

/* ───────── Intro ───────── */
let introDone = false;
function finishIntro() {
  if (introDone) return;
  introDone = true;
  store.set('sg-intro', '1');
  const intro = $('intro');
  $('site').classList.add('visible');
  if (intro) {
    if (reduceMotion) intro.remove();
    else { intro.classList.add('exit'); setTimeout(() => intro.remove(), 1150); }
  }
  universe?.hurryIntro();
  lenis?.start();
  bootScene();
  startReveals();
}

function runIntro() {
  const intro = $('intro');
  if (!intro || reduceMotion || (store.get('sg-intro') && !/[?&]intro\b/.test(location.search))) { intro?.remove(); return finishIntro(); }
  lenis?.stop();
  bootScene();
  $('intro-skip').addEventListener('click', finishIntro);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') finishIntro(); });

  const canvas = $('intro-canvas'), ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const stars = Array.from({ length: 420 }, () => ({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight, z: Math.random(),
    r: Math.random() * 1.1 + 0.2, s: Math.random() * 0.02 + 0.004, o: Math.random() * 6.28,
  }));
  const t0 = performance.now();
  (function draw(now) {
    if (introDone) return;
    const t = (now - t0) / 1000, w = innerWidth, h = innerHeight;
    ctx.fillStyle = '#03040a'; ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.6);
    glow.addColorStop(0, 'rgba(79,125,255,0.10)'); glow.addColorStop(0.5, 'rgba(155,107,255,0.04)'); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    stars.forEach((s) => {
      const drift = t * 6 * s.z;
      ctx.fillStyle = `rgba(230,236,255,${(0.25 + s.z * 0.6) * (Math.sin(t * 60 * s.s + s.o) * 0.3 + 0.7)})`;
      ctx.beginPath(); ctx.arc((s.x - drift + w) % w, s.y, s.r * (0.6 + s.z), 0, 6.2832); ctx.fill();
    });
    requestAnimationFrame(draw);
  })(t0);

  // Sunrise over Earth when the 3D scene is ready in time; otherwise the logo alone on the starfield.
  // While Earth loads, a quiet "prepare for takeoff" stage with real texture progress; shown only if it takes a while.
  const load = $('intro-load');
  const onLoad = (e) => load.style.setProperty('--p', e.detail.toFixed(3));
  addEventListener('sg-load', onLoad);
  const shown = setTimeout(() => load.classList.add('on'), 400);
  Promise.race([scenePromise, new Promise((r) => setTimeout(r, 9000))])
    .then((u) => document.fonts.ready.then(() => {
      clearTimeout(shown);
      removeEventListener('sg-load', onLoad);
      load.classList.remove('on');
      if (!introDone) playLogo(u);
    }));
}

// The Sun clears Earth's limb just ahead of the logo's rocket, the rocket lays the S, the wordmark settles,
// then the mark docks into the nav logo while the camera glides down to the hero view.
function playLogo(u) {
  const logo = $('intro-logo');
  const span = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const out = (x) => 1 - Math.pow(1 - x, 3);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const back = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
  const ringAt = () => new DOMPoint(305, 510).matrixTransform(logo.getScreenCTM()); // centre of the logo's ring
  const arcs = [$('arcA'), $('arcB')].map((p) => ({ p, len: p.getTotalLength() }));
  const reveal = $('revealPath'), revLen = reveal.getTotalLength();
  const rocket = $('rocket'), flame = $('flame'), bar = $('bar');
  const pixels = [...$('pixels').children].map((r) => ({ r, x: +r.getAttribute('x'), y: +r.getAttribute('y'), dx: (Math.random() - 0.3) * 260, dy: (Math.random() - 0.5) * 220, rot: (Math.random() - 0.5) * 240, d: Math.random() * 0.25 }));
  const words = [...$('words').children].filter((w) => w.tagName === 'text');
  const LOGO = u ? 1.1 : 0.2, DOCK = LOGO + 3.6, GLIDE = 2.6;
  logo.classList.add('play');
  if (u) {
    const c = new DOMPoint(540, 232).matrixTransform(logo.getScreenCTM()); // just past the rocket's nose
    u.sunrise((c.x / innerWidth) * 2 - 1, 1 - (c.y / innerHeight) * 2, DOCK, GLIDE);
    $('intro').classList.add('sky');
  }
  let angle = 0;
  const t0 = performance.now();
  (function frame(now) {
    if (introDone) return;
    const t = (now - t0) / 1000 - LOGO;
    const ring = inOut(span(t, 0, 1.4));
    arcs.forEach(({ p, len }) => { p.style.strokeDasharray = len; p.style.strokeDashoffset = len * (1 - ring); });
    for (const px of pixels) {
      const k = back(span(t, 0.4 + px.d, 1.2 + px.d));
      px.r.setAttribute('transform', `translate(${(px.dx * (1 - k)).toFixed(2)} ${(px.dy * (1 - k)).toFixed(2)}) rotate(${(px.rot * (1 - k)).toFixed(1)} ${px.x + 8} ${px.y + 8})`);
      px.r.style.opacity = span(t, 0.4 + px.d, 0.7 + px.d);
    }
    // The rocket lifts off from the pixel cloud and lays the ribbon behind it.
    const fly = inOut(span(t, 0.9, 2.9));
    const d = fly * revLen;
    reveal.style.strokeDasharray = revLen;
    reveal.style.strokeDashoffset = revLen - d;
    const pt = reveal.getPointAtLength(Math.max(d, 0.01)), ahead = reveal.getPointAtLength(Math.min(d + 6, revLen));
    const target = fly >= 0.999 ? 42 : (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI + 90;
    if (t < 0.95) angle = target;
    angle += (((target - angle + 540) % 360) - 180) * 0.22;
    rocket.setAttribute('transform', `translate(${pt.x.toFixed(2)},${pt.y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(0.86)`);
    rocket.style.opacity = span(t, 0.8, 1.0);
    flame.style.opacity = t > 0.9 && t < 3.0 ? 0.9 : Math.max(0, 0.9 - (t - 3.0) * 2);
    flame.setAttribute('transform', `scale(1, ${(0.8 + Math.random() * 0.5).toFixed(2)})`);
    words.forEach((w, n) => {
      const k = out(span(t, 2.4 + n * 0.14, 3.2 + n * 0.14));
      w.style.opacity = k;
      w.setAttribute('transform', `translate(0 ${((1 - k) * 26).toFixed(2)})`);
    });
    bar.setAttribute('width', 198 * out(span(t, 3.0, 3.5)));
    if (t < DOCK - LOGO) requestAnimationFrame(frame);
    else dock();
  })(t0);

  // The ring and S shrink onto the nav mark; rocket, pixels and words hand over to the nav wordmark.
  function dock() {
    const mark = document.querySelector('.nav .brand-mark').getBoundingClientRect();
    const c = ringAt(), box = logo.getBoundingClientRect();
    const s = (22.5 * (mark.width / 50)) / (185 * logo.getScreenCTM().a); // nav ring: r 135 in a 300-unit box
    logo.style.transformOrigin = `${c.x - box.left}px ${c.y - box.top}px`;
    logo.style.transform = `translate(${mark.left + mark.width * 0.483 - c.x}px, ${mark.top + mark.height * 0.5 - c.y}px) scale(${s})`;
    logo.classList.add('docking');
    setTimeout(finishIntro, 900);
  }
}

/* ───────── Navigation ───────── */
function initNav() {
  const nav = $('nav'), bar = $('progress');
  onScroll((y) => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    bar.style.setProperty('--p', (y / max).toFixed(4));
    nav.classList.toggle('scrolled', y > 40);
    $('wa-float').classList.toggle('show', y > innerHeight * 0.7);
    $('explore-toggle').classList.toggle('show', y > innerHeight * 0.7);
  });

  const links = $$('.nav-links a');
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + e.target.id)));
  }), { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  const burger = $('burger'), menu = $('mob-menu');
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    menu.inert = !open;
    burger.setAttribute('aria-expanded', String(open));
    if (open) lenis?.stop(); else lenis?.start();
    document.body.style.overflow = open ? 'hidden' : '';
    (open ? $('close-mob') : burger).focus({ preventScroll: true });
  };
  burger.addEventListener('click', () => setMenu(true));
  $('close-mob').addEventListener('click', () => setMenu(false));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false); });
  matchMedia('(min-width: 1101px)').addEventListener('change', (e) => { if (e.matches && menu.classList.contains('open')) setMenu(false); });
}

/* ───────── Pointer effects: tilt with light, magnetic buttons, cursor glow ───────── */
function initPointer() {
  if (!finePointer || reduceMotion) return;
  $$('.tilt').forEach((el) => {
    let raf = 0, ev = null;
    el.addEventListener('pointermove', (e) => {
      ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
        el.classList.add('tilting');
        el.style.setProperty('--ry', ((px - 0.5) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - py) * 5).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('tilting');
      el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    });
  });

  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--tx', ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px');
      el.style.setProperty('--ty', ((e.clientY - r.top - r.height / 2) * 0.32).toFixed(1) + 'px');
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); });
  });

  const glow = $('cursor-glow');
  let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy, running = false;
  const step = () => {
    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0)`;
    running = Math.abs(tx - gx) > 0.5 || Math.abs(ty - gy) > 0.5;
    if (running) requestAnimationFrame(step);
  };
  window.addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    glow.classList.add('on');
    if (!running) { running = true; requestAnimationFrame(step); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => glow.classList.remove('on'));
}

/* ───────── FAQ ───────── */
function initFaq() {
  const buttons = $$('.faq-q');
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const open = !item.classList.contains('open');
    buttons.forEach((b) => { b.closest('.faq-item').classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
    item.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    setTimeout(() => lenis?.resize(), 750);
  }));
}

/* ───────── Contact form ───────── */
function track(name, params = {}) {
  if (typeof window.gtag === 'function') window.gtag('event', name, params);
}

function initForm() {
  const form = $('cf');
  const field = (id, msg) => {
    const fg = $(id).closest('.fg');
    fg.classList.toggle('bad', !!msg);
    fg.querySelector('.err').textContent = msg || '';
    $(id).setAttribute('aria-invalid', String(!!msg));
    return !msg;
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id) => ($(id).value || '').trim();
    const digits = v('fw').replace(/\D/g, '');
    const okName = field('fn', v('fn') ? '' : 'Please enter your name');
    const okPhone = field('fw', !v('fw') || (digits.length >= 8 && digits.length <= 15) ? '' : 'Enter a valid number, for example +91 98765 43210');
    if (!okName || !okPhone) { form.querySelector('.bad input, .bad select')?.focus(); return; }
    const lines = ['Hi SpaceGrow Media!', '', "I'd like a free audit.", '', `Name: ${v('fn')}`];
    if (v('fb')) lines.push(`Business: ${v('fb')}`);
    if (v('fw')) lines.push(`WhatsApp: ${v('fw')}`);
    if (v('fs')) lines.push(`Needs: ${v('fs')}`);
    track('generate_lead', { lead_source: 'website', cta_location: 'contact_form', service_interest: v('fs') || 'not_specified' });
    window.open(`https://wa.me/919987272788?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  });
  $$('input, select', form).forEach((el) => el.addEventListener('input', () => { if (el.closest('.bad')) field(el.id, ''); }));
}

/* ───────── Analytics (same events as v1) ───────── */
function initAnalytics() {
  const sections = { hero: 'hero_section', services: 'services_section', portfolio: 'portfolio_section', 'case-studies': 'case_studies_section', contact: 'contact_section', about: 'about_section', faq: 'faq_section' };
  const where = (el) => {
    for (const [id, label] of Object.entries(sections)) if (el.closest('#' + id)) return label;
    if (el.closest('#nav, .mob')) return 'navigation';
    if (el.closest('footer')) return 'footer';
    if (el.closest('#wa-float')) return 'floating_button';
    return 'unknown';
  };
  const platform = (u) => (u.includes('instagram.com') ? 'Instagram' : u.includes('linkedin.com') ? 'LinkedIn' : u.includes('facebook.com') ? 'Facebook' : 'Other');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const url = href.toLowerCase();
    const base = { link_url: href, link_text: (a.innerText || '').trim(), cta_location: where(a) };
    if (url.includes('wa.me')) track('click_whatsapp', base);
    else if (url.includes('calendly.com')) track('book_strategy_call', base);
    else if (url.startsWith('mailto:')) track('click_email', base);
    else if (url.includes('.pdf')) track('download_case_study', { file_name: href.split('/').pop(), link_text: base.link_text, cta_location: base.cta_location });
    else if (/instagram\.com|linkedin\.com|facebook\.com/.test(url)) track('social_click', { platform: platform(url), ...base });
    else if (url === '#services') track('service_click', base);
  });
  const seen = new Set();
  const depth = new IntersectionObserver((entries) => entries.forEach((e) => {
    const d = e.target.dataset.depth;
    if (e.isIntersecting && !seen.has(d)) { seen.add(d); track('scroll_depth', { percent_scrolled: Number(d) }); depth.unobserve(e.target); }
  }));
  $$('.depth').forEach((m) => depth.observe(m));
}

/* The whole background is touchable: grab a planet to spin it on its axis, drag empty space to look around. */
const SOLID = 'a, button, input, select, textarea, label, p, h1, h2, h3, li, blockquote, figure, img, .card, .profile, .case, .why-card, .quote, .addon, .step, .faq-list, .cf, .method, .stats, .price, .social, .pill, .badge, .nav, .mob, #wa-float, footer';
function initSpaceDrag() {
  let drag = null;
  const isSpace = (t) => t instanceof Element && !t.closest(SOLID);
  document.addEventListener('pointerdown', (e) => {
    if (!universe || e.button > 0 || (e.target instanceof Element && e.target.closest('.explore-hud button, .hud-info, .explore-btn')) || !(exploring || isSpace(e.target))) return;
    universe.grab(e.clientX, e.clientY);
    drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), touch: e.pointerType === 'touch' };
    document.documentElement.classList.add('grabbing');
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) {
      if (finePointer) document.documentElement.classList.toggle('can-grab', !!universe && isSpace(e.target));
      return;
    }
    const now = performance.now();
    const dx = e.clientX - drag.x, dy = drag.touch && !exploring ? 0 : e.clientY - drag.y;
    universe.drag(dx, dy, (now - drag.t) / 1000);
    drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
  }, { passive: true });
  const end = (e) => {
    if (!drag) return;
    const click = e && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6;
    drag = null; universe?.release(); document.documentElement.classList.remove('grabbing');
    if (click && exploring) { const name = universe.travel(e.clientX, e.clientY); if (name) departing(name); }
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  window.addEventListener('blur', end);
}

/* Explore mode: the site steps aside and space becomes free to fly. */
let exploring = false;
let hudTimer = 0;
function showHud(text) {
  const t = $('hud-msg');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => t.classList.remove('on'), 2400);
}
/* Real facts for every destination (NASA planetary fact sheets). */
const FACTS = {
  'Solar system': ['Overview', [['Planets', '8'], ['Neptune from the Sun', '30.07 AU'], ['Sunlight to Neptune', '4.2 hours']]],
  Sun: ['Star, type G2V', [['Diameter', '1,392,700 km'], ['Surface', '5,500 °C'], ['Rotation', '25 days at equator']]],
  Mercury: ['Planet', [['Diameter', '4,879 km'], ['Day', '58.6 Earth days'], ['Year', '88 days'], ['From the Sun', '0.39 AU']]],
  Venus: ['Planet', [['Diameter', '12,104 km'], ['Day', '243 days, retrograde'], ['Year', '225 days'], ['From the Sun', '0.72 AU']]],
  Earth: ['Planet, home', [['Diameter', '12,742 km'], ['Day', '23 h 56 m'], ['Year', '365.25 days'], ['From the Sun', '1.00 AU']]],
  Moon: ['Moon of Earth', [['Diameter', '3,474 km'], ['Orbit', '27.3 days'], ['From Earth', '384,400 km']]],
  Mars: ['Planet', [['Diameter', '6,779 km'], ['Day', '24 h 37 m'], ['Year', '687 days'], ['From the Sun', '1.52 AU']]],
  Jupiter: ['Gas giant', [['Diameter', '139,820 km'], ['Day', '9 h 56 m'], ['Year', '11.86 years'], ['From the Sun', '5.20 AU']]],
  Saturn: ['Gas giant', [['Diameter', '116,460 km'], ['Day', '10 h 33 m'], ['Year', '29.46 years'], ['From the Sun', '9.54 AU']]],
  Uranus: ['Ice giant', [['Diameter', '50,724 km'], ['Day', '17 h 14 m, retrograde'], ['Year', '84 years'], ['From the Sun', '19.19 AU']]],
  Neptune: ['Ice giant', [['Diameter', '49,244 km'], ['Day', '16 h 6 m'], ['Year', '164.8 years'], ['From the Sun', '30.07 AU']]],
};
/* Did-you-know: endless, non-repeating (curated first, then live from Wikipedia). */
let funName = '', funTimer = 0, funToken = 0;
async function showFun() {
  if (!funName) return;
  const token = ++funToken, el = $('hud-fun');
  el.style.opacity = '0';
  const f = await nextFact(funName);
  if (token !== funToken) return;
  setTimeout(() => {
    el.textContent = f.t;
    $('hud-fun-src').textContent = f.src ? 'Source: ' + f.src : '';
    el.style.opacity = '1';
  }, 200);
  clearTimeout(funTimer);
  funTimer = setTimeout(showFun, 12000);
}
function showInfo(name) {
  funName = name; showFun();
  const f = FACTS[name];
  if (!f) return;
  $('hud-kind').textContent = f[0];
  $('hud-name').textContent = name;
  $('hud-facts').replaceChildren(...f[1].flatMap(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; return [dt, dd]; }));
  $('hud-info').classList.add('on');
  document.querySelectorAll('[data-go]').forEach((b) => b.setAttribute('aria-current', String(b.textContent === name || (name === 'Solar system' && b.dataset.go === 'overview'))));
}
function departing(name) { $('hud-info').classList.remove('on'); showHud('Travelling to ' + name); }
let keysTimer = 0;
function flashKeys() { const k = $('hud-keys'); k.classList.remove('faded'); clearTimeout(keysTimer); keysTimer = setTimeout(() => k.classList.add('faded'), 6000); }
let teleTimer = 0;
function startTelemetry(on) {
  clearInterval(teleTimer);
  if (!on) return;
  teleTimer = setInterval(() => {
    const t = universe.telemetry();
    $('tele-au').textContent = t.au.toFixed(2) + ' AU';
    $('tele-light').textContent = (t.au * 8.317).toFixed(1) + ' light-minutes from the Sun';
  }, 200);
}

function setExplore(on) {
  if (!universe || on === exploring) return;
  exploring = on;
  universe.setExplore(on);
  universe.onArrive = showInfo;
  startTelemetry(on);
  if (on) flashKeys(); else { $('hud-info').classList.remove('on'); clearTimeout(funTimer); funName = ''; }
  const flash = $('jump-flash');
  flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
  document.documentElement.classList.toggle('exploring', on);
  $('explore-toggle').setAttribute('aria-pressed', String(on));
  $('explore-toggle').querySelector('span').textContent = on ? 'Back to site' : 'Explore space';
  if (on) { lenis?.stop(); document.body.style.overflow = 'hidden'; } else { lenis?.start(); document.body.style.overflow = ''; }
  track(on ? 'explore_open' : 'explore_close');
}
function initExplore() {
  $('explore-toggle').addEventListener('click', () => setExplore(!exploring));
  $('explore-nav').addEventListener('click', () => setExplore(true));
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const go = b.dataset.go;
    const name = go === 'overview' ? universe.overview() : universe.travelTo(go);
    if (name) departing(name);
  }));
  $('hud-help').addEventListener('click', () => flashKeys());
  $('fun-next').addEventListener('click', () => showFun());
  // Steering pauses while the pointer is over the HUD, so reaching for a button doesn't spin the view.
  document.addEventListener('pointermove', (e) => { if (universe) universe.steerHold = !!(e.target instanceof Element && e.target.closest('.hud-bodies, .hud-help, .explore-btn, .hud-panel, .hud-info')); }, { passive: true });
  $('explore-mob').addEventListener('click', () => { $('close-mob').click(); setTimeout(() => setExplore(true), 350); });
  const keyName = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  document.addEventListener('keydown', (e) => {
    if (!exploring) return;
    if (e.key === 'Escape') { setExplore(false); return; }
    universe.keys[keyName(e)] = true;
    if (/^(w|a|s|d|q|e|Arrow)/.test(keyName(e))) $('hud-info').classList.remove('on');
    universe.keys.Shift = e.shiftKey;
    if (/^(Arrow|w$|a$|s$|d$|q$|e$| $)/.test(keyName(e))) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { if (universe) { universe.keys[keyName(e)] = false; universe.keys.Shift = e.shiftKey; } });
  window.addEventListener('wheel', (e) => { if (exploring) { e.preventDefault(); universe.thrust(-e.deltaY * 0.35); } }, { passive: false });
  window.addEventListener('blur', () => { if (universe) universe.keys = {}; });
}

/* Testimonials: one quote at a time, loops on its own, pauses on hover, focus or the pause button. */
function initQuotes() {
  const root = $('tq');
  if (!root) return;
  const slides = $$('.tq-slide', root), tabs = $$('.tq-tab', root), stage = $('tq-stage'), btn = $('tq-pause');
  const DUR = 7000;
  let i = 0, t0 = performance.now(), elapsed = 0, hover = false, paused = reduceMotion;
  const show = (n, manual) => {
    const back = manual === 'back';
    root.classList.toggle('tq-back', back);
    slides[i].classList.remove('on'); slides[i].setAttribute('aria-hidden', 'true'); tabs[i].removeAttribute('aria-current');
    tabs[i].style.setProperty('--p', '0');
    i = (n + slides.length) % slides.length;
    slides[i].classList.add('on'); slides[i].removeAttribute('aria-hidden'); tabs[i].setAttribute('aria-current', 'true');
    elapsed = 0; t0 = performance.now();
    stage.setAttribute('aria-live', manual ? 'polite' : 'off');
  };
  const setPaused = (p) => {
    paused = p;
    btn.setAttribute('aria-label', p ? 'Play testimonials' : 'Pause testimonials');
    btn.innerHTML = p ? '<svg class="i" width="16" height="16" viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>' : '<svg class="i" width="16" height="16" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';
  };
  setPaused(paused);
  $('tq-next').addEventListener('click', () => show(i + 1, true));
  $('tq-prev').addEventListener('click', () => show(i - 1, 'back'));
  tabs.forEach((b) => b.addEventListener('click', () => { if (+b.dataset.i < i) root.classList.add('tq-back'); }, true));
  root.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(i + 1, true); if (e.key === 'ArrowLeft') show(i - 1, 'back'); });
  let sx = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => { if (sx === null) return; const d = e.clientX - sx; sx = null; if (Math.abs(d) > 40) (d < 0 ? show(i + 1, true) : show(i - 1, 'back')); });
  btn.addEventListener('click', () => setPaused(!paused));
  tabs.forEach((b) => b.addEventListener('click', () => show(+b.dataset.i, +b.dataset.i < i ? 'back' : true)));
  const hold = (v) => () => { hover = v; if (!v) t0 = performance.now() - elapsed; };
  root.addEventListener('pointerenter', hold(true));
  root.addEventListener('pointerleave', hold(false));
  root.addEventListener('focusin', hold(true));
  root.addEventListener('focusout', hold(false));
  (function tick(now) {
    if (paused || hover) t0 = now - elapsed; else elapsed = now - t0;
    const p = Math.min(1, elapsed / DUR);
    tabs[i].style.setProperty('--p', p.toFixed(3));
    if (p >= 1) show(i + 1, false);
    requestAnimationFrame(tick);
  })(performance.now());
}

$('year').textContent = new Date().getFullYear();
initQuotes();
initExplore();
initSpaceDrag();
initNav();
initPointer();
initFaq();
initForm();
initAnalytics();
runIntro();
