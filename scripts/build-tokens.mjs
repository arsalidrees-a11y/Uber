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
const IN_LAYOUT = resolve(ROOT, 'tokens/figma.layout.json');
const IN_ELEVATION = resolve(ROOT, 'tokens/figma.elevation.json');
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

/* Spacing and Layout live in their own Figma collections, dumped separately
   because they are numbers rather than the paint/type variables the main pull
   carries. Both are generated from that dump - never hand-written here, or the
   Spacing Sheet and Layout Sheet would document something the CSS does not do. */
const layoutRaw = JSON.parse(readFileSync(IN_LAYOUT, 'utf8'));

/* Elevation is effect STYLES in Figma, not variables, so it never arrives in
   the colour and type pull. It is dumped separately and is the ONLY source of
   --u-shadow-*: the three Effect() entries that used to sit in figma.raw.json
   were removed so the two cannot disagree. Those carried alpha as 8-bit hex,
   which quantised 12% to 0.1216; this dump keeps the design's own 0.12. */
const elevationRaw = JSON.parse(readFileSync(IN_ELEVATION, 'utf8'));
const SHADOWS = elevationRaw.styles.map((s) => [
  s.token,
  `${num(s.x, 4)}px ${num(s.y, 4)}px ${num(s.blur, 4)}px ${num(s.spread, 4)}px rgb(0 0 0 / ${num(s.alpha, 4)})`,
]);

/** "Spacer / 012" -> 12. Sorted, de-duplicated, ascending. */
const SPACE = [...new Set(Object.values(layoutRaw.spacing))].sort((a, b) => a - b);

/* Uber ships the matrix as density x breakpoint. CSS has only one axis of
   media queries, so density becomes a class and breakpoint becomes the query. */
const LAYOUT = (() => {
  const { modes, vars } = layoutRaw.layout;
  const at = (density, bp) => {
    const i = modes.indexOf(`${density} / ${bp}`);
    if (i < 0) throw new Error(`layout dump is missing mode "${density} / ${bp}"`);
    return { cols: vars.Columns[i], margin: vars.Margin[i], gutter: vars.Gutter[i], min: vars['Breakpoint min'][i] };
  };
  const bps = ['Small', 'Medium', 'Large'];
  return {
    bps,
    mins: Object.fromEntries(bps.map((b) => [b, at('Standard', b).min])),
    Standard: Object.fromEntries(bps.map((b) => [b, at('Standard', b)])),
    Compact: Object.fromEntries(bps.map((b) => [b, at('Compact', b)])),
  };
})();

const rem = (px) => `${num(px / 16, 5)}rem`;
/** The three layout properties for one density at one breakpoint. */
const layoutVars = (d, bp, indent) => {
  const v = LAYOUT[d][bp];
  return [
    `${indent}--u-cols: ${v.cols};`,
    `${indent}--u-margin: ${rem(v.margin)};`,
    `${indent}--u-gutter: ${rem(v.gutter)};`,
  ].join('\n');
};

const colors = [];
const types = [];
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
    /* Elevation comes from tokens/figma.elevation.json, which carries the full
       six-step ramp at full alpha precision. An Effect() here would be a
       partial, hex-quantised duplicate of it, so refuse rather than shadow it. */
    skipped.push(`${name} (Effect - elevation belongs in tokens/figma.elevation.json)`);
  } else if (value.startsWith('#')) {
    colors.push([key, hexToCss(value)]);   // 8-digit hex -> rgb(... / a)
  } else {
    skipped.push(`${name} (unrecognised: ${String(value).slice(0, 40)})`);
  }
}

/* Collisions are silent data loss: two Figma variables normalising to one
   custom property means the last one wins and nobody notices. */
const seenKeys = new Map();
for (const [k] of [...colors, ...types, ...SHADOWS, ...numbers]) {
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
${SHADOWS.map(([k, v]) => `  --u-${k}: ${v};`).join('\n')}

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

  /* --- spacing (Figma "Spacing" collection, 4pt baseline) ------------
     13 Spacer values are Uber's own; 0/2/4/8 are sub-spacer values that
     exist only because CSS needs hairlines and inline offsets. */
${SPACE.map((n) => `  --u-space-${n}: ${rem(n)};`).join('\n')}

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

  /* --- layout ------------------------------------------------------- */
${LAYOUT.bps.map((b) => `  --u-bp-${b.toLowerCase()}: ${LAYOUT.mins[b]}px;`).join('\n')}

  /* Standard density at Small. The shipping target is a 390px webview, so
     the phone grid is the default and needs no class to opt into. */
${layoutVars('Standard', 'Small', '  ')}
}

/* Breakpoints widen the grid. Mobile-first: each query only moves up. */
@media (min-width: ${LAYOUT.mins.Medium}px) {
  :root {
${layoutVars('Standard', 'Medium', '    ')}
  }
}
@media (min-width: ${LAYOUT.mins.Large}px) {
  :root {
${layoutVars('Standard', 'Large', '    ')}
  }
}

/* Compact density - Uber's second matrix, not a different scale. */
.u-density-compact {
${layoutVars('Compact', 'Small', '  ')}
}
@media (min-width: ${LAYOUT.mins.Medium}px) {
  .u-density-compact {
${layoutVars('Compact', 'Medium', '    ')}
  }
}
@media (min-width: ${LAYOUT.mins.Large}px) {
  .u-density-compact {
${layoutVars('Compact', 'Large', '    ')}
  }
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
  `  ${SHADOWS.length} shadows\n  ${numbers.length} numbers`,
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
