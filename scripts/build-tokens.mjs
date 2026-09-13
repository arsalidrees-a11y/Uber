#!/usr/bin/env node
/**
 * Figma Variables -> CSS custom properties.
 *
 * Input :  tokens/figma.raw.json   (verbatim dump from the Figma MCP server)
 * Output:  src/styles/tokens.css   (generated - never hand-edit)
 *
 * Refresh with:  npm run tokens
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IN = resolve(ROOT, 'tokens/figma.raw.json');
const OUT = resolve(ROOT, 'src/styles/tokens.css');

/* Uber Move is proprietary and is not redistributable by a vendor.
   Every generated family therefore ends in a system fallback stack. */
const FALLBACK = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const MONO_FALLBACK = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`;

const ALIASES = { primitives: null, programs: 'program' };

/** "Background++/backgroundAccentLight" -> "background-accent-light" */
function normalise(name) {
  const words = name
    .replace(/\+\+/g, '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((seg) =>
      seg
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[\s_]+/)
        .filter(Boolean)
        .map((w) => w.toLowerCase()),
    );

  // When the leaf segment already contains every group word, keep the LEAF's
  // own word order. "Inverse / Content / contentInversePrimary" then yields
  // content-inverse-primary, which is Base's canonical token name, rather than
  // inverse-content-primary.
  const segs = name.replace(/\+\+/g, '').split('/').map((s) => s.trim()).filter(Boolean);
  const split = (seg) => seg.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_]+/).filter(Boolean).map((w) => w.toLowerCase());
  const leaf = split(segs[segs.length - 1]);
  const groups = segs.slice(0, -1).flatMap(split).filter((w) => !(w in ALIASES));
  if (groups.length && groups.every((g) => leaf.includes(g))) {
    return [...new Set(leaf)].join('-');
  }

  const out = [];
  for (const w of words) {
    if (out.includes(w)) continue;            // collapse "content / contentPrimary"
    if (w in ALIASES) {
      if (ALIASES[w] === null) continue;      // drop "primitives"
      out.push(ALIASES[w]);
      continue;
    }
    out.push(w);
  }
  return out.join('-');
}

const parseFont = (v) => {
  const m = v.match(
    /family:\s*"([^"]+)",\s*style:\s*([^,]+),\s*size:\s*([\d.]+),\s*weight:\s*([\d.]+),\s*lineHeight:\s*([\d.]+),\s*letterSpacing:\s*(-?[\d.]+)/,
  );
  if (!m) return null;
  const [, family, style, size, weight, lineHeight, letterSpacing] = m;
  return { family, style: style.trim(), size: +size, weight: +weight, lineHeight: +lineHeight, letterSpacing: +letterSpacing };
};

const parseEffect = (v) => {
  const m = v.match(
    /type:\s*(\w+),\s*color:\s*(#[0-9A-Fa-f]{6,8}),\s*offset:\s*\((-?[\d.]+),\s*(-?[\d.]+)\),\s*radius:\s*([\d.]+),\s*spread:\s*(-?[\d.]+)/,
  );
  if (!m) return null;
  const [, type, color, x, y, radius, spread] = m;
  return { type, color, x: +x, y: +y, radius: +radius, spread: +spread };
};

/** Trim to `dp` decimals WITHOUT leaving a bare trailing dot.
 *  `(1).toFixed(3).replace(/0+$/,'')` yields "1." which is invalid CSS and
 *  makes the browser drop the whole declaration silently. */
const num = (n, dp) => String(Number(Number(n).toFixed(dp)));

/** #RRGGBBAA -> rgb(r g b / a) so it stays readable in devtools */
function hexToCss(hex) {
  if (hex.length !== 9) return hex;
  const [r, g, b, a] = [1, 3, 5, 7].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${num(a / 255, 4)})`;
}

const stack = (family) =>
  `"${family}", ${/Mono/i.test(family) ? MONO_FALLBACK : FALLBACK}`;

// ---------------------------------------------------------------- build

const raw = JSON.parse(readFileSync(IN, 'utf8'));
const colors = [];
const types = [];
const shadows = [];
const numbers = [];
const skipped = [];

for (const [name, value] of Object.entries(raw.variables)) {
  if (value === '' || value == null || name.startsWith('_') || /DEPRECATED/i.test(name)) continue;
  const key = normalise(name);

  /* Figma FLOAT and BOOLEAN variables arrive as real numbers/bools, not
     strings. Handle them instead of throwing on .startsWith. */
  if (typeof value === 'number') { numbers.push([key, value]); continue; }
  if (typeof value === 'boolean') { skipped.push(`${name} (boolean)`); continue; }
  if (typeof value !== 'string') { skipped.push(`${name} (${typeof value})`); continue; }

  if (value.startsWith('Font(')) {
    const f = parseFont(value);
    f ? types.push([`type-${key}`, f]) : skipped.push(`${name} (unparsed Font)`);
  } else if (value.startsWith('Effect(')) {
    const e = parseEffect(value);
    if (e && e.type === 'DROP_SHADOW') shadows.push([`shadow-${key}`, e]);
    else if (!e) skipped.push(`${name} (unparsed Effect)`);
  } else if (value.startsWith('#')) {
    colors.push([key, hexToCss(value)]);   // 8-digit hex -> rgb(... / a)
  } else {
    skipped.push(`${name} (unrecognised: ${String(value).slice(0, 40)})`);
  }
}

/* Collisions are silent data loss: two Figma variables normalising to one
   custom property means the last one wins and nobody notices. */
const seenKeys = new Map();
for (const [k] of [...colors, ...types, ...shadows, ...numbers]) {
  seenKeys.set(k, (seenKeys.get(k) || 0) + 1);
}
const collisions = [...seenKeys].filter(([, n]) => n > 1).map(([k]) => k);

colors.sort(([a], [b]) => a.localeCompare(b));
types.sort(([a], [b]) => a.localeCompare(b));

const pad = (rows) => Math.max(...rows.map(([k]) => k.length));
const w = pad(colors);

let css = `/* ----------------------------------------------------------------------
 * GENERATED FILE - DO NOT EDIT
 * Source : ${raw._meta.source}
 * Node   : ${raw._meta.nodeId} (${raw._meta.nodeName})
 * Pulled : ${raw._meta.pulledOn}
 * Rebuild: npm run tokens
 * -------------------------------------------------------------------- */

:root {
  /* --- colour ------------------------------------------------------- */
${colors.map(([k, v]) => `  --u-${k.padEnd(w)} : ${v};`).join('\n')}

  /* --- elevation ---------------------------------------------------- */
${shadows.map(([k, e]) => `  --u-${k}: ${e.x}px ${e.y}px ${e.radius}px ${e.spread}px ${hexToCss(e.color)};`).join('\n')}

  /* --- type --------------------------------------------------------- */
${types
  .map(
    ([k, f]) =>
      `  --u-${k}-family: ${stack(f.family)};\n` +
      `  --u-${k}-size: ${num(f.size / 16, 5)}rem;\n` +
      `  --u-${k}-weight: ${f.weight};\n` +
      `  --u-${k}-leading: ${num(f.lineHeight / f.size, 4)};\n` +
      `  --u-${k}-tracking: ${f.letterSpacing}px;`,
  )
  .join('\n')}

  /* --- numeric variables straight from Figma ------------------------ */
${numbers.map(([k, v]) => `  --u-${k}: ${num(v, 4)};`).join('\n') || '  /* none in this pull */'}

  /* --- spacing (Base 4pt grid) -------------------------------------- */
${[0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80].map((n) => `  --u-space-${n}: ${n / 16}rem;`).join('\n')}

  /* --- radius ------------------------------------------------------- */
  --u-radius-none: 0;
  --u-radius-xs: 0.25rem;
  --u-radius-sm: 0.5rem;
  --u-radius-md: 0.75rem;
  --u-radius-lg: 1rem;
  --u-radius-xl: 1.5rem;
  --u-radius-pill: 999px;

  /* --- motion ------------------------------------------------------- */
  --u-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --u-ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --u-duration-fast: 120ms;
  --u-duration-base: 200ms;
  --u-duration-slow: 320ms;
}

/* Typography utilities - one class per Figma text style. */
${types
  .map(([k]) => {
    const cls = k.replace(/^type-/, '');
    return `.u-${cls} {\n  font-family: var(--u-${k}-family);\n  font-size: var(--u-${k}-size);\n  font-weight: var(--u-${k}-weight);\n  line-height: var(--u-${k}-leading);\n  letter-spacing: var(--u-${k}-tracking);\n}`;
  })
  .join('\n')}
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, css);

console.log(
  `tokens.css written\n  ${colors.length} colours\n  ${types.length} text styles\n` +
  `  ${shadows.length} shadows\n  ${numbers.length} numbers`,
);
if (skipped.length) {
  console.log(`\n  SKIPPED ${skipped.length} variables the compiler did not understand:`);
  skipped.forEach((s) => console.log('    ' + s));
}
if (collisions.length) {
  console.error(`\n  FAIL name collisions - two Figma variables map to one property:`);
  collisions.forEach((c) => console.error('    --u-' + c));
  process.exitCode = 1;
}
