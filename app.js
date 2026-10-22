import Lenis from 'lenis';

document.documentElement.classList.add('rv');

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
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
  lenis?.start();
  bootScene();
  startReveals();
}

function runIntro() {
  const intro = $('intro');
  if (!intro || reduceMotion || store.get('sg-intro')) { intro?.remove(); return finishIntro(); }
  lenis?.stop();
  requestAnimationFrame(() => setTimeout(bootScene, 250));
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

  const trail = $('s-trail'), guide = $('s-path-guide'), rocket = $('logo-rocket'), ring = $('logo-ring');
  const burst = $('burst-canvas').getContext('2d');
  const len = guide.getTotalLength();
  trail.style.strokeDasharray = len; trail.style.strokeDashoffset = len;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const PIXELS = [[-22,8,14,'#6f5bff'],[-10,16,12,'#4f7dff'],[-30,-2,10,'#9b6bff'],[-18,20,10,'#5a63ff'],[-38,8,8,'#7f5cff'],[-28,18,8,'#3d4fd6'],[-8,26,8,'#5e7bff'],[-44,0,6,'#8f6bff'],[-36,20,6,'#3a3fb8'],[2,20,6,'#5ee7ff'],[-50,10,5,'#a07cff'],[-16,30,5,'#5b6dff'],[-42,28,4,'#4a3fc0'],[-24,34,4,'#7a6cff'],[4,30,4,'#4f9dff'],[-54,22,4,'#9b7bff']];
  let alpha = 0;
  (function paint() {
    burst.clearRect(0, 0, 420, 420);
    alpha = Math.min(1, alpha + 0.05);
    PIXELS.forEach(([ox, oy, s, c]) => { burst.globalAlpha = alpha; burst.fillStyle = c; burst.fillRect(108 + ox - s / 2, 318 + oy - s / 2, s, s); });
    if (alpha < 1 && !introDone) requestAnimationFrame(paint);
  })();

  let angle = 0, first = true;
  const place = (d) => {
    const p = guide.getPointAtLength(d), n = guide.getPointAtLength(Math.min(d + 4, len));
    const target = (Math.atan2(n.y - p.y, n.x - p.x) * 180) / Math.PI + 90;
    if (first) { angle = target; first = false; }
    let diff = target - angle;
    if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
    angle += diff * 0.16;
    rocket.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${angle})`);
    trail.style.strokeDashoffset = Math.max(0, len - d);
  };
  ring.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)';
  ring.style.strokeDashoffset = '0';
  setTimeout(() => {
    if (introDone) return;
    rocket.style.transition = 'opacity 0.3s'; rocket.style.opacity = '1'; place(0);
    const s0 = performance.now();
    (function fly(now) {
      if (introDone) return;
      const t = Math.min((now - s0) / 2000, 1);
      place(ease(t) * len);
      if (t < 1) requestAnimationFrame(fly);
    })(s0);
    setTimeout(() => { if (!introDone) $('logo-reveal').classList.add('on'); }, 1500);
    setTimeout(finishIntro, 3300);
  }, 450);
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
    if (!universe || e.button > 0 || !(exploring || isSpace(e.target))) return;
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
    if (click && exploring) { const name = universe.travel(e.clientX, e.clientY); if (name) showHud('Travelling to ' + name); }
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
function setExplore(on) {
  if (!universe || on === exploring) return;
  exploring = on;
  universe.setExplore(on);
  document.documentElement.classList.toggle('exploring', on);
  $('explore-toggle').setAttribute('aria-pressed', String(on));
  $('explore-toggle').querySelector('span').textContent = on ? 'Back to site' : 'Explore space';
  if (on) { lenis?.stop(); document.body.style.overflow = 'hidden'; } else { lenis?.start(); document.body.style.overflow = ''; }
  track(on ? 'explore_open' : 'explore_close');
}
function initExplore() {
  $('explore-toggle').addEventListener('click', () => setExplore(!exploring));
  $('explore-nav').addEventListener('click', () => setExplore(true));
  const keyName = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  document.addEventListener('keydown', (e) => {
    if (!exploring) return;
    if (e.key === 'Escape') { setExplore(false); return; }
    universe.keys[keyName(e)] = true;
    universe.keys.Shift = e.shiftKey;
    if (/^(Arrow|w$|a$|s$|d$|q$|e$| $)/.test(keyName(e))) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { if (universe) { universe.keys[keyName(e)] = false; universe.keys.Shift = e.shiftKey; } });
  window.addEventListener('wheel', (e) => { if (exploring) { e.preventDefault(); universe.thrust(-e.deltaY * 0.35); } }, { passive: false });
  window.addEventListener('blur', () => { if (universe) universe.keys = {}; });
}

$('year').textContent = new Date().getFullYear();
initExplore();
initSpaceDrag();
initNav();
initPointer();
initFaq();
initForm();
initAnalytics();
runIntro();
