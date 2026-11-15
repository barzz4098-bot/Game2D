import * as THREE from 'three';
import { CharacterModel } from '../player/CharacterModel.js';
import { toonMat } from '../systems/Toon.js';

// Scene 3D kecil untuk menu utama dan pembuatan karakter (karakter berputar di atas platform).
export class PreviewScene {
  constructor(appearance) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 1.25, 4.6);
    this.camera.lookAt(0, 0.95, 0);

    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#0b1230'); grd.addColorStop(0.55, '#2b3f82'); grd.addColorStop(1, '#a8c8ff');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = bg;

    this.scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x405070, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9a8cff, 1.2); rim.position.set(-4, 3, -3); this.scene.add(rim);

    const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.18, 32), toonMat(0x39467a));
    plat.position.y = -0.09; this.scene.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.03, 8, 48), new THREE.MeshBasicMaterial({ color: 0x8fd0ff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);

    // partikel melayang
    const n = 90, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 7; p[i * 3 + 1] = Math.random() * 4; p[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1; }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.sparks = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 0.05, transparent: true, opacity: 0.8 }));
    this.scene.add(this.sparks);

    this.model = new CharacterModel(appearance);
    this.scene.add(this.model.group);
    this.spin = 0.5; this.spinVel = 0.35; this.dragging = false;
    this.setMode('menu');
  }

  setMode(mode) {
    this.mode = mode;
    this.model.group.position.x = mode === 'menu' ? 1.5 : 1.05;
    this.ring = this.ring;
  }

  setAppearance(a) { this.model.build(a); }

  resize(w, h) {
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.dragging) this.spin += this.spinVel * dt;
    this.model.group.rotation.y = this.spin;
    this.model.update(dt, { speed: 0, grounded: true, vy: 0 });
    const pos = this.sparks.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.15;
      if (y > 4) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  drag(dx) { this.spin += dx * 0.01; }
}
