import * as THREE from 'three';
import { heightAt, MAX_WALK_DEPTH, WORLD_SIZE, SPAWN, clamp } from '../world/Heightmap.js';
import { CharacterModel } from './CharacterModel.js';

const WALK = 4.2, RUN = 8.0, JUMP = 8.6, GRAVITY = 26, RADIUS = 0.38;
const WORLD_LIMIT = WORLD_SIZE / 2 - 6;

const angleDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class Player {
  constructor({ name, appearance, physics, interactables, saved }) {
    this.name = name;
    this.physics = physics;
    this.interactables = interactables;
    this.pos = new THREE.Vector3(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z);
    this.yaw = Math.PI;       // menghadap utara (-z)
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.grounded = true;
    this.inWater = false;
    this.stats = { level: 1, exp: 0, expNext: 100, hp: 100, hpMax: 100, energy: 100, energyMax: 100 };
    this.comboIndex = 0; this.comboTimer = 0;
    this.nearby = null;

    if (saved) {
      const l = saved.location;
      if (l && Number.isFinite(l.x) && Number.isFinite(l.z) && heightAt(l.x, l.z) > MAX_WALK_DEPTH) {
        this.pos.set(l.x, heightAt(l.x, l.z), l.z);
        if (Number.isFinite(l.yaw)) this.yaw = l.yaw;
      }
      this.stats.level = saved.level || 1;
      this.stats.exp = saved.exp || 0;
    }

    this.model = new CharacterModel(appearance);
    this.model.group.position.copy(this.pos);
    this.model.group.rotation.y = this.yaw;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }

  update(dt, input, camYaw, onToast) {
    const m = this.model;
    const attacking = m.isAttacking;

    // ----- intent gerak (relatif kamera) -----
    const fwd = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const rgt = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    let dx = fx * fwd + rx * rgt, dz = fz * fwd + rz * rgt;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }
    const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    let target = len > 0 ? (running ? RUN : WALK) : 0;
    if (attacking) target *= 0.35;
    if (this.inWater) target *= 0.65;

    const k = 1 - Math.exp(-(this.grounded ? 14 : 4) * dt);
    this.vx += (dx * target - this.vx) * k;
    this.vz += (dz * target - this.vz) * k;

    // ----- hadap -----
    let wantYaw = this.yaw;
    if (attacking) wantYaw = camYaw;
    else if (len > 0) wantYaw = Math.atan2(dx, dz);
    if (attacking || len > 0) this.yaw += angleDiff(this.yaw, wantYaw) * (1 - Math.exp(-16 * dt));

    // ----- lompat -----
    if (input.wasPressed('Space') && this.grounded) { this.vy = JUMP; this.grounded = false; }

    // ----- gerak horizontal + collision -----
    this._moveHorizontal(this.vx * dt, this.vz * dt);

    // ----- gerak vertikal -----
    const pos = this.pos;
    if (!this.grounded) this.vy -= GRAVITY * dt;
    pos.y += this.vy * dt;
    const gh = heightAt(pos.x, pos.z);
    if (pos.y <= gh + 0.001 || (this.grounded && this.vy <= 0 && pos.y - gh < 0.4)) {
      pos.y = gh; this.vy = 0; this.grounded = true;
    } else {
      this.grounded = false;
    }
    this.inWater = gh < -0.15;
    if (pos.y < -40) { pos.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z); this.vx = this.vz = this.vy = 0; }

    // ----- serangan (klik kiri) + kombo -----
    this.comboTimer -= dt;
    if (input.wasClicked(0)) {
      const canChain = !m.isAttacking || m.attackT / m.attackDur > 0.5;
      if (canChain) {
        this.comboIndex = this.comboTimer > 0 ? (this.comboIndex + 1) % 3 : 0;
        m.startAttack(this.comboIndex);
        this.comboTimer = m.attackDur + 0.5;
      }
    }

    // ----- skill (belum ada elemen) -----
    if (input.wasPressed('KeyQ')) { m.playCast(false); onToast && onToast('Kamu belum memiliki elemen. Temukan Altar Awakening.'); }
    if (input.wasPressed('KeyR')) { m.playCast(true); onToast && onToast('Ultimate membutuhkan elemen yang sudah terbangun.'); }

    // ----- interaksi -----
    this.nearby = null;
    let best = 1e9;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - pos.x, it.z - pos.z);
      if (d < it.radius && d < best) { best = d; this.nearby = it; }
    }

    // ----- model -----
    m.group.position.copy(pos);
    m.group.rotation.y = this.yaw;
    m.update(dt, { speed: this.speed, grounded: this.grounded, vy: this.vy });
  }

  _moveHorizontal(dx, dz) {
    const pos = this.pos;
    const tryTo = (nx, nz) => {
      const gh = heightAt(nx, nz);
      if (gh < MAX_WALK_DEPTH) return false;
      if (Math.hypot(nx, nz) > WORLD_LIMIT) return false;
      const dist = Math.hypot(nx - pos.x, nz - pos.z);
      const rise = gh - pos.y;
      const allow = this.grounded ? 1.35 * dist + 0.04 : 0.05;
      if (rise > allow) return false;
      pos.x = nx; pos.z = nz;
      return true;
    };
    if (!tryTo(pos.x + dx, pos.z + dz)) {
      if (!tryTo(pos.x + dx, pos.z)) tryTo(pos.x, pos.z + dz);
    }
    this.physics.resolve(pos, RADIUS);
  }

  getSaveLocation() {
    return { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw };
  }
}
