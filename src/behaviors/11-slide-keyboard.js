/* Keyboard and assistive-technology path for slide-to-confirm.
 *
 * WHY THIS FILE EXISTS
 *   The drag gesture in 00-core.js is pointer-only. A driver using a switch
 *   control, an external keyboard, or VoiceOver had no way to confirm at all,
 *   which made the action unreachable rather than merely awkward.
 *
 *   Enter, Space, ArrowRight and End confirm. The knob is expected to be a
 *   <button>, so it is focusable and announced without extra attributes.
 */
(function () {
  'use strict';
  var D = document;
  var closest = function (el, sel) { return el && el.closest ? el.closest(sel) : null; };

  function confirm(slide) {
    if (slide.getAttribute('data-confirmed') === 'true') return;
    var knob = slide.querySelector('.u-slide__knob');
    var fill = slide.querySelector('.u-slide__fill');
    var max = slide.getBoundingClientRect().width - (knob ? knob.offsetWidth : 48) - 8;
    if (knob) knob.style.setProperty('--knob', max + 'px');
    if (fill) fill.style.setProperty('--slide', '100%');
    slide.setAttribute('data-confirmed', 'true');
    if (knob) knob.setAttribute('aria-disabled', 'true');
    slide.dispatchEvent(new CustomEvent('u:confirmed', { bubbles: true, detail: { via: 'keyboard' } }));
  }

  D.addEventListener('keydown', function (e) {
    var knob = closest(e.target, '.u-slide__knob');
    if (!knob) return;
    if (['Enter', ' ', 'Spacebar', 'ArrowRight', 'End'].indexOf(e.key) === -1) return;
    e.preventDefault();
    confirm(closest(knob, '.u-slide'));
  });

  /* Give every slider the semantics it needs even if the markup omits them. */
  function hydrate(root) {
    var slides = (root || D).querySelectorAll('.u-slide');
    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (s.getAttribute('data-u-slide-ready') === 'true') continue;
      s.setAttribute('data-u-slide-ready', 'true');
      var knob = s.querySelector('.u-slide__knob');
      var label = s.querySelector('.u-slide__label');
      if (!knob) continue;
      if (knob.tagName !== 'BUTTON' && !knob.hasAttribute('tabindex')) {
        knob.setAttribute('tabindex', '0');
        knob.setAttribute('role', 'button');
      }
      if (!knob.getAttribute('aria-label')) {
        knob.setAttribute('aria-label',
          (label ? label.textContent.trim() : 'Confirm') + '. Press Enter to confirm.');
      }
    }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function () { hydrate(); });
  else hydrate();
  if (window.UberLearn) window.UberLearn.hydrateSlides = hydrate;
})();
