# Frontend dev environment, Figma at the centre

Figma is the source of truth for design values. Code is the source of truth for
behaviour. This setup keeps them from drifting without anyone having to remember
to check.

## The four parts

| Part | What it is | Where |
|---|---|---|
| Connection | Figma MCP server, read and write | already configured globally |
| Contract | tokens generated from Figma Variables, never hand-written | `uber-learn/src/styles/tokens.css` |
| Loop | three skills that run the same way every time | `.claude/skills/` |
| Guardrail | lint at save time, full check before done | `.claude/hooks/`, `uber-learn/scripts/` |

## The loop

Say what you want in plain language. The skills trigger themselves.

- **"tokens changed in Figma"** runs `figma-sync`. Pulls variables, shows a diff
  of what actually changed, rebuilds, verifies.
- **"build this"** with a Figma link runs `figma-component`. Reads the node,
  checks it is not already built, writes one CSS file and one behaviour file,
  adds a gallery specimen, adds tests, runs the full check.
- **"does this match the design?"** runs `design-review`. Renders at 390 by 844,
  pulls the Figma screenshot, reports measurable drift only.

You can also invoke them directly: `/figma-sync`, `/figma-component`,
`/design-review`.

## The guardrail

A `PostToolUse` hook runs the fast linter whenever a file under `uber-learn/src/`
is written. It catches colour literals, unknown tokens, trailing-dot numbers and
unguarded hover rules at save time, and blocks so they get fixed in the same turn.

Verified working: the script exits 2 on a real violation, exits 0 when clean,
and stays silent for files outside the source tree.

Review or disable it later with `/hooks`.

## Commands

    cd uber-learn

    npm run dev            gallery at localhost:5180, hot reload
    npm run lint           fast source lint, no build needed
    npm run tokens         rebuild tokens.css from the Figma dump
    npm run tokens:merge   audit a fresh Figma pull before applying it
    npm run coverage       Figma component name -> implementing file
    npm run validate       built-CSS gates
    npm test               35 headless behaviour tests
    npm run gallery        self-contained gallery.html to send to Uber
    npm run check          all of the above, in order

## Two habits worth keeping

**Verify before reporting.** An audit of this repo produced 47 findings. Several
were only true because a regex in the checker was wrong. Read the file and prove
the claim before it reaches anyone.

**A check that always passes is worse than no check.** Three gates in
`validate.mjs` were broken when first written, and one could never have fired.
After adding any gate, run it against deliberately bad input and confirm it
fails. Both `lint.mjs` and `validate.mjs` have caught real shipping bugs.
