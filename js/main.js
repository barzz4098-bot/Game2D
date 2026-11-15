import * as THREE from 'three';
import { settings, loadSettings, saveSettings, currentQuality } from './systems/Settings.js';
import { Save, defaultSave } from './systems/Save.js';
import { Input } from './systems/Input.js';
import { PreviewScene } from './ui/PreviewScene.js';
import { CharacterCreator } from './ui/CharacterCreator.js';
import { HUD } from './ui/HUD.js';
import { createWorld } from './world/World.js';
import { Player } from './player/Player.js';
import { CameraController } from './player/CameraController.js';
import { sanitizeAppearance, DEFAULT_APPEARANCE } from './player/CharacterData.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    loadSettings();
    this.quality = currentQuality();
    this.state = 'menu';
    this.canvas = $('game');
    this.createRenderer();

    this.input = new Input(this.canvas);
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'playing') this.pause(); };

    const saved = Save.load();
    this.preview = new PreviewScene(saved ? sanitizeAppearance(saved.appearance) : DEFAULT_APPEARANCE);
    this.creator = new CharacterCreator(this.preview);
    this.hud = new HUD();

    this.fps = 0; this.fpsAcc = 0; this.fpsFrames = 0;
    this.last = performance.now();
    this.elapsed = 0; this.saveTimer = 0; this.playTime = 0;

    this.bindUI();
    this.bindWindow();
    this.refreshMenu();
    this.show('screen-menu');
    this.onResize();
    requestAnimationFrame((t) => this.loop(t));
  }

  createRenderer() {
    const q = this.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = settings.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  }

  // ---------- UI ----------
  show(...ids) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', ids.includes(s.id)));
  }

  refreshMenu() { $('btn-continue').disabled = !Save.exists(); }

  bindUI() {
    $('btn-new').onclick = () => {
      if (Save.exists() && !confirm('Memulai game baru akan menimpa save yang ada. Lanjutkan?')) return;
      this.state = 'creator';
      this.preview.setMode('creator');
      $('creator-error').textContent = '';
      this.show('screen-creator');
    };
    $('btn-continue').onclick = () => { const d = Save.load(); if (d) this.startGame(d); };
    $('btn-settings').onclick = () => this.openSettings('screen-menu');
    $('btn-credits').onclick = () => this.show('screen-menu', 'screen-credits');
    $('btn-credits-back').onclick = () => this.show('screen-menu');

    $('btn-creator-back').onclick = () => { this.state = 'menu'; this.preview.setMode('menu'); this.refreshMenu(); this.show('screen-menu'); };
    $('btn-random').onclick = () => this.creator.randomize();
    $('btn-start').onclick = () => this.startNewGame();
    $('char-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startNewGame(); });

    $('screen-ready').addEventListener('click', () => this.begin());
    $('btn-resume').onclick = () => this.resume();
    $('btn-pause-settings').onclick = () => this.openSettings('screen-pause');
    $('btn-save-quit').onclick = () => { this.saveNow(); location.reload(); };

    $('set-sens').addEventListener('input', () => { $('set-sens-val').textContent = Number($('set-sens').value).toFixed(1) + 'x'; });
    $('btn-settings-back').onclick = () => this.closeSettings();
    $('btn-settings-ok').onclick = () => this.applySettings();
  }

  openSettings(origin) {
    this.settingsOrigin = origin;
    $('set-quality').value = settings.quality;
    $('set-sens').value = settings.sensitivity;
    $('set-sens-val').textContent = settings.sensitivity.toFixed(1) + 'x';
    $('set-fps').checked = settings.showFps;
    const ids = origin === 'screen-pause' ? ['hud', 'screen-pause', 'screen-settings'] : ['screen-menu', 'screen-settings'];
    this.show(...ids);
  }

  closeSettings() {
    if (this.settingsOrigin === 'screen-pause') this.show('hud', 'screen-pause');
    else this.show('screen-menu');
  }

  applySettings() {
    const oldQ = settings.quality;
    settings.quality = $('set-quality').value;
    settings.sensitivity = parseFloat($('set-sens').value) || 1;
    settings.showFps = $('set-fps').checked;
    saveSettings();
    if (settings.quality !== oldQ) { this.saveNow(); location.reload(); return; }
    this.closeSettings();
  }

  bindWindow() {
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
    window.addEventListener('beforeunload', () => this.saveNow());
    // drag untuk memutar karakter di preview
    this.canvas.addEventListener('mousedown', () => { if (this.state === 'creator' || this.state === 'menu') this.preview.dragging = true; });
    window.addEventListener('mouseup', () => { this.preview.dragging = false; });
    window.addEventListener('mousemove', (e) => { if (this.preview.dragging) this.preview.drag(e.movementX || 0); });
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.preview.resize(w, h);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }

  // ---------- alur game ----------
  startNewGame() {
    const name = this.creator.name;
    const err = $('creator-error');
    if (name.length < 2) { err.textContent = 'Nama minimal 2 karakter.'; return; }
    if (!/^[\p{L}\p{N} _.\-]+$/u.test(name)) { err.textContent = 'Nama hanya boleh huruf, angka, spasi, titik, - dan _.'; return; }
    const data = defaultSave(name, this.creator.appearance);
    Save.write(data);
    this.startGame(data);
  }

  async startGame(data) {
    this.state = 'loading';
    this.save = data;
    this.show('screen-loading');
    const fill = $('loading-fill'), text = $('loading-text');
    const q = this.quality;
    try {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 700);
      this.world = await createWorld(this.scene, q, (p, t) => { fill.style.width = Math.round(p * 100) + '%'; text.textContent = t; },
        Number.isFinite(data.timeOfDay) ? data.timeOfDay : 9);

      const app = sanitizeAppearance(data.appearance);
      this.player = new Player({ name: data.name, appearance: app, physics: this.world.physics, interactables: this.world.interactables, saved: data });
      this.player.model.setBlobShadow(!q.shadows);
      this.scene.add(this.player.model.group);

      this.camCtl = new CameraController(this.camera);
      this.camCtl.yaw = this.player.yaw;
      this.camCtl.follow(1, this.player);
      this.world.update(0, this.player.pos, this.camera, 0);
      this.hud.setName(data.name);
      this.playTime = data.playTime || 0;

      this.state = 'ready';
      $('ready-title').textContent = `Selamat datang, ${data.name}`;
      this.show('screen-ready');
    } catch (e) {
      this.fatal(e);
    }
  }

  // dipanggil dari klik pengguna (diperlukan agar Pointer Lock diizinkan)
  begin() {
    if (this.state !== 'ready') return;
    this.state = 'playing';
    this.input.clearAll();
    this.input.enabled = true;
    this.input.lock();
    this.show('hud');
    this.hud.toast('Jelajahi pulau! Tekan E di dekat papan untuk berinteraksi.');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.input.clearAll();
    this.input.unlock();
    this.saveNow();
    this.show('hud', 'screen-pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.clearAll();
    this.input.enabled = true;
    this.input.lock();
    this.show('hud');
  }

  saveNow() {
    if (!this.player || !this.save || !this.world) return;
    if (this.state === 'loading' || this.state === 'menu' || this.state === 'creator') return;
    const s = this.player.stats;
    Object.assign(this.save, {
      level: s.level, exp: s.exp,
      location: this.player.getSaveLocation(),
      timeOfDay: this.world.env.timeOfDay,
      playTime: Math.floor(this.playTime),
    });
    Save.write(this.save);
  }

  fatal(e) {
    console.error(e);
    this.state = 'error';
    const f = $('fatal');
    f.style.display = 'block';
    f.innerHTML = '<b>Terjadi error:</b> ' + String(e && e.message ? e.message : e);
  }

  // ---------- loop ----------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; }
    try { this.frame(dt); } catch (e) { if (this.state !== 'error') this.fatal(e); }
  }

  frame(dt) {
    switch (this.state) {
      case 'menu':
      case 'creator':
        this.preview.update(dt);
        this.renderer.render(this.preview.scene, this.preview.camera);
        break;
      case 'playing':
        this.updatePlaying(dt);
        this.renderer.render(this.scene, this.camera);
        break;
      case 'ready':
      case 'paused':
        this.renderer.render(this.scene, this.camera);
        break;
      default: break; // loading / error
    }
  }

  updatePlaying(dt) {
    const inp = this.input, p = this.player, w = this.world;

    if (inp.wasPressed('Escape') && !inp.locked) { this.pause(); inp.endFrame(); return; }
    if (inp.wasPressed('KeyH')) this.hud.toggleHelp();
    if (inp.wasPressed('KeyT')) { w.env.advanceHours(1); this.hud.toast('Waktu: ' + w.env.timeString()); }
    if (inp.wasPressed('KeyY')) { w.env.toggleRain(); this.hud.toast(w.env.rainTarget > 0 ? 'Cuaca: hujan' : 'Cuaca: cerah'); }
    if (inp.wasPressed('KeyE')) {
      if (this.hud.dialogOpen) this.hud.hideDialog();
      else if (p.nearby) this.hud.showDialog(p.nearby, p.nearby.action());
    }

    this.camCtl.look(inp, settings.sensitivity);
    p.update(dt, inp, this.camCtl.yaw, (m) => this.hud.toast(m));
    this.camCtl.follow(dt, p);

    this.elapsed += dt; this.playTime += dt;
    w.update(dt, p.pos, this.camera, this.elapsed);
    this.hud.update(p, w.env, w.regionAt(p.pos.x, p.pos.z), this.fps, settings.showFps);

    this.saveTimer += dt;
    if (this.saveTimer > 15) { this.saveTimer = 0; this.saveNow(); }
    inp.endFrame();
  }
}

try {
  window.atheria = new Game();
} catch (e) {
  const f = document.getElementById('fatal');
  f.style.display = 'block';
  f.innerHTML = '<b>Gagal memulai game:</b> ' + String(e && e.message ? e.message : e) + '<br><small>WebGL harus aktif di browser Anda.</small>';
  console.error(e);
}
