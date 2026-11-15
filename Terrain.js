import * as THREE from 'three';
import { heightAt, noise2, smoothstep, clamp, WORLD_SIZE } from './Heightmap.js';
import { toonGradient } from '../systems/Toon.js';

const C = {
  sand: new THREE.Color(0xf0e0a8),
  wetSand: new THREE.Color(0xc9b787),
  g1: new THREE.Color(0x7bd04e),
  g2: new THREE.Color(0x4ea83c),
  dry: new THREE.Color(0x9bb86a),
  rock: new THREE.Color(0x8d8a96),
  snow: new THREE.Color(0xf6faff),
  floorA: new THREE.Color(0x6aa3b5),
  floorB: new THREE.Color(0x1f4466),
};
const tmp = new THREE.Color();

function terrainColor(h, ny, x, z, out) {
  const n = noise2(x * 0.08, z * 0.08) * 0.5 + 0.5;
  if (h < -0.3) {
    out.copy(C.floorA).lerp(C.floorB, clamp((-h - 0.3) / 6, 0, 1));
    return out;
  }
  out.copy(C.g1).lerp(C.g2, n);
  tmp.copy(C.sand);
  if (h < 0.7) tmp.lerp(C.wetSand, 1 - smoothstep(-0.3, 0.7, h));
  out.lerpColors(tmp, out, smoothstep(1.2, 2.6, h));
  out.lerp(C.dry, smoothstep(8, 16, h) * 0.6);
  out.lerp(C.rock, smoothstep(15, 25, h));
  out.lerp(C.rock, smoothstep(0.2, 0.45, 1 - ny));
  out.lerp(C.snow, smoothstep(27, 33, h + n * 3) * smoothstep(0.55, 0.8, ny));
  return out;
}

export function buildTerrain(quality) {
  const seg = quality.terrainSeg;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    terrainColor(pos.getY(i), nor.getY(i), pos.getX(i), pos.getZ(i), c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
