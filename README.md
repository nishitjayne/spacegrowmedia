# SpaceGrow Media

> A high-performance, visually engaging marketing website for **SpaceGrow Media**, a digital growth partner and social media management agency based in Mumbai.

**Live URL**: [www.spacegrowmedia.com](https://www.spacegrowmedia.com)

---

## 🚀 About the Project

SpaceGrow Media is a digital agency specializing in Meta Ads, Website & App Development, and Content Creation (Reels & Strategy). This repository houses their official marketing website, built to showcase their services, portfolio, and "Why Us" value propositions.

The website was designed to break away from traditional "boring" agency websites by incorporating an interactive, performant 3D space-themed background. It is built as a highly optimized static single-page application (SPA) focused on speed, SEO, and lead generation.

## ✨ Core Features

- **Interactive 3D Background**: A fully responsive, animated solar system built with WebGL and Three.js, featuring rotating planets, dynamic lighting, and particle effects.
- **Premium Aesthetics**: High-contrast dark mode design with vibrant neon accents (`#00e5ff` Cyan, `#a020f0` Deep Purple, and `#ccff00` Lime) and glassmorphism elements.
- **Dynamic Integrations & Lead Generation**: 
  - Frictionless contact forms with direct WhatsApp and Calendly scheduling integrations.
  - Direct-to-Gmail optimized `mailto` links preventing OS-level mail app freezes.
  - Interactive, hover-activated social media profile cards.
- **Conversion-Optimized Copy & Trust Signals**: Focuses on hard numerical results (500k+ views), clear value propositions, and a dedicated "Brands We've Worked With" client showcase.
- **Responsive Layout**: Fluid typography, CSS Grid/Flexbox layouts, and optimized touch targets ensuring a seamless experience across desktop, tablet, and mobile devices.
- **SEO Ready**: Fully configured with `sitemap.xml`, `robots.txt`, Open Graph / Twitter meta tags, and structured JSON-LD schema data for local business visibility.

## 🏗️ Technical Architecture & Structure

The project is structured for maximum maintainability and separation of concerns:

- **Component Modularity**: While contained in a single page (`index.html`), the UI is semantically separated into distinct sections (Hero, Services, Portfolio, FAQ, Contact).
- **Decoupled 3D Logic**: The complex WebGL rendering is entirely encapsulated within `space-bg.js` via an object-oriented `SpaceScene` class, keeping the main application logic (`app.js`) clean and focused on DOM interactions.
- **Vanilla Superiority**: No heavy CSS frameworks (like Bootstrap or Tailwind) were used. The site relies on a highly specific, lightweight vanilla CSS implementation (`styles.css`) using CSS variables for theming.

## ⚡ Performance & Optimizations

Building a heavy 3D website while maintaining a 90+ Lighthouse score required aggressive optimization strategies across the entire stack.

### 1. 3D & WebGL Optimizations (The "Old" Optimizations)
- **Memory Management**: Implemented strict `dispose()` methods on all Three.js geometries, materials, and textures to prevent WebGL memory leaks during navigation or resizing.
- **Device Capability Checks**: The application dynamically scales rendering fidelity based on the device. On mobile, it reduces the star count, disables asteroid rendering, and lowers the device pixel ratio to maintain 60FPS.
- **ResizeObserver Integration**: Instead of binding to the expensive `window.resize` event, the 3D canvas uses a `ResizeObserver` to efficiently update the camera aspect ratio and renderer size only when necessary.
- **Graceful Degradation**: If WebGL initialization fails or is unsupported by the browser, the application catches the error and degrades gracefully to a static CSS-grid background without breaking the site.

### 2. Build & Asset Optimizations (The "New" Optimizations)
- **Manual Chunk Splitting**: Implemented custom Rollup configurations in Vite to separate the hefty Three.js library (`~475 KB`) into its own chunk, allowing the lightweight application logic (`~14 KB`) to load and execute in parallel.
- **Asset Hardening**: Removed ~48 MB of uncompressed source images from the production build. Replaced text-based emojis with 26 lightweight, scalable inline SVGs, saving HTTP requests and ensuring cross-device rendering consistency.
- **Dead Code Elimination**: Rigorously audited and removed over 100 lines of orphaned CSS and JavaScript, including legacy third-party iframe loaders that were blocking the main thread.
- **CSS Specificity Overhaul**: Eliminated over 30 instances of `!important` declarations by restructuring CSS selectors for natural specificity, making the codebase highly maintainable and reducing the CSS payload.

### 3. Network & Delivery Optimizations
- **Lazy Loading**: All off-screen images and assets are deferred using native `loading="lazy"`.
- **Security & Caching**: Integrated strict security headers (`HSTS`, `X-Frame-Options`, `X-Content-Type-Options`) and aggressive cache-control strategies (`immutable` for hashed Vite assets, `must-revalidate` for HTML documents).

## 🛠️ Technology Stack

- **Core**: HTML5, CSS3, Vanilla JavaScript
- **3D Graphics**: [Three.js](https://threejs.org/) (v0.166)
- **Build & Bundling**: [Vite](https://vitejs.dev/)
- **Typography**: Google Fonts (Syne, DM Mono)
- **Icons**: Custom scalable inline SVGs

## 📄 License

ISC © SpaceGrow Media
