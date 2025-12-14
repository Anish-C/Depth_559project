import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// === TUNE THESE ===
const ROBOT_SCALE = 0.02;                 // scale robot down (try 0.02–0.08)
const ROBOT_YAW_OFFSET = Math.PI / 2;     // tweak if rotated wrong: 0, ±Math.PI/2, Math.PI, Math.PI/2

// Bubble VFX tuning (move this to fit the crawler)
const BUBBLE_LOCAL_OFFSET = new THREE.Vector3(0, 0.6, -2); // x=left/right, y=up/down, z=forward/back (more - = further back)
// ==================

// Escape target (tune after merge)
const FINAL_XZ = new THREE.Vector2(0, -210);
const SURFACE_Y = 22.0;

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();

// Dead particles must be moved somewhere invisible (Points draws ALL vertices always)
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

    if (d2 < r * r && d2 > 1e-10) {
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
  // Soft bubble sprite (not sparkly)
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  const g = ctx.createRadialGradient(
    size * 0.5, size * 0.5, size * 0.08,
    size * 0.5, size * 0.5, size * 0.5
  );

  g.addColorStop(0.0, "rgba(255,255,255,0.65)");
  g.addColorStop(0.35, "rgba(255,255,255,0.22)");
  g.addColorStop(1.0, "rgba(255,255,255,0.00)");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // faint ring highlight
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.22, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Continuous bubble thruster using Points.
 *
 * Key fix for "blob at the back":
 *   Points renders every vertex all the time.
 *   If a particle "dies" but you don't move its vertex away, it STILL shows.
 * So: whenever life <= 0, we shove it to (0, -9999, 0).
 *
 * Key fix for "pulsing":
 *   deterministic emission via accumulator + ring cursor (no random spawn probability).
 */
class BubbleEmitter {
  constructor(count = 240) {
    this.count = count;

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);

    // init all particles hidden
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

    // emission
    this._emitRate = 70;   // particles/sec baseline (scaled by intensity)
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

    // spawn cloud near nozzle (local space)
    const x = (Math.random() - 0.5) * 0.75;
    const y = (Math.random() - 0.5) * 0.48;
    const z = 0;

    this.positions[p3 + 0] = x;
    this.positions[p3 + 1] = y;
    this.positions[p3 + 2] = z;

    // Mostly backward along -Z, slight up, jitter
    const back = 3.4 + 4.4 * intensity;

    this.velocities[p3 + 0] = (Math.random() - 0.5) * (0.75 + 0.65 * intensity);
    this.velocities[p3 + 1] = 0.18 + Math.random() * (0.32 + 0.25 * intensity);
    this.velocities[p3 + 2] = -(back + Math.random() * 1.4);

    // short lifetime prevents long lingering trail
    this.life[i] = 0.32 + Math.random() * 0.38;
  }

  update(dt, intensity) {
    intensity = Math.max(0, Math.min(1, intensity));

    // deterministic continuous emission (no random clumps)
    const rate = this._emitRate * (0.35 + 0.85 * intensity);
    this._emitCarry += rate * dt;

    const spawnN = Math.floor(this._emitCarry);
    this._emitCarry -= spawnN;

    for (let n = 0; n < spawnN; n++) {
      const i = this._emitCursor;
      this._emitCursor = (this._emitCursor + 1) % this.count;
      this._spawn(i, intensity);
    }

    // Integrate particles
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;

      const p3 = i * 3;
      this.life[i] -= dt;

      this.positions[p3 + 0] += this.velocities[p3 + 0] * dt;
      this.positions[p3 + 1] += this.velocities[p3 + 1] * dt;
      this.positions[p3 + 2] += this.velocities[p3 + 2] * dt;

      // drag (keep Z moving so particles don't "park" and blob)
      this.velocities[p3 + 0] *= 0.990;
      this.velocities[p3 + 2] *= 0.997;

      // mild buoyancy
      this.velocities[p3 + 1] += 0.06 * dt;

      // Kill quickly if too far back / too high / expired
      if (
        this.life[i] <= 0 ||
        this.positions[p3 + 2] < -6.2 ||
        this.positions[p3 + 1] > 3.6
      ) {
        this._hide(i);
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;

    // global strength
    this.material.opacity = 0.22 + 0.56 * intensity;
    this.material.size = 0.13 + 0.14 * intensity;
  }
}

export class Crawler {
  constructor(scene, waypoints, { visualMode = "full" } = {}) {
    this.scene = scene;
    this.visualMode = visualMode === "prototype" ? "prototype" : "full";

    // Movement
    this.speed = 3.2;
    this.arriveDist = 2.0;
    this.turnSpeed = 4.0;

    // Gameplay / collision
    this.radius = 1.6;
    this.collisionRadius = 4.4;

    // HP
    this.maxHP = 200;
    this.hp = this.maxHP;

    // State
    this.state = "MOVING";

    // Path
    this.waypoints = waypoints || [];
    this.wpIndex = 0;

    // Phases
    this.phase = "pathing";
    this.finalXZ = FINAL_XZ.clone();
    this.surfaceY = SURFACE_Y;
    this.ascendSpeed = 4.2;

    // Swim bobbing (lifted a bit to avoid terrain deflection/clipping)
    this.baseY = this.waypoints?.[0]?.y ?? -12;
    this.baseY += 1.2;
    this.bobT = Math.random() * 10;

    // Root
    this.group = new THREE.Group();
    this.group.position.copy(this.waypoints?.[0] || new THREE.Vector3(0, this.baseY, 0));
    this.group.position.y = this.baseY;
    this.position = this.group.position;
    scene.add(this.group);

    // Visual container (so bubbles survive model reload)
    this.visual = new THREE.Group();
    this.group.add(this.visual);

    // Bubbles
    this.bubbles = new BubbleEmitter(240);
    this.bubbles.points.position.copy(BUBBLE_LOCAL_OFFSET);
    this.visual.add(this.bubbles.points);
    this.bubbles.setVisible(true);

    // Visual/model
    this.model = null;
    if (this.visualMode === "prototype") this._buildPrototype();
    else this._buildFull(); // async
  }

  _buildPrototype() {
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x9099a6, roughness: 0.7, metalness: 0.2
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 4.2), baseMat);
    body.position.y = 0.4;
    this.visual.add(body);

    const propMat = new THREE.MeshStandardMaterial({
      color: 0x2c3a44, roughness: 0.6, metalness: 0.4
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

      // preserve bubbles when clearing visuals
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

    // Transition to ascending after finishing waypoint path
    if (this.wpIndex >= this.waypoints.length - 1 && this.phase === "pathing") {
      this.phase = "ascending";
    }

    // Ascend phase (XZ locked)
    if (this.phase === "ascending") {
      this.group.position.x = this.finalXZ.x;
      this.group.position.z = this.finalXZ.y;

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

    // MOVING along waypoints
    if (this._protoProp) this._protoProp.rotation.z += 16.0 * dt;

    const target = this.waypoints[this.wpIndex + 1];
    const pos = this.group.position;

    _tmpA.copy(target).sub(pos);
    const dist = _tmpA.length();

    if (dist < this.arriveDist) {
      this.wpIndex++;
      if (this.wpIndex >= this.waypoints.length - 1) return;
    }

    const dir = _tmpA.copy(target).sub(pos);
    dir.y = 0;
    if (dir.lengthSq() > 1e-6) dir.normalize();

    const desiredYaw = Math.atan2(dir.x, dir.z);
    this.group.rotation.y = lerpAngle(
      this.group.rotation.y,
      desiredYaw,
      1 - Math.exp(-this.turnSpeed * dt)
    );

    pos.addScaledVector(dir, this.speed * dt);

    // bobbing
    this.bobT += dt;
    pos.y = this.baseY + 0.25 * Math.sin(this.bobT * 1.2);

    // collisions only in XZ
    resolveSphereCollisionsXZ(pos, this.collisionRadius ?? this.radius, obstacles);

    // Bubbles
    if (this.bubbles) {
      this.bubbles.setVisible(true);
      this.bubbles.update(dt, 0.9);
    }
  }
}
