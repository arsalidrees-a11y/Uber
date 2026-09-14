---
name: figma-sync
description: Pull design tokens from Figma into the code, auditably. Use when the user says tokens changed in Figma, asks to sync or refresh tokens, mentions a Figma variable or style change, or after any design-system update in Figma. Also use before building a component that needs a value no token covers.
---

# Sync tokens from Figma

Figma is the source of truth for every colour, type style, spacing step, layout
grid and shadow. This pulls them into `uber-learn/src/styles/tokens.css`, which
is generated and must never be hand-edited.

Repo: `uber-learn/`. Figma file key `ruYJo9EUuYsyJxacE52B4p`, page node `3:4200`.

## Three inputs, not one

`get_variable_defs` only returns **variables**, and only for one node. Spacing,
layout and elevation do not come back from it, so a colour refresh leaves them
untouched and silently stale. Each has its own dump:

| Dump | Holds | How to refresh |
|---|---|---|
| `tokens/figma.raw.json` | colour + type variables | `get_variable_defs`, steps below |
| `tokens/figma.layout.json` | Spacing and Layout collections, grid styles | `use_figma`, read the collections |
| `tokens/figma.elevation.json` | the six effect styles | `use_figma`, `getLocalEffectStylesAsync` |

The last two are read with `use_figma` because effect styles and grid styles are
**styles**, not variables, and multi-mode collections do not flatten into a
variable dump. Load the `figma-use` skill before calling it.

`npm run validate` compares the built CSS against all three, cell by cell, and
fails on any disagreement. So a stale dump surfaces as a failing build rather
than as a design sheet that quietly stops being true. If validate reports drift,
the dump is what is out of date, not the CSS.

## Steps

1. **Pull.** Call the Figma MCP tool `get_variable_defs`. Pass `nodeId` when the
   user named a specific component; omit it to use their current selection. For a
   full refresh use the page node `3:4200`.

2. **Save the dump verbatim** to `uber-learn/tokens/incoming.json`. Do not edit,
   reorder or filter it. The merge script owns that.

3. **Dry run the merge** so the change is visible before it lands:

   ```bash
   cd uber-learn && npm run tokens:merge
   ```

   It prints added, changed, protected and absent variables. Read that output and
   tell the user what actually changed in plain language. A changed brand colour
   is worth saying out loud; forty new primitive shades are not.

4. **Apply, then rebuild:**

   ```bash
   cd uber-learn && npm run tokens:merge -- --write && npm run tokens
   ```

5. **Check nothing broke:**

   ```bash
   cd uber-learn && npm run check
   ```

6. **Delete `tokens/incoming.json`** once applied. A stale dump lying around gets
   re-merged by mistake.

## When a new colour is added in Figma

There is a Colour Sheet page in the design system file documenting the whole
palette, with every swatch bound to its variable. The workflow it describes is:
pick a primitive, create a semantic variable that **aliases** it, publish.

When that happens, the code side must follow or the two drift:

1. Run this skill to pull the new variable.
2. `npm run tokens` regenerates `tokens.css` with the new custom property.
3. Use it in a component. `npm run lint` fails on any colour literal, so there
   is no way to hand-write the value instead.

The design sheet and `tokens.css` are two views of the same list. If a token
exists in one and not the other, that is the bug.

## Rules

- Never hand-edit `tokens/figma.raw.json` to add a value. If a design needs a
  value with no token, the fix is to add the variable **in Figma** and re-pull.
- Semantic tokens must **alias** a primitive, never carry a pasted hex. An alias
  moves when the primitive moves; a hex silently does not.
- Primitives are hidden from publishing on purpose. Designers pick intent, not
  pigment. They stay visible on the Colour Sheet, which is where you choose.
- The merge script protects anything listed in `_meta.derived`. Those are values
  we authored, not Figma's. Do not remove that protection.
- Absence from a pull is not deletion. A node-scoped pull sees only that subtree,
  so the script reports absent variables and never removes them.
- If `npm run tokens` reports SKIPPED variables, surface them. A silently dropped
  variable is how the type scale loses a style.
- If it reports a name collision it exits non-zero. Two Figma variables resolving
  to one custom property is data loss; fix the normaliser in
  `scripts/build-tokens.mjs`, do not rename in Figma to dodge it.
