import * as THREE from "../../libs/cs559-three/build/three.module.js";

export const Tool = Object.freeze({
  HARPOON: "HARPOON",
  REPAIR: "REPAIR",
});

export class PlayerController {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;

    this.camera.rotation.order = "YXZ";
    this.yaw = 0;
    this.pitch = 0;

    this.pos = new THREE.Vector3(0, 1.8, 0);

    this.speed = 7.5;
    this.ascendSpeed = 7.5;
    this.mouseSensitivity = 0.0025;
    this.pitchLimit = Math.PI / 2 - 0.05;

    this.radius = 1.1;

    this.minY = -7.0;
    this.maxY = 26.0;

    this.tool = Tool.HARPOON;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._down = new THREE.Vector3(0, -1, 0);
  }

  setPosition(x, y, z) {
    this.pos.set(x, y, z);
    this._apply();
  }

  setTool(tool) {
    this.tool = tool;
  }

  _apply() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  update(dt, obstacles, lockAim) {
    if (this.input.down("Digit1")) this.tool = Tool.HARPOON;
    if (this.input.down("Digit2")) this.tool = Tool.REPAIR;

    const { dx, dy } = this.input.consumeMouseDelta();
    if (this.input.isPointerLocked && !lockAim) {
      this.yaw -= dx * this.mouseSensitivity;
      this.pitch -= dy * this.mouseSensitivity;
      this.pitch = Math.max(-this.pitchLimit, Math.min(this.pitchLimit, this.pitch));
    }

    this._forward.set(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ")).normalize();
    this._right.set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).normalize();

    this._wish.set(0, 0, 0);
    if (this.input.down("KeyW")) this._wish.add(this._forward);
    if (this.input.down("KeyS")) this._wish.sub(this._forward);
    if (this.input.down("KeyD")) this._wish.add(this._right);
    if (this.input.down("KeyA")) this._wish.sub(this._right);

    if (this.input.down("Space")) this._wish.add(this._up);
    if (this.input.down("ShiftLeft")) this._wish.add(this._down);

    if (this._wish.lengthSq() > 0) {
      this._wish.normalize();
      const base = lockAim ? this.speed * 0.55 : this.speed;
      const spd = (this.input.down("Space") || this.input.down("ShiftLeft")) ? Math.max(base, this.ascendSpeed) : base;
      this.pos.addScaledVector(this._wish, spd * dt);
    }

    this.pos.y = Math.max(this.minY, Math.min(this.maxY, this.pos.y));

    if (obstacles) resolveSphereCollisions(this.pos, this.radius, obstacles);

    this._apply();
  }
}

function resolveSphereCollisions(pos, radius, obstacles) {
    if (!Array.isArray(obstacles)) {
      return;
    }
  
    for (const ob of obstacles) {
      if (!ob) {
        continue;
      }

      let center = ob.center;
  
      if (!center) {
        center = ob.position;
      }
  
      // If someone accidentally passed a raw Vector3-like
      if (!center && typeof ob.x === "number" && typeof ob.y === "number" && typeof ob.z === "number") {
        center = ob;
      }
  
      if (!center) {
        continue;
      }
  
      if (typeof center.x !== "number" || typeof center.y !== "number" || typeof center.z !== "number") {
        continue;
      }
  
      if (typeof ob.radius !== "number") {
        continue;
      }
  
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      const dz = pos.z - center.z;
  
      const r = radius + ob.radius;
      const d2 = dx * dx + dy * dy + dz * dz;
  
      if (d2 >= r * r) {
        continue;
      }
  
      const d = Math.sqrt(Math.max(d2, 1e-8));
      const overlap = r - d;
  
      pos.x += (dx / d) * overlap;
      pos.y += (dy / d) * overlap;
      pos.z += (dz / d) * overlap;
    }
  }
  