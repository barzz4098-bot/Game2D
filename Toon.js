import * as THREE from 'three';

// Material toon bergaya anime: 4 tingkat bayangan + outline hull.
let grad = null;
export function toonGradient() {
  if (!grad) {
    const d = new Uint8Array([
      120, 120, 120, 255,
      170, 170, 170, 255,
      220, 220, 220, 255,
      255, 255, 255, 255,
    ]);
    grad = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
    grad.minFilter = THREE.NearestFilter;
    grad.magFilter = THREE.NearestFilter;
    grad.generateMipmaps = false;
    grad.needsUpdate = true;
  }
  return grad;
}

const cache = new Map();
export function toonMat(color, extra) {
  const key = (typeof color === 'number' ? color.toString(16) : String(color)) + (extra ? JSON.stringify(extra) : '');
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...(extra || {}) });
    cache.set(key, m);
  }
  return m;
}

let outline = null;
export function outlineMat() {
  if (!outline) outline = new THREE.MeshBasicMaterial({ color: 0x1b1326, side: THREE.BackSide });
  return outline;
}
