// Input keyboard + mouse dengan Pointer Lock. Jika pointer lock tidak tersedia, kamera diputar dengan klik kanan + drag.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = false;
    this.keys = new Set();
    this.pressed = new Set();
    this.buttons = new Set();
    this.clicked = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.buttons.clear(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.buttons.add(e.button);
      if (!this.locked && e.button === 0) this.lock(); // klik pertama: kunci mouse
      this.clicked.add(e.button);
    });
    window.addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.buttons.has(2)) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; }
    });
    canvas.addEventListener('wheel', (e) => { if (this.enabled) { e.preventDefault(); this.wheel += e.deltaY; } }, { passive: false });
    document.addEventListener('pointerlockchange', () => { if (this.onLockChange) this.onLockChange(this.locked); });
  }

  get locked() { return document.pointerLockElement === this.canvas; }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* diabaikan */ } }
  unlock() { if (this.locked) document.exitPointerLock(); }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  wasClicked(btn) { return this.clicked.has(btn); }
  takeMouse() { const r = { dx: this.dx, dy: this.dy }; this.dx = 0; this.dy = 0; return r; }
  takeWheel() { const w = this.wheel; this.wheel = 0; return w; }
  clearAll() { this.keys.clear(); this.pressed.clear(); this.buttons.clear(); this.clicked.clear(); this.dx = this.dy = this.wheel = 0; }
  endFrame() { this.pressed.clear(); this.clicked.clear(); }
}
