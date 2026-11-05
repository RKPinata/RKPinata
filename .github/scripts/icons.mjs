// Brand logos from Simple Icons 16.35.0 (CC0), vendored in icons.json: one 24×24 path each.
import { readFileSync } from 'node:fs';

const ICONS = JSON.parse(readFileSync(new URL('./icons.json', import.meta.url), 'utf8'));

// The logo for `slug`, drawn size×size with its top-left corner at (x, y).
export function icon(slug, x, y, size, fill) {
  const found = ICONS[slug];
  if (!found) throw new Error(`no icon "${slug}" in icons.json`);
  return `<path transform="translate(${x} ${y}) scale(${size / 24})" d="${found.d}" fill="${fill}"><title>${found.title}</title></path>`;
}
