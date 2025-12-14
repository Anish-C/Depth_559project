import * as THREE from "../../libs/cs559-three/build/three.module.js";
import { Shark } from "../entities/shark.js";

export const SHARK_DIFFICULTY_DEFAULTS = Object.freeze({
  maxActiveSharks: 3,

  spawnMinDist: 86,
  spawnMaxDist: 128,
  spawnLateralJitter: 34,
  spawnForwardJitter: 34,
  spawnDepthJitter: 8,

  laneAnchorForward: 2.5,

  initialSpawnDelay: 6.0,
  initialWaveCount: 2,

  waveProgressThresholds: [0.1, 0.28, 0.5, 0.7],
  waveCounts: [2, 2, 3, 3],
  waveStaggerSeconds: 3.05,
  waveJitterSeconds: 0.35,

  minSpawnGapSeconds: 1.45,

  ambushOnRepair: true,
  ambushTimes: [0.0, 2.1, 4.2],
});

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function pickApproach() {
  const r = Math.random();
  if (r < 0.35) return "HEAD_ON";
  if (r < 0.55) return "FLANK_L";
  if (r < 0.75) return "FLANK_R";
  return "REAR_CHASE";
}

function pickTypeFromThreat(threat) {
  const r = Math.random();
  if (threat < 4) return r < 0.9 ? "SCOUT" : "STALKER";
  if (threat < 8) return r < 0.6 ? "SCOUT" : "STALKER";
  if (threat < 13) {
    if (r < 0.3) return "SCOUT";
    if (r < 0.8) return "STALKER";
    return "BRUISER";
  }
  if (r < 0.2) return "SCOUT";
  if (r < 0.6) return "STALKER";
  return "BRUISER";
}

function getCrawlerForward(crawler) {
  const wps = crawler?.waypoints;
  if (wps && wps.length >= 2) {
    let i = typeof crawler.wpIndex === "number" ? crawler.wpIndex : 0;
    i = Math.min(i, wps.length - 2);

    const a = wps[i];
    const b = wps[i + 1];
    if (a && b) {
      const d = new THREE.Vector3().subVectors(b, a);
      d.y = 0;
      if (d.lengthSq() > 1e-6) return d.normalize();
    }
  }
  return new THREE.Vector3(0, 0, 1);
}

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();

function getCrawlerProgress01(crawler) {
  const wps = crawler?.waypoints;
  if (!wps || wps.length < 2) return 0;

  const nSeg = wps.length - 1;
  const i0 = clamp(typeof crawler.wpIndex === "number" ? crawler.wpIndex : 0, 0, nSeg - 1);

  const a = wps[i0];
  const b = wps[i0 + 1];
  if (!a || !b) return clamp(i0 / nSeg, 0, 1);

  _tmpA.subVectors(b, a);
  const segLen = _tmpA.length();
  if (segLen < 1e-6) return clamp(i0 / nSeg, 0, 1);

  _tmpA.multiplyScalar(1 / segLen);
  _tmpB.subVectors(crawler.position, a);
  const t = clamp(_tmpB.dot(_tmpA) / segLen, 0, 1);

  return clamp((i0 + t) / nSeg, 0, 1);
}

export class SharkManager {
  constructor(scene, tuning = {}) {
    this.scene = scene;
    this.tuning = { ...SHARK_DIFFICULTY_DEFAULTS, ...tuning };

    this.sharks = [];
    this.spawnQueue = [];
    this.threatLevel = 0;

    this._triggered = new Array(this.tuning.waveProgressThresholds.length).fill(false);
    this._prevCrawlerState = null;

    this._startTime = null;
    this._initialWaveQueued = false;
    this._lastSpawnAt = -1e9;

    this.sharkTuning = {
      assetUrl: "assets/shark2.glb",
      modelScale: 0.85,
      modelYawOffset: Math.PI,

      minY: -8.2,
      maxY: 28.0,
      accel: 8.5,
      maxDiveSpeed: 8.0,
      collisionVerticalScale: 0.18,

      reengageFromCooldown: true,
      evadeSecondsMin: 5.0,
      evadeSecondsMax: 10.0,
      cooldownSecondsMin: 5.0,
      cooldownSecondsMax: 10.0,
    };
  }

  // Used by your raycasting / hit detection
  getRaycastTargets() {
    return this.sharks.map((s) => s.group);
  }

  // 🔧 RESTORED: used by other code to treat sharks as obstacles
  getObstacleSpheres() {
    const out = [];
    for (const s of this.sharks) {
      if (!s || s.removable) continue;
      if (s.state === "DEAD" || s.hp <= 0) continue;

      // a bit bigger than hitRadius so bodies don't visually overlap
      const r = typeof s.hitRadius === "number" ? Math.max(2.2, s.hitRadius * 1.7) : 2.2;
      out.push({ center: s.position, radius: r });
    }
    return out;
  }

  enqueueSpawn(t, { forcedRole = null, forcedApproach = null, crawler = null } = {}) {
    this.spawnQueue.push({ t, forcedRole, forcedApproach, crawler });
    this.spawnQueue.sort((a, b) => a.t - b.t);
  }

  enqueueWave(nowS, count, crawler) {
    const stagger = this.tuning.waveStaggerSeconds || 0;
    const jitter = this.tuning.waveJitterSeconds || 0;

    for (let i = 0; i < count; i++) {
      const t = nowS + i * stagger + (Math.random() * 2 - 1) * jitter;
      this.enqueueSpawn(t, { crawler });
    }
  }

  processSpawnQueue(nowS) {
    if (this.spawnQueue.length === 0) return;
    if (this.sharks.length >= this.tuning.maxActiveSharks) return;

    const minGap =
      typeof this.tuning.minSpawnGapSeconds === "number" ? this.tuning.minSpawnGapSeconds : 0;
    if (nowS - this._lastSpawnAt < minGap) return;

    if (this.spawnQueue[0].t > nowS) return;

    const item = this.spawnQueue.shift();
    this.spawnOne(item.crawler, item.forcedRole, item.forcedApproach);
    this._lastSpawnAt = nowS;
  }

  update(
    dt,
    nowS,
    { playerPos, playerPosition, playerHitRadius, damagePlayer, crawler, obstaclesRocks, obstaclesAll } = {}
  ) {
    dt = Math.min(dt, 0.05);

    if (!crawler) return;

    const resolvedPlayerPos = playerPos || playerPosition;
    if (!resolvedPlayerPos) return;

    if (this._startTime === null) this._startTime = nowS;

    // cleanup dead sharks
    for (let i = this.sharks.length - 1; i >= 0; i--) {
      const s = this.sharks[i];
      if (s && s.removable) {
        this.scene.remove(s.group);
        this.sharks.splice(i, 1);
        this.threatLevel += 1;
      }
    }

    // initial wave
    if (!this._initialWaveQueued && nowS - this._startTime >= this.tuning.initialSpawnDelay) {
      this._initialWaveQueued = true;
      this.enqueueWave(nowS, this.tuning.initialWaveCount, crawler);
    }

    // progress-based waves
    const prog = getCrawlerProgress01(crawler);
    for (let i = 0; i < this.tuning.waveProgressThresholds.length; i++) {
      if (this._triggered[i]) continue;
      if (prog < this.tuning.waveProgressThresholds[i]) continue;

      this._triggered[i] = true;
      const count = typeof this.tuning.waveCounts?.[i] === "number" ? this.tuning.waveCounts[i] : 2;
      this.enqueueWave(nowS, count, crawler);
    }

    // repair ambush
    if (this._prevCrawlerState !== null && this.tuning.ambushOnRepair) {
      if (this._prevCrawlerState !== "STOPPED_REPAIR" && crawler.state === "STOPPED_REPAIR") {
        const times = Array.isArray(this.tuning.ambushTimes)
          ? this.tuning.ambushTimes
          : [0.0, 2.1, 4.2];

        this.enqueueSpawn(nowS + (times[0] ?? 0.0), {
          forcedApproach: "FLANK_L",
          forcedRole: "HUNTER",
          crawler,
        });
        this.enqueueSpawn(nowS + (times[1] ?? 2.1), {
          forcedApproach: "REAR_CHASE",
          forcedRole: "DUELIST",
          crawler,
        });
        this.enqueueSpawn(nowS + (times[2] ?? 4.2), {
          forcedApproach: "HEAD_ON",
          forcedRole: "HUNTER",
          crawler,
        });
      }
    }
    this._prevCrawlerState = crawler.state;

    // spawn if time
    this.processSpawnQueue(nowS);

    // shared context
    const crawlerPos = crawler.position.clone();
    const forward = getCrawlerForward(crawler);

    const crawlerSpeed =
      crawler.state === "STOPPED_REPAIR" ? 0 : typeof crawler.speed === "number" ? crawler.speed : 0;
    const crawlerVel = forward.clone().multiplyScalar(crawlerSpeed);

    const laneAnchor = crawlerPos.clone().addScaledVector(forward, this.tuning.laneAnchorForward || 2.5);

    const crawlerCollisionRadius =
      typeof crawler.collisionRadius === "number"
        ? crawler.collisionRadius
        : typeof crawler.radius === "number"
        ? crawler.radius
        : 2.6;

    // Update sharks (keep obstacles from your world; shark-shark is handled by separation below)
    for (const s of this.sharks) {
      s.update(dt, {
        nowS,
        playerPos: resolvedPlayerPos,
        crawlerPos,
        crawlerVel,
        playerHitRadius,
        crawlerCollisionRadius,
        getForward: () => forward,
        getLaneAnchor: () => laneAnchor,
        damagePlayer,
        damageCrawler: (amt) => {
          if (crawler.takeDamage) crawler.takeDamage(amt);
        },
        obstaclesRocks,
        obstaclesAll,
      });
    }

    // Prevent sharks from phasing through each other (smooth, capped XZ push)
    this._applySharkSeparation(dt);
  }

  _applySharkSeparation(dt) {
    const sharks = this.sharks;
    if (!sharks || sharks.length < 2) return;

    const maxStep = 5.0 * dt;

    for (let i = 0; i < sharks.length; i++) {
      const a = sharks[i];
      if (!a || a.removable || a.state === "DEAD" || a.hp <= 0) continue;

      for (let j = i + 1; j < sharks.length; j++) {
        const b = sharks[j];
        if (!b || b.removable || b.state === "DEAD" || b.hp <= 0) continue;

        let dx = a.position.x - b.position.x;
        let dz = a.position.z - b.position.z;

        let d2 = dx * dx + dz * dz;
        if (d2 < 1e-10) {
          dx = 1.0;
          dz = 0.0;
          d2 = 1.0;
        }

        const d = Math.sqrt(d2);

        const ra = typeof a.hitRadius === "number" ? a.hitRadius : 1.2;
        const rb = typeof b.hitRadius === "number" ? b.hitRadius : 1.2;
        const minDist = (ra + rb) * 2.2;

        if (d >= minDist) continue;

        const overlap = minDist - d;
        const strikeFactor = (a.state === "STRIKE" || b.state === "STRIKE") ? 0.35 : 1.0;
        const push = Math.min(overlap * 0.5, maxStep) * strikeFactor;

        const nx = dx / d;
        const nz = dz / d;

        a.position.x += nx * push;
        a.position.z += nz * push;

        b.position.x -= nx * push;
        b.position.z -= nz * push;

        a.position.y = clamp(a.position.y, a.minY, a.maxY);
        b.position.y = clamp(b.position.y, b.minY, b.maxY);
      }
    }
  }

  spawnOne(crawler, forcedRole, forcedApproach) {
    if (!crawler) return;
    if (this.sharks.length >= this.tuning.maxActiveSharks) return;

    const role = forcedRole ?? (Math.random() < 0.65 ? "HUNTER" : "DUELIST");
    const approach = forcedApproach ?? pickApproach();
    const type = pickTypeFromThreat(this.threatLevel);

    const forward = getCrawlerForward(crawler);
    const right = _tmpA.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const crawlerPos = crawler.position.clone();

    const dist =
      this.tuning.spawnMinDist +
      Math.random() * (this.tuning.spawnMaxDist - this.tuning.spawnMinDist);

    const lateral = (Math.random() * 2 - 1) * this.tuning.spawnLateralJitter;
    const fJit = (Math.random() * 2 - 1) * this.tuning.spawnForwardJitter;
    const dJit = (Math.random() * 2 - 1) * this.tuning.spawnDepthJitter;

    let baseDir = forward.clone();
    if (approach === "REAR_CHASE") baseDir.negate();
    if (approach === "FLANK_L") baseDir.copy(right).negate();
    if (approach === "FLANK_R") baseDir.copy(right);

    const spawnPos = crawlerPos
      .clone()
      .addScaledVector(baseDir, dist)
      .addScaledVector(right, lateral)
      .addScaledVector(forward, fJit);

    spawnPos.y += dJit;

    const minY = this.sharkTuning.minY ?? -8.0;
    spawnPos.y = Math.max(spawnPos.y, minY + 1.0);

    const laneOffset = new THREE.Vector3(
      (Math.random() * 2 - 1) * 5.0,
      0,
      (Math.random() * 2 - 1) * 5.0
    );

    const primaryTarget = role === "DUELIST" ? "PLAYER" : null;

    const shark = new Shark(this.scene, {
      type,
      role,
      approach,
      primaryTarget,
      position: spawnPos,
      laneOffset,
      tuning: this.sharkTuning,
    });

    this.sharks.push(shark);
  }
}