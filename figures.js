/* Figures 2–5: a real neural network, two rank fields, an escrow that refuses,
   and a parser that tags spans. Nothing here is a mock — the net actually runs. */
(function () {
  'use strict';

  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionOK = function () { return !RM.matches; };
  /* colors come from the live CSS tokens so the night edition just works */
  var INK, ACCENT, TEAL, PLATE;
  var THEME_REDRAWS = [];
  function refreshFigPalette() {
    var cs = getComputedStyle(document.documentElement);
    var v = function (n, fb) { var x = cs.getPropertyValue(n).trim(); return x || fb; };
    INK = v('--ink', '#16181D'); ACCENT = v('--accent', '#E0531F');
    TEAL = v('--data2', '#1F6F6B'); PLATE = v('--plate', '#FFFFFF');
  }
  refreshFigPalette();
  window.addEventListener('orrerytheme', function () {
    refreshFigPalette();
    THEME_REDRAWS.forEach(function (f) { f(); });
  });

  function onEnter(el, cb, threshold) {
    if (!el) return;
    if (!motionOK() || !('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); cb(); }
    }, { threshold: threshold || 0.35 });
    io.observe(el);
  }

  /* ============================================================ FIG. 2
     The gravity net: 9 inputs -> 3 hidden (column sums, ReLU) -> 9 outputs.
     out(r,c) fires iff column c holds at least (3-r) live cells.
     Pruned: 9 + 9 nonzero weights, 6 nonzero biases = 24 parameters. */
  (function mlp() {
    var inGrid = document.getElementById('mlp-in');
    var outGrid = document.getElementById('mlp-out');
    var net = document.getElementById('mlp-net');
    var readout = document.getElementById('mlp-readout');
    if (!inGrid || !outGrid || !net) return;

    var state = [1, 0, 1, 0, 1, 0, 0, 0, 1];       // r*3+c
    var inCells = [], outCells = [];

    for (var i = 0; i < 9; i++) {
      var b = document.createElement('button');
      b.className = 'mlp-cell';
      b.type = 'button';
      b.setAttribute('aria-pressed', state[i] ? 'true' : 'false');
      b.setAttribute('aria-label', 'cell row ' + (Math.floor(i / 3) + 1) + ' column ' + (i % 3 + 1));
      (function (idx) {
        b.addEventListener('click', function () {
          state[idx] = state[idx] ? 0 : 1;
          this.setAttribute('aria-pressed', state[idx] ? 'true' : 'false');
          forward();
        });
      })(i);
      inGrid.appendChild(b);
      inCells.push(b);
      var o = document.createElement('div');
      o.className = 'mlp-cell';
      outGrid.appendChild(o);
      outCells.push(o);
    }

    // build the SVG network once
    var NS = 'http://www.w3.org/2000/svg';
    var inY = function (i) { return 16 + i * 23; };
    var hidY = function (j) { return 62 + j * 46; };
    var edges = [], hidTexts = [], inNodes = [], outNodes = [];

    function line(x1, y1, x2, y2, color, w) {
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.style.stroke = color; l.setAttribute('stroke-width', w);
      net.appendChild(l);
      return l;
    }
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      var idx = r * 3 + c;
      edges.push({ el: line(38, inY(idx), 141, hidY(c), 'var(--accent)', 1.5), from: idx });
      line(159, hidY(c), 262, inY(idx), 'var(--accent)', 1.5).setAttribute('opacity', '0.85');
    }
    for (i = 0; i < 9; i++) {
      var ci = document.createElementNS(NS, 'circle');
      ci.setAttribute('cx', 30); ci.setAttribute('cy', inY(i)); ci.setAttribute('r', 6);
      ci.style.fill = 'var(--plate)'; ci.style.stroke = 'var(--ink)'; ci.setAttribute('stroke-width', 1.3);
      net.appendChild(ci); inNodes.push(ci);
      var co = document.createElementNS(NS, 'circle');
      co.setAttribute('cx', 270); co.setAttribute('cy', inY(i)); co.setAttribute('r', 6);
      co.style.fill = 'var(--plate)'; co.style.stroke = 'var(--ink)'; co.setAttribute('stroke-width', 1.3);
      net.appendChild(co); outNodes.push(co);
      var rr = Math.floor(i / 3);
      if (rr < 2) {                                  // nonzero bias: -(2-r)
        var bt = document.createElementNS(NS, 'text');
        bt.setAttribute('x', 280); bt.setAttribute('y', inY(i) + 3);
        bt.style.fill = 'var(--data2)';
        bt.setAttribute('style', 'font: 8.5px ui-monospace, Consolas, monospace;');
        bt.textContent = String(rr - 2);
        net.appendChild(bt);
      }
    }
    for (var j = 0; j < 3; j++) {
      var ch = document.createElementNS(NS, 'circle');
      ch.setAttribute('cx', 150); ch.setAttribute('cy', hidY(j)); ch.setAttribute('r', 9);
      ch.style.fill = 'var(--plate)'; ch.style.stroke = 'var(--ink)'; ch.setAttribute('stroke-width', 1.3);
      net.appendChild(ch);
      var th = document.createElementNS(NS, 'text');
      th.setAttribute('x', 150); th.setAttribute('y', hidY(j) + 3);
      th.setAttribute('text-anchor', 'middle');
      th.style.fill = 'var(--ink)';
      th.setAttribute('style', 'font: 9px ui-monospace, Consolas, monospace;');
      th.textContent = '0';
      net.appendChild(th);
      hidTexts.push(th);
    }

    function forward() {
      var t0 = performance.now();
      var h = [0, 0, 0];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) h[c] += state[r * 3 + c];
      h = h.map(function (v) { return Math.max(0, v); });   // ReLU (inputs are 0/1)
      var out = [];
      for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) out.push(h[c] - (2 - r) > 0.5 ? 1 : 0);
      var ms = Math.max(0.001, performance.now() - t0);

      for (var i = 0; i < 9; i++) {
        inNodes[i].style.fill = state[i] ? 'var(--ink)' : 'var(--plate)';
        edges[i].el.setAttribute('opacity', state[i] ? '1' : '0.18');
        outNodes[i].style.fill = out[i] ? 'var(--accent)' : 'var(--plate)';
        outNodes[i].style.stroke = out[i] ? 'var(--accent)' : 'var(--ink)';
        outCells[i].classList.toggle('on', !!out[i]);
      }
      for (var jj = 0; jj < 3; jj++) hidTexts[jj].textContent = String(h[jj]);
      if (readout) readout.textContent =
        'PARAMS: 24 · LAYERS: 2 · LAST INFERENCE: ' + ms.toFixed(3) + 'ms';
    }
    forward();
  })();

  /* ============================================================ FIG. 4 — rank fields */
  function rankField(fig) {
    var canvas = fig.querySelector('canvas');
    var callout = fig.querySelector('.rank-callout');
    var N = parseInt(fig.dataset.n, 10);
    var rank = parseInt(fig.dataset.rank, 10);
    var ctx = canvas.getContext('2d');
    var dots = [], cols = 0, cell = 4, dotW = 2;
    var W = 0, H = 0, dpr = 1, settled = false, rafId = 0;

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = fig.clientWidth;
      cols = Math.max(40, Math.floor(W / cell));
      var rows = Math.ceil(N / cols);
      H = rows * cell + 6;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = new Array(N);
      for (var i = 0; i < N; i++) {
        var tx = (i % cols) * cell + 1;
        var ty = Math.floor(i / cols) * cell + 4;
        dots[i] = {
          tx: tx, ty: ty,
          sx: tx + (Math.random() - 0.5) * 60,
          sy: ty - 40 - Math.random() * 140,
          delay: (i / N) * 0.45 + Math.random() * 0.25
        };
      }
      var hi = dots[rank - 1];
      if (callout && hi) {
        callout.textContent = fig.dataset.label;
        var x = Math.max(70, Math.min(W - 70, hi.tx));
        callout.style.left = x + 'px';
      }
    }

    function drawAt(progress) {                      // progress in seconds since start
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.5;
      var allDone = true;
      for (var i = 0; i < N; i++) {
        if (i === rank - 1) continue;
        var d = dots[i];
        var u = progress === Infinity ? 1 : Math.max(0, Math.min(1, (progress - d.delay) / 0.9));
        if (u < 1) allDone = false;
        var e = 1 - Math.pow(1 - u, 3);
        ctx.fillRect(d.sx + (d.tx - d.sx) * e, d.sy + (d.ty - d.sy) * e, dotW, dotW);
      }
      ctx.globalAlpha = 1;
      var hi = dots[rank - 1];
      var uh = progress === Infinity ? 1 : Math.max(0, Math.min(1, (progress - hi.delay) / 0.9));
      if (uh < 1) allDone = false;
      var eh = 1 - Math.pow(1 - uh, 3);
      var hx = hi.sx + (hi.tx - hi.sx) * eh, hy = hi.sy + (hi.ty - hi.sy) * eh;
      if (uh >= 1) {                                 // hairline up to the callout
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hx + 1, hy - 3); ctx.lineTo(hx + 1, -6); ctx.stroke();
      }
      ctx.fillStyle = ACCENT;
      ctx.fillRect(hx - 1.5, hy - 1.5, 5, 5);
      return allDone;
    }

    function animate() {
      var t0 = performance.now();
      function tick(now) {
        var done = drawAt((now - t0) / 1000);
        if (!done) rafId = requestAnimationFrame(tick);
        else { settled = true; rafId = 0; }
      }
      rafId = requestAnimationFrame(tick);
    }

    layout();
    onEnter(fig, function () {
      if (motionOK()) animate();
      else { settled = true; drawAt(Infinity); }
    }, 0.3);

    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        layout();
        if (settled || !motionOK()) { settled = true; drawAt(Infinity); }
        else animate();
      }, 150);
    });

    THEME_REDRAWS.push(function () {
      if (settled || !motionOK()) { settled = true; drawAt(Infinity); }
    });
  }
  ['rank-1', 'rank-2'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) rankField(el);
  });

  /* ============================================================ FIG. 4b — the soulbound seal */
  (function sbt() {
    var seal = document.getElementById('sbt-seal');
    if (!seal) return;
    var origin = null;
    seal.addEventListener('pointerdown', function (e) {
      origin = { x: e.clientX, y: e.clientY };
      seal.setPointerCapture(e.pointerId);
      seal.style.transition = 'none';
    });
    seal.addEventListener('pointermove', function (e) {
      if (!origin) return;
      var dx = e.clientX - origin.x, dy = e.clientY - origin.y;
      var d = Math.hypot(dx, dy) || 1;
      var pull = 10 * d / (d + 60);                  // rubber-band: max ~10px, hard cap
      seal.style.transform = 'translate(' + (dx / d * pull) + 'px,' + (dy / d * pull) + 'px)';
    });
    function release() {
      if (!origin) return;
      origin = null;
      seal.style.transition = '';
      seal.style.transform = '';
    }
    seal.addEventListener('pointerup', release);
    seal.addEventListener('pointercancel', release);
  })();

  /* ============================================================ FIG. 5 — parser */
  (function parser() {
    var fig = document.getElementById('parser-fig');
    if (!fig) return;
    var toks = fig.querySelectorAll('.tok');
    var count = document.getElementById('parser-count');
    if (!motionOK()) { if (count) count.textContent = String(toks.length); return; }
    if (count) count.textContent = '0';
    onEnter(fig, function () {
      toks.forEach(function (tok, i) {
        setTimeout(function () {
          tok.classList.add('hit');
          if (count) count.textContent = String(i + 1);
        }, 350 + i * 300);
      });
    }, 0.5);
  })();
})();
