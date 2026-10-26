# SpaceGrow Media — v2

The marketing site for **SpaceGrow Media**, a Mumbai social media and growth agency, rebuilt around a real-scale 3D solar system.

**Live (v2):** https://spacegrow-v2.vercel.app
**Current production site (v1):** https://www.spacegrowmedia.com

## What it does

- **Intro:** a sunrise over Earth's limb in low orbit. The brand name rises with the Sun, then docks into the navbar in one continuous move while the camera glides down to the hero.
- **3D background:** the Sun, all eight planets, the Moon and the asteroid belt sit where they really are today (orbital elements from J2000), with true relative sizes and axial tilts. Earth's day, night, clouds and atmosphere are lit by the Sun, and a pin marks Mumbai.
- **Explore mode:** the page steps aside and space becomes free to fly. Drag, or hold Space, to look around. Scroll or W A S D to fly, Q / E to go down or up, Shift to boost, and click a planet to travel to it. Each body shows real facts and a stream of "did you know" facts.
- **Brand and social spheres:** clients and social profiles appear as glossy 3D spheres, drawn by the scene's own renderer.
- **Lead capture:** WhatsApp audit form, WhatsApp, email and Instagram links, and downloadable case studies.

## Run it

```bash
npm install
npm run dev      # http://localhost:4173
npm run build    # production build in dist/
npm run preview  # serve the build
```

Add `?intro` to the URL to replay the intro; it plays once per browser session.

## Code

| File | What's in it |
| --- | --- |
| `index.html` | All page content, SEO meta, structured data, analytics loader |
| `styles.css` | All styles: design tokens on `:root`, one section per page area, responsive and reduced-motion rules at the end |
| `app.js` | Intro, smooth scroll, reveals, nav, forms, testimonials, explore mode, analytics events |
| `scene.js` | The 3D solar system (Three.js), loaded only after the name is on screen |
| `socials.js` | The 3D brand and social spheres, loaded when their section comes near |
| `facts.js` | Explore-mode facts, loaded only in explore mode |
| `public/` | Fonts, textures (1k / 2k / 4k), images, case-study PDFs, `logo.svg` / `logo.png`, 404 page, robots and sitemap |
| `vercel.json` | Build settings, security headers, caching, `/logo` route |

## Performance

- Only 13 KB of JavaScript (gzipped) loads with the page. Three.js, the scene, the spheres and the facts each load when needed.
- All shaders compile in the background before the first 3D frame, and 4K textures swap in only while the page is still.
- The page is pre-drawn during the intro, so the hand-over from intro to page has no dropped frames.
- **Light mode** (devices with 4 or fewer cores or 4 GB or less of memory, or any device that can't hold a smooth frame rate) drops glass blur, 4K textures and the 3D spheres, and renders at 1×.
- Layout shift is zero, and fonts are self-hosted and preloaded.
- Visitors who prefer reduced motion get no intro and no animation.

## Responsive

Checked on 19 screen sizes, from a 320 px phone to a 2560 px desktop, portrait and landscape, with no sideways scrolling, clipped text, words broken mid-word or overlapping text.

## SEO

Lighthouse SEO and Accessibility are both 100. The site has:

- a title and description
- a canonical URL (pointing to www.spacegrowmedia.com)
- Open Graph and Twitter cards
- JSON-LD structured data (ProfessionalService, WebSite, FAQPage)
- `robots.txt` and `sitemap.xml`
- a single `h1` and semantic sections
- alt text and labelled controls

## Analytics

- **Google Analytics 4** (`G-4WE87CDKYL`) loads 2 s after the page and queues events until then. It tracks WhatsApp, email and strategy-call clicks, case-study downloads, social clicks, form leads (`generate_lead`), scroll depth and explore mode.
- **Vercel Web Analytics** loads on `*.vercel.app`. To switch it on, open the `spacegrow-v2` project in Vercel, go to **Analytics**, click **Enable**, then redeploy.

## Deploy

```bash
vercel deploy --prod   # project: spacegrow-v2
```

The site's logo is also served at `/logo`, `/logo.svg` and `/logo.png`.

## Credits

Planet textures: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0). Fonts: Sora, Inter, Instrument Serif, JetBrains Mono (SIL Open Font License).

© SpaceGrow Media
