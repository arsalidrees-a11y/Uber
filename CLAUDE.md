# uber-learn

Uber-branded component kit for the Edly x Uber Open edX safety pilot.

## Delivery

Two static assets plus HTML snippets. How they are wired matters, and the
obvious way does not work. All of this is verified against openedx-platform
source, not docs prose.

    dist/uber-learn.css  ->  Files & Uploads  ->  Advanced Settings: course_wide_css
    dist/uber-learn.js   ->  Files & Uploads  ->  Advanced Settings: course_wide_js
    lessons/*.template.html  ->  HTML XBlock units, with NO asset tags

**Never put `<link>` or `<script src>` for the kit inside unit markup.**
Two independent reasons:

1. `frontend-app-learning` renders every unit in **its own iframe**, a separate
   document. An asset tag in unit 1 does nothing for unit 2. There is no such
   thing as "reference it once per course" from inside unit content.
2. Studio's TinyMCE editor **silently deletes** `<link rel="stylesheet">`,
   because `<link>` is not a valid child of `<body>` in its HTML5 schema.

Use the course-wide hooks instead. They are in Studio under Settings then
Advanced Settings as "Course-wide custom css" and "Course-wide custom js",
they need no feature flag, and they ARE injected into each unit iframe. They
exist from the Maple release onward and are absent in Lilac.

**Course-wide values need the full asset path, not `/static/`.** Those fields
are emitted raw into the attribute and never pass through the static-URL
rewrite. Copy the exact URL from the Files & Uploads table:

    /asset-v1:<org>+<course>+<run>+type@asset+block@uber-learn.css

`/static/<filename>` is still correct and is rewritten properly for assets
referenced from **inside** unit markup: images, fonts, the caption files.

Leave both assets UNLOCKED in Files & Uploads. The content server gates locked
assets behind enrollment checks.

## What is confirmed, and what is still a risk

Confirmed by reading the platform source:

- Inline `<script>` in a unit **does** execute. The fragment is rendered
  server-side into the iframe document by Mako.
- There is **no** sanitiser or allowlist on the built-in `html` block. No CSP
  is enabled by default.
- A relative `fetch` from a unit resolves against the LMS origin. It needs
  HTTPS: production sets `SESSION_COOKIE_SAMESITE=None`, local Tutor dev uses
  `Lax` and will not send the session cookie.
- Content size is not a constraint at this scale.

**The largest unresolved risk**: Open edX ships a SECOND HTML block, `html5`
from open-craft/xblock-html, also labelled "Text". That one bleaches against a
fixed allowlist with **no `<button>`, no `<svg>`, no `hidden`, no `role` or
`aria-*`**, and JavaScript off by default. If the pilot instance has `html5` in
`advanced_modules`, these templates are gutted and need a rewrite, not a patch.

Three questions for Edly before Phase 0 commits, in this order:

1. Is the Text component the built-in `html` block, or is `html5` in
   `advanced_modules`?
2. What are `CSP_STATIC_ENFORCE` and `CSP_STATIC_REPORT_ONLY` on the instance?
3. Which Open edX release is it?

Then do one smoke test: paste a template into a Text component, save, reopen,
and diff the saved markup against what you pasted. TinyMCE round-trips content
on save, so anything it dislikes is gone at that point.

To bypass TinyMCE entirely, author through OLX course import or the CMS XBlock
API. Both store `data` verbatim with zero sanitisation.

## Why there is no React and no Tailwind

Course content lives in the HTML XBlock, which renders raw HTML. It cannot
run a React app and it cannot run Tailwind's compiler. The lesson surfaces
therefore have to be plain HTML and CSS regardless of what we might prefer.

Given that, adding a React layer for the *other* surfaces would mean two
component systems describing the same buttons, and they would drift. So the
non-courseware surfaces (dashboard, points, badges, ranking, completion) ship
as HTML XBlock units too, hydrated by `fetch` from Open edX APIs. See
`lessons/dashboard.template.html`.

One kit, one delivery path, no MFE fork, nothing to keep in sync.

If a future phase genuinely needs a custom MFE, the tokens are already
framework-neutral CSS custom properties and will feed it unchanged.

## The rule that matters

**Never write a raw colour, font stack, or shadow.** Every visual value comes
from a token in `src/styles/tokens.css`, which is generated from Figma. A
hardcoded `#276EF1` is a bug even when it renders correctly, because the next
Figma pull will not update it.

If a design needs a value with no token, add the variable in Figma and re-pull.

## Layout

    tokens/figma.raw.json      Figma Variables dump  (INPUT, hand-refreshed)
    tokens/figma.layout.json   Spacing + Layout dump (INPUT, hand-refreshed)
    tokens/figma.elevation.json Effect-style dump  (INPUT, hand-refreshed)
    scripts/build-tokens.mjs   the compiler
    scripts/coverage.mjs       Figma section -> component status
    src/styles/tokens.css      GENERATED - never hand-edit
    src/styles/base.css        reset + webview hardening
    src/components/*.css       one file per component
    src/styles/index.css       import manifest
    public/uber-learn.js       behaviours, copied verbatim to dist/
    lessons/                   HTML XBlock templates
    index.html                 review gallery at 390x844
    figma.map.json             Figma node -> component, check before building

## The colour system in Figma

Five published variable collections in the design system file, plus a
`◐ Colour Sheet` page documenting them:

| Collection | Variables | Published |
|---|---|---|
| Primitives | 112 | hidden, backing values only |
| Core | 8 | yes |
| Semantic | 16 | yes |
| Semantic Extensions | 25 | yes |
| Program | 7 | yes |

47 of the 56 published tokens alias a primitive. The nine that do not are the
six transparent overlays in Core and three Program colours that sit outside
Base's ramps. Those are correct, not gaps.

To add a colour: pick a primitive from the Colour Sheet, create a variable in
the right collection that **aliases** it, publish, then re-pull tokens here.

**Text styles**: 36 across eight groups, matching this repo's type scale
exactly. The 18 inherited styles from the borrowed library were removed on
2026-09-14 after verifying zero uses across 8,995 text nodes, so every text
style in the file is now ours.

| Group | Steps | | Group | Steps |
|---|---|---|---|---|
| Display | 4 | | Mono Display | 4 |
| Heading | 6 | | Mono Heading | 6 |
| Label | 4 | | Mono Label | 4 |
| Paragraph | 4 | | Mono Paragraph | 4 |

All 36 run on the real faces as of 2026-09-14: Uber Move Bold (10), Uber Move
Text Medium (4) and Regular (4), Uber Move Mono Medium (14) and Regular (4).

The swap could not be done through the MCP, because `use_figma` executes in a
context carrying only web fonts. It was done with a Figma canvas plugin, "Uber
Text Style Fonts", which runs inside the editor where the fonts exist. That
plugin stays in the account library and re-reads each style's own description,
so it still works if styles are added later. See
`figma/swap-text-style-fonts.md`.

**Inherited from the borrowed library.** The 81 paint styles were removed on
2026-09-14 after confirming a single use across 58,052 nodes, a vector bound to
Primary / Black which detached to the identical value. Colour now lives only in
variables.

The 60 inherited grid styles were removed on 2026-09-14 the same way, after a
scan of all four pages found zero uses across 59,229 nodes, and replaced with
13 of our own. See the layout section below.

The 6 effect styles were the last inherited asset. Unlike the paint and grid
styles they were not junk - they were the complete elevation ramp under a
second set of names. They were renamed rather than replaced on 2026-09-14. See
the elevation section below.

**Nothing in the file is inherited any more.** Colour, type, spacing, layout
and elevation are all ours.

All five sheets are built from the system they document: their own headings and
labels use the real text styles, and every text fill is bound to a semantic
colour variable. Metrics and hex values sit on the Mono ramp.

Five documentation pages live in the design file: `◐ Colour Sheet`,
`◐ Text Sheet`, `◐ Spacing Sheet`, `◐ Layout Sheet` and `◐ Elevation Sheet`.
Each carries the workflow for growing its part of the system.

## Spacing and layout

Two more collections, and the matrix that drives every gap and page margin.

**Spacing** — 17 FLOAT variables in one collection. Thirteen are Uber's Spacer
component value for value (12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 96,
128). Four below 12 (0, 2, 4, 8) are ours: Uber never shipped a Spacer that
small, but CSS needs hairlines and inline offsets. Use a Spacer value to space
one block from another; reach for a sub-spacer only inside a component.

**Layout** — four variables across six modes, `{Standard, Compact} x {Small,
Medium, Large}`. This is Uber's own matrix:

| Density | Breakpoint | Columns | Margin | Gutter |
|---|---|---|---|---|
| Standard | Small (320–599) | 4 | 16 | 16 |
| Standard | Medium (600–1135) | 8 | 36 | 36 |
| Standard | Large (1136+) | 12 | 64 | 36 |
| Compact | Small | 4 | 16 | 16 |
| Compact | Medium | 8 | 24 | 16 |
| Compact | Large | 12 | 24 | 16 |

**13 grid styles** carry the same matrix onto frames: `Layout grid / <density> /
<breakpoint> / Margins on|off`, plus `Layout grid / Baseline 4pt`. Each column
grid bundles the 4pt baseline rows, so vertical rhythm is never a separate
decision. The previews on the Layout Sheet have their padding and item spacing
bound to the Layout variables with the matching mode set, so they are the
tokens rather than a picture of them.

In CSS the two axes split, because media queries only have one: **density is a
class**, `.u-density-compact`; **breakpoint is a query**. Both resolve
`--u-cols`, `--u-margin` and `--u-gutter`, which `.u-grid` consumes.

    .u-grid            display:grid over --u-cols, gutter gap, margin inline
    .u-grid--flush     "Margins off" - grid without the page margin
    .u-col-1 … -4      safe at every breakpoint (Small has 4 columns)
    .u-col-md-*        from 600px    .u-col-lg-*   from 1136px

Small is the default and needs no class, because the pilot ships into a 390px
webview. Spans wider than 4 must be asked for per breakpoint: `span N` needs a
literal integer, so it cannot be derived from `--u-cols`, and an unguarded
`.u-col-8` would overflow the phone.

Uber's Divider component maps to `.u-divider`, `--section` and `--module` at
1px, 2px and 8px. All three are `--u-border-opaque` (#E8E8E8); module was on
`--u-background-secondary` until 2026-09-14, which read a step too light.

**To change the matrix**: edit the variables in Figma, re-dump to
`tokens/figma.layout.json`, then `npm run tokens`. `npm run validate` compares
the built CSS against that dump cell by cell and fails on any disagreement, so
the sheets cannot quietly become decoration.

## Elevation

Six drop shadows: three depths x two directions.

| Style | Token | Value | Used by |
|---|---|---|---|
| Shallow / Above | `--u-shadow-shallow-above` | 0 -4 16 · 12% | button dock |
| Shallow / Below | `--u-shadow-shallow-below` | 0 4 16 · 12% | cards, menus, tooltips, popovers |
| Medium / Above | `--u-shadow-medium-above` | 0 -8 36 · 17% | nothing yet |
| Medium / Below | `--u-shadow-medium-below` | 0 8 36 · 17% | nothing yet |
| Deep / Above | `--u-shadow-deep-above` | 0 -16 48 · 22% | bottom sheet, snackbar |
| Deep / Below | `--u-shadow-deep-below` | 0 16 48 · 22% | dialog, dragged list item |

These arrived as `Above|Below / Low|Medium|High` and were renamed to
`Shallow|Medium|Deep / Above|Below` - the vocabulary Uber's own components and
this repo's tokens already used. Same six values; one name per idea.

**Direction is not a taste question.** A surface docked to the viewport's
bottom edge must cast its shadow UPWARD, or the shadow lands off-screen and the
surface reads as flat. `npm run validate` fails on a `position: fixed|sticky`
rule that pins `bottom:` and uses a `-below` shadow. `bottom: calc(100% + …)`
means "above my anchor", not "docked", and is correctly excluded - that is why
the tooltip keeps a below shadow.

**Press states cross media.** Uber builds them as effect styles: an inner
shadow with a ~1000px offset, a Figma trick for flooding a shape with a flat
tint. CSS does that with a background colour, so they map to
`--u-overlay-black4/8` and `--u-overlay-white18` and have no `box-shadow` at
all. The mapping is recorded in `tokens/figma.elevation.json` so it does not
have to be rediscovered.

Elevation is effect *styles* in Figma, not variables, so it never arrives with
the colour and type pull. It is dumped to `tokens/figma.elevation.json` and
that dump is the only source of `--u-shadow-*`; the compiler now refuses an
`Effect()` entry in `figma.raw.json` rather than emitting a second, competing
definition. That old path carried alpha as 8-bit hex, which quantised 12% to
0.1216; the dump keeps the design's own 0.12.

## Refreshing tokens from Figma

1. Select the node in the Figma desktop app.
2. Call the Figma MCP tool `get_variable_defs`.
3. Merge into the `variables` object of `tokens/figma.raw.json`. Drop anything
   prefixed `DEPRECATED_` or `_`.
4. Update `_meta.pulledOn`, then `npm run tokens`.

The compiler normalises Figma's inconsistent naming, so
`Background++/backgroundAccentLight` and `Background ++ / backgroundAccentLight`
both land on `--u-background-accent-light`.

## Adding a component

1. Read the Figma node with `get_design_context` or `get_screenshot`.
2. Check `figma.map.json` before building anything new.
3. Create `src/components/<name>.css`. Prefix `u-`, BEM-ish
   (`.u-thing`, `.u-thing__part`, `.u-thing--variant`).
4. Add it to `src/styles/index.css`.
5. Add a specimen to `index.html` covering every state, including empty,
   loading, and error. The proposal's acceptance criteria name those.
6. Record the node id in `figma.map.json` and run `npm run coverage`.
7. Verify in the browser at 390x844 before reporting done.

## Behaviours

`public/uber-learn.js` is delegated from `document` and guards against
double-inclusion.

Note what the iframe model actually means: the learning MFE loads a **new
document per unit**, so the script re-executes from scratch every time a
learner moves between units. There is no cross-unit state to preserve, and the
double-inclusion guard protects against a doubled course-wide entry rather than
against unit navigation. Delegation from `document` is still the right pattern,
because one unit can hold several components.

## Web vs mobile

The shipping target is a webview inside the Uber driver app, so **mobile is
the default, not a breakpoint**. Base's Figma ships `/ Web` and `/ Mobile`
variants; `src/styles/responsive.css` mirrors them as `.u-web` and `.u-mobile`.

Two axes, kept separate on purpose:

- **Modality** decides touch targets and hover. A webview on a tablet is wide
  but still touch, so width must never shrink a target. Gate every hover rule
  behind `@media (hover: hover) and (pointer: fine)`.
- **Width** decides layout only: two-month calendar, side nav against bottom
  nav, dialog against sheet.

Web surfaces in this project means Studio, used by the content team on a
laptop. Learner surfaces are always mobile.

## Rules the audit added

These came from an audit that found real defects. Each is now enforced by
`npm run validate` or `npm test`, so breaking one fails the build.

- **No colour literals in any notation.** Not hex, not `rgb()`, not `hsl()`.
  The overlay tokens `--u-overlay-black4/8/48/78` and `--u-overlay-white18/40`
  exist for scrims and press states. `tokens/figma.raw.json` records which of
  those are verbatim Figma values and which are derived.
- **Never format numbers with `.toFixed().replace(/0+$/, '')`.** It yields
  `"1."`, which is invalid CSS, and the browser drops the whole declaration in
  silence. Use the `num()` helper in `scripts/build-tokens.mjs`.
- **Mobile is the default with no class required.** The three web/mobile pairs
  are gated so that a bare XBlock unit renders the mobile half. The half
  `.u-web` reveals must be hidden by a bare rule. Getting this backwards made a
  phone render both time pickers, both navigations and both modal shapes.
- **Overlays are unreliable inside a unit iframe. Prefer inline disclosure
  there.** The iframe is `scrolling: "no"` with its height driven by content
  height, so its viewport is as tall as the whole unit. `position: fixed` then
  anchors to the full-unit box rather than the phone viewport, and a bottom
  sheet can land far below what the learner can see. `absolute` behaves the
  same way for the same reason. Inside a lesson, use the accordion or an inline
  panel. Keep the sheet and dialog for a standalone page that owns its own
  viewport, such as a deep-linked dashboard, and scroll them into view.
- **`touch-action: none` goes on the element the gesture is bound to**, never a
  whole row. On the row it blocked vertical lesson scrolling.
- **Every target is 24px minimum even when the visual is smaller.** Expand it
  with a transparent pseudo-element, as `.u-pages__d::after` does.
- **Any component the CSS shows must have behaviour.** The pinwheel time picker
  shipped with zero JavaScript while being the only time picker on mobile.
- **Every gesture needs a non-gesture path.** Slide-to-confirm and drag-to-
  reorder both answer to the keyboard.
- **Guard `scrollIntoView`.** It is absent in some engines and its options
  argument is unsupported on older WebViews.
- **A component with no specimen is invisible, and invisible things rot.** The
  bottom sheet had CSS and behaviour but no specimen in `index.html` and no
  test, so nothing ever rendered it - which is exactly why it shipped casting
  its shadow off the bottom of the screen. It now has both.
- **A test that asserts an end state must first prove the start state.** Three
  of the four new sheet tests asserted "the sheet is hidden" after closing it.
  With opening broken they all still passed, because the sheet had never
  opened. Each now fails with "sheet never opened, so closing proves nothing".
- **A gate that has never been run against bad input is not a gate.** Three
  validator gates shipped broken, one of which could never fire. The layout
  drift gate was written the same way and reported every `--u-gutter` as unset
  because it required a trailing semicolon that the minifier strips from the
  last declaration in a block. Feed each new gate a deliberately wrong input
  and watch it fail before trusting it green.
- **A broken toolchain is not a lint failure.** The PostToolUse lint hook ran
  `npm`, which is not on a hook's PATH under nvm, and reported exit 127 as
  broken code. It also walked `..` logically while its own `-f`/`-d` tests
  walked the filesystem physically, so through the `.claude` symlink at the
  parent it pointed `cd` one directory above the repo. It now resolves node
  itself, uses `cd -P`, tests for the file it is about to run, and exits 0 with
  a message when there is no node at all.
- **`env(safe-area-inset-*)` is permanently inert inside a unit.** This is
  settled, not open. The LMS emits its own `<meta name="viewport">` with no
  `viewport-fit=cover`, and safe-area insets do not apply to a nested browsing
  context anyway. It is the LMS's meta tag, so it is not Uber's call and there
  is nothing to ask them. The declarations are harmless and still work in the
  gallery and on any standalone page.

## Non-negotiables

- **No native OS form controls.** A `<select>` renders the platform wheel and
  `input[type=date]` renders the OS calendar. Neither can be branded. Use
  `u-select`, `u-cal` and `u-time` instead. `npm run validate` fails the build
  if one reappears.
- **Webview, not desktop.** Design at 390x844. There is no hover. Every
  interactive target is at least 44px.
- **Reduce Motion is honoured** by a global query in `base.css`. Do not
  re-introduce animation that ignores it.
- **Uber Move is proprietary.** Every generated family ends in a system
  fallback stack. Never ship a font file you were not licensed to ship.
  Installing a font locally for design work and serving it to drivers are two
  different permissions; only the first is settled.

  All three families are installed on the design machine as of 2026-09-14,
  covering 36 of 36 generated text styles. Figma and the local browser both
  render real Uber type now, headings included.

  This does NOT settle shipping. Drivers' phones will not have the font, so the
  fallback stacks stay exactly as they are, and serving the files from the
  webview needs a licence covering web embedding. That is a different grant
  from the one that allowed the font to be installed here, and it is not yet
  settled with Uber.
- **Graded questions use the native Problem XBlock**, so the grade reaches the
  gradebook. Only ungraded retention checks are built in HTML.
- **User-supplied strings use `textContent`, never `innerHTML`.** Lesson
  markup is author-controlled, but API values are not.
- **CSS budget is 15 kB gzipped.** Currently 12.4 kB.
