import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ROBOT_SCALE = 0.02;
const ROBOT_YAW_OFFSET = Math.PI / 2;

const BUBBLE_LOCAL_OFFSET = new THREE.Vector3(0, 0.6, -2);

const SURFACE_Y = 22.0;

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();

const HIDE_X = 0;
const HIDE_Y = -9999;
const HIDE_Z = 0;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function lerpAngle(a, b, t) {
  const d = wrapAngle(b - a);
  return a + d * t;
}

function resolveSphereCollisionsXZ(pos, radius, obstacles) {
  if (!Array.isArray(obstacles)) return;

  for (const ob of obstacles) {
    if (!ob || !ob.center) continue;

    const r = (ob.radius || 0) + radius;
    const dx = pos.x - ob.center.x;
    const dz = pos.z - ob.center.z;
    const d2 = dx * dx + dz * dz;

    if (d2 <= 1e-10) {
      const ang = (pos.x * 12.9898 + pos.z * 78.233) % (Math.PI * 2);
      pos.x += Math.cos(ang) * (r + 1e-3);
      pos.z += Math.sin(ang) * (r + 1e-3);
      continue;
    }

    if (d2 < r * r) {
      const d = Math.sqrt(d2);
      const push = (r - d) + 1e-3;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
    }
  }
}

async function loadAnyGLTF(urls) {
  const loader = new GLTFLoader();

  for (const url of urls) {
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
      return gltf.scene;
    } catch (e) {
      console.warn(`[Crawler] Failed to load: ${url}`);
    }
  }
  throw new Error(`[Crawler] All model paths failed:\n${urls.join("\n")}`);
}

function forceOpaque(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      m.transparent = false;
      m.opacity = 1.0;
      m.alphaTest = 0;
      m.depthWrite = true;
      m.needsUpdate = true;
    }
  });
}

function makeBubbleTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  const g = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );

  g.addColorStop(0.0, "rgba(255,255,255,0.65)");
  g.addColorStop(0.35, "rgba(255,255,255,0.22)");
  g.addColorStop(1.0, "rgba(255,255,255,0.00)");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.22, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

class BubbleEmitter {
  constructor(count = 240) {
    this.count = count;

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const p3 = i * 3;
      this.positions[p3 + 0] = HIDE_X;
      this.positions[p3 + 1] = HIDE_Y;
      this.positions[p3 + 2] = HIDE_Z;
      this.velocities[p3 + 0] = 0;
      this.velocities[p3 + 1] = 0;
      this.velocities[p3 + 2] = 0;
      this.life[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      map: makeBubbleTexture(),
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      size: 0.17,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
      color: new THREE.Color(0xcfeaff),
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;

    this._emitRate = 70;
    this._emitCarry = 0;
    this._emitCursor = 0;
  }

  setVisible(v) {
    this.points.visible = !!v;
  }

  _hide(i) {
    const p3 = i * 3;
    this.life[i] = 0;
    this.positions[p3 + 0] = HIDE_X;
    this.positions[p3 + 1] = HIDE_Y;
    this.positions[p3 + 2] = HIDE_Z;
    this.velocities[p3 + 0] = 0;
    this.velocities[p3 + 1] = 0;
    this.velocities[p3 + 2] = 0;
  }

  _spawn(i, intensity) {
    const p3 = i * 3;

    const x = (Math.random() - 0.5) * 0.75;
    const y = (Math.random() - 0.5) * 0.48;
    const z = 0;

    this.positions[p3 + 0] = x;
    this.positions[p3 + 1] = y;
    this.positions[p3 + 2] = z;

    const back = 3.4 + 4.4 * intensity;

    this.velocities[p3 + 0] = (Math.random() - 0.5) * (0.75 + 0.65 * intensity);
    this.velocities[p3 + 1] = 0.18 + Math.random() * (0.32 + 0.25 * intensity);
    this.velocities[p3 + 2] = -(back + Math.random() * 1.4);

    this.life[i] = 0.32 + Math.random() * 0.38;
  }

  update(dt, intensity) {
    intensity = Math.max(0, Math.min(1, intensity));

    const rate = this._emitRate * (0.35 + 0.85 * intensity);
    this._emitCarry += rate * dt;

    const spawnN = Math.floor(this._emitCarry);
    this._emitCarry -= spawnN;

    for (let n = 0; n < spawnN; n++) {
      const i = this._emitCursor;
      this._emitCursor = (this._emitCursor + 1) % this.count;
      this._spawn(i, intensity);
    }

    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;

      const p3 = i * 3;
      this.life[i] -= dt;

      this.positions[p3 + 0] += this.velocities[p3 + 0] * dt;
      this.positions[p3 + 1] += this.velocities[p3 + 1] * dt;
      this.positions[p3 + 2] += this.velocities[p3 + 2] * dt;

      this.velocities[p3 + 0] *= 0.990;
      this.velocities[p3 + 2] *= 0.997;

      this.velocities[p3 + 1] += 0.06 * dt;

      if (this.life[i] <= 0 || this.positions[p3 + 2] < -6.2 || this.positions[p3 + 1] > 3.6) {
        this._hide(i);
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;

    this.material.opacity = 0.22 + 0.56 * intensity;
    this.material.size = 0.13 + 0.14 * intensity;
  }
}

export class Crawler {
  constructor(scene, waypoints, { visualMode = "full" } = {}) {
    this.scene = scene;
    this.visualMode = visualMode === "prototype" ? "prototype" : "full";

    this.speed = 3.2;
    this.arriveDist = 2.0;
    this.turnSpeed = 4.0;

    this.radius = 1.6;
    this.collisionRadius = 4.4;

    this.maxHP = 200;
    this.hp = this.maxHP;

    this.state = "MOVING";

    this.waypoints = waypoints || [];
    this.wpIndex = 0;

    this.phase = "pathing";
    this.surfaceY = SURFACE_Y;
    this.ascendSpeed = 4.2;

    // Flatten waypoint Y for pathing
    this._flatY = this.waypoints?.[0]?.y ?? -12;
    if (this.waypoints && this.waypoints.length > 0) {
      for (const wp of this.waypoints) wp.y = this._flatY;
    }

    const last =
      this.waypoints && this.waypoints.length > 0
        ? this.waypoints[this.waypoints.length - 1]
        : new THREE.Vector3(0, this._flatY, 0);

    this.ascendPoint = last.clone();
    this._ascendLocked = false;

    this.baseY = this._flatY + 1.2;

    this.group = new THREE.Group();
    this.group.position.copy(this.waypoints?.[0] || new THREE.Vector3(0, this.baseY, 0));
    this.group.position.y = this.baseY;
    this.position = this.group.position;
    scene.add(this.group);

    this.visual = new THREE.Group();
    this.group.add(this.visual);

    this.bubbles = new BubbleEmitter(240);
    this.bubbles.points.position.copy(BUBBLE_LOCAL_OFFSET);
    this.visual.add(this.bubbles.points);
    this.bubbles.setVisible(true);

    this.model = null;
    if (this.visualMode === "prototype") this._buildPrototype();
    else this._buildFull();
  }

  _buildPrototype() {
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x9099a6,
      roughness: 0.7,
      metalness: 0.2,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 4.2), baseMat);
    body.position.y = 0.4;
    this.visual.add(body);

    const propMat = new THREE.MeshStandardMaterial({
      color: 0x2c3a44,
      roughness: 0.6,
      metalness: 0.4,
    });
    const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 10), propMat);
    prop.rotation.z = Math.PI / 2;
    prop.position.set(0, 0.2, -2.2);
    this.visual.add(prop);
    this._protoProp = prop;

    const glow = new THREE.PointLight(0xcfeaff, 0.8, 20);
    glow.position.set(0, 0.6, 1.5);
    this.visual.add(glow);
  }

  async _buildFull() {
    const candidates = [
      "./assets/robot.glb",
      "./assets/crawler.glb",
      "./assets/Robot.glb",
      "./assets/robot/robot.glb",
      "./assets/robot/scene.gltf",
      "./assets/robot/scene.glb",
    ];

    try {
      const root = await loadAnyGLTF(candidates);

      const savedBubbles = this.bubbles?.points || null;
      while (this.visual.children.length) this.visual.remove(this.visual.children[0]);

      root.scale.setScalar(ROBOT_SCALE);
      root.rotation.y = ROBOT_YAW_OFFSET;
      root.position.set(0, -0.6, 0);

      forceOpaque(root);

      this.visual.add(root);
      this.model = root;

      const glow = new THREE.PointLight(0xcfeaff, 1.2, 26);
      glow.position.set(0, 1.0, 1.6);
      this.visual.add(glow);

      if (savedBubbles) {
        savedBubbles.position.copy(BUBBLE_LOCAL_OFFSET);
        this.visual.add(savedBubbles);
      }
    } catch (e) {
      console.warn("Crawler model load failed; using prototype fallback:", e);
      this._buildPrototype();
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHP, this.hp + Math.max(0, amount || 0));
  }
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - Math.max(0, amount || 0));
  }
  getHP() {
    return this.hp;
  }
  hasReachedSurface() {
    return this.phase === "complete";
  }

  update(dt, obstacles) {
    if (!this.waypoints || this.waypoints.length < 2) return;

    if (this.state === "EXTRACTED") {
      if (this.bubbles) this.bubbles.setVisible(false);
      return;
    }

    if (this.wpIndex >= this.waypoints.length - 1 && this.phase === "pathing") {
      this.phase = "ascending";
      this._ascendLocked = false;
    }

    if (this.phase === "ascending") {
      if (!this._ascendLocked) {
        this.group.position.x = this.ascendPoint.x;
        this.group.position.z = this.ascendPoint.z;
        this.group.position.y = this.baseY; // start ascent from level depth
        this._ascendLocked = true;
      }

      this.group.position.y += this.ascendSpeed * dt;

      if (this.bubbles) {
        this.bubbles.setVisible(true);
        this.bubbles.update(dt, 1.0);
      }

      if (this.group.position.y >= this.surfaceY) {
        this.group.position.y = this.surfaceY;
        this.phase = "complete";
        this.state = "EXTRACTED";
        if (this.bubbles) this.bubbles.setVisible(false);
      }
      return;
    }

    if (this._protoProp) this._protoProp.rotation.z += 16.0 * dt;

    const target = this.waypoints[this.wpIndex + 1];
    const pos = this.group.position;

    _tmpA.copy(target).sub(pos);
    _tmpA.y = 0;
    const dist = _tmpA.length();

    if (dist < this.arriveDist) {
      this.wpIndex++;
      if (this.wpIndex >= this.waypoints.length - 1) return;
    }

    _tmpB.copy(this.waypoints[this.wpIndex + 1]).sub(pos);
    _tmpB.y = 0;
    if (_tmpB.lengthSq() > 1e-6) _tmpB.normalize();

    const desiredYaw = Math.atan2(_tmpB.x, _tmpB.z);
    this.group.rotation.y = lerpAngle(
      this.group.rotation.y,
      desiredYaw,
      1 - Math.exp(-this.turnSpeed * dt)
    );

    pos.addScaledVector(_tmpB, this.speed * dt);

    // Stay level while traversing waypoints (no bobbing)
    pos.y = this.baseY;

    resolveSphereCollisionsXZ(pos, this.collisionRadius ?? this.radius, obstacles);

    if (this.bubbles) {
      this.bubbles.setVisible(true);
      this.bubbles.update(dt, 0.9);
    }
  }
}