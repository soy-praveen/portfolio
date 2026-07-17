/* ════════════════════════════════════════════════════════════
   AURAL — Application
   Routing, theming, transport, controls, and the render loop.
   ════════════════════════════════════════════════════════════ */

import { AudioEngine, PATHS } from "./engine.js";
import { Visualizer } from "./visualizer.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const engine = new AudioEngine();
let viz = null;

/* ════════════════ THEME ════════════════ */
const VIZ_THEMES = {
  dark: {
    gold: 0xc9a24b, goldBright: 0xe6c476,
    avatar: 0x2b3247, metalness: 0.55, roughness: 0.32, phones: 0x11141c,
    lines: 0xe9e6dd, lineOpacity: 0.14,
    pointBase: 0x3d4257, bgFade: 0x10131b,
    hemi: 0.7, key: 1.1, orbLight: 1.4,
  },
  light: {
    gold: 0xa67c1e, goldBright: 0xb8860b,
    avatar: 0xcbc4b0, metalness: 0.25, roughness: 0.5, phones: 0x2e313d,
    lines: 0x1d1f2a, lineOpacity: 0.12,
    pointBase: 0x8f8a7c, bgFade: 0xfbf9f3,
    hemi: 1.15, key: 1.35, orbLight: 1.1,
  },
};

function currentTheme() {
  return document.documentElement.getAttribute("data-theme");
}

function applyTheme(name, save = true) {
  document.documentElement.setAttribute("data-theme", name);
  if (save) localStorage.setItem("aural-theme", name);
  if (viz) viz.setTheme(VIZ_THEMES[name]);
  heroColorsDirty = true;
  drawWave();
}

$("#themeToggle").addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
});

/* ════════════════ ROUTING + VEIL ════════════════ */
const veil = $(".veil");
let activeView = "home";
let navigating = false;

function showView(name) {
  $$(".view").forEach((v) => v.classList.remove("is-active"));
  $(`#view-${name}`).classList.add("is-active");
  $$(".nav-link").forEach((a) =>
    a.classList.toggle("is-active", a.dataset.nav === name));
  activeView = name;
  window.scrollTo(0, 0);
  if (name === "studio") requestAnimationFrame(ensureViz);
}

const curtain = veil.querySelector(".veil-curtain");

/* run `done` when the curtain finishes its sweep (fallback timer so it can never stall) */
function onCurtainDone(done) {
  let fired = false;
  const fin = () => {
    if (fired) return;
    fired = true;
    curtain.removeEventListener("transitionend", fin);
    done();
  };
  curtain.addEventListener("transitionend", fin);
  setTimeout(fin, 800);
}

function navigate(name) {
  if (name === activeView || navigating) return;
  navigating = true;
  veil.classList.add("is-closed"); // curtain sweeps down, covers the page
  onCurtainDone(() => {
    showView(name);
    history.replaceState(null, "", `#${name}`);
    // hold covered briefly so the new view settles behind the curtain
    setTimeout(() => {
      veil.classList.remove("is-closed");
      veil.classList.add("is-open"); // curtain continues down, off-screen
      onCurtainDone(() => {
        veil.classList.remove("is-open"); // snaps back above the viewport, invisible
        navigating = false;
      });
    }, 220);
  });
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-nav]");
  if (!link) return;
  e.preventDefault();
  navigate(link.dataset.nav);
});

window.addEventListener("hashchange", () => {
  const name = location.hash.slice(1);
  if (["home", "studio", "guide"].includes(name)) navigate(name);
});

// initial view from hash (no veil on first paint)
{
  const initial = location.hash.slice(1);
  if (["studio", "guide"].includes(initial)) showView(initial);
}

/* ════════════════ TOAST ════════════════ */
let toastTimer = null;
function toast(msg, ms = 3200) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-on"), ms);
}

/* ════════════════ HERO CANVAS (home) ════════════════ */
const heroCanvas = $("#heroCanvas");
const heroCtx = heroCanvas.getContext("2d");
let heroColorsDirty = true;
let heroCols = { dot: "#3d4257", gold: "#c9a24b", glow: "rgba(201,162,75,0.5)" };
let heroT = 0;

const HERO_RINGS = [
  { rx: 0.46, ry: 0.13, tilt: -0.16, n: 46, speed: 0.10, off: 0.0 },
  { rx: 0.36, ry: 0.19, tilt: 0.28, n: 38, speed: -0.07, off: 2.1 },
  { rx: 0.55, ry: 0.09, tilt: 0.06, n: 54, speed: 0.05, off: 4.2 },
  { rx: 0.28, ry: 0.24, tilt: -0.5, n: 30, speed: 0.13, off: 1.3 },
];

function refreshHeroColors() {
  const cs = getComputedStyle(document.documentElement);
  const isDark = currentTheme() === "dark";
  heroCols = {
    dot: isDark ? "rgba(233,230,221,0.34)" : "rgba(29,31,42,0.3)",
    gold: cs.getPropertyValue("--gold").trim() || "#c9a24b",
    glow: isDark ? "rgba(201,162,75,0.8)" : "rgba(166,124,30,0.7)",
  };
  heroColorsDirty = false;
}

function drawHero(dt) {
  const view = $("#view-home");
  if (!view.classList.contains("is-active")) return;
  const w = view.clientWidth, h = view.clientHeight;
  if (heroCanvas.width !== w * devicePixelRatio || heroCanvas.height !== h * devicePixelRatio) {
    heroCanvas.width = w * devicePixelRatio;
    heroCanvas.height = h * devicePixelRatio;
  }
  if (heroColorsDirty) refreshHeroColors();
  heroT += dt;

  const c = heroCtx;
  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.44;
  const S = Math.min(w, h);

  for (const ring of HERO_RINGS) {
    const cosT = Math.cos(ring.tilt), sinT = Math.sin(ring.tilt);
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + heroT * ring.speed + ring.off;
      let x = Math.cos(a) * ring.rx * S;
      let y = Math.sin(a) * ring.ry * S;
      const rx = x * cosT - y * sinT;
      const ry = x * sinT + y * cosT;
      const depth = (Math.sin(a) + 1) / 2;
      c.globalAlpha = 0.25 + depth * 0.75;
      c.fillStyle = heroCols.dot;
      c.beginPath();
      c.arc(cx + rx, cy + ry, 1 + depth * 1.3, 0, Math.PI * 2);
      c.fill();
    }
    // one golden traveller per ring
    const a = heroT * ring.speed * 3.2 + ring.off;
    let x = Math.cos(a) * ring.rx * S;
    let y = Math.sin(a) * ring.ry * S;
    const rx = x * cosT - y * sinT;
    const ry = x * sinT + y * cosT;
    c.globalAlpha = 1;
    c.shadowColor = heroCols.glow;
    c.shadowBlur = 16;
    c.fillStyle = heroCols.gold;
    c.beginPath();
    c.arc(cx + rx, cy + ry, 3, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  }
  c.globalAlpha = 1;
}

/* ════════════════ VISUALIZER ════════════════ */
function ensureViz() {
  if (viz || $("#workspace").hidden) return;
  viz = new Visualizer($("#stageCanvas"), {
    onManualDrag(dir) {
      engine.setManualFromPoint(dir.x, dir.y, dir.z);
      syncManualUi();
    },
  });
  viz.setTheme(VIZ_THEMES[currentTheme()]);
  viz.setMode(engine.mode);
  refreshPathPreview();
}

function refreshPathPreview() {
  if (!viz) return;
  viz.setPathPreview(PATHS[engine.path], engine.radius, engine.elevation, engine.mode === "auto");
}

/* ════════════════ FILE IMPORT ════════════════ */
const fileInput = $("#fileInput");
const dropZone = $("#dropZone");
const dropVeil = $("#dropVeil");

$("#browseBtn").addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

$("#demoBtn").addEventListener("click", async (e) => {
  e.stopPropagation();
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await engine.loadDemo();
    onTrackLoaded();
  } finally { btn.disabled = false; }
});

async function loadFile(file) {
  try {
    toast(`Decoding “${file.name}”…`);
    await engine.loadFile(file);
    onTrackLoaded();
    toast(`“${engine.fileName}” is ready`);
  } catch (err) {
    console.error(err);
    toast("That file could not be decoded as audio.");
  } finally {
    fileInput.value = "";
  }
}

function onTrackLoaded() {
  $("#importStage").hidden = true;
  $("#workspace").hidden = false;
  $("#trackName").textContent = engine.fileName;
  const b = engine.buffer;
  $("#trackSub").textContent =
    `${b.numberOfChannels === 1 ? "Mono" : "Stereo"} · ${(b.sampleRate / 1000).toFixed(1)} kHz · ${fmtTime(b.duration)}`;
  computePeaks();
  setPlayingUi(false);
  ensureViz();
  drawWave();
}

$("#changeTrackBtn").addEventListener("click", () => {
  engine.pause();
  setPlayingUi(false);
  $("#workspace").hidden = true;
  $("#importStage").hidden = false;
});

// window-level drag & drop while in studio
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (activeView !== "studio" || ![...e.dataTransfer.types].includes("Files")) return;
  dragDepth++;
  dropVeil.classList.add("is-on");
});
window.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) { dragDepth = 0; dropVeil.classList.remove("is-on"); }
});
window.addEventListener("dragover", (e) => {
  if (activeView === "studio") e.preventDefault();
});
window.addEventListener("drop", (e) => {
  dragDepth = 0;
  dropVeil.classList.remove("is-on");
  if (activeView !== "studio") return;
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

/* ════════════════ TRANSPORT ════════════════ */
const playBtn = $("#playBtn");
const loopBtn = $("#loopBtn");

function setPlayingUi(on) {
  playBtn.classList.toggle("is-playing", on);
  playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
}

playBtn.addEventListener("click", () => {
  if (!engine.buffer) return;
  if (engine.playing) { engine.pause(); setPlayingUi(false); }
  else { engine.play(); setPlayingUi(true); }
});

loopBtn.addEventListener("click", () => {
  engine.setLoop(!engine.loop);
  loopBtn.classList.toggle("is-on", engine.loop);
});

engine.onEnded = () => setPlayingUi(false);

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.target.matches("input, textarea, button")) return;
  if (!engine.buffer || activeView !== "studio") return;
  e.preventDefault();
  playBtn.click();
});

/* ---------- waveform ---------- */
const waveCanvas = $("#waveCanvas");
const waveWrap = $("#waveWrap");
const waveCtx = waveCanvas.getContext("2d");
let peaks = null;

function computePeaks() {
  const b = engine.buffer;
  if (!b) { peaks = null; return; }
  const N = 480;
  const out = new Float32Array(N);
  const ch0 = b.getChannelData(0);
  const ch1 = b.numberOfChannels > 1 ? b.getChannelData(1) : ch0;
  const per = Math.floor(b.length / N);
  for (let i = 0; i < N; i++) {
    let max = 0;
    const start = i * per;
    const step = Math.max(1, Math.floor(per / 40));
    for (let j = start; j < start + per; j += step) {
      const v = Math.abs(ch0[j]) + Math.abs(ch1[j]);
      if (v > max) max = v;
    }
    out[i] = Math.min(1, max * 0.55);
  }
  peaks = out;
}

function drawWave() {
  if (!peaks) return;
  const w = waveWrap.clientWidth, h = waveWrap.clientHeight;
  if (!w || !h) return;
  if (waveCanvas.width !== w * devicePixelRatio) {
    waveCanvas.width = w * devicePixelRatio;
    waveCanvas.height = h * devicePixelRatio;
  }
  const cs = getComputedStyle(document.documentElement);
  const baseCol = cs.getPropertyValue("--wave-base").trim();
  const fillCol = cs.getPropertyValue("--wave-fill").trim();
  const c = waveCtx;
  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  c.clearRect(0, 0, w, h);
  const N = peaks.length;
  const bw = w / N;
  const progress = engine.duration ? engine.getTime() / engine.duration : 0;
  const mid = h / 2;
  for (let i = 0; i < N; i++) {
    const amp = Math.max(1.2, peaks[i] * (h * 0.92)) / 2;
    c.fillStyle = i / N <= progress ? fillCol : baseCol;
    c.fillRect(i * bw + bw * 0.18, mid - amp, bw * 0.64, amp * 2);
  }
  $("#waveCursor").style.left = `${progress * 100}%`;
}

let seeking = false;
function seekFromEvent(e) {
  const r = waveWrap.getBoundingClientRect();
  const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  engine.seek(f * engine.duration);
}
waveWrap.addEventListener("pointerdown", (e) => {
  if (!engine.buffer) return;
  seeking = true;
  waveWrap.setPointerCapture(e.pointerId);
  seekFromEvent(e);
});
waveWrap.addEventListener("pointermove", (e) => { if (seeking) seekFromEvent(e); });
waveWrap.addEventListener("pointerup", () => { seeking = false; });

function fmtTime(t) {
  t = Math.max(0, Math.floor(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/* ════════════════ CONTROLS ════════════════ */
function bindSlider(id, valId, fmt, apply) {
  const el = $(id), val = $(valId);
  const update = () => {
    const v = parseFloat(el.value);
    const f = ((v - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty("--fill", `${f}%`);
    val.textContent = fmt(v);
    apply(v);
  };
  el.addEventListener("input", update);
  update();
}

bindSlider("#speedSlider", "#speedVal", (v) => `${v.toFixed(1)} rpm`, (v) => { engine.speedRpm = v; });
bindSlider("#distSlider", "#distVal", (v) => `${v.toFixed(1)} m`, (v) => {
  engine.radius = v;
  refreshPathPreview();
});
bindSlider("#elevSlider", "#elevVal", (v) => {
  if (v > 0.6) return "Above";
  if (v > 0.15) return "Raised";
  if (v < -0.6) return "Below";
  if (v < -0.15) return "Lowered";
  return "Level";
}, (v) => {
  engine.elevation = v;
  refreshPathPreview();
});
bindSlider("#reverbSlider", "#reverbVal", (v) => `${Math.round(v * 100)}%`, (v) => engine.setReverb(v));
bindSlider("#volumeSlider", "#volumeVal", (v) => `${Math.round(v * 100)}%`, (v) => engine.setVolume(v));

/* ---------- mode switch ---------- */
const modeSwitch = $("#modeSwitch");
$$(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    engine.mode = mode;
    modeSwitch.dataset.active = mode;
    $$(".mode-btn").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    $("#autoControls").hidden = mode !== "auto";
    $("#manualControls").hidden = mode !== "manual";
    if (viz) viz.setMode(mode);
    refreshPathPreview();
    if (mode === "manual") syncManualUi();
  });
});

/* ---------- path chips ---------- */
$$("#pathGrid .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $$("#pathGrid .chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    engine.path = chip.dataset.path;
    refreshPathPreview();
  });
});

/* ---------- direction ---------- */
$$("#dirSeg .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("#dirSeg .seg-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
    engine.direction = parseInt(btn.dataset.dir, 10);
  });
});

/* ---------- manual pad ---------- */
const pad = $("#posPad");
const padDot = $("#padDot");
let padActive = false;

function syncManualUi() {
  // pad dot from azimuth (top of pad = front)
  const f = 0.36; // fraction of pad radius
  const x = 50 + Math.sin(engine.manualAz) * f * 100;
  const y = 50 - Math.cos(engine.manualAz) * f * 100;
  padDot.style.left = `${x}%`;
  padDot.style.top = `${y}%`;
  // elevation slider reflects drag-set elevation
  const s = $("#elevSlider");
  if (Math.abs(parseFloat(s.value) - engine.elevation) > 0.02) {
    s.value = engine.elevation;
    s.dispatchEvent(new Event("input"));
  }
}

function padFromEvent(e) {
  const r = pad.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  engine.manualAz = Math.atan2(dx, -dy);
  syncManualUi();
}
pad.addEventListener("pointerdown", (e) => {
  padActive = true;
  pad.setPointerCapture(e.pointerId);
  padFromEvent(e);
});
pad.addEventListener("pointermove", (e) => { if (padActive) padFromEvent(e); });
pad.addEventListener("pointerup", () => { padActive = false; });
syncManualUi();

/* ---------- position readout ---------- */
const SECTORS = ["Front", "Front · Right", "Right", "Behind · Right", "Behind", "Behind · Left", "Left", "Front · Left"];
function updateReadout(pos) {
  const az = Math.atan2(pos.x, -pos.z);
  let deg = (az * 180 / Math.PI + 360) % 360;
  const sector = SECTORS[Math.round(deg / 45) % 8];
  const horiz = Math.hypot(pos.x, pos.z);
  let vert = "";
  if (pos.y > horiz * 0.45) vert = " · High";
  else if (pos.y < -horiz * 0.45) vert = " · Low";
  const label = sector + vert;
  const el = $("#posReadout");
  if (el.textContent !== label) el.textContent = label;
}

/* ════════════════ EXPORT ════════════════ */
const exportBtn = $("#exportBtn");
const exportLabel = $("#exportLabel");
const exportBar = $("#exportBar");
let exporting = false;

exportBtn.addEventListener("click", async () => {
  if (!engine.buffer || exporting) return;
  exporting = true;
  exportBtn.disabled = true;
  exportLabel.textContent = "Rendering";
  exportBar.classList.add("is-on");
  exportBar.firstElementChild.style.width = "4%";
  try {
    const blob = await engine.exportWav((p) => {
      exportBar.firstElementChild.style.width = `${Math.round(p * 100)}%`;
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${engine.fileName} (8D).wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    exportLabel.textContent = "Exported";
    toast("Render complete — WAV saved to your downloads.");
  } catch (err) {
    console.error(err);
    exportLabel.textContent = "Export failed";
    toast("Something went wrong during the render.");
  } finally {
    setTimeout(() => {
      exportLabel.textContent = "Export 8D Audio";
      exportBtn.disabled = false;
      exportBar.classList.remove("is-on");
      exportBar.firstElementChild.style.width = "0%";
      exporting = false;
    }, 2200);
  }
});

/* ════════════════ RENDER LOOP ════════════════ */
let last = performance.now();
let waveTick = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const pos = engine.update(dt);

  if (activeView === "home") {
    drawHero(dt);
  } else if (activeView === "studio" && viz && !$("#workspace").hidden) {
    viz.update(dt, pos, engine.getLevel());
    $("#timeCur").textContent = fmtTime(engine.getTime());
    $("#timeTotal").textContent = fmtTime(engine.duration);
    updateReadout(pos);
    // waveform redraw ~20 fps is plenty
    waveTick += dt;
    if (waveTick > 0.05) { waveTick = 0; drawWave(); }
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener("resize", () => { heroColorsDirty = true; drawWave(); });

/* initial theme — applied last, after all module state above is initialized */
applyTheme(
  localStorage.getItem("aural-theme") ||
  (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
  false
);
