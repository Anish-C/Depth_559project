/**
 * Underwater Environment with Three.js
 * 
 * Creates an immersive underwater scene with:
 * - Rocky ocean floor terrain
 * - First-person POV controls
 * - Underwater lighting and effects
 * - Customizable parameters
 */

// Scene configuration
const CONFIG = {
    // Terrain settings
    terrain: {
        width: 200,
        depth: 200,
        segments: 100,
        heightScale: 15,
        rockiness: 0.8,  // 0-1, higher = more rocky
    },
    // Water/fog settings
    fog: {
        enabled: true,
        color: 0x001a33,
        near: 10,
        far: 150,
    },
    // Lighting
    lighting: {
        ambientIntensity: 0.4,
        directionalIntensity: 0.8,
        directionalColor: 0x4dd0e1,
    },
    // Camera/movement
    camera: {
        fov: 75,
        near: 0.1,
        far: 1000,
        startY: 10,  // Height above terrain
    },
    movement: {
        speed: 0.2,
        lookSpeed: 0.002,
    }
};

// Global variables
let scene, camera, renderer;
let terrain;
let clock;
let controls = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
};
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let euler = new THREE.Euler(0, 0, 0, 'YXZ');
let isLocked = false;

/**
 * Initialize the underwater scene
 */
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.fog.color);
    
    // Add fog for underwater effect
    if (CONFIG.fog.enabled) {
        scene.fog = new THREE.Fog(
            CONFIG.fog.color,
            CONFIG.fog.near,
            CONFIG.fog.far
        );
    }
    
    // Create camera
    camera = new THREE.PerspectiveCamera(
        CONFIG.camera.fov,
        window.innerWidth / window.innerHeight,
        CONFIG.camera.near,
        CONFIG.camera.far
    );
    camera.position.set(0, CONFIG.camera.startY, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
    // Add lighting
    setupLighting();
    
    // Create terrain
    createTerrain();
    
    // Add underwater particles (floating debris/plankton)
    addParticles();
    
    // Add some rocks and details
    addRocks();
    
    // Setup controls
    setupControls();
    
    // Setup UI controls
    setupUIControls();
    
    // Clock for animations
    clock = new THREE.Clock();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Start animation loop
    animate();
    
    console.log('Underwater environment initialized!');
}

/**
 * Setup lighting for underwater scene
 */
function setupLighting() {
    // Ambient light (simulates scattered light underwater)
    const ambientLight = new THREE.AmbientLight(
        0x4dd0e1,
        CONFIG.lighting.ambientIntensity
    );
    ambientLight.name = 'ambientLight';
    scene.add(ambientLight);
    
    // Directional light (simulates sun penetrating water)
    const directionalLight = new THREE.DirectionalLight(
        CONFIG.lighting.directionalColor,
        CONFIG.lighting.directionalIntensity
    );
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.name = 'directionalLight';
    scene.add(directionalLight);
    
    // Add a subtle point light for atmosphere
    const pointLight = new THREE.PointLight(0x00ffff, 0.5, 100);
    pointLight.position.set(0, 20, 0);
    pointLight.name = 'pointLight';
    scene.add(pointLight);
}

/**
 * Create rocky ocean floor terrain using PlaneGeometry with noise
 */
function createTerrain() {
    const geometry = new THREE.PlaneGeometry(
        CONFIG.terrain.width,
        CONFIG.terrain.depth,
        CONFIG.terrain.segments,
        CONFIG.terrain.segments
    );
    
    // Apply rocky terrain using Perlin-like noise
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 1];
        
        // Multi-octave noise for rocky appearance
        let height = 0;
        let frequency = 0.02;
        let amplitude = 1;
        
        for (let octave = 0; octave < 4; octave++) {
            height += noise(x * frequency, z * frequency) * amplitude;
            frequency *= 2;
            amplitude *= 0.5;
        }
        
        // Add extra rockiness
        height *= CONFIG.terrain.heightScale * CONFIG.terrain.rockiness;
        
        // Add some sharp peaks for rocks
        const rockFactor = Math.abs(noise(x * 0.05, z * 0.05));
        if (rockFactor > 0.6) {
            height += (rockFactor - 0.6) * 20;
        }
        
        vertices[i + 2] = height;
    }
    
    geometry.computeVertexNormals();
    
    // Create material with rock-like appearance
    const material = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: false,
    });
    
    terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    scene.add(terrain);
}

/**
 * Simple noise function (using sine waves for simplicity)
 */
function noise(x, y) {
    return (Math.sin(x * 1.5) + Math.sin(y * 1.5) + 
            Math.sin((x + y) * 0.5) + Math.sin((x - y) * 0.7)) / 4;
}

/**
 * Add floating particles for underwater atmosphere
 */
function addParticles() {
    const particleCount = 1000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;      // x
        positions[i + 1] = Math.random() * 50;            // y
        positions[i + 2] = (Math.random() - 0.5) * 200;  // z
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.3,
        transparent: true,
        opacity: 0.6,
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.name = 'particles';
    scene.add(particles);
}

/**
 * Add larger rock formations on the terrain
 */
function addRocks() {
    const rockCount = 30;
    
    for (let i = 0; i < rockCount; i++) {
        // Random rock size
        const size = Math.random() * 3 + 1;
        const geometry = new THREE.DodecahedronGeometry(size, 0);
        
        // Rock material
        const material = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a,
            roughness: 1,
            metalness: 0,
        });
        
        const rock = new THREE.Mesh(geometry, material);
        
        // Random position
        rock.position.x = (Math.random() - 0.5) * CONFIG.terrain.width * 0.8;
        rock.position.z = (Math.random() - 0.5) * CONFIG.terrain.depth * 0.8;
        rock.position.y = -2; // Slightly embedded in terrain
        
        // Random rotation
        rock.rotation.x = Math.random() * Math.PI;
        rock.rotation.y = Math.random() * Math.PI;
        rock.rotation.z = Math.random() * Math.PI;
        
        rock.castShadow = true;
        rock.receiveShadow = true;
        
        scene.add(rock);
    }
}

/**
 * Setup first-person controls
 */
function setupControls() {
    // Keyboard controls
    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                controls.moveForward = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                controls.moveBackward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                controls.moveLeft = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                controls.moveRight = true;
                break;
            case 'Space':
                controls.moveUp = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                controls.moveDown = true;
                break;
        }
    });
    
    document.addEventListener('keyup', (event) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                controls.moveForward = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                controls.moveBackward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                controls.moveLeft = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                controls.moveRight = false;
                break;
            case 'Space':
                controls.moveUp = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                controls.moveDown = false;
                break;
        }
    });
    
    // Mouse controls for looking around
    document.addEventListener('click', () => {
        if (!isLocked) {
            renderer.domElement.requestPointerLock();
        }
    });
    
    document.addEventListener('pointerlockchange', () => {
        isLocked = document.pointerLockElement === renderer.domElement;
    });
    
    document.addEventListener('mousemove', (event) => {
        if (!isLocked) return;
        
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        euler.setFromQuaternion(camera.quaternion);
        
        euler.y -= movementX * CONFIG.movement.lookSpeed;
        euler.x -= movementY * CONFIG.movement.lookSpeed;
        
        // Limit vertical rotation
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        
        camera.quaternion.setFromEuler(euler);
    });
}

/**
 * Setup UI control buttons
 */
function setupUIControls() {
    // Toggle fog
    document.getElementById('toggleFog').addEventListener('click', () => {
        CONFIG.fog.enabled = !CONFIG.fog.enabled;
        if (CONFIG.fog.enabled) {
            scene.fog = new THREE.Fog(
                CONFIG.fog.color,
                CONFIG.fog.near,
                CONFIG.fog.far
            );
        } else {
            scene.fog = null;
        }
    });
    
    // Toggle lighting
    document.getElementById('toggleLighting').addEventListener('click', () => {
        const lights = ['ambientLight', 'directionalLight', 'pointLight'];
        lights.forEach(name => {
            const light = scene.getObjectByName(name);
            if (light) {
                light.visible = !light.visible;
            }
        });
    });
    
    // Regenerate terrain
    document.getElementById('regenerateTerrain').addEventListener('click', () => {
        // Remove old terrain
        const oldTerrain = scene.getObjectByName('terrain');
        if (oldTerrain) {
            scene.remove(oldTerrain);
            oldTerrain.geometry.dispose();
            oldTerrain.material.dispose();
        }
        
        // Randomize terrain parameters
        CONFIG.terrain.heightScale = Math.random() * 20 + 10;
        CONFIG.terrain.rockiness = Math.random() * 0.5 + 0.5;
        
        // Create new terrain
        createTerrain();
    });
}

/**
 * Handle window resize
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Update camera position based on controls
 */
function updateMovement(delta) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= velocity.y * 10.0 * delta;
    
    direction.z = Number(controls.moveForward) - Number(controls.moveBackward);
    direction.x = Number(controls.moveRight) - Number(controls.moveLeft);
    direction.y = Number(controls.moveUp) - Number(controls.moveDown);
    direction.normalize();
    
    if (controls.moveForward || controls.moveBackward) {
        velocity.z -= direction.z * CONFIG.movement.speed * delta;
    }
    if (controls.moveLeft || controls.moveRight) {
        velocity.x -= direction.x * CONFIG.movement.speed * delta;
    }
    if (controls.moveUp || controls.moveDown) {
        velocity.y += direction.y * CONFIG.movement.speed * delta;
    }
    
    camera.translateX(velocity.x);
    camera.translateY(velocity.y);
    camera.translateZ(velocity.z);
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Update movement
    if (isLocked) {
        updateMovement(delta);
    }
    
    // Animate particles (slow floating motion)
    const particles = scene.getObjectByName('particles');
    if (particles) {
        particles.rotation.y += 0.0001;
        const positions = particles.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
            positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.001;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Render scene
    renderer.render(scene, camera);
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
