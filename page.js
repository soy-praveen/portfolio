/* Page choreography. Six moves, one easing, all of it gated:
   the base document is fully static - motion only runs when the visitor allows it. */
(function () {
  'use strict';

  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  function motionOK() { return !RM.matches; }

  /* ---------------------------------------------------------- the tick economy
     One clock. Surfaced in the hero caption, the copy confirmation, the footer. */
  var t0 = performance.now();
  function tickNow() { return Math.floor((performance.now() - t0) / 350); }
  var tickEls = document.querySelectorAll('[data-tick]');
  if (tickEls.length && motionOK()) {          // reduced motion: t stays frozen at 0
    setInterval(function () {
      var t = String(tickNow());
      tickEls.forEach(function (el) { el.textContent = t; });
    }, 350);
  }

  /* ---------------------------------------------------------- stagger indices */
  document.querySelectorAll('[data-stagger]').forEach(function (box) {
    Array.prototype.forEach.call(box.children, function (child, i) {
      child.style.setProperty('--i', i);
    });
  });
  document.querySelectorAll('.cm-face').forEach(function (f, i) {
    f.style.setProperty('--i', i);
  });
  document.querySelectorAll('.sec-head, .hero-overlay').forEach(function (box) {
    box.querySelectorAll('.mask').forEach(function (m, i) {
      m.querySelector('.mask-inner').style.setProperty('--mi', i);
    });
  });

  /* ---------------------------------------------------------- PLOT setup
     Every .plot path is measured and hidden; entering the viewport draws it. */
  var plots = document.querySelectorAll('.plot');
  if (motionOK()) {
    plots.forEach(function (p) {
      try {
        var L = p.getTotalLength();
        p.style.strokeDasharray = L + ' ' + L;
        p.style.strokeDashoffset = L;
      } catch (e) { /* non-geometry element: leave it drawn */ }
    });
  }
  function drawPlots(scope) {
    scope.querySelectorAll('.plot').forEach(function (p) {
      p.style.strokeDashoffset = '0';
    });
  }

  /* ---------------------------------------------------------- COUNT */
  function runCounter(el) {
    var target = parseInt(el.dataset.count, 10);
    var suffix = el.dataset.suffix || '';
    var start = performance.now();
    function step(now) {
      var u = Math.min(1, (now - start) / 700);
      var e = 1 - Math.pow(1 - u, 3);
      el.textContent = Math.round(target * e).toLocaleString('en-US') + suffix;
      if (u < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------- ENTRANCE observer */
  var enterTargets = document.querySelectorAll('[data-rise], [data-stagger], .sec-head');
  if (motionOK() && 'IntersectionObserver' in window) {
    var seen = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        entry.target.classList.add('in');
        drawPlots(entry.target);
        entry.target.querySelectorAll('[data-count]').forEach(runCounter);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    enterTargets.forEach(function (el) { io.observe(el); });
  } else {
    enterTargets.forEach(function (el) { el.classList.add('in'); });
  }

  /* hero: enters on load, not on scroll */
  window.setTimeout(function () {
    var overlay = document.querySelector('.hero-overlay');
    if (overlay) overlay.classList.add('in');
  }, 120);

  /* printing reveals everything, wherever the scroll position is */
  window.addEventListener('beforeprint', function () {
    enterTargets.forEach(function (el) { el.classList.add('in'); });
    drawPlots(document);
  });

  /* ---------------------------------------------------------- footnotes */
  document.querySelectorAll('.fn-ref').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var note = document.getElementById(btn.getAttribute('aria-controls'));
      if (!note) return;
      var open = note.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---------------------------------------------------------- skill evidence notes */
  document.querySelectorAll('.skill').forEach(function (skill) {
    var station = skill.closest('.station');
    var note = station ? station.querySelector('.station-note') : null;
    if (!note) return;
    function show() { note.textContent = skill.dataset.note || ''; }
    skill.addEventListener('mouseenter', show);
    skill.addEventListener('focus', show);
    skill.addEventListener('click', show);
  });

  /* ---------------------------------------------------------- copy email */
  var copyBtn = document.getElementById('copy-email');
  if (copyBtn) {
    var label = copyBtn.querySelector('.copy-label');
    var revert = 0;
    copyBtn.addEventListener('click', function () {
      var email = copyBtn.dataset.email;
      function done(ok) {
        label.textContent = ok ? 'COPIED t=' + tickNow() : 'SELECT + CTRL C';
        clearTimeout(revert);
        revert = setTimeout(function () { label.textContent = 'COPY'; }, 2600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(function () { done(true); },
                                                  function () { done(false); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = email;
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        done(ok);
      }
    });
  }

  /* ---------------------------------------------------------- scroll-as-orbit
     One page equals one revolution. The only persistent scroll-linked motion. */
  var widget = document.getElementById('orbit-widget');
  if (widget && motionOK()) {
    widget.hidden = false;
    var dot = widget.querySelector('.orbit-dot');
    var wLabel = widget.querySelector('.orbit-label');
    var ticking = false;
    function paint() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var u = max > 0 ? window.scrollY / max : 0;
      dot.style.setProperty('--a', (u * 360 - 90) + 'deg');
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    paint();

    var labels = {
      fig0: 'FIG. 0', operator: '01 OPERATOR', experiments: '02 EXPERIMENTS',
      instrumentation: '03 INSTRUM.', results: '04 RESULTS',
      calibration: '05 CALIBR.', channel: '06 CHANNEL'
    };
    if ('IntersectionObserver' in window) {
      var secIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && labels[e.target.id]) wLabel.textContent = labels[e.target.id];
        });
      }, { rootMargin: '-40% 0px -50% 0px' });
      Object.keys(labels).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) secIO.observe(el);
      });
    }

    widget.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
