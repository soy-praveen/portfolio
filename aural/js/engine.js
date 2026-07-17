/* ════════════════════════════════════════════════════════════
   AURAL - Audio Engine
   Web Audio graph:  source → gain → panner(HRTF) → dry ┐
                                        └→ convolver → wet ┴→ master → analyser → out
   Coordinate space: listener at origin facing -Z, +X right, +Y up.
   ════════════════════════════════════════════════════════════ */

/* ---------- Motion paths ----------
   Each path maps (phase, radius, elevOffset) → {x, y, z}.
   phase is in radians and accumulates over time (so speed changes never jump). */
export const PATHS = {
  orbit(p, r, ey) {
    return { x: r * Math.sin(p), y: ey, z: -r * Math.cos(p) };
  },
  pendulum(p, r, ey) {
    const az = Math.sin(p) * (Math.PI * 0.62); // sweep ±112° across the front
    return { x: r * Math.sin(az), y: ey, z: -r * Math.cos(az) };
  },
  wave(p, r, ey) {
    return { x: r * Math.sin(p), y: ey + r * 0.42 * Math.sin(2 * p), z: -r * Math.cos(p) };
  },
  eight(p, r, ey) {
    return { x: r * Math.sin(p), y: ey, z: -0.62 * r * Math.sin(2 * p) - 0.2 * r };
  },
  drift(p, r, ey) {
    const az = p * 0.55 + 1.7 * Math.sin(p * 0.37) + 0.8 * Math.sin(p * 0.13);
    const el = 0.35 * Math.sin(p * 0.21);
    const cy = Math.cos(el);
    return { x: r * cy * Math.sin(az), y: ey + r * el, z: -r * cy * Math.cos(az) };
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffer = null;
    this.fileName = "";
    this.source = null;

    this.playing = false;
    this.loop = false;
    this._startedAt = 0;
    this._offset = 0;
    this._stopFlag = false;
    this.onEnded = null;

    // spatial state
    this.mode = "auto";           // 'auto' | 'manual'
    this.path = "orbit";
    this.speedRpm = 8;            // revolutions per minute
    this.direction = 1;
    this.radius = 2.6;
    this.elevation = 0;           // -1..1
    this.phase = 0;
    this.manualAz = 0;            // radians, 0 = front
    this.pos = { x: 0, y: 0, z: -2.6 };

    this._settings = { reverb: 0.22, volume: 0.9 };
    this._level = 0;
  }

  /* ---------- Graph ---------- */
  _ensureCtx() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.inputGain = ctx.createGain();
    this.panner = this._makePanner(ctx);
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = makeImpulse(ctx, 2.8, 2.4);
    this.master = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this._freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.inputGain.connect(this.panner);
    this.panner.connect(this.dry);
    this.panner.connect(this.convolver);
    this.convolver.connect(this.wet);
    this.dry.connect(this.master);
    this.wet.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.setReverb(this._settings.reverb);
    this.setVolume(this._settings.volume);
  }

  _makePanner(ctx) {
    const p = ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 1.4;
    p.rolloffFactor = 0.9;
    p.positionX.value = this.pos.x;
    p.positionY.value = this.pos.y;
    p.positionZ.value = this.pos.z;
    return p;
  }

  /* ---------- Loading ---------- */
  async loadFile(file) {
    this._ensureCtx();
    const arr = await file.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr);
    this.stop();
    this.buffer = buf;
    this.fileName = file.name.replace(/\.[^.]+$/, "");
    this._offset = 0;
    return buf;
  }

  async loadDemo() {
    this._ensureCtx();
    this.stop();
    this.buffer = await synthDemo();
    this.fileName = "Aural Demo Tone";
    this._offset = 0;
    return this.buffer;
  }

  /* ---------- Transport ---------- */
  play() {
    if (!this.buffer) return;
    this._ensureCtx();
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this.playing) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this.loop;
    src.connect(this.inputGain);
    src.onended = () => {
      if (this._stopFlag) return;
      this.playing = false;
      this.source = null;
      this._offset = 0;
      if (this.onEnded) this.onEnded();
    };
    const offset = Math.min(this._offset, Math.max(0, this.buffer.duration - 0.01));
    src.start(0, offset);
    this.source = src;
    this._startedAt = this.ctx.currentTime - offset;
    this.playing = true;
  }

  pause() {
    if (!this.playing) return;
    this._offset = this.getTime();
    this._killSource();
  }

  stop() {
    this._offset = 0;
    this._killSource();
  }

  _killSource() {
    if (this.source) {
      this._stopFlag = true;
      try { this.source.stop(); } catch (_) {}
      try { this.source.disconnect(); } catch (_) {}
      this.source = null;
      this._stopFlag = false;
    }
    this.playing = false;
  }

  seek(t) {
    const wasPlaying = this.playing;
    this._killSource();
    this._offset = Math.max(0, Math.min(t, this.duration));
    if (wasPlaying) this.play();
  }

  setLoop(v) {
    this.loop = v;
    if (this.source) this.source.loop = v;
  }

  getTime() {
    if (!this.buffer) return 0;
    if (!this.playing) return this._offset;
    let t = this.ctx.currentTime - this._startedAt;
    if (this.loop && this.buffer.duration > 0) t %= this.buffer.duration;
    return Math.min(t, this.buffer.duration);
  }

  get duration() { return this.buffer ? this.buffer.duration : 0; }

  /* ---------- Spatial update (call every frame) ---------- */
  update(dt) {
    if (!this.ctx) return this.pos;

    if (this.mode === "auto") {
      if (this.playing) {
        this.phase += this.direction * (this.speedRpm / 60) * Math.PI * 2 * dt;
      }
      const ey = this.elevation * this.radius * 0.7;
      this.pos = PATHS[this.path](this.phase, this.radius, ey);
    } else {
      const ey = this.elevation * this.radius * 0.7;
      const cy = Math.cos(this.elevation * 0.9);
      this.pos = {
        x: this.radius * cy * Math.sin(this.manualAz),
        y: ey,
        z: -this.radius * cy * Math.cos(this.manualAz),
      };
    }

    const t = this.ctx.currentTime;
    const smooth = 0.045;
    this.panner.positionX.setTargetAtTime(this.pos.x, t, smooth);
    this.panner.positionY.setTargetAtTime(this.pos.y, t, smooth);
    this.panner.positionZ.setTargetAtTime(this.pos.z, t, smooth);
    return this.pos;
  }

  /* Set manual position directly from a world point (visualizer drag). */
  setManualFromPoint(x, y, z) {
    this.manualAz = Math.atan2(x, -z);
    const horiz = Math.hypot(x, z);
    const el = Math.atan2(y, Math.max(0.0001, horiz)) / (Math.PI / 2);
    this.elevation = Math.max(-1, Math.min(1, el * 1.4));
  }

  /* ---------- Levels ---------- */
  getLevel() {
    if (!this.analyser || !this.playing) { this._level *= 0.92; return this._level; }
    this.analyser.getByteFrequencyData(this._freqData);
    let sum = 0;
    for (let i = 0; i < this._freqData.length; i++) sum += this._freqData[i];
    const raw = sum / (this._freqData.length * 255);
    this._level = this._level * 0.8 + raw * 0.2;
    return this._level;
  }

  /* ---------- Mix ---------- */
  setReverb(v) {
    this._settings.reverb = v;
    if (this.wet) {
      this.wet.gain.setTargetAtTime(v * 1.15, this.ctx.currentTime, 0.05);
      this.dry.gain.setTargetAtTime(1 - v * 0.35, this.ctx.currentTime, 0.05);
    }
  }
  setVolume(v) {
    this._settings.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /* ---------- Offline export ----------
     Re-renders the whole buffer through an identical graph, automating the
     panner along the current path. Returns a WAV Blob. */
  async exportWav(onProgress) {
    if (!this.buffer) throw new Error("No audio loaded");
    const buf = this.buffer;
    const sr = buf.sampleRate;
    const len = Math.ceil(buf.duration * sr);
    const off = new OfflineAudioContext(2, len, sr);

    const src = off.createBufferSource();
    src.buffer = buf;
    const panner = off.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1.4;
    panner.rolloffFactor = 0.9;

    const dry = off.createGain();
    const wet = off.createGain();
    const convolver = off.createConvolver();
    convolver.buffer = makeImpulse(off, 2.8, 2.4);
    const master = off.createGain();

    src.connect(panner);
    panner.connect(dry);
    panner.connect(convolver);
    convolver.connect(wet);
    dry.connect(master);
    wet.connect(master);
    master.connect(off.destination);

    wet.gain.value = this._settings.reverb * 1.15;
    dry.gain.value = 1 - this._settings.reverb * 0.35;
    master.gain.value = this._settings.volume;

    // Automate motion at 30 Hz along the whole timeline.
    const step = 1 / 30;
    const omega = this.direction * (this.speedRpm / 60) * Math.PI * 2;
    const ey = this.elevation * this.radius * 0.7;
    let px = panner.positionX, py = panner.positionY, pz = panner.positionZ;

    if (this.mode === "manual") {
      const p = this.pos;
      px.setValueAtTime(p.x, 0); py.setValueAtTime(p.y, 0); pz.setValueAtTime(p.z, 0);
    } else {
      const fn = PATHS[this.path];
      const first = fn(0, this.radius, ey);
      px.setValueAtTime(first.x, 0); py.setValueAtTime(first.y, 0); pz.setValueAtTime(first.z, 0);
      for (let t = step; t <= buf.duration; t += step) {
        const p = fn(omega * t, this.radius, ey);
        px.linearRampToValueAtTime(p.x, t);
        py.linearRampToValueAtTime(p.y, t);
        pz.linearRampToValueAtTime(p.z, t);
      }
    }

    src.start(0);

    if (onProgress && off.suspend) {
      // report progress at 10 checkpoints
      for (let i = 1; i < 10; i++) {
        const at = (buf.duration * i) / 10;
        off.suspend(at).then(() => { onProgress(i / 10); off.resume(); }).catch(() => {});
      }
    }

    const rendered = await off.startRendering();
    if (onProgress) onProgress(1);
    return encodeWav(rendered);
  }
}

/* ---------- Procedural reverb impulse ---------- */
export function makeImpulse(ctx, seconds = 2.8, decay = 2.4) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/* ---------- WAV encoding (16-bit PCM stereo) ---------- */
export function encodeWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}

/* ---------- Demo tone: a short ambient arpeggio, rendered offline ---------- */
async function synthDemo() {
  const sr = 44100;
  const dur = 16;
  const off = new OfflineAudioContext(2, sr * dur, sr);

  const master = off.createGain();
  master.gain.value = 0.5;
  const verb = off.createConvolver();
  verb.buffer = makeImpulse(off, 3.2, 2.6);
  const wet = off.createGain();
  wet.gain.value = 0.5;
  master.connect(off.destination);
  master.connect(verb);
  verb.connect(wet);
  wet.connect(off.destination);

  // A minor pentatonic-ish arpeggio: A3 C4 E4 A4 B4 E5 ...
  const notes = [220, 261.63, 329.63, 440, 493.88, 659.25, 440, 329.63];
  const beat = 0.5;
  for (let t = 0, i = 0; t < dur - 1; t += beat, i++) {
    const f = notes[i % notes.length] * (i % 16 >= 8 ? 0.75 : 1);
    const osc = off.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const osc2 = off.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = f * 2.001;
    const g = off.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + beat * 2.4);
    const g2 = off.createGain();
    g2.gain.value = 0.18;
    osc.connect(g);
    osc2.connect(g2);
    g2.connect(g);
    g.connect(master);
    osc.start(t); osc.stop(t + beat * 2.5);
    osc2.start(t); osc2.stop(t + beat * 2.5);
  }

  // low drone
  const drone = off.createOscillator();
  drone.type = "sine";
  drone.frequency.value = 110;
  const dg = off.createGain();
  dg.gain.setValueAtTime(0, 0);
  dg.gain.linearRampToValueAtTime(0.12, 1.5);
  dg.gain.setValueAtTime(0.12, dur - 2);
  dg.gain.linearRampToValueAtTime(0, dur - 0.05);
  drone.connect(dg); dg.connect(master);
  drone.start(0); drone.stop(dur);

  return off.startRendering();
}
