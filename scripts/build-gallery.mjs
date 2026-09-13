#!/usr/bin/env node
/* Inlines the CSS and JS into one self-contained gallery.html that opens with
   no server. This is the file you send to Uber for design review.
   Run: npm run gallery  (build first) */
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('dist/index.html', 'utf8');
const css = readFileSync('dist/uber-learn.css', 'utf8');
const js = readFileSync('dist/uber-learn.js', 'utf8');

/* Function replacements: the JS contains \u escapes that a string replacement
   would try to interpret. */
html = html.replace(/<link[^>]+uber-learn\.css[^>]*>/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script[^>]+uber-learn\.js[^>]*><\/script>/, () => `<script>\n${js}\n</script>`);

const leftover = html.match(/uber-learn\.(css|js)/g);
if (leftover) { console.error('FAIL external refs remain:', leftover); process.exit(1); }

writeFileSync('dist/gallery.html', html);
console.log(`gallery.html  ${(html.length / 1024).toFixed(1)} kB  self-contained`);
