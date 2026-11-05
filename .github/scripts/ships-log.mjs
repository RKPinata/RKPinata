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
const entry = `**Day ${dayNo} of the voyage** · <sub>${date}</sub>\n\n*${pick(OPENINGS)} ${body} ${pick(CLOSINGS)}*`;

if (dry) {
  console.log(entry);
  process.exit(0);
}

const README = 'README.md';
const markers = /(<!-- LOG:START -->)[\s\S]*?(<!-- LOG:END -->)/;
const readme = readFileSync(README, 'utf8');
if (!markers.test(readme)) throw new Error(`${README} has no LOG:START / LOG:END markers`);
writeFileSync(README, readme.replace(markers, (_, start, end) => `${start}\n${entry}\n${end}`));

const BOOK = 'logbook.md';
const book = existsSync(BOOK)
  ? readFileSync(BOOK, 'utf8')
  : `# Ship's log\n\nEvery entry the ship's computer has written, newest first. [Back to the bridge](README.md)\n\n<!-- ENTRIES -->\n`;
const tag = `<!-- day:${dayNo} -->`;
if (!book.includes(tag)) writeFileSync(BOOK, book.replace('<!-- ENTRIES -->', (m) => `${m}\n${tag}\n${entry}\n\n---\n`));
