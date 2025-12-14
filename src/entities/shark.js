import * as THREE from "../../libs/cs559-three/build/three.module.js";
import { loadGLBScene } from "../engine/assets.js";
import {
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
} from "./sharkUtils.js";

const _up = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();

function smooth01(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function chooseLongestClip(clips) {
  let best = null;
  let bestDur = -1;
  for (const c of clips || []) {
    if (!c) continue;
    const d = typeof c.duration === "number" ? c.duration : 0;
    if (d > bestDur) {
      best = c;
      bestDur = d;
    }
  }
  return best;
}

function chooseShortestClip(clips, exclude) {
  let best = null;
  let bestDur = Infinity;
  for (const c of clips || []) {
    if (!c) continue;
    if (exclude && c === exclude) continue;
    const d = typeof c.duration === "number" ? c.duration : Infinity;
    if (d < bestDur) {
      best = c;
      bestDur = d;
    }
  }
  return best;
}

export class Shark {
  constructor(
    scene,
    {
      type = "SCOUT",
      role = "HUNTER",
      approach = "HEAD_ON",
      primaryTarget = null,
      position = new THREE.Vector3(),
      laneOffset = new THREE.Vector3(),
      tuning = {},
    } = {}
  ) {
    this.scene = scene;
    this.type = type;
    this.role = role;
    this.approach = approach;
    this.tuning = tuning;

    if (primaryTarget !== null && primaryTarget !== undefined) {
      this.primaryTarget = primaryTarget;
    } else {
      this.primaryTarget = role === "DUELIST" ? "PLAYER" : "CRAWLER";
    }

    const STATS = {
      SCOUT: { hp: 45, speed: 9.2, dmgC: 10, dmgP: 10, cd: 2.6 },
      STALKER: { hp: 95, speed: 7.9, dmgC: 18, dmgP: 16, cd: 3.0 },
      BRUISER: { hp: 160, speed: 6.6, dmgC: 30, dmgP: 24, cd: 3.6 },
    };

    let s = STATS.SCOUT;
    if (STATS[type]) s = STATS[type];

    this.maxHP = s.hp;
    this.hp = s.hp;

    this.speed = s.speed;
    this.strikeDamageCrawler = s.dmgC;
    this.strikeDamagePlayer = s.dmgP;
    this.attackCooldown = s.cd;

    // --- Speed ramp as they close in (normal far away, faster close) ---
    this.approachBoostMax = typeof tuning.approachBoostMax === "number" ? tuning.approachBoostMax : 1.28;

    this.approachBoostStartCrawlerSurface =
      typeof tuning.approachBoostStartCrawlerSurface === "number" ? tuning.approachBoostStartCrawlerSurface : 75.0;
    this.approachBoostFullCrawlerSurface =
      typeof tuning.approachBoostFullCrawlerSurface === "number" ? tuning.approachBoostFullCrawlerSurface : 7.0;

    this.approachBoostStartPlayerDist =
      typeof tuning.approachBoostStartPlayerDist === "number" ? tuning.approachBoostStartPlayerDist : 75.0;
    this.approachBoostFullPlayerDist =
      typeof tuning.approachBoostFullPlayerDist === "number" ? tuning.approachBoostFullPlayerDist : 6.0;

    this._approachBoost01 = 0.0;

    // --- BURST TUNING ---
    // Short burst right when bite animation begins (covers extra ground briefly)
    this.strikeBurstSeconds = typeof tuning.strikeBurstSeconds === "number" ? tuning.strikeBurstSeconds : 2;
    this.strikeBurstMult = typeof tuning.strikeBurstMult === "number" ? tuning.strikeBurstMult : 1.35;
    this._strikeBurstT = 0.0;

    // Short burst right when evade begins (flee kick)
    this.evadeBurstSeconds = typeof tuning.evadeBurstSeconds === "number" ? tuning.evadeBurstSeconds : 0.4;
    this.evadeBurstMult = typeof tuning.evadeBurstMult === "number" ? tuning.evadeBurstMult : 1.30;
    this._evadeBurstT = 0.0;

    // --- Animation speed scaling ---
    this.swimTimeScaleBoostMax =
      typeof tuning.swimTimeScaleBoostMax === "number" ? tuning.swimTimeScaleBoostMax : 1.85;
    this.biteTimeScaleBoostMax =
      typeof tuning.biteTimeScaleBoostMax === "number" ? tuning.biteTimeScaleBoostMax : 1.35;

    this._baseSwimTimeScale = typeof tuning.swimTimeScale === "number" ? tuning.swimTimeScale : 1.45;
    this._baseBiteTimeScale = typeof tuning.biteTimeScale === "number" ? tuning.biteTimeScale : 1.25;

    // Used to make “burst moments” visually obvious even if animations are subtle.
    this._biteVisualPulse = 0.0;

    // --- Movement / collision tuning ---
    this.minY = typeof tuning.minY === "number" ? tuning.minY : -8.2;
    this.maxY = typeof tuning.maxY === "number" ? tuning.maxY : 28.0;

    this.maxDiveSpeed = typeof tuning.maxDiveSpeed === "number" ? tuning.maxDiveSpeed : 8.0;
    this.accel = typeof tuning.accel === "number" ? tuning.accel : 8.5;
    this.verticalGain = typeof tuning.verticalGain === "number" ? tuning.verticalGain : 2.8;
    this.collisionVerticalScale =
      typeof tuning.collisionVerticalScale === "number" ? tuning.collisionVerticalScale : 0.18;

    this.slowRadius = 9.0;
    this.aggroRange = 38;

    this.attackRangePlayer = 4.2;
    this.attackRangeCrawler = 5.4;

    this.crawlerStandoffSurface = 5.2;
    this.crawlerWindupSurface = 2.4;
    this.crawlerBiteSurface = 2;

    this.mouthOffset = 4.2;
    this.mouthLead = typeof tuning.mouthLead === "number" ? tuning.mouthLead : 1.85;

    this.playerBiteRange = 3.4;
    this.playerCapsuleRange = 2.8;

    this.windupDuration = 0.30;
    this.dashDuration = 0.34;

    this.evadeSeconds = typeof tuning.evadeSeconds === "number" ? tuning.evadeSeconds : 6;
    this.evadeSpeedMult = typeof tuning.evadeSpeedMult === "number" ? tuning.evadeSpeedMult : 1.5;

    this.reengageFromCooldown =
      typeof tuning.reengageFromCooldown === "boolean" ? tuning.reengageFromCooldown : true;

    this.minRetreatSeconds = 5.0;
    this.maxRetreatSeconds = 10.0;

    this.retreatDistance = 90.0;
    this.retreatSideJitter = 35.0;

    this.postBiteHoldSeconds = 0.45;
    this.retreatTurnMinRad = Math.PI / 2;
    this.retreatTurnMaxRad = (5 * Math.PI) / 6;

    this.hitRadius = 1.15;
    if (type === "STALKER") this.hitRadius = 1.35;
    if (type === "BRUISER") this.hitRadius = 1.7;

    this.laneOffset = laneOffset.clone();
    this.laneAnchor = position.clone();

    this.state = "INTRO";
    this.stateT = 0;
    this.canAttackAt = 0;

    this._strikeDir = new THREE.Vector3(0, 0, 1);
    this._strikeYTarget = position.y;
    this._didHitThisStrike = false;

    this._evadeDir = new THREE.Vector3(1, 0, 0);
    this._retreatPoint = new THREE.Vector3();
    this._retreatActive = false;

    this._postBiteFrom = new THREE.Vector3();
    this._postBiteUntil = 0;

    this._introDir = Math.random() < 0.5 ? -1 : 1;
    this._introAngle = Math.random() * Math.PI * 2;

    this.introSeconds = typeof tuning.introSeconds === "number" ? tuning.introSeconds : 2.6;
    this.introRadiusStart = typeof tuning.introRadiusStart === "number" ? tuning.introRadiusStart : 22.0;
    this.introRadiusEnd = typeof tuning.introRadiusEnd === "number" ? tuning.introRadiusEnd : 8.5;
    this.introOrbitSpeed = typeof tuning.introOrbitSpeed === "number" ? tuning.introOrbitSpeed : 1.15;
    this.introSpeedMult = typeof tuning.introSpeedMult === "number" ? tuning.introSpeedMult : 0.60;

    this.deadT = 0;
    this.removable = false;

    this._mouthNode = new THREE.Object3D();

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.add(this._mouthNode);

    this._visual = new THREE.Group();
    this.group.add(this._visual);

    // a little pitch makes bursts feel more aggressive
    this._visualPitch = 0;

    this.scene.add(this.group);

    this._vel = new THREE.Vector3();

    this._mixer = null;
    this._swimAction = null;
    this._biteAction = null;

    let sign = 1;
    if (tuning.modelForwardFix === "FLIP_Z") sign = -1;

    this._mouthNode.position.set(0, 0, (this.mouthOffset + this.mouthLead) * sign);

    markUserDataRecursive(this.group, this);

    let mode = tuning.visualMode ? tuning.visualMode : "auto";
    if (mode === "prototype") {
      this._setPrototype();
    } else {
      this._loadAssetOrFallback(mode === "asset");
    }
  }

  get position() {
    return this.group.position;
  }

  _setPrototype() {
    while (this._visual.children.length) this._visual.remove(this._visual.children[0]);
    const proto = makePrototypeShark(this.type, this.tuning);
    this._visual.add(proto);
    markUserDataRecursive(this._visual, this);
  }

  _loadAssetOrFallback(hardFail) {
    const assetUrl = this.tuning.assetUrl ? this.tuning.assetUrl : "assets/shark2.glb";

    loadGLBScene(assetUrl)
      .then(({ scene, animations }) => {
        if (this.removable) return;

        while (this._visual.children.length) this._visual.remove(this._visual.children[0]);
        this._visual.add(scene);

        let baseScale = 0.82;
        if (typeof this.tuning.modelScale === "number") {
          baseScale = this.tuning.modelScale;
        } else {
          if (this.type === "SCOUT") baseScale = 0.65;
          if (this.type === "STALKER") baseScale = 0.82;
          if (this.type === "BRUISER") baseScale = 1.0;
        }
        scene.scale.setScalar(baseScale);

        const yaw = typeof this.tuning.modelYaw === "number" ? this.tuning.modelYaw : 0;
        scene.rotation.set(0, yaw, 0);

        if (this.tuning.modelForwardFix === "FLIP_Z") scene.rotation.y += Math.PI;
        if (this.tuning.modelForwardFix === "ROT_90") scene.rotation.y += Math.PI / 2;

        applyMaterialFixes(scene);
        forceSharkGrey(scene);
        markUserDataRecursive(scene, this);

        if (animations && animations.length) {
          this._mixer = new THREE.AnimationMixer(scene);

          // swim: by name if possible; else longest clip
          let swim = pickClip(animations, ["swimming", "swim", "move", "locomotion"]);
          if (!swim) swim = chooseLongestClip(animations);

          // bite: by name if possible; else shortest non-swim clip
          let bite = pickClip(animations, ["biting", "bite", "attack", "chomp", "jaw"]);
          if (!bite) bite = chooseShortestClip(animations, swim);

          if (swim) {
            this._swimAction = this._mixer.clipAction(swim);
            this._swimAction.setLoop(THREE.LoopRepeat, Infinity);
            this._swimAction.enabled = true;
            this._swimAction.setEffectiveWeight(1);
            this._swimAction.timeScale = this._baseSwimTimeScale;
            this._swimAction.play();
          }

          if (bite) {
            this._biteAction = this._mixer.clipAction(bite);
            this._biteAction.setLoop(THREE.LoopOnce, 1);
            this._biteAction.clampWhenFinished = true;
            this._biteAction.enabled = true;
            this._biteAction.setEffectiveWeight(1);
            this._biteAction.timeScale = this._baseBiteTimeScale;

            this._mixer.addEventListener("finished", (e) => {
              if (!this._biteAction) return;
              if (e.action !== this._biteAction) return;

              if (this._swimAction) {
                this._swimAction.reset();
                this._swimAction.enabled = true;
                this._swimAction.play();
              }
            });
          }
        }
      })
      .catch(() => {
        if (!hardFail) this._setPrototype();
      });
  }

  takeDamage(amount) {
    if (this.state === "DEAD") return;

    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.state = "DEAD";
      this.stateT = 0;
      this.deadT = 0;
      if (this._biteAction) this._biteAction.stop();
    }
  }

  _mouthWorldPos(out) {
    return this._mouthNode.getWorldPosition(out);
  }

  _setSwimAnimSpeed(mult, dt) {
    if (!this._swimAction) return;

    const target = clamp(this._baseSwimTimeScale * mult, 0.4, 3.0);
    const t = 1 - Math.exp(-dt * 8.0);
    this._swimAction.timeScale = THREE.MathUtils.lerp(this._swimAction.timeScale, target, t);

    if (!this._swimAction.isRunning()) {
      this._swimAction.enabled = true;
      this._swimAction.play();
    }
  }

  _playBite() {
    // “burst moment” for visuals + speed
    this._biteVisualPulse = 1.0;
    this._strikeBurstT = Math.max(this._strikeBurstT, this.strikeBurstSeconds);

    if (!this._biteAction) return;

    const biteMult = 1.0 + (this._approachBoost01 || 0) * (this.biteTimeScaleBoostMax - 1.0);
    this._biteAction.timeScale = clamp(this._baseBiteTimeScale * biteMult, 0.5, 3.0);

    this._biteAction.reset();
    this._biteAction.enabled = true;
    this._biteAction.setEffectiveWeight(1);
    this._biteAction.play();
  }

  _startPostBite(fromPos, nowS) {
    this.state = "POST_BITE";
    this.stateT = 0;
    this._postBiteFrom.copy(fromPos);
    this._postBiteUntil = nowS + this.postBiteHoldSeconds;
  }

  _beginEvadeLong(fromPos, nowS) {
    this.state = "EVADE";
    this.stateT = 0;

    const delay = randRange(this.minRetreatSeconds, this.maxRetreatSeconds);
    this.canAttackAt = nowS + delay;

    this._retreatActive = true;

    // flee kick
    this._evadeBurstT = Math.max(this._evadeBurstT, this.evadeBurstSeconds);

    this._pickEvadeDirection(fromPos, true);
    this._pickRetreatPoint(fromPos);
  }

  _beginEvadeShort(fromPos, nowS) {
    this.state = "EVADE";
    this.stateT = 0;

    this.canAttackAt = nowS + this.attackCooldown;
    this._retreatActive = false;

    // flee kick
    this._evadeBurstT = Math.max(this._evadeBurstT, this.evadeBurstSeconds);

    this._pickEvadeDirection(fromPos, false);
  }

  _pickEvadeDirection(fromPos, wideTurn) {
    _v1.subVectors(fromPos, this.position);
    _v1.y = 0;

    if (_v1.lengthSq() < 1e-8) {
      _v1.copy(this._strikeDir).multiplyScalar(-1);
      _v1.y = 0;
    }
    if (_v1.lengthSq() < 1e-8) {
      const yaw = this.group.rotation.y;
      _v1.set(Math.sin(yaw), 0, Math.cos(yaw));
    }
    if (_v1.lengthSq() < 1e-8) _v1.set(0, 0, 1);

    _v1.normalize();

    if (wideTurn) {
      let angle = randRange(this.retreatTurnMinRad, this.retreatTurnMaxRad);
      if (Math.random() < 0.5) angle = -angle;

      const c = Math.cos(angle);
      const s = Math.sin(angle);

      const x = _v1.x;
      const z = _v1.z;

      this._evadeDir.set(x * c + z * s, 0, -x * s + z * c);

      if (this._evadeDir.dot(_v1) > 0) this._evadeDir.multiplyScalar(-1);
    } else {
      this._evadeDir.copy(_v1).multiplyScalar(-1);

      _v2.crossVectors(_up, this._evadeDir);
      if (_v2.lengthSq() > 1e-8) {
        _v2.normalize();
        this._evadeDir.addScaledVector(_v2, randRange(-0.75, 0.75));
      }
    }

    if (this._evadeDir.lengthSq() < 1e-8) this._evadeDir.set(1, 0, 0);
    this._evadeDir.normalize();
  }

  _pickRetreatPoint(fromPos) {
    _v2.crossVectors(_up, this._evadeDir);
    if (_v2.lengthSq() < 1e-8) _v2.set(1, 0, 0);
    else _v2.normalize();

    this._retreatPoint.copy(fromPos);
    this._retreatPoint.addScaledVector(this._evadeDir, this.retreatDistance);

    const side = randRange(-this.retreatSideJitter, this.retreatSideJitter);
    this._retreatPoint.addScaledVector(_v2, side);

    this._retreatPoint.y = clamp(fromPos.y, this.minY, this.maxY);
  }

  _crawlerStandoffPoint(out, crawlerPos, crawlerR) {
    const dx = this.position.x - crawlerPos.x;
    const dz = this.position.z - crawlerPos.z;

    let d = Math.sqrt(dx * dx + dz * dz);

    let dirX = 0;
    let dirZ = 1;

    if (d > 1e-6) {
      dirX = dx / d;
      dirZ = dz / d;
    } else {
      dirX = Math.sin(this.group.rotation.y);
      dirZ = Math.cos(this.group.rotation.y);
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

    const r = crawlerR + this.crawlerStandoffSurface;

    out.set(
      crawlerPos.x + dirX * r,
      crawlerPos.y,
      crawlerPos.z + dirZ * r
    );

    out.y = clamp(out.y, this.minY, this.maxY);
    return out;
  }

  update(dt, ctx) {
    dt = Math.min(dt, 0.05);

    if (this._mixer) this._mixer.update(dt);

    if (this._biteVisualPulse > 0) {
      this._biteVisualPulse = Math.max(0, this._biteVisualPulse - dt / 0.35);
    }
    if (this._strikeBurstT > 0) this._strikeBurstT = Math.max(0, this._strikeBurstT - dt);
    if (this._evadeBurstT > 0) this._evadeBurstT = Math.max(0, this._evadeBurstT - dt);

    if (this.state === "DEAD") {
      this.deadT += dt;
      this.group.rotation.z += dt * 0.8;
      this.group.position.y = Math.max(this.minY, this.group.position.y - dt * 0.35);
      if (this.deadT >= 1.2) this.removable = true;
      return;
    }

    if (!ctx) return;

    const playerPos = ctx.playerPos;
    const crawlerPos = ctx.crawlerPos;
    if (!playerPos || !crawlerPos) return;

    let crawlerR = typeof ctx.crawlerCollisionRadius === "number" ? ctx.crawlerCollisionRadius : 4.4;

    this.laneAnchor.copy(ctx.getLaneAnchor());
    this.laneAnchor.add(this.laneOffset);

    // target selection
    let targetKind = this.primaryTarget;

    const dPlayer = this.position.distanceTo(playerPos);
    if (dPlayer < 16.0) targetKind = "PLAYER";

    const playerBetween = pointNearSegment(playerPos, this.position, crawlerPos, 3.0);
    const sharkBetween = pointNearSegment(this.position, playerPos, crawlerPos, 3.0);

    if (playerBetween) targetKind = "PLAYER";
    if (sharkBetween) targetKind = "CRAWLER";

    const targetBase = targetKind === "PLAYER" ? playerPos : crawlerPos;

    this.stateT += dt;

    // INTRO
    if (this.state === "INTRO") {
      const t01 = Math.min(1, this.stateT / Math.max(0.001, this.introSeconds));
      const radius = THREE.MathUtils.lerp(this.introRadiusStart, this.introRadiusEnd, t01);

      const center = _v1.copy(this.laneAnchor);
      center.y = crawlerPos.y;

      this._introAngle += this._introDir * this.introOrbitSpeed * dt;

      const desired = _v2.set(
        center.x + Math.cos(this._introAngle) * radius,
        crawlerPos.y + Math.sin(this._introAngle * 0.85) * 1.6,
        center.z + Math.sin(this._introAngle) * radius
      );

      desired.y = clamp(desired.y, this.minY, this.maxY);

      moveSteer3D(this, desired, targetBase, this.speed * this.introSpeedMult, dt, ctx.obstaclesAll, 5.0);

      this._setSwimAnimSpeed(1.0, dt);
      this._updateVisualPitch(dt, 0);

      if (this.stateT >= this.introSeconds) {
        this.state = "APPROACH";
        this.stateT = 0;
      }
      return;
    }

    // APPROACH
    if (this.state === "APPROACH") {
      let desired = _v1.copy(targetBase);

      if (targetKind === "CRAWLER") desired = this._crawlerStandoffPoint(_v1, crawlerPos, crawlerR);
      else desired.y = playerPos.y;

      desired.y = clamp(desired.y, this.minY, this.maxY);

      // approach boost based on closeness
      let surfaceDist = 9999;
      let startD = this.approachBoostStartCrawlerSurface;
      let fullD = this.approachBoostFullCrawlerSurface;

      if (targetKind === "CRAWLER") {
        surfaceDist = this.position.distanceTo(crawlerPos) - crawlerR;
      } else {
        startD = this.approachBoostStartPlayerDist;
        fullD = this.approachBoostFullPlayerDist;
        surfaceDist = this.position.distanceTo(playerPos);
      }

      if (surfaceDist < 0) surfaceDist = 0;

      const denom = Math.max(0.001, startD - fullD);
      let boost01 = clamp((startD - surfaceDist) / denom, 0.0, 1.0);
      boost01 = smooth01(boost01);

      const boostT = 1 - Math.exp(-dt * 6.0);
      this._approachBoost01 = THREE.MathUtils.lerp(this._approachBoost01, boost01, boostT);

      const speedMult = 1.0 + this._approachBoost01 * (this.approachBoostMax - 1.0);
      const minScale = 0.18 + 0.08 * this._approachBoost01;

      moveSteer3D(this, desired, targetBase, this.speed * speedMult, dt, ctx.obstaclesAll, 7.5, { minSpeedScale: minScale });

      // swim animation shows speed-up
      const swimMult =
        1.0 +
        this._approachBoost01 * (this.swimTimeScaleBoostMax - 1.0) +
        this._biteVisualPulse * 0.75;

      this._setSwimAnimSpeed(swimMult, dt);
      this._updateVisualPitch(dt, 0.06);

      if (ctx.nowS >= this.canAttackAt) {
        if (targetKind === "CRAWLER") {
          const mouthNow = this._mouthWorldPos(_v4);
          const mouthSurface = mouthNow.distanceTo(crawlerPos) - crawlerR;
          if (mouthSurface <= this.crawlerWindupSurface) {
            this.state = "WINDUP";
            this.stateT = 0;
            return;
          }

          const bodySurface = this.position.distanceTo(crawlerPos) - crawlerR;
          if (bodySurface <= this.attackRangeCrawler + this.hitRadius) {
            this.state = "WINDUP";
            this.stateT = 0;
            return;
          }
        } else {
          const mouthNow = this._mouthWorldPos(_v4);
          const dM = mouthNow.distanceTo(playerPos);
          if (dM <= this.attackRangePlayer + 0.5) {
            this.state = "WINDUP";
            this.stateT = 0;
            return;
          }
        }
      }

      return;
    }

    // WINDUP
    if (this.state === "WINDUP") {
      _v1.subVectors(targetBase, this.position);
      _v1.y = 0;

      if (_v1.lengthSq() > 1e-8) {
        _v1.normalize();
        faceTowardYawDir(this.group, _v1, dt, 10.0);
      }

      this._setSwimAnimSpeed(1.15 + this._approachBoost01 * 0.35, dt);
      this._updateVisualPitch(dt, 0.12);

      if (this.stateT >= this.windupDuration) {
        this.state = "STRIKE";
        this.stateT = 0;
        this._didHitThisStrike = false;

        // Bite animation starts here -> trigger short burst that covers more ground
        this._playBite();

        const aim = _v2.copy(targetBase);

        if (targetKind === "CRAWLER" && ctx.crawlerVel) {
          aim.addScaledVector(ctx.crawlerVel, 0.22);
          aim.y = crawlerPos.y;
        }

        aim.y = clamp(aim.y, this.minY, this.maxY);

        this._strikeDir.subVectors(aim, this.position);
        this._strikeDir.y = 0;

        if (this._strikeDir.lengthSq() < 1e-8) this._strikeDir.set(0, 0, 1);
        this._strikeDir.normalize();

        this._strikeYTarget = aim.y;
      }

      return;
    }

    // STRIKE
    if (this.state === "STRIKE") {
      // light homing so moving crawler doesn’t cause “bite air”
      if (targetKind === "CRAWLER" && ctx.crawlerVel) {
        const aim = _v2.copy(crawlerPos);
        aim.addScaledVector(ctx.crawlerVel, 0.18);
        aim.y = this._strikeYTarget;

        _v1.subVectors(aim, this.position);
        _v1.y = 0;

        if (_v1.lengthSq() > 1e-8) {
          _v1.normalize();
          const turn = 1 - Math.exp(-dt * 10.0);
          this._strikeDir.lerp(_v1, turn);
          if (this._strikeDir.lengthSq() > 1e-8) this._strikeDir.normalize();
        }
      }

      let dashSpeed = this.type === "BRUISER" ? 21 : 23;

      // short “bite burst” right when STRIKE begins
      const strikeT01 = this.strikeBurstSeconds > 1e-6 ? (this._strikeBurstT / this.strikeBurstSeconds) : 0;
      const strikeBurst = 1.0 + (this.strikeBurstMult - 1.0) * smooth01(strikeT01);

      // slight extra oomph if it was already in a close chase
      dashSpeed *= (1.0 + 0.12 * (this._approachBoost01 || 0.0)) * strikeBurst;

      const proposed = this.position.clone().addScaledVector(this._strikeDir, dashSpeed * dt);

      const followRate = 8.0;
      proposed.y = THREE.MathUtils.lerp(
        proposed.y,
        this._strikeYTarget,
        1 - Math.exp(-dt * followRate)
      );

      proposed.y = clamp(proposed.y, this.minY, this.maxY);

      resolveSphereCollisions(proposed, this.hitRadius, ctx.obstaclesRocks, this.collisionVerticalScale);

      proposed.y = clamp(proposed.y, this.minY, this.maxY);
      this.position.copy(proposed);

      faceTowardYawDir(this.group, this._strikeDir, dt, 10.0);

      // make swim motion reflect burst too (even if bite clip is subtle)
      this._setSwimAnimSpeed(
        1.25 + this._approachBoost01 * 0.65 + smooth01(strikeT01) * 0.85,
        dt
      );

      const mouthNow = this._mouthWorldPos(_v4);

      if (!this._didHitThisStrike) {
        if (targetKind === "PLAYER") {
          const hitPlayer = mouthNow.distanceTo(playerPos) <= this.playerBiteRange;
          const hitCapsule = pointNearSegment(playerPos, mouthNow, this.position, this.playerCapsuleRange);

          if (hitPlayer || hitCapsule) {
            this._didHitThisStrike = true;
            if (ctx.damagePlayer) ctx.damagePlayer(this.strikeDamagePlayer);
            this._startPostBite(playerPos, ctx.nowS);
            this._updateVisualPitch(dt, 0.18);
            return;
          }
        } else {
          const mouthSurface = mouthNow.distanceTo(crawlerPos) - crawlerR;
          if (mouthSurface <= this.crawlerBiteSurface) {
            this._didHitThisStrike = true;
            if (ctx.damageCrawler) ctx.damageCrawler(this.strikeDamageCrawler);
            this._startPostBite(crawlerPos, ctx.nowS);
            this._updateVisualPitch(dt, 0.18);
            return;
          }
        }
      }

      if (this.stateT >= this.dashDuration) {
        this._beginEvadeShort(targetBase, ctx.nowS);
      }

      this._updateVisualPitch(dt, 0.20 + smooth01(strikeT01) * 0.06);
      return;
    }

    // POST_BITE
    if (this.state === "POST_BITE") {
      _v1.subVectors(this.position, this._postBiteFrom);
      _v1.y = 0;

      if (_v1.lengthSq() < 1e-8) {
        _v1.copy(this._strikeDir).multiplyScalar(-1);
        _v1.y = 0;
      }

      if (_v1.lengthSq() > 1e-8) {
        _v1.normalize();
        this.position.addScaledVector(_v1, 0.35 * dt);
      }

      this.position.y = clamp(this.position.y, this.minY, this.maxY);

      _v2.subVectors(this._postBiteFrom, this.position);
      _v2.y = 0;

      if (_v2.lengthSq() > 1e-8) {
        _v2.normalize();
        faceTowardYawDir(this.group, _v2, dt, 12.0);
      }

      this._setSwimAnimSpeed(1.05, dt);

      if (ctx.nowS >= this._postBiteUntil) {
        this._beginEvadeLong(this._postBiteFrom, ctx.nowS);
      }

      this._updateVisualPitch(dt, 0.02);
      return;
    }

    // EVADE
    if (this.state === "EVADE") {
      let desired = _v1.copy(this.position).addScaledVector(this._evadeDir, 28);
      if (this._retreatActive) desired = _v1.copy(this._retreatPoint);

      desired.y = clamp(desired.y, this.minY, this.maxY);

      // short flee kick at the start of evade
      const evadeT01 = this.evadeBurstSeconds > 1e-6 ? (this._evadeBurstT / this.evadeBurstSeconds) : 0;
      const evadeBurst = 1.0 + (this.evadeBurstMult - 1.0) * smooth01(evadeT01);

      moveSteer3D(
        this,
        desired,
        null,
        this.speed * this.evadeSpeedMult * evadeBurst,
        dt,
        ctx.obstaclesAll,
        10.0
      );

      // show flee kick in swim speed too
      this._setSwimAnimSpeed(1.15 + smooth01(evadeT01) * 0.75, dt);

      if (this.stateT >= this.evadeSeconds) {
        this.state = "COOLDOWN";
        this.stateT = 0;
      }

      this._updateVisualPitch(dt, 0.06 + smooth01(evadeT01) * 0.04);
      return;
    }

    // COOLDOWN
    if (this.state === "COOLDOWN") {
      let desired = null;

      if (this._retreatActive && ctx.nowS < this.canAttackAt) {
        desired = _v1.copy(this._retreatPoint);
        desired.y = clamp(desired.y, this.minY, this.maxY);

        moveSteer3D(this, desired, null, this.speed * 0.92, dt, ctx.obstaclesAll, 7.0);
        this._setSwimAnimSpeed(1.0, dt);
        this._updateVisualPitch(dt, 0.02);
        return;
      }

      this._retreatActive = false;

      desired = _v1.copy(this.laneAnchor);
      desired.y = clamp(ctx.crawlerPos.y, this.minY, this.maxY);

      moveSteer3D(this, desired, ctx.crawlerPos, this.speed * 0.88, dt, ctx.obstaclesAll, 5.0);

      this._setSwimAnimSpeed(0.95, dt);

      if (ctx.nowS >= this.canAttackAt) {
        this.state = this.reengageFromCooldown ? "APPROACH" : "INTRO";
        this.stateT = 0;
      }

      this._updateVisualPitch(dt, 0.02);
    }
  }

  _updateVisualPitch(dt, extraPitch) {
    const vy = this._vel ? this._vel.y : 0;
    let pitch = clamp(-vy * 0.05, -0.22, 0.22);

    pitch += extraPitch || 0;
    pitch += this._biteVisualPulse * 0.10;

    pitch = clamp(pitch, -0.35, 0.35);

    const t = 1 - Math.exp(-dt * 10.0);
    this._visualPitch = THREE.MathUtils.lerp(this._visualPitch, pitch, t);
    this._visual.rotation.x = this._visualPitch;
  }
}