# Swapping the text styles onto the real Uber fonts

The 36 text styles in the design system file carry correct Uber metrics but are
rendering with substitute faces, because the Figma session could not load the
Uber families. Every style records its intended face in its own description, so
this swap needs no lookup table.

## When to run it

When `listAvailableFontsAsync` in Figma reports the Uber families. Check with:

```js
const f = await figma.listAvailableFontsAsync();
return f.filter(x => /uber/i.test(x.fontName.family)).map(x => `${x.fontName.family} ${x.fontName.style}`);
```

Empty result means do not run this yet.

## The swap

Run via `use_figma` against the design system file. It reads the intended face
out of each description, so it cannot drift from what was originally specified.

```js
const styles = await figma.getLocalTextStylesAsync();
const loaded = new Set();
const done = [], failed = [];

for (const s of styles) {
  const m = s.description.match(/Uber spec:\s*(Uber Move(?: Text| Mono)?)\s+(\w+)/);
  if (!m) continue;                                  // not one of ours
  const fn = { family: m[1], style: m[2] };
  try {
    const k = `${fn.family}|${fn.style}`;
    if (!loaded.has(k)) { await figma.loadFontAsync(fn); loaded.add(k); }
    s.fontName = fn;
    s.description = s.description.split("  ⚠")[0];   // drop the substitution warning
    done.push(s.name);
  } catch (e) {
    failed.push({ style: s.name, want: `${fn.family} ${fn.style}`, error: String(e.message || e).slice(0, 90) });
  }
}
return { swapped: done.length, failed, sample: done.slice(0, 5) };
```

Then republish the library.

## Why the substitution happened

The Uber fonts are correctly installed on the design machine. macOS registers
all three families and all eleven files parse as valid fonts. The Figma session
reachable from this toolchain sees 1,938 families, essentially all of them web
fonts, and almost no local ones: Helvetica and Menlo are both absent, which no
normal desktop Figma session would show.

So this is a connection problem, not a font problem. Restarting Figma and its
font agent did not change it. Worth checking whether the file is being edited in
a browser session rather than the desktop app, since browser Figma only reaches
local fonts through the Font Helper.

## Substitutions currently in place

| Uber spec | Rendering with |
|---|---|
| Uber Move Bold | Inter Bold |
| Uber Move Text Medium | Inter Medium |
| Uber Move Text Regular | Inter Regular |
| Uber Move Mono Medium | Roboto Mono Medium |
| Uber Move Mono Regular | Roboto Mono Regular |

Sizes, line heights and tracking are correct in every case. Only the face is wrong.
