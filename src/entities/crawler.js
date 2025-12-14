import * as THREE from "three";
import { loadGLBScene } from "../engine/assets.js";

// === TUNE THESE ===
const ROBOT_SCALE = 0.02;                 // scale robot down (try 0.02–0.08)
const ROBOT_YAW_OFFSET = Math.PI / 2;     // if rotated wrong: Math.PI/2, -Math.PI/2, Math.PI, 0

// Bubble VFX tuning
// Move Z toward 0 to move bubbles "into" the asset. (Less negative = more inside)
const BUBBLE_LOCAL_OFFSET = new THREE.Vector3(0, 1.2, -2);
// ==================

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngle(a, b, t) {
  const d = wrapAngle(b - a);
  return a + d * t;
}

function resolveSphereCollisions(pos, radius, obstacles) {
  if (!Array.isArray(obstacles)) return;

  for (const ob of obstacles) {
    if (!ob || !ob.center || typeof ob.radius !== "number") continue;

    const dx = pos.x - ob.center.x;
    const dy = pos.y - ob.center.y;
    const dz = pos.z - ob.center.z;

    const r = radius + ob.radius;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) continue;

    const d = Math.sqrt(Math.max(d2, 1e-8));
    const overlap = r - d;

    pos.x += (dx / d) * overlap;
    pos.y += (dy / d) * overlap;
    pos.z += (dz / d) * overlap;
  }
}

function markRecursive(obj, key, value) {
  obj.traverse((n) => {
    if (!n.userData) n.userData = {};
    n.userData[key] = value;
  });
}

// Fix for "random transparent spots" on some GLBs:
function forceOpaqueMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;

      m.transparent = false;
      m.opacity = 1.0;
      m.alphaTest = 0.0;

      m.depthWrite = true;
      m.depthTest = true;

      m.needsUpdate = true;
    }
  });
}

function makeBubbleTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );

  g.addColorStop(0.0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.25, "rgba(255,255,255,0.35)");
  g.addColorStop(1.0, "rgba(255,255,255,0.0)");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

class BubbleEmitter {
  constructor(count = 220) {
    this.count = count;

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      map: makeBubbleTexture(),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      size: 0.22,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;

    for (let i = 0; i < count; i++) this.life[i] = 0;

    this._spawnRate = 18; // particles/sec baseline (scaled by intensity)
  }

  setVisible(v) {
    this.points.visible = v;
  }

  _spawn(i, intensity) {
    const p3 = i * 3;

    const x = (Math.random() - 0.5) * 0.8;
    const y = (Math.random() - 0.5) * 0.5;
    const z = 0;

    this.positions[p3 + 0] = x;
    this.positions[p3 + 1] = y;
    this.positions[p3 + 2] = z;

    const back = 2.2 + 3.2 * intensity;

    this.velocities[p3 + 0] = (Math.random() - 0.5) * (0.9 + 0.7 * intensity);
    this.velocities[p3 + 1] = 0.55 + Math.random() * (0.9 + 0.6 * intensity);
    this.velocities[p3 + 2] = -(back + Math.random() * 1.2);

    this.life[i] = 0.55 + Math.random() * 0.65;
  }

  update(dt, intensity) {
    const rate = this._spawnRate * (0.25 + 0.95 * intensity);
    const spawnProb = Math.min(1, rate * dt);

    for (let i = 0; i < this.count; i++) {
      const p3 = i * 3;

      if (this.life[i] <= 0) {
        if (Math.random() < spawnProb) this._spawn(i, intensity);
        continue;
      }

      this.life[i] -= dt;

      this.positions[p3 + 0] += this.velocities[p3 + 0] * dt;
      this.positions[p3 + 1] += this.velocities[p3 + 1] * dt;
      this.positions[p3 + 2] += this.velocities[p3 + 2] * dt;

      this.velocities[p3 + 0] *= 0.985;
      this.velocities[p3 + 2] *= 0.988;
      this.velocities[p3 + 1] += 0.25 * dt;

      if (this.positions[p3 + 2] < -10 || this.positions[p3 + 1] > 6) {
        this.life[i] = 0;
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;

    // Dimmer bubbles
    this.material.opacity = 0.12 + 0.45 * intensity;
    this.material.size = 0.14 + 0.22 * intensity;
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
    this.waypoints = Array.isArray(waypoints) ? waypoints : [];
    this.wpIndex = 0;

    // Stops / repair
    this.stopWaypointIdx = new Set();
    this.stopDuration = 6.0;
    this.stopTimer = 0;

    // Swim depth + bob
    this.baseY = this.waypoints?.[0]?.y ?? 0;
    this.bobT = Math.random() * 10;

    // Root
    this.group = new THREE.Group();
    this.group.position.copy(this.waypoints?.[0] || new THREE.Vector3());
    this.position = this.group.position;

    // Visual container
    this.visual = new THREE.Group();
    this.group.add(this.visual);

    // Bubble prop-wash effect
    this.bubbles = new BubbleEmitter(220);
    this.bubbles.points.position.copy(BUBBLE_LOCAL_OFFSET);
    this.visual.add(this.bubbles.points);

    // Prototype propeller reference (optional)
    this._protoProp = null;

    // Tag for raycasts / gameplay checks
    markRecursive(this.group, "isCrawler", true);

    scene.add(this.group);

    // temps (avoid per-frame allocations)
    this._tmpTo = new THREE.Vector3();
    this._tmpProposed = new THREE.Vector3();

    if (this.visualMode === "prototype") {
      this._buildPrototype();
    } else {
      this._loadRobot();
    }
  }

  _clearVisualKeepBubbles() {
    const bubble = this.bubbles ? this.bubbles.points : null;

    while (this.visual.children.length) {
      this.visual.remove(this.visual.children[0]);
    }

    if (bubble) {
      bubble.position.copy(BUBBLE_LOCAL_OFFSET);
      this.visual.add(bubble);
    }
  }

  _buildPrototype() {
    this._clearVisualKeepBubbles();

    const root = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x55656f, roughness: 0.9, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.95, metalness: 0.05 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.15,
      metalness: 0.0,
      emissive: 0x88ccff,
      emissiveIntensity: 0.35,
    });

    // Main body (forward is +Z)
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 5.2), bodyMat);
    body.position.set(0, 1.0, 0);
    root.add(body);

    // Top module
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 2.0), darkMat);
    top.position.set(0, 1.55, -0.2);
    root.add(top);

    // Front dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), darkMat);
    dome.position.set(0, 1.1, 2.5);
    root.add(dome);

    // “Eye” / sensor
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), glassMat);
    eye.position.set(0, 1.15, 3.0);
    root.add(eye);

    // Side “arms”
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.0), darkMat);
      arm.position.set(1.55 * s, 0.85, 0.2);
      root.add(arm);

      const claw = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), darkMat);
      claw.position.set(1.55 * s, 0.75, 1.25);
      root.add(claw);
    }

    // Propeller (back, along -Z)
    const propBase = new THREE.Group();
    propBase.position.set(0, 1.0, -2.8);
    root.add(propBase);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 12), darkMat);
    hub.rotation.x = Math.PI / 2;
    propBase.add(hub);

    const prop = new THREE.Group();
    propBase.add(prop);
    this._protoProp = prop;

    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.18), darkMat);
      blade.position.set(0.32, 0, 0);
      blade.rotation.z = (i * Math.PI * 2) / 3;
      prop.add(blade);
    }

    // Slight sink so it “sits” in water better
    root.position.y -= 0.15;

    markRecursive(root, "isCrawler", true);
    this.visual.add(root);

    // bubbles last (so they remain attached)
    if (this.bubbles) {
      this.bubbles.points.position.copy(BUBBLE_LOCAL_OFFSET);
      this.visual.add(this.bubbles.points);
    }
  }

  _loadRobot() {
    loadGLBScene("assets/robot.glb")
      .then(({ scene }) => {
        if (!scene) return;

        this._clearVisualKeepBubbles();

        scene.scale.setScalar(ROBOT_SCALE);
        scene.rotation.y += ROBOT_YAW_OFFSET;

        forceOpaqueMaterials(scene);

        markRecursive(scene, "isCrawler", true);
        this.visual.add(scene);

        if (this.bubbles) {
          this.bubbles.points.position.copy(BUBBLE_LOCAL_OFFSET);
          this.visual.add(this.bubbles.points);
        }
      })
      .catch((e) => {
        console.warn("robot.glb failed to load:", e);
        // fallback to prototype if GLB fails
        this.visualMode = "prototype";
        this._buildPrototype();
      });
  }

  repair(amount) {
    this.hp = Math.min(this.maxHP, this.hp + Math.max(0, amount || 0));
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - Math.max(0, amount || 0));
  }

  update(dt, obstacles) {
    if (!this.waypoints || this.waypoints.length < 2) return;

    if (this.state === "EXTRACTED") {
      if (this.bubbles) this.bubbles.setVisible(false);
      return;
    }

    // If we are at (or beyond) the last waypoint, stop cleanly
    if (this.wpIndex >= this.waypoints.length - 1) {
      this.state = "EXTRACTED";
      if (this.bubbles) this.bubbles.setVisible(false);
      return;
    }

    // Swim bob
    this.bobT += dt;
    const bob = 0.35 * Math.sin(this.bobT * 0.9);
    this.position.y = this.baseY + bob;

    // spin prototype prop (if present)
    if (this._protoProp) {
      const spin = (this.state === "MOVING") ? 16.0 : 0.0;
      this._protoProp.rotation.z += spin * dt;
    }

    // STOPPED_REPAIR
    if (this.state === "STOPPED_REPAIR") {
      this.stopTimer += dt;
      if (this.bubbles) this.bubbles.setVisible(false);

      if (this.stopTimer >= this.stopDuration) {
        this.state = "MOVING";
        this.stopTimer = 0;
      }
      return;
    }

    // Bubble intensity
    const intensity = (this.state === "MOVING") ? 1.0 : 0.0;
    if (this.bubbles) {
      this.bubbles.setVisible(intensity > 0);
      if (intensity > 0) this.bubbles.update(dt, intensity);
    }

    const next = this.waypoints[this.wpIndex + 1];
    if (!next) {
      this.state = "EXTRACTED";
      if (this.bubbles) this.bubbles.setVisible(false);
      return;
    }

    const d = this.position.distanceTo(next);

    if (d <= this.arriveDist) {
      this.wpIndex += 1;
      this.baseY = this.waypoints[this.wpIndex].y;

      if (this.stopWaypointIdx.has(this.wpIndex)) {
        this.state = "STOPPED_REPAIR";
        this.stopTimer = 0;
        if (this.bubbles) this.bubbles.setVisible(false);
        return;
      }

      if (this.wpIndex >= this.waypoints.length - 1) {
        this.state = "EXTRACTED";
        if (this.bubbles) this.bubbles.setVisible(false);
      }

      return;
    }

    this._seekToward(next, dt, obstacles);
  }

  _seekToward(target, dt, obstacles) {
    const to = this._tmpTo.subVectors(target, this.position);
    to.y = 0;

    const dist = to.length();
    if (dist < 1e-6) return;

    to.multiplyScalar(1 / dist);

    const proposed = this._tmpProposed.copy(this.position).addScaledVector(
      to,
      this.speed * dt
    );

    resolveSphereCollisions(proposed, this.collisionRadius, obstacles);

    this.position.x = proposed.x;
    this.position.z = proposed.z;

    // Movement yaw assumes “forward” is +Z
    const desiredYaw = Math.atan2(to.x, to.z);
    this.group.rotation.y = lerpAngle(
      this.group.rotation.y,
      desiredYaw,
      Math.min(1, this.turnSpeed * dt)
    );
  }
}