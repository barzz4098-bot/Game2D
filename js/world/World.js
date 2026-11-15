import * as THREE from 'three';
import { Physics } from '../systems/Physics.js';
import { buildTerrain } from './Terrain.js';
import { Environment } from './Environment.js';
import { buildVegetation } from './Vegetation.js';
import { buildProps } from './Props.js';
import { regionAt } from './Heightmap.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// Membangun dunia secara bertahap (progress callback) agar browser tidak freeze tanpa indikator.
export async function createWorld(scene, quality, onProgress, startTime) {
  const physics = new Physics();

  onProgress(0.05, 'Membentuk daratan...'); await nextFrame();
  const terrain = buildTerrain(quality);
  scene.add(terrain);

  onProgress(0.35, 'Menyiapkan langit dan lautan...'); await nextFrame();
  const env = new Environment(scene, quality, startTime);

  onProgress(0.55, 'Menanam pohon dan rumput...'); await nextFrame();
  const veg = buildVegetation(quality, physics);
  scene.add(veg.group);

  onProgress(0.85, 'Menempatkan objek dunia...'); await nextFrame();
  const props = buildProps(physics);
  scene.add(props.group);

  onProgress(1, 'Selesai'); await nextFrame();

  return {
    scene, physics, terrain, env, veg, props,
    interactables: props.interactables,
    stats: veg.stats,
    regionAt,
    update(dt, focus, camera, elapsed) {
      env.update(dt, focus, camera);
      veg.update(focus);
      props.update(elapsed);
    },
  };
}
