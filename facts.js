/* Did-you-know facts. A hand-checked set per body (NASA, ESA and IAU figures), then live sentences
   from the Wikipedia article for that body, so the card keeps going without repeating. */

const FACTS = {
  'Solar system': [
    'The solar system formed about 4.6 billion years ago from a collapsing cloud of gas and dust.',
    'The Sun carries the whole solar system around the Milky Way roughly once every 230 million years.',
    'All the asteroids in the main belt put together weigh only about 3% as much as our Moon.',
    'Voyager 1, launched in 1977, is the most distant human-made object, more than 160 AU from the Sun.',
    'All eight planets orbit the Sun in the same direction, a leftover from the spinning disc they formed in.',
    'The Sun holds 99.86% of the mass of the solar system; Jupiter has most of the rest.',
    'Sunlight takes about 4 hours to reach Neptune and over a year to reach the inner edge of the Oort Cloud.',
    'Pluto was reclassified as a dwarf planet by the International Astronomical Union in 2006.',
    'The Kuiper Belt beyond Neptune holds icy worlds such as Pluto, Haumea, Makemake and Arrokoth.',
    'The solar system moves through the Milky Way at roughly 230 kilometres per second.',
    'Every planet except Mercury and Venus has at least one moon.',
    'The heliosphere, the bubble blown by the solar wind, extends well beyond the orbit of Pluto.',
  ],
  Sun: [
    'The Sun holds 99.86% of all the mass in the solar system.',
    'Sunlight takes about 8 minutes 20 seconds to reach Earth.',
    'About 1.3 million Earths could fit inside the Sun.',
    'Its core is around 15 million °C, where hydrogen fuses into helium.',
    'The Sun turns about 600 million tonnes of hydrogen into helium every second.',
    'Light made in the core can take tens of thousands of years to work its way out to the surface.',
    'The Sun spins faster at its equator (about 25 days) than near its poles (about 35 days).',
    'The corona, the Sun’s outer atmosphere, is over a million degrees, far hotter than the surface.',
    'The Sun’s magnetic field flips roughly every 11 years, driving the cycle of sunspots.',
    'The Sun is about halfway through its life; it will swell into a red giant in about 5 billion years.',
    'The solar wind streams out at around 400 kilometres per second.',
    'The Sun is a fairly ordinary yellow dwarf star, classed G2V.',
  ],
  Mercury: [
    'Temperatures swing from about 430 °C by day to -180 °C at night.',
    'One full day-night cycle on Mercury (176 Earth days) lasts two of its years.',
    'Mercury is slowly shrinking as its iron core cools, wrinkling its surface into long cliffs.',
    'It has no moons and almost no atmosphere.',
    'Mercury is the smallest planet, only a little larger than our Moon.',
    'Its iron core takes up about 85% of the planet’s radius.',
    'Despite being closest to the Sun, there is water ice in permanently shadowed craters at its poles.',
    'Mercury is the fastest planet, orbiting the Sun at about 47 kilometres per second.',
    'Its huge Caloris Basin is about 1,550 kilometres wide.',
    'NASA’s MESSENGER orbited Mercury from 2011 to 2015; ESA and JAXA’s BepiColombo is on its way.',
    'Seen from Mercury, the Sun can appear to stop, move backwards, then carry on across the sky.',
    'Mercury’s orbit is the most elongated of all the planets.',
  ],
  Venus: [
    'Venus is the hottest planet, around 465 °C, hotter than Mercury.',
    'A day on Venus is longer than its year.',
    'It spins backwards, so the Sun rises in the west there.',
    'The air pressure at the surface is about 92 times Earth’s, like being 900 metres under the sea.',
    'Its thick clouds are made largely of sulfuric acid droplets.',
    'Venus is the brightest natural object in the night sky after the Moon.',
    'Venus is almost the same size as Earth, which is why it is called Earth’s twin.',
    'The Soviet Venera 7 made the first successful landing on another planet, on Venus in 1970.',
    'Venus has no moons.',
    'Its upper atmosphere races around the planet in about four days, far faster than the planet turns.',
    'The surface is covered in volcanic plains and has more volcanoes than any other planet.',
    'Venus comes closer to Earth than any other planet does.',
  ],
  Earth: [
    'Earth is the only place we know of with life.',
    'About 71% of the surface is covered by water.',
    'Earth is the densest planet in the solar system.',
    'Our days are getting longer by roughly 1.7 milliseconds per century as the Moon slows Earth’s spin.',
    'Earth’s magnetic field shields the surface from most of the solar wind.',
    'Earth is slightly flattened: it is about 43 kilometres wider at the equator than pole to pole.',
    'The deepest known point, the Challenger Deep, is nearly 11 kilometres below sea level.',
    'Earth orbits the Sun at about 30 kilometres per second.',
    'Earth is closest to the Sun in early January, not in northern summer.',
    'The seasons come from Earth’s 23.4° tilt, not from its distance to the Sun.',
    'Earth’s atmosphere is about 78% nitrogen and 21% oxygen.',
    'Mumbai, home of SpaceGrow Media, sits on the west coast of India at about 19° north.',
  ],
  Moon: [
    'The Moon always shows us the same face because it is tidally locked to Earth.',
    'The far side is not dark: it gets just as much sunlight. Drag the Moon to turn it and see it.',
    'The Moon drifts about 3.8 cm farther from Earth every year.',
    'Twelve people have walked on the Moon, all between 1969 and 1972.',
    'The Moon is thought to have formed from debris after a Mars-sized body hit the early Earth.',
    'Its gravity is about one sixth of Earth’s.',
    'The Moon’s pull is the main cause of Earth’s ocean tides.',
    'Moonquakes can last for up to an hour.',
    'China’s Chang’e 4 made the first soft landing on the far side, in 2019.',
    'The Moon has almost no atmosphere, so footprints left by astronauts could last for millions of years.',
    'The Moon is about 384,400 kilometres away on average.',
    'The dark patches we see are ancient lava plains called maria.',
  ],
  Mars: [
    'Olympus Mons on Mars is about 22 km tall, roughly two and a half times Mount Everest.',
    'Sunsets on Mars look blue.',
    'Mars has two small moons, Phobos and Deimos.',
    'Dust storms can grow to cover the whole planet for weeks.',
    'Mars is red because its surface is rich in iron oxide, or rust.',
    'Valles Marineris is a canyon system about 4,000 kilometres long.',
    'Gravity on Mars is about 38% of Earth’s.',
    'Mars has polar ice caps of water ice topped with frozen carbon dioxide.',
    'A day on Mars, called a sol, lasts 24 hours 37 minutes.',
    'NASA’s Ingenuity helicopter made the first powered flight on another planet, on Mars in 2021.',
    'India’s Mangalyaan reached Mars orbit on its first attempt in 2014.',
    'Phobos is slowly spiralling toward Mars and will break apart in tens of millions of years.',
  ],
  Jupiter: [
    'The Great Red Spot is a storm wider than Earth that has raged for centuries.',
    'About 1,300 Earths could fit inside Jupiter.',
    'Jupiter has the shortest day of any planet: under 10 hours.',
    'It has more than 90 known moons, including Ganymede, the largest moon in the solar system.',
    'Jupiter is more than twice as massive as all the other planets combined.',
    'Its moon Io is the most volcanically active body known.',
    'Europa, another of its moons, hides a salty ocean beneath its ice.',
    'Jupiter has faint rings, discovered by Voyager 1 in 1979.',
    'Its magnetic field is about 20,000 times stronger than Earth’s.',
    'Jupiter’s auroras are hundreds of times more energetic than Earth’s.',
    'Galileo spotted Jupiter’s four largest moons in 1610.',
    'NASA’s Juno spacecraft has been orbiting Jupiter since 2016.',
  ],
  Saturn: [
    'Saturn is less dense than water: in a big enough bath, it would float.',
    'Its rings are mostly ice and span about 280,000 km, yet are often only about 10 m thick.',
    'Saturn has the most known moons of any planet, more than 140.',
    'Its moon Titan has lakes and rivers of liquid methane.',
    'A six-sided jet stream, the hexagon, circles Saturn’s north pole.',
    'Titan is the only moon with a thick atmosphere.',
    'Plumes of water spray from geysers on its moon Enceladus.',
    'Saturn’s rings may be much younger than the planet itself.',
    'Saturn’s winds reach about 1,800 kilometres per hour.',
    'Cassini orbited Saturn for 13 years before diving into it in 2017.',
    'Huygens landed on Titan in 2005, the most distant landing ever made.',
    'Every 13 to 15 years the rings line up edge-on to Earth and almost vanish.',
  ],
  Uranus: [
    'Uranus is tilted about 98°, so it rolls around the Sun on its side.',
    'Each pole gets about 42 years of sunlight followed by 42 years of darkness.',
    'It has the coldest atmosphere of any planet, down to -224 °C.',
    'It was the first planet found with a telescope, by William Herschel in 1781.',
    'Methane in its atmosphere absorbs red light, giving Uranus its blue-green colour.',
    'Uranus has 13 known rings.',
    'Its moons are named after characters from Shakespeare and Alexander Pope.',
    'Voyager 2 is the only spacecraft to have visited Uranus, in 1986.',
    'Uranus spins backwards compared with most planets.',
    'Its moon Miranda has cliffs about 20 kilometres high.',
    'One year on Uranus lasts 84 Earth years.',
    'Uranus is an ice giant, made mostly of water, methane and ammonia ices around a small rocky core.',
  ],
  Neptune: [
    'Neptune has the fastest winds in the solar system, about 2,100 km/h.',
    'It was predicted with mathematics before anyone saw it, in 1846.',
    'One Neptune year is 165 Earth years: it finished its first orbit since discovery in 2011.',
    'Its moon Triton orbits backwards and is slowly spiralling inward.',
    'Triton has geysers that shoot nitrogen gas several kilometres high.',
    'Voyager 2 is the only spacecraft to have visited Neptune, in 1989.',
    'Neptune radiates more than twice as much energy as it receives from the Sun.',
    'Voyager 2 saw a Great Dark Spot, a storm about the size of Earth, which later disappeared.',
    'Neptune has 5 main rings, named after astronomers who studied the planet.',
    'It is the farthest planet from the Sun, about 4.5 billion kilometres away.',
    'Neptune is about 17 times as massive as Earth.',
    'Its blue colour comes from methane in its atmosphere.',
  ],
};

const WIKI = { 'Solar system': 'Solar System', Mercury: 'Mercury (planet)' }; // article titles that differ from the name
const wikiCache = {};

// Sentences from the Wikipedia article that stand on their own: right length, no references or formulas.
async function wikiFacts(name) {
  if (wikiCache[name]) return wikiCache[name];
  wikiCache[name] = (async () => {
    try {
      const url = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&format=json&origin=*&titles=' + encodeURIComponent(WIKI[name] || name);
      const res = await fetch(url);
      const page = Object.values((await res.json()).query.pages)[0];
      return (page.extract || '')
        .split('\n').filter((l) => !/^\s*=/.test(l)).join(' ')
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 70 && s.length < 240 && /[a-z]/.test(s) && !/[{}=\[\]^]|\b(It|This|These|They|Its|He|She|Such|However|Thus|Also)\b/.test(s.split(' ')[0]) && !/displaystyle|ISBN|doi|et al/.test(s));
    } catch {
      return [];
    }
  })();
  return wikiCache[name];
}

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const decks = {};

/* Next fact for a body: curated ones first (shuffled), then Wikipedia's; nothing repeats until all are used. */
export async function nextFact(name) {
  const d = (decks[name] ||= { queue: shuffle(FACTS[name].map((t) => ({ t, src: '' }))), seen: new Set(), wiki: false });
  if (!d.queue.length) {
    if (!d.wiki) {
      d.wiki = true;
      const extra = (await wikiFacts(name)).filter((t) => !d.seen.has(t));
      d.queue = shuffle(extra.map((t) => ({ t, src: 'Wikipedia' })));
    }
    if (!d.queue.length) { d.seen.clear(); d.wiki = false; d.queue = shuffle(FACTS[name].map((t) => ({ t, src: '' }))); }
  }
  const f = d.queue.shift();
  d.seen.add(f.t);
  return f;
}
