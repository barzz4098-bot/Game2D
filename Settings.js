const KEY = 'atheria_settings_v1';

export const QUALITY = {
  low: { label: 'Rendah', pixelRatio: 1, antialias: false, shadows: false, shadowSize: 0, terrainSeg: 110, grass: 3500, grassRange: 90, trees: 320, rocks: 60, fogFar: 210, particles: 60, rain: 600 },
  medium: { label: 'Sedang', pixelRatio: 1.25, antialias: true, shadows: true, shadowSize: 1024, terrainSeg: 160, grass: 9000, grassRange: 120, trees: 560, rocks: 100, fogFar: 290, particles: 100, rain: 1000 },
  high: { label: 'Tinggi', pixelRatio: 1.75, antialias: true, shadows: true, shadowSize: 2048, terrainSeg: 220, grass: 16000, grassRange: 150, trees: 850, rocks: 140, fogFar: 360, particles: 140, rain: 1600 },
};

export const settings = { quality: 'medium', sensitivity: 1, showFps: true };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (QUALITY[d.quality]) settings.quality = d.quality;
      if (typeof d.sensitivity === 'number') settings.sensitivity = Math.min(3, Math.max(0.2, d.sensitivity));
      if (typeof d.showFps === 'boolean') settings.showFps = d.showFps;
    }
  } catch (e) { /* storage tidak tersedia */ }
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* diabaikan */ }
}

export const currentQuality = () => QUALITY[settings.quality];
