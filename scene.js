import * as THREE from 'three';

/*
  SpaceGrow scene: the whole solar system.
  The Sun lights everything from the centre. All eight planets, the Moon and the asteroid belt sit where they
  really are today (mean longitudes from J2000), with true relative sizes and axial tilts. Distances are
  compressed (a^0.6) and the Sun is shrunk so the system fits; nothing else is invented. The sky is baked
  once into a cube map; there are no post-processing passes and no shader recompiles while scrolling.
*/

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const UP = new THREE.Vector3(0, 1, 0);
// Lat/long to a point on a three.js SphereGeometry (u = 0 at longitude -180).
function latLon(lat, lon) {
  const phi = ((lon + 180) / 360) * Math.PI * 2, th = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
}
const MUMBAI = latLon(19.08, 72.88);
const SUN_DIR = new THREE.Vector3(-1, 0.1, 0).normalize(); // only used to tint the baked sky

/* ───────── GLSL helpers ───────── */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*snoise(p); p*=2.03; a*=0.5; } return s; }
`;

/* Milky Way and nebula, baked once into a cube map. */
const SKY = {
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `${NOISE}
    varying vec3 vDir;
    uniform vec3 uSun;
    void main(){
      vec3 d = normalize(vDir);
      vec3 G = normalize(vec3(0.25, 1.0, 0.35));            // galactic plane normal
      float h = dot(d, G);
      float band = exp(-pow(h / 0.2, 2.0));                  // Milky Way band
      float core = exp(-pow(h / 0.07, 2.0));
      float n1 = fbm(d * 2.2);
      float n2 = fbm(d * 5.5 + 7.3);
      float dust = smoothstep(0.05, 0.55, fbm(d * 4.0 + 2.1)) * core;   // dark dust lanes
      vec3 deep = vec3(0.006, 0.009, 0.022);
      vec3 milk = vec3(0.55, 0.52, 0.62) * band * (0.22 + 0.3 * n2) + vec3(0.9, 0.78, 0.62) * core * 0.18 * (0.6 + 0.6 * n1);
      milk *= 1.0 - 0.85 * dust;
      // Two soft nebula clouds, violet and teal, away from the band.
      float neb1 = smoothstep(0.15, 0.9, fbm(d * 1.6 + 3.0)) * smoothstep(0.4, 1.0, dot(d, normalize(vec3(0.7, 0.25, -0.65))));
      float neb2 = smoothstep(0.2, 0.9, fbm(d * 1.9 - 5.0)) * smoothstep(0.35, 1.0, dot(d, normalize(vec3(-0.5, -0.3, -0.8))));
      vec3 col = deep + milk * 0.55 + vec3(0.32, 0.12, 0.5) * neb1 * 0.22 + vec3(0.05, 0.3, 0.42) * neb2 * 0.2;
      // Warm scatter around the sun's direction.
      float s = max(dot(d, uSun), 0.0);
      col += vec3(1.0, 0.75, 0.45) * pow(s, 12.0) * 0.12;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const EARTH = {
  vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>

    varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vL;
    void main(){ vUv = uv; vL = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;
#include <logdepthbuf_vertex>
 }`,
  fragmentShader: `
#include <logdepthbuf_pars_fragment>

    uniform sampler2D uDay, uNight, uSpec, uClouds; uniform vec3 uSun; uniform float uCloudShift;
    uniform vec3 uIndia, uMumbai; uniform float uTime;
    varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vL;
    void main(){
      vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP);
      float ndl = dot(n, uSun);
      float day = smoothstep(-0.12, 0.22, ndl);
      vec3 albedo = texture2D(uDay, vUv).rgb;
      vec3 lights = texture2D(uNight, vUv).rgb;
      float ocean = texture2D(uSpec, vUv).r;
      float cloudShadow = texture2D(uClouds, vUv + vec2(uCloudShift - 0.003, 0.0)).r;
      vec3 col = albedo * max(ndl, 0.0) * vec3(1.0, 0.97, 0.92) * 1.75 * (1.0 - 0.45 * cloudShadow) + albedo * 0.012;
      vec3 hv = normalize(uSun + v);
      col += vec3(1.0, 0.92, 0.8) * ocean * pow(max(dot(n, hv), 0.0), 140.0) * 0.45 * day;          // sun glint on oceans
      col += lights * vec3(1.0, 0.78, 0.48) * 1.6 * (1.0 - day) * (1.0 - cloudShadow * 0.7);       // city lights
      // India glows softly (land only), Mumbai gets a pin with an expanding ring.
      vec3 l = normalize(vL);
      float india = (1.0 - ocean) * smoothstep(0.28, 0.17, acos(clamp(dot(l, uIndia), -1.0, 1.0)));
      col += vec3(0.25, 0.72, 1.0) * india * (0.16 + 0.08 * sin(uTime * 1.6));
      float dm = acos(clamp(dot(l, uMumbai), -1.0, 1.0)), rr = fract(uTime * 0.45) * 0.09;
      col += vec3(0.45, 0.9, 1.0) * (exp(-pow((dm - rr) * 150.0, 2.0)) * (1.0 - rr / 0.09) * 1.3 + smoothstep(0.011, 0.004, dm) * 2.2);
      float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
      col = mix(col, vec3(0.32, 0.58, 1.0) * (0.2 + 0.8 * day), fres * 0.4 * smoothstep(-0.35, 0.4, ndl)); // inner haze
      
#include <logdepthbuf_fragment>
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

const CLOUDS = {
  vertexShader: EARTH.vertexShader,
  fragmentShader: `
#include <logdepthbuf_pars_fragment>

    uniform sampler2D uClouds; uniform vec3 uSun; uniform float uCloudShift;
    varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main(){
      vec3 n = normalize(vN);
      float a = texture2D(uClouds, vUv + vec2(uCloudShift, 0.0)).r;
      float ndl = dot(n, uSun);
      float lit = smoothstep(-0.1, 0.45, ndl);
      vec3 col = vec3(1.0) * (0.02 + 1.9 * max(ndl, 0.0)) + vec3(1.0, 0.55, 0.3) * 0.25 * (1.0 - abs(ndl * 3.0 - 0.15)) * step(0.0, ndl + 0.3);
      
#include <logdepthbuf_fragment>
      gl_FragColor = vec4(col, a * (0.15 + 0.85 * lit) * 0.92);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

const ATMOSPHERE = {
  vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>

    varying vec3 vN; varying vec3 vNW; varying vec3 vView;
    void main(){ vN = normalize(normalMatrix * normal); vNW = normalize(mat3(modelMatrix) * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
 }`,
  fragmentShader: `
#include <logdepthbuf_pars_fragment>

    uniform vec3 uSun; uniform vec3 uColor; uniform float uPower; uniform float uStrength;
    varying vec3 vN; varying vec3 vNW; varying vec3 vView;
    void main(){
      float rim = pow(max(0.74 - dot(vN, vView), 0.0), uPower);
      float s = smoothstep(-0.45, 0.55, dot(vNW, uSun));
      vec3 col = mix(vec3(0.02, 0.05, 0.14), uColor, s);
      
#include <logdepthbuf_fragment>
      gl_FragColor = vec4(col * rim * uStrength * (0.12 + 0.88 * s), 1.0);
    }`,
};

const STARS = {
  vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>

    attribute float aSize; attribute vec3 aColor; attribute float aTw;
    uniform float uTime; uniform float uPR;
    varying vec3 vColor; varying float vA;
    void main(){
      vColor = aColor;
      vA = 0.78 + 0.22 * sin(uTime * (0.6 + aTw * 2.4) + aTw * 60.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>

      gl_PointSize = aSize * uPR;
    }`,
  fragmentShader: `
#include <logdepthbuf_pars_fragment>

    varying vec3 vColor; varying float vA;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d); a *= a;
      
#include <logdepthbuf_fragment>
      gl_FragColor = vec4(vColor * a * vA, 1.0);
    }`,
};

const SUN = {
  vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vP; varying vec3 vN; varying vec3 vV;
    void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
 }`,
  fragmentShader: `
#include <logdepthbuf_pars_fragment>
${NOISE}
    uniform float uTime; varying vec3 vP; varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 p = normalize(vP);
      float t = uTime;
      float gran = fbm(p * 18.0 + vec3(t * 0.05, -t * 0.04, t * 0.03));
      float flow = fbm(p * 4.0 + vec3(0.0, t * 0.02, t * 0.015));
      float spots = smoothstep(0.55, 0.75, fbm(p * 2.5 + 11.0 + t * 0.004));
      float mu = clamp(dot(vN, vV), 0.0, 1.0);
      float limb = pow(mu, 0.45);
      vec3 hot = vec3(2.6, 1.9, 1.15), warm = vec3(1.9, 0.9, 0.32), deep = vec3(0.7, 0.2, 0.05);
      vec3 col = mix(warm, hot, smoothstep(-0.4, 0.6, gran * 0.7 + flow * 0.5));
      col = mix(col, deep, spots * 0.85);
      col *= mix(0.45, 1.0, limb);
      col += vec3(0.8, 0.3, 0.08) * pow(1.0 - mu, 3.0);
      
#include <logdepthbuf_fragment>
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/* Corona, flares and prominences on a camera-facing plane around the sun. */
const CORONA = {
  vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
#include <logdepthbuf_vertex>
 }`,
  fragmentShader: `
#include <logdepthbuf_pars_fragment>
${NOISE}
    uniform float uTime; uniform float uR; uniform float uFade; uniform float uProm; varying vec2 vUv;
    void main(){
      float r = length(vUv);
      float a = atan(vUv.y, vUv.x);
      float t = uTime;
      vec2 dir = vec2(cos(a), sin(a));
      float h = max(r - uR, 0.0);
      float stream = fbm(vec3(dir * 2.2, t * 0.05)) * 0.5 + 0.5;
      float corona = exp(-h * (7.0 - 3.0 * stream)) * (0.55 + 0.6 * stream);
      float fil = fbm(vec3(dir * 7.0, h * 5.0 - t * 0.35));
      float flares = pow(max(fil, 0.0), 2.4) * exp(-h * 5.5) * 3.2;
      float prom = 0.0;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float ang = fi * 1.7 + 0.6 + sin(t * 0.05 + fi) * 0.3;
        float life = 0.5 + 0.5 * sin(t * (0.18 + fi * 0.05) + fi * 2.1);
        float da = abs(atan(sin(a - ang), cos(a - ang)));
        float height = 0.06 + 0.16 * life;
        float arc = height * sqrt(max(1.0 - pow(da / 0.22, 2.0), 0.0));
        float d = abs(h - arc);
        prom += exp(-d * 60.0) * step(da, 0.22) * life * (0.6 + 0.4 * fbm(vec3(a * 12.0, h * 20.0, t * 0.6)));
      }
      float inside = smoothstep(uR - 0.01, uR + 0.005, r);
      vec3 col = vec3(1.0, 0.62, 0.3) * corona * 0.22 + vec3(1.0, 0.7, 0.4) * flares * 0.18 + vec3(1.0, 0.45, 0.2) * prom * 0.75 * uProm;
      col *= inside * smoothstep(1.0, 0.7, r) * uFade;
      
#include <logdepthbuf_fragment>
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/* Light-speed streaks: head bright, tail transparent. */
const WARP = {
  vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aHead; varying float vHead; void main(){ vHead = aHead; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
#include <logdepthbuf_vertex>
 }`,
  fragmentShader: `
#include <logdepthbuf_pars_fragment>
uniform float uAlpha; varying float vHead; void main(){ 
#include <logdepthbuf_fragment>
      gl_FragColor = vec4(vec3(0.7, 0.88, 1.0) * vHead * uAlpha, 1.0); }`,
};

/* Planet ring: texture colour and alpha, lit by the Sun, with the planet's real shadow cast across it. */
const RING = {
  vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
#include <logdepthbuf_vertex>
 }`,
  fragmentShader: `
#include <logdepthbuf_pars_fragment>

    uniform sampler2D uMap; uniform vec3 uCenter; uniform float uR; uniform float uOpacity;
    varying vec2 vUv; varying vec3 vW;
    void main(){
      vec4 t = texture2D(uMap, vUv);
      vec3 d = normalize(-vW);                       // toward the Sun at the origin
      float k = dot(uCenter - vW, d);
      float shadow = (k > 0.0 && length(vW + d * k - uCenter) < uR) ? 0.06 : 1.0;
      
#include <logdepthbuf_fragment>
      gl_FragColor = vec4(t.rgb * 1.15 * shadow, t.a * uOpacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/* ───────── helpers ───────── */
function glowTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Compressed distance: keeps the true order and spacing feel, fits Neptune in view.
const AU = (a) => 700 * Math.pow(a, 0.6);
const DEG = Math.PI / 180;
/*
  Keplerian elements at J2000 from JPL (E. M. Standish, "Keplerian Elements for Approximate Positions of
  the Major Planets"): a [AU], e, I [deg], L [deg], long. of perihelion [deg], long. of ascending node [deg],
  and L's rate [deg per century]. Poles are IAU WGCCRE right ascension and declination of the north pole.
*/
const PLANETS = [
  { name: 'Mercury', el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 149472.67411175], pole: [281.01, 61.41], spin: 0.01, r: 3.83, file: 'mercury' },
  { name: 'Venus', el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 58517.81538729], pole: [272.76, 67.16], spin: -0.004, r: 9.5, file: 'venus' },
  { name: 'Mars', el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 19140.30268499], pole: [317.68, 52.89], spin: 0.05, r: 5.32, file: 'mars' },
  { name: 'Jupiter', el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, 3034.74612775], pole: [268.05, 64.49], spin: 0.12, r: 112, file: 'jupiter' },
  { name: 'Saturn', el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, 1222.49362201], pole: [40.59, 83.54], spin: 0.11, r: 94.5, file: 'saturn', ring: [1.24, 2.27, 'saturn-ring.png', 1] },
  { name: 'Uranus', el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503, 428.48202785], pole: [257.31, -15.18], spin: -0.07, r: 40, file: 'uranus', ring: [1.64, 2.0, null, 0.22] },
  { name: 'Neptune', el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 218.45945325], pole: [299.36, 43.46], spin: 0.075, r: 38.8, file: 'neptune' },
];
const EARTH_EL = [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 35999.37244981];
const SUN_R = 220;
const EARTH_R = 10;
const OBLIQUITY = 23.43928 * DEG;

// Ecliptic (x to vernal equinox, z to ecliptic north) to three.js (y up): (x, z, -y).
const ecl = (x, y, z) => new THREE.Vector3(x, z, -y);

// Heliocentric position from Kepler's equation; E is the eccentric anomaly.
function keplerPoint(el, E) {
  const [a, e, I, , w, O] = el;
  const om = (w - O) * DEG, Om = O * DEG, inc = I * DEG;
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(inc), si = Math.sin(inc);
  const x = (co * cO - so * sO * ci) * xp + (-so * cO - co * sO * ci) * yp;
  const y = (co * sO + so * cO * ci) * xp + (-so * sO + co * cO * ci) * yp;
  const z = so * si * xp + co * si * yp;
  const v = ecl(x, y, z);
  return v.setLength(AU(v.length())); // compress distance only; direction and shape stay true
}

function planetPos(el, days) {
  const T = days / 36525;
  const L = el[3] + el[6] * T, w = el[4], e = el[1];
  let M = ((L - w) % 360) * DEG;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return keplerPoint(el, E);
}

// IAU pole (RA, Dec) in equatorial coordinates, rotated into the ecliptic frame.
function poleVector(ra, dec) {
  const r = ra * DEG, d = dec * DEG;
  const xq = Math.cos(d) * Math.cos(r), yq = Math.cos(d) * Math.sin(r), zq = Math.sin(d);
  return ecl(xq, yq * Math.cos(OBLIQUITY) + zq * Math.sin(OBLIQUITY), -yq * Math.sin(OBLIQUITY) + zq * Math.cos(OBLIQUITY)).normalize();
}
const eqToThree = (v) => ecl(v.x, v.y * Math.cos(OBLIQUITY) + v.z * Math.sin(OBLIQUITY), -v.y * Math.sin(OBLIQUITY) + v.z * Math.cos(OBLIQUITY));

/* ───────── scene ───────── */
class Universe {
  constructor(canvas) {
    this.canvas = canvas;
    this.isMobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.earthSpin = null;
    this.view = { yaw: 0, pitch: 0 };
    this.tmp = { pos: new THREE.Vector3(), look: new THREE.Vector3(), off: new THREE.Vector3(), side: new THREE.Vector3(), q: new THREE.Vector3() };
    this.pickables = [];
    this.labels = [];
    this.orbits = [];
    this.grabbed = null;
    this.explore = false;
    this.keys = {};
    this.flyVel = new THREE.Vector3();
    this.flight = null;
    this.jump = null;
    this.intro = null;
    this.ray = new THREE.Raycaster();
    this.lookM = new THREE.Matrix4();
    this.tmpQ = new THREE.Quaternion();
    this.steer = true; // any mouse or pen steers; touch never does (checked per event)
    this.labelRoot = document.getElementById('labels');
    this.clock = new THREE.Clock();
    this.time = 0;
    this.stops = [0, 0.14, 0.3, 0.46, 0.64, 0.8, 1];
    this.days = (Date.now() - Date.UTC(2000, 0, 1, 12)) / 864e5;

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 1.75));
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    this.maxAniso = r.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov(), window.innerWidth / window.innerHeight, 0.5, 60000);
    this.scene.add(this.camera);
    // Texture progress drives the intro's loading bar.
    this.loader = new THREE.TextureLoader(new THREE.LoadingManager(undefined, (url, n, total) => window.dispatchEvent(new CustomEvent('sg-load', { detail: n / total }))));

    this.buildSky();
    this.buildStars();
    this.scene.add(new THREE.PointLight(0xfff4e8, 3.4, 0, 0), new THREE.AmbientLight(0x8899ff, 0.04));
    this.buildSun();
    this.buildBelt();
    this.ready = Promise.all([this.buildEarth(), ...PLANETS.map((p) => this.buildPlanet(p))]).then(() => {
      this.buildPath();
      this.measure();
      r.compile(this.scene, this.camera); // compile every shader now, not mid-scroll
    });
    this.buildWarp();
    this.vel = 0;
    this.lastY = window.scrollY || 0;
    this.baseFov = this.fov();
    this.bind();
    r.setAnimationLoop(() => this.frame());
  }

  fov() { return window.innerWidth / window.innerHeight < 0.8 ? 58 : 38; }

  tex(url, color = true) {
    return new Promise((resolve) => {
      this.loader.load(url, (t) => {
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = Math.min(8, this.maxAniso);
        this.renderer.initTexture(t); // upload now, not on first sight
        resolve(t);
      }, undefined, () => resolve(null));
    });
  }

  res(name) { return `/textures/ss/${name}-${this.isMobile ? '1k' : '2k'}.webp`; }

  buildSky() {
    const rt = new THREE.WebGLCubeRenderTarget(this.isMobile ? 768 : 1536, { type: THREE.HalfFloatType });
    const skyScene = new THREE.Scene();
    skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), new THREE.ShaderMaterial({ ...SKY, side: THREE.BackSide, depthWrite: false, uniforms: { uSun: { value: SUN_DIR } } })));
    new THREE.CubeCamera(0.1, 100, rt).update(this.renderer, skyScene);
    this.scene.background = rt.texture;
    skyScene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  buildStars() {
    const n = this.isMobile ? 6000 : 14000;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), tw = new Float32Array(n);
    const G = new THREE.Vector3(0.25, 1, 0.35).normalize();
    const temps = [[0.62, 0.72, 1.0], [0.8, 0.86, 1.0], [1, 1, 1], [1, 0.95, 0.85], [1, 0.82, 0.62], [1, 0.68, 0.5]];
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      if (Math.random() < 0.55) v.addScaledVector(G, -v.dot(G) * (0.75 + Math.random() * 0.2)).normalize();
      v.multiplyScalar(40000);
      pos.set([v.x, v.y, v.z], i * 3);
      const t = temps[Math.min(temps.length - 1, Math.floor(Math.pow(Math.random(), 1.3) * temps.length))];
      const b = 0.35 + Math.pow(Math.random(), 3) * 1.4;
      col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
      size[i] = Math.random() < 0.015 ? 3.2 : 1.1 + Math.pow(Math.random(), 4) * 2.2;
      tw[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
    this.starMat = new THREE.ShaderMaterial({ ...STARS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uPR: { value: this.renderer.getPixelRatio() } } });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  buildSun() {
    this.sun = new THREE.Group();
    this.sunMat = new THREE.ShaderMaterial({ ...SUN, uniforms: { uTime: { value: 0 } } });
    const body = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, this.isMobile ? 64 : 128, this.isMobile ? 32 : 64), this.sunMat);
    this.coronaMat = new THREE.ShaderMaterial({ ...CORONA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uR: { value: 1 / 3.2 }, uFade: { value: 1 }, uProm: { value: 1 } } });
    this.corona = new THREE.Mesh(new THREE.PlaneGeometry(SUN_R * 6.4, SUN_R * 6.4), this.coronaMat);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture([[0, 'rgba(255,220,170,0.9)'], [0.2, 'rgba(255,150,70,0.35)'], [0.5, 'rgba(255,90,30,0.08)'], [1, 'rgba(255,60,10,0)']]),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(0.32, 0.24, 0.18),
    }));
    halo.scale.setScalar(SUN_R * 4.2);
    this.sun.add(body, this.corona, halo);
    this.scene.add(this.sun);
    this.named(body, 'Sun', SUN_R);
    body.userData.root = this.sun;
  }

  buildBelt() {
    // Asteroid belt between Mars and Jupiter (2.2-3.3 AU), one draw call.
    const n = this.isMobile ? 4000 : 9000;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = 2.2 + Math.random() * 1.1, L = Math.random() * Math.PI * 2, d = AU(a);
      pos.set([Math.cos(L) * d, (Math.random() - 0.5) * d * 0.04, -Math.sin(L) * d], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.belt = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, color: 0x9a8f80, map: glowTexture([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 32), transparent: true, depthWrite: false, opacity: 0.8 }));
    this.scene.add(this.belt);
  }

  orbitLine(el) {
    const pts = [];
    for (let i = 0; i <= 360; i++) pts.push(keplerPoint(el, (i / 360) * Math.PI * 2));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fa6ff, transparent: true, opacity: 0, depthWrite: false }));
    this.scene.add(line);
    this.orbits.push(line);
    return line;
  }

  async buildEarth() {
    const hd = !this.isMobile;
    const [day, night, spec, clouds, moonMap] = await Promise.all([
      this.tex(`/textures/hd/earth-day-${hd ? '2k' : '1k'}.webp`),
      this.tex(`/textures/hd/earth-night-${hd ? '2k' : '1k'}.webp`),
      this.tex('/textures/hd/earth-spec-1k.webp', false),
      this.tex('/textures/hd/earth-clouds-1k.webp', false),
      this.tex(this.res('moon')),
    ]);
    if (clouds) { clouds.wrapS = THREE.RepeatWrapping; clouds.needsUpdate = true; }
    const seg = this.isMobile ? 96 : 160;
    this.earth = new THREE.Group();
    this.earth.position.copy(planetPos(EARTH_EL, this.days));
    this.earthOrbit = this.orbitLine(EARTH_EL);
    this.earthOrbit.material.color.set(0x5ee7ff);
    const uniforms = { uDay: { value: day }, uNight: { value: night }, uSpec: { value: spec }, uClouds: { value: clouds }, uSun: { value: new THREE.Vector3() }, uCloudShift: { value: 0 }, uIndia: { value: latLon(22, 79) }, uMumbai: { value: MUMBAI }, uTime: { value: 0 } };
    this.earthUniforms = uniforms;
    this.earthBody = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, seg, seg / 2), new THREE.ShaderMaterial({ ...EARTH, uniforms }));
    // Real orientation: pole from the obliquity, Greenwich from sidereal time (GMST).
    const gmst = (280.46061837 + 360.98564736629 * this.days) * DEG;
    const north = eqToThree(new THREE.Vector3(0, 0, 1)).normalize();
    const greenwich = eqToThree(new THREE.Vector3(Math.cos(gmst), Math.sin(gmst), 0)).normalize();
    const east = new THREE.Vector3().crossVectors(north, greenwich);
    this.earthBody.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(greenwich, north, east.negate()));
    this.earthBody.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.008, seg, seg / 2), new THREE.ShaderMaterial({ ...CLOUDS, uniforms, transparent: true, depthWrite: false })));
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.018, 128, 64), new THREE.ShaderMaterial({
      ...ATMOSPHERE, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSun: uniforms.uSun, uColor: { value: new THREE.Color(0.35, 0.62, 1.0) }, uPower: { value: 5.5 }, uStrength: { value: 0.7 } },
    }));
    this.earth.add(this.earthBody, atmo);
    this.scene.add(this.earth);
    this.named(this.earthBody, 'Earth', EARTH_R);
    this.earthBody.userData.root = this.earth;
    const homeLabel = this.labels[this.labels.length - 1];
    homeLabel.home = true; homeLabel.el.classList.add('home'); homeLabel.el.textContent = 'Earth · Home';
    // Beacon: Earth is under a pixel wide from far away, so a soft fixed-size glow marks home.
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(160,240,255,1)'], [0.25, 'rgba(94,231,255,0.55)'], [1, 'rgba(94,231,255,0)']], 64), sizeAttenuation: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.beacon.scale.setScalar(0.045);
    this.earth.add(this.beacon);
    this.label(this.earthBody, 'Mumbai, India', MUMBAI.clone().multiplyScalar(EARTH_R * 1.01), true);

    // Moon: 0.27 Earth radii, on a compressed orbit, tidally locked.
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(2.73, 96, 48), new THREE.MeshStandardMaterial({ map: moonMap, bumpMap: moonMap, bumpScale: 0.4, roughness: 1, metalness: 0 }));
    const T = this.days;
    const moonEl = [46 / 700, 0.0549, 5.145, 218.316 + 13.176396 * T, 83.353 + 0.11140353 * T, 125.044 - 0.0529538 * T, 0];
    const mM = (moonEl[3] - moonEl[4]) * DEG;
    let mE = mM; for (let i = 0; i < 6; i++) mE -= (mE - 0.0549 * Math.sin(mE) - mM) / (1 - 0.0549 * Math.cos(mE));
    const mp = keplerPoint(moonEl, mE);
    this.moon.position.copy(mp.setLength(46 * mp.length() / AU(46 / 700)));
    this.moon.lookAt(0, 0, 0);
    this.earth.add(this.moon);
    this.named(this.moon, 'Moon', 2.73);
    this.moon.userData.pole = UP.clone();
    this.moon.userData.baseSpin = 0; // tidally locked: no spin of its own
    this.moon.userData.root = this.earth;
  }

  async buildPlanet(p) {
    const seg = p.r > 30 ? (this.isMobile ? 96 : 160) : (this.isMobile ? 64 : 112);
    const map = await this.tex(this.res(p.file));
    const holder = new THREE.Group();
    holder.position.copy(planetPos(p.el, this.days));
    const axis = new THREE.Group();
    axis.quaternion.setFromUnitVectors(UP, poleVector(...p.pole));
    const body = new THREE.Mesh(new THREE.SphereGeometry(p.r, seg, seg / 2), new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 }));
    body.rotation.y = Math.random() * Math.PI * 2;
    body.userData.baseSpin = p.spin;
    body.userData.pole = poleVector(...p.pole);
    axis.add(body);
    if (p.ring) {
      const [inR, outR, file, opacity] = p.ring;
      const ringMap = file ? await this.tex('/textures/ss/' + file) : glowTexture([[0, 'rgba(200,220,235,0)'], [0.6, 'rgba(200,220,235,0.5)'], [1, 'rgba(200,220,235,0)']], 64);
      const geo = new THREE.RingGeometry(p.r * inR, p.r * outR, 256, 1);
      const pa = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); uv.setXY(i, (v.length() - p.r * inR) / (p.r * (outR - inR)), 0.5); }
      const ring = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        ...RING, transparent: true, side: THREE.DoubleSide, depthWrite: false,
        uniforms: { uMap: { value: ringMap }, uCenter: { value: holder.position }, uR: { value: p.r }, uOpacity: { value: opacity } },
      }));
      ring.rotation.x = Math.PI / 2;
      ring.renderOrder = 1;
      axis.add(ring);
    }
    holder.add(axis);
    this.scene.add(holder);
    this.orbitLine(p.el);
    this.named(body, p.name, p.r);
    body.userData.root = holder;
    this[p.name.toLowerCase()] = body;
  }

  buildWarp() {
    const n = this.isMobile ? 140 : 260;
    this.warpN = n;
    const pos = new Float32Array(n * 6), head = new Float32Array(n * 2);
    this.warpSeeds = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rad = 3 + Math.pow(Math.random(), 0.6) * 46;
      this.warpSeeds.set([Math.cos(a) * rad, Math.sin(a) * rad, -Math.random() * 220], i * 3);
      head[i * 2] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aHead', new THREE.BufferAttribute(head, 1));
    this.warpMat = new THREE.ShaderMaterial({ ...WARP, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAlpha: { value: 0 } } });
    this.warp = new THREE.LineSegments(geo, this.warpMat);
    this.warp.frustumCulled = false;
    this.camera.add(this.warp);
  }

  // Light-speed streaks: length and brightness follow travel speed.
  updateWarp(dt, v) {
    const speed = Math.min(Math.abs(v), 9000), dirSign = v >= 0 ? 1 : -1;
    const strength = THREE.MathUtils.smoothstep(speed, 250, 3200);
    this.warpMat.uniforms.uAlpha.value = strength * 0.45;
    this.warp.visible = strength > 0.01;
    if (!this.warp.visible) return;
    const pos = this.warp.geometry.attributes.position.array, sd = this.warpSeeds;
    const travel = (60 + speed * 0.09) * dt * dirSign, len = 2 + strength * 22;
    for (let i = 0; i < this.warpN; i++) {
      const k = i * 3;
      sd[k + 2] += travel;
      if (sd[k + 2] > 2) { sd[k + 2] -= 222; const a = Math.random() * 6.2832, r = 3 + Math.pow(Math.random(), 0.6) * 46; sd[k] = Math.cos(a) * r; sd[k + 1] = Math.sin(a) * r; }
      if (sd[k + 2] < -220) sd[k + 2] += 222;
      const o = i * 6;
      pos[o] = sd[k]; pos[o + 1] = sd[k + 1]; pos[o + 2] = sd[k + 2];
      pos[o + 3] = sd[k]; pos[o + 4] = sd[k + 1]; pos[o + 5] = sd[k + 2] - len * dirSign;
    }
    this.warp.geometry.attributes.position.needsUpdate = true;
  }

  /* Camera path: one stop per page section (hero, case studies, about, services, process, FAQ, contact). */
  buildPath() {
    const portrait = window.innerWidth / window.innerHeight < 0.8;
    const stop = (obj, r, dirOverride) => {
      const c = obj.getWorldPosition(new THREE.Vector3());
      const toSun = c.clone().negate().normalize();
      const side = new THREE.Vector3().crossVectors(UP, toSun).normalize();
      const dir = dirOverride || toSun.clone().multiplyScalar(0.55).addScaledVector(side, 0.8).addScaledVector(UP, 0.18).normalize();
      const pos = c.clone().addScaledVector(dir, r * (portrait ? 4.4 : 3.1));
      const fwd = c.clone().sub(pos).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      const look = portrait ? c.clone().addScaledVector(UP, r * 1.05) : c.clone().addScaledVector(right, -r * 1.15);
      return [pos, look];
    };
    // Hero: look at Mumbai, wherever the real Earth has turned it.
    this.earth.updateMatrixWorld(true);
    const mumbaiDir = this.earthBody.localToWorld(MUMBAI.clone().multiplyScalar(EARTH_R)).sub(this.earth.position).normalize();
    // Real time of day: if India is in darkness, swing toward the Sun so India sits on the sunrise line.
    const toSun = this.earth.position.clone().negate().normalize();
    const lit = mumbaiDir.dot(toSun);
    const heroDir = mumbaiDir.clone().addScaledVector(toSun, THREE.MathUtils.clamp(0.75 - lit, 0, 1.5)).addScaledVector(UP, 0.12).normalize();
    const keys = [
      stop(this.earthBody, EARTH_R, heroDir),
      stop(this.moon, 2.73 * 1.6),
      stop(this.mars, 5.32 * 1.25),
      stop(this.jupiter, 112),
      stop(this.saturn, 94.5 * 1.5),
      stop(this.neptune, 38.8),
      stop(this.sun.children[0], SUN_R * 1.15),
    ];
    this.stopRoots = [this.earth, this.earth, this.mars.parent.parent, this.jupiter.parent.parent, this.saturn.parent.parent, this.neptune.parent.parent, this.sun];
    this.posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[0]), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, 'centripetal');
    if (!this.look) {
      this.camera.position.copy(keys[0][0]);
      this.look = keys[0][1].clone();
    }
  }

  measure() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    this.max = max;
    const marks = [...document.querySelectorAll('[data-scene]')].sort((a, b) => a.dataset.scene - b.dataset.scene);
    if (marks.length === 7) this.stops = marks.map((m, i) => (i === 0 ? 0 : i === 6 ? 1 : Math.min(1, Math.max(0, (m.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.15) / max))));
  }

  progress() { return Math.min(1, Math.max(0, (window.scrollY || 0) / (this.max || 1))); }

  curveU(p) {
    const s = this.stops;
    let i = 0;
    while (i < s.length - 2 && p > s[i + 1]) i++;
    const t = Math.min(1, Math.max(0, (p - s[i]) / Math.max(1e-4, s[i + 1] - s[i])));
    const e = t * t * t * (t * (t * 6 - 15) + 10); // lingers at each body, glides between
    return (i + e) / (s.length - 1);
  }

  bind() {
    this.ro = new ResizeObserver(() => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.fov = this.baseFov = this.fov();
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      if (this.posCurve) this.buildPath();
      this.measure();
    });
    this.ro.observe(document.documentElement);
    // Listen on every device: touchscreen laptops report "coarse" even when a mouse is plugged in.
    this.onMove = (e) => {
      if (e.pointerType === 'touch') return;
      this.mouse = true;
      this.pointer.tx = e.clientX / window.innerWidth - 0.5; this.pointer.ty = e.clientY / window.innerHeight - 0.5;
    };
    this.onLeave = () => { this.pointer.tx = this.pointer.ty = 0; };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('blur', this.onLeave);
    this.onVis = () => { this.renderer.setAnimationLoop(document.hidden ? null : () => this.frame()); this.clock.getDelta(); };
    document.addEventListener('visibilitychange', this.onVis);
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!REDUCED) this.time += dt;
    const k = (rate) => 1 - Math.exp(-rate * dt);
    const cam = this.camera;

    const y = window.scrollY || 0;
    this.vel += ((y - this.lastY) / Math.max(dt, 1e-3) - this.vel) * k(REDUCED ? 30 : 6);
    this.lastY = y;
    this.pointer.x += (this.pointer.tx - this.pointer.x) * k(2.5);
    this.pointer.y += (this.pointer.ty - this.pointer.y) * k(2.5);

    let jumpK = 0;
    if (this.jump) { const t = (performance.now() - this.jump.start) / 1400; jumpK = Math.sin(Math.min(t, 1) * Math.PI); if (t >= 1) this.jump = null; }

    let travelSpeed = 0;
    if (!this.posCurve) {
      cam.lookAt(0, 0, 0);
    } else if (this.intro) {
      this.introFrame();
    } else if (this.explore) {
      travelSpeed = this.fly(dt);
    } else {
      const u = this.curveU(this.progress());
      const targetPos = this.posCurve.getPoint(u, this.tmp.pos);
      const targetLook = this.lookCurve.getPoint(u, this.tmp.look);
      const before = this.tmp.q.copy(cam.position);
      cam.position.lerp(targetPos, REDUCED ? 1 : k(2.6));
      this.look.lerp(targetLook, REDUCED ? 1 : k(2.8));
      // Cursor parallax, scaled to how close we are to what we're looking at.
      cam.lookAt(this.look);
      travelSpeed = before.distanceTo(cam.position) / Math.max(dt, 1e-3);
      if (Math.abs(this.vel) > 60 && !this.grabbed) { const e = Math.exp(-4 * dt); this.view.yaw *= e; this.view.pitch *= e; }
      cam.rotateOnWorldAxis(UP, this.view.yaw);
      cam.rotateX(this.view.pitch);
    }

    // Warp follows how fast the camera actually moves, so long trips streak and short ones don't.
    const speed = Math.max(travelSpeed * 6, jumpK * 7000);
    if (!REDUCED) this.updateWarp(dt, this.explore ? speed : Math.sign(this.vel || 1) * speed); else this.warp.visible = false;
    const surge = REDUCED ? 0 : THREE.MathUtils.smoothstep(speed, 400, 5000);
    const fov = this.baseFov + surge * 9 + jumpK * 22;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * k(5); cam.updateProjectionMatrix(); }

    this.stars.position.copy(cam.position);
    this.corona.quaternion.copy(cam.quaternion);
    this.starMat.uniforms.uTime.value = this.time;
    this.sunMat.uniforms.uTime.value = this.time;
    this.coronaMat.uniforms.uTime.value = this.time;
    for (const o of this.orbits) o.material.opacity += ((this.explore ? (o === this.earthOrbit ? 0.55 : 0.2) : 0) - o.material.opacity) * k(3);
    if (this.beacon) {
      const far = THREE.MathUtils.smoothstep(cam.position.distanceTo(this.earth.position), 400, 1200);
      this.beacon.material.opacity = (this.explore ? far : 0) * (0.75 + 0.25 * Math.sin(this.time * 2.2));
    }

    if (this.earthBody) {
      this.earthUniforms.uSun.value.copy(this.earth.position).negate().normalize();
      if (this.earthSpin && this.grabbed !== this.earthBody) {
        const e = this.earthSpin;
        this.earthBody.rotateOnWorldAxis(e.up, e.vx * dt);
        this.earthBody.rotateOnWorldAxis(e.right, e.vy * dt);
        e.vx *= Math.exp(-1.8 * dt); e.vy *= Math.exp(-1.8 * dt);
        if (Math.abs(e.vx) + Math.abs(e.vy) < 1e-3) this.earthSpin = null;
      }
      if (!REDUCED) this.earthBody.rotateY(dt * 0.004);
      this.earthUniforms.uCloudShift.value = (this.time * 0.0016) % 1;
      this.earthUniforms.uTime.value = this.time;
    }
    for (const p of this.pickables) {
      if (p === this.earthBody || p.userData.baseSpin === undefined) continue;
      if (!REDUCED) p.rotation.y += dt * p.userData.baseSpin;
      if (p.userData.spin) { p.rotation.y += p.userData.spin * dt; p.userData.spin *= Math.exp(-1.6 * dt); }
    }

    // Site mode shows only the body being visited and the next one; explore shows the whole system.
    if (this.stopRoots) {
      const seg = Math.min(5, Math.floor(this.curveU(this.progress()) * 6 + 0.02));
      const keep = this.explore ? null : new Set([this.stopRoots[seg], this.stopRoots[seg + 1]]);
      if (keep && this.intro) keep.add(this.sun);
      for (const p of this.pickables) {
        const root = p.userData.root;
        root.visible = !keep || keep.has(root);
      }
      this.belt.visible = this.explore || seg === 2 || seg === 3;
    }
    this.updateLabels();
    this.renderer.render(this.scene, cam);
  }

  /* ───────── intro: sunrise over Earth's limb, then a glide down to the hero view ───────── */
  // sx, sy: where on screen (NDC) the Sun should rise, so the logo ring can frame it.
  sunrise(sx, sy, glideAt, glideFor) {
    this.intro = { start: performance.now(), sx, sy, glideAt, glideFor, q: new THREE.Quaternion(), q1: new THREE.Quaternion(), qh: new THREE.Quaternion() };
    this.sun.scale.setScalar(0.035); // close to the real ~0.5° Sun seen from near Earth
    this.coronaMat.uniforms.uProm.value = 0; // prominence loops are lost at this size
    this.labelRoot.style.visibility = 'hidden';
  }

  // Skipped: start the glide down to the hero now, and make it quick.
  hurryIntro() {
    const it = this.intro;
    if (!it) return;
    const t = (performance.now() - it.start) / 1000;
    if (t < it.glideAt) { it.glideAt = t; it.glideFor = 1.4; }
  }

  sunScreen() { return new THREE.Vector3().project(this.camera); }

  introFrame() {
    const it = this.intro, cam = this.camera, R = EARTH_R, E = this.earth.position;
    const t = (performance.now() - it.start) / 1000;
    const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
    // Night side, with the Sun straight behind Earth; rising along n brings it over the limb.
    const toSun = this.tmp.side.copy(E).negate().normalize();
    const n = this.tmp.q.copy(UP).addScaledVector(toSun, -UP.dot(toSun)).normalize();
    const rise = ease(t / 2.6);
    const start = this.tmp.pos.copy(E).addScaledVector(toSun, -R * (2.7 - 0.15 * rise)).addScaledVector(n, R * (0.94 + 0.16 * rise));
    // Aim so the Sun lands at (sx, sy): look straight at it, then turn by the screen offset.
    const th = Math.tan((cam.fov * Math.PI) / 360);
    this.lookM.lookAt(start, this.tmp.off.set(0, 0, 0), UP);
    it.q.setFromRotationMatrix(this.lookM).multiply(it.q1.setFromUnitVectors(this.tmp.look.set(it.sx * th * cam.aspect, it.sy * th, -1).normalize(),new THREE.Vector3(0, 0, -1)));
    const g = ease((t - it.glideAt) / it.glideFor);
    if (g <= 0) { cam.position.copy(start); cam.quaternion.copy(it.q); return; }
    // Glide round Earth (never through it) to the hero pose, easing distance in log space.
    const hero = this.posCurve.getPoint(0), heroLook = this.lookCurve.getPoint(0);
    const a = start.clone().sub(E), b = hero.clone().sub(E);
    const la = a.length(), lb = b.length();
    const dir = a.normalize().applyQuaternion(new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(a, b.clone().normalize()), g));
    cam.position.copy(E).addScaledVector(dir, Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la)) * g) * (1 + 0.25 * Math.sin(Math.PI * g)));
    this.lookM.lookAt(hero, heroLook, UP);
    cam.quaternion.copy(it.q).slerp(it.qh.setFromRotationMatrix(this.lookM), g);
    if (g >= 1) {
      this.intro = null;
      this.look.copy(heroLook);
      this.view.yaw = this.view.pitch = 0;
      this.sun.scale.setScalar(1);
      this.coronaMat.uniforms.uProm.value = 1;
      this.labelRoot.style.visibility = '';
    }
  }

  /* ───────── interaction ───────── */
  pick(x, y) {
    this.tmp.off.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1, 0);
    this.ray.setFromCamera(this.tmp.off, this.camera);
    const hit = this.ray.intersectObjects(this.pickables.filter((p) => p.userData.root?.visible !== false), false)[0];
    return hit ? hit.object : null;
  }

  // Press: grab a body to spin it on its own axis, or empty space to look around.
  grab(x, y) { this.grabbed = this.pick(x, y); if (this.grabbed?.userData.name === 'Sun') this.grabbed = null; return this.grabbed ? 'planet' : 'look'; }

  drag(dx, dy, dt) {
    const g = this.grabbed, s = Math.max(dt, 0.008);
    const camUp = this.tmp.off.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const camRight = this.tmp.side.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    if (g === this.earthBody) {
      // Free rotation like a globe in the hand: right-drag turns the face right, up-drag turns it up.
      g.rotateOnWorldAxis(camUp, dx * 0.006);
      g.rotateOnWorldAxis(camRight, dy * 0.006);
      this.earthSpin = { up: camUp.clone(), right: camRight.clone(), vx: THREE.MathUtils.clamp((dx * 0.006) / s, -4, 4), vy: THREE.MathUtils.clamp((dy * 0.006) / s, -4, 4) };
    } else if (g) {
      // Planets turn only on their own pole, in whichever direction makes the facing side follow the cursor.
      const pole = this.tmp.q.copy(g.userData.pole);
      const toCam = new THREE.Vector3().subVectors(this.camera.position, g.getWorldPosition(new THREE.Vector3())).normalize();
      const sign = Math.sign(new THREE.Vector3().crossVectors(pole, toCam).dot(camRight)) || 1;
      const a = dx * 0.006 * sign;
      g.rotation.y += a;
      g.userData.spin = THREE.MathUtils.clamp(a / s, -4, 4);
    } else {
      this.view.yaw += dx * 0.0022;
      this.view.pitch = THREE.MathUtils.clamp(this.view.pitch + dy * 0.0022, -1.35, 1.35);
    }
  }

  release() { this.grabbed = null; }

  /* ───────── explore mode ───────── */
  setExplore(on) {
    if (!REDUCED) this.jump = { start: performance.now() };
    this.explore = on;
    this.flight = null;
    this.flyVel.set(0, 0, 0);
    this.view.yaw = this.view.pitch = 0;
    if (on) this.baseQuat = this.camera.quaternion.clone();
    else this.look.copy(this.camera.position).add(this.tmp.off.set(0, 0, -50).applyQuaternion(this.camera.quaternion));
  }

  thrust(amount) { if (this.explore && !this.flight) this.flyVel.addScaledVector(this.tmp.off.set(0, 0, -1).applyQuaternion(this.camera.quaternion), amount * 3); }

  // Click a body: travel there along a gentle arc.
  travel(x, y) { const obj = this.pick(x, y); return obj ? this.travelTo(obj) : null; }

  byName(name) { return this.pickables.find((p) => p.userData.name === name); }

  // Rise above the ecliptic so the whole system, every orbit, is in view.
  overview() { return this.flyTo(new THREE.Vector3(0, 5600, 4200), new THREE.Vector3(0, 0, 0), 'Solar system'); }

  travelTo(obj) {
    if (typeof obj === 'string') obj = this.byName(obj);
    if (!obj) return null;
    obj.userData.root.visible = true;
    const target = obj.getWorldPosition(new THREE.Vector3());
    const r = obj.geometry.parameters.radius;
    const away = this.camera.position.clone().sub(target).normalize();
    return this.flyTo(target.clone().addScaledVector(away, r * 3.4), target, obj.userData.name);
  }

  // Real distance from the Sun: undo the display compression (d = 700 * a^0.6).
  telemetry() { const d = this.camera.position.length(); return { au: Math.pow(d / 700, 1 / 0.6), moving: !!this.flight || this.flyVel.length() > 5 }; }

  /*
    Flight model (after van Wijk & Nuij, "Smooth and efficient zooming and panning"):
    the gaze point eases from where you are looking to the destination, the camera's distance
    from the gaze is interpolated on a log scale (constant perceived speed) and pulled back
    mid-flight in proportion to the trip length, and the viewing direction is slerped.
  */
  flyTo(to, target, name) {
    const cam = this.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const g0 = this.gaze ? this.gaze.clone() : cam.position.clone().addScaledVector(fwd, 120);
    const d0 = Math.max(1, cam.position.distanceTo(g0));
    const d1 = Math.max(1, to.distanceTo(target));
    const dir0 = cam.position.clone().sub(g0).normalize();
    const dir1 = to.clone().sub(target).normalize();
    const sep = g0.distanceTo(target);
    const lift = Math.min(3.5, sep / (d0 + d1) * 0.35);             // how far to pull back mid-flight
    const dur = THREE.MathUtils.clamp(1.8 + 0.55 * Math.log(1 + sep / (d0 + d1)), 2.2, 5.5);
    this.flight = { g0, g1: target.clone(), d0, d1, lift, q: new THREE.Quaternion().setFromUnitVectors(dir0, dir1), dir0, start: performance.now(), dur, name, prev: cam.position.clone() };
    this.flyVel.set(0, 0, 0);
    return name;
  }

  fly(dt) {
    const cam = this.camera;
    if (this.flight) {
      const f = this.flight;
      const t = Math.min(1, (performance.now() - f.start) / (f.dur * 1000));
      const s = t * t * t * (t * (t * 6 - 15) + 10);                  // smootherstep: zero velocity at both ends
      const gaze = this.tmp.look.lerpVectors(f.g0, f.g1, THREE.MathUtils.smoothstep(t, 0.08, 0.92));
      const d = Math.exp(THREE.MathUtils.lerp(Math.log(f.d0), Math.log(f.d1), s)) * (1 + f.lift * Math.sin(Math.PI * s));
      const dir = this.tmp.off.copy(f.dir0).applyQuaternion(this.tmpQ.identity().slerp(f.q, s));
      cam.position.copy(gaze).addScaledVector(dir, d);
      cam.lookAt(gaze);
      this.gaze = gaze.clone();
      const v = f.prev.distanceTo(cam.position) / Math.max(dt, 1e-3);
      f.prev.copy(cam.position);
      if (t >= 1) { this.flight = null; this.baseQuat = cam.quaternion.clone(); this.view.yaw = this.view.pitch = 0; this.onArrive?.(f.name); }
      return v;
    }
    // Steering: the view turns toward the pointer, faster the further it is from the centre.
    // Mouse-only steering only while W (fly) or Space (look) is held; otherwise click and drag to look.
    if (false) { // mouse-slide steering removed by request: look by click and drag only
      // Small dead zone in the centre, then turn faster the further the cursor is from it.
      const dz = (v) => Math.sign(v) * Math.pow(Math.min(1, Math.max(0, Math.abs(v) - 0.04) / 0.42), 1.15);
      this.baseQuat.premultiply(this.tmpQ.setFromAxisAngle(UP, -dz(this.pointer.x) * 2.2 * dt));
      const right = this.tmp.side.set(1, 0, 0).applyQuaternion(this.baseQuat);
      this.baseQuat.premultiply(this.tmpQ.setFromAxisAngle(right, -dz(this.pointer.y) * 1.6 * dt));
    }
    cam.quaternion.copy(this.baseQuat);
    cam.rotateOnWorldAxis(UP, this.view.yaw);
    cam.rotateX(this.view.pitch);
    const k = this.keys, boost = k.Shift ? 6 : 1, acc = 500 * boost * dt;
    const fwd = this.tmp.off.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = this.tmp.side.set(1, 0, 0).applyQuaternion(cam.quaternion);
    if (k.w || k.ArrowUp) this.flyVel.addScaledVector(fwd, acc);
    if (k.s || k.ArrowDown) this.flyVel.addScaledVector(fwd, -acc);
    if (k.d || k.ArrowRight) this.flyVel.addScaledVector(right, acc);
    if (k.a || k.ArrowLeft) this.flyVel.addScaledVector(right, -acc);
    if (k.e) this.flyVel.y += acc;
    if (k.q) this.flyVel.y -= acc;
    this.flyVel.multiplyScalar(Math.exp(-1.4 * dt));
    cam.position.addScaledVector(this.flyVel, dt);
    if (this.flyVel.lengthSq() > 1) this.gaze = null;
    return this.flyVel.length();
  }

  /* ───────── labels (DOM, positioned from 3D) ───────── */
  label(obj, text, local, pin) {
    if (!this.labelRoot) return;
    const el = document.createElement('div');
    el.className = 'label3d' + (pin ? ' pin' : '');
    el.textContent = text;
    this.labelRoot.appendChild(el);
    this.labels.push({ obj, local, el, pin, on: false });
  }

  named(obj, name, r) {
    obj.userData.name = name;
    obj.userData.labelR = r;
    this.pickables.push(obj);
    this.label(obj, name, null, false);
  }

  updateLabels() {
    const cam = this.camera, w = window.innerWidth, h = window.innerHeight;
    const exploreReady = this.explore && !this.jump;
    for (const L of this.labels) {
      const p = this.tmp.pos;
      let show;
      if (L.pin) {
        p.copy(L.local);
        L.obj.localToWorld(p);
        const centre = L.obj.getWorldPosition(this.tmp.side);
        const normal = this.tmp.look.copy(p).sub(centre).normalize();
        show = normal.dot(this.tmp.side.copy(cam.position).sub(p).normalize()) > 0.15 && (exploreReady || (!this.explore && this.progress() < this.stops[1] * 0.7));
      } else {
        L.obj.getWorldPosition(p);
        p.addScaledVector(cam.up, L.obj.userData.labelR * 1.3);
        show = exploreReady;
      }
      L.depth = show ? L.obj.getWorldPosition(this.tmp.look).distanceTo(cam.position) : Infinity;
      if (show) { p.project(cam); show = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1; }
      L.want = show;
      L.x = (p.x + 1) / 2 * w; L.y = (1 - p.y) / 2 * h;
    }
    // Occlusion: a label whose body sits behind a nearer body's disc is hidden.
    const fovK = (h / 2) / Math.tan((cam.fov * Math.PI) / 360);
    const discs = [];
    for (const o of this.pickables) {
      if (o.userData.root?.visible === false) continue;
      const c = o.getWorldPosition(new THREE.Vector3()), dist = c.distanceTo(cam.position);
      const sp = c.clone().project(cam);
      if (sp.z >= 1) continue;
      discs.push({ o, dist, x: (sp.x + 1) / 2 * w, y: (1 - sp.y) / 2 * h, r: (o.geometry.parameters.radius / dist) * fovK });
    }
    for (const L of this.labels) {
      if (!L.want || L.pin) continue;
      const me = discs.find((q) => q.o === L.obj);
      if (!L.home && me && discs.some((q) => q !== me && q.dist < me.dist && Math.hypot(q.x - me.x, q.y - me.y) < q.r)) L.want = false;
    }
    // No overlapping labels: the pin and nearer bodies win, anything that would collide is hidden.
    const placed = [];
    const order = this.labels.filter((L) => L.want).sort((a, c) => (c.pin - a.pin) || ((c.home ? 1 : 0) - (a.home ? 1 : 0)) || (a.depth - c.depth));
    for (const L of this.labels) if (!L.want && L.on) { L.on = false; L.el.classList.remove('on'); }
    for (const L of order) {
      L.w ||= L.el.offsetWidth || 110;
      const box = [L.x + 6, L.y - 18, L.x + 18 + L.w, L.y + 18];
      const clash = placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]);
      if (clash) { if (L.on) { L.on = false; L.el.classList.remove('on'); } continue; }
      placed.push(box);
      if (!L.on) { L.on = true; L.el.classList.add('on'); L.w = L.el.offsetWidth || L.w; }
      L.el.style.transform = `translate3d(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px, 0)`;
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.onMove) window.removeEventListener('pointermove', this.onMove);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => {
        Object.values(m.uniforms || {}).forEach((u) => u.value?.isTexture && u.value.dispose());
        m.map?.dispose(); m.dispose();
      });
    });
    this.scene.background?.dispose?.();
    this.renderer.dispose();
  }
}

let instance = null;

export function initScene() {
  const canvas = document.getElementById('space-canvas');
  if (!canvas || instance) return Promise.resolve(null);
  try {
    instance = new Universe(canvas);
    window.addEventListener('pagehide', () => { instance?.dispose(); instance = null; });
    return instance.ready.then(() => instance);
  } catch (e) {
    console.warn('WebGL scene failed, keeping the CSS sky.', e);
    return Promise.resolve(null);
  }
}
