import { initSpaceBackground } from './space-bg.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

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

$$('a,button,.svc-card,.pkg-card,.proj-card,.why-card,.testi-card,.ao-card,.faq-q').forEach((el) => {
  el.addEventListener('mouseenter', () => document.body.classList.add('hov'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('hov'));
});

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

  setTimeout(() => {

    ring.style.transition = 'stroke-dashoffset 1.2s ease-out';
    ring.style.strokeDashoffset = '0';

    setTimeout(() => triggerBurst(), 350);

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

      setTimeout(() => {
        if (logoReveal) logoReveal.classList.add('on');
      }, 1900);

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

$$('.faq-q').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const isOpen = item.classList.contains('open');
    $$('.faq-item').forEach((faqItem) => faqItem.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

function clearFormErrors() {
  $$('.fg.has-error').forEach((fg) => fg.classList.remove('has-error'));
}

function showFieldError(inputId, message) {
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

function handleContactFormSubmit() {
  clearFormErrors();
  const name = ($('fn')?.value || '').trim();
  const business = ($('fb')?.value || '').trim();
  const industry = ($('fi')?.value || '').trim();
  const goal = ($('fg2')?.value || '').trim();

  let hasError = false;
  if (!name) {
    showFieldError('fn', 'Please enter your name');
    hasError = true;
  }

  if (hasError) {
    const firstError = document.querySelector('.fg.has-error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const message = `Hi SpaceGrow Media!\n\nI'd like a free audit.\n\nName: ${name}\nBusiness: ${business}\nIndustry: ${industry}\nGoal: ${goal}`;

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'generate_lead', {
      lead_source: 'website',
      cta_location: 'contact_form',
      service_interest: industry || goal || 'not_specified'
    });
  }

  window.open(
    `https://wa.me/919987272788?text=${encodeURIComponent(message)}`,
    '_blank'
  );
}

const contactFormSubmitBtn = document.querySelector('.f-submit');
if (contactFormSubmitBtn) {
  contactFormSubmitBtn.addEventListener('click', handleContactFormSubmit);
}

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

$$('.nav-links a, .nav-cta, .mob-menu a, .nav-logo').forEach((btn) => {
  btn.addEventListener('mousedown', function () {
    this.classList.remove('morph-active');
    void this.offsetWidth; 
    this.classList.add('morph-active');
    setTimeout(() => this.classList.remove('morph-active'), 600);
  });
});

setTimeout(() => {
  try {
    initSpaceBackground();
  } catch (e) {
    console.warn('Space background initialization failed:', e);
  }
}, 3000);

function trackGA4Event(eventName, params = {}) {
  if (typeof window.gtag !== 'function') {
    console.warn('GA4 event not sent because gtag is not defined', eventName, params);
    return;
  }
  console.log('Sending GA4 event:', eventName, params);
  window.gtag('event', eventName, params);
}

function detectCtaLocation(element) {
  const sectionMap = {
    'hero':         'hero_section',
    'services':     'services_section',
    'portfolio':    'portfolio_section',
    'case-studies': 'case_studies_section',
    'contact':      'contact_section',
    'about':        'about_section',
    'faq':          'faq_section',
  };
  for (const [sectionId, label] of Object.entries(sectionMap)) {
    if (element.closest(`#${sectionId}`)) return label;
  }
  if (element.closest('nav')) return 'navigation';
  if (element.closest('footer')) return 'footer';
  if (element.id === 'wa-float' || element.closest('#wa-float')) return 'floating_button';
  return 'unknown';
}

function detectSocialPlatform(url) {
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('linkedin.com'))  return 'LinkedIn';
  if (url.includes('facebook.com'))  return 'Facebook';
  return 'Other';
}

document.addEventListener('click', function(e) {
  const anchor = e.target.closest('a');
  if (!anchor) return;

  const href = anchor.getAttribute('href') || '';
  const url = href.toLowerCase();
  const linkText = (anchor.innerText || anchor.textContent || '').trim();
  const ctaLocation = detectCtaLocation(anchor);

  if (url.includes('wa.me')) {
    trackGA4Event('click_whatsapp', { link_url: href, link_text: linkText, cta_location: ctaLocation });
  } else if (url.includes('calendly.com')) {
    trackGA4Event('book_strategy_call', { link_url: href, link_text: linkText, cta_location: ctaLocation });
  } else if (url.startsWith('mailto:')) {
    trackGA4Event('click_email', { link_url: href, link_text: linkText, cta_location: ctaLocation });
  } else if (url.includes('.pdf')) {
    trackGA4Event('download_case_study', { file_name: href.split('/').pop(), link_text: linkText, cta_location: ctaLocation });
  } else if (url.includes('instagram.com') || url.includes('linkedin.com') || url.includes('facebook.com')) {
    trackGA4Event('social_click', { platform: detectSocialPlatform(url), link_url: href, link_text: linkText, cta_location: ctaLocation });
  } else if (url === '#services') {
    trackGA4Event('service_click', { link_url: href, link_text: linkText, cta_location: ctaLocation });
  }
});

(function initScrollDepthTracking() {
  const scrollMilestones = { 50: false, 90: false };
  window.addEventListener('scroll', function onScrollDepth() {
    const scrolledPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    if (!scrollMilestones[50] && scrolledPercent >= 50) {
      scrollMilestones[50] = true;
      trackGA4Event('scroll_depth', { percent_scrolled: 50 });
    }
    if (!scrollMilestones[90] && scrolledPercent >= 90) {
      scrollMilestones[90] = true;
      trackGA4Event('scroll_depth', { percent_scrolled: 90 });
      window.removeEventListener('scroll', onScrollDepth);
    }
  }, { passive: true });
})();
