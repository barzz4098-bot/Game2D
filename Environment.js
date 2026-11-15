import * as THREE from 'three';
import { smoothstep, clamp, mulberry32 } from './Heightmap.js';
import { timeUniform } from './Shared.js';

const DAY_SECONDS = 1200; // 1 hari game = 20 menit nyata

const COL = {
  dayTop: new THREE.Color(0x3f8fe6), nightTop: new THREE.Color(0x070a1f), duskTop: new THREE.Color(0x6a5aa8),
  dayHor: new THREE.Color(0xbfe6ff), nightHor: new THREE.Color(0x182046), duskHor: new THREE.Color(0xff9a5a),
  rainGray: new THREE.Color(0x8d99a4),
  sunDay: new THREE.Color(0xfff1d6), sunDusk: new THREE.Color(0xff9a60),
  cloudDay: new THREE.Color(0xffffff), cloudDusk: new THREE.Color(0xffb690), cloudNight: new THREE.Color(0x3a4468),
};

function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Environment {
  constructor(scene, quality, startTime = 9) {
    this.scene = scene;
    this.quality = quality;
    this.timeOfDay = startTime;
    this.rain = 0; this.rainTarget = 0;
    this.weatherTimer = 120 + Math.random() * 120;
    this.day = 1; this.dusk = 0;
    this.sunDir = new THREE.Vector3(0, 1, 0.3);
    this._c1 = new THREE.Color(); this._c2 = new THREE.Color(); this._white = new THREE.Color(0xffffff);

    scene.fog = new THREE.Fog(0xbfe6ff, 40, quality.fogFar);
    scene.background = new THREE.Color(0xbfe6ff);

    // ---- lampu ----
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5a7a4a, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2);
    this.sun.castShadow = quality.shadows;
    if (quality.shadows) {
      const s = this.sun.shadow;
      s.mapSize.set(quality.shadowSize, quality.shadowSize);
      const r = 42;
      s.camera.left = -r; s.camera.right = r; s.camera.top = r; s.camera.bottom = -r;
      s.camera.near = 1; s.camera.far = 220;
      s.bias = -0.0006; s.normalBias = 0.06;
    }
    scene.add(this.sun); scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0.3);
    scene.add(this.moon); scene.add(this.moon.target);

    this._buildSky();
    this._buildStars();
    this._buildClouds();
    this._buildWater();
    this._buildRain();
    this._buildMotes();
  }

  // ---------- sky dome ----------
  _buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, -1, 0) },
        sunColor: { value: new THREE.Color() }, night: { value: 0 },
      },
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 moonDir; uniform vec3 sunColor; uniform float night;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(horizon, top, pow(h, 0.55));
          if (d.y < 0.0) col = mix(horizon, horizon * 0.65, clamp(-d.y * 3.0, 0.0, 1.0));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(sd, 700.0) * 3.0 + pow(sd, 14.0) * 0.3);
          float md = max(dot(d, normalize(moonDir)), 0.0);
          col += night * (vec3(0.92, 0.96, 1.0) * smoothstep(0.9993, 0.9997, md) + vec3(0.35, 0.45, 0.8) * pow(md, 60.0) * 0.14);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
  }

  _buildStars() {
    const r = mulberry32(777), n = 700, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 * Math.PI, v = Math.acos(r() * 0.98);
      p[i * 3] = Math.sin(v) * Math.cos(u) * 480; p[i * 3 + 1] = Math.cos(v) * 480; p[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 480;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.frustumCulled = false; this.stars.renderOrder = -9;
    this.scene.add(this.stars);
  }

  _buildClouds() {
    const r = mulberry32(4242), clouds = 22, puffs = 5;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x404040, fog: false, transparent: true, opacity: 0.95 });
    const mesh = new THREE.InstancedMesh(geo, this.cloudMat, clouds * puffs);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let idx = 0;
    for (let i = 0; i < clouds; i++) {
      const a = r() * Math.PI * 2, rad = 60 + r() * 280, y = 105 + r() * 45;
      const cx = Math.cos(a) * rad, cz = Math.sin(a) * rad;
      for (let j = 0; j < puffs; j++) {
        const sc = 8 + r() * 9;
        p.set(cx + (r() - 0.5) * 26, y + (r() - 0.5) * 4, cz + (r() - 0.5) * 16);
        s.set(sc * 1.5, sc * 0.7, sc * 1.1);
        m.compose(p, q, s);
        mesh.setMatrixAt(idx++, m);
      }
    }
    mesh.frustumCulled = false;
    this.clouds = new THREE.Group();
    this.clouds.add(mesh);
    this.scene.add(this.clouds);
  }

  _buildWater() {
    const geo = new THREE.PlaneGeometry(900, 900, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhongMaterial({ color: 0x35bfe0, transparent: true, opacity: 0.8, shininess: 90, specular: 0xa8e0ff });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        transformed.y += sin(wp.x * 0.11 + uTime * 1.1) * 0.16 + sin(wp.z * 0.13 + uTime * 0.9) * 0.14 + sin((wp.x + wp.z) * 0.3 + uTime * 1.7) * 0.04;
      `);
    };
    this.water = new THREE.Mesh(geo, mat);
    this.water.renderOrder = 1;
    this.scene.add(this.water);
  }

  _buildRain() {
    const n = this.quality.rain;
    this.rainN = n;
    this.rainPos = new Float32Array(n * 6);
    this.rainSeed = new Float32Array(n * 3);
    const r = mulberry32(99);
    for (let i = 0; i < n; i++) {
      this.rainSeed[i * 3] = (r() - 0.5) * 50; this.rainSeed[i * 3 + 1] = r() * 30; this.rainSeed[i * 3 + 2] = (r() - 0.5) * 50;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0, depthWrite: false });
    this.rainLines = new THREE.LineSegments(g, this.rainMat);
    this.rainLines.frustumCulled = false; this.rainLines.visible = false;
    this.scene.add(this.rainLines);
  }

  _buildMotes() {
    // kunang-kunang (malam) / serbuk sari (siang) di sekitar pemain
    const n = this.quality.particles;
    this.moteN = n;
    this.moteSeed = new Float32Array(n * 3);
    const r = mulberry32(555);
    for (let i = 0; i < n; i++) { this.moteSeed[i * 3] = r() * 40; this.moteSeed[i * 3 + 1] = r() * 8; this.moteSeed[i * 3 + 2] = r() * 40; }
    this.motePos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.moteMat = new THREE.PointsMaterial({
      map: makeDotTexture(), size: 0.45, transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xfff2a0,
    });
    this.motes = new THREE.Points(g, this.moteMat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  // ---------- API ----------
  get hour() { return this.timeOfDay; }
  timeString() {
    const h = Math.floor(this.timeOfDay) % 24, m = Math.floor((this.timeOfDay % 1) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  weatherLabel() { return this.rainTarget > 0 ? 'Hujan' : (this.day < 0.3 ? 'Malam' : 'Cerah'); }
  advanceHours(h) { this.timeOfDay = (this.timeOfDay + h) % 24; }
  toggleRain() { this.rainTarget = this.rainTarget > 0 ? 0 : 1; this.weatherTimer = 90; }

  update(dt, focus, camera) {
    timeUniform.value += dt;
    this.timeOfDay = (this.timeOfDay + dt * 24 / DAY_SECONDS) % 24;

    // cuaca acak
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.rainTarget > 0) { this.rainTarget = 0; this.weatherTimer = 150 + Math.random() * 150; }
      else if (Math.random() < 0.3) { this.rainTarget = 1; this.weatherTimer = 60 + Math.random() * 60; }
      else this.weatherTimer = 90 + Math.random() * 90;
    }
    this.rain += (this.rainTarget - this.rain) * (1 - Math.exp(-dt * 0.5));
    const rain = this.rain;

    // posisi matahari/bulan
    const theta = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(theta);
    this.sunDir.set(Math.cos(theta), elev, 0.35).normalize();
    const day = this.day = smoothstep(-0.12, 0.2, elev);
    const dusk = this.dusk = Math.exp(-Math.pow(elev / 0.22, 2));

    // warna langit
    const top = this._c1.copy(COL.nightTop).lerp(COL.dayTop, day).lerp(COL.duskTop, dusk * 0.5).lerp(COL.rainGray, rain * 0.6 * (0.3 + day * 0.7));
    const hor = this._c2.copy(COL.nightHor).lerp(COL.dayHor, day).lerp(COL.duskHor, dusk * 0.7).lerp(COL.rainGray, rain * 0.7 * (0.3 + day * 0.7));
    const u = this.skyMat.uniforms;
    u.top.value.copy(top); u.horizon.value.copy(hor);
    u.sunDir.value.copy(this.sunDir); u.moonDir.value.copy(this.sunDir).negate();
    u.sunColor.value.copy(COL.sunDay).lerp(COL.sunDusk, dusk).multiplyScalar(day * (1 - rain * 0.85));
    u.night.value = (1 - day) * (1 - rain);
    this.starMat.opacity = (1 - day) * (1 - rain) * 0.9;

    // fog + latar
    this.scene.fog.color.copy(hor);
    this.scene.fog.near = 40 - rain * 20;
    this.scene.fog.far = this.quality.fogFar * (1 - rain * 0.45);
    this.scene.background.copy(hor);

    // lampu
    this.sun.color.copy(COL.sunDay).lerp(COL.sunDusk, dusk);
    this.sun.intensity = 2.0 * day * (1 - rain * 0.6);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 90);
    this.sun.target.position.copy(focus);
    this.moon.intensity = 0.5 * (1 - day) * (1 - rain * 0.5);
    this.moon.position.copy(focus).addScaledVector(this.sunDir, -90);
    this.moon.target.position.copy(focus);
    this.hemi.color.copy(hor).lerp(this._white, 0.3);
    this.hemi.groundColor.setRGB(0.28, 0.4, 0.22).multiplyScalar(0.4 + day * 0.6);
    this.hemi.intensity = (0.32 + day * 0.65) * (1 - rain * 0.2);

    // ikuti kamera/pemain
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.clouds.position.set(focus.x, 0, focus.z);
    this.clouds.rotation.y += dt * 0.004;
    const cc = this.cloudMat.color.copy(COL.cloudNight).lerp(COL.cloudDay, day).lerp(COL.cloudDusk, dusk * 0.6).lerp(COL.rainGray, rain * 0.6);
    this.cloudMat.emissive.copy(cc).multiplyScalar(0.3);
    this.water.position.set(Math.round(focus.x / 10) * 10, 0, Math.round(focus.z / 10) * 10);

    this._updateRain(dt, camera, rain);
    this._updateMotes(focus, day);
  }

  _updateRain(dt, camera, rain) {
    this.rainLines.visible = rain > 0.02;
    if (!this.rainLines.visible) return;
    this.rainMat.opacity = 0.4 * rain;
    this.rainLines.position.set(camera.position.x, camera.position.y - 6, camera.position.z);
    const p = this.rainPos, s = this.rainSeed, n = this.rainN;
    for (let i = 0; i < n; i++) {
      s[i * 3 + 1] -= dt * 28;
      if (s[i * 3 + 1] < 0) s[i * 3 + 1] += 30;
      const x = s[i * 3], y = s[i * 3 + 1], z = s[i * 3 + 2];
      p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
      p[i * 6 + 3] = x - 0.05; p[i * 6 + 4] = y + 0.9; p[i * 6 + 5] = z;
    }
    this.rainLines.geometry.attributes.position.needsUpdate = true;
  }

  _updateMotes(focus, day) {
    const t = timeUniform.value, n = this.moteN, p = this.motePos, s = this.moteSeed;
    for (let i = 0; i < n; i++) {
      const sx = s[i * 3], sy = s[i * 3 + 1], sz = s[i * 3 + 2];
      // wrap relatif terhadap pemain supaya partikel selalu di sekitar pemain
      let x = ((sx + Math.sin(t * 0.3 + i) * 1.2 - focus.x) % 40 + 40) % 40 - 20 + focus.x;
      let z = ((sz + Math.cos(t * 0.25 + i * 1.7) * 1.2 - focus.z) % 40 + 40) % 40 - 20 + focus.z;
      p[i * 3] = x;
      p[i * 3 + 1] = focus.y + 0.6 + sy + Math.sin(t * 0.8 + i * 2.1) * 0.5;
      p[i * 3 + 2] = z;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
    const night = 1 - day;
    this.moteMat.color.setHex(night > 0.5 ? 0xd8ff7a : 0xfff4b8);
    this.moteMat.size = 0.3 + night * 0.35;
    this.moteMat.opacity = (0.22 + night * 0.7) * (1 - this.rain * 0.8);
  }
}
