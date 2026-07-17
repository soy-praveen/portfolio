/* Theme control. Default = whatever the system says; clicking the toggle makes
   an explicit choice that persists (localStorage) across every page of the site.
   Runs synchronously in <head> so the first paint is already the right theme.
   Canvases listen for the 'orrerytheme' event and re-read their CSS variables. */
(function () {
  'use strict';
  var KEY = 'orrery-theme';
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; }
    catch (e) { return null; }
  }
  function effective() { return saved() || (mq.matches ? 'dark' : 'light'); }
  function apply() {
    var s = saved();
    if (s) document.documentElement.setAttribute('data-theme', s);
    else document.documentElement.removeAttribute('data-theme');
    try {
      window.dispatchEvent(new CustomEvent('orrerytheme', { detail: { theme: effective() } }));
    } catch (e) { /* ancient browsers: theme still applies, canvases just won't live-switch */ }
  }

  apply();
  if (mq.addEventListener) mq.addEventListener('change', apply);

  window.ORRERY_THEME = {
    effective: effective,
    toggle: function () {
      try { localStorage.setItem(KEY, effective() === 'dark' ? 'light' : 'dark'); } catch (e) {}
      apply();
    }
  };

  function wire() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    function label() {
      btn.setAttribute('aria-label', 'Switch to ' + (effective() === 'dark' ? 'light' : 'dark') + ' theme');
    }
    label();
    btn.addEventListener('click', function () { window.ORRERY_THEME.toggle(); label(); });
    window.addEventListener('orrerytheme', label);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
