// Writes the backdrop SVG for rendering. Rasterize it in a headless browser at its own size
// (2400×1800) and save it as assets/scene.jpg, around quality 82.
//
//   node .github/scripts/render-scene.mjs scene.svg
import { writeFileSync } from 'node:fs';
import { sceneSvg } from './scene.mjs';

writeFileSync(process.argv[2] ?? 'scene.svg', sceneSvg(2));
