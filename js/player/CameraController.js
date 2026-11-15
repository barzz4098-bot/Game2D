import * as THREE from 'three';
import { heightAt, clamp } from '../world/Heightmap.js';

// Kamera third-person orbit dengan collision terhadap terrain.
export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;   // arah pandang (sama dengan arah hadap awal pemain)
    this.pitch = 0.32;
    this.targetDist = 6.5;
    this.dist = 6.5;
    this.target = new THREE.Vector3();
    this.off = new THREE.Vector3();
  }

  // 1) putar kamera dari mouse (dipanggil sebelum pemain bergerak agar arah gerak = arah kamera terbaru)
  look(input, sensitivity) {
    const m = input.takeMouse();
    const sens = 0.0022 * sensitivity;
    this.yaw -= m.dx * sens;
    this.pitch = clamp(this.pitch + m.dy * sens, -0.4, 1.3);
    const w = input.takeWheel();
    if (w) this.targetDist = clamp(this.targetDist + w * 0.004, 2.5, 12);
  }

  // 2) ikuti pemain (dipanggil setelah pemain bergerak)
  follow(dt, player) {
    const t =this.target.set(player.pos.x, player.pos.y + 1.5, player.pos.z);
    const cp = Math.cos(this.pitch);
    this.off.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);

    // collision: majukan sampel sepanjang ray, berhenti jika menembus terrain
    let d = this.targetDist;
    for (let s = 0.5; s <= this.targetDist; s += 0.5) {
      const px = t.x + this.off.x * s, py = t.y + this.off.y * s, pz = t.z + this.off.z * s;
      if (py < heightAt(px, pz) + 0.4) { d = Math.max(1.3, s - 0.5); break; }
    }
    const k = d < this.dist ? 30 : 5;
    this.dist += (d - this.dist) * (1 - Math.exp(-k * dt));

    this.camera.position.set(t.x + this.off.x * this.dist, t.y + this.off.y * this.dist, t.z + this.off.z * this.dist);
    const gh = heightAt(this.camera.position.x, this.camera.position.z) + 0.35;
    if (this.camera.position.y < gh) this.camera.position.y = gh;
    this.camera.lookAt(t);
  }
}
