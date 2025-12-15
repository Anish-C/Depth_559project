import * as THREE from "three";
import { loadGLBScene } from "../engine/assets.js";

export class Anglerfish {
  constructor(scene, world, { visualMode = "full", spawnNear = null } = {}) {
    this.scene = scene;
    this.world = world;
    this.visualMode = visualMode;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.bulbLight = new THREE.PointLight(0xfff3a1, 1.6, 28, 1.0);
    this.bulbLight.castShadow = false;
    this.group.add(this.bulbLight);

    this.speed = 1.2; // slow meander
    this.turnRate = 0.6; // radians/sec for heading changes
    this.targetHeading = new THREE.Vector3(1, 0, 0);
    this.currentHeading = new THREE.Vector3(1, 0, 0);
    this.nextRetargetAt = 0;

    this.bounds = { x: 300, z: 300 };

    // Choose spawn: near provided point or random in bounds
    let startX, startY, startZ;
    if (spawnNear && typeof spawnNear.x === "number") {
      startX = spawnNear.x;
      startZ = spawnNear.z;
      const floorY = (typeof world.getSeafloorY === "function")
        ? world.getSeafloorY(startX, startZ)
        : -18.5;
      // Spawn slightly above seafloor and a bit offset forward if available
      startY = Math.max(spawnNear.y ?? (floorY + 3.0), floorY + 3.0);
    } else {
      startX = (Math.random() - 0.5) * this.bounds.x * 2;
      startZ = (Math.random() - 0.5) * this.bounds.z * 2;
      const floorY = (typeof world.getSeafloorY === "function")
        ? world.getSeafloorY(startX, startZ)
        : -18.5;
      startY = floorY + 4.0;
    }
    this.group.position.set(startX, startY, startZ);

    if (visualMode === "full") {
      this._loadModel();
    } else {
      this._createPlaceholder();
    }
  }

  async _loadModel() {
    try {
      // Use Outer Wilds angler fish GLTF as the full-mode skin
      const { scene: fishScene } = await loadGLBScene("src/entities/outer_wilds__angler_fish/scene.gltf");
      // scale and add
      // Half the previous size
      fishScene.scale.setScalar(0.06);
      this.group.add(fishScene);
      // Place bulb light slightly forward and above mouth
      this.bulbLight.position.set(0.6, 0.25, 0.4);
    } catch (e) {
      // fallback
      this._createPlaceholder();
    }
  }

  _createPlaceholder() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a4a50, roughness: 0.9, metalness: 0.0 });
    const geo = new THREE.SphereGeometry(1.2, 18, 14);
    const m = new THREE.Mesh(geo, mat);
    this.group.add(m);
    this.bulbLight.position.set(0.8, 0.3, 0.6);
  }

  update(dt, nowS) {
    // Retarget heading every few seconds
    if (nowS >= this.nextRetargetAt) {
      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.5) * 0.25; // small vertical wandering
      this.targetHeading.set(Math.cos(angle), elev, Math.sin(angle)).normalize();
      this.nextRetargetAt = nowS + (2.5 + Math.random() * 3.5);
    }

    // Smoothly steer towards targetHeading
    this.currentHeading.lerp(this.targetHeading, Math.min(1, this.turnRate * dt)).normalize();

    // Integrate position
    const pos = this.group.position;
    pos.addScaledVector(this.currentHeading, this.speed * dt);

    // Keep within loose bounds
    if (pos.x > this.bounds.x) { pos.x = this.bounds.x; this.targetHeading.x *= -1; }
    if (pos.x < -this.bounds.x) { pos.x = -this.bounds.x; this.targetHeading.x *= -1; }
    if (pos.z > this.bounds.z) { pos.z = this.bounds.z; this.targetHeading.z *= -1; }
    if (pos.z < -this.bounds.z) { pos.z = -this.bounds.z; this.targetHeading.z *= -1; }

    // Keep above seafloor
    if (typeof this.world.getSeafloorY === "function") {
      const floorY = this.world.getSeafloorY(pos.x, pos.z);
      const minY = floorY + 2.5;
      if (pos.y < minY) pos.y = minY;
    }

    // Face movement direction
    const dir = this.currentHeading;
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
    this.group.rotation.set(pitch, yaw, 0);
  }
}