import * as THREE from "three";

import { Input } from "./engine/input.js";
import { PlayerController, Tool } from "./engine/playerController.js";

import { buildWorld, updateWorld } from "./world/world.js";
import { makeWaypoints } from "./world/waypoints.js";
import { Crawler } from "./entities/crawler.js";

import { HUD } from "./ui/hud.js";
import { SharkManager } from "./systems/sharkManager.js";

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn"); // may exist in HTML, used for styling template

let renderer, scene, camera;
let input, player, world, crawler, hud;
let started = false;
let chosenMode = null; // "prototype" | "full"
let moveStunUntil = 0;

console.log("THREE REV", THREE.REVISION);

let sharkManager;

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
let allObstacles = null;

// Tools + beam
let toolModels = null;
let lastTool = null;
let repairBeam = null;
let repairBeamEnd = null;
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  scene.add(camera);

  world = buildWorld(scene);

  // Flashlight
  flashlight = new THREE.SpotLight(0xe9f6ff, 10.0, 220, Math.PI / 6, 0.25, 0.6);
  flashlight.castShadow = false;
  scene.add(flashlight);

  flashlightTarget = new THREE.Object3D();
  scene.add(flashlightTarget);
  flashlight.target = flashlightTarget;

  flashlightFill = new THREE.PointLight(0xcfeaff, 0.9, 40, 0.8);
  flashlightFill.castShadow = false;
  scene.add(flashlightFill);

  input = new Input(renderer.domElement);
  player = new PlayerController(camera, input);
  player.setPosition(0, 1.8, 8);

  hud = new HUD();

  toolModels = createToolModels(camera);
  ({ beam: repairBeam, endGlow: repairBeamEnd } = createRepairBeam(scene));

  window.addEventListener("resize", onResize);

  renderer.domElement.addEventListener("click", () => {
    if (!started) return;
    if (input.requestPointerLock) input.requestPointerLock();
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
  row.style.flexDirection = "row";
  row.style.alignItems = "center";
  row.style.justifyContent = "center";
  row.style.gap = "16px";
  overlay.appendChild(row);

  const fullBtn = document.createElement("button");
  fullBtn.id = "startBtn"; // keep ID for existing CSS
  fullBtn.className = templateClass;
  fullBtn.textContent = "Full";

  const protoBtn = document.createElement("button");
  protoBtn.id = "protoBtn";
  protoBtn.className = templateClass;
  protoBtn.textContent = "Prototype";

  // Force equal sizing so "Prototype" isn't tiny
  for (const b of [fullBtn, protoBtn]) {
    b.style.minWidth = "180px";
    b.style.padding = "14px 22px";
    b.style.fontSize = "18px";
    b.style.cursor = "pointer";
  }

  fullBtn.addEventListener("click", () => startGame("full"));
  protoBtn.addEventListener("click", () => startGame("prototype"));

  row.appendChild(protoBtn);
  row.appendChild(fullBtn);
}

function hideOverlay() {
  if (!overlay) return;

  // Don’t rely on CSS classes overriding inline styles
  overlay.classList.add("hidden");
  overlay.style.display = "none";
  overlay.style.pointerEvents = "none";

  // Optional: remove buttons so they can’t linger visually due to CSS/layout quirks
  overlay.innerHTML = "";
}

function startGame(mode) {
  if (started) return;

  chosenMode = mode === "prototype" ? "prototype" : "full";

  crawler = new Crawler(scene, makeWaypoints(), { visualMode: chosenMode });

  const steveR = crawler.collisionRadius ?? crawler.radius;
  steveObstacle = { center: crawler.position, radius: steveR };
  allObstacles = world.obstacles.concat([steveObstacle]);

  sharkManager = new SharkManager(scene, { visualMode: chosenMode });

  hideOverlay();
  started = true;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function spawnImpact(point) {
  const m = new THREE.Mesh(impactGeo, impactMat);
  m.position.copy(point);
  scene.add(m);
  impacts.push({ mesh: m, t: 0 });
}

function updateImpacts(dt) {
  for (let i = impacts.length - 1; i >= 0; i--) {
    impacts[i].t += dt;
    if (impacts[i].t > 0.35) {
      scene.remove(impacts[i].mesh);
      impacts.splice(i, 1);
    }
  }
}

function spawnHarpoonProjectile(muzzleWorld, hitWorld) {
  const mesh = new THREE.Mesh(projectileGeo, projectileMat);
  mesh.position.copy(muzzleWorld);
  scene.add(mesh);

  projectiles.push({
    mesh,
    start: muzzleWorld.clone(),
    end: hitWorld.clone(),
    t: 0,
    duration: 0.10,
  });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.t += dt;
    const a = Math.min(1, p.t / p.duration);
    const s = a * a * (3 - 2 * a);
    p.mesh.position.lerpVectors(p.start, p.end, s);

    if (a >= 1) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

function isDescendantOf(obj, ancestor) {
  let cur = obj;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

function findSharkFromHitObject(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.shark) return cur.userData.shark;
    cur = cur.parent;
  }
  return null;
}

function fireHarpoon(nowS) {
  if (nowS < nextHarpoonTime) return;
  nextHarpoonTime = nowS + harpoonCooldown;

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = harpoonRange;

  const targets = world.raycastMeshes.concat(sharkManager.getRaycastTargets());
  const hits = raycaster.intersectObjects(targets, true);

  const filtered = hits.filter((h) => !isDescendantOf(h.object, crawler.group));

  let hitPoint;
  let hitObj = null;

  if (filtered.length > 0) {
    hitPoint = filtered[0].point.clone();
    hitObj = filtered[0].object;
    spawnImpact(hitPoint);
  } else {
    camera.getWorldDirection(_dir);
    hitPoint = camera.position.clone().addScaledVector(_dir, 45);
    spawnImpact(hitPoint);
  }

  const muzzleWorld = toolModels.harpoonMuzzle.getWorldPosition(new THREE.Vector3());
  spawnHarpoonProjectile(muzzleWorld, hitPoint);

  if (hitObj) {
    const shark = findSharkFromHitObject(hitObj);
    if (shark) shark.takeDamage(harpoonDamage);
  }
}

function createRepairBeam(scene) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));

  const mat = new THREE.LineBasicMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.85,
  });

  const line = new THREE.Line(geo, mat);
  line.visible = false;
  scene.add(line);

  const endGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.9 })
  );
  endGlow.visible = false;
  scene.add(endGlow);

  return { beam: line, endGlow };
}

function setBeam(startWorld, endWorld) {
  const attr = repairBeam.geometry.getAttribute("position");
  const a = attr.array;
  a[0] = startWorld.x; a[1] = startWorld.y; a[2] = startWorld.z;
  a[3] = endWorld.x;   a[4] = endWorld.y;   a[5] = endWorld.z;
  attr.needsUpdate = true;
  repairBeamEnd.position.copy(endWorld);
}

// your existing createToolModels() unchanged:
function createToolModels(cam) {
  const root = new THREE.Group();
  cam.add(root);

  const gunMat = new THREE.MeshBasicMaterial({ color: 0x1b2a30 }); gunMat.fog = false;
  const metalMat = new THREE.MeshBasicMaterial({ color: 0x33444b }); metalMat.fog = false;
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x88ccff }); glowMat.fog = false;
  const handMat = new THREE.MeshBasicMaterial({ color: 0x0f1619 }); handMat.fog = false;

  function cylAlongZ(rTop, rBot, len, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 14), mat);
    m.rotation.x = Math.PI / 2;
    return m;
  }

  const harpoon = new THREE.Group();
  harpoon.position.set(0.40, -0.58, -0.98);
  harpoon.rotation.set(0.05, 0.18, 0.0);
  harpoon.scale.setScalar(1.02);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.44), gunMat);
  body.position.set(0.00, 0.00, 0.10);
  harpoon.add(body);

  const barrelLen = 0.80;
  const barrel = cylAlongZ(0.035, 0.035, barrelLen, metalMat);
  barrel.position.set(0.00, 0.03, -0.18);
  harpoon.add(barrel);

  const prongLen = 0.18;
  const barrelFrontZ = barrel.position.z - barrelLen / 2;
  for (let i = -1; i <= 1; i++) {
    const pr = cylAlongZ(0.012, 0.012, prongLen, metalMat);
    pr.position.set(i * 0.020, 0.03, barrelFrontZ - prongLen / 2);
    harpoon.add(pr);
  }

  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 10, 18), glowMat);
  coil.position.set(-0.03, 0.09, 0.22);
  harpoon.add(coil);

  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.14), handMat);
  rHand.position.set(-0.10, -0.12, 0.18);
  harpoon.add(rHand);

  const harpoonMuzzle = new THREE.Object3D();
  harpoonMuzzle.position.set(0.00, 0.03, barrelFrontZ - 0.02);
  harpoon.add(harpoonMuzzle);

  root.add(harpoon);

  const repair = new THREE.Group();
  repair.position.set(-0.40, -0.60, -0.98);
  repair.rotation.set(0.05, -0.16, 0.0);
  repair.scale.setScalar(1.02);

  const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.11, 0.38), gunMat);
  rBody.position.set(0.00, 0.00, 0.12);
  repair.add(rBody);

  const nozzleLen = 0.70;
  const nozzle = cylAlongZ(0.03, 0.03, nozzleLen, metalMat);
  nozzle.position.set(0.00, 0.03, -0.22);
  repair.add(nozzle);

  const tipRadius = 0.05;
  const nozzleFrontZ = nozzle.position.z - nozzleLen / 2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(tipRadius, 12, 10), glowMat);
  tip.position.set(0.00, 0.03, nozzleFrontZ - tipRadius * 0.95);
  repair.add(tip);

  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.14), handMat);
  lHand.position.set(-0.12, -0.12, 0.20);
  repair.add(lHand);

  const repairTip = new THREE.Object3D();
  repairTip.position.copy(tip.position);
  repair.add(repairTip);

  root.add(repair);

  harpoon.visible = true;
  repair.visible = false;

  return {
    harpoon,
    repair,
    harpoonMuzzle,
    repairTip,
    setTool(tool) {
      harpoon.visible = (tool === Tool.HARPOON);
      repair.visible = (tool === Tool.REPAIR);
    }
  };
}

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

  try {
    const { leftPressed, leftDown } = input.consumeMouseButtons();

    const crawlR = crawler.collisionRadius ?? crawler.radius;
    const distToCenter = camera.position.distanceTo(crawler.position);
    const distToSurface = Math.max(0, distToCenter - crawlR);

    const canRepair = (player.tool === Tool.REPAIR) && (distToSurface <= repairReachFromSurface);
    const repairing = canRepair && leftDown;

    const sharkObstacles = sharkManager.getObstacleSpheres();
    const allObsNow = world.obstacles.concat([steveObstacle], sharkObstacles);

    const beforePos = camera.position.clone();
    player.update(dt, allObsNow, repairing);
    if (nowS < moveStunUntil) camera.position.copy(beforePos);

    if (player.tool !== lastTool) {
      toolModels.setTool(player.tool);
      lastTool = player.tool;
    }

    crawler.update(dt, world.obstacles);

    if (player.tool === Tool.HARPOON && leftPressed) {
      fireHarpoon(nowS);
    }
    if (player.tool === Tool.REPAIR && repairing) {
      crawler.repair(repairRate * dt);
    }

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
      playerPos: camera.position,
      playerHitRadius: 2.2,
      damagePlayer: (amt) => {
        playerHP = Math.max(0, playerHP - amt);
      },
      crawler,
      obstaclesRocks: world.obstacles,
      obstaclesAll: allObstacles,
    });

    updateWorld(world, dt);
    updateImpacts(dt);
    updateProjectiles(dt);

    flashlight.position.copy(camera.position);
    camera.getWorldDirection(_dir);
    flashlightTarget.position.copy(camera.position).addScaledVector(_dir, 40);
    flashlightFill.position.copy(camera.position).addScaledVector(_dir, 2.0);

    hud.setTool(player.tool === Tool.HARPOON ? "Harpoon" : "Repair");
    hud.setSteveHP(crawler.hp, crawler.maxHP);
    hud.setStatus(`Mode: ${chosenMode} | Threat: ${sharkManager.threatLevel} | Player: ${playerHP}/${playerMaxHP}`);
  } catch (err) {
    console.error(err);
  }

  renderer.render(scene, camera);
}

init();