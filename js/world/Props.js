import * as THREE from 'three';
import { heightAt, SPAWN } from './Heightmap.js';
import { toonMat, toonGradient } from '../systems/Toon.js';

function boxO(w, h, d, mat, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

function signTexture(lines) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const g = c.getContext('2d');
  g.fillStyle = '#b98a54'; g.fillRect(0, 0, 512, 288);
  g.strokeStyle = '#6b4a28'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 274);
  g.fillStyle = '#3a2412'; g.textAlign = 'center';
  g.font = 'bold 40px sans-serif'; g.fillText(lines[0], 256, 70);
  g.font = '26px sans-serif';
  lines.slice(1).forEach((l, i) => g.fillText(l, 256, 125 + i * 38));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildProps(physics) {
  const group = new THREE.Group();
  const interactables = [];
  const animated = [];

  // ===== Papan petunjuk (interaksi E) =====
  {
    const x = SPAWN.x + 6, z = SPAWN.z - 4, y = heightAt(x, z);
    const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = -0.5;
    const post = boxO(0.14, 1.9, 0.14, toonMat(0x6b4a28));
    post.position.y = 0.95; s.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.08), new THREE.MeshToonMaterial({ gradientMap: toonGradient(), map: signTexture(['MYSTERIA ISLAND', 'WASD: jalan   Shift: lari', 'Spasi: lompat   Klik kiri: serang', 'E: interaksi']) }));
    board.position.set(0, 1.55, 0.06); board.castShadow = true; s.add(board);
    group.add(s);
    physics.addCircle(x, z, 0.3, y + 2, 'sign');
    interactables.push({
      x, z, radius: 3.2, label: 'Baca papan',
      action: () => ({
        title: 'Papan Petunjuk',
        text: 'Selamat datang di Mysteria Island, petualang. Jelajahi pulau ini: pantai di selatan, hutan di tengah, dan pegunungan bersalju di utara. Konon ada altar kuno yang menyimpan kekuatan elemen... tapi kamu belum menemukannya.',
      }),
    });
  }

  // ===== Api unggun =====
  {
    const x = SPAWN.x - 5, z = SPAWN.z - 3, y = heightAt(x, z);
    const f = new THREE.Group(); f.position.set(x, y, z);
    const stone = toonMat(0x8d8a96);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stone);
      r.position.set(Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7); r.scale.set(1, 0.7, 1); r.castShadow = true;
      f.add(r);
    }
    const wood = toonMat(0x5b3a1e);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6), wood);
      l.rotation.z = Math.PI / 2; l.rotation.y = (i / 3) * Math.PI; l.position.y = 0.12; l.castShadow = true;
      f.add(l);
    }
    const flames = [];
    const fcols = [0xff6a1a, 0xffa31a, 0xffe45c];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.07, 0.8 - i * 0.12, 7), new THREE.MeshBasicMaterial({ color: fcols[i], transparent: true, opacity: 0.92 }));
      m.position.y = 0.45 + i * 0.05; f.add(m); flames.push(m);
    }
    group.add(f);
    physics.addCircle(x, z, 0.7, y + 1, 'campfire');
    animated.push((t) => {
      flames.forEach((m, i) => {
        const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.14;
        m.scale.set(1 - (k - 1) * 0.5, k, 1 - (k - 1) * 0.5);
        m.rotation.y = t * (1 + i);
      });
    });
  }

  return { group, interactables, update(t) { for (const a of animated) a(t); } };
}
