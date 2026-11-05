// Draws assets/voyage.svg and assets/voyage-mobile.svg: the career so far, from the CV, as a timeline of
// chapters, newest first, over the bridge card's sky.
// Edit CHAPTERS and re-run, then update the ?v= in README.md to the printed version.
//
//   node .github/scripts/voyage.mjs
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { icon } from './icons.mjs';
import { LAYOUTS, MONO, SKY_DEFS, sky, wrap, xml } from './layout.mjs';

const CHAPTERS = [
  {
    year: 'Now',
    title: 'The long watch',
    text: 'Charted Inbox, the app’s largest module, and raised its test coverage from about 60% to 80% with QA. Led the team off Vuex. Split the shared composer into composables. Built tools for the crew: a VS Code extension for translation keys, and Claude Code skills that write tests.',
    cargo: [[null, 'Playwright'], ['pinia', 'Pinia'], ['tanstack', 'TanStack Query'], [null, 'VS Code'], ['claude', 'Claude Code']],
  },
  {
    year: '2025',
    title: 'New helm',
    text: 'Signed on with respond.io as a frontend developer. Took on the AI Agents frontend in Vue 3, with a sandbox on the real Inbox composer so customer tests match production. Shipped three calendar integrations fast, then folded them into one OAuth flow.',
    cargo: [['vuedotjs', 'Vue 3'], ['typescript', 'TypeScript'], [null, 'Nango'], [null, 'Quill']],
  },
  {
    year: '2023',
    title: 'Open water',
    text: 'Joined Snappymob and led core features on a MoneyLion web app that serves cash advances to millions of Americans. Profiled before guessing, cut redundant requests, brought in useSWR and Zustand. Below deck: NestJS APIs on PostgreSQL, and feature flags for safer launches.',
    cargo: [['react', 'React'], ['nextdotjs', 'Next.js'], ['typescript', 'TypeScript'], ['swr', 'useSWR'], [null, 'Zustand'], ['nestjs', 'NestJS'], ['postgresql', 'PostgreSQL']],
  },
];

function voyage({ W }) {
  const narrow = W < 900;
  const P = narrow
    ? { margin: 32, rail: 44, X: 76, body: 23, line: 38, chars: 35, logo: 32, label: 17, charW: 12.2 }
    : { margin: 64, rail: 112, X: 156, body: 26, line: 42, chars: 58, logo: 36, label: 18, charW: 12.8 };
  const { X } = P;
  const rowEnd = W - P.margin;

  // Logo + label pairs, wrapping to a new row when the next pair would pass the right edge.
  // Labels are mono, so their width follows from the character count.
  const manifest = (cargo, top) => {
    let x = X;
    let row = top;
    const parts = cargo.map(([slug, label]) => {
      const text = label.toUpperCase();
      const width = (slug ? P.logo + 10 : 0) + text.length * P.charW;
      if (x > X && x + width > rowEnd) {
        x = X;
        row += P.logo + 18;
      }
      const logo = slug ? icon(slug, x, row, P.logo, '#bfdbfe') : '';
      const tx = slug ? x + P.logo + 10 : x;
      x += width + 34;
      return `${logo}<text x="${tx}" y="${row + P.logo * 0.72}" ${MONO} font-size="${P.label}" letter-spacing="2" fill="#93acd0">${xml(text)}</text>`;
    });
    return { svg: parts.join(''), bottom: row + P.logo };
  };

  let y = 180;
  const blocks = CHAPTERS.map((c, i) => {
    const lines = wrap(c.text, P.chars);
    const textEnd = y + 50 + (lines.length - 1) * P.line;
    const cargo = manifest(c.cargo, textEnd + 26);
    const block = { ...c, i, y, lines, cargo };
    y = cargo.bottom + 84;
    return block;
  });
  const H = y - 20;
  const last = blocks.at(-1);

  const chapter = (b) => {
    const now = b.i === 0;
    return `<g opacity="0">
      <animate attributeName="opacity" to="1" begin="${0.4 + b.i * 0.45}s" dur="0.9s" fill="freeze"/>
      <circle cx="${P.rail}" cy="${b.y - 6}" r="16" fill="url(#dotGlow)"${now ? '><animate attributeName="r" values="14;24;14" dur="2.4s" repeatCount="indefinite"/></circle>' : '/>'}
      <circle cx="${P.rail}" cy="${b.y - 6}" r="6" fill="${now ? '#7dd3fc' : '#0b1a3a'}" stroke="#7dd3fc" stroke-width="1.8"/>
      <text x="${X}" y="${b.y}" ${MONO} font-size="20" letter-spacing="4" fill="#7dd3fc">${xml(b.year.toUpperCase())}<tspan fill="#3b5b85"> · </tspan><tspan fill="#cfe7ff">${xml(b.title.toUpperCase())}</tspan></text>
      ${b.lines.map((l, j) => `<text x="${X}" y="${b.y + 50 + j * P.line}" ${MONO} font-size="${P.body}" fill="#d6ecff">${xml(l)}</text>`).join('\n      ')}
      ${b.cargo.svg}
    </g>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${xml(`The voyage so far: ${CHAPTERS.map((c) => `${c.year}, ${c.title}: ${c.text}`).join(' ')}`)}">
  <defs>
    ${SKY_DEFS}
    <radialGradient id="dotGlow"><stop offset="0" stop-color="#38bdf8" stop-opacity="0.55"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></radialGradient>
    <linearGradient id="rail" gradientUnits="userSpaceOnUse" x1="0" y1="${blocks[0].y}" x2="0" y2="${last.y}">
      <stop offset="0" stop-color="#38bdf8" stop-opacity="0.75"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0.15"/>
    </linearGradient>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    ${sky(W, H, narrow ? { planetLeft: W - 150 } : {})}
    <rect width="${W}" height="${H}" fill="#02030a" opacity="0.55"/>
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="#1e3a8a" stroke-opacity="0.6"/>

    <circle cx="${P.margin + 10}" cy="73" r="5" fill="#38bdf8"><animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite"/></circle>
    <text x="${P.margin + 28}" y="80" ${MONO} font-size="19" letter-spacing="5" fill="#7dd3fc">THE VOYAGE SO FAR</text>
    ${narrow ? '' : `<text x="${W - P.margin - 8}" y="80" ${MONO} font-size="15" letter-spacing="2" fill="#64748b" text-anchor="end">FRONTEND ENGINEER, ${blocks.at(-1).year}–NOW</text>`}
    <line x1="${P.margin}" y1="108" x2="${W - P.margin}" y2="108" stroke="#1e3a8a" stroke-opacity="0.8"/>

    <line x1="${P.rail}" y1="${blocks[0].y - 6}" x2="${P.rail}" y2="${last.y - 6}" stroke="url(#rail)" stroke-width="1.8"/>
    ${blocks.map(chapter).join('\n    ')}
  </g>
</svg>
`;
}

const hash = createHash('sha1');
for (const layout of Object.values(LAYOUTS)) {
  const svg = voyage(layout);
  writeFileSync(`assets/voyage${layout.suffix}.svg`, svg);
  hash.update(svg);
}
console.log(hash.digest('hex').slice(0, 10));
