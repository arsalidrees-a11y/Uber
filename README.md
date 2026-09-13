# uber-learn

HTML/CSS component kit for the Edly x Uber Open edX safety-learning pilot.
Figma is the source of truth for design values. This repo turns them into one
stylesheet that Open edX can serve.

## The loop

```
Figma Variables
      |  get_variable_defs  (Figma MCP)
      v
tokens/figma.raw.json
      |  npm run tokens
      v
src/styles/tokens.css   ->  components  ->  dist/uber-learn.css
                            behaviours  ->  dist/uber-learn.js
                                                  |
                                                  v
                                    Open edX Files & Uploads
                                                  |
                                                  v
                              Advanced Settings: course_wide_css
                                                  course_wide_js
```

Plain HTML and CSS, because the Open edX HTML XBlock renders raw markup and
cannot run React or Tailwind. Every surface ships the same way.

## Commands

    npm run dev       gallery at localhost:5180, hot reload
    npm run tokens    recompile tokens.css from the Figma dump
    npm run coverage  Figma section -> component status
    npm run build     emit dist/uber-learn.{css,js} + dist/index.html

## Shipping to Open edX

1. `npm run build`
2. Upload `dist/uber-learn.css` and `dist/uber-learn.js` via Studio,
   Content, Files & Uploads. Leave them unlocked.
3. Copy each file's full `/asset-v1:...` URL from that table and set them in
   Studio, Settings, Advanced Settings as "Course-wide custom css" and
   "Course-wide custom js". Do **not** use `/static/` there, and do **not**
   put `<link>` or `<script>` tags in unit markup. Read the Delivery section
   of `CLAUDE.md` for why both of those fail silently.
4. Author lessons from `lessons/micro-lesson.template.html` and the
   dashboard surfaces from `lessons/dashboard.template.html`.

Read `CLAUDE.md` before changing anything. The short version: never hardcode a
colour, a font, or a shadow.
