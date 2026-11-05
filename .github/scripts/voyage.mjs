// Draws assets/voyage.svg: the frontend story so far as a timeline of chapters over the same sky
// as the bridge card. Edit CHAPTERS and re-run to change it.
//
//   node .github/scripts/voyage.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { SCENE_H, SCENE_W, starLayer } from './scene.mjs';

const CHAPTERS = [
  {
    year: '2022',
    title: 'First light',
    text: 'Pushed a small blog out of the harbour on Next.js and Tailwind, mostly to see if it would float. It did.',
    cargo: ['Next.js', 'React', 'Tailwind'],
  },
  {
    year: '2023',
    title: 'Open water',
    text: 'The busy year. An NFT mint wired to thirdweb, a trio of vet apps in React, portfolios built on Vite. Then I went below deck and learned the engines.',
    cargo: ['TypeScript', 'React', 'Vite', 'styled-components', 'Express', 'NestJS'],
  },
  {
    year: '2024',
    title: 'Trade routes',
    text: 'Dashboards and ledgers: transaction histories, an accounting front end, a friend’s final-year site. Then a second ship to learn by hand, with Pinia in the hold.',
    cargo: ['Next.js', 'TypeScript', 'Vue', 'Pinia', 'Tailwind'],
  },
  {
    year: '2025',
    title: 'Ink',
    text: 'Kept a different kind of log: fiction, written slowly. The public band went quiet. The engines did not.',
    cargo: ['SCSS', 'marginalia'],
  },
  {
    year: '2026',
    title: 'Instruments',
    text: 'Rebuilt the bridge in three.js, GSAP and Framer Motion. Then built tools for the crew: Claude Code plugins that remember, worktree scripts, a workshop that coaches writers.',
    cargo: ['three.js', 'GSAP', 'Framer Motion', 'Astro', 'Claude Code', 'Shell'],
  },
];

const xml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function wrap(s, max) {
  const lines = [''];
  for (const w of s.split(' ')) {
    const last = lines.length - 1;
    if (lines[last] && lines[last].length + w.length + 1 > max) lines.push(w);
    else lines[last] = lines[last] ? `${lines[last]} ${w}` : w;
  }
  return lines;
}

const W = 1200;
const RAIL = 112;
const X = 148;
const LINE = 30;
const mono = `font-family="'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"`;
const serif = `font-family="Georgia, 'Iowan Old Style', 'Times New Roman', serif" font-style="italic"`;

let y = 150;
const blocks = CHAPTERS.map((c, i) => {
  const lines = wrap(c.text, 88);
  const block = { ...c, i, y, lines };
  y += 32 + lines.length * LINE + 30 + 44;
  return block;
});
const H = y - 10;
const last = blocks.at(-1);

const chapter = ({ year, title, lines, cargo, i, y: cy }) => {
  const now = i === blocks.length - 1;
  return `<g opacity="0">
      <animate attributeName="opacity" to="1" begin="${0.4 + i * 0.45}s" dur="0.9s" fill="freeze"/>
      <circle cx="${RAIL}" cy="${cy - 5}" r="14" fill="url(#dotGlow)"${now ? '><animate attributeName="r" values="12;20;12" dur="2.4s" repeatCount="indefinite"/></circle>' : '/>'}
      <circle cx="${RAIL}" cy="${cy - 5}" r="5" fill="${now ? '#7dd3fc' : '#0b1a3a'}" stroke="#7dd3fc" stroke-width="1.5"/>
      <text x="${X}" y="${cy}" ${mono} font-size="13" letter-spacing="4" fill="#7dd3fc">${year}<tspan fill="#3b5b85"> · </tspan><tspan fill="#cfe7ff">${xml(title.toUpperCase())}</tspan>${now ? '<tspan fill="#38bdf8" dx="14">◂ NOW</tspan>' : ''}</text>
      ${lines.map((l, j) => `<text x="${X}" y="${cy + 34 + j * LINE}" ${serif} font-size="20" fill="#e0f2fe">${xml(l)}</text>`).join('\n      ')}
      <text x="${X}" y="${cy + 34 + (lines.length - 1) * LINE + 32}" ${mono} font-size="11" letter-spacing="3" fill="#6b85a8">${xml(cargo.map((c) => c.toUpperCase()).join('  ·  '))}</text>
    </g>`;
};

const backdrop = readFileSync('assets/scene.jpg').toString('base64');
// The bridge card's sky turned upside down, so its planet rises at the bottom, beside "now".
const k = Math.max(1, H / SCENE_H, W / SCENE_W);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${xml(`The voyage so far: ${CHAPTERS.map((c) => `${c.year}, ${c.title}: ${c.text}`).join(' ')}`)}">
  <defs>
    <radialGradient id="starGlow"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0.7"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="dotGlow"><stop offset="0" stop-color="#38bdf8" stop-opacity="0.55"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></radialGradient>
    <linearGradient id="rail" gradientUnits="userSpaceOnUse" x1="0" y1="${blocks[0].y}" x2="0" y2="${last.y}">
      <stop offset="0" stop-color="#38bdf8" stop-opacity="0.15"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0.7"/>
    </linearGradient>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="#02030a"/>
    <g transform="translate(0 ${H}) scale(${k} ${-k})">
      <image href="data:image/jpeg;base64,${backdrop}" width="${SCENE_W}" height="${SCENE_H}"/>
      ${starLayer(SCENE_H)}
    </g>
    <rect width="${W}" height="${H}" fill="#02030a" opacity="0.55"/>
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="#1e3a8a" stroke-opacity="0.6"/>

    <circle cx="74" cy="66" r="4" fill="#38bdf8"><animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite"/></circle>
    <text x="88" y="71" ${mono} font-size="13" letter-spacing="5" fill="#7dd3fc">THE VOYAGE SO FAR</text>
    <text x="${W - 72}" y="71" ${mono} font-size="12" letter-spacing="2" fill="#64748b" text-anchor="end">A FRONTEND ENGINEER, ${blocks[0].year}–NOW</text>
    <line x1="64" y1="92" x2="${W - 64}" y2="92" stroke="#1e3a8a" stroke-opacity="0.8"/>

    <line x1="${RAIL}" y1="${blocks[0].y - 5}" x2="${RAIL}" y2="${last.y - 5}" stroke="url(#rail)" stroke-width="1.5"/>
    ${blocks.map(chapter).join('\n    ')}
  </g>
</svg>
`;

writeFileSync('assets/voyage.svg', svg);
