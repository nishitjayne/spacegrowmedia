# SpaceGrow Media

> A high-performance, visually engaging marketing website for **SpaceGrow Media**, a digital growth partner and social media management agency based in Mumbai.

**Live URL**: [www.spacegrowmedia.com](https://www.spacegrowmedia.com)

---

## 🚀 About the Project

SpaceGrow Media is a digital agency specializing in Meta Ads, Website & App Development, and Content Creation (Reels & Strategy). This repository houses their official marketing website, built to showcase their services, portfolio, and "Why Us" value propositions.

The website was designed to break away from traditional "boring" agency websites by incorporating an interactive, performant 3D space-themed background. It is built as a highly optimized static site focused on speed, SEO, and lead generation.

## ✨ Key Features

- **Interactive 3D Background**: A fully responsive, animated solar system built with WebGL and Three.js, featuring rotating planets, dynamic lighting, and particle effects.
- **Premium Aesthetics**: High-contrast dark mode design with vibrant neon accents (Cyan, Deep Purple, and Lime).
- **Responsive Layout**: Fluid typography, CSS Grid/Flexbox layouts, and optimized touch targets for mobile devices.
- **Dynamic Integrations**: 
  - Direct WhatsApp lead generation integration.
  - Hover-activated social media profile cards.
- **Production-Ready Performance**:
  - Code splitting and chunking (Three.js is loaded in parallel).
  - Lazy-loaded assets and WebP/optimized imagery.
  - Highly specific, lightweight vanilla CSS.
- **SEO Optimized**: Fully configured with `sitemap.xml`, `robots.txt`, Open Graph / Twitter meta tags, and structured JSON-LD schema data.

## ⚡ How We Optimized It

To transition this project from a prototype to a production-grade application, several rigorous engineering optimizations were applied:

1. **Dead Code Elimination**: 
   - Removed over 100 lines of orphaned CSS and JavaScript, including legacy third-party social embed loaders (SociableKit/Elfsight).
2. **Asset Hardening**: 
   - Replaced text-based emojis with 26 lightweight, scalable inline SVGs, saving HTTP requests and ensuring cross-device consistency.
   - Removed ~48 MB of uncompressed source images from the production build.
3. **CSS Specificity Overhaul**: 
   - Eliminated over 30 instances of `!important` declarations by restructuring CSS selectors for natural specificity, making the codebase highly maintainable.
4. **Vite Build Configuration**: 
   - Implemented manual rollup chunking to separate the hefty Three.js library (`~475 KB`) from the lightweight application logic (`~14 KB`).
5. **Security & Caching**: 
   - Integrated strict security headers (`HSTS`, `X-Frame-Options`, `X-Content-Type-Options`) and aggressive cache-control strategies (`immutable` for hashed assets).

## 🛠️ Technology Stack

- **Core**: HTML5, CSS3, Vanilla JavaScript
- **3D Graphics**: [Three.js](https://threejs.org/) (v0.166)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Typography**: Google Fonts (Syne, DM Mono)
- **Icons**: Custom scalable inline SVGs

## 📦 Project Structure

- **`index.html`**: The main entry point containing all semantic sections (Hero, Services, Portfolio, Contact).
- **`styles.css`**: The global stylesheet encompassing the design system, hover animations, and responsive breakpoints.
- **`app.js`**: The core application logic, handling UI interactions, scroll animations (`IntersectionObserver`), and contact forms.
- **`space-bg.js`**: The dedicated Three.js module responsible for rendering and animating the 3D background.

## 📄 License

ISC © SpaceGrow Media
