/*
import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { Sky } from 'https://unpkg.com/three@0.152.2/examples/jsm/objects/Sky.js';

// 3D Underwater Map - Depth 559
// Uses Three.js for 3D rendering

const Game = {
    // Three.js components
    scene: null,
    camera: null,
    renderer: null,
    water: null,
    waterMaterial: null,
    waterSim: {
        size: 256,
        rtA: null,
        rtB: null,
        alt: null,
        quadScene: null,
        quadCamera: null,
        updateMat: null,
        normalMat: null,
        dropMat: null,
        current: null,
        frame: 0,
    },
    caustics: {
        rt: null,
        scene: null,
        camera: null,
        material: null,
    },
    waterNormals: null,
    sky: null,
    skyCube: null,
    directionalLight: null,
    underwaterFog: null,
    underwaterColor: new THREE.Color(0x0e3a5a),
    surfaceClearColor: new THREE.Color(0xffffff),
    poolScale: 400,
    
    // Player movement
    keys: {},
    playerSpeed: 0.5,
    playerVelocity: new THREE.Vector3(0, 0, 0),
    
    // UI
    depthValue: 0,
    
    /**
     * Initialize the 3D underwater scene
     */
    init() {
        console.log('Initializing 3D underwater map...');
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = this.underwaterColor.clone();
        // Darker ocean-like fog - denser for better depth perception
        this.underwaterFog = new THREE.FogExp2(0x0e3a5a, 0.04);
        this.scene.fog = this.underwaterFog;
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // Start slightly below surface in pool
        this.camera.position.set(0, -15, 80);
        this.camera.lookAt(0, -15, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setClearColor(this.underwaterColor);
        document.body.appendChild(this.renderer.domElement);
        
        // Create lighting
        this.setupLighting();

        // Load assets then build water/sky
        this.loadAssets().then(async () => {
            this.createSky();
            await this.createWaterSurface();
            this.createUnderwater();
        });

        // Initialize depth display
        const depthEl = document.getElementById('depthValue');
        if (depthEl) {
            depthEl.textContent = Math.abs(Math.round(this.camera.position.y));
        }
        
        // Setup controls
        this.setupControls();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        console.log('3D underwater map initialized!');
    },
    
    /**
     * Setup lighting
     */
    setupLighting() {
        // Bright ambient for pool clarity
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(ambientLight);
        
        // Strong directional light from above (sun through water)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.directionalLight.position.set(0.7559289460184544, 0.7559289460184544, -0.3779644730092272);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.camera.left = -200;
        this.directionalLight.shadow.camera.right = 200;
        this.directionalLight.shadow.camera.top = 200;
        this.directionalLight.shadow.camera.bottom = -200;
        this.scene.add(this.directionalLight);
    },
    
    /**
     * Create sky
     */
    createSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);
        
        const skyUniforms = this.sky.material.uniforms;
        skyUniforms['turbidity'].value = 1.0;
        skyUniforms['rayleigh'].value = 0.5;
        skyUniforms['mieCoefficient'].value = 0.005;
        skyUniforms['mieDirectionalG'].value = 0.8;
        
        const sun = new THREE.Vector3();
        const phi = THREE.MathUtils.degToRad(90 - 30);
        const theta = THREE.MathUtils.degToRad(180);
        sun.setFromSphericalCoords(1, phi, theta);
        skyUniforms['sunPosition'].value.copy(sun);
        this.sun = sun;

        if (this.skyCube) {
            this.scene.environment = this.skyCube;
        }
    },
    
    /**
     * Create the underwater environment
     */
    createUnderwater() {
        // Create ocean floor
        this.createOceanFloor();
        
        // Create invisible boundary walls (blend with water)
        this.createPoolWalls();
        
        // Add sunken ship
        this.createSunkenShip();
        
        // Some underwater structures scaled to pool
        this.createUndergroundStructures();
        
        // Particles/bubbles for atmosphere
        this.createBubbles();
    },
    
    /**
     * Create the ocean floor
     */
    createOceanFloor() {
        const scale = this.poolScale;
        const floorGeometry = new THREE.PlaneGeometry(scale * 2.5, scale * 2.5, 64, 64);
        
        // Add some variation to floor vertices for a more natural look
        const positions = floorGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            // Create gentle undulations
            const z = Math.sin(x * 0.05) * 2 + Math.cos(y * 0.05) * 2 + Math.random() * 1.5;
            positions.setZ(i, z);
        }
        floorGeometry.computeVertexNormals();
        
        // Sandy ocean floor material
        const floorMaterial = new THREE.MeshPhongMaterial({
            color: 0x3d5c5c,  // Dark blue-gray sandy color
            shininess: 5,
            flatShading: true
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -scale;
        floor.receiveShadow = true;
        this.scene.add(floor);
    },
    
    /**
     * Create sunken ship
     */
    createSunkenShip() {
        const scale = this.poolScale;
        const shipGroup = new THREE.Group();
        
        // Ship hull - main body
        const hullMaterial = new THREE.MeshPhongMaterial({
            color: 0x4a3728,  // Dark weathered wood
            shininess: 10
        });
        
        const deckMaterial = new THREE.MeshPhongMaterial({
            color: 0x5c4033,  // Slightly lighter wood
            shininess: 8
        });
        
        const metalMaterial = new THREE.MeshPhongMaterial({
            color: 0x2a4a3a,  // Corroded metal green
            shininess: 20
        });
        
        // Main hull (elongated box, tapered)
        const hullLength = 60;
        const hullWidth = 18;
        const hullHeight = 12;
        
        // Hull bottom
        const hullGeometry = new THREE.BoxGeometry(hullLength, hullHeight, hullWidth);
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        hull.position.y = hullHeight / 2;
        shipGroup.add(hull);
        
        // Deck
        const deckGeometry = new THREE.BoxGeometry(hullLength - 4, 2, hullWidth - 2);
        const deck = new THREE.Mesh(deckGeometry, deckMaterial);
        deck.position.y = hullHeight + 1;
        shipGroup.add(deck);
        
        // Bow (front triangle)
        const bowGeometry = new THREE.ConeGeometry(hullWidth / 2, 15, 4);
        const bow = new THREE.Mesh(bowGeometry, hullMaterial);
        bow.rotation.z = -Math.PI / 2;
        bow.rotation.y = Math.PI / 4;
        bow.position.set(hullLength / 2 + 6, hullHeight / 2, 0);
        shipGroup.add(bow);
        
        // Cabin/bridge
        const cabinGeometry = new THREE.BoxGeometry(15, 10, 12);
        const cabin = new THREE.Mesh(cabinGeometry, deckMaterial);
        cabin.position.set(-hullLength / 4, hullHeight + 6, 0);
        shipGroup.add(cabin);
        
        // Broken mast
        const mastGeometry = new THREE.CylinderGeometry(0.8, 1.2, 25, 8);
        const mast = new THREE.Mesh(mastGeometry, hullMaterial);
        mast.position.set(5, hullHeight + 12, 0);
        mast.rotation.z = 0.3; // Tilted/broken
        shipGroup.add(mast);
        
        // Second broken mast (shorter)
        const mast2Geometry = new THREE.CylinderGeometry(0.6, 1, 15, 8);
        const mast2 = new THREE.Mesh(mast2Geometry, hullMaterial);
        mast2.position.set(-hullLength / 3 + 5, hullHeight + 8, 0);
        mast2.rotation.z = -0.4;
        mast2.rotation.x = 0.2;
        shipGroup.add(mast2);
        
        // Railings (simple boxes)
        const railGeometry = new THREE.BoxGeometry(hullLength - 10, 3, 0.5);
        const railLeft = new THREE.Mesh(railGeometry, metalMaterial);
        railLeft.position.set(0, hullHeight + 3, hullWidth / 2 - 1);
        shipGroup.add(railLeft);
        
        const railRight = new THREE.Mesh(railGeometry, metalMaterial);
        railRight.position.set(0, hullHeight + 3, -hullWidth / 2 + 1);
        shipGroup.add(railRight);
        
        // Anchor
        const anchorRingGeometry = new THREE.TorusGeometry(2, 0.4, 8, 16);
        const anchor = new THREE.Mesh(anchorRingGeometry, metalMaterial);
        anchor.position.set(hullLength / 2 - 5, hullHeight - 2, hullWidth / 2 + 1);
        anchor.rotation.y = Math.PI / 2;
        shipGroup.add(anchor);
        
        // Cargo boxes scattered on deck
        for (let i = 0; i < 5; i++) {
            const boxSize = 2 + Math.random() * 2;
            const cargoGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
            const cargo = new THREE.Mesh(cargoGeometry, deckMaterial);
            cargo.position.set(
                (Math.random() - 0.5) * 30,
                hullHeight + 2 + boxSize / 2,
                (Math.random() - 0.5) * 8
            );
            cargo.rotation.y = Math.random() * Math.PI;
            cargo.rotation.z = (Math.random() - 0.5) * 0.3;
            shipGroup.add(cargo);
        }
        
        // Position the entire ship
        shipGroup.position.set(scale * 0.4, -scale + 8, -scale * 0.3);
        shipGroup.rotation.y = Math.PI / 6;  // Angled
        shipGroup.rotation.z = 0.15;  // Slight tilt (listing)
        shipGroup.rotation.x = 0.08;  // Slight forward tilt
        
        // Enable shadows for all ship parts
        shipGroup.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        this.scene.add(shipGroup);
    },
    
    /**
     * Create invisible boundary walls that blend with water
     */
    createPoolWalls() {
        const scale = this.poolScale;
        const wallHeight = scale * 2;
        const wallThickness = 5;
        
        // Gradient shader material - blends from water color at top to floor color at bottom
        const wallMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float topY;
                uniform float bottomY;
                uniform float fogDensity;
                uniform vec3 fogColor;
                varying vec3 vWorldPosition;
                
                void main() {
                    // Gradient based on world Y position
                    float t = clamp((vWorldPosition.y - bottomY) / (topY - bottomY), 0.0, 1.0);
                    vec3 gradientColor = mix(bottomColor, topColor, t);
                    
                    // Apply fog
                    float depth = length(cameraPosition - vWorldPosition);
                    float fogFactor = 1.0 - exp(-fogDensity * depth);
                    vec3 finalColor = mix(gradientColor, fogColor, fogFactor);
                    
                    // Fade out near edges (more transparent)
                    float edgeFade = smoothstep(0.0, 0.3, t);
                    float alpha = mix(0.95, 0.7, edgeFade);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            uniforms: {
                topColor: { value: this.underwaterColor.clone() },
                bottomColor: { value: new THREE.Color(0x3d5c5c) },  // Match floor color
                topY: { value: 0 },
                bottomY: { value: -scale },
                fogDensity: { value: 0.02 },
                fogColor: { value: this.underwaterColor.clone() }
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        // Create walls that blend seamlessly
        const walls = [
            { size: [scale * 2.5, wallHeight, wallThickness], pos: [0, -scale * 0.5, scale * 1.25] },
            { size: [scale * 2.5, wallHeight, wallThickness], pos: [0, -scale * 0.5, -scale * 1.25] },
            { size: [wallThickness, wallHeight, scale * 2.5], pos: [scale * 1.25, -scale * 0.5, 0] },
            { size: [wallThickness, wallHeight, scale * 2.5], pos: [-scale * 1.25, -scale * 0.5, 0] }
        ];
        
        walls.forEach(w => {
            const geo = new THREE.BoxGeometry(...w.size);
            const wall = new THREE.Mesh(geo, wallMaterial.clone());
            wall.position.set(...w.pos);
            wall.renderOrder = -1;  // Render behind other objects
            this.scene.add(wall);
        });
    },
    
    /**
     * Create water surface visual
     */
    async createWaterSurface() {
        // Prepare simulation targets and shaders
        await this.initWaterSimulation();

        const scale = this.poolScale;
        // Geometry sized to pool dimensions for consistent UV coverage
        const geometry = new THREE.PlaneGeometry(scale * 2, scale * 2, 256, 256);
        
        // Use a simple water material that responds to the simulation
        // Using Three.js fog chunks for proper scene fog integration
        const waterMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vPos;
                varying vec2 vUv;
                uniform sampler2D water;
                
                #include <fog_pars_vertex>
                
                void main() {
                    vUv = uv;
                    vec4 info = texture2D(water, uv);
                    vec3 pos = position;
                    pos.y += info.r * 0.1;  // Displace by water height
                    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                    vPos = worldPos.xyz;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                varying vec3 vPos;
                varying vec2 vUv;
                uniform sampler2D water;
                uniform sampler2D causticTex;
                uniform float underwater;
                uniform float time;
                uniform vec3 pointLightPos;
                uniform float hasCaustics;
                
                #include <fog_pars_fragment>
                
                void main() {
                    vec4 info = texture2D(water, vUv);
                    
                    // Compute normal from height field
                    vec3 normal = normalize(vec3(info.b, 1.0, info.a));
                    
                    // Fresnel effect
                    vec3 viewDir = normalize(cameraPosition - vPos);
                    float fresnel = mix(0.05, 0.35, pow(1.0 - dot(normal, viewDir), 3.0));

                    // Base water color (darker ocean tone)
                    vec3 waterColor = mix(vec3(0.0, 0.12, 0.28), vec3(0.0, 0.22, 0.42), clamp(info.r + 0.5, 0.0, 1.0));
                    
                    // Add wave pattern visibility
                    vec3 wavePattern = vec3(abs(info.b) * 0.6, abs(info.a) * 0.6, 0.3);
                    
                    // Simple lighting from above using normal
                    vec3 lightDir = normalize(vec3(0.2, 1.0, -0.1));
                    float ndotl = clamp(dot(normal, lightDir), 0.0, 1.0);

                    // Depth for attenuation
                    float depth = clamp(-vPos.y, 0.0, 500.0);

                    // Caustics intensity by depth
                    float causticsIntensity = exp(-depth * 0.05);
                    vec3 caustics = vec3(0.0);
                    if (underwater > 0.5 && hasCaustics > 0.5) {
                        caustics = texture2D(causticTex, vUv).rgb * causticsIntensity;
                    }

                    // Multiple light sources
                    vec3 surfaceLight = caustics * (1.0 - clamp(depth * 0.01, 0.0, 0.85));
                    float dPoint = length(pointLightPos - vPos);
                    vec3 localLight = vec3(1.0, 0.95, 0.8) * exp(-dPoint * 0.12);
                    vec3 bioLight = vec3(0.0, 0.03, 0.06) * max(0.0, sin(time * 0.7 + vPos.x * 0.25 + vPos.z * 0.25)) * exp(-depth * 0.02);
                    vec3 totalLight = surfaceLight + localLight + bioLight;
                    
                    vec3 color;
                    if (underwater > 0.5) {
                        // Underwater shading: depth-based attenuation, muted highlights, and added light sources
                        float dNorm = clamp(depth * 0.02, 0.0, 1.0);
                        vec3 underBase = mix(vec3(0.0, 0.10, 0.22), vec3(0.0, 0.16, 0.32), clamp(info.r + 0.5, 0.0, 1.0));
                        vec3 lit = underBase * (0.20 + 0.30 * ndotl);
                        color = mix(lit, wavePattern, 0.08);
                        color = color * (1.0 - 0.6 * dNorm) + totalLight * 0.35;
                        color += fresnel * vec3(0.12);
                    } else {
                        // Above surface: reduce glare significantly
                        vec3 lit = waterColor * (0.4 + 0.4 * ndotl);
                        color = mix(lit, wavePattern, 0.10);
                        color += fresnel * vec3(0.20);
                    }
                    
                    gl_FragColor = vec4(color, 0.95);
                    
                    #include <fog_fragment>
                }
            `,
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.fog,
                {
                    water: { value: this.waterSim.current ? this.waterSim.current.texture : null },
                    causticTex: { value: null },
                    underwater: { value: 0.0 },
                    time: { value: 0.0 },
                    pointLightPos: { value: new THREE.Vector3(0, -10, 0) },
                    hasCaustics: { value: 0.0 }
                }
            ]),
            transparent: false,
            side: THREE.DoubleSide,
            fog: true
        });
        
        this.waterMaterial = waterMat;

        this.water = new THREE.Mesh(geometry, waterMat);
        this.water.rotation.x = -Math.PI / 2;  // Rotate to horizontal (XZ plane)
        this.water.position.y = 0;              // Position at surface level
        this.water.scale.set(1, 1, 1);
        this.water.receiveShadow = false;
        this.water.castShadow = false;
        this.water.frustumCulled = false;       // Prevent culling issues
        this.scene.add(this.water);
        
        console.log('Water mesh created - cyan/teal water surface with wave visualization');

        // Initialize caustics and feed texture to water material
        await this.initCaustics(geometry);

        // Add initial ripples
        for (let i = 0; i < 15; i++) {
            this.addDrop(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                0.03,
                (i & 1) ? 0.02 : -0.02
            );
        }
    },
    
    /**
     * Create underground structures
     */
    createUndergroundStructures() {
        // Create structures scaled to pool (pool spans -poolScale to +poolScale)
        const scale = this.poolScale;
        for (let i = 0; i < 5; i++) {
            const structureGeometry = new THREE.CylinderGeometry(3, 5, 25, 16);
            const structureMaterial = new THREE.MeshPhongMaterial({
                color: 0x888888,
                shininess: 30
            });
            const structure = new THREE.Mesh(structureGeometry, structureMaterial);
            structure.position.set(
                (Math.random() - 0.5) * scale * 1.5,
                -scale + 12,
                (Math.random() - 0.5) * scale * 1.5
            );
            structure.castShadow = true;
            structure.receiveShadow = true;
            this.scene.add(structure);
        }
    },
    
    /**
     * Create bubbles for atmosphere
     */
    createBubbles() {
        const bubbleGeometry = new THREE.SphereGeometry(0.8, 8, 8);
        const bubbleMaterial = new THREE.MeshBasicMaterial({
            color: 0xccffff,
            transparent: true,
            opacity: 0.5
        });
        
        const scale = this.poolScale;
        const surfaceY = 0;
        const minY = -scale + 2;
        const maxY = surfaceY - 2;
        
        for (let i = 0; i < 30; i++) {
            const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
            bubble.position.set(
                (Math.random() - 0.5) * scale * 1.5,
                minY + Math.random() * (maxY - minY),
                (Math.random() - 0.5) * scale * 1.5
            );
            bubble.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.03,
                Math.random() * 0.08 + 0.04,
                (Math.random() - 0.5) * 0.03
            );
            bubble.userData.bounds = { minY, maxY };
            this.scene.add(bubble);
        }
    },
    
    /**
     * Setup keyboard controls
     */
    setupControls() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            // Only track WASD keys
            if (['w', 'a', 's', 'd'].includes(key)) {
                this.keys[key] = true;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) {
                this.keys[key] = false;
            }
        });
        
        // Mouse look
        let mouseDown = false;
        
        document.addEventListener('mousedown', () => {
            mouseDown = true;
        });
        
        document.addEventListener('mouseup', () => {
            mouseDown = false;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (mouseDown) {
                const deltaX = e.movementX || 0;
                const deltaY = e.movementY || 0;
                
                this.camera.rotation.order = 'YXZ';
                this.camera.rotation.y -= deltaX * 0.01;
                this.camera.rotation.x -= deltaY * 0.01;
                
                // Clamp pitch
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
            }
        });
    },
    
    /**
     * Handle window resize
     */
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    },
    
    /**
     * Update game state
     */
    update(deltaTime) {
        // Calculate forward/right using full camera orientation (includes pitch)
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward).normalize();

        // If direction becomes zero (rare), bail early
        if (forward.lengthSq() === 0) return;

        const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();

        // Handle WASD movement relative to current view
        if (this.keys['w']) {
            // Move along where the camera is facing (can go up/down based on pitch)
            this.camera.position.addScaledVector(forward, this.playerSpeed);
        }
        if (this.keys['s']) {
            // Move opposite of view direction
            this.camera.position.addScaledVector(forward, -this.playerSpeed);
        }
        if (this.keys['a']) {
            // Strafe left relative to view
            this.camera.position.addScaledVector(right, -this.playerSpeed);
        }
        if (this.keys['d']) {
            // Strafe right relative to view
            this.camera.position.addScaledVector(right, this.playerSpeed);
        }

        // Clamp to stay within pool bounds
        const scale = this.poolScale;
        const surfaceY = 0;
        const aboveSurfaceLimit = scale * 0.4; // allow some height above water
        if (this.camera.position.y > surfaceY + aboveSurfaceLimit) {
            this.camera.position.y = surfaceY + aboveSurfaceLimit;
        }

        const floorY = -scale;
        const floorBuffer = 1.0;
        if (this.camera.position.y < floorY + floorBuffer) {
            this.camera.position.y = floorY + floorBuffer;
        }

        // Clamp horizontal position to pool bounds
        const horizontalLimit = scale * 0.9;
        this.camera.position.x = Math.max(-horizontalLimit, Math.min(horizontalLimit, this.camera.position.x));
        this.camera.position.z = Math.max(-horizontalLimit, Math.min(horizontalLimit, this.camera.position.z));
        
        // Switch atmosphere based on whether we're above or below the surface
        if (this.camera.position.y >= surfaceY) {
            // Above water: clear bright sky
            this.scene.background = null;
            this.renderer.setClearColor(this.surfaceClearColor, 1);
            this.scene.fog = null;
        } else {
            // Underwater: clear blue pool water
            this.scene.background = this.underwaterColor;
            this.renderer.setClearColor(this.underwaterColor, 1);
            
            // Dynamic fog - gets denser as you go deeper
            const depth = Math.abs(this.camera.position.y);
            const baseDensity = 0.12;
            const depthFactor = 1 + (depth / this.poolScale) * 3.5;  // Up to 150% denser at max depth
            this.underwaterFog.density = baseDensity * depthFactor;
            this.scene.fog = this.underwaterFog;
        }

        // Sync water shader uniforms based on viewer position and lighting
        if (this.waterMaterial && this.waterMaterial.uniforms) {
            const isUnderwater = this.camera.position.y < surfaceY;
            if (this.waterMaterial.uniforms.underwater) {
                this.waterMaterial.uniforms.underwater.value = isUnderwater ? 1.0 : 0.0;
            }
            if (this.directionalLight) {
                const lightDir = this.directionalLight.position.clone().normalize();
                if (this.waterMaterial.uniforms.light && this.waterMaterial.uniforms.light.value) {
                    this.waterMaterial.uniforms.light.value.copy(lightDir);
                }
                if (this.caustics && this.caustics.material && this.caustics.material.uniforms && this.caustics.material.uniforms.light && this.caustics.material.uniforms.light.value) {
                    this.caustics.material.uniforms.light.value.copy(lightDir);
                }
            }
        }

        // Update depth
        this.depthValue = Math.abs(Math.round(this.camera.position.y));
        const depthEl = document.getElementById('depthValue');
        if (depthEl) {
            depthEl.textContent = this.depthValue;
        }
        
        // Advance water simulation
        this.stepWaterSimulation();
        
        // Update shader time and point light (submarine) following the camera
        if (this.waterMaterial && this.waterMaterial.uniforms) {
            if (this.waterMaterial.uniforms.time) {
                this.waterMaterial.uniforms.time.value += deltaTime;
            }
            if (this.waterMaterial.uniforms.pointLightPos) {
                this.waterMaterial.uniforms.pointLightPos.value.copy(this.camera.position);
            }
        }
        
        // Update bubbles
        this.scene.children.forEach(child => {
            if (child.userData.velocity) {
                child.position.add(child.userData.velocity);
                
                const minY = child.userData.bounds ? child.userData.bounds.minY : -95;
                const maxY = child.userData.bounds ? child.userData.bounds.maxY : (surfaceY - 1);

                // Reset if above surface band or too far from origin
                const outOfBand = child.position.y > maxY;
                const scale = this.poolScale * 1.5;
                const tooFar = Math.abs(child.position.x) > scale || Math.abs(child.position.z) > scale;
                if (outOfBand || tooFar) {
                    child.position.set(
                        (Math.random() - 0.5) * this.poolScale * 1.5,
                        minY,
                        (Math.random() - 0.5) * this.poolScale * 1.5
                    );
                }
            }
        });
    }
};

// --- Asset loading helpers ---
Game.loadAssets = async function () {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    // Tiles and skybox
    const tilesPromise = new Promise((resolve) => {
        loader.load('threejs-water-master/tiles.jpg', (tex) => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(4, 4);
            resolve(tex);
        }, undefined, () => resolve(null));
    });

    const cubeLoader = new THREE.CubeTextureLoader();
    cubeLoader.setCrossOrigin('anonymous');
    const skyPromise = new Promise((resolve) => {
        cubeLoader.load([
            'threejs-water-master/xpos.jpg',
            'threejs-water-master/xneg.jpg',
            'threejs-water-master/ypos.jpg',
            'threejs-water-master/ypos.jpg',
            'threejs-water-master/zpos.jpg',
            'threejs-water-master/zneg.jpg'
        ], (cube) => resolve(cube), undefined, () => resolve(null));
    });

    this.tilesTexture = await tilesPromise;
    this.skyCube = await skyPromise;
};

Game.fetchText = async function (path) {
    console.log('Fetching:', path);
    try {
        const res = await fetch(path);
        if (!res.ok) {
            console.error('Failed to fetch', path, ':', res.status, res.statusText);
            return '';
        }
        const text = await res.text();
        console.log('Loaded', path, '- length:', text.length);
        return text;
    } catch (err) {
        console.error('Error fetching', path, ':', err);
        return '';
    }
};

Game.initWaterSimulation = async function () {
    const [simVertex, updateFrag, normalFrag, dropFrag] = await Promise.all([
        this.fetchText('threejs-water-master/shaders/simulation/vertex.glsl'),
        this.fetchText('threejs-water-master/shaders/simulation/update_fragment.glsl'),
        this.fetchText('threejs-water-master/shaders/simulation/normal_fragment.glsl'),
        this.fetchText('threejs-water-master/shaders/simulation/drop_fragment.glsl')
    ]);

    // Fix shaders for ShaderMaterial: remove position attribute, rename texture uniform
    const fixSimVertex = simVertex.replace('attribute vec3 position;', '');
    const fixUpdateFrag = updateFrag.replace(/uniform sampler2D texture;/g, 'uniform sampler2D waterTexture;').replace(/texture2D\(texture,/g, 'texture2D(waterTexture,');
    const fixNormalFrag = normalFrag.replace(/uniform sampler2D texture;/g, 'uniform sampler2D waterTexture;').replace(/texture2D\(texture,/g, 'texture2D(waterTexture,');
    const fixDropFrag = dropFrag.replace(/uniform sampler2D texture;/g, 'uniform sampler2D waterTexture;').replace(/texture2D\(texture,/g, 'texture2D(waterTexture,');

    const size = this.waterSim.size;
    const params = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthBuffer: false,
        stencilBuffer: false
    };
    const rtA = new THREE.WebGLRenderTarget(size, size, params);
    const rtB = new THREE.WebGLRenderTarget(size, size, params);
    this.waterSim.rtA = rtA;
    this.waterSim.rtB = rtB;
    this.waterSim.alt = rtB;
    this.waterSim.current = rtA;
    this.waterSim.frame = 0;

    // Quad scene
        const quadScene = new THREE.Scene();
        const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const quadGeo = new THREE.BufferGeometry();
    const quadVerts = new Float32Array([
        -1, -1, 0,
        1, -1, 0,
        1, 1, 0,
        -1, 1, 0
    ]);
    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    quadGeo.setAttribute('position', new THREE.BufferAttribute(quadVerts, 3));
    quadGeo.setIndex(new THREE.BufferAttribute(quadIndices, 1));

    const updateMat = new THREE.ShaderMaterial({
        vertexShader: fixSimVertex,
        fragmentShader: fixUpdateFrag,
        uniforms: {
            waterTexture: { value: rtA.texture },
            delta: { value: new THREE.Vector2(1 / size, 1 / size) }
        }
    });

    const normalMat = new THREE.ShaderMaterial({
        vertexShader: fixSimVertex,
        fragmentShader: fixNormalFrag,
        uniforms: {
            waterTexture: { value: rtB.texture },
            delta: { value: new THREE.Vector2(1 / size, 1 / size) }
        }
    });

    const dropMat = new THREE.ShaderMaterial({
        vertexShader: fixSimVertex,
        fragmentShader: fixDropFrag,
        uniforms: {
            waterTexture: { value: rtA.texture },
            center: { value: new THREE.Vector2(0, 0) },
            radius: { value: 0.03 },
            strength: { value: 0.04 }
        }
    });

    const quad = new THREE.Mesh(quadGeo, updateMat);
    quadScene.add(quad);

    this.waterSim.quadScene = quadScene;
    this.waterSim.quadCamera = quadCamera;
    this.waterSim.updateMat = updateMat;
    this.waterSim.normalMat = normalMat;
    this.waterSim.dropMat = dropMat;
};

Game.stepWaterSimulation = function () {
    if (!this.waterSim.quadScene) return;
    const renderer = this.renderer;
    const sim = this.waterSim;
    const quad = sim.quadScene.children[0];

    // Occasional random ripples to keep surface alive
    sim.frame++;
    if (sim.dropMat && sim.frame % 180 === 0) {
        const cx = Math.random() * 2 - 1;
        const cy = Math.random() * 2 - 1;
        this.addDrop(cx, cy, 0.045, Math.random() > 0.5 ? 0.035 : -0.03);
    }

    // Update heights/velocity: read current, write alt
    quad.material = sim.updateMat;
    sim.updateMat.uniforms.waterTexture.value = sim.current.texture;
    renderer.setRenderTarget(sim.alt);
    renderer.render(sim.quadScene, sim.quadCamera);
    this.swapWaterTargets();

    // Compute normals: read current, write alt
    quad.material = sim.normalMat;
    sim.normalMat.uniforms.waterTexture.value = sim.current.texture;
    renderer.setRenderTarget(sim.alt);
    renderer.render(sim.quadScene, sim.quadCamera);
    this.swapWaterTargets();

    renderer.setRenderTarget(null);

    // Feed the water material
    if (this.waterMaterial && this.waterMaterial.uniforms && this.waterMaterial.uniforms.water) {
        this.waterMaterial.uniforms.water.value = sim.current.texture;
    }

    // Update caustics target
    this.updateCaustics();
};

Game.swapWaterTargets = function () {
    const sim = this.waterSim;
    const temp = sim.current;
    sim.current = sim.alt;
    sim.alt = temp;
};

Game.addDrop = function (x, y, radius, strength) {
    const sim = this.waterSim;
    if (!sim.dropMat || !sim.quadScene) return;
    const renderer = this.renderer;
    const quad = sim.quadScene.children[0];

    quad.material = sim.dropMat;
    sim.dropMat.uniforms.waterTexture.value = sim.current.texture;
    sim.dropMat.uniforms.center.value.set(x, y);
    sim.dropMat.uniforms.radius.value = radius;
    sim.dropMat.uniforms.strength.value = strength;

    renderer.setRenderTarget(sim.alt);
    renderer.render(sim.quadScene, sim.quadCamera);
    renderer.setRenderTarget(null);

    this.swapWaterTargets();
};

Game.initCaustics = async function (geometry) {
    const utils = await this.fetchText('threejs-water-master/shaders/utils.glsl');
    const vert = await this.fetchText('threejs-water-master/shaders/caustics/vertex.glsl');
    const frag = await this.fetchText('threejs-water-master/shaders/caustics/fragment.glsl');
    
    // Remove attribute declaration for ShaderMaterial
    const fixedVertSrc = vert.replace('attribute vec3 position;', '');
    
    // Remove extension directive - not needed in WebGL2/GLSL ES 3.0 (dFdx/dFdy are built-in)
    const fixedFragSrc = frag.replace('#extension GL_OES_standard_derivatives : enable', '');
    
    const inject = (src) => src.replace('#include <utils>', utils);

    const rt = new THREE.WebGLRenderTarget(1024, 1024, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false
    });

    const material = new THREE.ShaderMaterial({
        vertexShader: inject(fixedVertSrc),
        fragmentShader: inject(fixedFragSrc),
        uniforms: {
            light: { value: new THREE.Vector3(0.7559289460184544, 0.7559289460184544, -0.3779644730092272) },
            water: { value: this.waterSim.current ? this.waterSim.current.texture : null }
        },
        transparent: false,
        depthTest: false,
        depthWrite: false
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    this.caustics.rt = rt;
    this.caustics.scene = scene;
    this.caustics.camera = camera;
    this.caustics.material = material;

    if (this.waterMaterial && this.waterMaterial.uniforms.causticTex) {
        this.waterMaterial.uniforms.causticTex.value = rt.texture;
        if (this.waterMaterial.uniforms.hasCaustics) {
            this.waterMaterial.uniforms.hasCaustics.value = 1.0;
        }
    }
};

Game.updateCaustics = function () {
    const { scene, camera, rt, material } = this.caustics;
    if (!scene || !material || !rt) return;
    material.uniforms.water.value = this.waterSim.current.texture;

    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(new THREE.Color(0x000000), 0);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);

    if (this.waterMaterial && this.waterMaterial.uniforms.causticTex) {
        this.waterMaterial.uniforms.causticTex.value = rt.texture;
    }
};

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
    Game.animate();
});

/**
 * Animation loop
 */
Game.animate = function() {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = 1 / 60; // 60 FPS
    this.update(deltaTime);
    this.renderer.render(this.scene, this.camera);
};
*/