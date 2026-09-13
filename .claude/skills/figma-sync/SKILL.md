---
name: figma-sync
description: Pull design tokens from Figma into the code, auditably. Use when the user says tokens changed in Figma, asks to sync or refresh tokens, mentions a Figma variable or style change, or after any design-system update in Figma. Also use before building a component that needs a value no token covers.
---

# Sync tokens from Figma

Figma Variables are the source of truth for every colour, type style and shadow.
This pulls them into `uber-learn/src/styles/tokens.css`, which is generated and
must never be hand-edited.

Repo: `uber-learn/`. Figma file key `ruYJo9EUuYsyJxacE52B4p`, page node `3:4200`.

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

## Rules

- Never hand-edit `tokens/figma.raw.json` to add a value. If a design needs a
  value with no token, the fix is to add the variable **in Figma** and re-pull.
- The merge script protects anything listed in `_meta.derived`. Those are values
  we authored, not Figma's. Do not remove that protection.
- Absence from a pull is not deletion. A node-scoped pull sees only that subtree,
  so the script reports absent variables and never removes them.
- If `npm run tokens` reports SKIPPED variables, surface them. A silently dropped
  variable is how the type scale loses a style.
- If it reports a name collision it exits non-zero. Two Figma variables resolving
  to one custom property is data loss; fix the normaliser in
  `scripts/build-tokens.mjs`, do not rename in Figma to dodge it.
