// Heightmap murni (tanpa dependensi Three.js) -> bisa dipakai terrain, physics, vegetasi, dan diuji di Node.

export const WORLD_SIZE = 400;
export const ISLAND_RADIUS = 170;
export const WATER_LEVEL = 0;
export const SPAWN = { x: 0, z: 30 };
export const MAX_WALK_DEPTH = -1.0; // titik terendah yang boleh dimasuki pemain (wading)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// ---------- gradient noise 2D ----------
const perm = new Uint8Array(512);
(function initPerm() {
  const r = mulberry32(1337);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const dotG = (h, x, y) => { const g = GRAD[h & 7]; return g[0] * x + g[1] * y; };

export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
  const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
  const u = fade(xf), v = fade(yf);
  const x1 = dotG(aa, xf, yf) * (1 - u) + dotG(ba, xf - 1, yf) * u;
  const x2 = dotG(ab, xf, yf - 1) * (1 - u) + dotG(bb, xf - 1, yf - 1) * u;
  return (x1 * (1 - v) + x2 * v) * 1.4; // kira-kira -1..1
}

export function fbm(x, y, oct = 4) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise2(x * freq, y * freq) * amp;
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

// ---------- tinggi dunia ----------
export function heightAt(x, z) {
  const d = Math.hypot(x, z) / ISLAND_RADIUS;
  const e = fbm(x * 0.012 + 10, z * 0.012 + 10, 4);
  const mask = 1 - smoothstep(0.42, 0.95, d + e * 0.14);
  let h = lerp(-9, 5.5 + e * 4.0 + fbm(x * 0.04, z * 0.04, 2) * 1.5, mask);

  // pegunungan di utara (z negatif)
  const ridge = 1 - Math.abs(fbm(x * 0.014 + 50, z * 0.014 + 50, 4));
  const mz = smoothstep(-30, -105, z) * mask * mask;
  h += Math.pow(Math.max(ridge, 0), 2.2) * 46 * mz;

  // area spawn yang landai
  const t = 1 - smoothstep(9, 26, Math.hypot(x - SPAWN.x, z - SPAWN.z));
  h = lerp(h, 3.2, t);
  return h;
}

export function slopeAt(x, z) {
  const e = 1.0;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

export function regionAt(x, z) {
  const h = heightAt(x, z);
  if (z < -60 && h > 24) return 'Frozen Mountain';
  return 'Mysteria Island';
}
