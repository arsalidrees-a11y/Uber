#!/usr/bin/env node
/* Fast source-level lint. No build required, runs in milliseconds, so it is
 * safe to wire to a file-save hook.
 *
 * Catches the mistakes that the audit found shipping:
 *   - colour literals in any notation
 *   - --u-* tokens that do not exist
 *   - hover rules outside a pointer media query
 *   - native OS form controls in markup
 *   - trailing-dot numbers
 * Run: npm run lint
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const fail = [];
const tokensCss = existsSync('src/styles/tokens.css') ? readFileSync('src/styles/tokens.css', 'utf8') : '';
const declared = new Set([...tokensCss.matchAll(/(--u-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const localVars = new Set(['--pct', '--size', '--knob', '--slide', '--timed', '--tag-solid',
  '--tag-soft', '--tag-ink', '--u-target', '--u-gutter', '--u-modality', '--kn']);

const files = readdirSync('src/components').filter((f) => f.endsWith('.css'))
  .map((f) => `src/components/${f}`)
  .concat(['src/styles/base.css', 'src/styles/responsive.css'].filter(existsSync));

for (const f of files) {
  const css = readFileSync(f, 'utf8');
  const lines = css.split('\n');

  lines.forEach((line, i) => {
    const at = `${f}:${i + 1}`;
    if (line.trim().startsWith('/*') || line.trim().startsWith('*')) return;

    for (const m of line.matchAll(/#[0-9A-Fa-f]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g)) {
      if (/^rgba?\(\s*(from|var)/.test(m[0])) continue;
      fail.push([at, `colour literal ${m[0]} - use a --u-* token`]);
    }
    for (const m of line.matchAll(/:\s*-?\d+\.\s*[;)]/g)) {
      fail.push([at, `trailing-dot number "${m[0].trim()}" is invalid CSS`]);
    }
    for (const m of line.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!declared.has(m[1]) && !localVars.has(m[1])) {
        fail.push([at, `unknown variable ${m[1]}`]);
      }
    }
  });

  /* :hover must sit inside a pointer query - a webview never resolves hover. */
  const guarded = [];
  let depth = 0, inPointerQuery = false;
  lines.forEach((line, i) => {
    if (/@media[^{]*hover:\s*hover/.test(line)) { inPointerQuery = true; depth = 0; }
    if (inPointerQuery) {
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (depth <= 0 && /\}/.test(line)) inPointerQuery = false;
    }
    if (/:hover/.test(line) && !inPointerQuery && !/@media/.test(line)) {
      guarded.push(`${f}:${i + 1}`);
    }
  });
  guarded.forEach((at) => fail.push([at, ':hover outside @media (hover: hover) - a webview has no hover']));
}

/* Asset tags in unit templates. Both fail silently in Open edX: TinyMCE
   deletes <link rel=stylesheet>, and every unit is its own iframe so a
   per-unit asset reference cannot serve the rest of the course. The kit is
   loaded through course_wide_css / course_wide_js instead. */
if (existsSync('lessons')) {
  for (const f of readdirSync('lessons').filter((x) => x.endsWith('.html'))) {
    const src = readFileSync(`lessons/${f}`, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (line.trim().startsWith('*') || /^\s*\d\./.test(line)) return;   // explanatory comment body
      if (/<link[^>]+rel=["']?stylesheet/i.test(line)) {
        fail.push([`lessons/${f}:${i + 1}`, '<link rel=stylesheet> is deleted by Studio TinyMCE - use course_wide_css']);
      }
      if (/<script[^>]+src=/i.test(line)) {
        fail.push([`lessons/${f}:${i + 1}`, '<script src> cannot serve other units (each unit is its own iframe) - use course_wide_js']);
      }
    });
  }
}

/* Native OS controls in any shipped markup. */
const html = ['index.html', ...(existsSync('lessons') ? readdirSync('lessons').map((f) => `lessons/${f}`) : [])]
  .filter((f) => existsSync(f) && f.endsWith('.html'));
for (const f of html) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (/<select[\s>]|type="(date|time|datetime-local)"/.test(line)) {
      fail.push([`${f}:${i + 1}`, 'native OS control - use u-select, u-cal or u-time']);
    }
  });
}

console.log(`  linted ${files.length} stylesheets, ${html.length} html files, ${declared.size} tokens`);
if (!fail.length) { console.log('  PASS'); process.exit(0); }
console.log(`\n  ${fail.length} problem(s):`);
fail.slice(0, 40).forEach(([at, msg]) => console.log(`    ${at}  ${msg}`));
if (fail.length > 40) console.log(`    ... and ${fail.length - 40} more`);
process.exit(1);
