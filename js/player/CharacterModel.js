import * as THREE from 'three';
import { toonMat, outlineMat } from '../systems/Toon.js';
import { sanitizeAppearance } from './CharacterData.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const shade = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();

function mk(geo, mat, { outline = true, cast = true, thick = 1.07 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  if (outline) {
    const o = new THREE.Mesh(geo, outlineMat());
    o.scale.setScalar(thick); o.castShadow = false;
    m.add(o);
  }
  return m;
}
const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

// Pose serangan: A = ancang-ancang, B = puncak serangan
const ATK = [
  { A: { x: -2.5, z: 0.2, yaw: -0.5, lean: -0.05 }, B: { x: 0.35, z: 0.0, yaw: 0.6, lean: 0.18 } },
  { A: { x: -1.2, z: 1.35, yaw: 0.7, lean: 0.0 }, B: { x: -1.0, z: -0.55, yaw: -0.7, lean: 0.1 } },
  { A: { x: -0.9, z: 0.1, yaw: -0.2, lean: -0.1 }, B: { x: -1.55, z: 0.0, yaw: 0.25, lean: 0.28 } },
];

export class CharacterModel {
  constructor(appearance) {
    this.group = new THREE.Group();
    this.t = 0; this.phase = 0;
    this.attackT = -1; this.attackDur = 0.5; this.attackVariant = 0;
    this.castT = -1; this.castDur = 0.7; this.castBig = false;
    this.pose = { legL: 0, legR: 0, armL: 0.06, armR: 0.08, armLz: -0.08, armRz: 0.08, lean: 0, twist: 0, headX: 0, headY: 0, bob: 0, sy: 1 };
    this.swayers = [];
    this.build(appearance);
  }

  get isAttacking() { return this.attackT >= 0; }
  get attackActive() { if (this.attackT < 0) return false; const p = this.attackT / this.attackDur; return p >= 0.28 && p <= 0.5; }
  get isCasting() { return this.castT >= 0; }

  startAttack(variant) { this.attackVariant = variant % ATK.length; this.attackT = 0; this.castT = -1; }
  playCast(big = false) { this.castBig = big; this.castDur = big ? 1.1 : 0.7; this.castT = 0; this.attackT = -1; }
  setBlobShadow(v) { this.blob.visible = v; }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }

  build(appearance) {
    // bersihkan model lama
    while (this.group.children.length) {
      const c = this.group.children[0];
      c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this.group.remove(c);
    }
    this.swayers = [];
    const app = this.appearance = sanitizeAppearance(appearance);
    const female = app.gender === 'female';
    const S = { shoulder: female ? 0.215 : 0.245, torsoR: female ? 0.145 : 0.165, legX: female ? 0.105 : 0.095, scale: female ? 0.96 : 1.0 };
    const R = 0.26; // radius kepala

    const skin = toonMat(app.skin);
    const hairMat = toonMat(app.hairColor, { side: THREE.DoubleSide });
    const hairSolid = toonMat(app.hairColor);
    const base = toonMat(app.outfitColor);
    const dark = toonMat(shade(app.outfitColor, 0.55));
    const light = toonMat(shade(app.outfitColor, 1.25));
    const gold = toonMat(0xf1d27a);
    const silver = toonMat(0xc3cbd9);
    const white = toonMat(0xf4f4f8);
    const brown = toonMat(0x5a4030);
    const o = app.outfit;

    const root = new THREE.Group(); root.scale.setScalar(S.scale);
    this.group.add(root); this.root = root;

    // blob shadow (dipakai saat shadow map nonaktif)
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.04; this.blob.visible = false;
    this.group.add(this.blob);

    // ===== hips / spine =====
    this.hipsY = 0.78;
    const hips = this.hips = at(new THREE.Group(), 0, this.hipsY, 0); root.add(hips);
    const pantsMat = o === 0 ? brown : o === 2 ? toonMat(0x4a4f60) : o === 3 ? toonMat(0x2f3447) : dark;
    const pelvis = mk(new THREE.CylinderGeometry(S.torsoR * 1.06, S.torsoR * 1.0, 0.18, 14), pantsMat);
    pelvis.scale.x = female ? 1.12 : 1; hips.add(at(pelvis, 0, 0.0, 0));

    const spine = this.spine = at(new THREE.Group(), 0, 0.04, 0); hips.add(spine);
    const topMat = o === 2 ? toonMat(shade(app.outfitColor, 0.8)) : base;
    spine.add(at(mk(new THREE.CapsuleGeometry(S.torsoR * (o === 3 ? 1.12 : 1), 0.22, 6, 14), topMat), 0, 0.24, 0));
    spine.add(at(mk(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 8), skin, { outline: false }), 0, 0.54, 0));

    // ===== kaki =====
    const legSkin = o === 3;
    const legMat = legSkin ? skin : pantsMat;
    const makeLeg = (side) => {
      const piv = at(new THREE.Group(), side * S.legX, 0, 0);
      piv.add(at(mk(new THREE.CapsuleGeometry(0.075, 0.6, 6, 10), legMat), 0, -0.4, 0));
      const shoeMat = o === 0 ? toonMat(0x3b2a1e) : o === 2 ? toonMat(0x555b6e) : o === 3 ? white : dark;
      piv.add(at(mk(new THREE.BoxGeometry(0.13, 0.07, 0.23), shoeMat, { thick: 1.12 }), 0, -0.745, 0.045));
      if (o === 0) piv.add(at(mk(new THREE.CylinderGeometry(0.088, 0.078, 0.22, 10), toonMat(0x3b2a1e), { thick: 1.06 }), 0, -0.64, 0));
      if (o === 2) piv.add(at(mk(new THREE.CylinderGeometry(0.092, 0.08, 0.34, 10), silver, { thick: 1.06 }), 0, -0.55, 0));
      if (o === 3) {
        if (female) piv.add(at(mk(new THREE.CylinderGeometry(0.083, 0.078, 0.34, 10), white, { thick: 1.05 }), 0, -0.55, 0));
        else piv.add(at(mk(new THREE.CylinderGeometry(0.098, 0.1, 0.28, 10), pantsMat, { thick: 1.05 }), 0, -0.17, 0));
      }
      hips.add(piv);
      return piv;
    };
    this.legL = makeLeg(-1); this.legR = makeLeg(1);

    // ===== lengan =====
    const makeArm = (side) => {
      const piv = at(new THREE.Group(), side * S.shoulder, 0.44, 0);
      piv.add(at(mk(new THREE.CapsuleGeometry(0.05, 0.3, 6, 10), skin), 0, -0.22, 0));
      piv.add(at(mk(new THREE.SphereGeometry(0.056, 10, 8), skin, { outline: false }), 0, -0.45, 0));
      if (o === 0) piv.add(at(mk(new THREE.CapsuleGeometry(0.058, 0.1, 6, 10), base, { thick: 1.06 }), 0, -0.1, 0));
      if (o === 1) piv.add(at(mk(new THREE.CapsuleGeometry(0.078, 0.2, 6, 10), base, { thick: 1.05 }), 0, -0.2, 0));
      if (o === 2) {
        piv.add(at(mk(new THREE.SphereGeometry(0.105, 12, 10), silver, { thick: 1.06 }), side * 0.02, 0.01, 0));
        piv.add(at(mk(new THREE.CylinderGeometry(0.066, 0.058, 0.2, 10), silver, { thick: 1.06 }), 0, -0.3, 0));
      }
      if (o === 3) piv.add(at(mk(new THREE.CapsuleGeometry(0.06, 0.24, 6, 10), base, { thick: 1.06 }), 0, -0.19, 0));
      spine.add(piv);
      return piv;
    };
    this.armL = makeArm(-1); this.armR = makeArm(1);

    // pedang latihan di tangan kanan
    const sword = this.sword = new THREE.Group();
    sword.position.set(0, -0.45, 0); sword.rotation.x = 1.15;
    sword.add(at(mk(new THREE.CapsuleGeometry(0.02, 0.1, 4, 8), toonMat(0x3b2a1e), { outline: false }), 0, 0.0, 0));
    sword.add(at(mk(new THREE.BoxGeometry(0.15, 0.025, 0.035), gold, { outline: false }), 0, 0.09, 0));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.6, 0.014), toonMat(0xdfe8f5, { emissive: 0x28323f }));
    blade.position.y = 0.42; blade.castShadow = true; sword.add(blade);
    sword.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.0225, 0.07, 4), toonMat(0xdfe8f5, { emissive: 0x28323f })), 0, 0.765, 0));
    this.armR.add(sword);

    // ===== outfit torso =====
    if (o === 0) {
      spine.add(at(mk(new THREE.CylinderGeometry(S.torsoR * 1.05, S.torsoR * 1.55, 0.34, 14), base), 0, 0.02, 0));
      spine.add(at(mk(new THREE.CylinderGeometry(S.torsoR * 1.1, S.torsoR * 1.1, 0.05, 14), toonMat(0x3b2a1e), { thick: 1.05 }), 0, 0.06, 0));
      spine.add(at(mk(new THREE.BoxGeometry(0.06, 0.06, 0.02), gold, { outline: false }), 0, 0.06, S.torsoR * 1.12));
      const scarf = at(mk(new THREE.TorusGeometry(0.15, 0.035, 8, 16), light, { thick: 1.1 }), 0, 0.5, 0); scarf.rotation.x = Math.PI / 2; spine.add(scarf);
      const tail = at(new THREE.Group(), 0, 0.5, -0.14); tail.add(at(mk(new THREE.BoxGeometry(0.09, 0.32, 0.02), light, { thick: 1.1 }), 0, -0.16, 0));
      spine.add(tail); this.swayers.push({ node: tail, gain: 0.07, base: 0.1 });
    } else if (o === 1) {
      hips.add(at(mk(new THREE.CylinderGeometry(S.torsoR * 1.04, S.torsoR * 2.3, 0.78, 16), base), 0, -0.22, 0));
      hips.add(at(mk(new THREE.CylinderGeometry(S.torsoR * 2.3 + 0.005, S.torsoR * 2.3 + 0.005, 0.05, 16), gold, { outline: false }), 0, -0.59, 0));
      spine.add(at(mk(new THREE.CylinderGeometry(S.torsoR * 1.08, S.torsoR * 1.08, 0.06, 14), dark, { thick: 1.05 }), 0, 0.06, 0));
      const collar = at(mk(new THREE.TorusGeometry(0.12, 0.03, 8, 16), gold, { outline: false }), 0, 0.5, 0); collar.rotation.x = Math.PI / 2; spine.add(collar);
    } else if (o === 2) {
      const plate = mk(new THREE.SphereGeometry(1, 14, 10), silver, { thick: 1.06 });
      plate.scale.set(S.torsoR * 1.25, 0.2, S.torsoR * 1.15); spine.add(at(plate, 0, 0.3, 0.02));
      spine.add(at(mk(new THREE.BoxGeometry(0.26, 0.42, 0.03), base, { thick: 1.08 }), 0, -0.05, S.torsoR * 1.05));
      spine.add(at(mk(new THREE.CylinderGeometry(S.torsoR * 1.1, S.torsoR * 1.1, 0.06, 14), dark, { thick: 1.05 }), 0, 0.06, 0));
      const cape = at(new THREE.Group(), 0, 0.46, -0.17);
      cape.add(at(mk(new THREE.BoxGeometry(0.38, 0.7, 0.025), base, { thick: 1.06 }), 0, -0.35, 0));
      spine.add(cape); this.swayers.push({ node: cape, gain: 0.07, base: 0.08 });
    } else {
      spine.add(at(mk(new THREE.BoxGeometry(0.17, 0.4, 0.03), white, { thick: 1.06 }), 0, 0.24, S.torsoR * 1.1));
      const col = at(mk(new THREE.TorusGeometry(0.115, 0.03, 8, 16), base, { thick: 1.08 }), 0, 0.5, 0); col.rotation.x = Math.PI / 2; spine.add(col);
      if (female) hips.add(at(mk(new THREE.CylinderGeometry(0.17, 0.28, 0.22, 14), pantsMat), 0, -0.1, 0));
    }

    // ===== kepala =====
    const head = this.head = at(new THREE.Group(), 0, 0.5, 0); spine.add(head);
    const skull = mk(new THREE.SphereGeometry(R, 24, 18), skin); skull.scale.set(1, 0.97, 0.98);
    head.add(at(skull, 0, 0.2, 0));
    const face = at(new THREE.Group(), 0, 0.2, 0); head.add(face);

    const eyeCol = toonMat(app.eyeColor), eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff }), pupilM = new THREE.MeshBasicMaterial({ color: 0x1a1224 });
    const blob = (g, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(g, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; };
    const unit = new THREE.SphereGeometry(1, 10, 8);
    for (const side of [-1, 1]) {
      const ex = side * 0.1, ey = -0.005;
      const ez = Math.sqrt(R * R - ex * ex - ey * ey) - 0.012;
      const eye = new THREE.Group(); eye.position.set(ex, ey, ez); eye.rotation.y = side * Math.asin(ex / R);
      eye.add(blob(unit, eyeW, 0.058, 0.082, 0.03, 0, 0, 0));
      eye.add(blob(unit, eyeCol, 0.046, 0.07, 0.03, 0, -0.004, 0.012));
      eye.add(blob(unit, pupilM, 0.021, 0.04, 0.03, 0, -0.004, 0.02));
      eye.add(blob(unit, eyeW, 0.013, 0.013, 0.03, 0.014, 0.022, 0.027));
      face.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.014, 0.012), hairSolid);
      const bz = Math.sqrt(R * R - ex * ex - 0.115 * 0.115) + 0.002;
      brow.position.set(ex, 0.115, bz); brow.rotation.y = side * Math.asin(ex / R); brow.rotation.z = side * 0.12; face.add(brow);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0x8a3b4a }));
    mouth.position.set(0, -0.115, Math.sqrt(R * R - 0.115 * 0.115) + 0.001); face.add(mouth);

    // rambut: helm + poni + gaya
    const helm = mk(new THREE.SphereGeometry(0.285, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat, { thick: 1.05 });
    head.add(at(helm, 0, 0.225, -0.045));
    for (let i = 0; i < 5; i++) {
      const bx = (i - 2) * 0.075, by = 0.34;
      const bz = Math.sqrt(Math.max(R * R - (by - 0.2) * (by - 0.2) - bx * bx, 0.001)) + 0.012;
      const bang = mk(new THREE.ConeGeometry(0.06, 0.16, 6), hairSolid, { thick: 1.1 });
      bang.rotation.x = Math.PI; bang.rotation.z = -(i - 2) * 0.12; bang.rotation.y = (i - 2) * 0.2;
      head.add(at(bang, bx, by - 0.02, bz));
    }
    const style = app.hair;
    const sway = (node, gain, baseRot = 0) => { head.add(node); this.swayers.push({ node, gain, base: baseRot }); };
    if (style === 1) {
      const p = at(new THREE.Group(), 0, 0.28, -0.2);
      p.add(at(mk(new THREE.CylinderGeometry(0.2, 0.12, 0.78, 12), hairSolid, { thick: 1.05 }), 0, -0.38, 0));
      sway(p, 0.3, 0.05);
      for (const s of [-1, 1]) head.add(at(mk(new THREE.CapsuleGeometry(0.045, 0.28, 4, 8), hairSolid, { thick: 1.1 }), s * 0.245, 0.1, 0.05));
    } else if (style === 2) {
      const p = at(new THREE.Group(), 0, 0.34, -0.25);
      const tail = mk(new THREE.CapsuleGeometry(0.065, 0.5, 6, 10), hairSolid, { thick: 1.08 });
      p.add(at(tail, 0, -0.32, -0.04)); p.add(at(mk(new THREE.TorusGeometry(0.07, 0.02, 6, 12), toonMat(0xe8505a), { outline: false }), 0, -0.02, 0));
      sway(p, 0.45, 0.25);
    } else if (style === 3) {
      for (const s of [-1, 1]) {
        const p = at(new THREE.Group(), s * 0.27, 0.32, -0.04); p.rotation.z = -s * 0.18;
        p.add(at(mk(new THREE.CapsuleGeometry(0.075, 0.5, 6, 10), hairSolid, { thick: 1.07 }), 0, -0.34, 0));
        p.add(at(mk(new THREE.SphereGeometry(0.06, 8, 6), toonMat(0xe8505a), { outline: false }), 0, -0.02, 0));
        sway(p, 0.35, 0.05);
      }
    } else if (style === 4) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sp = mk(new THREE.ConeGeometry(0.09, 0.32, 6), hairSolid, { thick: 1.08 });
        sp.position.set(Math.sin(a) * 0.17, 0.43, Math.cos(a) * 0.17 - 0.05);
        sp.rotation.z = -Math.sin(a) * 0.7; sp.rotation.x = Math.cos(a) * 0.7;
        head.add(sp);
      }
    }
    if (o === 1) { // topi penyihir
      head.add(at(mk(new THREE.CylinderGeometry(0.37, 0.37, 0.03, 20), dark, { thick: 1.04 }), 0, 0.4, 0));
      const cone = mk(new THREE.ConeGeometry(0.26, 0.5, 14), base, { thick: 1.05 });
      cone.rotation.x = -0.12; head.add(at(cone, 0, 0.66, -0.03));
      head.add(at(mk(new THREE.CylinderGeometry(0.265, 0.27, 0.06, 16), gold, { outline: false }), 0, 0.45, 0));
    }

    // cincin cast + slash
    this.castRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 28), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.castRing.position.set(0, 1.15, 0.55); this.castRing.visible = false; root.add(this.castRing);
    this.slash = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.3, 28, 1, 0, 2.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.slash.visible = false; root.add(this.slash);
  }

  // s = { speed, grounded, vy }
  update(dt, s) {
    this.t += dt;
    const P = this.pose;
    const sp = clamp(s.speed, 0, 9);
    const moving = sp > 0.3 && s.grounded;
    if (moving) this.phase += dt * (5.5 + sp * 1.05);
    const amp = clamp(0.22 + sp * 0.095, 0, 1.05);

    const T = { legL: 0, legR: 0, armL: 0.06, armR: 0.08, armLz: -0.08, armRz: 0.08, lean: 0, twist: 0, headX: 0, headY: 0, bob: 0, sy: 1 };
    let k = 16;
    if (!s.grounded) {
      k = 10;
      T.legL = 0.65; T.legR = -0.3; T.armL = s.vy > 0 ? -0.9 : -0.4; T.armR = s.vy > 0 ? -0.8 : -0.3;
      T.armLz = -0.75; T.armRz = 0.75; T.lean = 0.05;
    } else if (moving) {
      const sn = Math.sin(this.phase);
      T.legL = sn * amp; T.legR = -sn * amp;
      T.armL = -sn * amp * 0.85; T.armR = sn * amp * 0.55;
      T.lean = 0.04 + sp * 0.014; T.twist = sn * 0.08 * amp; T.headY = -T.twist * 0.6;
      T.bob = Math.abs(Math.cos(this.phase)) * 0.035 * (sp / 8);
    } else {
      T.bob = Math.sin(this.t * 2) * 0.006; T.sy = 1 + Math.sin(this.t * 2) * 0.012;
      T.armL = 0.06 + Math.sin(this.t * 1.6) * 0.03; T.headX = Math.sin(this.t * 1.3) * 0.02;
    }

    // cast
    if (this.castT >= 0) {
      this.castT += dt;
      if (this.castT >= this.castDur) this.castT = -1;
      else {
        const p = this.castT / this.castDur, e = easeOut(Math.min(p * 3, 1)) * (1 - easeInOut((p - 0.8) / 0.2));
        const raise = this.castBig ? -2.7 : -1.45;
        T.armL = lerp(T.armL, raise, e); T.armR = lerp(T.armR, raise, e);
        T.armLz = lerp(T.armLz, -0.15, e); T.armRz = lerp(T.armRz, 0.15, e);
        T.headX = lerp(T.headX, this.castBig ? -0.2 : 0, e);
        k = 22;
      }
    }
    this.castRing.visible = this.castT >= 0;
    if (this.castRing.visible) {
      const p = this.castT / this.castDur;
      this.castRing.position.y = this.castBig ? 1.9 : 1.15;
      this.castRing.scale.setScalar(0.6 + p * 1.2); this.castRing.rotation.z += dt * 6;
      this.castRing.material.opacity = 0.85 * (1 - p);
    }

    // serangan
    this.slash.visible = false;
    if (this.attackT >= 0) {
      this.attackT += dt;
      if (this.attackT >= this.attackDur) this.attackT = -1;
      else {
        const p = this.attackT / this.attackDur, a = ATK[this.attackVariant];
        let x, z, yaw, lean;
        if (p < 0.28) { const e = easeInOut(p / 0.28); x = lerp(T.armR, a.A.x, e); z = lerp(T.armRz, a.A.z, e); yaw = lerp(T.twist, a.A.yaw, e); lean = lerp(T.lean, a.A.lean, e); }
        else if (p < 0.5) { const e = easeOut((p - 0.28) / 0.22); x = lerp(a.A.x, a.B.x, e); z = lerp(a.A.z, a.B.z, e); yaw = lerp(a.A.yaw, a.B.yaw, e); lean = lerp(a.A.lean, a.B.lean, e); }
        else { const e = easeInOut((p - 0.5) / 0.5); x = lerp(a.B.x, T.armR, e); z = lerp(a.B.z, T.armRz, e); yaw = lerp(a.B.yaw, T.twist, e); lean = lerp(a.B.lean, T.lean, e); }
        T.armR = x; T.armRz = z; T.twist = yaw; T.lean = lean; T.headY = -yaw * 0.5;
        if (p >= 0.28 && p <= 0.5) { T.legL = -0.4; T.legR = 0.3; }
        k = 45;
        if (p >= 0.28 && p <= 0.62) {
          const u = (p - 0.28) / 0.34;
          this.slash.visible = true;
          this.slash.material.opacity = 0.85 * (1 - u);
          this.slash.scale.setScalar(0.9 + u * 0.35);
          if (this.attackVariant === 0) { this.slash.position.set(0, 1.15, 0.8); this.slash.rotation.set(0, Math.PI / 2, 0.9); }
          else if (this.attackVariant === 1) { this.slash.position.set(0, 1.0, 0.9); this.slash.rotation.set(-Math.PI / 2 + 0.2, 0, 2.3); }
          else { this.slash.position.set(0, 1.1, 1.0); this.slash.rotation.set(0, Math.PI / 2, 2.6); }
        }
      }
    }

    for (const key in T) P[key] = damp(P[key], T[key], k, dt);

    this.legL.rotation.x = P.legL; this.legR.rotation.x = P.legR;
    this.armL.rotation.set(P.armL, 0, P.armLz); this.armR.rotation.set(P.armR, 0, P.armRz);
    this.spine.rotation.set(P.lean, P.twist, 0); this.spine.scale.set(1, P.sy, 1);
    this.head.rotation.set(P.headX, P.headY, 0);
    this.hips.position.y = this.hipsY + P.bob;

    const run = clamp(sp / 8, 0, 1.2);
    for (const sw of this.swayers) sw.node.rotation.x = sw.base + run * sw.gain * 5 + Math.sin(this.t * 2.2) * 0.03;
  }
}
