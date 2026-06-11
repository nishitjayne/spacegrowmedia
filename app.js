/* ═══════════════════════════════════════════════════════
   SpaceGrow Media — Main Application Module
   ═══════════════════════════════════════════════════════ */

import { initSpaceBackground } from './space-bg.js';

// ── Utility: safe element query ──
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ═══════════════════════════════════════════════════════
// 1. Custom Cursor
// ═══════════════════════════════════════════════════════

const cursorDot = $('cd');
const cursorRing = $('cr');
let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

if (!isTouchDevice && cursorDot && cursorRing) {
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  (function animateCursor() {
    cursorDot.style.transform = `translate3d(calc(${mouseX}px - 50%), calc(${mouseY}px - 50%), 0)`;
    ringX += (mouseX - ringX) * 0.35;
    ringY += (mouseY - ringY) * 0.35;
    cursorRing.style.transform = `translate3d(calc(${ringX}px - 50%), calc(${ringY}px - 50%), 0)`;
    requestAnimationFrame(animateCursor);
  })();
}

// Hover state for interactive elements
$$('a,button,.svc-card,.pkg-card,.proj-card,.why-card,.testi-card,.ao-card,.faq-q').forEach((el) => {
  el.addEventListener('mouseenter', () => document.body.classList.add('hov'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('hov'));
});

// ═══════════════════════════════════════════════════════
// 2. Intro Animation — Twinkling Starfield
// ═══════════════════════════════════════════════════════

const introCanvas = $('intro-canvas');
let introCtx, introStars = [], introTime = 0;

if (introCanvas) {
  introCtx = introCanvas.getContext('2d');

  function resizeIntroCanvas() {
    introCanvas.width = innerWidth;
    introCanvas.height = innerHeight;
  }
  resizeIntroCanvas();

  function initIntroStars() {
    introStars = [];
    const width = introCanvas.width;
    const height = introCanvas.height;
    for (let i = 0; i < 450; i++) {
      introStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.2 + 0.15,
        a: Math.random() * 0.55 + 0.08,
        ts: Math.random() * 0.02 + 0.005,
        to: Math.random() * Math.PI * 2,
      });
    }
  }
  initIntroStars();

  function drawIntroStars() {
    introTime++;
    const width = introCanvas.width;
    const height = introCanvas.height;
    introCtx.clearRect(0, 0, width, height);
    introCtx.fillStyle = '#000';
    introCtx.fillRect(0, 0, width, height);

    const centerGlow = introCtx.createRadialGradient(
      width / 2, height, 0,
      width / 2, height * 0.85, width * 0.55
    );
    centerGlow.addColorStop(0, 'rgba(0,229,255,.055)');
    centerGlow.addColorStop(0.5, 'rgba(0,229,255,.015)');
    centerGlow.addColorStop(1, 'transparent');
    introCtx.fillStyle = centerGlow;
    introCtx.fillRect(0, 0, width, height);

    introStars.forEach((star) => {
      const twinkle = Math.sin(introTime * star.ts + star.to) * 0.38 + 0.62;
      introCtx.fillStyle = `rgba(255,255,255,${star.a * twinkle})`;
      introCtx.beginPath();
      introCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      introCtx.fill();
    });

    if ($('intro')) requestAnimationFrame(drawIntroStars);
  }
  drawIntroStars();
}

// ═══════════════════════════════════════════════════════
// 3. Intro Animation — Logo, Rocket, Ring
// ═══════════════════════════════════════════════════════

const introScreen = $('intro');
const logoReveal = $('logo-reveal');
const mainSite = $('site');
const trail = $('s-trail');
const guide = $('s-path-guide');
const rocket = $('logo-rocket');
const burstCanvas = $('burst-canvas');
const ring = $('logo-ring');

if (introScreen && trail && guide && rocket && burstCanvas && ring) {
  const burstCtx = burstCanvas.getContext('2d');
  const totalLen = guide.getTotalLength();
  trail.style.strokeDasharray = totalLen;
  trail.style.strokeDashoffset = totalLen;

  function easeInOut(x) {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }

  const IGNITION_X = 108;
  const IGNITION_Y = 318;
  const PIXEL_CLUSTER = [
    { ox: -22, oy: 8, s: 14, c: '#7030e0' },
    { ox: -10, oy: 16, s: 12, c: '#5020c0' },
    { ox: -30, oy: -2, s: 10, c: '#a040f0' },
    { ox: -18, oy: 20, s: 10, c: '#6028d8' },
    { ox: -38, oy: 8, s: 8, c: '#8020d0' },
    { ox: -28, oy: 18, s: 8, c: '#4010b0' },
    { ox: -8, oy: 26, s: 8, c: '#5828cc' },
    { ox: -44, oy: 0, s: 6, c: '#9030e0' },
    { ox: -36, oy: 20, s: 6, c: '#3810a8' },
    { ox: 2, oy: 20, s: 6, c: '#7040f0' },
    { ox: -50, oy: 10, s: 5, c: '#a050ff' },
    { ox: -16, oy: 30, s: 5, c: '#6030d0' },
    { ox: -42, oy: 28, s: 4, c: '#5020b0' },
    { ox: -24, oy: 34, s: 4, c: '#8040e8' },
    { ox: 4, oy: 30, s: 4, c: '#4820c0' },
    { ox: -54, oy: 22, s: 4, c: '#9040f8' },
  ];
  let burstAlpha = 0;
  let burstPhase = 'in';

  function drawPixelCluster() {
    burstCtx.clearRect(0, 0, burstCanvas.width, burstCanvas.height);
    if (burstPhase === 'in') {
      burstAlpha = Math.min(1, burstAlpha + 0.06);
      if (burstAlpha >= 1) burstPhase = 'hold';
    }
    PIXEL_CLUSTER.forEach((pixel) => {
      burstCtx.globalAlpha = burstAlpha;
      burstCtx.fillStyle = pixel.c;
      burstCtx.fillRect(
        IGNITION_X + pixel.ox - pixel.s / 2,
        IGNITION_Y + pixel.oy - pixel.s / 2,
        pixel.s,
        pixel.s
      );
    });
    burstCtx.globalAlpha = 1;
    if (burstPhase === 'in') requestAnimationFrame(drawPixelCluster);
  }

  function triggerBurst() {
    burstAlpha = 0;
    burstPhase = 'in';
    drawPixelCluster();
  }

  let currentAngle = 0;
  let isFirstPoint = true;

  function placeRocket(distance) {
    const point = guide.getPointAtLength(distance);
    const nextPoint = guide.getPointAtLength(Math.min(distance + 4, totalLen));
    const targetAngle =
      (Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * 180) / Math.PI + 90;

    if (isFirstPoint) {
      currentAngle = targetAngle;
      isFirstPoint = false;
    }
    let angleDiff = targetAngle - currentAngle;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    currentAngle += angleDiff * 0.14;

    rocket.setAttribute(
      'transform',
      `translate(${point.x},${point.y}) rotate(${currentAngle})`
    );
    trail.style.strokeDashoffset = Math.max(0, totalLen - distance);
  }

  // Start animation sequence
  setTimeout(() => {
    // Phase 1 — circle ring draws in
    ring.style.transition = 'stroke-dashoffset 1.2s ease-out';
    ring.style.strokeDashoffset = '0';

    // Phase 2 — pixel cluster appears
    setTimeout(() => triggerBurst(), 350);

    // Phase 3 — rocket flies along S-curve trail
    setTimeout(() => {
      rocket.style.transition = 'opacity 0.15s';
      rocket.style.opacity = '1';
      placeRocket(0);

      const FLIGHT_DURATION = 2600;
      const startTime = performance.now();

      function fly(now) {
        let progress = Math.min((now - startTime) / FLIGHT_DURATION, 1);
        placeRocket(easeInOut(progress) * totalLen);
        if (progress < 1) requestAnimationFrame(fly);
      }
      requestAnimationFrame(fly);

      // Phase 4 — brand name fades in mid-flight
      setTimeout(() => {
        if (logoReveal) logoReveal.classList.add('on');
      }, 1900);

      // Phase 5 — transition to main site
      setTimeout(() => {
        if (mainSite) {
          mainSite.style.display = 'block';
          requestAnimationFrame(() =>
            requestAnimationFrame(() => mainSite.classList.add('visible'))
          );
        }
        introScreen.classList.add('exit');
        setTimeout(() => introScreen.remove(), 900);
      }, 3900);
    }, 700);
  }, 0);
}

// ═══════════════════════════════════════════════════════
// 4. Navigation
// ═══════════════════════════════════════════════════════

const nav = $('nav');
if (nav) {
  window.addEventListener(
    'scroll',
    () => nav.classList.toggle('scrolled', scrollY > 60),
    { passive: true }
  );
}

const burger = $('burger');
const mobMenu = $('mob-menu');
const closeMob = $('close-mob');

if (burger && mobMenu) {
  burger.addEventListener('click', () => mobMenu.classList.add('open'));
}
if (closeMob && mobMenu) {
  closeMob.addEventListener('click', () => mobMenu.classList.remove('open'));
}
$$('.ml').forEach((link) => {
  link.addEventListener('click', () => {
    if (mobMenu) mobMenu.classList.remove('open');
  });
});

// ═══════════════════════════════════════════════════════
// 5. Scroll Animations (IntersectionObserver)
// ═══════════════════════════════════════════════════════

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const siblings = [...entry.target.parentElement.querySelectorAll('.fade-up')];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('in'), idx * 90);
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
);
$$('.fade-up').forEach((el) => observer.observe(el));

// ═══════════════════════════════════════════════════════
// 6. FAQ Accordion
// ═══════════════════════════════════════════════════════

$$('.faq-q').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const isOpen = item.classList.contains('open');
    $$('.faq-item').forEach((faqItem) => faqItem.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// ═══════════════════════════════════════════════════════
// 7. Contact Form — Validation + WhatsApp Submit
// ═══════════════════════════════════════════════════════

function clearErrors() {
  $$('.fg.has-error').forEach((fg) => fg.classList.remove('has-error'));
}

function showError(inputId, message) {
  const input = $(inputId);
  if (!input) return;
  const fg = input.closest('.fg');
  if (!fg) return;
  fg.classList.add('has-error');
  let errorEl = fg.querySelector('.form-error');
  if (!errorEl) {
    errorEl = document.createElement('span');
    errorEl.className = 'form-error';
    fg.appendChild(errorEl);
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function submitForm() {
  clearErrors();
  const name = ($('fn')?.value || '').trim();
  const business = ($('fb')?.value || '').trim();
  const industry = ($('fi')?.value || '').trim();
  const goal = ($('fg2')?.value || '').trim();

  let hasError = false;
  if (!name) {
    showError('fn', 'Please enter your name');
    hasError = true;
  }

  if (hasError) {
    const firstError = document.querySelector('.fg.has-error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const message = `Hi SpaceGrow Media!\n\nI'd like a free audit.\n\nName: ${name}\nBusiness: ${business}\nIndustry: ${industry}\nGoal: ${goal}`;
  window.open(
    `https://wa.me/919987272788?text=${encodeURIComponent(message)}`,
    '_blank'
  );
}

// Bind submit button via DOM query instead of inline onclick
const submitBtn = document.querySelector('.f-submit');
if (submitBtn) {
  submitBtn.addEventListener('click', submitForm);
}

// ═══════════════════════════════════════════════════════
// 8. Smooth Scroll for Anchor Links
// ═══════════════════════════════════════════════════════

$$('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ═══════════════════════════════════════════════════════
// 9. Nav Morph Animation
// ═══════════════════════════════════════════════════════

$$('.nav-links a, .nav-cta, .mob-menu a, .nav-logo').forEach((btn) => {
  btn.addEventListener('mousedown', function () {
    this.classList.remove('morph-active');
    void this.offsetWidth; // Force reflow to restart animation
    this.classList.add('morph-active');
    setTimeout(() => this.classList.remove('morph-active'), 600);
  });
});





// ═══════════════════════════════════════════════════════
// 12. Space Background — Delayed Init
// ═══════════════════════════════════════════════════════

// Initialize WebGL at 3000ms — after rocket animation, before screen transition.
// Hides heavy GPU init so the intro animation doesn't stutter.
setTimeout(() => {
  try {
    initSpaceBackground();
  } catch (e) {
    console.warn('Space background initialization failed:', e);
  }
}, 3000);
