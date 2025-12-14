import * as THREE from "../../libs/cs559-three/build/three.module.js";

const _up = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, lo, hi) {
  if (v < lo) {
    return lo;
  }
  if (v > hi) {
    return hi;
  }
  return v;
}

function markUserDataRecursive(obj, shark) {
  if (!obj) {
    return;
  }

  obj.userData.shark = shark;

  for (const c of obj.children) {
    markUserDataRecursive(c, shark);
  }
}

function pickClip(clips, hints) {
  let list = [];
  if (Array.isArray(hints)) {
    list = hints;
  } else {
    list = [hints];
  }

  for (const h of list) {
    const hh = String(h || "").toLowerCase();
    if (!hh) {
      continue;
    }

    for (const c of clips || []) {
      const name = String(c.name || "").toLowerCase();
      if (name === hh) {
        return c;
      }
    }

    for (const c of clips || []) {
      const name = String(c.name || "").toLowerCase();
      if (name.includes(hh)) {
        return c;
      }
    }
  }

  return null;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function faceTowardYawDir(group, dir, dt, turnRate) {
  const yaw = Math.atan2(dir.x, dir.z);
  group.rotation.y = lerpAngle(group.rotation.y, yaw, Math.min(1, dt * turnRate));
}

function resolveSphereCollisions(pos, radius, obstacles, yScale) {
  if (!Array.isArray(obstacles)) {
    return;
  }

  let ys = 1.0;
  if (typeof yScale === "number") {
    ys = yScale;
  }

  for (const ob of obstacles) {
    if (!ob) {
      continue;
    }
    if (!ob.center) {
      continue;
    }

    const dx = pos.x - ob.center.x;
    const dy = (pos.y - ob.center.y) * ys;
    const dz = pos.z - ob.center.z;

    const r = radius + ob.radius;
    const d2 = dx * dx + dy * dy + dz * dz;

    if (d2 >= r * r) {
      continue;
    }

    const d = Math.sqrt(Math.max(d2, 1e-8));
    let overlap = r - d;

    // Cap correction so we don't get "teleport" pops if dt spikes or we spawn inside something.
    if (overlap > 1.25) overlap = 1.25;

    pos.x += (dx / d) * overlap;
    pos.y += ((dy / d) * overlap) / ys;
    pos.z += (dz / d) * overlap;
  }
}

function pointNearSegment(p, a, b, maxDist) {
  _v1.subVectors(b, a);
  const len2 = _v1.lengthSq();
  if (len2 < 1e-8) {
    return false;
  }

  _v2.subVectors(p, a);
  let t = _v2.dot(_v1) / len2;

  if (t < 0) {
    t = 0;
  }
  if (t > 1) {
    t = 1;
  }

  const proj = _v1.multiplyScalar(t).add(a);

  const dx = p.x - proj.x;
  const dy = p.y - proj.y;
  const dz = p.z - proj.z;

  return dx * dx + dy * dy + dz * dz <= maxDist * maxDist;
}

function applyMaterialFixes(root) {
  root.traverse((o) => {
    if (!o.isMesh) {
      return;
    }

    let mats = [o.material];

    if (Array.isArray(o.material)) {
      mats = o.material;
    }

    for (const m of mats) {
      if (!m) {
        continue;
      }

      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.needsUpdate = true;
      }

      if ("metalness" in m) {
        m.metalness = 0.0;
      }

      if ("roughness" in m) {
        let r = 0.85;
        if (typeof m.roughness === "number") {
          r = m.roughness;
        }
        if (r < 0.85) {
          r = 0.85;
        }
        m.roughness = r;
      }

      if ("envMapIntensity" in m) {
        m.envMapIntensity = 0.0;
      }
      if ("emissiveIntensity" in m) {
        m.emissiveIntensity = 0.0;
      }

      if (m.color) {
        const avg = (m.color.r + m.color.g + m.color.b) / 3;
        if (avg > 0.92) {
          m.color.multiplyScalar(0.65);
        }
      }

      m.needsUpdate = true;
    }

    o.castShadow = false;
    o.receiveShadow = false;
  });
}

function forceSharkGrey(root) {
  const greyMat = new THREE.MeshStandardMaterial({
    color: "#55595C",
    roughness: 0.95,
    metalness: 0.0,
  });

  root.traverse((o) => {
    if (!o.isMesh) {
      return;
    }

    o.material = greyMat;
    o.castShadow = false;
    o.receiveShadow = false;
  });
}

function makePrototypeShark(type, tuning) {
  const g = new THREE.Group();

  let color = 0x3b4a52;
  if (tuning && tuning.prototypeColor) {
    color = tuning.prototypeColor;
  }

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0.0,
  });

  let bodyLen = 4.0;
  let bodyRad = 0.62;

  if (type === "STALKER") {
    bodyLen = 4.6;
    bodyRad = 0.72;
  }

  if (type === "BRUISER") {
    bodyLen = 5.2;
    bodyRad = 0.85;
  }

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRad, bodyRad * 0.9, bodyLen, 14, 1),
    mat
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(bodyRad * 0.85, bodyLen * 0.35, 14, 1),
    mat
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.z = bodyLen * 0.5;
  g.add(nose);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(bodyRad * 0.7, bodyLen * 0.6, 14, 1),
    mat
  );
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -bodyLen * 0.55;
  g.add(tail);

  const fin = new THREE.Mesh(
    new THREE.ConeGeometry(bodyRad * 0.5, bodyLen * 0.35, 12, 1),
    mat
  );
  fin.position.y = bodyRad * 0.9;
  fin.position.z = bodyLen * 0.05;
  fin.rotation.z = Math.PI;
  g.add(fin);

  return g;
}

/**
 * Real diagonal movement every frame:
 * - XZ steering toward the target
 * - Y uses a controller (dy * verticalGain), clamped by maxDiveSpeed
 * - optional facePos lets sharks look at crawler even while tailing
 *
 * opts:
 * - slowRadius
 * - minSpeedScale
 */
function moveSteer3D(shark, targetPos, facePos, speed, dt, obstacles, turnRate, opts) {
  const pos = shark.position;

  const dx = targetPos.x - pos.x;
  const dz = targetPos.z - pos.z;

  const horizDist = Math.sqrt(dx * dx + dz * dz);

  let dirX = 0;
  let dirZ = 1;

  if (horizDist > 1e-6) {
    dirX = dx / horizDist;
    dirZ = dz / horizDist;
  } else {
    dirX = Math.sin(shark.group.rotation.y);
    dirZ = Math.cos(shark.group.rotation.y);

    const d2 = dirX * dirX + dirZ * dirZ;
    if (d2 < 1e-6) {
      dirX = 0;
      dirZ = 1;
    } else {
      const inv = 1 / Math.sqrt(d2);
      dirX *= inv;
      dirZ *= inv;
    }
  }

  let slowRadius = 9.0;
  if (typeof shark.slowRadius === "number") {
    slowRadius = shark.slowRadius;
  }
  if (opts && typeof opts.slowRadius === "number") {
    slowRadius = opts.slowRadius;
  }

  let minSpeedScale = 0.18;
  if (opts && typeof opts.minSpeedScale === "number") {
    minSpeedScale = opts.minSpeedScale;
  }

  let speedScale = 1.0;
  if (horizDist < slowRadius) {
    speedScale = horizDist / Math.max(0.001, slowRadius);
    speedScale = clamp(speedScale, minSpeedScale, 1.0);
  }

  const desiredVel = _v2.set(
    dirX * speed * speedScale,
    0,
    dirZ * speed * speedScale
  );

  const dy = targetPos.y - pos.y;

  let verticalGain = 2.8;
  if (typeof shark.verticalGain === "number") {
    verticalGain = shark.verticalGain;
  }

  let maxDive = 7.5;
  if (typeof shark.maxDiveSpeed === "number") {
    maxDive = shark.maxDiveSpeed;
  }

  desiredVel.y = clamp(dy * verticalGain, -maxDive, maxDive);

  let accel = 7.5;
  if (typeof shark.accel === "number") {
    accel = shark.accel;
  }

  const t = 1 - Math.exp(-dt * accel);
  shark._vel.lerp(desiredVel, t);

  const proposed = pos.clone().addScaledVector(shark._vel, dt);

  let yScale = 0.18;
  if (typeof shark.collisionVerticalScale === "number") {
    yScale = shark.collisionVerticalScale;
  }

  resolveSphereCollisions(proposed, shark.hitRadius, obstacles, yScale);

  proposed.y = clamp(proposed.y, shark.minY, shark.maxY);
  pos.copy(proposed);

  if (facePos) {
    _v1.subVectors(facePos, pos);
    _v1.y = 0;
    if (_v1.lengthSq() > 1e-8) {
      _v1.normalize();
      faceTowardYawDir(shark.group, _v1, dt, turnRate);
      return;
    }
  }

  _v1.set(dirX, 0, dirZ);
  faceTowardYawDir(shark.group, _v1, dt, turnRate);
}

export {
  randRange,
  clamp,
  markUserDataRecursive,
  pickClip,
  faceTowardYawDir,
  resolveSphereCollisions,
  pointNearSegment,
  applyMaterialFixes,
  makePrototypeShark,
  moveSteer3D,
  forceSharkGrey
};