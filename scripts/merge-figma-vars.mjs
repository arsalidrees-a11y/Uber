#!/usr/bin/env node
/* Merge a fresh Figma Variables dump into tokens/figma.raw.json.
 *
 * WHY THIS EXISTS
 *   The pull used to be hand-merged, which meant nobody could see what a
 *   Figma change actually did to the tokens. This makes the pull auditable:
 *   it reports added, changed and removed variables before writing, and it
 *   never silently clobbers the derived values we own.
 *
 * USAGE
 *   1. In the Figma desktop app, select the node you want.
 *   2. Call the Figma MCP tool get_variable_defs.
 *   3. Save its JSON verbatim to tokens/incoming.json
 *   4. npm run tokens:merge            (add --write to actually apply)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const RAW = 'tokens/figma.raw.json';
const IN = process.argv.find((a) => a.startsWith('--in='))?.slice(5) || 'tokens/incoming.json';
const WRITE = process.argv.includes('--write');

if (!existsSync(IN)) {
  console.error(`no ${IN}\n\n  1. select the node in Figma\n  2. call the MCP tool get_variable_defs\n  3. save its JSON verbatim to ${IN}`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(RAW, 'utf8'));
let incoming = JSON.parse(readFileSync(IN, 'utf8'));
/* Accept either a bare map or a full dump with a variables key. */
if (incoming.variables) incoming = incoming.variables;

/* Values we authored ourselves, recorded in _meta.derived. A Figma pull must
   never overwrite these, or the overlay scale silently reverts. */
const derivedNames = new Set((raw._meta.derived || []).map((d) => d.split(' - ')[0].trim()));

const skipName = (n) => n.startsWith('_') || /DEPRECATED/i.test(n);

const added = [], changed = [], protectedHits = [], ignored = [];
for (const [name, value] of Object.entries(incoming)) {
  if (skipName(name)) { ignored.push(name); continue; }
  if (derivedNames.has(name)) { protectedHits.push(name); continue; }
  if (!(name in raw.variables)) added.push([name, value]);
  else if (raw.variables[name] !== value) changed.push([name, raw.variables[name], value]);
}
/* Removed only means "absent from this pull". A pull scoped to one node does
   not see the whole file, so this is reported, never acted on. */
const incomingNames = new Set(Object.keys(incoming));
const absent = Object.keys(raw.variables)
  .filter((n) => !incomingNames.has(n) && !derivedNames.has(n) && !skipName(n));

const show = (label, rows) => {
  if (!rows.length) return;
  console.log(`\n  ${label} (${rows.length})`);
  rows.slice(0, 25).forEach((r) => console.log('    ' + (Array.isArray(r)
    ? (r.length === 3 ? `${r[0]}\n        ${r[1]}  ->  ${r[2]}` : `${r[0]} = ${r[1]}`)
    : r)));
  if (rows.length > 25) console.log(`    ... and ${rows.length - 25} more`);
};

show('ADDED', added);
show('CHANGED', changed);
show('PROTECTED, left alone (derived, see _meta.derived)', protectedHits);
show('IGNORED (underscore or DEPRECATED prefix)', ignored);
if (absent.length) {
  console.log(`\n  NOT IN THIS PULL (${absent.length}) - reported only, nothing removed.`);
  console.log('    A node-scoped pull does not see the whole file, so absence is not deletion.');
}

if (!added.length && !changed.length) {
  console.log('\n  no token changes\n');
  process.exit(0);
}

if (!WRITE) {
  console.log(`\n  dry run. re-run with --write to apply, then: npm run tokens\n`);
  process.exit(0);
}

for (const [n, v] of added) raw.variables[n] = v;
for (const [n, , v] of changed) raw.variables[n] = v;
raw._meta.pulledOn = process.env.PULL_DATE || raw._meta.pulledOn;
writeFileSync(RAW, JSON.stringify(raw, null, 2) + '\n');
console.log(`\n  applied ${added.length} added, ${changed.length} changed -> ${RAW}`);
console.log('  next: npm run tokens && npm run check\n');
