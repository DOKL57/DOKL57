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
  const controlX = (49 + day.x)/2;
  const controlY = (73 + day.y)/2 - 2 * lift;
  const trajectory = `M49 73 Q${controlX} ${controlY} ${day.x} ${day.y}`;
  return `<g data-flight-date="${day.iso}" opacity="0">${visible(launch, land)}
    <animateMotion path="${trajectory}" keyPoints="0;0;1;1" keyTimes="${times([0,launch,land,loop])}" calcMode="linear" dur="${loop}s" repeatCount="indefinite"/>
    <g>${rect(0, 0, 8, day.level)}<animateTransform attributeName="transform" type="rotate" values="0;0;180;180" keyTimes="${times([0,launch,land,loop])}" dur="${loop}s" repeatCount="indefinite"/></g>
  </g>
  <g data-land-date="${day.iso}">${rect(day.x, day.y, 12, day.level)}${visible(land)}</g>`;
}).join('\n');
const rest = 'M10 -1 Q16 8 17 4';
const raised = 'M10 -1 Q16 6 17 -13';
const trunkTimes = [0];
const trunkShapes = [rest];
for (const [index] of targets.entries()) {
  const release = motionStart + index * interval;
  trunkTimes.push(release - Math.min(.08, interval * .29), release, release + Math.min(.13, interval * .60));
  trunkShapes.push(rest, raised, rest);
}
trunkTimes.push(loop);
trunkShapes.push(rest);
const elephant = `<path d="M-12-2Q-16 0-17 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M-13 2c-1-6 4-10 10-10 3 0 5 1 7 2 3 1 4 4 4 7v8H4L3 4H-6l-1 5h-4l.2-6Z" fill="currentColor"/>
    <path d="M0-6c1-3 5-4 8-2 3 2 4 5 3 8L8 4 4 1Z" fill="currentColor"/>
    <path d="M-2-6c4-2 7 .4 7 3 0 2.5-2.2 5-5 5-1.8-1.6-3-4.7-2-8Z" fill="var(--cell-mid)"/>
    <circle cx="8" cy="-5" r="1" fill="var(--surface)"/>`;
const trunk = `<path d="${rest}" fill="none" stroke="currentColor" stroke-width="3.3" stroke-linecap="round">`;
const trunkMotion = `<animate attributeName="d" values="${trunkShapes.join(';')}" keyTimes="${times(trunkTimes)}" dur="${loop}s" repeatCount="indefinite"/>`;
const total = targets.reduce((sum, day) => sum + day.count, 0);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="935" height="147" viewBox="0 0 935 147" role="img" aria-labelledby="title desc">
<title id="title">DOKL57’s GitHub contribution calendar</title>
<desc id="desc">An elephant tosses tiles into their dates. ${total} GitHub contributions on ${targets.length} days from ${dateLabel.format(first)} through ${dateLabel.format(last)}.</desc>
<style>
:root{--empty:#e7eae6;--low:#c3d7ca;--mid:#90b6a2;--high:#629981;--max:#316c57;--elephant:#2f596b;--ink:#515c58;--surface:#fafbf8}
@media(prefers-color-scheme:dark){:root{--empty:#263137;--low:#3a514c;--mid:#507969;--high:#73a78f;--max:#9acdb4;--elephant:#9dc6d5;--ink:#a3b0ac;--surface:#191f24}}
@media(prefers-reduced-motion:reduce){.animated{display:none}.still{display:inline}}
text{font-family:Consolas,monospace;font-size:10px;fill:var(--ink)}
.level-0{fill:var(--empty)}.level-1{fill:var(--low)}.level-2{fill:var(--mid)}.level-3{fill:var(--high)}.level-4{fill:var(--max)}
</style>
${months}${weekdays}
${empty}
<g class="still" display="none">
${daysStatic}
<g transform="translate(32 86)" color="var(--elephant)">${elephant}${trunk}</path></g>
</g>
<g class="animated">
${tiles}
<g transform="translate(32 86)" color="var(--elephant)">${elephant}${trunk}${trunkMotion}</path></g>
</g>
</svg>\n`;
fs.writeFileSync(path.join(root, 'profile-contributions.svg'), svg);
console.log(`Rendered ${grid.length} dates with ${targets.length} active days and ${total} contributions.`);
