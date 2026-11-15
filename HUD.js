const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      root: $('hud'), name: $('hud-name'), level: $('hud-level'),
      hp: $('bar-hp'), hpText: $('hp-text'), en: $('bar-en'), enText: $('en-text'), exp: $('bar-exp'),
      region: $('hud-region'), time: $('hud-time'), weather: $('hud-weather'), coords: $('hud-coords'), fps: $('hud-fps'),
      prompt: $('prompt'), dialog: $('dialog'), dTitle: $('dialog-title'), dText: $('dialog-text'),
      toasts: $('toasts'), help: $('help'),
    };
    this.cache = {};
    this.dialogSource = null;
  }

  show(v) { this.el.root.classList.toggle('active', v); }
  toggleHelp() { this.el.help.classList.toggle('hidden'); }
  setName(n) { this.el.name.textContent = n; }

  _set(key, el, value) {
    if (this.cache[key] !== value) { this.cache[key] = value; el.textContent = value; }
  }

  update(player, env, region, fps, showFps) {
    const s = player.stats;
    this._set('lv', this.el.level, String(s.level));
    const hp = Math.round(s.hp), en = Math.round(s.energy);
    if (this.cache.hp !== hp) { this.cache.hp = hp; this.el.hp.style.width = (hp / s.hpMax * 100) + '%'; this.el.hpText.textContent = `${hp} / ${s.hpMax}`; }
    if (this.cache.en !== en) { this.cache.en = en; this.el.en.style.width = (en / s.energyMax * 100) + '%'; this.el.enText.textContent = `${en} / ${s.energyMax}`; }
    const ex = Math.round(s.exp / s.expNext * 100);
    if (this.cache.ex !== ex) { this.cache.ex = ex; this.el.exp.style.width = ex + '%'; }
    this._set('region', this.el.region, region);
    this._set('time', this.el.time, env.timeString());
    this._set('weather', this.el.weather, env.weatherLabel());
    this._set('coords', this.el.coords, `X ${player.pos.x.toFixed(0)}  Y ${player.pos.y.toFixed(1)}  Z ${player.pos.z.toFixed(0)}`);
    this._set('fps', this.el.fps, showFps ? `${fps} FPS` : '');

    // prompt interaksi
    const near = player.nearby;
    const text = near && !this.dialogSource ? `[E] ${near.label}` : '';
    if (this.cache.prompt !== text) {
      this.cache.prompt = text;
      this.el.prompt.textContent = text;
      this.el.prompt.style.display = text ? 'block' : 'none';
    }
    // tutup dialog jika menjauh
    if (this.dialogSource && Math.hypot(this.dialogSource.x - player.pos.x, this.dialogSource.z - player.pos.z) > this.dialogSource.radius + 4) this.hideDialog();
  }

  showDialog(source, data) {
    this.dialogSource = source;
    this.el.dTitle.textContent = data.title;
    this.el.dText.textContent = data.text;
    this.el.dialog.style.display = 'block';
  }
  hideDialog() { this.dialogSource = null; this.el.dialog.style.display = 'none'; }
  get dialogOpen() { return !!this.dialogSource; }

  toast(msg) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = msg;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.removeChild(this.el.toasts.firstChild);
    setTimeout(() => d.remove(), 3100);
  }
}
