// Save system berbasis localStorage. Struktur sudah disiapkan untuk sistem tahap berikutnya
// (elemen, rarity, mastery, skill, inventory, quest, pity) agar save lama tetap kompatibel.
const KEY = 'atheria_save_v1';

export function defaultSave(name, appearance) {
  return {
    version: 1,
    name, appearance,
    level: 1, exp: 0,
    element: null, rarity: null,
    mastery: {}, skills: [], inventory: [], quests: [],
    pity: 0,
    location: null,
    timeOfDay: 9,
    playTime: 0,
  };
}

export const Save = {
  exists() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object' || typeof d.name !== 'string') return null;
      return { ...defaultSave(d.name, d.appearance), ...d };
    } catch (e) { return null; }
  },
  write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* diabaikan */ }
  },
};
