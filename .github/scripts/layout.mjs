// Shared drawing helpers for the profile cards. Each card is drawn twice: a wide version, and a
// narrow one that the README serves to small screens through <picture>.
import { readFileSync } from 'node:fs';
import { PLANET, SCENE_H, SCENE_W, starLayer } from './scene.mjs';

export const LAYOUTS = {
  wide: { suffix: '', W: 1200 },
  narrow: { suffix: '-mobile', W: 640 },
};

export const MONO = `font-family="'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"`;
export const SERIF = `font-family="Georgia, 'Iowan Old Style', 'Times New Roman', serif" font-style="italic"`;
export const SANS = `font-family="'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"`;

export const xml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function wrap(s, max) {
  const lines = [''];
  for (const w of s.split(' ')) {
    const last = lines.length - 1;
    if (lines[last] && lines[last].length + w.length + 1 > max) lines.push(w);
    else lines[last] = lines[last] ? `${lines[last]} ${w}` : w;
  }
  return lines;
}

const backdrop = () => readFileSync(new URL('../../assets/scene.jpg', import.meta.url)).toString('base64');

// The night sky behind a card, W×H, scaled up to cover tall cards. `planetLeft` is where the planet's
// left edge lands, so narrow cards show a crescent; `flip` turns the sky upside down.
export function sky(W, H, { planetLeft = PLANET.x - PLANET.r, flip = false } = {}) {
  const k = Math.max(1, H / SCENE_H);
  const shiftX = Math.round(planetLeft + PLANET.r * k - PLANET.x * k);
  const place = flip ? `translate(${shiftX} ${H}) scale(${k} ${-k})` : `translate(${shiftX} 0) scale(${k})`;
  return `<rect width="${W}" height="${H}" fill="#02030a"/>
    <g transform="${place}">
      <image href="data:image/jpeg;base64,${backdrop()}" width="${SCENE_W}" height="${SCENE_H}"/>
      ${starLayer(SCENE_H)}
    </g>`;
}

export const SKY_DEFS = `<radialGradient id="starGlow"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0.7"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>`;
