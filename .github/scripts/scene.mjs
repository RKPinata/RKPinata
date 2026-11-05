// The space backdrop of the profile header, in two layers:
//   sceneSvg()  – Milky Way gas, dust lanes, moon and a gas giant lit from the upper left. Its noise
//                 filters are too heavy to redraw on every animation frame, so it is rendered once
//                 to assets/scene.jpg (see render-scene.mjs) and embedded as an image.
//   starLayer() – the stars, kept as vectors so they stay sharp. The same seed draws the same sky.

export const SCENE_W = 1200;
export const SCENE_H = 900;
export const PLANET = { x: 1160, y: 110, r: 250 };

const f = (n) => Math.round(n * 10) / 10;

// Milky Way axis: from the lower left of the header area to the upper right.
const AXIS = [0, 720, 1200, 40];
const [ax, ay, bx, by] = AXIS;
const len = Math.hypot(bx - ax, by - ay);
const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
const bandDist = (x, y) => Math.abs((x - ax) * nx + (y - ay) * ny);
const [cx, cy] = [(ax + bx) / 2, (ay + by) / 2];
const across = (half) =>
  `gradientUnits="userSpaceOnUse" x1="${f(cx - nx * half)}" y1="${f(cy - ny * half)}" x2="${f(cx + nx * half)}" y2="${f(cy + ny * half)}"`;

export function sceneSvg(scale = 2) {
  const [W, H] = [SCENE_W, SCENE_H];
  const { x: px, y: py, r: pr } = PLANET;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#03050d"/><stop offset="0.6" stop-color="#050a1a"/><stop offset="1" stop-color="#02030a"/>
    </linearGradient>
    <linearGradient id="bandFade" ${across(220)}>
      <stop offset="0" stop-color="#000"/><stop offset="0.3" stop-color="#555"/><stop offset="0.5" stop-color="#fff"/><stop offset="0.7" stop-color="#555"/><stop offset="1" stop-color="#000"/>
    </linearGradient>
    <linearGradient id="laneFade" ${across(110)}>
      <stop offset="0" stop-color="#000"/><stop offset="0.5" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="band"><rect width="${W}" height="${H}" fill="url(#bandFade)"/></mask>
    <mask id="lane"><rect width="${W}" height="${H}" fill="url(#laneFade)"/></mask>
    <filter id="dust" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="6" seed="11"/>
      <feColorMatrix values="0 0 0 0 0.78  0 0 0 0 0.84  0 0 0 0 1  0 0 0 2.4 -1.05"/>
    </filter>
    <filter id="coolGas" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.003 0.007" numOctaves="5" seed="4"/>
      <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.45  0 0 0 0 0.95  0 0 0 2 -0.85"/>
    </filter>
    <filter id="warmGas" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.005 0.01" numOctaves="5" seed="23"/>
      <feColorMatrix values="0 0 0 0 0.75  0 0 0 0 0.45  0 0 0 0 0.7  0 0 0 2.2 -1.15"/>
    </filter>
    <filter id="lanes" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.01 0.022" numOctaves="5" seed="31"/>
      <feColorMatrix values="0 0 0 0 0.01  0 0 0 0 0.01  0 0 0 0 0.03  0 0 0 3 -1.3"/>
    </filter>
    <filter id="bands" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.034" numOctaves="5" seed="3"/>
      <feColorMatrix values="0.26 0 0 0 0.03  0.42 0 0 0 0.12  0.55 0 0 0 0.28  0 0 0 0 1"/>
    </filter>
    <radialGradient id="shade" gradientUnits="userSpaceOnUse" cx="${px - pr * 0.75}" cy="${py - pr * 0.55}" r="${pr * 1.85}">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="0.28" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#000" stop-opacity="0.7"/>
      <stop offset="0.66" stop-color="#000" stop-opacity="0.97"/>
    </radialGradient>
    <radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="${px}" cy="${py}" r="${pr + 34}">
      <stop offset="${f(pr / (pr + 34) - 0.01)}" stop-color="#5aa9ff" stop-opacity="0"/>
      <stop offset="${f(pr / (pr + 34))}" stop-color="#7cc0ff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#5aa9ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="litSide" gradientUnits="userSpaceOnUse" x1="${px - pr}" y1="${py - pr}" x2="${px}" y2="${py + pr * 0.3}">
      <stop offset="0" stop-color="#fff"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.45"/><stop offset="0.8" stop-color="#000"/>
    </linearGradient>
    <mask id="lit"><rect width="${W}" height="${H}" fill="url(#litSide)"/></mask>
    <clipPath id="planet"><circle cx="${px}" cy="${py}" r="${pr}"/></clipPath>
    <radialGradient id="moonShade" cx="0.3" cy="0.25" r="0.9">
      <stop offset="0" stop-color="#e9eef7"/><stop offset="0.45" stop-color="#9aa6b8"/><stop offset="0.75" stop-color="#1b2130"/><stop offset="1" stop-color="#05070c"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <g mask="url(#band)">
    <rect width="${W}" height="${H}" filter="url(#coolGas)" opacity="0.55"/>
    <rect width="${W}" height="${H}" filter="url(#warmGas)" opacity="0.35"/>
    <rect width="${W}" height="${H}" filter="url(#dust)" opacity="0.5"/>
  </g>
  <rect width="${W}" height="${H}" filter="url(#lanes)" mask="url(#lane)" opacity="0.8"/>
  <circle cx="${px - pr - 70}" cy="${py + pr * 0.55}" r="12" fill="url(#moonShade)"/>
  <circle cx="${px}" cy="${py}" r="${pr + 34}" fill="url(#halo)" mask="url(#lit)"/>
  <g clip-path="url(#planet)">
    <g transform="rotate(-14 ${px} ${py})"><rect x="${px - pr - 40}" y="${py - pr - 40}" width="${2 * pr + 80}" height="${2 * pr + 80}" filter="url(#bands)"/></g>
    <circle cx="${px}" cy="${py}" r="${pr}" fill="url(#shade)"/>
  </g>
  <circle cx="${px}" cy="${py}" r="${pr}" fill="none" stroke="#d6ebff" stroke-width="1.2" opacity="0.6" mask="url(#lit)"/>
</svg>
`;
}

export function starLayer(H) {
  let s = 20211023;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const COLORS = [['#ffffff', 50], ['#d6e4ff', 25], ['#fff0d9', 18], ['#ffd4a8', 7]];
  const color = () => {
    let r = rand() * 100;
    for (const [c, w] of COLORS) if ((r -= w) < 0) return c;
    return '#ffffff';
  };
  const { x: px, y: py, r: pr } = PLANET;
  const behindPlanet = (x, y) => Math.hypot(x - px, y - py) < pr + 6;

  const W = SCENE_W;
  const stars = [];
  for (let tries = Math.round((W * H) / 520); tries > 0; ) {
    const x = rand() * W, y = rand() * H;
    if (rand() > 0.22 + 0.78 * Math.exp(-((bandDist(x, y) / 150) ** 2))) continue;
    tries--;
    const m = rand() ** 7;
    const r = f(0.25 + 1.2 * m), c = color(), o = f(0.35 + 0.65 * Math.max(m * 3, rand() * 0.7));
    if (!behindPlanet(x, y)) stars.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${c}" opacity="${o}"/>`);
  }
  const bright = [[204, 90], [612, 300], [792, 60], [456, 630], [84, 450], [1032, 540], [1116, 698]]
    .filter(([x, y]) => y < H - 10)
    .map(([x, y], i) => {
      const c = i % 2 ? '#fff4e0' : '#e3edff';
      const l = 9 + (i % 3) * 4;
      return `<g transform="translate(${x} ${y})"><circle r="7" fill="url(#starGlow)"/><path d="M-${l} 0H${l}M0 -${l}V${l}" stroke="${c}" stroke-width="0.6" opacity="0.55"/><circle r="1.5" fill="${c}"><animate attributeName="opacity" values="1;0.55;1" dur="${3 + i * 0.7}s" repeatCount="indefinite"/></circle></g>`;
    });
  return `<g>${stars.join('')}</g>\n    ${bright.join('\n    ')}`;
}
