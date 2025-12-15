import * as THREE from "three";
import { loadGLBScene } from "../engine/assets.js";

export function buildWorld(scene, mode = "full") {
  scene.background = new THREE.Color(0x12586d);
  scene.fog = new THREE.FogExp2(0x12586d, 0.014);

  const obstacles = [];
  const playerObstacles = [];
  const raycastMeshes = [];

  const ambient = new THREE.AmbientLight(0xaee7f2, 1.75);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xe2fdff, 0x0b2f38, 1.22);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xf3feff, 0.95);
  sun.position.set(0, 75, 40);
  scene.add(sun);

  const keyLight = new THREE.PointLight(0xc3f8ff, 3.6, 560);
  keyLight.position.set(0, 28, 16);
  keyLight.userData.t = 0;
  scene.add(keyLight);

  const seafloor = mode === "prototype"
    ? buildPrototypeWorld(scene, obstacles, playerObstacles, raycastMeshes)
    : buildFullOceanWorld(scene, obstacles, playerObstacles, raycastMeshes);

  const particles = createMarineSnow(scene, mode);

  return {
    keyLight,
    particles,
    obstacles,
    playerObstacles,
    raycastMeshes,
    getSeafloorY: seafloor.getSeafloorY,
  };
}

export function updateWorld(world, dt) {
  const k = world.keyLight;
  k.userData.t += dt;
  const t = k.userData.t;
  k.intensity = 3.25 + 0.10 * Math.sin(t * 4.0) + 0.06 * Math.sin(t * 9.3);
  updateMarineSnow(world.particles, dt);
}

function buildPrototypeWorld(scene, obstacles, playerObstacles, raycastMeshes) {
  scene.background = new THREE.Color(0x12586d);
  scene.fog = new THREE.FogExp2(0x12586d, 0.015);
  addDimSky(scene);

  const floorGeo = new THREE.PlaneGeometry(520, 520, 120, 120);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const n = 0.9 * Math.sin(x * 0.035) * Math.cos(y * 0.035);
    pos.setZ(i, n);
  }
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1b4f5f,
    roughness: 1,
    metalness: 0,
    emissive: 0x06161a,
    emissiveIntensity: 0.95,
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -10.5;
  floor.receiveShadow = true;
  scene.add(floor);
  raycastMeshes.push(floor);

  addWaterOverlay(scene, { mode: "prototype" });

  addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, {
    mode: "prototype",
    position: new THREE.Vector3(30, -12.0, 95),
    rotationY: Math.PI * 0.12,
    scale: 0.5,
  });

  addPrototypeRectObstacle(scene, obstacles, playerObstacles, raycastMeshes, {
    position: new THREE.Vector3(-35, -10.4, -45),
    size: new THREE.Vector3(18, 2, 50),
    rotationY: Math.PI / 6,
    color: 0x2d6774,
  });

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x246a79,
    roughness: 1,
    metalness: 0.0,
    emissive: 0x020607,
    emissiveIntensity: 0.34,
  });

  const protoSeafloorY = (x, z) => {
    const n = 0.9 * Math.sin(x * 0.035) * Math.cos(z * 0.035);
    return -10.5 + n;
  };

  scatterRockField(scene, obstacles, playerObstacles, raycastMeshes, rockMat, {
    centerZ: -18,
    spreadX: 220,
    spreadZ: 220,
    count: 42,
    yMin: -12.0,
    yMax: -6.5,
    rMin: 2.6,
    rMax: 6.8,
    getSeafloorY: protoSeafloorY,
  });

  addKelpField(scene, {
    count: 900,
    area: 520,
    yBase: -10.5,
    centerZ: -10,
    getSeafloorY: protoSeafloorY,
  });

  return {
    getSeafloorY: protoSeafloorY,
    getWaterSurfaceY() { return 48; }
  };
}

function buildFullOceanWorld(scene, obstacles, playerObstacles, raycastMeshes) {
  scene.background = new THREE.Color(0x12586d);
  scene.fog = new THREE.FogExp2(0x12586d, 0.015);

  addDimSky(scene);
  addWaterOverlay(scene, { mode: "full" });

  const floorGeo = new THREE.PlaneGeometry(620, 620, 180, 180);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const h =
      2.2 * Math.sin(x * 0.018) * Math.cos(y * 0.018) +
      1.4 * Math.sin(x * 0.045 + 1.3) * Math.cos(y * 0.045 - 0.7) +
      0.6 * Math.sin(x * 0.095 - 2.0) * Math.cos(y * 0.095 + 0.5);
    pos.setZ(i, h);
  }
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1a5262,
    roughness: 1,
    metalness: 0,
    emissive: 0x06161a,
    emissiveIntensity: 0.98,
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -18.5;
  floor.receiveShadow = true;
  scene.add(floor);
  raycastMeshes.push(floor);

  addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, {
    mode: "full",
    position: new THREE.Vector3(0, -18.8, 102),
    rotationY: Math.PI * -0.18,
    scale: 0.5,
  });

  const ship = createShipwreck({
    scale: 2.0,
    color: 0x3f7280,
    accent: 0x253d46,
  });

  ship.group.position.set(-35, -15.5, -45);
  ship.group.rotation.y = Math.PI / 6;
  ship.group.rotation.z = 0.12;
  scene.add(ship.group);

  ship.group.traverse((obj) => {
    if (obj.isMesh) raycastMeshes.push(obj);
  });

  addShipwreckColliders(ship.group, playerObstacles, obstacles, {
    boxShrink: 8.0,
    spheres: [
      { offset: new THREE.Vector3(0, 0.8, 0), radius: 5.0 },
      { offset: new THREE.Vector3(0, 0.8, -10), radius: 4.0 },
      { offset: new THREE.Vector3(0, 0.8, 10), radius: 4.0 },
      { offset: new THREE.Vector3(6, 2.4, -2), radius: 2.4 },
    ],
  });

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x266f80,
    roughness: 1,
    metalness: 0.0,
    emissive: 0x020607,
    emissiveIntensity: 0.30,
  });

  const fullSeafloorY = (x, z) => {
    const h =
      2.2 * Math.sin(x * 0.018) * Math.cos(z * 0.018) +
      1.4 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.045 - 0.7) +
      0.6 * Math.sin(x * 0.095 - 2.0) * Math.cos(z * 0.095 + 0.5);
    return -18.5 + h;
  };

  scatterRockField(scene, obstacles, playerObstacles, raycastMeshes, rockMat, {
    centerZ: -10,
    spreadX: 460,
    spreadZ: 420,
    count: 64,
    yMin: -22,
    yMax: -10,
    rMin: 2.4,
    rMax: 7.2,
    getSeafloorY: fullSeafloorY,
  });

  addKelpField(scene, {
    count: 1800,
    area: 620,
    yBase: -18.5,
    centerZ: -20,
    getSeafloorY: fullSeafloorY,
  });

  addCoralClusters(scene, obstacles, playerObstacles, raycastMeshes);
  addDebris(scene, obstacles, playerObstacles, raycastMeshes);

  return {
    getSeafloorY: fullSeafloorY,
    getWaterSurfaceY() { return 48; }
  };
}

function makeKelpRibbonGeometry({ width = 0.7, height = 1.0, segs = 10, bend = 0.22, twist = 0.25, taper = 0.75 } = {}) {
  const geo = new THREE.PlaneGeometry(width, height, 1, segs);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (v.y / height) + 0.5;
    const taperK = 1.0 - taper * t;
    v.x *= taperK;
    const s = Math.sin(t * Math.PI);
    v.z += s * bend;
    const ang = (t - 0.5) * twist;
    const cx = v.x * Math.cos(ang) - v.z * Math.sin(ang);
    const cz = v.x * Math.sin(ang) + v.z * Math.cos(ang);
    v.x = cx;
    v.z = cz;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function addKelpField(scene, {
  count = 500,
  area = 520,
  yBase = -18.5,
  getSeafloorY = null,
  centerZ = 0
} = {}) {
  const group = new THREE.Group();

  const kelpMat = new THREE.MeshStandardMaterial({
    color: 0x1a8d63,
    roughness: 0.90,
    metalness: 0.0,
    emissive: 0x02130b,
    emissiveIntensity: 0.50,
    side: THREE.DoubleSide,
  });

  const g1 = makeKelpRibbonGeometry({ width: 0.75, height: 1, segs: 10, bend: 0.22, twist: 0.22, taper: 0.72 });
  const g2 = makeKelpRibbonGeometry({ width: 0.70, height: 1, segs: 12, bend: 0.28, twist: 0.30, taper: 0.76 });
  const g3 = makeKelpRibbonGeometry({ width: 0.65, height: 1, segs: 9,  bend: 0.18, twist: 0.18, taper: 0.70 });

  const a = new THREE.InstancedMesh(g1, kelpMat, count);
  const b = new THREE.InstancedMesh(g2, kelpMat, count);
  const c = new THREE.InstancedMesh(g3, kelpMat, count);

  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * area;
    const z = centerZ + (Math.random() - 0.5) * area;
    const floorY = (typeof getSeafloorY === "function") ? getSeafloorY(x, z) : yBase;

    const stalkH = 4.2 + Math.random() * 10.2;
    const stalkW = 0.85 + Math.random() * 0.55;

    const yaw = Math.random() * Math.PI * 2;
    const lean = (Math.random() - 0.5) * 0.28;

    const fronds = 3 + Math.floor(Math.random() * 3);

    dummy.position.set(x, floorY + stalkH * 0.5, z);
    dummy.rotation.set(lean, yaw, 0);
    dummy.scale.set(stalkW, stalkH, 1);
    dummy.updateMatrix();
    a.setMatrixAt(i, dummy.matrix);

    const yaw2 = yaw + Math.PI / 2 + (Math.random() - 0.5) * 0.35;
    dummy.position.set(x, floorY + stalkH * 0.5, z);
    dummy.rotation.set(lean, yaw2, 0);
    dummy.scale.set(stalkW * 0.95, stalkH * (0.90 + Math.random() * 0.20), 1);
    dummy.updateMatrix();
    b.setMatrixAt(i, dummy.matrix);

    const yaw3 = yaw + (Math.random() - 0.5) * 0.9;
    dummy.position.set(
      x + (Math.random() - 0.5) * (0.55 + 0.25 * fronds),
      floorY + stalkH * 0.5,
      z + (Math.random() - 0.5) * (0.55 + 0.25 * fronds)
    );
    dummy.rotation.set(lean * 0.8, yaw3, 0);
    dummy.scale.set(stalkW * 0.85, stalkH * (0.78 + Math.random() * 0.26), 1);
    dummy.updateMatrix();
    c.setMatrixAt(i, dummy.matrix);
  }

  a.instanceMatrix.needsUpdate = true;
  b.instanceMatrix.needsUpdate = true;
  c.instanceMatrix.needsUpdate = true;

  group.add(a);
  group.add(b);
  group.add(c);

  scene.add(group);
  return group;
}

function createMarineSnow(scene, mode) {
  const count = mode === "prototype" ? 900 : 1400;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const p3 = i * 3;
    positions[p3 + 0] = (Math.random() - 0.5) * 520;
    positions[p3 + 1] = -18 + Math.random() * 70;
    positions[p3 + 2] = (Math.random() - 0.5) * 520;
    speeds[i] = 0.8 + Math.random() * 1.6;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xeefcff,
    size: 0.10,
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  return { points, speeds, count };
}

function updateMarineSnow(particles, dt) {
  if (!particles) return;
  const { points, speeds, count } = particles;
  const pos = points.geometry.attributes.position;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i) - speeds[i] * dt;
    pos.setY(i, y < -30 ? 60 : y);
  }
  pos.needsUpdate = true;
}

function addDimSky(scene) {
  const radius = 3000;
  const skyGeo = new THREE.SphereGeometry(radius, 48, 48);
  skyGeo.scale(1, 1, -1);

  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x12586d,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  const sunGeo = new THREE.SphereGeometry(60, 24, 24);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff8d9 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(0, 3000, 0);
  sun.renderOrder = 0;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0xeafcff, 0x0b2f38, 0.24);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xfff8d9, 0.42);
  dir.position.copy(sun.position);
  scene.add(dir);
}

function scatterRockField(scene, obstacles, playerObstacles, raycastMeshes, rockMat, opts) {
  const {
    centerZ = 0,
    spreadX = 200,
    spreadZ = 200,
    count = 40,
    yMin = -12,
    yMax = -6,
    rMin = 2.0,
    rMax = 6.0,
    getSeafloorY = null,
  } = opts || {};

  const geo = new THREE.IcosahedronGeometry(2.2, 0);

  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    const s = r / 2.2;
    const rock = new THREE.Mesh(geo, rockMat);
    rock.scale.setScalar(s);

    const rx = (Math.random() - 0.5) * spreadX;
    const rz = centerZ + (Math.random() - 0.5) * spreadZ;

    let ry;
    if (typeof getSeafloorY === "function") {
      const floorY = getSeafloorY(rx, rz);
      ry = floorY + 0.02;
    } else {
      ry = (yMin + Math.random() * (yMax - yMin)) - 1.0;
    }

    rock.position.set(rx, ry, rz);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(rock);
    raycastMeshes.push(rock);

    const box = new THREE.Box3().setFromObject(rock);
    playerObstacles.push({ type: "box", box });

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    obstacles.push({ center: sphere.center.clone(), radius: sphere.radius, kind: "rock" });
  }
}

function createShipwreck({ scale = 1, color = 0x2d3f4a, accent = 0x1b2a33 } = {}) {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.9, metalness: 0.0 });

  const hullGeo = new THREE.BoxGeometry(10 * scale, 3.2 * scale, 28 * scale);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  group.add(hull);

  const deckGeo = new THREE.BoxGeometry(9.2 * scale, 0.6 * scale, 22 * scale);
  const deck = new THREE.Mesh(deckGeo, accentMat);
  deck.position.set(0, 1.5 * scale, 1.0 * scale);
  group.add(deck);

  const cabGeo = new THREE.BoxGeometry(6.4 * scale, 3.2 * scale, 6.8 * scale);
  const cabin = new THREE.Mesh(cabGeo, accentMat);
  cabin.position.set(0, 3.0 * scale, -5.8 * scale);
  group.add(cabin);

  const mastGeo = new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 12 * scale, 10);
  const mast = new THREE.Mesh(mastGeo, hullMat);
  mast.position.set(1.5 * scale, 6.0 * scale, 3.0 * scale);
  mast.rotation.z = 1.1;
  group.add(mast);

  const ribGeo = new THREE.BoxGeometry(0.4 * scale, 2.4 * scale, 6.0 * scale);
  for (let i = -3; i <= 3; i++) {
    const rib = new THREE.Mesh(ribGeo, accentMat);
    rib.position.set(i * 1.2 * scale, -0.2 * scale, 4.5 * scale);
    rib.rotation.y = (Math.random() - 0.5) * 0.2;
    rib.rotation.z = (Math.random() - 0.5) * 0.2;
    group.add(rib);
  }

  return { group };
}

function addShipwreckColliders(group, playerObstacles, obstacles, { boxShrink = 0, spheres = [] } = {}) {
  const box = new THREE.Box3().setFromObject(group);
  if (boxShrink > 0) box.expandByScalar(-boxShrink);
  if (box.min.x <= box.max.x && box.min.y <= box.max.y && box.min.z <= box.max.z) {
    playerObstacles.push({ type: "box", box });
  }
  for (const s of spheres) {
    const center = s.offset.clone();
    group.localToWorld(center);
    obstacles.push({ center, radius: s.radius });
  }
}

function addCoralClusters(scene, obstacles, playerObstacles, raycastMeshes) {
  const coralMat = new THREE.MeshStandardMaterial({
    color: 0x2f8a72,
    roughness: 0.95,
    metalness: 0.0,
    emissive: 0x020403,
  });

  const stemGeo = new THREE.CylinderGeometry(0.25, 0.45, 2.2, 8);
  const bulbGeo = new THREE.SphereGeometry(0.55, 10, 8);

  for (let i = 0; i < 36; i++) {
    const g = new THREE.Group();
    const x = (Math.random() - 0.5) * 520;
    const z = (Math.random() - 0.5) * 520;
    const y = (-19.5 + Math.random() * 4.5) - 1.0;

    g.position.set(x, y, z);
    g.rotation.y = Math.random() * Math.PI * 2;

    const stems = 2 + Math.floor(Math.random() * 4);
    for (let s = 0; s < stems; s++) {
      const stem = new THREE.Mesh(stemGeo, coralMat);
      stem.position.set((Math.random() - 0.5) * 1.6, 1.1, (Math.random() - 0.5) * 1.6);
      stem.rotation.z = (Math.random() - 0.5) * 0.5;
      g.add(stem);

      const bulb = new THREE.Mesh(bulbGeo, coralMat);
      bulb.position.copy(stem.position).add(new THREE.Vector3(0, 1.2, 0));
      g.add(bulb);
    }

    scene.add(g);

    const box = new THREE.Box3().setFromObject(g);
    playerObstacles.push({ type: "box", box });

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    obstacles.push({kind: "coral", center: sphere.center.clone(), radius: sphere.radius + 0.2 });

    g.traverse((obj) => { if (obj.isMesh) raycastMeshes.push(obj); });
  }
}

function addDebris(scene, obstacles, playerObstacles, raycastMeshes) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a2a33,
    roughness: 0.98,
    metalness: 0.0,
  });

  const plankGeo = new THREE.BoxGeometry(3.2, 0.2, 0.7);
  const pipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.0, 10);

  for (let i = 0; i < 34; i++) {
    const isPipe = Math.random() < 0.4;
    const m = new THREE.Mesh(isPipe ? pipeGeo : plankGeo, mat);

    m.position.set(
      -45 + (Math.random() - 0.5) * 60,
      (-18 + Math.random() * 6) - 1.0,
      -50 + (Math.random() - 0.5) * 60
    );
    m.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(m);
    raycastMeshes.push(m);

    const box = new THREE.Box3().setFromObject(m);
    playerObstacles.push({ type: "box", box });

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    obstacles.push({ center: sphere.center.clone(), radius: sphere.radius });
  }
}

async function addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, { mode = "full", position = new THREE.Vector3(), rotationY = 0, scale = 1 } = {}) {
  if (mode === "prototype") {
    const w = 4.5 * scale;
    const d = 3.0 * scale;
    const h = 0.6 * scale;
    const mat = new THREE.MeshStandardMaterial({ color: 0x2d6774, roughness: 0.98, metalness: 0 });
    const geo = new THREE.BoxGeometry(w, h, d);
    const rect = new THREE.Mesh(geo, mat);
    rect.position.copy(position);
    rect.rotation.y = rotationY;
    scene.add(rect);
    raycastMeshes.push(rect);

    const box = new THREE.Box3().setFromObject(rect);
    playerObstacles.push({ type: "box", box });

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    obstacles.push({ center: sphere.center.clone(), radius: sphere.radius });
    return;
  }

  try {
    const { scene: planeScene } = await loadGLBScene("src/entities/sunken_plane_in_the_morrison_quarry_gltf/scene.gltf");
    const group = new THREE.Group();
    group.add(planeScene);
    group.position.copy(position);
    group.rotation.y = rotationY;
    group.scale.setScalar(scale);
    scene.add(group);

    group.traverse((obj) => { if (obj.isMesh) raycastMeshes.push(obj); });

    const box = new THREE.Box3().setFromObject(group);
    box.expandByScalar(-8.0);
    if (box.min.x <= box.max.x && box.min.y <= box.max.y && box.min.z <= box.max.z) {
      playerObstacles.push({ type: "box", box });
    }

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    obstacles.push({ center: sphere.center.clone(), radius: sphere.radius * 0.16 + 0.07 });
  } catch (e) {
    addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, { mode: "prototype", position, rotationY, scale });
  }
}

function addWaterOverlay(scene, { mode = "full" } = {}) {
  const geo = new THREE.PlaneGeometry(620, 620, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: mode === "full" ? 0x6fd3ea : 0x75d7ee,
    roughness: 0.12,
    metalness: 0.0,
    transparent: false,
    opacity: 1.0,
    emissive: 0x0c343b,
    emissiveIntensity: 0.50,
    depthWrite: true,
  });
  mat.fog = true;
  const overlay = new THREE.Mesh(geo, mat);
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 48;
  overlay.receiveShadow = true;
  overlay.renderOrder = 2;
  scene.add(overlay);
}

function addPrototypeRectObstacle(scene, obstacles, playerObstacles, raycastMeshes, { position = new THREE.Vector3(), size = new THREE.Vector3(10, 2, 20), rotationY = 0, color = 0x20333b } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0 });
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const rect = new THREE.Mesh(geo, mat);
  rect.position.copy(position);
  rect.rotation.y = rotationY;
  rect.castShadow = true;
  rect.receiveShadow = true;
  scene.add(rect);
  raycastMeshes.push(rect);

  const box = new THREE.Box3().setFromObject(rect);
  playerObstacles.push({ type: "box", box });

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  obstacles.push({ center: sphere.center.clone(), radius: sphere.radius });
}