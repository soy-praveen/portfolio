/* ════════════════════════════════════════════════════════════
   AURAL - 3D Visualizer
   A listener bust at the origin, wrapped in a globe of points.
   Points brighten toward the sound source; a golden orb traces
   the motion path and lights the avatar from its direction.
   Coordinates match the audio engine: -Z is front, +X right.
   ════════════════════════════════════════════════════════════ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const GLOBE_R = 3.4;
const POINT_COUNT = 520;

/* audio distance (1..6 m) → visual distance from head */
function visDist(audioLen) {
  return 0.9 + (Math.min(audioLen, 6) / 6) * 3.1;
}

export class Visualizer {
  constructor(canvas, { onManualDrag } = {}) {
    this.canvas = canvas;
    this.onManualDrag = onManualDrag || (() => {});
    this.mode = "auto";
    this.dragging = false;

    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(2.6, 2.4, 7.4);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, -0.15, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 13;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.maxPolarAngle = Math.PI * 0.78;

    this._buildLights();
    this._buildAvatar();
    this._buildGlobe();
    this._buildOrb();
    this._buildPathLine();
    this._bindPointer();

    this._resize = this._resize.bind(this);
    new ResizeObserver(this._resize).observe(canvas.parentElement);
    this._resize();
  }

  /* ---------- construction ---------- */
  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x202030, 0.7);
    this.key = new THREE.DirectionalLight(0xffffff, 1.1);
    this.key.position.set(3.5, 5, 4);
    this.rim = new THREE.DirectionalLight(0xc9a24b, 0.9);
    this.rim.position.set(-4, 2.5, -5);
    this.orbLight = new THREE.PointLight(0xc9a24b, 1.4, 12, 1.6);
    this.scene.add(this.hemi, this.key, this.rim, this.orbLight);
  }

  _buildAvatar() {
    const g = new THREE.Group();

    // listener: a polished sphere wearing headphones
    this.avatarMat = new THREE.MeshStandardMaterial({
      color: 0x262c3e, roughness: 0.38, metalness: 0.5,
    });
    this.phoneMat = new THREE.MeshStandardMaterial({
      color: 0x11141c, roughness: 0.45, metalness: 0.35,
    });
    this.accentMat = new THREE.MeshBasicMaterial({ color: 0xc9a24b });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 64, 64), this.avatarMat);
    g.add(head);

    // face on the front (-Z): serene closed eyes + a subtle nose bump
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(0.085, 0.017, 12, 32, Math.PI), this.accentMat);
      const dir = new THREE.Vector3(side * Math.sin(0.34), 0.24, -Math.cos(0.34)).normalize();
      eye.position.copy(dir).multiplyScalar(0.795);
      eye.lookAt(dir.clone().multiplyScalar(2));
      g.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 24), this.avatarMat);
    nose.scale.set(0.85, 1.15, 1.1);
    nose.position.set(0, -0.05, -0.78);
    g.add(nose);

    // headband: half torus arching over the top, connecting the two cups (±X)
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.94, 0.05, 20, 72, Math.PI), this.phoneMat);
    g.add(band);

    // ear cups on both sides, cushion ring + gold cap accent
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.14, 40), this.phoneMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(side * 0.9, 0, 0);

      const cushion = new THREE.Mesh(
        new THREE.TorusGeometry(0.23, 0.055, 16, 40), this.phoneMat);
      cushion.rotation.y = Math.PI / 2;
      cushion.position.set(side * 0.82, 0, 0);

      const cap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 8, 40), this.accentMat);
      cap.rotation.y = Math.PI / 2;
      cap.position.set(side * 0.975, 0, 0);

      g.add(cup, cushion, cap);
    }

    // slim mic boom from the left cup toward the front (-Z) - makes facing readable
    const micFrom = new THREE.Vector3(-0.9, -0.22, -0.08);
    const micTo = new THREE.Vector3(-0.42, -0.66, -0.6);
    const micDir = micTo.clone().sub(micFrom);
    const boom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, micDir.length(), 12), this.phoneMat);
    boom.position.copy(micFrom).addScaledVector(micDir, 0.5);
    boom.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), micDir.clone().normalize());
    const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), this.accentMat);
    micTip.position.copy(micTo);
    g.add(boom, micTip);

    // pedestal ring
    this.pedestalMat = new THREE.MeshBasicMaterial({
      color: 0xc9a24b, transparent: true, opacity: 0.5,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.012, 8, 96), this.pedestalMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.5;
    g.add(ring);

    this.avatar = g;
    this.scene.add(g);
  }

  _buildGlobe() {
    const group = new THREE.Group();

    // constellation points on a fibonacci sphere
    const pos = new Float32Array(POINT_COUNT * 3);
    const col = new Float32Array(POINT_COUNT * 3);
    this.pointDirs = [];
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < POINT_COUNT; i++) {
      const y = 1 - (i / (POINT_COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = phi * i;
      const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      this.pointDirs.push(d);
      pos[i * 3] = d.x * GLOBE_R;
      pos[i * 3 + 1] = d.y * GLOBE_R;
      pos[i * 3 + 2] = d.z * GLOBE_R;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.pointColors = geo.attributes.color;
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.055, vertexColors: true, transparent: true, opacity: 0.95,
      sizeAttenuation: true, depthWrite: false,
    }));
    group.add(this.points);

    // meridian and latitude guide lines
    this.lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.15, color: 0xe9e6dd });
    const circleGeo = (radius) => {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      return new THREE.BufferGeometry().setFromPoints(pts);
    };
    const equator = new THREE.Line(circleGeo(GLOBE_R), this.lineMat);
    const latHi = new THREE.Line(circleGeo(GLOBE_R * Math.cos(0.62)), this.lineMat);
    latHi.position.y = GLOBE_R * Math.sin(0.62);
    const latLo = latHi.clone();
    latLo.position.y = -GLOBE_R * Math.sin(0.62);
    const mer1 = new THREE.Line(circleGeo(GLOBE_R), this.lineMat);
    mer1.rotation.x = Math.PI / 2;
    const mer2 = mer1.clone();
    mer2.rotation.y = Math.PI / 2;
    group.add(equator, latHi, latLo, mer1, mer2);

    this.globe = group;
    this.scene.add(group);
  }

  _buildOrb() {
    this.orbMat = new THREE.MeshBasicMaterial({ color: 0xe6c476 });
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 32), this.orbMat);
    this.scene.add(this.orb);

    // soft glow sprite
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,225,150,0.85)");
    grad.addColorStop(0.35, "rgba(230,196,118,0.28)");
    grad.addColorStop(1, "rgba(230,196,118,0)");
    c.fillStyle = grad;
    c.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    this.glowMat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.setScalar(1.5);
    this.scene.add(this.glow);

    // trail
    this.trailLen = 110;
    this.trailPts = [];
    const tp = new Float32Array(this.trailLen * 3);
    const tc = new Float32Array(this.trailLen * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(tp, 3));
    tg.setAttribute("color", new THREE.BufferAttribute(tc, 3));
    this.trailGeo = tg;
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false,
    }));
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);

    // invisible handle for manual dragging
    this.handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.scene.add(this.handle);
  }

  _buildPathLine() {
    this.pathGeo = new THREE.BufferGeometry();
    this.pathGeo.setAttribute("position",
      new THREE.BufferAttribute(new Float32Array(257 * 3), 3));
    this.pathMat = new THREE.LineBasicMaterial({
      color: 0xc9a24b, transparent: true, opacity: 0.3,
    });
    this.pathLine = new THREE.Line(this.pathGeo, this.pathMat);
    this.pathLine.frustumCulled = false;
    this.scene.add(this.pathLine);
  }

  /* ---------- theme ---------- */
  setTheme(t) {
    // t: { gold, goldBright, ink, avatar, lines, pointBase, bgFade: THREE-compatible hex numbers }
    this.theme = t;
    this.avatarMat.color.setHex(t.avatar);
    this.avatarMat.metalness = t.metalness;
    this.avatarMat.roughness = t.roughness;
    this.phoneMat.color.setHex(t.phones);
    this.accentMat.color.setHex(t.gold);
    this.lineMat.color.setHex(t.lines);
    this.lineMat.opacity = t.lineOpacity;
    this.pathMat.color.setHex(t.gold);
    this.orbMat.color.setHex(t.goldBright);
    this.pedestalMat.color.setHex(t.gold);
    this.orbLight.color.setHex(t.gold);
    this.rim.color.setHex(t.gold);
    this.hemi.intensity = t.hemi;
    this.key.intensity = t.key;
    this._baseCol = new THREE.Color(t.pointBase);
    this._goldCol = new THREE.Color(t.goldBright);
    this._fadeCol = new THREE.Color(t.bgFade);
  }

  /* ---------- path preview ---------- */
  setPathPreview(pathFn, radius, elevation, visible) {
    this.pathLine.visible = visible;
    if (!visible || !pathFn) return;
    const attr = this.pathGeo.attributes.position;
    const ey = elevation * radius * 0.7;
    for (let i = 0; i <= 256; i++) {
      const p = pathFn((i / 256) * Math.PI * 2 * 4, radius, ey); // 4 cycles for drift-style paths
      const v = this._toVis(p);
      attr.setXYZ(i, v.x, v.y, v.z);
    }
    attr.needsUpdate = true;
    this.pathGeo.computeBoundingSphere();
  }

  _toVis(p) {
    const len = Math.hypot(p.x, p.y, p.z) || 0.0001;
    const d = visDist(len) / len;
    return new THREE.Vector3(p.x * d, p.y * d, p.z * d);
  }

  setMode(mode) {
    this.mode = mode;
    this.canvas.style.cursor = mode === "manual" ? "grab" : "";
  }

  /* ---------- per-frame ---------- */
  update(dt, audioPos, level) {
    const v = this._toVis(audioPos);
    this.orb.position.copy(v);
    this.glow.position.copy(v);
    this.handle.position.copy(v);
    this.orbLight.position.copy(v);

    const pulse = 1 + level * 1.6;
    this.orb.scale.setScalar(pulse * (this.dragging ? 1.25 : 1));
    this.glow.scale.setScalar(1.4 * pulse);
    this.orbLight.intensity = (this.theme ? this.theme.orbLight : 1.4) * (0.5 + level * 2.2);

    // trail
    this.trailPts.push(v.clone());
    if (this.trailPts.length > this.trailLen) this.trailPts.shift();
    const tp = this.trailGeo.attributes.position;
    const tc = this.trailGeo.attributes.color;
    const n = this.trailPts.length;
    const gold = this._goldCol || new THREE.Color(0xe6c476);
    const fade = this._fadeCol || new THREE.Color(0x0b0d12);
    const tmp = new THREE.Color();
    for (let i = 0; i < this.trailLen; i++) {
      const src = this.trailPts[Math.max(0, n - this.trailLen + i)] || this.trailPts[0] || v;
      tp.setXYZ(i, src.x, src.y, src.z);
      const a = Math.pow(i / this.trailLen, 1.6);
      tmp.copy(fade).lerp(gold, a * (0.55 + level * 0.45));
      tc.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    tp.needsUpdate = true;
    tc.needsUpdate = true;

    // constellation glow toward the source direction
    const dir = v.clone().normalize();
    const base = this._baseCol || new THREE.Color(0x3a3f52);
    const cols = this.pointColors;
    for (let i = 0; i < POINT_COUNT; i++) {
      const d = Math.max(0, this.pointDirs[i].dot(dir));
      const glow = Math.pow(d, 7) * (0.45 + level * 1.1);
      tmp.copy(base).lerp(gold, Math.min(1, glow));
      cols.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    cols.needsUpdate = true;

    // the listener sphere breathes gently with the music
    this.avatar.scale.setScalar(1 + level * 0.05);

    // slow idle breathing of the globe
    this.globe.rotation.y += dt * 0.02;

    this.controls.autoRotate = !this.dragging && this.mode !== "manual";
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /* ---------- pointer: drag the orb in manual mode ---------- */
  _bindPointer() {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const toNdc = (e) => {
      const r = this.canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.mode !== "manual") return;
      toNdc(e);
      ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObject(this.handle, false);
      if (hit.length) {
        this.dragging = true;
        this.controls.enabled = false;
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor = "grabbing";
      }
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      toNdc(e);
      ray.setFromCamera(ndc, this.camera);
      // intersect the ray with a sphere (radius = orb's current distance) around the head
      const R = this.orb.position.length() || 2.4;
      const o = ray.ray.origin, d = ray.ray.direction;
      const b = o.dot(d);
      const c = o.lengthSq() - R * R;
      const disc = b * b - c;
      let point;
      if (disc >= 0) {
        const t = -b + Math.sqrt(disc); // far intersection = the side facing the camera ray direction
        const t2 = -b - Math.sqrt(disc);
        const tPick = t2 > 0 ? t2 : t;
        point = o.clone().addScaledVector(d, tPick);
      } else {
        point = o.clone().addScaledVector(d, -b); // closest approach
      }
      const dir = point.normalize();
      this.onManualDrag(dir);
    });

    const end = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.controls.enabled = true;
      this.canvas.style.cursor = this.mode === "manual" ? "grab" : "";
      try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", end);
  }

  _resize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
