import * as THREE from "three";
import { loadGLBScene } from "../engine/assets.js";

/**
 * buildWorld(scene, mode)
 * - mode: "prototype" | "full"
 *
 * Returns:
 * {
 *   keyLight, particles,
 *   obstacles,        // sphere obstacles for sharks/crawler: [{center, radius}]
 *   playerObstacles,  // colliders for player: [{type:"box", box:THREE.Box3}, {type:"sphere", center, radius}]
 *   raycastMeshes,    // meshes to raycast against (floor + props)
 *   getSeafloorY(x,z) // basic height helper (approx)
 * }
 */
export function buildWorld(scene, mode = "full") {
  scene.background = new THREE.Color(0x04131a);
  scene.fog = new THREE.FogExp2(0x04131a, 0.010);

  const obstacles = [];
  const playerObstacles = [];
  const raycastMeshes = [];

  // Lighting
  const ambient = new THREE.AmbientLight(0x3b6b80, 1.10);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x9ad7ff, 0x061016, 0.90);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xbfe9ff, 0.45);
  sun.position.set(0, 50, 20);
  scene.add(sun);

  const keyLight = new THREE.PointLight(0x9fe5ff, 2.0, 280);
  keyLight.position.set(0, 18, 10);
  keyLight.userData.t = 0;
  scene.add(keyLight);

  // Build geometry depending on mode
  const seafloor = (mode === "prototype")
    ? buildPrototypeWorld(scene, obstacles, playerObstacles, raycastMeshes)
    : buildFullOceanWorld(scene, obstacles, playerObstacles, raycastMeshes);

  // Marine snow particles (both modes)
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
  k.intensity = 1.95 + 0.08 * Math.sin(t * 5.5) + 0.04 * Math.sin(t * 12.5);

  updateMarineSnow(world.particles, dt);
}

/* =========================
   Prototype world (old style)
   ========================= */
function buildPrototypeWorld(scene, obstacles, playerObstacles, raycastMeshes) {
  scene.background = new THREE.Color(0x04131a);
  scene.fog = new THREE.FogExp2(0x04131a, 0.012);
  addDimSky(scene);

  // Seafloor
  const floorGeo = new THREE.PlaneGeometry(520, 520, 120, 120);
  // add slight displacement for interest
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const n = 0.9 * Math.sin(x * 0.035) * Math.cos(y * 0.035);
    pos.setZ(i, n);
  }
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x10252e,
    roughness: 1,
    metalness: 0,
    emissive: 0x010304,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -10.5;
  floor.receiveShadow = true;
  scene.add(floor);
  raycastMeshes.push(floor);
  // Caustics overlay on seafloor
  addCausticsOverlay(scene, -10.5, 520);
  // Prototype water surface overlay (basic), used for visual split
  addWaterOverlay(scene, { mode: "prototype" });
  // Sunken plane (prototype: rectangle hitbox)
  addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, {
    mode: "prototype",
    // moved 50 away from center along X
    position: new THREE.Vector3(30, -12.0, 95),
    rotationY: Math.PI * 0.12,
    scale: 0.5,
  });
  // Second prototype plane, 600 units behind
  addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, {
    mode: "prototype",
    position: new THREE.Vector3(30, -12.0, -505),
    rotationY: Math.PI * 0.12,
    scale: 0.5,
  });

  // Prototype shipwreck: simple rectangle footprint
  addPrototypeRectObstacle(scene, obstacles, playerObstacles, raycastMeshes, {
    position: new THREE.Vector3(-35, -10.4, -45),
    size: new THREE.Vector3(18, 2, 50),
    rotationY: Math.PI / 6,
    color: 0x20333b,
  });

  // Rock field (few chunky rocks)
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x1b3a44,
    roughness: 1,
    metalness: 0.0,
  });

  scatterRockField(scene, obstacles, playerObstacles, raycastMeshes, rockMat, {
    centerZ: -18,
    spreadX: 220,
    spreadZ: 220,
    count: 42,
    yMin: -12.0,
    yMax: -6.5,
    rMin: 2.6,
    rMax: 6.8,
    getSeafloorY: (x, z) => {
      const n = 0.9 * Math.sin(x * 0.035) * Math.cos(z * 0.035);
      return -10.5 + n;
    },
  });

  return {
    getSeafloorY(x, z) {
      // plane displaced around y=-10.5; approx using same sinusoid
      const n = 0.9 * Math.sin(x * 0.035) * Math.cos(z * 0.035);
      return -10.5 + n;
    },
    getWaterSurfaceY() { return 48; }
  };
}

/* =========================
   Full ocean world (partner-inspired)
   ========================= */
function buildFullOceanWorld(scene, obstacles, playerObstacles, raycastMeshes) {
  // Atmosphere
  scene.background = new THREE.Color(0x0b2230);
  scene.fog = new THREE.FogExp2(0x0b2230, 0.012);
  // Dim sky dome with central sun
  addDimSky(scene);

  // Water surface (visual only) — fuller blue and fog-aware in full mode
  addWaterOverlay(scene, { mode: "full" });

  // Seafloor (displaced)
  const floorGeo = new THREE.PlaneGeometry(620, 620, 180, 180);
  const pos = floorGeo.attributes.position;
  // Simple fBM-ish
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
    color: 0x0f2a33,
    roughness: 1,
    metalness: 0,
    emissive: 0x010304,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -18.5;
  floor.receiveShadow = true;
  scene.add(floor);
  raycastMeshes.push(floor);
  // Caustics overlay on seafloor
  addCausticsOverlay(scene, -18.5, 620);
  // Sunken plane GLTF obstacle
  addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, {
    mode: "full",
    // moved 50 away from center along X
    position: new THREE.Vector3(72, -18.8, 102),
    rotationY: Math.PI * -0.18,
    scale: 0.5,
  });
  // Second full plane, 600 units behind
  addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, {
    mode: "full",
    position: new THREE.Vector3(72, -18.8, -498),
    rotationY: Math.PI * -0.18,
    scale: 0.5,
  });

  // “Shipwreck” using primitives (partner-style feel)
  const ship = createShipwreck({
    scale: 2.0,
    color: 0x2d3f4a,
    accent: 0x1b2a33,
  });
  ship.group.position.set(-35, -15.5, -45);
  ship.group.rotation.y = Math.PI / 6;
  ship.group.rotation.z = 0.12;
  scene.add(ship.group);

  // Colliders from ship group:
// tighter: shrink the player box & shrink NPC sphere so things can pass around it
  addGroupColliders(ship.group, playerObstacles, obstacles, raycastMeshes, {
    spherePadding: 0.15,
    sphereScale: 0.55,  // ✅ shrink NPC collision sphere a lot
    boxShrink: 2.4      // ✅ shrink player AABB collider a bit
  });
  
  // Rock fields
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x163741,
    roughness: 1,
    metalness: 0.0,
  });

  scatterRockField(scene, obstacles, playerObstacles, raycastMeshes, rockMat, {
    centerZ: -10,
    spreadX: 460,
    spreadZ: 420,
    count: 64,
    yMin: -22,
    yMax: -10,
    rMin: 2.4,
    rMax: 7.2,
    getSeafloorY: (x, z) => {
      const h =
        2.2 * Math.sin(x * 0.018) * Math.cos(z * 0.018) +
        1.4 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.045 - 0.7) +
        0.6 * Math.sin(x * 0.095 - 2.0) * Math.cos(z * 0.095 + 0.5);
      return -18.5 + h;
    },
  });

  // Coral clusters (simple)
  addCoralClusters(scene, obstacles, playerObstacles, raycastMeshes);

  // Debris field near ship
  addDebris(scene, obstacles, playerObstacles, raycastMeshes);

  return {
    getSeafloorY(x, z) {
      // approximate height function used for floor displacement
      const h =
        2.2 * Math.sin(x * 0.018) * Math.cos(z * 0.018) +
        1.4 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.045 - 0.7) +
        0.6 * Math.sin(x * 0.095 - 2.0) * Math.cos(z * 0.095 + 0.5);
      return -18.5 + h;
    },
    getWaterSurfaceY() { return 48; }
  };
}

/* =========================
   Helpers: particles
   ========================= */
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
    color: 0xbfe9ff,
    size: 0.10,
    transparent: true,
    opacity: 0.28,
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
    const p3 = i * 3;
    const y = pos.getY(i) - speeds[i] * dt;
    pos.setY(i, y < -30 ? 60 : y);
  }
  pos.needsUpdate = true;
}

function addDimSky(scene) {
  const radius = 3000;
  const skyGeo = new THREE.SphereGeometry(radius, 64, 64);
  skyGeo.scale(1, 1, -1);

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x0b2230) },
      horizonColor: { value: new THREE.Color(0x123042) },
      bottomColor: { value: new THREE.Color(0x0a1a24) },
      intensity: { value: 0.6 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      uniform float intensity;
      void main() {
        float h = clamp(vWorldPos.y / 3000.0, -1.0, 1.0);
        float t = smoothstep(-0.3, 0.8, h);
        vec3 col = mix(bottomColor, horizonColor, smoothstep(-0.8, 0.0, h));
        col = mix(col, topColor, t);
        gl_FragColor = vec4(col * intensity, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  const sunGeo = new THREE.SphereGeometry(60, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3a1 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(0, 3000, 0);
  sun.renderOrder = 0;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0x9bbbd1, 0x0a1a24, 0.15);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff3a1, 0.25);
  dir.position.copy(sun.position);
  scene.add(dir);
}

/* =========================
   Helpers: obstacles + props
   ========================= */
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
      ry = floorY + 0.02; // slight offset to avoid z-fighting
    } else {
      ry = (yMin + Math.random() * (yMax - yMin)) - 1.0;
    }
    rock.position.set(rx, ry, rz);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(rock);
    raycastMeshes.push(rock);

    // Player collider (AABB)
    const box = new THREE.Box3().setFromObject(rock);
    playerObstacles.push({ type: "box", box });

    // NPC sphere obstacle
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    obstacles.push({ center: sphere.center.clone(), radius: sphere.radius });
  }
}

function addGroupColliders(
    group,
    playerObstacles,
    obstacles,
    raycastMeshes,
    { spherePadding = 0, sphereScale = 1.0, boxShrink = 0 } = {}
  ) {
    // Raycast all meshes
    group.traverse((obj) => {
      if (obj.isMesh) raycastMeshes.push(obj);
    });
  
    // Player collider: shrink the box so it matches "walkable" space better
    const box = new THREE.Box3().setFromObject(group);
    if (boxShrink > 0) box.expandByScalar(-boxShrink);
  
    // Only add if box is still valid (shrink can invert it if too large)
    if (box.min.x <= box.max.x && box.min.y <= box.max.y && box.min.z <= box.max.z) {
      playerObstacles.push({ type: "box", box });
    }
  
    // NPC collider: bounding sphere of (possibly shrunk) box, scaled down
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    obstacles.push({
      center: sphere.center.clone(),
      radius: (sphere.radius * sphereScale) + spherePadding,
    });
  }
  

function createShipwreck({ scale = 1, color = 0x2d3f4a, accent = 0x1b2a33 } = {}) {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.9, metalness: 0.0 });

  // Hull
  const hullGeo = new THREE.BoxGeometry(10 * scale, 3.2 * scale, 28 * scale);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.set(0, 0, 0);
  group.add(hull);

  // Deck
  const deckGeo = new THREE.BoxGeometry(9.2 * scale, 0.6 * scale, 22 * scale);
  const deck = new THREE.Mesh(deckGeo, accentMat);
  deck.position.set(0, 1.5 * scale, 1.0 * scale);
  group.add(deck);

  // Cabin
  const cabGeo = new THREE.BoxGeometry(6.4 * scale, 3.2 * scale, 6.8 * scale);
  const cabin = new THREE.Mesh(cabGeo, accentMat);
  cabin.position.set(0, 3.0 * scale, -5.8 * scale);
  group.add(cabin);

  // Mast (broken)
  const mastGeo = new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 12 * scale, 10);
  const mast = new THREE.Mesh(mastGeo, hullMat);
  mast.position.set(1.5 * scale, 6.0 * scale, 3.0 * scale);
  mast.rotation.z = 1.1;
  group.add(mast);

  // Some ribs
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

function addCoralClusters(scene, obstacles, playerObstacles, raycastMeshes) {
  const coralMat = new THREE.MeshStandardMaterial({
    color: 0x2e6b5b,
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
    addGroupColliders(g, playerObstacles, obstacles, raycastMeshes, { spherePadding: 0.2 });
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

async function addSunkenPlane(
  scene,
  obstacles,
  playerObstacles,
  raycastMeshes,
  { mode = "full", position = new THREE.Vector3(), rotationY = 0, scale = 1 } = {}
) {
  if (mode === "prototype") {
    // Approximate physical footprint with a flat rectangle (half-size)
    const w = 4.5 * scale; // quarter of plane length footprint
    const d = 3.0 * scale; // quarter of wingspan footprint
    const h = 0.6 * scale; // thin
    const mat = new THREE.MeshStandardMaterial({ color: 0x20333b, roughness: 0.98, metalness: 0 });
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

    // Colliders
    addGroupColliders(group, playerObstacles, obstacles, raycastMeshes, {
      spherePadding: 0.08,
      // further reduce collider scale for tighter obstacle footprint
      sphereScale: 0.18,
      // shrink player AABB even more
      boxShrink: 6.5,
    });
  } catch (e) {
    // Fallback to prototype rectangle if asset fails
    addSunkenPlane(scene, obstacles, playerObstacles, raycastMeshes, {
      mode: "prototype",
      position,
      rotationY,
      scale,
    });
  }
}

// Simplified water overlay without GLSL: opaque horizontal plane at the surface height.
function addWaterOverlay(scene, { mode = "full" } = {}) {
  const geo = new THREE.PlaneGeometry(620, 620, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: mode === "full" ? 0x1f6fa3 : 0x2a6590,
    roughness: 0.25,
    metalness: 0.0,
    transparent: false,
    opacity: 1.0,
    emissive: 0x020609,
    depthWrite: true,
  });
  mat.fog = true;
  const overlay = new THREE.Mesh(geo, mat);
  overlay.rotation.x = -Math.PI / 2; // make it horizontal (X-Z plane)
  overlay.position.y = 48;           // define clear split on Y axis
  overlay.receiveShadow = true;
  overlay.renderOrder = 2;
  scene.add(overlay);
}

// Caustics overlay: grid-like glowing lines animated over the seafloor
async function addCausticsOverlay(scene, y = -18.5, size = 620) {
  try {
    const [vert, frag] = await Promise.all([
      fetch('threejs-water-master/shaders/caustics/vertex.glsl').then(r => r.text()),
      fetch('threejs-water-master/shaders/caustics/fragment.glsl').then(r => r.text()),
    ]);

    const uniforms = {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const caustics = new THREE.Mesh(geo, mat);
    caustics.rotation.x = -Math.PI / 2;
    caustics.position.y = y + 0.01; // slight offset to avoid z-fight
    caustics.renderOrder = 3;
    scene.add(caustics);

    caustics.onBeforeRender = () => {
      uniforms.uTime.value = performance.now() * 0.001;
    };
  } catch (e) {
    console.warn('Caustics overlay shader load failed:', e);
  }
}

// Helper: prototype rectangle obstacle (for shipwreck/planewreck placeholders)
function addPrototypeRectObstacle(
  scene,
  obstacles,
  playerObstacles,
  raycastMeshes,
  { position = new THREE.Vector3(), size = new THREE.Vector3(10, 2, 20), rotationY = 0, color = 0x20333b } = {}
) {
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