// Writes a daily ship's-log entry from the owner's public GitHub activity of the previous UTC day.
// The entry replaces the block between the LOG markers in README.md and is prepended to logbook.md.
//
//   node .github/scripts/ships-log.mjs                    log yesterday and write files
//   node .github/scripts/ships-log.mjs --dry              print the entry only
//   node .github/scripts/ships-log.mjs --date 2026-11-04  log that day instead
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const USER = process.env.GH_USER || 'RKPinata';
const LAUNCH = Date.UTC(2021, 9, 23); // the day the account was created: day 1 of the voyage
const DAY = 86_400_000;

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const dateAt = args.indexOf('--date');
const from = dateAt >= 0 ? Date.parse(`${args[dateAt + 1]}T00:00:00Z`) : Math.floor(Date.now() / DAY) * DAY - DAY;
if (Number.isNaN(from)) throw new Error('--date needs the form YYYY-MM-DD');
const dayNo = Math.floor((from - LAUNCH) / DAY) + 1;

// Same day, same entry: a re-run never rewrites the prose.
let seed = dayNo * 2654435761;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] ?? String(n);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const link = (full) => {
  const [owner, name] = full.split('/');
  return `[${owner === USER ? name : full}](https://github.com/${full})`;
};

const OPENINGS = [
  'The hull ticked as it cooled.',
  'Nothing on the long-range scanners but the usual dust.',
  'Woke to the hum of the recyclers and a sky that had not moved.',
  'The coffee ration held. Small mercies.',
  'A slow day by the ship’s clock, though the ship’s clock has opinions.',
  'Light from a star that may no longer exist came through the port window again.',
  'The navigation lamp blinked green all night. I chose to read it as encouragement.',
  'Somewhere aft, a panel rattled. I have stopped asking which one.',
];

const QUIET = [
  'No public transmissions. The real work happened below deck, where the logs are sealed.',
  'The open channels stayed quiet. Below deck, the engines ran anyway.',
  'Nothing on the public frequencies. Some voyages are made in the dark.',
  'Drifted. Read a little. Wrote a sentence and crossed it out, which also counts.',
  'Held position. Not every day is a jump.',
];

const CLOSINGS = [
  'Course holds.',
  'End of entry.',
  'More tomorrow, if the stars stay where I left them.',
  'Logging off. The stars can keep watch.',
  'Signing off with the lights low.',
];

const BEATS = {
  push: ({ repo, n }) =>
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
  create: ({ repo }) => pick([`Charted a new system and named it ${repo}.`, `Raised a new flag: ${repo}.`]),
  release: ({ repo, tag }) => `Launched ${tag} from ${repo}. It flew.`,
  pr: ({ repo, n }) =>
    n === 1 ? `Sent a signal to ${repo} and waited for an answer.` : `Sent ${word(n)} signals to ${repo} and waited for answers.`,
  merged: ({ repo, n }) => (n === 1 ? `A signal to ${repo} came back yes.` : `${cap(word(n))} signals to ${repo} came back yes.`),
  issue: ({ repo, n }) => (n === 1 ? `Logged a fault in ${repo}.` : `Logged ${word(n)} faults in ${repo}.`),
  comment: ({ repo }) => pick([`Answered a hail from ${repo}.`, `Traded words with the crew of ${repo}.`]),
  star: ({ repo }) => pick([`Spotted ${repo} through the glass and marked it on the chart.`, `Marked ${repo} on the chart for a later visit.`]),
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

async function beatsFrom(events) {
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

const beats = await beatsFrom(await github(`users/${USER}/events/public?per_page=100`));
const body = beats.length ? beats.map((b) => BEATS[b.kind](b)).join(' ') : pick(QUIET);
const date = new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const text = `${pick(OPENINGS)} ${body} ${pick(CLOSINGS)}`;
const entry = `**Day ${dayNo} of the voyage** · <sub>${date}</sub>\n\n*${text}*`;
const plain = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replaceAll('`', '');

if (dry) {
  console.log(entry);
  process.exit(0);
}

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

// A logbook page in the header's palette: ruled lines, a margin rule, and each line written in turn.
function logCard() {
  const lines = wrap(plain, 74);
  const top = 150;
  const step = 48;
  const sigY = top + (lines.length - 1) * step + 72;
  const h = sigY + 44;
  const mono = `font-family="'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"`;
  const serif = `font-family="Georgia, 'Iowan Old Style', 'Times New Roman', serif" font-style="italic"`;
  const written = lines.map((_, i) => 0.6 + i * 0.9);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${h}" width="1200" height="${h}" role="img" aria-label="${xml(`Ship's log, day ${dayNo}: ${plain}`)}">
  <defs>
    <radialGradient id="bg" cx="30%" cy="0%" r="110%">
      <stop offset="0" stop-color="#0b1a3a"/><stop offset="0.6" stop-color="#050b1f"/><stop offset="1" stop-color="#02040d"/>
    </radialGradient>
    <radialGradient id="neb"><stop offset="0" stop-color="#6366f1" stop-opacity="0.22"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
${lines.map((_, i) => `    <clipPath id="w${i}"><rect x="100" y="${top + i * step - 38}" height="52" width="0"><animate attributeName="width" to="1080" begin="${written[i]}s" dur="0.9s" fill="freeze"/></rect></clipPath>`).join('\n')}
  </defs>
  <rect width="1200" height="${h}" rx="18" fill="url(#bg)"/>
  <ellipse cx="1000" cy="${h}" rx="420" ry="200" fill="url(#neb)"/>
  <rect x="0.5" y="0.5" width="1199" height="${h - 1}" rx="18" fill="none" stroke="#1e3a8a" stroke-opacity="0.6"/>
  <g fill="#ffffff">
    <circle cx="1120" cy="120" r="1" opacity="0.6"/><circle cx="1060" cy="${h - 40}" r="1.2" opacity="0.5"/>
    <circle cx="640" cy="${h - 24}" r="0.8" opacity="0.6"/><circle cx="1170" cy="${Math.round(h / 2)}" r="1" opacity="0.5"/>
    <circle cx="1150" cy="${h - 90}" r="1.5"><animate attributeName="opacity" values="1;0.2;1" dur="3s" repeatCount="indefinite"/></circle>
  </g>
  <circle cx="48" cy="52" r="5" fill="#38bdf8"><animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite"/></circle>
  <text x="64" y="57" ${mono} font-size="15" letter-spacing="5" fill="#7dd3fc">SHIP'S LOG</text>
  <text x="1152" y="57" ${mono} font-size="15" letter-spacing="3" fill="#94a3b8" text-anchor="end">${xml(`DAY ${dayNo} · ${date.toUpperCase()}`)}</text>
  <line x1="40" y1="84" x2="1160" y2="84" stroke="#1e3a8a"/>
  <line x1="80" y1="84" x2="80" y2="${h - 30}" stroke="#38bdf8" stroke-opacity="0.35"/>
${lines.map((_, i) => `  <line x1="40" y1="${top + i * step + 14}" x2="1160" y2="${top + i * step + 14}" stroke="#16264a"/>`).join('\n')}
${lines.map((l, i) => `  <text x="110" y="${top + i * step}" ${serif} font-size="27" fill="#e0f2fe" clip-path="url(#w${i})">${xml(l)}</text>`).join('\n')}
  <text x="1152" y="${sigY}" ${serif} font-size="19" fill="#7dd3fc" text-anchor="end" opacity="0">— the ship’s computer<animate attributeName="opacity" to="0.85" begin="${written.at(-1) + 1}s" dur="0.8s" fill="freeze"/></text>
</svg>
`;
}

writeFileSync('assets/log.svg', logCard());

const README = 'README.md';
const markers = /(<!-- LOG:START -->)[\s\S]*?(<!-- LOG:END -->)/;
const readme = readFileSync(README, 'utf8');
if (!markers.test(readme)) throw new Error(`${README} has no LOG:START / LOG:END markers`);
const card = `<img width="100%" src="assets/log.svg?day=${dayNo}" alt="${xml(`Ship's log, day ${dayNo}: ${plain}`)}" />`;
writeFileSync(README, readme.replace(markers, (_, start, end) => `${start}\n${card}\n${end}`));

const BOOK = 'logbook.md';
const book = existsSync(BOOK)
  ? readFileSync(BOOK, 'utf8')
  : `# Ship's log\n\nEvery entry the ship's computer has written, newest first. [Back to the bridge](README.md)\n\n<!-- ENTRIES -->\n`;
const tag = `<!-- day:${dayNo} -->`;
if (!book.includes(tag)) writeFileSync(BOOK, book.replace('<!-- ENTRIES -->', (m) => `${m}\n${tag}\n${entry}\n\n---\n`));
