import {
  GENDERS, HAIR_STYLES, HAIR_COLORS, EYE_COLORS, SKIN_TONES, OUTFITS, OUTFIT_COLORS,
  DEFAULT_APPEARANCE, randomAppearance, sanitizeAppearance,
} from '../player/CharacterData.js';

// UI pembuatan karakter. Setiap perubahan langsung terlihat pada model 3D di PreviewScene.
export class CharacterCreator {
  constructor(preview) {
    this.preview = preview;
    this.app = { ...DEFAULT_APPEARANCE };
    this.root = document.getElementById('creator-options');
    this.nameInput = document.getElementById('char-name');
    this.build();
  }

  get appearance() { return { ...this.app }; }
  get name() { return this.nameInput.value.trim(); }

  set(app) {
    this.app = sanitizeAppearance(app);
    this.preview.setAppearance(this.app);
    this.refresh();
  }

  randomize() { this.set(randomAppearance()); }

  _change(key, value) {
    this.app[key] = value;
    this.preview.setAppearance(this.app);
    this.refresh();
  }

  _group(title, key, items, kind) {
    const wrap = document.createElement('div'); wrap.className = 'opt-group';
    const h = document.createElement('h4'); h.textContent = title; wrap.appendChild(h);
    const row = document.createElement('div'); row.className = 'chips'; wrap.appendChild(row);
    items.forEach((it) => {
      const b = document.createElement('button');
      if (kind === 'swatch') {
        b.className = 'swatch'; b.style.background = it; b.title = it; b.dataset.value = it;
      } else {
        b.className = 'chip'; b.textContent = it.label; b.dataset.value = String(it.id);
      }
      b.addEventListener('click', () => this._change(key, kind === 'swatch' ? it : it.id));
      row.appendChild(b);
    });
    this.root.appendChild(wrap);
    return row;
  }

  build() {
    this.groups = {
      gender: this._group('Jenis Kelamin', 'gender', GENDERS, 'chip'),
      hair: this._group('Gaya Rambut', 'hair', HAIR_STYLES, 'chip'),
      hairColor: this._group('Warna Rambut', 'hairColor', HAIR_COLORS, 'swatch'),
      eyeColor: this._group('Warna Mata', 'eyeColor', EYE_COLORS, 'swatch'),
      skin: this._group('Warna Kulit', 'skin', SKIN_TONES, 'swatch'),
      outfit: this._group('Pakaian', 'outfit', OUTFITS, 'chip'),
      outfitColor: this._group('Warna Pakaian', 'outfitColor', OUTFIT_COLORS, 'swatch'),
    };
    this.refresh();
  }

  refresh() {
    for (const [key, row] of Object.entries(this.groups)) {
      for (const b of row.children) b.classList.toggle('sel', b.dataset.value === String(this.app[key]));
    }
  }
}
