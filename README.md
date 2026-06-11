# SpaceGrow Media — Official Website

> Strategy-led digital growth partner specializing in social media management, content creation, and technology solutions.

**Live URL**: [www.spacegrowmedia.com](https://www.spacegrowmedia.com)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build Tool | [Vite](https://vitejs.dev/) 5.x |
| 3D Background | [Three.js](https://threejs.org/) 0.166 |
| Hosting | [Netlify](https://netlify.com) |
| Analytics | Google Analytics 4 |
| Fonts | Google Fonts (Syne, DM Mono) |

## Project Structure

```
spacegrow/
├── index.html              # Single-page HTML (all sections)
├── styles.css              # Production stylesheet (~394 lines)
├── app.js                  # Main application module (~407 lines)
├── space-bg.js             # Three.js solar system background
├── vite.config.js          # Build config (chunk splitting, sourcemaps)
├── netlify.toml            # Netlify deploy config (headers, redirects, caching)
├── package.json            # Dependencies & scripts
├── public/
│   ├── favicon.svg         # SVG favicon
│   ├── robots.txt          # Search engine directives
│   ├── sitemap.xml         # XML sitemap
│   ├── 404.html            # Custom 404 page
│   ├── founder.jpeg        # Founder photo (optimized)
│   ├── assets/             # Profile images for social cards
│   │   ├── ig-*.jpg        # Instagram profile photos
│   │   ├── in-*.jpg        # LinkedIn profile photos
│   │   ├── fb-*.jpg        # Facebook profile photos
│   │   └── case_studies/   # PDF case study downloads
│   └── textures/           # Planet textures for Three.js (optimized)
├── source-assets/          # Original hi-res assets (NOT deployed)
│   ├── founder_original.jpeg
│   ├── textures_original/
│   ├── screenshot.png
│   ├── screenshot_mobile.png
│   └── logo.jpg
└── dist/                   # Build output (git-ignored)
```

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (port 4173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Deployment

### Netlify (Recommended)

The site is configured for Netlify via `netlify.toml`. To deploy:

1. **Connect repo to Netlify**: Link your Git repository in the Netlify dashboard
2. **Build settings are automatic**: `netlify.toml` configures `npm run build` → `dist/`
3. **Deploy**: Push to your main branch, Netlify auto-deploys

### Custom Domain Setup

To host on `www.spacegrowmedia.com`:

1. **In Netlify Dashboard**: Go to *Site Settings → Domain Management → Add custom domain*
2. **Add both domains**:
   - `spacegrowmedia.com` (apex)
   - `www.spacegrowmedia.com` (primary)
3. **Update DNS records** at your registrar:

   | Type | Name | Value |
   |------|------|-------|
   | A | @ | `75.2.60.5` |
   | CNAME | www | `your-site-name.netlify.app` |

   *(Check Netlify's current IP addresses in your dashboard)*

4. **Enable HTTPS**: Netlify auto-provisions Let's Encrypt SSL
5. **Redirect**: `netlify.toml` already redirects apex → www

### Google Analytics

Replace `G-XXXXXXXXXX` in `index.html` (appears twice in the `<head>`) with your actual GA4 Measurement ID.

## Architecture Notes

### Performance Optimizations
- **Chunk splitting**: Three.js (~475 KB) is split into its own chunk for parallel loading
- **Lazy loading**: All below-fold images use `loading="lazy"`
- **Asset caching**: Hashed filenames with `Cache-Control: immutable` headers
- **Mobile optimizations**: Reduced star count, disabled asteroids, lower pixel ratio on mobile
- **WebGL fallback**: Three.js failure is caught gracefully — CSS grid background remains

### Security Headers (via netlify.toml)
- `Strict-Transport-Security` (HSTS with preload)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, mic, geolocation denied)

### SEO
- Structured Data (JSON-LD `ProfessionalService` schema)
- Open Graph + Twitter Card meta tags
- `robots.txt` + `sitemap.xml`
- Semantic HTML with proper heading hierarchy
- Canonical URL set to `www.spacegrowmedia.com`

## Adding Profile Images

Place profile photos in `public/assets/` with these naming conventions:
- Instagram profiles: `ig-{name}.jpg`
- LinkedIn profiles: `in-{name}.jpg`
- Facebook profiles: `fb-{name}.jpg`

Images should be square, ~200x200px, JPEG format.

## License

ISC © SpaceGrow Media
