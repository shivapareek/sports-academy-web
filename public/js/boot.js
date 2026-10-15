// Runs before first paint: marks the page so CSS can hide elements that
// site.js will animate in. If site.js never starts, everything is shown again.
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return root.classList.add('no-motion');
  root.classList.add('js-motion');
  setTimeout(function () {
    if (!window.__vegaReady) root.classList.remove('js-motion');
  }, 3500);
})();
