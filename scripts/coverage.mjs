#!/usr/bin/env node
/* Coverage at VARIANT level: every distinct component instance name found in
   the Figma file, matched to the CSS file that implements it.
   Run: npm run coverage        Fails if a mapping points at a missing file. */
import { existsSync, readFileSync } from 'node:fs';

/* Longest prefix wins, so "Date picker / Web" resolves before "Date picker". */
const MAP = [
  ['Menu item control',  'menu'],            ['Menu item',            'menu'],
  ['Menu',               'menu'],            ['Date picker element',  'date-picker'],
  ['Date picker',        'date-picker'],     ['Time picker element',  'time-picker'],
  ['Time picker',        'time-picker'],     ['Progress steps',       'progress'],
  ['Progress bar',       'progress'],        ['Progress pill',        'progress'],
  ['Progress circle',    'progress-ring'],   ['Card element',         'card'],
  ['Card / Feed',        'card'],            ['Card / Isolated',      'card'],
  ['Message card - Carousel', 'carousel'],   ['Message card',         'message-card'],
  ['System banner',      'banner'],          ['Banner',               'banner'],
  ['Segmented slider',   'segmented-slider'],['Slider',               'slider'],
  ['Knob',               'slider'],          ['Sliding button',       'sliding-button'],
  ['Timed button',       'timed-button'],    ['Button dock',          'button-dock'],
  ['Button group',       'segmented'],       ['Button',               'button'],
  ['Tab element',        'tabs'],            ['Tabs',                 'tabs'],
  ['Side navigation',    'side-nav'],        ['Bottom navigation',    'navigation'],
  ['Navigation header',  'navigation'],      ['Sheet header',         'sheet'],
  ['Modal sheet',        'sheet'],           ['Modal full screen',    'dialog'],
  ['Modal overlay',      'dialog'],          ['Dialog',               'dialog'],
  ['Grabber',            'grabber'],         ['Draggable list',       'draggable-list'],
  ['Divider',            'divider'],         ['Section heading',      'divider'],
  ['Notification badge', 'badge'],           ['Hint badge',           'hint-badge'],
  ['Breadcrumbs',        'breadcrumbs'],     ['Pagination',           'pagination'],
  ['Page controls',      'page-control'],    ['Star rating',          'star-rating'],
  ['Empty state',        'empty-state'],     ['File drop',            'file-drop'],
  ['Password field',     'password-field'],  ['Country field',        'country-field'],
  ['PIN code',           'pin-code'],        ['Stepper field',        'stepper'],
  ['Stepper',            'stepper'],         ['Search field',         'input'],
  ['Text field',         'input'],           ['Text area',            'input'],
  ['Field group',        'input'],           ['Select',               'select'],
  ['Rich text',          'rich-text'],       ['Accordion',            'accordion'],
  ['Tooltip',            'tooltip'],         ['Snackbar',             'snackbar'],
  ['List heading',       'list-item'],       ['List item',            'list-item'],
  ['Avatar',             'avatar'],          ['Tile',                 'tile'],
  ['Tag',                'tag'],             ['Check',                'control'],
  ['Radio',              'control'],         ['Switch',               'control'],
];
const TOKENS = ['Typography', 'Spacer'];
const NA = { 'Doc header': 'documentation chrome', 'arrow_right': 'icon',
             'Placeholder': 'placeholder frame', '_ Primitive Scale - NEW': 'token scale' };

const src = process.argv[2] || 'tokens/figma.instances.json';
if (!existsSync(src)) { console.error(`missing ${src}`); process.exit(1); }
const instances = JSON.parse(readFileSync(src, 'utf8'));

const rows = [], missingFiles = new Set();
for (const [name, count] of Object.entries(instances)) {
  if (NA[name] !== undefined) { rows.push([name, count, 'N/A', NA[name]]); continue; }
  if (TOKENS.some((t) => name.startsWith(t))) { rows.push([name, count, 'TOKENS', 'src/styles/tokens.css']); continue; }
  const hit = MAP.filter(([p]) => name.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
  if (!hit) { rows.push([name, count, 'MISSING', '']); continue; }
  const file = `src/components/${hit[1]}.css`;
  if (!existsSync(file)) missingFiles.add(file);
  rows.push([name, count, 'BUILT', file]);
}

const order = { MISSING: 0, BUILT: 1, TOKENS: 2, 'N/A': 3 };
rows.sort((a, b) => order[a[2]] - order[b[2]] || b[1] - a[1]);
const w = Math.max(...rows.map((r) => r[0].length));
for (const [n, c, st, note] of rows) {
  if (st === 'BUILT' && c < 4) continue;                 // keep the table readable
  console.log(`${st.padEnd(8)} ${String(c).padStart(4)}  ${n.padEnd(w)}  ${note}`);
}

const tally = rows.reduce((m, r) => ((m[r[2]] = (m[r[2]] || 0) + 1), m), {});
const inst = rows.reduce((m, r) => ((m[r[2]] = (m[r[2]] || 0) + r[1]), m), {});
console.log(`\n${rows.length} distinct component names, ${rows.reduce((n, r) => n + r[1], 0)} instances\n`);
for (const k of ['BUILT', 'TOKENS', 'N/A', 'MISSING']) {
  if (tally[k]) console.log(`  ${k.padEnd(8)} ${String(tally[k]).padStart(3)} names   ${String(inst[k]).padStart(5)} instances`);
}
const missNames = rows.filter((r) => r[2] === 'MISSING');
if (missNames.length) { console.log('\nUNMAPPED:'); missNames.forEach((r) => console.log('  ' + r[0])); }
if (missingFiles.size) { console.log('\nBROKEN MAPPINGS:'); missingFiles.forEach((f) => console.log('  ' + f)); process.exitCode = 1; }
