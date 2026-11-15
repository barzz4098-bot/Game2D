export const GENDERS = [{ id: 'male', label: 'Laki-laki' }, { id: 'female', label: 'Perempuan' }];
export const HAIR_STYLES = [
  { id: 0, label: 'Pendek' }, { id: 1, label: 'Panjang' }, { id: 2, label: 'Kuncir' },
  { id: 3, label: 'Twin Tail' }, { id: 4, label: 'Spiky' },
];
export const HAIR_COLORS = ['#2b2233', '#5a3825', '#c98a4b', '#f2d16b', '#d8564a', '#e86aa8', '#5a7bd8', '#47c3b0', '#e8ecf5', '#8a5cd8'];
export const EYE_COLORS = ['#4aa3ff', '#3ed0a0', '#ffb347', '#e0505a', '#a96bff', '#7a5230', '#e8e8f0', '#ff7ac8'];
export const SKIN_TONES = ['#ffe0cc', '#f6c7a4', '#e0a37a', '#c68458', '#9c6540', '#6b4430'];
export const OUTFITS = [
  { id: 0, label: 'Pengembara' }, { id: 1, label: 'Penyihir' }, { id: 2, label: 'Ksatria' }, { id: 3, label: 'Kasual' },
];
export const OUTFIT_COLORS = ['#3f7fd8', '#c9433f', '#3aa86b', '#8a5cd8', '#e8a735', '#2e2e3a', '#e8ecf5', '#e86aa8'];

export const DEFAULT_APPEARANCE = {
  gender: 'male', hair: 0, hairColor: HAIR_COLORS[1], eyeColor: EYE_COLORS[0],
  skin: SKIN_TONES[1], outfit: 0, outfitColor: OUTFIT_COLORS[0],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function randomAppearance() {
  return {
    gender: pick(GENDERS).id, hair: pick(HAIR_STYLES).id, hairColor: pick(HAIR_COLORS), eyeColor: pick(EYE_COLORS),
    skin: pick(SKIN_TONES), outfit: pick(OUTFITS).id, outfitColor: pick(OUTFIT_COLORS),
  };
}

// Validasi data (mis. dari save yang rusak) agar model selalu bisa dibangun.
export function sanitizeAppearance(a) {
  const d = { ...DEFAULT_APPEARANCE };
  if (!a || typeof a !== 'object') return d;
  const hex = (v, fb) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb);
  if (a.gender === 'male' || a.gender === 'female') d.gender = a.gender;
  if (Number.isInteger(a.hair) && a.hair >= 0 && a.hair < HAIR_STYLES.length) d.hair = a.hair;
  if (Number.isInteger(a.outfit) && a.outfit >= 0 && a.outfit < OUTFITS.length) d.outfit = a.outfit;
  d.hairColor = hex(a.hairColor, d.hairColor);
  d.eyeColor = hex(a.eyeColor, d.eyeColor);
  d.skin = hex(a.skin, d.skin);
  d.outfitColor = hex(a.outfitColor, d.outfitColor);
  return d;
}
