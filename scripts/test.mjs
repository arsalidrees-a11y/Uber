#!/usr/bin/env node
/* Headless behaviour tests. Loads the built, self-contained gallery and drives
   it with real events, so this verifies the same file we hand to Uber.
   Run: npm test   (build + gallery first) */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(readFileSync('dist/gallery.html', 'utf8'), {
  runScripts: 'dangerously', url: 'http://localhost/',
});
const { window } = dom;
const D = window.document;
const $ = (s) => D.querySelector(s);
const $$ = (s) => [...D.querySelectorAll(s)];
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

let pass = 0; const fails = [];
const t = (name, fn) => {
  try { const r = fn(); if (r === true) { pass++; } else fails.push(`${name}  ->  ${r}`); }
  catch (e) { fails.push(`${name}  ->  threw ${e.message}`); }
};
const eq = (a, b) => (a === b ? true : `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

/* jsdom parses synchronously, so DOMContentLoaded has usually already fired by
   the time we get here. Only wait if it genuinely has not. */
if (D.readyState === 'loading') {
  await new Promise((r) => window.addEventListener('DOMContentLoaded', r, { once: true }));
}

/* The gallery shows two calendars; scope every assertion to the first. */
const CAL = D.querySelector('.u-cal[data-u-calendar]');
const cq  = (sel) => CAL.querySelector(sel);
const cqa = (sel) => [...CAL.querySelectorAll(sel)];

t('behaviours loaded', () => (window.UberLearn ? true : 'window.UberLearn undefined'));

t('no native OS controls', () =>
  eq($$('select, input[type=date], input[type=time], input[type=datetime-local]').length, 0));

/* --- calendar renders real dates -------------------------------------- */
t('calendar renders September 2026', () => eq(cq('.u-cal__month').textContent, 'September 2026'));
t('calendar has 30 days in September', () => eq(cqa('.u-cal__day[data-date]').length, 30));
t('calendar leading blanks = Sep 1 2026 is a Tuesday', () =>
  eq(cqa('.u-cal__day[data-muted="true"]').length, 2));
t('calendar preselects data-value', () =>
  eq(cq('.u-cal__day[aria-selected="true"]').getAttribute('data-date'), '2026-09-12'));
t('calendar next month navigates', () => {
  click(cq('[data-cal-nav="1"]'));
  return eq(cq('.u-cal__month').textContent, 'October 2026');
});
t('calendar October has 31 days', () => eq(cqa('.u-cal__day[data-date]').length, 31));
t('calendar back to September', () => {
  click(cq('[data-cal-nav="-1"]'));
  return eq(cq('.u-cal__month').textContent, 'September 2026');
});
t('calendar day click fires u:datechange', () => {
  let got = null;
  CAL.addEventListener('u:datechange', (e) => { got = e.detail.value; });
  click(cq('.u-cal__day[data-date="2026-09-25"]'));
  return eq(got, '2026-09-25');
});

/* --- select replaces the OS wheel ------------------------------------- */
const sel = $$('.u-select').at(-1);
t('select opens', () => {
  click(sel.querySelector('.u-select__trigger'));
  return eq(sel.querySelector('.u-select__trigger').getAttribute('aria-expanded'), 'true');
});
t('select picks a value and closes', () => {
  click(sel.querySelectorAll('.u-select__opt')[1]);
  return sel.querySelector('.u-select__value').textContent === 'Safe pickups' &&
         sel.querySelector('.u-select__trigger').getAttribute('aria-expanded') === 'false'
    ? true : 'value or expanded state wrong';
});

/* --- knowledge check is ungraded and answer-once ----------------------- */
t('knowledge check marks wrong and reveals right', () => {
  const kc = $('.u-kc');
  click(kc.querySelector('.u-kc__opt[data-correct="false"]'));
  return kc.querySelector('[data-correct="false"]').getAttribute('data-state') === 'incorrect' &&
         kc.querySelector('[data-correct="true"]').getAttribute('data-state') === 'correct' &&
         !kc.querySelector('.u-kc__feedback').hidden ? true : 'states wrong';
});
t('knowledge check locks after one answer', () => {
  const kc = $('.u-kc');
  click(kc.querySelector('.u-kc__opt[data-correct="true"]'));
  return eq(kc.querySelector('[data-correct="true"]').getAttribute('aria-checked'), 'false');
});

/* --- segmented slider fills preceding stops ---------------------------- */
t('segmented slider fills up to the choice', () => {
  click($$('.u-segslider__stop')[1]);
  return eq($$('.u-segslider__stop').map((s) =>
    s.getAttribute('aria-checked') === 'true' ? 'X' : (s.getAttribute('data-filled') === 'true' ? '-' : '.')
  ).join(''), '-X...');
});

/* --- stepper clamps ----------------------------------------------------- */
t('stepper clamps at max', () => {
  const st = $('.u-stepper'); const plus = st.querySelector('[data-step="1"]');
  for (let i = 0; i < 20; i++) click(plus);
  return st.querySelector('.u-stepper__value').textContent === '9' && plus.disabled
    ? true : 'did not clamp';
});

/* --- keyboard reorder works without a pointer -------------------------- */
t('draggable list reorders with ArrowDown', () => {
  const list = $('#demo-drag');
  const before = [...list.children].map((c) => c.getAttribute('data-value')).join(',');
  const handle = list.firstElementChild.querySelector('.u-drag__grab');
  handle.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const after = [...list.children].map((c) => c.getAttribute('data-value')).join(',');
  return before === 'check,signal,slow,scan' && after === 'signal,check,slow,scan'
    ? true : `${before} -> ${after}`;
});
t('reorder renumbers the indices', () =>
  eq($$('#demo-drag .u-drag__index').map((n) => n.textContent).join(''), '1234'));

/* --- tabs and progress --------------------------------------------------- */
t('tabs swap selection', () => {
  const tabs = $$('.u-tabs .u-tab').slice(0, 4);
  click(tabs[2]);
  return eq(tabs.map((x) => x.getAttribute('aria-selected')).join(','), 'false,false,true,false');
});
t('declarative progress applied to ring', () =>
  eq($('.u-ring[data-u-progress]').style.getPropertyValue('--pct'), '68'));
t('snackbar can be created', () => {
  const s = window.UberLearn.snack('Saved', { actionLabel: 'Undo', duration: 9999 });
  const ok = !!s.querySelector('.u-snack__action'); s.remove(); return ok || 'no action button';
});

/* The sheet had CSS and behaviour but no specimen and no test, so nothing
   ever rendered it. That is why it shipped casting its shadow downward, off
   the bottom of the screen. */
t('sheet opens from a trigger and shows its scrim', () => {
  const sheet = D.getElementById('g-sheet');
  const scrim = D.querySelector('.u-scrim[data-for="g-sheet"]');
  if (!sheet) return 'no sheet specimen in the gallery';
  D.querySelector('[data-u-sheet-open="g-sheet"]').click();
  return (!sheet.hidden && !scrim.hidden) || 'sheet or scrim stayed hidden';
});

t('sheet closes on its close button', () => {
  const sheet = D.getElementById('g-sheet');
  D.querySelector('[data-u-sheet-open="g-sheet"]').click();
  if (sheet.hidden) return 'sheet never opened, so closing proves nothing';
  sheet.querySelector('[data-u-sheet-close]').click();
  return sheet.hidden || 'sheet stayed open';
});

t('sheet closes on Escape', () => {
  const sheet = D.getElementById('g-sheet');
  D.querySelector('[data-u-sheet-open="g-sheet"]').click();
  if (sheet.hidden) return 'sheet never opened, so closing proves nothing';
  D.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return sheet.hidden || 'Escape did not close the sheet';
});

t('sheet closes on a scrim tap', () => {
  const sheet = D.getElementById('g-sheet');
  const scrim = D.querySelector('.u-scrim[data-for="g-sheet"]');
  D.querySelector('[data-u-sheet-open="g-sheet"]').click();
  if (sheet.hidden) return 'sheet never opened, so closing proves nothing';
  scrim.click();
  return (sheet.hidden && scrim.hidden) || 'scrim tap did not close the sheet';
});

/* ---- regressions from the audit ------------------------------------- */

t('pinwheel columns get listbox roles', () => {
  const col = D.querySelector('.u-wheel__col');
  return col.getAttribute('role') === 'listbox' && !!col.getAttribute('aria-label')
    ? true : `role=${col.getAttribute('role')} label=${col.getAttribute('aria-label')}`;
});
t('pinwheel units get option roles and one tab stop', () => {
  const units = $$('.u-wheel__col:first-of-type .u-wheel__unit');
  const roles = units.every((u) => u.getAttribute('role') === 'option');
  const stops = units.filter((u) => u.getAttribute('tabindex') === '0').length;
  return roles && stops === 1 ? true : `roles=${roles} tabstops=${stops}`;
});
t('pinwheel click moves selection and fires u:timechange', () => {
  const col = D.querySelector('.u-wheel__col');
  const units = [...col.querySelectorAll('.u-wheel__unit')];
  const target = units.find((u) => u.getAttribute('aria-selected') !== 'true');
  let fired = null;
  col.addEventListener('u:timechange', (e) => { fired = e.detail.value; });
  click(target);
  return target.getAttribute('aria-selected') === 'true' &&
         col.querySelectorAll('[aria-selected="true"]').length === 1 &&
         fired === target.getAttribute('data-value')
    ? true : `selected=${target.getAttribute('aria-selected')} fired=${fired}`;
});

t('slide knob is a real button', () => eq(D.querySelector('.u-slide__knob').tagName, 'BUTTON'));
t('slide knob gets an aria-label', () =>
  (D.querySelector('.u-slide__knob').getAttribute('aria-label') || '').includes('Enter')
    ? true : 'no keyboard hint in aria-label');
t('slide confirms via Enter and reports via=keyboard', () => {
  const slide = D.querySelector('.u-slide');
  let via = null;
  slide.addEventListener('u:confirmed', (e) => { via = e.detail.via; });
  slide.querySelector('.u-slide__knob')
    .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return slide.getAttribute('data-confirmed') === 'true' && via === 'keyboard'
    ? true : `confirmed=${slide.getAttribute('data-confirmed')} via=${via}`;
});
t('slide will not confirm twice', () => {
  const slide = D.querySelector('.u-slide');
  let count = 0;
  slide.addEventListener('u:confirmed', () => { count++; });
  slide.querySelector('.u-slide__knob')
    .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return eq(count, 0);
});

/* ---- CSS regressions, asserted against the built stylesheet ---------- */
const CSS = readFileSync('dist/uber-learn.css', 'utf8');
/* Parse rules rather than regex the selector: a hand-built RegExp over
   selectors is where the previous version of this helper went wrong. */
const CSS_RULES = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
  selectors: m[1].split(',').map((x) => x.trim()).filter(Boolean),
  body: m[2],
}));
/* The minifier rewrites ::after to :after and strips attribute quotes, so
   compare on a normalised form rather than the authored spelling. */
const norm = (sel) => sel.replace(/::/g, ':').replace(/["']/g, '');
const rule = (sel) => CSS_RULES
  .filter((r) => r.selectors.some((s2) => norm(s2) === norm(sel)))
  .map((r) => r.body).join(';');

t('no colour literals survive in components', () => {
  const body = CSS.slice(CSS.indexOf('}', CSS.indexOf(':root')) + 1);
  const hits = [...body.matchAll(/#[0-9A-Fa-f]{3,8}\b|\brgba?\([^)]*\)/g)].map((m) => m[0]);
  return hits.length ? `found ${JSON.stringify([...new Set(hits)])}` : true;
});
t('no trailing-dot numbers', () => {
  const hits = [...CSS.matchAll(/:\s*-?\d+\.\s*[;)]/g)].map((m) => m[0]);
  return hits.length ? JSON.stringify(hits) : true;
});
t('overlays are fixed, not absolute', () => {
  const bad = ['.u-scrim', '.u-sheet', '.u-dialog', '.u-fullscreen']
    .filter((s) => /position:\s*absolute/.test(rule(s)));
  return bad.length ? bad.join(', ') : true;
});
t('web-only halves are hidden without a scope class', () =>
  ['.u-time', '.u-sidenav', '.u-dialog'].every((s) => /display:\s*none/.test(rule(s)))
    ? true : 'a web-only component is visible by default');
t('touch-action sits on the drag handle, not the row', () =>
  /touch-action:\s*none/.test(rule('.u-drag__grab')) &&
  !/touch-action:\s*none/.test(rule('.u-drag__item'))
    ? true : 'touch-action is on the wrong element');
t('carousel dots have a 24px target', () =>
  /width:\s*24px/.test(rule('.u-pages__d::after')) &&
  /height:\s*24px/.test(rule('.u-pages__d::after'))
    ? true : `::after body was ${JSON.stringify(rule('.u-pages__d::after'))}`);
t('safe-area is viable (viewport-fit=cover present)', () =>
  readFileSync('index.html', 'utf8').includes('viewport-fit=cover')
    ? true : 'meta viewport lacks viewport-fit=cover');

console.log(`\n  ${pass} passed, ${fails.length} failed\n`);
if (fails.length) { fails.forEach((f) => console.log('  FAIL  ' + f)); process.exitCode = 1; }
else console.log('  PASS  all behaviours verified headlessly');

window.close();   /* release jsdom timers so node can exit */
