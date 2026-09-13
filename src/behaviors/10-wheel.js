/* Pinwheel time picker behaviour.
 *
 * WHY THIS FILE EXISTS
 *   responsive.css shows .u-wheel and hides .u-time on mobile, so the pinwheel
 *   is the ONLY time picker a driver can reach. It previously had no JavaScript
 *   at all: aria-selected was hardcoded in the markup and never moved, so the
 *   component reported a stale value forever.
 *
 *   Each column is a listbox. Selection follows the unit nearest the centre
 *   band, recomputed on scroll end, and is also settable by tap or keyboard so
 *   the control works without a scroll gesture.
 */
(function () {
  'use strict';
  var D = document;
  var closest = function (el, sel) { return el && el.closest ? el.closest(sel) : null; };

  function units(col) { return [].slice.call(col.querySelectorAll('.u-wheel__unit')); }

  /* scrollIntoView is missing in some engines and its options argument is
     unsupported on older WebViews. Centring is a nicety; never let it throw. */
  function centre(el) {
    try { el.scrollIntoView({ block: 'center' }); }
    catch (e) { try { el.scrollIntoView(); } catch (e2) { /* no-op */ } }
  }

  function select(col, unit, notify) {
    var all = units(col);
    for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-selected', 'false');
    unit.setAttribute('aria-selected', 'true');
    col.setAttribute('data-value', unit.getAttribute('data-value') || unit.textContent.trim());
    if (notify !== false) {
      col.dispatchEvent(new CustomEvent('u:timechange', {
        bubbles: true,
        detail: { column: col.getAttribute('aria-label') || '', value: col.getAttribute('data-value') }
      }));
    }
  }

  /* The unit whose centre is closest to the column's centre band. */
  function nearest(col) {
    var box = col.getBoundingClientRect();
    var mid = box.top + box.height / 2;
    var best = null, bestGap = Infinity;
    units(col).forEach(function (u) {
      var r = u.getBoundingClientRect();
      var gap = Math.abs(r.top + r.height / 2 - mid);
      if (gap < bestGap) { bestGap = gap; best = u; }
    });
    return best;
  }

  var timers = new WeakMap();
  D.addEventListener('scroll', function (e) {
    var col = closest(e.target, '.u-wheel__col');
    if (!col) return;
    clearTimeout(timers.get(col));
    /* No scrollend in older WebViews, so settle on a debounce. */
    timers.set(col, setTimeout(function () {
      var u = nearest(col);
      if (u && u.getAttribute('aria-selected') !== 'true') select(col, u);
    }, 120));
  }, true);

  D.addEventListener('click', function (e) {
    var unit = closest(e.target, '.u-wheel__unit');
    if (!unit) return;
    var col = closest(unit, '.u-wheel__col');
    select(col, unit);
    centre(unit);
  });

  D.addEventListener('keydown', function (e) {
    var unit = closest(e.target, '.u-wheel__unit');
    if (!unit) return;
    var step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    var col = closest(unit, '.u-wheel__col');
    var all = units(col);
    var next = all[all.indexOf(unit) + step];
    if (!next) return;
    select(col, next);
    next.focus();
    centre(next);
  });

  /* Roles and tab stops, so the markup does not have to carry them. */
  function hydrate(root) {
    var cols = (root || D).querySelectorAll('.u-wheel__col');
    for (var i = 0; i < cols.length; i++) {
      var col = cols[i];
      if (col.getAttribute('data-u-wheel-ready') === 'true') continue;
      col.setAttribute('data-u-wheel-ready', 'true');
      col.setAttribute('role', 'listbox');
      if (!col.getAttribute('aria-label')) col.setAttribute('aria-label', 'Value');
      units(col).forEach(function (u) {
        u.setAttribute('role', 'option');
        u.setAttribute('tabindex', u.getAttribute('aria-selected') === 'true' ? '0' : '-1');
        if (!u.hasAttribute('aria-selected')) u.setAttribute('aria-selected', 'false');
      });
      var sel = col.querySelector('.u-wheel__unit[aria-selected="true"]');
      if (sel) { select(col, sel, false); centre(sel); }
    }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function () { hydrate(); });
  else hydrate();
  if (window.UberLearn) window.UberLearn.hydrateWheels = hydrate;
})();
