#!/usr/bin/env node
/* Static checks that do not need a browser:
     1. every u- class used in markup is defined in the CSS
     2. every var(--u-*) reference resolves to a definition
     3. no hardcoded hex outside the generated token block
     4. no native OS-rendered form controls in the markup
   Run: npm run validate */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const css = readFileSync('dist/uber-learn.css', 'utf8');
const htmlFiles = ['index.html', ...readdirSync('lessons').map((f) => `lessons/${f}`)];
const fail = [];

/* 1. classes */
const defined = new Set([...css.matchAll(/\.(u-[a-z0-9_-]+)/g)].map((m) => m[1]));
const usedBy = new Map();
for (const f of htmlFiles) {
  for (const m of readFileSync(f, 'utf8').matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (!c.startsWith('u-') || c.startsWith('u-btn--') === false && false) continue;
      if (!defined.has(c)) usedBy.set(c, (usedBy.get(c) || new Set()).add(f));
    }
  }
}
if (usedBy.size) fail.push(['undefined classes', [...usedBy].map(([c, s]) => `${c}  (${[...s].join(', ')})`)]);

/* 2. variables */
const declared = new Set([...css.matchAll(/(--u-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const referenced = new Set([...css.matchAll(/var\((--u-[a-z0-9-]+)/g)].map((m) => m[1]));
const localScoped = new Set(['--pct', '--size', '--knob', '--slide', '--timed']);
const unresolved = [...referenced].filter((v) => !declared.has(v) && !localScoped.has(v));
if (unresolved.length) fail.push(['unresolved css variables', unresolved]);

/* 3. hardcoded colour outside :root - ALL notations, not just hex.
      The hex-only version of this gate let six rgb() literals ship. */
const body = css.slice(css.indexOf('}', css.indexOf(':root')) + 1);
const literals = [
  ...body.matchAll(/#[0-9A-Fa-f]{3,8}\b/g),
  ...body.matchAll(/\brgba?\([^)]*\)/g),
  ...body.matchAll(/\bhsla?\([^)]*\)/g),
].map((m) => m[0]).filter((v) => !/^rgba?\(\s*(from|var)/.test(v));
if (literals.length) fail.push(['hardcoded colour outside :root', [...new Set(literals)]]);

/* 4. trailing-dot numbers, e.g. "1." - invalid CSS, silently drops the rule.
      Produced by .toFixed().replace(/0+$/,'') before it was fixed. */
const dotty = [...css.matchAll(/:\s*-?\d+\.\s*[;)]/g)].map((m) => m[0].trim());
if (dotty.length) fail.push(['trailing-dot numbers (invalid CSS)', [...new Set(dotty)]]);

/* 5. Overlays must be fixed, not absolute: absolute anchors to the nearest
      positioned ancestor and renders off-screen on a scrolled lesson.
      The --inline demo variants are the only permitted exception. */
const overlayAbs = [];
for (const sel of ['.u-scrim', '.u-sheet', '.u-dialog', '.u-fullscreen']) {
  const re = new RegExp(`\\${sel}\\s*\\{[^}]*position:\\s*absolute`, 'g');
  if (re.test(css)) overlayAbs.push(`${sel} uses position:absolute`);
}
if (overlayAbs.length) fail.push(['overlay anchored to absolute', overlayAbs]);

/* 6. env(safe-area-inset-*) is inert without viewport-fit=cover. */
if (css.includes('env(safe-area-inset') && !readFileSync('index.html', 'utf8').includes('viewport-fit=cover')) {
  fail.push(['safe-area used but viewport-fit=cover missing', ['index.html meta viewport']]);
}

/* 7. Every .u-web-gated component needs a default (mobile) rule, or a page
      that sets no scope class renders both halves of the pair at once.
      The check must look for the class as a STANDALONE selector. An earlier
      version matched the `.u-web .u-x` rule itself and so never fired. */
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
  selectors: m[1].split(',').map((x) => x.trim()).filter(Boolean),
  body: m[2],
}));
const hiddenBare = (cls) => rules.some((r) =>
  r.selectors.includes(`.${cls}`) && /display\s*:\s*none/.test(r.body));

/* Only the half that .u-web REVEALS needs a bare rule hiding it by default.
   The half .u-web hides is the mobile default and is correctly visible with
   no declaration at all. */
const revealed = [...new Set(
  rules.flatMap((r) => r.selectors
    .filter((sel) => /^\.u-web\s+\.u-[a-z-]+$/.test(sel))
    .filter(() => /display\s*:\s*(?!none)[a-z-]/.test(r.body))
    .map((sel) => sel.split(/\s+/)[1].slice(1))),
)];
const ungated = revealed.filter((c) => !hiddenBare(c));
if (ungated.length) fail.push(['.u-web-revealed component not hidden by default', ungated]);

/* 8. native OS controls - these render unbrandable platform UI */
const native = [];
for (const f of htmlFiles) {
  const src = readFileSync(f, 'utf8');
  for (const pat of [/<select[\s>]/g, /type="date"/g, /type="time"/g, /type="datetime-local"/g]) {
    if (pat.test(src)) native.push(`${f}: ${String(pat).slice(1, -2)}`);
  }
}
if (native.length) fail.push(['native OS controls in markup', native]);

const counts = {
  'component css files': readdirSync('src/components').length,
  'classes defined': defined.size,
  'tokens declared': declared.size,
  'css bytes': css.length,
};
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(22)} ${v}`);

if (!fail.length) {
  console.log('\nPASS  classes defined, vars resolve, no colour literals, no trailing-dot numbers,');
  console.log('      overlays fixed-positioned, safe-area viable, web/mobile pairs defaulted,');
  console.log('      no native OS controls');
}
else {
  console.log('');
  for (const [title, items] of fail) {
    console.log(`FAIL  ${title} (${items.length})`);
    items.slice(0, 12).forEach((i) => console.log('        ' + i));
  }
  process.exitCode = 1;
}
