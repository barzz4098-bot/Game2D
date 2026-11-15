import * as THREE from 'three';
import { heightAt, slopeAt, fbm, smoothstep, mulberry32, SPAWN, WORLD_SIZE } from './Heightmap.js';
import { toonMat } from '../systems/Toon.js';
import { timeUniform } from './Shared.js';

const HALF = WORLD_SIZE / 2 - 8;

// ---------- geometri rumput ----------
function grassGeometry() {
  const pos = [], col = [], nor = [], idx = [];
  const base = new THREE.Color(0x2c7a2a), tip = new THREE.Color(0xb4e868), c = new THREE.Color();
  const blades = 3;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI;
    const ca = Math.cos(a), sa = Math.sin(a);
    const v = [[-0.07, 0, 0], [0.07, 0, 0], [-0.045, 0.3, 0.03], [0.045, 0.3, 0.03], [0, 0.62, 0.09]];
    const o = pos.length / 3;
    for (const [x, y, z] of v) {
      pos.push(x * ca + z * sa, y, -x * sa + z * ca);
      c.copy(base).lerp(tip, y / 0.62);
      col.push(c.r, c.g, c.b);
      nor.push(0, 1, 0);
    }
    // dua sisi (CCW dan CW) agar terlihat dari kedua arah dengan pencahayaan konsisten
    const tris = [[0, 1, 3], [0, 3, 2], [2, 3, 4]];
    for (const [i, j, k] of tris) { idx.push(o + i, o + j, o + k); idx.push(o + i, o + k, o + j); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function makeGrassMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      #ifdef USE_INSTANCING
        float wph = uTime * 1.6 + instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.35;
      #else
        float wph = uTime * 1.6;
      #endif
      transformed.x += sin(wph) * 0.2 * position.y * position.y;
      transformed.z += cos(wph * 0.8) * 0.1 * position.y;
    `);
  };
  return m;
}

export function buildVegetation(quality, physics) {
  const group = new THREE.Group();
  const rand = mulberry32(90210);
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(),
    _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);

  // ===== Pohon =====
  const trees = [];
  const occ = new Map();
  const okSpacing = (x, z, minD) => {
    const cx = Math.floor(x / 4), cz = Math.floor(z / 4);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const arr = occ.get((cx + i) * 1000 + (cz + j));
      if (!arr) continue;
      for (const o of arr) if (Math.hypot(o[0] - x, o[1] - z) < minD) return false;
    }
    return true;
  };
  const mark = (x, z) => {
    const k = Math.floor(x / 4) * 1000 + Math.floor(z / 4);
    (occ.get(k) || occ.set(k, []).get(k)).push([x, z]);
  };

  for (let tries = 0; tries < quality.trees * 14 && trees.length < quality.trees; tries++) {
    const x = (rand() * 2 - 1) * HALF, z = (rand() * 2 - 1) * HALF;
    const h = heightAt(x, z);
    if (h < 1.9 || h > 21) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 15) continue;
    if (slopeAt(x, z) > 0.55) continue;
    const f = fbm(x * 0.018 + 200, z * 0.018 + 200, 3);
    if (rand() > smoothstep(-0.25, 0.25, f) * 0.92 + 0.08) continue;
    if (!okSpacing(x, z, 2.6)) continue;
    mark(x, z);
    const pine = h > 10 || (f > 0.25 && rand() < 0.45);
    trees.push({ x, y: h, z, s: 0.8 + rand() * 0.7, rot: rand() * Math.PI * 2, pine });
  }

  const partDefs = {
    trunk: { geo: new THREE.CylinderGeometry(0.18, 0.27, 2.2, 6), y: 1.1, color: 0x7a5232, vary: [0.04, 0.1, 0.1] },
    round1: { geo: new THREE.IcosahedronGeometry(1.7, 1), y: 3.2, sy: 0.9, color: 0x58b848, vary: [0.04, 0.1, 0.12], tint: 'leaf' },
    round2: { geo: new THREE.IcosahedronGeometry(1.15, 1), y: 4.4, ox: 0.3, oz: 0.2, color: 0x6cc858, tint: 'leaf' },
    pine1: { geo: new THREE.ConeGeometry(1.6, 3.0, 7), y: 2.9, color: 0x2f8a52, tint: 'pine' },
    pine2: { geo: new THREE.ConeGeometry(1.2, 2.5, 7), y: 4.6, color: 0x2f8a52, tint: 'pine' },
    pine3: { geo: new THREE.ConeGeometry(0.8, 2.0, 7), y: 6.1, color: 0x3a9a5c, tint: 'pine' },
  };
  const useParts = (t) => t.pine ? ['trunk', 'pine1', 'pine2', 'pine3'] : ['trunk', 'round1', 'round2'];
  const counts = {};
  for (const t of trees) for (const p of useParts(t)) counts[p] = (counts[p] || 0) + 1;
  const meshes = {};
  const cursor = {};
  for (const [name, def] of Object.entries(partDefs)) {
    if (!counts[name]) continue;
    const mesh = new THREE.InstancedMesh(def.geo, toonMat(0xffffff), counts[name]);
    mesh.castShadow = quality.shadows; mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    meshes[name] = mesh; cursor[name] = 0;
    group.add(mesh);
  }
  for (const t of trees) {
    _q.setFromAxisAngle(UP, t.rot);
    _p.set(t.x, t.y - 0.05, t.z);
    _s.setScalar(t.s);
    const hue = 0.27 + rand() * 0.06, light = 0.42 + rand() * 0.08;
    for (const name of useParts(t)) {
      const def = partDefs[name];
      _m.compose(_p, _q, _s);
      _l.makeScale(1, def.sy || 1, 1).setPosition(def.ox || 0, def.y, def.oz || 0);
      _m.multiply(_l);
      const i = cursor[name]++;
      meshes[name].setMatrixAt(i, _m);
      if (def.tint === 'leaf') _c.setHSL(hue, 0.55, light);
      else if (def.tint === 'pine') _c.setHSL(0.4 + rand() * 0.03, 0.45, 0.27 + rand() * 0.07);
      else _c.setHex(def.color).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
      meshes[name].setColorAt(i, _c);
    }
    physics.addCircle(t.x, t.z, 0.42 * t.s, t.y + 8 * t.s, 'tree');
  }
  for (const m of Object.values(meshes)) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }

  // ===== Batu =====
  const rocks = [];
  for (let tries = 0; tries < quality.rocks * 30 && rocks.length < quality.rocks; tries++) {
    const x = (rand() * 2 - 1) * HALF, z = (rand() * 2 - 1) * HALF;
    const h = heightAt(x, z);
    if (h < 0.4) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 12) continue;
    const sl = slopeAt(x, z);
    const p = h < 3 ? 0.35 : (sl > 0.4 || h > 14 ? 0.8 : 0.1);
    if (rand() > p) continue;
    rocks.push({ x, y: h, z, sx: 0.7 + rand() * 1.6, sy: 0.5 + rand() * 0.9, sz: 0.7 + rand() * 1.6 });
  }
  if (rocks.length) {
    const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), toonMat(0xffffff), rocks.length);
    rm.castShadow = quality.shadows; rm.receiveShadow = true; rm.frustumCulled = false;
    rocks.forEach((r, i) => {
      _e.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      _q.setFromEuler(_e);
      _p.set(r.x, r.y + r.sy * 0.25, r.z);
      _s.set(r.sx, r.sy, r.sz);
      _m.compose(_p, _q, _s);
      rm.setMatrixAt(i, _m);
      _c.setHSL(0.62, 0.06 + rand() * 0.05, 0.45 + rand() * 0.12);
      rm.setColorAt(i, _c);
      physics.addCircle(r.x, r.z, Math.max(r.sx, r.sz) * 0.85, r.y + r.sy * 0.8, 'rock');
    });
    rm.instanceMatrix.needsUpdate = true; rm.instanceColor.needsUpdate = true;
    group.add(rm);
  }

  // ===== Rumput (chunked agar frustum + distance culling efektif) =====
  const CH = 64;
  const chunks = new Map();
  const gGeo = grassGeometry();
  const gMat = makeGrassMaterial();
  const gList = [];
  const gBudget = quality.grass;
  for (let tries = 0; tries < gBudget * 3 && gList.length < gBudget; tries++) {
    const x = (rand() * 2 - 1) * HALF, z = (rand() * 2 - 1) * HALF;
    const h = heightAt(x, z);
    if (h < 1.7 || h > 15) continue;
    if (slopeAt(x, z) > 0.7) continue;
    const dens = smoothstep(-0.4, 0.3, fbm(x * 0.03 + 7, z * 0.03 + 7, 2)) * 0.8 + 0.2;
    if (rand() > dens) continue;
    gList.push([x, h, z]);
  }
  const buckets = new Map();
  for (const g of gList) {
    const k = Math.floor((g[0] + 300) / CH) * 100 + Math.floor((g[2] + 300) / CH);
    (buckets.get(k) || buckets.set(k, []).get(k)).push(g);
  }
  const grassChunks = [];
  for (const arr of buckets.values()) {
    const im = new THREE.InstancedMesh(gGeo, gMat, arr.length);
    arr.forEach((g, i) => {
      _q.setFromAxisAngle(UP, rand() * Math.PI * 2);
      _p.set(g[0], g[1] - 0.02, g[2]);
      const sc = 0.7 + rand() * 0.9;
      _s.set(sc, sc * (0.8 + rand() * 0.6), sc);
      _m.compose(_p, _q, _s);
      im.setMatrixAt(i, _m);
      _c.setHSL(0.27 + rand() * 0.07, 0.6, 0.85 + rand() * 0.3);
      im.setColorAt(i, _c);
    });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.receiveShadow = false;
    group.add(im);
    grassChunks.push({ mesh: im, center: im.boundingSphere.center.clone(), radius: im.boundingSphere.radius });
  }

  // ===== Bunga =====
  const nFlowers = Math.floor(quality.grass / 18);
  if (nFlowers > 0) {
    const fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 4), toonMat(0xffffff), nFlowers);
    const palette = [0xff6fa5, 0xffd24a, 0xffffff, 0x8fb6ff, 0xc58cff];
    let n = 0;
    for (let tries = 0; tries < nFlowers * 20 && n < nFlowers; tries++) {
      const x = (rand() * 2 - 1) * HALF, z = (rand() * 2 - 1) * HALF;
      const h = heightAt(x, z);
      if (h < 2 || h > 12 || slopeAt(x, z) > 0.5) continue;
      _p.set(x, h + 0.32, z); _q.identity(); _s.setScalar(0.8 + rand() * 0.6);
      _m.compose(_p, _q, _s);
      fm.setMatrixAt(n, _m);
      _c.setHex(palette[Math.floor(rand() * palette.length)]);
      fm.setColorAt(n, _c);
      n++;
    }
    fm.count = n;
    fm.instanceMatrix.needsUpdate = true; if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    fm.frustumCulled = false;
    group.add(fm);
  }

  const grassRange = quality.grassRange || 120;
  return {
    group,
    stats: { trees: trees.length, rocks: rocks.length, grass: gList.length },
    update(focus) {
      for (const c of grassChunks) {
        const d = Math.hypot(c.center.x - focus.x, c.center.z - focus.z) - c.radius;
        c.mesh.visible = d < grassRange;
      }
    },
  };
}
