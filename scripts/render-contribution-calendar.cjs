const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const activity = JSON.parse(fs.readFileSync(path.join(root, 'activity.js'), 'utf8')
  .trim().replace(/^const ACTIVITY = /, '').replace(/;$/, ''));
const {start, end, days} = activity.rows[0];
const dayMs = 86_400_000;
const first = new Date(start + 'T00:00:00Z');
const last = new Date(end + 'T00:00:00Z');
const sunday = first.getTime() - first.getUTCDay() * dayMs;
const counts = new Map(days);
const monthName = new Intl.DateTimeFormat('en', {month: 'short', timeZone: 'UTC'});
const dateLabel = new Intl.DateTimeFormat('en', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
const grid = [];
for (let time = first.getTime(); time <= last.getTime(); time += dayMs) {
  const date = new Date(time);
  const iso = date.toISOString().slice(0, 10);
  const count = counts.get(iso) ?? 0;
  const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 12 ? 3 : 4;
  grid.push({date, iso, count, level, x: 73 + 16 * Math.floor((time - sunday)/(7 * dayMs)), y: 31 + 16 * date.getUTCDay()});
}
const targets = grid.filter(day => day.count > 0);
const origin = {x: 32, y: 86};
const releasePoint = {x: origin.x+19, y: origin.y-1};
const motionStart = 0.55;
const flightTime = 0.85;
const interval = Math.min(0.19, 10 / Math.max(1, targets.length - 1));
const loop = motionStart + flightTime + Math.max(0, targets.length - 1) * interval + 3.2;
const round = value => Number(value.toFixed(6));
const times = seconds => seconds.map(time => round(time / loop)).join(';');

function rect(x, y, size, level, extra = '') {
  return `<rect x="${x - size/2}" y="${y - size/2}" width="${size}" height="${size}" rx="2" class="level-${level}" ${extra}/>`;
}

function visible(from, to = loop) {
  const stops = [0, from, to];
  const values = ['0', '1', to === loop ? '1' : '0'];
  if (to < loop) {
    stops.push(loop);
    values.push('0');
  }
  return `<animate attributeName="opacity" calcMode="discrete" values="${values.join(';')}" keyTimes="${times(stops)}" dur="${loop}s" repeatCount="indefinite"/>`;
}

const monthStarts = grid.filter((day, index) => index === 0 || day.date.getUTCDate() === 1);
const months = monthStarts.map((day, index) => {
  const next = monthStarts[index+1];
  if (next && next.x - day.x < 25) return '';
  return `<text x="${day.x-6}" y="15">${monthName.format(day.date)}</text>`;
}).join('');
const weekdays = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']].map(([row, name]) =>
  `<text x="62" y="${34 + row * 16}" text-anchor="end" font-size="9">${name}</text>`).join('');
const empty = grid.map(day => rect(day.x, day.y, 12, 0)).join('\n');
const daysStatic = targets.map(day => rect(day.x, day.y, 12, day.level, `data-date="${day.iso}"`)).join('\n');
const tiles = targets.map((day, index) => {
  const launch = motionStart + index * interval;
  const land = launch + flightTime;
  const lift = Math.min(42, day.y - 13);
  const controlX = (releasePoint.x + day.x)/2;
  const controlY = (releasePoint.y + day.y)/2 - 2 * lift;
  const trajectory = `M${releasePoint.x} ${releasePoint.y} Q${controlX} ${controlY} ${day.x} ${day.y}`;
  return `<g data-flight-date="${day.iso}" opacity="0">${visible(launch, land)}
    <animateMotion path="${trajectory}" keyPoints="0;0;1;1" keyTimes="${times([0,launch,land,loop])}" calcMode="linear" dur="${loop}s" repeatCount="indefinite"/>
    <g>${rect(0, 0, 8, day.level)}<animateTransform attributeName="transform" type="rotate" values="0;0;180;180" keyTimes="${times([0,launch,land,loop])}" dur="${loop}s" repeatCount="indefinite"/></g>
  </g>
  <g data-land-date="${day.iso}">${rect(day.x, day.y, 12, day.level)}${visible(land)}</g>`;
}).join('\n');
const rest = 'M11 -2 C12 -1 11 11 15 10';
const raised = 'M11 -2 C15 -4 17 3 19 -1';
const trunkTimes = [0];
const trunkShapes = [rest];
for (const [index] of targets.entries()) {
  const release = motionStart + index * interval;
  trunkTimes.push(release - Math.min(.08, interval * .29), release, release + Math.min(.13, interval * .60));
  trunkShapes.push(rest, raised, rest);
}
trunkTimes.push(loop);
trunkShapes.push(rest);
const elephant = `<path d="M-15-3Q-18-1-18 5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M-12 2h6l-1 8h-3Zm13 0h6l-1 8H3Z" fill="var(--elephant-ear)"/>
    <path d="M-16-1c0-5 5-8 12-8h3c4 0 7 2 9 6l1 6-2 2-1 5H2L1 5c-4 1-8 1-12 0l-1 5h-4l1-6Z" fill="currentColor"/>
    <path d="M4-7c3-2 7 0 8 3l-1 5-3 2-5-3Z" fill="currentColor"/>
    <path d="M1-9c-3-1-6 .7-6 3.6C-5-3-3 1 0 3c3-1 5-5 5-8 0-2-1.8-3.6-4-4Z" fill="var(--elephant-ear)"/>
    <circle cx="8.5" cy="-5.1" r=".9" fill="var(--surface)"/>`;
const tusk = `<path d="M9 .2Q12 2 16-.4Q14 4.4 9.5 3Z" fill="var(--elephant-tusk)" stroke="currentColor" stroke-width=".4"/>`;
const trunk = `<path d="${rest}" fill="none" stroke="currentColor" stroke-width="3.3" stroke-linecap="round">`;
const trunkMotion = `<animate attributeName="d" values="${trunkShapes.join(';')}" keyTimes="${times(trunkTimes)}" dur="${loop}s" repeatCount="indefinite"/>`;
const total = targets.reduce((sum, day) => sum + day.count, 0);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="935" height="147" viewBox="0 0 935 147" role="img" aria-labelledby="title desc">
<title id="title">DOKL57’s GitHub contribution calendar</title>
<desc id="desc">An elephant tosses tiles into their dates. ${total} GitHub contributions on ${targets.length} days from ${dateLabel.format(first)} through ${dateLabel.format(last)}.</desc>
<style>
:root{--empty:#e7eae6;--low:#c3d7ca;--mid:#90b6a2;--high:#629981;--max:#316c57;--elephant:#685e55;--elephant-ear:#ab9688;--elephant-tusk:#f7e5cb;--ink:#515c58;--surface:#fafbf8}
@media(prefers-color-scheme:dark){:root{--empty:#263137;--low:#3a514c;--mid:#507969;--high:#73a78f;--max:#9acdb4;--elephant:#c1b1a3;--elephant-ear:#8c7464;--elephant-tusk:#ffedd2;--ink:#a3b0ac;--surface:#191f24}}
@media(prefers-reduced-motion:reduce){.animated{display:none}.still{display:inline}}
text{font-family:Consolas,monospace;font-size:10px;fill:var(--ink)}
.level-0{fill:var(--empty)}.level-1{fill:var(--low)}.level-2{fill:var(--mid)}.level-3{fill:var(--high)}.level-4{fill:var(--max)}
</style>
${months}${weekdays}
${empty}
<g class="still" display="none">
${daysStatic}
<g transform="translate(${origin.x} ${origin.y})" color="var(--elephant)">${elephant}${trunk}</path>${tusk}</g>
</g>
<g class="animated">
${tiles}
<g transform="translate(${origin.x} ${origin.y})" color="var(--elephant)">${elephant}${trunk}${trunkMotion}</path>${tusk}</g>
</g>
</svg>\n`;
fs.writeFileSync(path.join(root, 'profile-contributions.svg'), svg);
console.log(`Rendered ${grid.length} dates with ${targets.length} active days and ${total} contributions.`);
