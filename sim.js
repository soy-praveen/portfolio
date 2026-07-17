/* FIG. 0 - the orbital-intercept planner.
   Plan-then-fly: the agent forward-simulates planet motion over an 18-tick
   horizon, solves an intercept, DRAWS the plan first, then flies it.
   The pointer is a gravity perturbation; big enough disturbances force a replan. */
(function () {
  'use strict';

  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var TICK = 0.35;                    // seconds per tick
  var HORIZON = 18;                   // ticks the agent may look ahead
  /* colors track the live CSS tokens - the night edition repaints for free
     since the sim redraws every frame anyway */
  var INK, MUTED, ACCENT, TEAL, HAIR, PAPER;
  var SIM_REDRAWS = [];
  function refreshSimPalette() {
    var cs = getComputedStyle(document.documentElement);
    var v = function (n, fb) { var x = cs.getPropertyValue(n).trim(); return x || fb; };
    INK = v('--ink', '#16181D'); MUTED = v('--ink-muted', '#4A5160');
    ACCENT = v('--accent', '#E0531F'); TEAL = v('--data2', '#1F6F6B');
    HAIR = v('--hairline', '#D8D2C4'); PAPER = v('--paper', '#F7F4EE');
  }
  refreshSimPalette();
  window.addEventListener('orrerytheme', function () {
    refreshSimPalette();
    SIM_REDRAWS.forEach(function (f) { f(); });
  });
  var loggedPlan = false;

  function createOrbitSim(canvas, opts) {
    var ctx = canvas.getContext('2d');
    var interactive = !!opts.interactive;
    var nPlanets = opts.planets;
    var dpr = 1, W = 0, H = 0, minDim = 0, cx = 0, cy = 0;
    var pointer = null;             // {x, y} in css px
    var hoverPlanet = -1;
    var simT = 0, lastNow = null, running = false, visible = false, rafId = 0;
    var planets = [];
    var ship = { x: 0, y: 0, angle: 0 };
    var plan = null;                // {target,T,solveT,arriveT,p0,p1,progress,phase}
    var ghosts = [];                // fading abandoned plans

    for (var i = 0; i < nPlanets; i++) {
      planets.push({
        rf: 0.16 + (0.42 - 0.16) * (nPlanets === 1 ? 0 : i / (nPlanets - 1)),
        a0: Math.random() * Math.PI * 2,
        revTicks: 42 + i * 16 + Math.random() * 8,
        prad: 3.5 + Math.random() * 3,
        ox: 0, oy: 0                 // perturbation offset (spring)
      });
    }

    function omega(p) { return (Math.PI * 2) / (p.revTicks * TICK); }
    function basePos(p, t) {
      var a = p.a0 + omega(p) * t;
      var r = p.rf * minDim;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    }
    function livePos(p, t) {
      var b = basePos(p, t);
      return { x: b.x + p.ox, y: b.y + p.oy };
    }
    function vmax() { return minDim * 0.22; }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      var oldMin = minDim, oldCx = cx, oldCy = cy;
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      minDim = Math.min(W, H);
      if (interactive && W > 900) { cx = W * 0.62; cy = H * 0.54; }
      else if (interactive) { cx = W * 0.5; cy = H * (W < 640 ? 0.72 : 0.6); }
      else { cx = W * 0.5; cy = H * 0.5; }
      if (oldMin > 0) {             // carry the ship into the new layout
        var sc = minDim / oldMin;
        ship.x = cx + (ship.x - oldCx) * sc;
        ship.y = cy + (ship.y - oldCy) * sc;
        plan = null; ghosts = [];
      } else {                      // first layout: park the ship on an inner track
        var s = basePos(planets[0], 0);
        ship.x = s.x; ship.y = s.y;
      }
    }

    /* Solve: smallest arrival tick T such that the required straight-line
       speed to the target's predicted position is inside the ship's budget. */
    function solveIntercept(fromX, fromY, pIdx, tNow) {
      var p = planets[pIdx];
      for (var T = 4; T <= HORIZON; T++) {
        var fut = basePos(p, tNow + T * TICK);
        fut.x += p.ox; fut.y += p.oy;
        var d = Math.hypot(fut.x - fromX, fut.y - fromY);
        if (d / (T * TICK) <= vmax() * 0.95) return { T: T, dest: fut, speed: d / (T * TICK) };
      }
      return null;
    }

    function makePlan(tNow) {
      var order = [];
      for (var i = 0; i < planets.length; i++) order.push(i);
      order.sort(function () { return Math.random() - 0.5; });
      if (plan && plan.target >= 0) {                 // avoid re-targeting the same planet
        order = order.filter(function (i) { return i !== plan.target; });
        order.push(plan.target);
      }
      for (var k = 0; k < order.length; k++) {
        var sol = solveIntercept(ship.x, ship.y, order[k], tNow);
        if (sol) {
          var mx = (ship.x + sol.dest.x) / 2, my = (ship.y + sol.dest.y) / 2;
          var dx = sol.dest.x - ship.x, dy = sol.dest.y - ship.y;
          var len = Math.hypot(dx, dy) || 1;
          var bend = (Math.random() < 0.5 ? 1 : -1) * Math.min(len * 0.28, minDim * 0.12);
          var next = {
            target: order[k], T: sol.T,
            solveT: tNow, arriveT: tNow + sol.T * TICK,
            p0: { x: ship.x, y: ship.y },
            p1: { x: mx - (dy / len) * bend, y: my + (dx / len) * bend },
            plannedDest: sol.dest,
            progress: 0, phase: 'draw', hold: 0
          };
          if (interactive && !loggedPlan) {
            loggedPlan = true;
            try {
              console.log('%cFIG. 0 - the agent is planning. Current plan:', 'font-weight:bold');
              console.table([{ target: 'planet ' + next.target, eta: 't+' + next.T, 'speed (px/s)': Math.round(sol.speed) }]);
              console.log('Hand-set in HTML, CSS and JavaScript. No frameworks. - S.P.');
            } catch (e) { /* consoles differ; the page must not */ }
          }
          return next;
        }
      }
      return null;
    }

    function liveDest(tNow) {                  // the target keeps moving; track it
      var p = planets[plan.target];
      var fut = basePos(p, plan.arriveT);
      return { x: fut.x + p.ox, y: fut.y + p.oy };
    }

    function bez(p0, p1, p2, u) {
      var w = 1 - u;
      return { x: w * w * p0.x + 2 * w * u * p1.x + u * u * p2.x,
               y: w * w * p0.y + 2 * w * u * p1.y + u * u * p2.y };
    }

    function step(dt, tNow) {
      // pointer gravity: planets spring toward a displaced target near the cursor
      for (var i = 0; i < planets.length; i++) {
        var p = planets[i];
        var tx = 0, ty = 0;
        if (pointer) {
          var b = basePos(p, tNow);
          var dx = b.x - pointer.x, dy = b.y - pointer.y;
          var dist = Math.hypot(dx, dy);
          var R = minDim * 0.28;
          if (dist < R && dist > 0.001) {
            var push = (R - dist) / R * minDim * 0.055;
            tx = (dx / dist) * push; ty = (dy / dist) * push;
          }
        }
        var k = Math.min(1, dt * 5);
        p.ox += (tx - p.ox) * k;
        p.oy += (ty - p.oy) * k;
      }

      if (!plan) { plan = makePlan(tNow); return; }

      if (plan.phase === 'draw') {
        plan.progress = Math.min(1, plan.progress + dt / 0.35);
        if (plan.progress >= 1) plan.phase = 'holdBeat';
      } else if (plan.phase === 'holdBeat') {
        plan.hold += dt;
        if (plan.hold >= 0.4) plan.phase = 'fly';
      } else if (plan.phase === 'fly') {
        var dest = liveDest(tNow);
        // a big enough disturbance of the rendezvous point forces a replan
        var drift = Math.hypot(dest.x - plan.plannedDest.x, dest.y - plan.plannedDest.y);
        if (drift > minDim * 0.05) {
          plan.ghostAge = 0;
          ghosts.push(plan);
          if (ghosts.length > 3) ghosts.shift();
          var saved = plan;
          plan = makePlan(tNow);
          if (!plan) { plan = saved; ghosts.pop(); }
          return;
        }
        var u = (tNow - plan.solveT - 0.35 - 0.4) / (plan.arriveT - plan.solveT);
        u = Math.max(0, Math.min(1, u * (plan.arriveT - plan.solveT) / Math.max(0.001, plan.arriveT - plan.solveT - 0.75)));
        var pos = bez(plan.p0, plan.p1, dest, u);
        var ahead = bez(plan.p0, plan.p1, dest, Math.min(1, u + 0.02));
        ship.angle = Math.atan2(ahead.y - pos.y, ahead.x - pos.x);
        ship.x = pos.x; ship.y = pos.y;
        if (u >= 1) plan = makePlan(tNow);
      }

      for (var g = ghosts.length - 1; g >= 0; g--) {
        ghosts[g].ghostAge += dt;
        if (ghosts[g].ghostAge > 0.9) ghosts.splice(g, 1);
      }
    }

    /* -------------------------------------------------- drawing */
    function ringPath(p, tNow) {
      ctx.beginPath();
      var r = p.rf * minDim;
      for (var s = 0; s <= 72; s++) {
        var a = (s / 72) * Math.PI * 2;
        var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (pointer) {                       // the ring itself bulges near the cursor
          var dx = x - pointer.x, dy = y - pointer.y;
          var dist = Math.hypot(dx, dy);
          var R = minDim * 0.28;
          if (dist < R && dist > 0.001) {
            var push = (R - dist) / R * minDim * 0.055;
            x += (dx / dist) * push; y += (dy / dist) * push;
          }
        }
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    function drawPlanPath(pl, tNow, color, alpha, prog) {
      var dest = pl === plan && pl.phase !== 'draw' ? liveDest(tNow) : pl.plannedDest;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      var segs = 42, upTo = Math.max(2, Math.round(segs * prog));
      for (var s = 0; s <= upTo; s++) {
        var pt = bez(pl.p0, pl.p1, dest, s / segs);
        if (s === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (prog >= 1) {
        ctx.beginPath();
        ctx.arc(dest.x, dest.y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '10px ui-monospace, Consolas, monospace';
        ctx.fillStyle = color;
        ctx.fillText('t+' + pl.T, dest.x + 9, dest.y - 8);
      }
      ctx.restore();
    }

    function draw(tNow) {
      ctx.clearRect(0, 0, W, H);

      // sun: three concentric hairline rings
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      [5, 9, 13].forEach(function (r, idx) {
        ctx.beginPath();
        ctx.globalAlpha = idx === 0 ? 0.9 : 0.35;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // orbit rings + planets
      for (var i = 0; i < planets.length; i++) {
        var p = planets[i];
        ctx.strokeStyle = HAIR; ctx.lineWidth = 1;
        ringPath(p, tNow);
        ctx.stroke();
        var pos = livePos(p, tNow);
        ctx.beginPath();
        ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
        ctx.arc(pos.x, pos.y, p.prad, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        if (i === hoverPlanet) {
          ctx.beginPath();
          ctx.strokeStyle = TEAL; ctx.lineWidth = 1;
          ctx.arc(pos.x, pos.y, p.prad + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // abandoned plans decay in teal
      for (var g = 0; g < ghosts.length; g++) {
        drawPlanPath(ghosts[g], tNow, TEAL, 0.3 * (1 - ghosts[g].ghostAge / 0.9), 1);
      }

      // hover: alternative intercept branches, opacity by softmax weight
      if (interactive && hoverPlanet >= 0 && plan) {
        var alts = [], scores = [];
        var base = solveIntercept(ship.x, ship.y, hoverPlanet, tNow);
        if (base) {
          [0, 4, 8].forEach(function (dT) {
            var T = base.T + dT;
            if (T > HORIZON) return;
            var p2 = planets[hoverPlanet];
            var fut = basePos(p2, tNow + T * TICK);
            fut.x += p2.ox; fut.y += p2.oy;
            var d = Math.hypot(fut.x - ship.x, fut.y - ship.y);
            alts.push({ T: T, dest: fut });
            scores.push(-d / (T * TICK) / vmax());
          });
          var mx = Math.max.apply(null, scores), sum = 0;
          var ws = scores.map(function (s) { var w = Math.exp((s - mx) * 3); sum += w; return w; });
          alts.forEach(function (a, idx) {
            var mid = { x: (ship.x + a.dest.x) / 2 - (a.dest.y - ship.y) * 0.12,
                        y: (ship.y + a.dest.y) / 2 + (a.dest.x - ship.x) * 0.12 };
            drawPlanPath({ p0: { x: ship.x, y: ship.y }, p1: mid, plannedDest: a.dest, T: a.T },
                         tNow, TEAL, 0.15 + 0.45 * (ws[idx] / sum), 1);
          });
        }
      }

      // the current plan - always drawn before the ship moves
      if (plan) {
        drawPlanPath(plan, tNow, ACCENT, 0.95,
          plan.phase === 'draw' ? plan.progress : 1);
      }

      // the agent
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.moveTo(7, 0); ctx.lineTo(-5, 4.4); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, -4.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* -------------------------------------------------- loop + gating */
    function frame(now) {
      rafId = 0;
      if (!running) return;
      if (lastNow == null) lastNow = now;
      var dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      simT += dt;
      step(dt, simT);
      draw(simT);
      rafId = requestAnimationFrame(frame);
    }
    function start() {
      if (running || RM.matches) return;
      running = true; lastNow = null;
      if (!rafId) rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }

    function drawStatic() {
      // reduced motion: one solved frame - planets, ship, one complete plan
      simT = 2;
      plan = makePlan(simT);
      if (plan) { plan.phase = 'holdBeat'; plan.progress = 1; }
      draw(simT);
    }

    if (interactive) {
      canvas.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
        hoverPlanet = -1;
        for (var i = 0; i < planets.length; i++) {
          var pos = livePos(planets[i], simT);
          if (Math.hypot(pos.x - pointer.x, pos.y - pointer.y) < planets[i].prad + 14) hoverPlanet = i;
        }
      });
      canvas.addEventListener('pointerleave', function () { pointer = null; hoverPlanet = -1; });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (RM.matches) return;
        if (visible && !document.hidden) start(); else stop();
      }, { threshold: 0.05 });
      io.observe(canvas);
    } else {
      visible = true;
      if (!RM.matches) start();
    }

    document.addEventListener('visibilitychange', function () {
      if (RM.matches) return;
      if (document.hidden) stop(); else if (visible) start();
    });

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        if (RM.matches) drawStatic();
      }, 120);
    });

    RM.addEventListener('change', function () {
      if (RM.matches) { stop(); drawStatic(); }
      else if (visible && !document.hidden) start();
    });

    resize();
    if (RM.matches) drawStatic();
    SIM_REDRAWS.push(function () { if (RM.matches) drawStatic(); });
  }

  var hero = document.getElementById('hero-canvas');
  if (hero) createOrbitSim(hero, { planets: window.innerWidth < 768 ? 4 : 5, interactive: true });
  var mini = document.getElementById('exp1-canvas');
  if (mini) createOrbitSim(mini, { planets: 3, interactive: false });
})();
