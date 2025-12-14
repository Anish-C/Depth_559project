import * as THREE from "three";

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x04131a);
  scene.fog = new THREE.FogExp2(0x04131a, 0.012);

  const ambient = new THREE.AmbientLight(0x3b6b80, 1.15);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x9ad7ff, 0x061016, 0.95);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xbfe9ff, 0.45);
  sun.position.set(0, 40, 20);
  scene.add(sun);

  const key = new THREE.PointLight(0x9fe5ff, 2.0, 260);
  key.position.set(0, 16, 10);
  key.userData.t = 0;
  scene.add(key);

  // Seafloor
  const floorGeo = new THREE.PlaneGeometry(520, 520, 1, 1);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x10252e,
    roughness: 1,
    metalness: 0,
    emissive: 0x010304,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -10;
  scene.add(floor);

  const obstacles = [];
  const raycastMeshes = [];

  // Rocks (fewer)
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x0f2630,
    roughness: 1,
    metalness: 0,
  });

//   scatterRockField(scene, obstacles, raycastMeshes, rockMat, { centerZ: -40,  spreadX: 180, spreadZ: 80, count: 8 });
//   scatterRockField(scene, obstacles, raycastMeshes, rockMat, { centerZ: -115, spreadX: 220, spreadZ: 95, count: 10 });
//   scatterRockField(scene, obstacles, raycastMeshes, rockMat, { centerZ: -205, spreadX: 200, spreadZ: 85, count: 8 });

  // Stations (still just visuals; harpoon can hit them)
//   addStation(scene, raycastMeshes, new THREE.Vector3(35, -8.5, -55));
//   addStation(scene, raycastMeshes, new THREE.Vector3(-50, -8.5, -125));
//   addStation(scene, raycastMeshes, new THREE.Vector3(20, -8.5, -190));

  // Marine snow particles
  const particles = makeMarineSnow();
  scene.add(particles.points);

  return { keyLight: key, particles, obstacles, raycastMeshes };
}

export function updateWorld(world, dt) {
  const k = world.keyLight;
  k.userData.t += dt;
  const t = k.userData.t;
  k.intensity = 1.95 + 0.08 * Math.sin(t * 5.5) + 0.04 * Math.sin(t * 12.5);

  updateMarineSnow(world.particles, dt);
}

function scatterRockField(scene, obstacles, raycastMeshes, rockMat, opts) {
  const { centerZ, spreadX, spreadZ, count } = opts;

  // Use an icosa for rock look
  const geo = new THREE.IcosahedronGeometry(2.2, 0);

  for (let i = 0; i < count; i++) {
    const s = 1.6 + Math.random() * 2.4; // fewer but chunkier
    const rock = new THREE.Mesh(geo, rockMat);

    rock.position.set(
      (Math.random() - 0.5) * spreadX,
      -9.3 + Math.random() * 2.0,
      centerZ + (Math.random() - 0.5) * spreadZ
    );
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.setScalar(s);
    scene.add(rock);

    raycastMeshes.push(rock);

    // Collision sphere approximation
    const radius = 2.35 * s;
    obstacles.push({ center: rock.position.clone(), radius });
  }
}

function addStation(scene, raycastMeshes, basePos) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a4652, roughness: 0.95 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a6a7a, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x112233, roughness: 0.4 });

  const pod = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 3.0, 14), bodyMat);
  pod.position.copy(basePos).add(new THREE.Vector3(0, 2.2, 0));
  scene.add(pod);
  raycastMeshes.push(pod);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), glassMat);
  dome.position.copy(pod.position).add(new THREE.Vector3(1.2, 2.1, -0.7));
  scene.add(dome);
  raycastMeshes.push(dome);

  const box = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.8, 3.5), trimMat);
  box.position.copy(basePos).add(new THREE.Vector3(-6.0, 1.7, 0));
  scene.add(box);
  raycastMeshes.push(box);

  const light = new THREE.PointLight(0x9fe5ff, 0.9, 45);
  light.position.copy(pod.position).add(new THREE.Vector3(0, 4.0, 0));
  scene.add(light);
}

// particles
function makeMarineSnow() {
  const count = 650;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 220;
    positions[i * 3 + 1] = -4 + Math.random() * 30;
    positions[i * 3 + 2] = 20 - Math.random() * 240;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xbfe9ff,
    size: 0.06,
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);

  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) speeds[i] = 0.22 + Math.random() * 0.55;

  return { points, speeds, count };
}

function updateMarineSnow(ps, dt) {
  const posAttr = ps.points.geometry.getAttribute("position");
  const arr = posAttr.array;

  for (let i = 0; i < ps.count; i++) {
    const idx = i * 3;
    arr[idx + 1] += ps.speeds[i] * dt;
    arr[idx + 0] += (Math.sin((arr[idx + 2] + i) * 0.02) * 0.09) * dt;

    if (arr[idx + 1] > 26) {
      arr[idx + 1] = -4;
      arr[idx + 0] = (Math.random() - 0.5) * 220;
      arr[idx + 2] = 20 - Math.random() * 240;
    }
  }

  posAttr.needsUpdate = true;
}