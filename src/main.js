import * as THREE from "three";

import { Input } from "./engine/input.js";
import { PlayerController, Tool } from "./engine/playerController.js";

import { buildWorld, updateWorld } from "./world/world.js";
import { makeWaypoints } from "./world/waypoints.js";
import { Crawler } from "./entities/crawler.js";

import { HUD } from "./ui/hud.js";
import { SharkManager } from "./systems/sharkManager.js";
import { Anglerfish } from "./entities/Anglerfish.js";

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn"); // may exist in HTML, used for styling template

let renderer, scene, camera;
let input, player, world, crawler, hud;
let started = false;
let chosenMode = null; // "prototype" | "full"
let moveStunUntil = 0;
let stallBanner = null;


let gameOver = false;
let gameOverText = "";

console.log("THREE REV", THREE.REVISION);

let sharkManager;
let anglerfish;

// Flashlight
let flashlight, flashlightTarget, flashlightFill;
const _dir = new THREE.Vector3();

// Harpoon hitscan
const raycaster = new THREE.Raycaster();
let nextHarpoonTime = 0;
const harpoonCooldown = 0.45;
const harpoonRange = 90;
const harpoonDamage = 30;

// Repair
const repairReachFromSurface = 3.2;
const repairRate = 14 * 0.2; // 2.8 HP/sec

// Player HP
const playerMaxHP = 100;
let playerHP = 100;

// Impact marker
const impacts = [];
const impactGeo = new THREE.SphereGeometry(0.18, 10, 8);
const impactMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });

// Harpoon projectile visual
const projectiles = [];
const projectileMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });
const projectileGeo = new THREE.SphereGeometry(0.10, 10, 8);

// STEVE collision obstacle for player
let steveObstacle = null;
let allObstacles = []; // for sharks/crawler

// Tool models
let toolModels;
let repairBeam, repairBeamEnd;

// Temps
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();
const _tmpPlayerPos = new THREE.Vector3();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 6000);
  scene.add(camera);

  // World is built after the user chooses Prototype vs Full.
  scene.background = new THREE.Color(0x04131a);
  scene.fog = new THREE.FogExp2(0x04131a, 0.012);
  scene.add(new THREE.AmbientLight(0x3b6b80, 1.0));

  world = null;

  // Flashlight (always on)
  flashlight = new THREE.SpotLight(0xcfeaff, 4.0, 160, Math.PI * 0.18, 0.35, 1.0);
  flashlight.castShadow = false;
  flashlight.penumbra = 0.45;
  flashlight.position.copy(camera.position);
  scene.add(flashlight);

  flashlightTarget = new THREE.Object3D();
  flashlightTarget.position.set(0, 0, -1);
  scene.add(flashlightTarget);
  flashlight.target = flashlightTarget;

  flashlightFill = new THREE.PointLight(0xcfeaff, 0.9, 40, 0.8);
  flashlightFill.castShadow = false;
  scene.add(flashlightFill);

  input = new Input(renderer.domElement);
  player = new PlayerController(camera, input);

  window.addEventListener("keydown", (e) => {
    if (e.key === "p") {
      const p = player.pos;
      console.log(
        `new THREE.Vector3(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}),`
      );
    }
  });

  hud = new HUD();

  toolModels = createToolModels(camera);
  ({ beam: repairBeam, endGlow: repairBeamEnd } = createRepairBeam(scene));

  window.addEventListener("resize", onResize);

  renderer.domElement.addEventListener("click", () => {
    if (!input.isPointerLocked && started && !gameOver) input.requestPointerLock();
  });

  setupModeMenu();

  window.addEventListener("keydown", (e) => {
    if (started) return;
    if (e.code === "Enter") startGame("full");
    if (e.code === "KeyF") startGame("full");
    if (e.code === "KeyP") startGame("prototype");
  });

  animate();
}

function setupModeMenu() {
  // If there's no overlay, just start Full.
  if (!overlay) {
    startGame("full");
    return;
  }

  overlay.classList.remove("hidden");
  overlay.style.display = "flex";
  overlay.style.pointerEvents = "auto";

  const templateClass = startBtn ? startBtn.className : "";

  // Clear overlay and rebuild clean
  overlay.innerHTML = "";

  // Centering (in case CSS doesn’t)
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.gap = "14px";

  const title = document.createElement("div");
  title.textContent = "Choose Mode";
  title.style.fontSize = "22px";
  title.style.fontWeight = "600";
  title.style.letterSpacing = "0.4px";
  overlay.appendChild(title);

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "14px";
  overlay.appendChild(row);

  const btnProto = document.createElement("button");
  btnProto.textContent = "Prototype";
  btnProto.className = templateClass;
  btnProto.style.minWidth = "140px";
  btnProto.onclick = () => startGame("prototype");
  row.appendChild(btnProto);

  const btnFull = document.createElement("button");
  btnFull.textContent = "Full";
  btnFull.className = templateClass;
  btnFull.style.minWidth = "140px";
  btnFull.onclick = () => startGame("full");
  row.appendChild(btnFull);

  const hint = document.createElement("div");
  hint.textContent = "Keyboard: P = Prototype, F/Enter = Full";
  hint.style.opacity = "0.8";
  hint.style.fontSize = "14px";
  overlay.appendChild(hint);
}

function hideOverlay() {
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.style.display = "none";
  overlay.style.pointerEvents = "none";
}

function startGame(mode) {
  if (started) return;

  chosenMode = mode === "prototype" ? "prototype" : "full";

  world = buildWorld(scene, chosenMode);

  crawler = new Crawler(scene, makeWaypoints(), { visualMode: chosenMode });
  player.setPosition(
    crawler.position.x - 10,
    crawler.position.y + 4,
    crawler.position.z + 18
  );
  

  const steveR = crawler.collisionRadius ?? crawler.radius;
  steveObstacle = { center: crawler.position, radius: steveR };
  allObstacles = (world?.obstacles || []).concat([steveObstacle]);

  sharkManager = new SharkManager(scene, { visualMode: chosenMode });

  // Anglerfish (slow wandering) — spawn ~30m ahead of player start
  const playerStart = camera.position.clone();
  const spawnDir = new THREE.Vector3();
  camera.getWorldDirection(spawnDir);
  const spawnPos = playerStart.clone().addScaledVector(spawnDir, 30);

  hideOverlay();
  started = true;

  // Show Group ID label (top-right) once the game starts
  if (!document.getElementById("groupId")) {
    const groupIdEl = document.createElement("div");
    groupIdEl.id = "groupId";
    groupIdEl.textContent = "Group ID: 6741";
    document.body.appendChild(groupIdEl);
  }
}

function endGame(text) {
  if (gameOver) return;
  gameOver = true;
  gameOverText = text || "Game Over";

  // Stop input drift
  input.consumeMouseDelta();
  input.consumeMouseButtons();

  // Show overlay
  if (overlay) {
    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";
    overlay.innerHTML = "";

    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.gap = "14px";

    const title = document.createElement("div");
    title.textContent = gameOverText;
    title.style.fontSize = "34px";
    title.style.fontWeight = "700";
    title.style.letterSpacing = "0.6px";
    title.style.color = "white";
    overlay.appendChild(title);

    const sub = document.createElement("div");
    sub.textContent = "Refresh to play again";
    sub.color = "white";
    sub.style.opacity = "0.85";
    sub.style.fontSize = "16px";
    overlay.appendChild(sub);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function spawnImpact(p) {
  const m = new THREE.Mesh(impactGeo, impactMat);
  m.position.copy(p);
  m.userData.t = 0;
  scene.add(m);
  impacts.push(m);
}

function updateImpacts(dt) {
  for (let i = impacts.length - 1; i >= 0; i--) {
    const m = impacts[i];
    m.userData.t += dt;
    m.scale.setScalar(1.0 + m.userData.t * 3.0);
    if (m.userData.t > 0.18) {
      scene.remove(m);
      impacts.splice(i, 1);
    }
  }
}

function spawnProjectile(start, dir) {
  const p = new THREE.Mesh(projectileGeo, projectileMat);
  p.position.copy(start);
  p.userData.vel = dir.clone().multiplyScalar(120);
  p.userData.t = 0;
  scene.add(p);
  projectiles.push(p);
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.userData.t += dt;
    p.position.addScaledVector(p.userData.vel, dt);
    if (p.userData.t > 0.22) {
      scene.remove(p);
      projectiles.splice(i, 1);
    }
  }
}

function createToolModels(camera) {
  const g = new THREE.Group();
  camera.add(g);

  // Harpoon
  const harpoon = new THREE.Group();
  g.add(harpoon);

  const gunMat = new THREE.MeshStandardMaterial({ color: 0x2d3338, roughness: 0.7, metalness: 0.3 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ab, roughness: 0.5, metalness: 0.6 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.55), gunMat);
  body.position.set(0.20, -0.18, -0.55);
  harpoon.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 12), accentMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.20, -0.15, -0.85);
  harpoon.add(barrel);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.20, -0.15, -1.12);
  harpoon.add(muzzle);

  // Repair tool
  const repair = new THREE.Group();
  g.add(repair);

  const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.45), gunMat);
  rBody.position.set(0.16, -0.18, -0.52);
  repair.add(rBody);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.20, 12), accentMat);
  tip.rotation.x = -Math.PI / 2;
  tip.position.set(0.16, -0.15, -0.80);
  repair.add(tip);

  const repairTip = new THREE.Object3D();
  repairTip.position.set(0.16, -0.15, -0.92);
  repair.add(repairTip);

  // Placement
  g.position.set(0.0, 0.0, 0.0);

  // Default: harpoon visible
  harpoon.visible = true;
  repair.visible = false;

  return {
    group: g,
    harpoon,
    repair,
    harpoonMuzzle: muzzle,
    repairTip,
    setTool(tool) {
      harpoon.visible = (tool === Tool.HARPOON);
      repair.visible = (tool === Tool.REPAIR);
    }
  };
}

function createRepairBeam(scene) {
  const mat = new THREE.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.75 });
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beam = new THREE.Line(geo, mat);
  beam.visible = false;
  scene.add(beam);

  const endGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.8 })
  );
  endGlow.visible = false;
  scene.add(endGlow);

  return { beam, endGlow };
}

function setBeam(start, end) {
  repairBeam.geometry.setFromPoints([start, end]);
  repairBeamEnd.position.copy(end);
}

let lastTool = null;

let lastT = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.05);

  const nowS = now / 1000;

  if (!started) {
    renderer.render(scene, camera);
    return;
  }

  if (gameOver) {
    // Freeze the game on win/lose
    renderer.render(scene, camera);
    return;
  }

  try {
    const { leftPressed, leftDown } = input.consumeMouseButtons();

    const crawlR = crawler.collisionRadius ?? crawler.radius;
    const distToCenter = camera.position.distanceTo(crawler.position);
    const distToSurface = Math.max(0, distToCenter - crawlR);

    const canRepair = (player.tool === Tool.REPAIR) && (distToSurface <= repairReachFromSurface);
    const repairing = canRepair && leftDown;

    const sharkObstacles = sharkManager.getObstacleSpheres();
    const allObsNow = (world.playerObstacles || []).concat([steveObstacle], sharkObstacles);

    const beforePos = camera.position.clone();
    player.update(dt, allObsNow, repairing);
    if (nowS < moveStunUntil) camera.position.copy(beforePos);

    // Clamp to sea floor: prevent player from going below dynamic seafloor
    if (typeof world.getSeafloorY === "function") {
      const floorY = world.getSeafloorY(camera.position.x, camera.position.z);
      const minY = floorY + 0.1; // small offset to avoid z-fighting
      if (camera.position.y < minY) camera.position.y = minY;
    }

    // Clamp only: limit player to 2m above surface in full mode
    const hasSurface = typeof world.getWaterSurfaceY === "function";
    if (chosenMode === "full" && hasSurface) {
      const surfaceY = world.getWaterSurfaceY();
      const maxY = surfaceY + 2.0;
      if (camera.position.y > maxY) camera.position.y = maxY;
    }

    if (player.tool !== lastTool) {
      toolModels.setTool(player.tool);
      lastTool = player.tool;
    }

    const crawlerObs = (world.obstacles || []).filter(o => o?.kind !== "rock");
    crawler.update(dt, crawlerObs);

    if (stallBanner && crawler) {
        if (crawler.state === "STALLED" && crawler.stallTimer > 0) {
          const t = Math.ceil(crawler.stallTimer);
          stallBanner.textContent = `STEVE HAS STALLED. PROTECT IT WHILE IT REBOOTS (${t}s)`;
          stallBanner.style.display = "block";
        } else {
          stallBanner.style.display = "none";
        }
      }
  


    // --- NaN/Infinity guard: prevents rare physics/steering edge cases from freezing AI ---
    if (
      !Number.isFinite(crawler.position.x) ||
      !Number.isFinite(crawler.position.y) ||
      !Number.isFinite(crawler.position.z)
    ) {
      console.warn("[Guard] Crawler position invalid; resetting to last waypoint base.");
      const wps = makeWaypoints();
      crawler.position.set(wps[0].x, wps[0].y + 1.2, wps[0].z);
      crawler.wpIndex = 0;
      crawler.phase = "pathing";
      crawler.state = "MOVING";
    }


    // Harpoon
    if (player.tool === Tool.HARPOON && leftPressed) {
      if (nowS >= nextHarpoonTime) {
        nextHarpoonTime = nowS + harpoonCooldown;

        const start = toolModels.harpoonMuzzle.getWorldPosition(_tmpA);
        camera.getWorldDirection(_dir);

        spawnProjectile(start, _dir);

        raycaster.set(start, _dir);
        raycaster.far = harpoonRange;

        const candidates = (world.raycastMeshes || []);
        const hits = raycaster.intersectObjects(candidates, true);

        if (hits.length) {
          const hit = hits[0];
          spawnImpact(hit.point);
        }

        // Damage sharks via manager (hitscan in direction)
        sharkManager.harpoonHitscan(start, _dir, harpoonRange, harpoonDamage);
      }
    }

    // Repair: on click, increment crawler HP by 1 if aiming at it
    if (player.tool === Tool.REPAIR && canRepair && leftPressed) {
      camera.getWorldDirection(_dir);
      const toCrawler = _tmpA.copy(crawler.position).sub(camera.position).normalize();
      const facingDot = _dir.dot(toCrawler);
      if (facingDot > 0.98 && crawler.hp < crawler.maxHP) {
        crawler.heal(1);
      }
    }

    // Repair beam visuals
    if (player.tool === Tool.REPAIR && repairing) {
      const start = toolModels.repairTip.getWorldPosition(_tmpA);

      _tmpB.subVectors(start, crawler.position);
      if (_tmpB.lengthSq() < 1e-6) _tmpB.set(0, 0, 1);
      _tmpB.normalize();

      const end = _tmpC.copy(crawler.position).addScaledVector(_tmpB, crawlR);

      repairBeam.visible = true;
      repairBeamEnd.visible = true;
      setBeam(start, end);
    } else {
      repairBeam.visible = false;
      repairBeamEnd.visible = false;
    }

    sharkManager.update(dt, nowS, {
      playerPos: player.getTargetPosition(_tmpPlayerPos),
      playerHitRadius: 2.2,
      damagePlayer: (amt) => {
        playerHP = Math.max(0, playerHP - amt);
      },
      crawler,
      obstaclesRocks: world.obstacles,
      obstaclesAll: allObstacles,
    });

    updateWorld(world, dt);
    if (anglerfish) anglerfish.update(dt, nowS);
    updateImpacts(dt);
    updateProjectiles(dt);

    // Flashlight always on and aims with camera
    flashlight.position.copy(camera.position);
    camera.getWorldDirection(_dir);
    flashlightTarget.position.copy(camera.position).addScaledVector(_dir, 40);
    flashlightFill.position.copy(camera.position).addScaledVector(_dir, 2.0);

    // Win/Lose evaluation
    if (playerHP <= 0 || crawler.hp <= 0) {
      endGame("You Lose");
    } else if (playerHP > 0 && typeof crawler.hasReachedSurface === "function" && crawler.hasReachedSurface()) {
      endGame("You Win");
    }

    hud.setTool(player.tool === Tool.HARPOON ? "Harpoon" : "Repair");
    hud.setSteveHP(crawler.hp, crawler.maxHP);
    hud.setStatus(`Mode: ${chosenMode} | Threat: ${sharkManager.threatLevel} | Player: ${playerHP}/${playerMaxHP}`);
  } catch (err) {
    console.error(err);
  }

  renderer.render(scene, camera);
}

init();