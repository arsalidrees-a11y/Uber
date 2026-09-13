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
- **Graded questions use the native Problem XBlock**, so the grade reaches the
  gradebook. Only ungraded retention checks are built in HTML.
- **User-supplied strings use `textContent`, never `innerHTML`.** Lesson
  markup is author-controlled, but API values are not.
- **CSS budget is 15 kB gzipped.** Currently 12.3 kB.
