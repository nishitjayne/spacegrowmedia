document.documentElement.classList.add('rv');

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ───────── Reveal, counters, process steps: start once the intro is gone ───────── */
function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

function countUp(node) {
  const target = Number(node.dataset.count);
  const suffix = node.dataset.suffix || '';
  if (reduceMotion) { node.textContent = target + suffix; return; }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / 1100, 1);
    node.textContent = Math.round(target * easeOut(t)) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function startScrollEffects() {
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      reveal.unobserve(e.target);
      $$('[data-count]', e.target).forEach(countUp);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => reveal.observe(el));

  // The step nearest the middle of the viewport is the active one.
  const steps = $$('.step');
  if (steps.length) {
    const stepIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { steps.forEach((s) => s.classList.toggle('active', s === e.target)); } });
    }, { rootMargin: '-42% 0px -52% 0px' });
    steps.forEach((s) => stepIO.observe(s));
  }
}

/* ───────── Intro ───────── */
let introDone = false;
function finishIntro() {
  if (introDone) return;
  introDone = true;
  store.set('sg-intro', '1');
  const intro = $('intro');
  const site = $('site');
  site.classList.add('visible');
  if (intro) {
    if (reduceMotion) intro.remove();
    else { intro.classList.add('exit'); setTimeout(() => intro.remove(), 750); }
  }
  startScrollEffects();
  // Three.js (about 480 KB) loads only now, so it never delays the first paint or the intro.
  const boot = () => import('./space-bg.js')
    .then(({ initSpaceBackground }) => { initSpaceBackground(); $('space-canvas').classList.add('on'); })
    .catch((e) => console.warn('Space background failed:', e));
  (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(boot, { timeout: 1200 });
}

function runIntro() {
  const intro = $('intro');
  if (!intro) return finishIntro();
  if (reduceMotion || store.get('sg-intro')) { $('intro').remove(); return finishIntro(); }

  $('intro-skip').addEventListener('click', finishIntro);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') finishIntro(); });

  const canvas = $('intro-canvas');
  const ctx = canvas.getContext('2d');
  const fit = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  fit();
  const stars = Array.from({ length: 360 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    r: Math.random() * 1.2 + 0.15, a: Math.random() * 0.55 + 0.08, s: Math.random() * 0.02 + 0.005, o: Math.random() * 6.28,
  }));
  let tick = 0;
  (function draw() {
    if (introDone) return;
    tick++;
    const { width: w, height: h } = canvas;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h, 0, w / 2, h * 0.85, w * 0.55);
    glow.addColorStop(0, 'rgba(0,229,255,.055)'); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    stars.forEach((s) => {
      ctx.fillStyle = `rgba(255,255,255,${s.a * (Math.sin(tick * s.s + s.o) * 0.38 + 0.62)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
    });
    requestAnimationFrame(draw);
  })();

  const trail = $('s-trail'), guide = $('s-path-guide'), rocket = $('logo-rocket'), ring = $('logo-ring');
  const burst = $('burst-canvas').getContext('2d');
  const len = guide.getTotalLength();
  trail.style.strokeDasharray = len; trail.style.strokeDashoffset = len;

  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const PIXELS = [[-22,8,14,'#7030e0'],[-10,16,12,'#5020c0'],[-30,-2,10,'#a040f0'],[-18,20,10,'#6028d8'],[-38,8,8,'#8020d0'],[-28,18,8,'#4010b0'],[-8,26,8,'#5828cc'],[-44,0,6,'#9030e0'],[-36,20,6,'#3810a8'],[2,20,6,'#7040f0'],[-50,10,5,'#a050ff'],[-16,30,5,'#6030d0'],[-42,28,4,'#5020b0'],[-24,34,4,'#8040e8'],[4,30,4,'#4820c0'],[-54,22,4,'#9040f8']];
  let alpha = 0;
  (function paint() {
    burst.clearRect(0, 0, 420, 420);
    alpha = Math.min(1, alpha + 0.06);
    PIXELS.forEach(([ox, oy, s, c]) => { burst.globalAlpha = alpha; burst.fillStyle = c; burst.fillRect(108 + ox - s / 2, 318 + oy - s / 2, s, s); });
    burst.globalAlpha = 1;
    if (alpha < 1 && !introDone) requestAnimationFrame(paint);
  })();

  let angle = 0, first = true;
  const place = (d) => {
    const p = guide.getPointAtLength(d), n = guide.getPointAtLength(Math.min(d + 4, len));
    const target = (Math.atan2(n.y - p.y, n.x - p.x) * 180) / Math.PI + 90;
    if (first) { angle = target; first = false; }
    let diff = target - angle;
    if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
    angle += diff * 0.14;
    rocket.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${angle})`);
    trail.style.strokeDashoffset = Math.max(0, len - d);
  };

  ring.style.transition = 'stroke-dashoffset 1s ease-out';
  ring.style.strokeDashoffset = '0';
  setTimeout(() => {
    rocket.style.opacity = '1'; place(0);
    const t0 = performance.now();
    (function fly(now) {
      if (introDone) return;
      const t = Math.min((now - t0) / 2000, 1);
      place(ease(t) * len);
      if (t < 1) requestAnimationFrame(fly);
    })(t0);
    setTimeout(() => { if (!introDone) $('logo-reveal').classList.add('on'); }, 1500);
    setTimeout(finishIntro, 3000);
  }, 500);
}

/* ───────── Navigation ───────── */
function initNav() {
  const nav = $('nav');
  new IntersectionObserver(([e]) => nav.classList.toggle('scrolled', !e.isIntersecting)).observe($('top-sentinel'));

  const links = $$('.nav-links a');
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + e.target.id)));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  const burger = $('burger'), menu = $('mob-menu');
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    menu.inert = !open;
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    (open ? $('close-mob') : burger).focus();
  };
  burger.addEventListener('click', () => setMenu(true));
  $('close-mob').addEventListener('click', () => setMenu(false));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false); });
  matchMedia('(min-width: 1101px)').addEventListener('change', (e) => { if (e.matches && menu.classList.contains('open')) setMenu(false); });

  // The floating WhatsApp button appears once the hero has scrolled away.
  new IntersectionObserver(([e]) => $('wa-float').classList.toggle('show', !e.isIntersecting)).observe($('hero'));
}

/* ───────── Spotlight cards (real pointers only) ───────── */
function initSpotlight() {
  if (!canHover) return;
  $$('.spot').forEach((card) => {
    let raf = 0;
    card.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
        raf = 0;
      });
    });
  });
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

  // 50 and 90 percent scroll depth, from zero-size markers instead of a scroll listener.
  const seen = new Set();
  const depth = new IntersectionObserver((entries) => entries.forEach((e) => {
    const d = e.target.dataset.depth;
    if (e.isIntersecting && !seen.has(d)) { seen.add(d); track('scroll_depth', { percent_scrolled: Number(d) }); depth.unobserve(e.target); }
  }));
  $$('.depth').forEach((m) => depth.observe(m));
}

$('year').textContent = new Date().getFullYear();
initNav();
initSpotlight();
initFaq();
initForm();
initAnalytics();
runIntro();
