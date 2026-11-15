// Physics sederhana: collider lingkaran (pohon, batu, prop) pada spatial hash + heightfield terrain.
import { heightAt } from '../world/Heightmap.js';

const CELL = 8;
const key = (cx, cz) => (cx + 1024) * 4096 + (cz + 1024);

export class Physics {
  constructor() {
    this.grid = new Map();
    this.count = 0;
  }

  addCircle(x, z, r, top = 1e9, tag = '') {
    const c = { x, z, r, top, tag };
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz);
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(c);
      }
    }
    this.count++;
    return c;
  }

  groundHeight(x, z) { return heightAt(x, z); }

  // dorong pos keluar dari collider; return true jika menabrak
  resolve(pos, radius) {
    let hit = false;
    // beberapa iterasi: collider yang saling tumpang tindih (pohon dekat batu) tidak bisa ditembus
    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      const cx = Math.floor(pos.x / CELL), cz = Math.floor(pos.z / CELL);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const arr = this.grid.get(key(cx + ox, cz + oz));
          if (!arr) continue;
          for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if (pos.y > c.top) continue;
            const dx = pos.x - c.x, dz = pos.z - c.z;
            const min = c.r + radius;
            const d2 = dx * dx + dz * dz;
            if (d2 < min * min) {
              const d = Math.sqrt(d2) || 0.0001;
              const push = (min - d) / d;
              pos.x += dx * push; pos.z += dz * push;
              pushed = true;
            }
          }
        }
      }
      if (!pushed) break;
      hit = true;
    }
    return hit;
  }
}
