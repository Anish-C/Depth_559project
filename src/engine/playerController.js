import * as THREE from "three";

export const Tool = Object.freeze({
  HARPOON: "HARPOON",
  REPAIR: "REPAIR",
});

/**
 * FPS player controller:
 * - pointer-lock mouse look
 * - WASD movement, Space up, Ctrl down
 * - Shift sprint (simple stamina)
 * - collision against world colliders (boxes + spheres)
 *
 * This controller is also the "player contract" for sharks/tools:
 * - camera is authoritative POV
 * - getTargetPosition(out) returns an invisible center point sharks should chase
 */
export class PlayerController {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;

    this.camera.rotation.order = "YXZ";
    this.yaw = 0;
    this.pitch = 0;

    // Position represents the player's POV position
    this.pos = new THREE.Vector3(0, 1.8, 8);

    // Player body extents for collision (AABB)
    this.halfExtents = new THREE.Vector3(0.45, 0.9, 0.45); // width ~0.9, height ~1.8

    // Movement tuning
    this.baseSpeed = 7.4;
    this.sprintSpeed = 11.0;
    this.verticalSpeed = 6.5;
    this.drag = 7.0;

    this.vel = new THREE.Vector3();

    // Stamina (simple)
    this.staminaMax = 4.5;
    this.stamina = this.staminaMax;
    this.staminaDrain = 1.25;
    this.staminaRegen = 0.95;

    // Tool state
    this.tool = Tool.HARPOON;
  }

  setPosition(x, y, z) {
    this.pos.set(x, y, z);
    this._apply();
  }

  setTool(tool) {
    this.tool = tool;
  }

  /**
   * A stable "invisible target" point sharks should chase.
   */
  getTargetPosition(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y - this.halfExtents.y * 0.2, this.pos.z);
  }

  _apply() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  update(dt, obstacles = [], lockAim = false) {
    // Tool switching
    if (this.input.down("Digit1")) this.tool = Tool.HARPOON;
    if (this.input.down("Digit2")) this.tool = Tool.REPAIR;
    

    // Mouse look
    if (!lockAim) {
      const { dx, dy } = this.input.consumeMouseDelta();
      const sens = 0.0024;
      this.yaw -= dx * sens;
      this.pitch -= dy * sens;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    } else {
      // still consume so it doesn't pile up
      this.input.consumeMouseDelta();
    }

    // Movement input
    const fwd = (this.input.down("KeyW") ? 1 : 0) + (this.input.down("KeyS") ? -1 : 0);
    const str = (this.input.down("KeyD") ? 1 : 0) + (this.input.down("KeyA") ? -1 : 0);

    // Sprint
    const wantsSprint = this.input.down("ShiftLeft") || this.input.down("ShiftRight");
    const canSprint = wantsSprint && this.stamina > 0.12 && fwd > 0; // sprint only when moving forward
    const speed = canSprint ? this.sprintSpeed : this.baseSpeed;

    if (canSprint) this.stamina = Math.max(0, this.stamina - this.staminaDrain * dt);
    else this.stamina = Math.min(this.staminaMax, this.stamina + this.staminaRegen * dt);

    // Direction relative to yaw (camera heading)
    // Basis from camera: forward and right (robust, even when looking straight up/down)
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    const rightDir = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    if (rightDir.lengthSq() < 1e-6) rightDir.set(1, 0, 0);
    rightDir.normalize();
    

    const wish = new THREE.Vector3();
    // Move fully relative to camera POV (including vertical pitch)
    wish.addScaledVector(forward, fwd);
    wish.addScaledVector(rightDir, str);
    if (wish.lengthSq() > 1e-6) wish.normalize();

    // Integrate velocity (underwater feel)
    const accel = 18.0;
    this.vel.x += wish.x * accel * dt * speed;
    this.vel.z += wish.z * accel * dt * speed;
    this.vel.y += wish.y * accel * dt * speed;

    // Drag
    const drag = Math.exp(-this.drag * dt);
    this.vel.multiplyScalar(drag);

    // Proposed move
    const next = this.pos.clone().addScaledVector(this.vel, dt);

    // Resolve collisions
    this._resolveCollisions(next, obstacles);

    this.pos.copy(next);
    this._apply();
  }

  _resolveCollisions(pos, obstacles) {
    if (!Array.isArray(obstacles) || obstacles.length === 0) return;

    // player AABB in world space
    const playerMin = new THREE.Vector3(
      pos.x - this.halfExtents.x,
      pos.y - this.halfExtents.y,
      pos.z - this.halfExtents.z
    );
    const playerMax = new THREE.Vector3(
      pos.x + this.halfExtents.x,
      pos.y + this.halfExtents.y,
      pos.z + this.halfExtents.z
    );
    const playerBox = new THREE.Box3(playerMin, playerMax);

    for (const ob of obstacles) {
      if (!ob) continue;

      // Box collider
      if (ob.type === "box" && ob.box) {
        if (!playerBox.intersectsBox(ob.box)) continue;

        const oMin = ob.box.min;
        const oMax = ob.box.max;

        const overlapX = Math.min(playerMax.x, oMax.x) - Math.max(playerMin.x, oMin.x);
        const overlapY = Math.min(playerMax.y, oMax.y) - Math.max(playerMin.y, oMin.y);
        const overlapZ = Math.min(playerMax.z, oMax.z) - Math.max(playerMin.z, oMin.z);

        if (overlapX <= overlapY && overlapX <= overlapZ) {
          if (pos.x < (oMin.x + oMax.x) * 0.5) pos.x -= (overlapX + 1e-3);
          else pos.x += (overlapX + 1e-3);
          this.vel.x = 0;
        } else if (overlapY <= overlapX && overlapY <= overlapZ) {
          if (pos.y < (oMin.y + oMax.y) * 0.5) pos.y -= (overlapY + 1e-3);
          else pos.y += (overlapY + 1e-3);
          this.vel.y = 0;
        } else {
          if (pos.z < (oMin.z + oMax.z) * 0.5) pos.z -= (overlapZ + 1e-3);
          else pos.z += (overlapZ + 1e-3);
          this.vel.z = 0;
        }

        playerMin.set(pos.x - this.halfExtents.x, pos.y - this.halfExtents.y, pos.z - this.halfExtents.z);
        playerMax.set(pos.x + this.halfExtents.x, pos.y + this.halfExtents.y, pos.z + this.halfExtents.z);
        playerBox.min.copy(playerMin);
        playerBox.max.copy(playerMax);
        continue;
      }

      // Sphere collider (supports old format {center, radius})
      const center = ob.center;
      const radius = ob.radius;
      if (center && typeof radius === "number") {
        const cx = clamp(center.x, playerMin.x, playerMax.x);
        const cy = clamp(center.y, playerMin.y, playerMax.y);
        const cz = clamp(center.z, playerMin.z, playerMax.z);

        const dx = cx - center.x;
        const dy = cy - center.y;
        const dz = cz - center.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(Math.max(distSq, 1e-8));
          const push = (radius - dist) + 1e-3;
          const nx = (dist > 1e-6) ? (dx / dist) : 1;
          const ny = (dist > 1e-6) ? (dy / dist) : 0;
          const nz = (dist > 1e-6) ? (dz / dist) : 0;

          pos.x += nx * push;
          pos.y += ny * push;
          pos.z += nz * push;

          const vDot = this.vel.x * nx + this.vel.y * ny + this.vel.z * nz;
          if (vDot > 0) {
            this.vel.x -= vDot * nx;
            this.vel.y -= vDot * ny;
            this.vel.z -= vDot * nz;
          }

          playerMin.set(pos.x - this.halfExtents.x, pos.y - this.halfExtents.y, pos.z - this.halfExtents.z);
          playerMax.set(pos.x + this.halfExtents.x, pos.y + this.halfExtents.y, pos.z + this.halfExtents.z);
          playerBox.min.copy(playerMin);
          playerBox.max.copy(playerMax);
        }
      }
    }
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}