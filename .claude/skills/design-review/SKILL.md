---
name: design-review
description: Compare what the code renders against what Figma specifies and report the drift. Use when the user asks whether the build matches the design, wants a design QA pass or visual check, says something looks off or wrong, or before handing work to a client or stakeholder for review.
---

# Design review: code against Figma

Finds measurable divergence between `uber-learn/` and the Base design system.
Reports drift; does not fix it unless asked.

## Steps

1. **Build the review surface:**

   ```bash
   cd uber-learn && npm run check && npm run gallery
   ```

   `dist/gallery.html` is self-contained and opens with no server. Send it with
   SendUserFile when the user should look at it themselves.

2. **Render it** at the real target size, which is a 390 by 844 webview, not a
   desktop window:

   ```
   mcp__Claude_Browser__preview_start  name: uber-learn
   mcp__Claude_Browser__resize_window  width: 390  height: 844
   ```

   If the Browser pane hangs, do not retry `navigate` in a loop. Fall back to
   `node scripts/test.mjs`, which drives the built gallery headlessly through
   jsdom and asserts real behaviour.

3. **Pull the Figma truth.** `get_screenshot` on the component's node, then
   `get_variable_defs` for its exact values. Useful node ids: Button
   `21911:260996`, Tag `21911:260997`, Tile `21154:306578`, Card `20615:358398`,
   Banner `21151:253936`, Tabs `21154:260809`, Control `13604:111951`.

4. **Compare only measurable things.** Radius, weight, spacing step, state
   colour, a variant Base ships that we lack. Quote the Figma value against ours.
   Subjective preference is not drift.

5. **Check the states nobody draws.** Loading, empty, error, disabled and
   expiry are in the delivery acceptance criteria. A component that only looks
   right in its happy state is not reviewed.

6. **Report** as a short table: component, what Figma says, what we render, and
   whether it matters on a phone. Rank by whether a driver would notice.

## Two failure modes to check every time

- **Verify claims before reporting them.** An audit of this repo produced 47
  findings; several were only true because a regex in the checker was wrong. Read
  the actual file and prove the claim before it reaches the user.
- **A check that always passes is worse than no check.** After adding any gate to
  `scripts/lint.mjs` or `scripts/validate.mjs`, run it against deliberately bad
  input and confirm it fails. Both files have caught real bugs; one of their own
  gates could never fire when first written.
