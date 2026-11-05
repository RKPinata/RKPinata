// Keeps a daily ship's log written from the owner's public GitHub activity.
// Each run adds the previous UTC day's entry to log.json, then redraws assets/bridge.svg
// (the profile header with the latest entries), the header block in README.md, and logbook.md.
//
//   node .github/scripts/ships-log.mjs                    log yesterday
//   node .github/scripts/ships-log.mjs --dry              print the entries only
//   node .github/scripts/ships-log.mjs --date 2026-11-04  log that day instead
//   node .github/scripts/ships-log.mjs --backfill 21      log each of the last 21 days
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { icon } from './icons.mjs';
import { LAYOUTS, MONO, SANS, SERIF, SKY_DEFS, sky } from './layout.mjs';

const USER = process.env.GH_USER || 'RKPinata';
const LAUNCH = Date.UTC(2021, 9, 23); // the day the account was created: day 1 of the voyage
const DAY = 86_400_000;
const SHOWN = 3; // entries drawn on the header
const STACK = ['typescript', 'react', 'vuedotjs', 'astro', 'nodedotjs', 'nestjs']; // logos under the name

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dry = args.includes('--dry');
const yesterday = Math.floor(Date.now() / DAY) * DAY - DAY;
const backfill = flag('--backfill');
if (backfill !== undefined && !(Number(backfill) > 0)) throw new Error('--backfill needs a number of days');
const days = backfill
  ? Array.from({ length: Number(backfill) }, (_, i) => yesterday - i * DAY)
  : [flag('--date') ? Date.parse(`${flag('--date')}T00:00:00Z`) : yesterday];
if (days.some(Number.isNaN)) throw new Error('--date needs the form YYYY-MM-DD');

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] ?? String(n);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const link = (full) => {
  const [owner, name] = full.split('/');
  return `[${owner === USER ? name : full}](https://github.com/${full})`;
};
const plain = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replaceAll('`', '');
const xml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const OPENINGS = [
  'The hull ticked as it cooled.',
  'Nothing on the long-range scanners but the usual dust.',
  'Woke to the hum of the recyclers and a sky that had not moved.',
  'The coffee ration held. Small mercies.',
  'A slow day by the ship’s clock, though the ship’s clock has opinions.',
  'Light from a star that may no longer exist came through the port window again.',
  'The navigation lamp blinked green all night. I chose to read it as encouragement.',
  'Somewhere aft, a panel rattled. I have stopped asking which one.',
  'Frost on the inside of the viewport this morning. I drew a door in it.',
  'The radio gave us twenty minutes of static that sounded almost like rain.',
  'We crossed into the planet’s shadow and the cabin went blue for an hour.',
  'The galley plants have started leaning toward the reading lamp. So have I.',
  'Ran the diagnostics twice. Everything is fine, which is its own kind of suspicious.',
  'Dreamed of a harbour I have never seen. Woke with salt on my tongue.',
  'A meteor shower off the port bow, silent as a held breath.',
  'The old map still shows a coastline here. I keep it pinned up anyway.',
];

const QUIET = [
  'No public transmissions. The real work happened below deck, where the logs are sealed.',
  'The open channels stayed quiet. Below deck, the engines ran anyway.',
  'Nothing on the public frequencies. Some voyages are made in the dark.',
  'Drifted. Read a little. Wrote a sentence and crossed it out, which also counts.',
  'Held position. Not every day is a jump.',
  'Spent the watch below, mending things nobody will see.',
  'Kept the lights low and the hatches shut. Some work wants no audience.',
  'The charts stayed rolled. I worked by hand, off the record.',
  'Quiet on deck, busy in the engine room. The log only sees the deck.',
  'Answered no hails. Fixed three things that were not broken yet.',
  'A day for maintenance and long thoughts. Neither leaves a trace on the public band.',
  'No new stars marked. I counted the old ones instead, to make sure they were still there.',
];

const CLOSINGS = [
  'Course holds.',
  'End of entry.',
  'More tomorrow, if the stars stay where I left them.',
  'Logging off. The stars can keep watch.',
  'Signing off with the lights low.',
  'Bearing unchanged. Spirits fair.',
  'Closing the book. The pen stays warm.',
  'Out.',
  'Fuel enough. Faith enough. Goodnight.',
  'Nothing further. The dark is patient.',
];

const BEATS = {
  push: ({ repo, n }, pick) =>
    n === 1
      ? pick([`Put in at ${repo} long enough to change one thing.`, `One commit to ${repo}, small and clean.`])
      : n <= 5
        ? pick([
            `Docked at ${repo} for ${word(n)} commits.`,
            `${cap(word(n))} commits into ${repo} before the light changed.`,
            `Spent the watch at ${repo}: ${word(n)} commits, no casualties.`,
          ])
        : pick([
            `${cap(word(n))} commits into ${repo}. The crew will call it a refit. I call it a long night.`,
            `Rebuilt half of ${repo}, ${word(n)} commits in all, and it still flies.`,
          ]),
  create: ({ repo }, pick) => pick([`Charted a new system and named it ${repo}.`, `Raised a new flag: ${repo}.`]),
  release: ({ repo, tag }) => `Launched ${tag} from ${repo}. It flew.`,
  pr: ({ repo, n }) =>
    n === 1 ? `Sent a signal to ${repo} and waited for an answer.` : `Sent ${word(n)} signals to ${repo} and waited for answers.`,
  merged: ({ repo, n }) => (n === 1 ? `A signal to ${repo} came back yes.` : `${cap(word(n))} signals to ${repo} came back yes.`),
  issue: ({ repo, n }) => (n === 1 ? `Logged a fault in ${repo}.` : `Logged ${word(n)} faults in ${repo}.`),
  comment: ({ repo }, pick) => pick([`Answered a hail from ${repo}.`, `Traded words with the crew of ${repo}.`]),
  star: ({ repo }, pick) => pick([`Spotted ${repo} through the glass and marked it on the chart.`, `Marked ${repo} on the chart for a later visit.`]),
  fork: ({ repo }) => `Copied the charts for ${repo}.`,
};

async function github(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'ships-log',
      ...(process.env.GITHUB_TOKEN && { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
    },
  });
  if (!res.ok) throw new Error(`GitHub request ${path} failed: HTTP ${res.status}`);
  return res.json();
}

// Push events carry only before/head, so the commit count comes from comparing the two.
// A push that opens a branch has no before commit and counts as one.
async function commitsIn(e) {
  const { before, head } = e.payload;
  if (!before || /^0+$/.test(before)) return 1;
  try {
    return (await github(`repos/${e.repo.name}/compare/${before}...${head}`)).total_commits || 1;
  } catch {
    return 1; // force-pushed or deleted history
  }
}

async function beatsFrom(events, from) {
  const beats = new Map(); // one beat per kind and repo, with a count
  const add = (kind, full, n = 1, extra = {}) => {
    const key = `${kind} ${full}`;
    const beat = beats.get(key) ?? { kind, repo: link(full), n: 0, ...extra };
    beat.n += n;
    beats.set(key, beat);
  };
  for (const e of events) {
    const t = Date.parse(e.created_at);
    if (t < from || t >= from + DAY || e.repo.name === `${USER}/${USER}`) continue;
    const p = e.payload ?? {};
    const full = e.repo.name;
    if (e.type === 'PushEvent') add('push', full, await commitsIn(e));
    else if (e.type === 'CreateEvent' && p.ref_type === 'repository') add('create', full);
    else if (e.type === 'ReleaseEvent' && p.action === 'published') add('release', full, 1, { tag: `\`${p.release.tag_name}\`` });
    else if (e.type === 'PullRequestEvent' && p.action === 'opened') add('pr', full);
    else if (e.type === 'PullRequestEvent' && p.action === 'closed' && p.pull_request?.merged) add('merged', full);
    else if (e.type === 'IssuesEvent' && p.action === 'opened') add('issue', full);
    else if (e.type === 'IssueCommentEvent') add('comment', full);
    else if (e.type === 'WatchEvent') add('star', full);
    else if (e.type === 'ForkEvent') add('fork', full);
  }
  const all = [...beats.values()];
  const pushes = all.filter((b) => b.kind === 'push').sort((a, b) => b.n - a.n);
  return [...pushes, ...all.filter((b) => b.kind !== 'push')].slice(0, 4);
}

async function compose(events, from) {
  const day = Math.floor((from - LAUNCH) / DAY) + 1;
  // Same day, same entry: a re-run never rewrites the prose.
  let seed = day * 2654435761;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  // Steps coprime with each list's length, so neighbouring days never share a line.
  const cycle = (list, step) => list[(day * step) % list.length];

  const beats = await beatsFrom(events, from);
  const body = beats.length ? beats.map((b) => BEATS[b.kind](b, pick)).join(' ') : cycle(QUIET, 5);
  return {
    day,
    date: new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    text: `${cycle(OPENINGS, 7)} ${body} ${cycle(CLOSINGS, 3)}`,
  };
}

const markdown = (e) => `**Day ${e.day} of the voyage** · <sub>${e.date}</sub>\n\n*${e.text}*`;

function wrap(s, max) {
  const lines = [''];
  for (const w of s.split(' ')) {
    const last = lines.length - 1;
    if (lines[last] && lines[last].length + w.length + 1 > max) lines.push(w);
    else lines[last] = lines[last] ? `${lines[last]} ${w}` : w;
  }
  return lines;
}

// The profile header: name and stack over the night sky, and a logbook panel with the latest entries.
// The newest entry writes itself in line by line; older ones sit dimmer below it.
function bridge(shown, { W }) {
  const narrow = W < 900;
  const P = narrow
    ? { pad: 36, name: 58, sub: 18, logo: 34, gap: 50, margin: 18, X: 64, body: 25, line: 37, chars: 41 }
    : { pad: 90, name: 78, sub: 21, logo: 38, gap: 58, margin: 40, X: 116, body: 25, line: 38, chars: 80 };
  const { pad, X } = P;

  const labelY = 70;
  const nameY = labelY + Math.round(P.name * 0.95) + 6;
  const subY = nameY + P.sub + 22;
  const logosTop = subY + 26;
  const panelTop = logosTop + P.logo + 36;
  const right = W - P.margin - 32;

  let y = panelTop + 100;
  const blocks = shown.map((e, i) => {
    const block = { e, i, y, lines: wrap(plain(e.text), P.chars) };
    y += 38 + (block.lines.length - 1) * P.line + 58;
    return block;
  });
  const sigY = y - 22;
  const panelBottom = sigY + 30;
  const H = panelBottom + P.margin;
  const start = (j) => 1.4 + j * 0.9;
  const lineY = (b, j) => b.y + 38 + j * P.line;

  const entry = (b) => {
    const fade = [1, 0.66, 0.46][b.i] ?? 0.4;
    const text = b.lines
      .map((l, j) => `<text x="${X}" y="${lineY(b, j)}" ${SERIF} font-size="${P.body}" fill="#e0f2fe"${b.i === 0 ? ` clip-path="url(#w${j})"` : ''}>${xml(l)}</text>`)
      .join('\n      ');
    return `<g opacity="${fade}">
      <text x="${X}" y="${b.y}" ${MONO} font-size="14" letter-spacing="3" fill="#7dd3fc">${xml(`DAY ${b.e.day} · ${b.e.date.toUpperCase()}`)}</text>
      ${text}
    </g>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${xml(`Danish Roti: frontend engineer, tool builder, writer. Ship's log, day ${shown[0].day}: ${plain(shown[0].text)}`)}">
  <defs>
    ${SKY_DEFS}
    <linearGradient id="vignette" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#02030a" stop-opacity="0.7"/><stop offset="${narrow ? 0.9 : 0.55}" stop-color="#02030a" stop-opacity="0"/>
    </linearGradient>
    <filter id="textGlow" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="10"/></filter>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>
${blocks[0].lines.map((_, j) => `    <clipPath id="w${j}"><rect x="${X - 10}" y="${lineY(blocks[0], j) - P.body}" height="${P.body + 12}" width="0"><animate attributeName="width" to="${W - X}" begin="${start(j)}s" dur="0.9s" fill="freeze"/></rect></clipPath>`).join('\n')}
  </defs>
  <g clip-path="url(#frame)">
    ${sky(W, H, { planetX: narrow ? W + 90 : undefined })}
    <rect width="${W}" height="${H}" fill="url(#vignette)"/>

    <g>
      <animate attributeName="opacity" values="0;1" dur="1.2s" fill="freeze"/>
      <circle cx="${pad + 6}" cy="${labelY - 5}" r="4" fill="#7dd3fc"><animate attributeName="opacity" values="1;0.25;1" dur="1.8s" repeatCount="indefinite"/></circle>
      <text x="${pad + 20}" y="${labelY}" ${MONO} font-size="15" letter-spacing="5" fill="#9cc8ee">INCOMING TRANSMISSION</text>
      <text x="${pad}" y="${nameY}" ${SANS} font-size="${P.name}" font-weight="700" letter-spacing="-1" fill="#7cc4ff" opacity="0.35" filter="url(#textGlow)">Danish Roti</text>
      <text x="${pad}" y="${nameY}" ${SANS} font-size="${P.name}" font-weight="700" letter-spacing="-1" fill="#f4f8ff">Danish Roti</text>
      <text x="${pad + 3}" y="${subY}" ${MONO} font-size="${P.sub}" letter-spacing="1" fill="#b9d3ee">frontend engineer · tool builder · writer</text>
      ${STACK.map((slug, i) => icon(slug, pad + 4 + i * P.gap, logosTop, P.logo, '#dbeafe')).join('')}
    </g>

    <rect x="${P.margin}" y="${panelTop}" width="${W - 2 * P.margin}" height="${panelBottom - panelTop}" rx="14" fill="#020617" fill-opacity="0.62" stroke="#1e3a8a" stroke-opacity="0.7"/>
    <circle cx="${P.margin + 34}" cy="${panelTop + 37}" r="4.5" fill="#38bdf8"><animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite"/></circle>
    <text x="${P.margin + 50}" y="${panelTop + 42}" ${MONO} font-size="15" letter-spacing="5" fill="#7dd3fc">SHIP'S LOG</text>
    <text x="${right}" y="${panelTop + 42}" ${MONO} font-size="13" letter-spacing="2" fill="#64748b" text-anchor="end">${narrow ? `LATEST ${shown.length}` : `LATEST ${shown.length} · FULL LOG IN LOGBOOK.MD`}</text>
    <line x1="${P.margin + 24}" y1="${panelTop + 62}" x2="${W - P.margin - 24}" y2="${panelTop + 62}" stroke="#1e3a8a" stroke-opacity="0.8"/>
    <line x1="${X - 24}" y1="${panelTop + 62}" x2="${X - 24}" y2="${panelBottom - 16}" stroke="#38bdf8" stroke-opacity="0.3"/>
    ${blocks.map(entry).join('\n    ')}
    <text x="${right}" y="${sigY}" ${SERIF} font-size="19" fill="#7dd3fc" text-anchor="end" opacity="0">— the ship’s computer<animate attributeName="opacity" to="0.8" begin="${start(blocks[0].lines.length) + 0.6}s" dur="0.8s" fill="freeze"/></text>
  </g>
</svg>
`;
}

const events = await github(`users/${USER}/events/public?per_page=100`);
const fresh = [];
for (const from of days) fresh.push(await compose(events, from));

if (dry) {
  for (const e of fresh) console.log(`${markdown(e)}\n`);
  process.exit(0);
}

const LOG = 'log.json';
const byDay = new Map((existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : []).map((e) => [e.day, e]));
for (const e of fresh) byDay.set(e.day, e);
const entries = [...byDay.values()].sort((a, b) => b.day - a.day);
writeFileSync(LOG, `${JSON.stringify(entries, null, 2)}\n`);

writeFileSync(
  'logbook.md',
  `# Ship's log\n\nEvery entry the ship's computer has written, newest first. [Back to the bridge](README.md)\n\n${entries.map(markdown).join('\n\n---\n\n')}\n`,
);

mkdirSync('assets', { recursive: true });
const hash = createHash('sha1');
for (const layout of Object.values(LAYOUTS)) {
  const svg = bridge(entries.slice(0, SHOWN), layout);
  writeFileSync(`assets/bridge${layout.suffix}.svg`, svg);
  hash.update(svg);
}
// GitHub's image proxy caches by URL, so the URL changes whenever the card does.
const version = hash.digest('hex').slice(0, 10);

const README = 'README.md';
const markers = /(<!-- LOG:START -->)[\s\S]*?(<!-- LOG:END -->)/;
const readme = readFileSync(README, 'utf8');
if (!markers.test(readme)) throw new Error(`${README} has no LOG:START / LOG:END markers`);
const latest = entries[0];
const alt = xml(`Danish Roti: frontend engineer, tool builder, writer. Ship's log, day ${latest.day}: ${plain(latest.text)}`);
const card = `<a href="logbook.md"><picture><source media="(max-width: 760px)" srcset="assets/bridge-mobile.svg?v=${version}"><img width="100%" src="assets/bridge.svg?v=${version}" alt="${alt}" /></picture></a>`;
writeFileSync(README, readme.replace(markers, (_, open, close) => `${open}\n${card}\n${close}`));
