import * as THREE from "three";
// Local stubs to align imports for index.html entry
// Minimal Flashlight implementation attached to camera
class OceanFlashlight {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.light = new THREE.SpotLight(0x88ccff, 2.0, 200, Math.PI / 8, 0.4, 1.5);
        this.light.position.copy(camera.position);
        this.light.target.position.copy(camera.position.clone().add(new THREE.Vector3(0, -1, -2)));
        scene.add(this.light);
        scene.add(this.light.target);
    }
    setIntensity(i) { this.light.intensity = i; }
    update() {
        this.light.position.copy(this.camera.position);
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this.light.target.position.copy(this.camera.position.clone().add(dir.multiplyScalar(2)));
        this.light.target.updateMatrixWorld();
    }
}

// Minimal Player stub for collision reference
class OceanPlayer {
    constructor(camera) { this.camera = camera; }
}

// Minimal Sprint stub
class OceanSprint {
    constructor(opts) { this.opts = opts; this.stamina = opts?.maxStamina ?? 100; }
    isSprinting() { return false; }
    update(dt, keys) { /* no-op */ }
}
// Remove conflicting imports; using local stubs for now
// import { Sprint } from './user/Sprint.js';
import { Shipwreck } from './components/Shipwreck.js';
import { Rock } from './components/Rock.js';
import { Debris } from './components/Debris.js';
// import { Player } from './components/Player.js';
import { ModelObstacle } from './components/ModelObstacle.js';
import { Coral } from './components/Coral.js';
import { Anglerfish } from './components/Anglerfish.js';

/**
 * Depth 559 - Deep Ocean Explorer
 * A dark, atmospheric underwater experience
 */

const Ocean = {
    // Core Three.js
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    
    // Ocean parameters
    oceanScale: 400,
    oceanDepth: 400,
    // World sea surface height (meters). Increase to raise water surface.
    waterLevel: 12,
    
    // Colors - Ocean theme
    deepColor: new THREE.Color(0x2a6590),      // Deep blue
    midColor: new THREE.Color(0x3a85a8),       // Medium blue
    shallowColor: new THREE.Color(0x4aa5c5),   // Bright teal near surface
    fogColor: new THREE.Color(0x2a6590),       // Blue fog
    
    // Water system
    waterMesh: null,
    waterMaterial: null,
    waterSim: {
        size: 256,
        rtA: null,
        rtB: null,
        current: null,
        alt: null,
        quadScene: null,
        quadCamera: null,
        updateMat: null,
        normalMat: null,
        dropMat: null,
        frame: 0
    },
    
    // Caustics
    caustics: {
        rt: null,
        scene: null,
        camera: null,
        material: null
    },
    
    // Lighting
    sun: null,
    sunLight: null,
    ambientLight: null,
    flashlight: null,
    flashlightOn: true,
    
    // Materials that need fog updates
    floorMaterial: null,
    
    // Player and obstacles
    player: null,
    obstacles: [],  // All collidable objects
    
    // Movement and sprint
    keys: {},
    moveSpeed: 0.4,
    sprint: null,
    
    /**
     * Initialize the ocean scene
     */
    async init() {
        console.log('Initializing Deep Ocean...');
        
        this.clock = new THREE.Clock();
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = this.deepColor;
        // Lighter fog near surface, denser in deep zones
        this.scene.fog = new THREE.FogExp2(this.fogColor, 0.015);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            2000
        );
        this.camera.position.set(0, -20, 100);
        this.camera.lookAt(0, -50, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.35;  // Slightly higher exposure for better light visibility
        this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Preserve original GLTF colors
        // three.js r152+: physicallyCorrectLights removed; use useLegacyLights flag
        this.renderer.useLegacyLights = false;
        document.body.appendChild(this.renderer.domElement);
        
        // Setup
        this.setupLighting();
        this.createSky();
        await this.initWaterSimulation();
        await this.createWaterSurface();
        await this.initCaustics();
        this.createOceanFloor();
        this.createOceanWalls();
        await this.createObstacles();  // Creates all obstacles using components
        this.createBubbles();
        this.setupControls();
        
        // Create player component for collision
        this.player = new OceanPlayer(this.camera);
        
        // Create sprint component
        this.sprint = new OceanSprint({
            baseSpeed: this.moveSpeed,
            sprintMultiplier: 2.5,
            maxStamina: 100,
            staminaDrainRate: 20,
            staminaRegenRate: 15
        });
        window.addEventListener('resize', () => this.onResize());
        
        // Initial ripples
        for (let i = 0; i < 20; i++) {
            this.addDrop(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                0.04,
                (Math.random() - 0.5) * 0.03
            );
        }
        
        console.log('Ocean initialized!');
    },
    
    /**
     * Lighting setup - dim underwater ambiance
     */
    setupLighting() {
        // Ambient light - brighter near surface
        this.ambientLight = new THREE.AmbientLight(0x2a4050, 0.5);
        this.scene.add(this.ambientLight);
        
        // Hemisphere light to preserve natural color on obstacles
        const hemiLight = new THREE.HemisphereLight(0x99bbff, 0x223344, 0.55);
        this.scene.add(hemiLight);
        
        // Add camera to scene first (needed for flashlight)
        this.scene.add(this.camera);
        
        // Create flashlight using separate component
        this.flashlight = new OceanFlashlight(this.camera, this.scene);
        
        // Sun filtering through water
        this.sunLight = new THREE.DirectionalLight(0x4080a0, 0.6);
        this.sunLight.position.set(50, 100, -30);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -200;
        this.sunLight.shadow.camera.right = 200;
        this.sunLight.shadow.camera.top = 200;
        this.sunLight.shadow.camera.bottom = -200;
        this.scene.add(this.sunLight);
        
        // Subtle underwater point lights for atmosphere
        const pointLight1 = new THREE.PointLight(0x0066aa, 0.5, 100);
        pointLight1.position.set(-50, -100, 50);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x004488, 0.3, 150);
        pointLight2.position.set(80, -150, -60);
        this.scene.add(pointLight2);
    },
    
    /**
     * Create atmospheric sky
     */
    createSky() {
        // Guard: Sky helper may not be available from examples
        if (typeof Sky !== 'undefined') {
            const sky = new Sky();
            sky.scale.setScalar(10000);
            this.scene.add(sky);
            const skyUniforms = sky.material.uniforms;
            skyUniforms['turbidity'].value = 2;
            skyUniforms['rayleigh'].value = 1;
            skyUniforms['mieCoefficient'].value = 0.005;
            skyUniforms['mieDirectionalG'].value = 0.8;
            this.sun = new THREE.Vector3();
            const phi = THREE.MathUtils.degToRad(90 - 25);
            const theta = THREE.MathUtils.degToRad(180);
            this.sun.setFromSphericalCoords(1, phi, theta);
            skyUniforms['sunPosition'].value.copy(this.sun);
        }
    },
    
    /**
     * Initialize water height simulation (GPU-based)
     */
    async initWaterSimulation() {
        const simVertex = `
            varying vec2 coord;
            void main() {
                coord = position.xy * 0.5 + 0.5;
                gl_Position = vec4(position.xyz, 1.0);
            }
        `;
        
        const updateFrag = `
            precision highp float;
            uniform sampler2D waterTexture;
            uniform vec2 delta;
            varying vec2 coord;
            
            void main() {
                vec4 info = texture2D(waterTexture, coord);
                vec2 dx = vec2(delta.x, 0.0);
                vec2 dy = vec2(0.0, delta.y);
                float average = (
                    texture2D(waterTexture, coord - dx).r +
                    texture2D(waterTexture, coord - dy).r +
                    texture2D(waterTexture, coord + dx).r +
                    texture2D(waterTexture, coord + dy).r
                ) * 0.25;
                info.g += (average - info.r) * 2.0;
                info.g *= 0.995;
                info.r += info.g;
                gl_FragColor = info;
            }
        `;
        
        const normalFrag = `
            precision highp float;
            uniform sampler2D waterTexture;
            uniform vec2 delta;
            varying vec2 coord;
            
            void main() {
                vec4 info = texture2D(waterTexture, coord);
                vec3 dx = vec3(delta.x, texture2D(waterTexture, vec2(coord.x + delta.x, coord.y)).r - info.r, 0.0);
                vec3 dy = vec3(0.0, texture2D(waterTexture, vec2(coord.x, coord.y + delta.y)).r - info.r, delta.y);
                info.ba = normalize(cross(dy, dx)).xz;
                gl_FragColor = info;
            }
        `;
        
        const dropFrag = `
            precision highp float;
            const float PI = 3.141592653589793;
            uniform sampler2D waterTexture;
            uniform vec2 center;
            uniform float radius;
            uniform float strength;
            varying vec2 coord;
            
            void main() {
                vec4 info = texture2D(waterTexture, coord);
                float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
                drop = 0.5 - cos(drop * PI) * 0.5;
                info.r += drop * strength;
                gl_FragColor = info;
            }
        `;
        
        const size = this.waterSim.size;
        const params = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        this.waterSim.rtA = new THREE.WebGLRenderTarget(size, size, params);
        this.waterSim.rtB = new THREE.WebGLRenderTarget(size, size, params);
        this.waterSim.current = this.waterSim.rtA;
        this.waterSim.alt = this.waterSim.rtB;
        
        // Quad geometry for simulation passes
        const quadGeo = new THREE.BufferGeometry();
        quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0
        ]), 3));
        quadGeo.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
        
        this.waterSim.updateMat = new THREE.ShaderMaterial({
            vertexShader: simVertex,
            fragmentShader: updateFrag,
            uniforms: {
                waterTexture: { value: null },
                delta: { value: new THREE.Vector2(1/size, 1/size) }
            }
        });
        
        this.waterSim.normalMat = new THREE.ShaderMaterial({
            vertexShader: simVertex,
            fragmentShader: normalFrag,
            uniforms: {
                waterTexture: { value: null },
                delta: { value: new THREE.Vector2(1/size, 1/size) }
            }
        });
        
        this.waterSim.dropMat = new THREE.ShaderMaterial({
            vertexShader: simVertex,
            fragmentShader: dropFrag,
            uniforms: {
                waterTexture: { value: null },
                center: { value: new THREE.Vector2() },
                radius: { value: 0.03 },
                strength: { value: 0.04 }
            }
        });
        
        this.waterSim.quadScene = new THREE.Scene();
        this.waterSim.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.waterSim.quadScene.add(new THREE.Mesh(quadGeo, this.waterSim.updateMat));
    },
    
    /**
     * Create the water surface with dark ocean shader
     */
    async createWaterSurface() {
        const scale = this.oceanScale;
        // Make water surface much larger to hide edges
        const geometry = new THREE.PlaneGeometry(scale * 4, scale * 4, 256, 256);
        
        const waterMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vWorldPos;
                varying vec2 vUv;
                varying float vDepth;
                uniform sampler2D water;
                
                void main() {
                    vUv = uv;
                    vec4 info = texture2D(water, uv);
                    vec3 pos = position;
                    pos.y += info.r * 2.0;
                    
                    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                    vWorldPos = worldPos.xyz;
                    vDepth = -worldPos.y;
                    
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: `
                precision highp float;
                
                varying vec3 vWorldPos;
                varying vec2 vUv;
                varying float vDepth;
                
                uniform sampler2D water;
                uniform sampler2D causticTex;
                uniform float time;
                uniform float underwater;
                uniform vec3 deepColor;
                uniform vec3 midColor;
                uniform vec3 shallowColor;
                uniform vec3 fogColor;
                uniform float fogDensity;
                
                void main() {
                    vec4 info = texture2D(water, vUv);
                    
                    // Compute normal from simulation
                    vec3 normal = normalize(vec3(info.b * 2.0, 1.0, info.a * 2.0));
                    
                    // View direction
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    
                    // Fresnel - stronger for darker water
                    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
                    fresnel = mix(0.02, 0.6, fresnel);
                    
                    // Depth-based color blending
                    float depthNorm = clamp(vDepth / 200.0, 0.0, 1.0);
                    vec3 waterColor = mix(shallowColor, midColor, depthNorm);
                    waterColor = mix(waterColor, deepColor, depthNorm * depthNorm);
                    
                    // Caustics - vary by depth zone
                    // Strong in shallow, moderate in mid, weak/none in deep
                    vec3 caustics = vec3(0.0);
                    if (underwater > 0.5) {
                        float causticsStrength;
                        if (vDepth < 100.0) {
                            // Shallow zone - bright caustics
                            causticsStrength = 0.6 * (1.0 - vDepth / 100.0);
                        } else if (vDepth < 350.0) {
                            // Mid zone - fading caustics
                            causticsStrength = 0.3 * (1.0 - (vDepth - 100.0) / 250.0);
                        } else {
                            // Deep zone - minimal caustics
                            causticsStrength = 0.05 * (1.0 - (vDepth - 350.0) / 50.0);
                        }
                        causticsStrength = max(0.0, causticsStrength);
                        caustics = texture2D(causticTex, vUv).rgb * causticsStrength;
                    }
                    
                    // Light from above
                    vec3 lightDir = normalize(vec3(0.3, 1.0, -0.2));
                    float NdotL = max(dot(normal, lightDir), 0.0);
                    
                    // Specular highlight (subtle)
                    vec3 halfDir = normalize(lightDir + viewDir);
                    float spec = pow(max(dot(normal, halfDir), 0.0), 64.0) * 0.3;
                    
                    // Combine
                    vec3 color = waterColor * (0.3 + 0.4 * NdotL);
                    color += caustics;
                    color += spec * vec3(0.5, 0.7, 0.8);
                    color = mix(color, vec3(0.02, 0.06, 0.1), fresnel * 0.5);
                    
                    // Distance fog
                    float dist = length(cameraPosition - vWorldPos);
                    float fog = 1.0 - exp(-dist * fogDensity);
                    color = mix(color, fogColor, fog);
                    
                    // Fade edges of water surface to prevent visible border
                    float edgeFade = 1.0;
                    float edgeDist = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;  // 0 at center, 1 at edges
                    if (edgeDist > 0.8) {
                        edgeFade = 1.0 - smoothstep(0.8, 1.0, edgeDist);
                        color = mix(fogColor, color, edgeFade);
                    }
                    
                    // When viewing from above, blend to deep water color for realism
                    // This simulates looking down into dark water
                    if (underwater < 0.5) {
                        // Above water looking down - show dark depths
                        float lookingDown = max(0.0, -viewDir.y);
                        vec3 depthColor = mix(midColor, deepColor, 0.7);
                        color = mix(color, depthColor, lookingDown * 0.8);
                    }
                    
                    // Fully opaque water surface
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            uniforms: {
                water: { value: this.waterSim.current.texture },
                causticTex: { value: null },
                time: { value: 0 },
                underwater: { value: 0 },
                deepColor: { value: this.deepColor },
                midColor: { value: this.midColor },
                shallowColor: { value: this.shallowColor },
                fogColor: { value: this.fogColor },
                fogDensity: { value: 0.008 },
                // Flashlight uniforms for volumetric scattering (initialized safely)
                flashlightPos: { value: new THREE.Vector3(0, 0, 0) },
                flashlightDir: { value: new THREE.Vector3(0, -1, 0) },
                flashlightIntensity: { value: 0.0 }
            },
            transparent: false,
            side: THREE.DoubleSide,
            depthWrite: true
        });
        
        this.waterMaterial = waterMat;
        this.waterMesh = new THREE.Mesh(geometry, waterMat);
        this.waterMesh.rotation.x = -Math.PI / 2;
        this.waterMesh.position.y = this.waterLevel;
        this.waterMesh.receiveShadow = true;
        this.scene.add(this.waterMesh);
    },
    
    /**
     * Initialize caustics rendering
     */
    async initCaustics() {
        const causticsVert = `
            precision highp float;
            
            varying vec3 oldPos;
            varying vec3 newPos;
            varying vec3 ray;
            
            uniform vec3 light;
            uniform sampler2D water;
            
            const float IOR_AIR = 1.0;
            const float IOR_WATER = 1.333;
            const float poolHeight = 1.0;
            
            vec2 intersectCube(vec3 origin, vec3 r, vec3 cubeMin, vec3 cubeMax) {
                vec3 tMin = (cubeMin - origin) / r;
                vec3 tMax = (cubeMax - origin) / r;
                vec3 t1 = min(tMin, tMax);
                vec3 t2 = max(tMin, tMax);
                float tNear = max(max(t1.x, t1.y), t1.z);
                float tFar = min(min(t2.x, t2.y), t2.z);
                return vec2(tNear, tFar);
            }
            
            vec3 project(vec3 origin, vec3 r, vec3 refractedLight) {
                vec2 tcube = intersectCube(origin, r, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));
                origin += r * tcube.y;
                float tplane = (-origin.y - 1.0) / refractedLight.y;
                return origin + refractedLight * tplane;
            }
            
            void main() {
                vec4 info = texture2D(water, position.xy * 0.5 + 0.5);
                info.ba *= 0.5;
                vec3 normal = vec3(info.b, sqrt(1.0 - dot(info.ba, info.ba)), info.a);
                
                vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
                ray = refract(-light, normal, IOR_AIR / IOR_WATER);
                oldPos = project(position.xzy, refractedLight, refractedLight);
                newPos = project(position.xzy + vec3(0.0, info.r, 0.0), ray, refractedLight);
                
                gl_Position = vec4(0.75 * (newPos.xz + refractedLight.xz / refractedLight.y), 0.0, 1.0);
            }
        `;
        
        const causticsFrag = `
            precision highp float;
            
            varying vec3 oldPos;
            varying vec3 newPos;
            varying vec3 ray;
            
            uniform vec3 light;
            
            const float IOR_AIR = 1.0;
            const float IOR_WATER = 1.333;
            const float poolHeight = 1.0;
            
            vec2 intersectCube(vec3 origin, vec3 r, vec3 cubeMin, vec3 cubeMax) {
                vec3 tMin = (cubeMin - origin) / r;
                vec3 tMax = (cubeMax - origin) / r;
                vec3 t1 = min(tMin, tMax);
                vec3 t2 = max(tMin, tMax);
                float tNear = max(max(t1.x, t1.y), t1.z);
                float tFar = min(min(t2.x, t2.y), t2.z);
                return vec2(tNear, tFar);
            }
            
            void main() {
                float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));
                float newArea = length(dFdx(newPos)) * length(dFdy(newPos));
                float intensity = oldArea / newArea * 0.2;
                
                vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
                vec2 t = intersectCube(newPos, -refractedLight, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));
                intensity *= 1.0 / (1.0 + exp(-200.0 / (1.0 + 10.0 * (t.y - t.x)) * (newPos.y - refractedLight.y * t.y - 2.0 / 12.0)));
                
                // Tint caustics with ocean color
                gl_FragColor = vec4(intensity * 0.6, intensity * 0.8, intensity, 1.0);
            }
        `;
        
        const rt = new THREE.WebGLRenderTarget(1024, 1024, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType
        });
        
        const geometry = new THREE.PlaneGeometry(2, 2, 256, 256);
        
        const material = new THREE.ShaderMaterial({
            vertexShader: causticsVert,
            fragmentShader: causticsFrag,
            uniforms: {
                light: { value: new THREE.Vector3(0.5, 0.75, -0.3).normalize() },
                water: { value: this.waterSim.current.texture }
            },
            transparent: false,
            depthTest: false,
            depthWrite: false
        });
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        scene.add(new THREE.Mesh(geometry, material));
        
        this.caustics.rt = rt;
        this.caustics.scene = scene;
        this.caustics.camera = camera;
        this.caustics.material = material;
        
        this.waterMaterial.uniforms.causticTex.value = rt.texture;
    },
    
    /**
     * Create the ocean floor
     */
    createOceanFloor() {
        const scale = this.oceanScale;
        const geometry = new THREE.PlaneGeometry(scale * 3, scale * 3, 128, 128);
        
        // Terrain displacement
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            
            // Multi-octave noise for natural terrain
            let z = 0;
            z += Math.sin(x * 0.02) * Math.cos(y * 0.02) * 8;
            z += Math.sin(x * 0.05 + 1.5) * Math.cos(y * 0.04) * 4;
            z += Math.sin(x * 0.1) * Math.cos(y * 0.08 + 0.5) * 2;
            z += (Math.random() - 0.5) * 3;
            
            positions.setZ(i, z);
        }
        geometry.computeVertexNormals();
        
        // Custom shader material with proper distance fog
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: `
                uniform vec3 baseColor;
                uniform vec3 fogColor;
                uniform float fogDensity;
                uniform vec3 lightDir;
                
                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                
                void main() {
                    // Basic lighting - brighter base for flashlight visibility
                    float NdotL = max(dot(vNormal, lightDir), 0.0);
                    vec3 color = baseColor * (0.3 + 0.5 * NdotL);
                    
                    // Distance-based fog (exponential)
                    float dist = length(cameraPosition - vWorldPosition);
                    float fogFactor = 1.0 - exp(-fogDensity * dist);
                    
                    // Blend to fog color
                    color = mix(color, fogColor, fogFactor);
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            uniforms: {
                baseColor: { value: new THREE.Color(0x2a3a40) },
                fogColor: { value: this.fogColor },
                fogDensity: { value: 0.015 },
                lightDir: { value: new THREE.Vector3(0.3, 1.0, -0.2).normalize() }
            }
        });
        
        // Store reference to update fog density
        this.floorMaterial = material;
        
        const floor = new THREE.Mesh(geometry, material);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -this.oceanDepth;
        floor.receiveShadow = true;
        this.scene.add(floor);
    },
    
    /**
     * Create ocean boundary walls with gradient fog effect
     */
    createOceanWalls() {
        const scale = this.oceanScale;
        const wallHeight = this.oceanDepth + 50;
        const wallThickness = 10;
        
        // Dark gradient shader material for walls
        const wallMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vWorldPosition;
                varying float vDepth;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    vDepth = -worldPos.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 shallowColor;
                uniform vec3 deepColor;
                uniform vec3 fogColor;
                uniform float maxDepth;
                uniform float fogDensity;
                varying vec3 vWorldPosition;
                varying float vDepth;
                
                void main() {
                    // Depth-based gradient
                    float depthRatio = clamp(vDepth / maxDepth, 0.0, 1.0);
                    vec3 baseColor = mix(shallowColor, deepColor, depthRatio);
                    
                    // Distance fog
                    float dist = length(cameraPosition - vWorldPosition);
                    float fog = 1.0 - exp(-dist * fogDensity);
                    vec3 color = mix(baseColor, fogColor, fog);
                    
                    // Fade to darker at edges
                    color *= (1.0 - depthRatio * 0.3);
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            uniforms: {
                shallowColor: { value: this.midColor },
                deepColor: { value: this.deepColor },
                fogColor: { value: this.fogColor },
                maxDepth: { value: this.oceanDepth },
                fogDensity: { value: 0.012 }
            },
            side: THREE.BackSide
        });
        
        // Create 4 walls around the ocean
        const walls = [
            { size: [scale * 3, wallHeight, wallThickness], pos: [0, -this.oceanDepth / 2, scale * 1.5] },
            { size: [scale * 3, wallHeight, wallThickness], pos: [0, -this.oceanDepth / 2, -scale * 1.5] },
            { size: [wallThickness, wallHeight, scale * 3], pos: [scale * 1.5, -this.oceanDepth / 2, 0] },
            { size: [wallThickness, wallHeight, scale * 3], pos: [-scale * 1.5, -this.oceanDepth / 2, 0] }
        ];
        
        walls.forEach(w => {
            const geo = new THREE.BoxGeometry(...w.size);
            const wall = new THREE.Mesh(geo, wallMaterial.clone());
            wall.position.set(...w.pos);
            this.scene.add(wall);
        });
        
        // Also add a distant background sphere for when looking out
        const bgGeo = new THREE.SphereGeometry(scale * 3, 32, 32);
        const bgMat = new THREE.ShaderMaterial({
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
                uniform float oceanDepth;
                varying vec3 vWorldPosition;
                
                void main() {
                    float y = vWorldPosition.y;
                    float t = clamp((y + oceanDepth) / oceanDepth, 0.0, 1.0);
                    vec3 color = mix(bottomColor, topColor, t);
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            uniforms: {
                topColor: { value: this.midColor },
                bottomColor: { value: new THREE.Color(0x000408) },
                oceanDepth: { value: this.oceanDepth }
            },
            side: THREE.BackSide,
            depthWrite: false
        });
        
        const bgSphere = new THREE.Mesh(bgGeo, bgMat);
        bgSphere.position.y = -this.oceanDepth / 2;
        bgSphere.renderOrder = -100;
        this.scene.add(bgSphere);
    },

    /**
     * Create all obstacles using component classes
     */
    async createObstacles() {
        this.obstacles = [];
        
        // === SURFACE SHIP ===
        // Place a regular ship at the water surface (y=0)
        this.obstacles.push(new Shipwreck(
            this.scene, 40, this.waterLevel, -60, 0.2, 1.2, { surface: true }
        ));
        
        // === ROCKS ===
        // Small scattered rocks
        for (let i = 0; i < 40; i++) {
            this.obstacles.push(new Rock(
                this.scene,
                (Math.random() - 0.5) * this.oceanScale * 2,
                -this.oceanDepth + Math.random() * 10,
                (Math.random() - 0.5) * this.oceanScale * 2,
                { type: 'small', scale: 1 }
            ));
        }
        
        // Large boulder formations
        for (let i = 0; i < 12; i++) {
            this.obstacles.push(new Rock(
                this.scene,
                (Math.random() - 0.5) * this.oceanScale * 1.8,
                -this.oceanDepth + 10,
                (Math.random() - 0.5) * this.oceanScale * 1.8,
                { type: 'boulder', scale: 1 }
            ));
        }
        
        // Tall rock spires
        for (let i = 0; i < 8; i++) {
            const height = 30 + Math.random() * 50;
            this.obstacles.push(new Rock(
                this.scene,
                (Math.random() - 0.5) * this.oceanScale * 1.6,
                -this.oceanDepth + height / 2,
                (Math.random() - 0.5) * this.oceanScale * 1.6,
                { type: 'spire', scale: 1 }
            ));
        }
        
        // === DEBRIS ===
        // Barrels
        for (let i = 0; i < 15; i++) {
            this.obstacles.push(new Debris(
                this.scene,
                (Math.random() - 0.5) * this.oceanScale * 1.5,
                -this.oceanDepth + 2 + Math.random() * 5,
                (Math.random() - 0.5) * this.oceanScale * 1.5,
                { type: 'barrel', scale: 1 }
            ));
        }
        
        // Crates
        for (let i = 0; i < 20; i++) {
            this.obstacles.push(new Debris(
                this.scene,
                (Math.random() - 0.5) * this.oceanScale * 1.5,
                -this.oceanDepth + 2 + Math.random() * 3,
                (Math.random() - 0.5) * this.oceanScale * 1.5,
                { type: 'crate', scale: 1 }
            ));
        }
        
        // === GLTF MODEL OBSTACLE ===
        // NOTE: Update the modelPath below to the actual relative path of your GLTF/GLB file
        // Example: 'assets/models/morrison_quarry_plane.gltf' or similar
        // Use the GLTF already in the project
        // Create sunken plane wrecks (prototype fallback if GLTF not present)
        const planeRotY = Math.PI * 0.15;
        const planeScale = 1.1;
        const planePositions = [
            { x: -140, y: -this.oceanDepth + 6, z: -160 },
            { x: 160, y: -this.oceanDepth + 7, z: 140 },
            { x: -180, y: -this.oceanDepth + 5, z: 120 }
        ];

        // Helper to create a simple sunken plane mesh group
        const makeSunkenPlane = (pos, rotY, scale) => {
            const g = new THREE.Group();
            // Fuselage
            const fusMat = new THREE.MeshStandardMaterial({ color: 0x33383b, roughness: 0.9, metalness: 0.0, emissive: 0x000000 });
            const fus = new THREE.Mesh(new THREE.BoxGeometry(8 * scale, 1.8 * scale, 2 * scale), fusMat);
            fus.position.set(0, 0.5 * scale, 0);
            g.add(fus);
            // Left wing
            const wingL = new THREE.Mesh(new THREE.BoxGeometry(6 * scale, 0.3 * scale, 1.8 * scale), fusMat);
            wingL.position.set(-3.2 * scale, 0.2 * scale, 0);
            wingL.rotation.z = 0.1;
            g.add(wingL);
            // Right wing
            const wingR = wingL.clone();
            wingR.position.set(3.2 * scale, 0.2 * scale, 0);
            wingR.rotation.z = -0.1;
            g.add(wingR);
            // Tail
            const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 1.6 * scale, 0.4 * scale), fusMat);
            tail.position.set(-4.2 * scale, 0.9 * scale, 0);
            tail.rotation.z = 0.2;
            g.add(tail);
            // Apply rotation and position
            g.rotation.y = rotY;
            g.position.set(pos.x, pos.y, pos.z);
            // Tilt slightly into sand
            g.rotation.z = -0.18 - Math.random() * 0.15;
            this.scene.add(g);
            return g;
        };

        for (const pos of planePositions) {
            const p = makeSunkenPlane(pos, planeRotY + Math.random() * 0.2 - 0.1, planeScale);
            // Add a simple collider sphere entry so other systems can consider it
            this.obstacles.push({ center: new THREE.Vector3(p.position.x, p.position.y, p.position.z), radius: 12 * planeScale });
        }
        
        // Decorate near the plane: scattered rocks, crates, and coral
        for (let i = 0; i < 10; i++) {
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetZ = (Math.random() - 0.5) * 40;
            // Scatter rocks near the first plane position only to avoid crowding others
            const base = planePositions[0];
            const r = new Rock(
                this.scene,
                base.x + offsetX,
                -this.oceanDepth + 6 + Math.random() * 4,
                base.z + offsetZ,
                { type: 'small', scale: 1 }
            );
            this.obstacles.push(r);
        }
        for (let i = 0; i < 8; i++) {
            const offsetX = (Math.random() - 0.5) * 30;
            const offsetZ = (Math.random() - 0.5) * 30;
            const base = planePositions[0];
            const d = new Debris(
                this.scene,
                base.x + offsetX,
                -this.oceanDepth + 4 + Math.random() * 4,
                base.z + offsetZ,
                { type: Math.random() < 0.5 ? 'crate' : 'barrel', scale: 1 }
            );
            this.obstacles.push(d);
        }
        // Coral cluster near first plane
        for (let i = 0; i < 4; i++) {
            const offsetX = (Math.random() - 0.5) * 25;
            const offsetZ = (Math.random() - 0.5) * 25;
            const base = planePositions[0];
            const c = new Coral(
                this.scene,
                base.x + offsetX,
                -this.oceanDepth + 4,
                base.z + offsetZ,
                { scale: 1.2, count: 5 }
            );
            this.obstacles.push(c);
        }

        // Add multiple wandering anglerfish with lure lights
        const anglerPath = 'js/components/outer_wilds__angler_fish/scene.gltf';
        const anglerCount = 2 + Math.floor(Math.random() * 2); // 2-3 fish (about 1/4)
        for (let i = 0; i < anglerCount; i++) {
            const ax = (Math.random() - 0.5) * (this.oceanScale * 0.8);
            const az = (Math.random() - 0.5) * (this.oceanScale * 0.8);
            const ay = -this.oceanDepth + 30 + Math.random() * 80; // float in mid-deep water
            const angler = new Anglerfish(this.scene, anglerPath, {
                x: ax,
                y: ay,
                z: az,
                speed: 0.18 + Math.random() * 0.15,
                wanderRadius: 40 + Math.random() * 40,
                scale: 0.12
            });
            this.obstacles.push(angler);
        }

        // === PERIMETER FILL ===
        // Spawn obstacles slightly outside movement bounds to avoid empty-looking edges
        const limit = this.oceanScale * 0.9;
        const outer = limit + 40; // place beyond hard limit

        // Rocks along perimeter
        const perimeterPoints = [
            { x: -outer, z: -outer }, { x: 0, z: -outer }, { x: outer, z: -outer },
            { x: -outer, z: 0 },                         { x: outer, z: 0 },
            { x: -outer, z: outer },  { x: 0, z: outer },  { x: outer, z: outer }
        ];
        for (const p of perimeterPoints) {
            for (let i = 0; i < 3; i++) {
                const rx = p.x + (Math.random() - 0.5) * 30;
                const rz = p.z + (Math.random() - 0.5) * 30;
                const ry = -this.oceanDepth + 6 + Math.random() * 8;
                const r = new Rock(this.scene, rx, ry, rz, { type: Math.random() < 0.3 ? 'boulder' : 'small', scale: 1 });
                this.obstacles.push(r);
            }
            // Occasional coral for color at edges
            if (Math.random() < 0.6) {
                const cx = p.x + (Math.random() - 0.5) * 35;
                const cz = p.z + (Math.random() - 0.5) * 35;
                const c = new Coral(this.scene, cx, -this.oceanDepth + 5, cz, { scale: 1.1, count: 4 });
                this.obstacles.push(c);
            }
        }

        // Debris line beyond edges
        for (let i = 0; i < 12; i++) {
            const edge = Math.floor(Math.random() * 4);
            const pos = { x: 0, z: 0 };
            if (edge === 0) { pos.x = -outer; pos.z = (Math.random() - 0.5) * (this.oceanScale * 1.1); }
            else if (edge === 1) { pos.x = outer; pos.z = (Math.random() - 0.5) * (this.oceanScale * 1.1); }
            else if (edge === 2) { pos.z = -outer; pos.x = (Math.random() - 0.5) * (this.oceanScale * 1.1); }
            else { pos.z = outer; pos.x = (Math.random() - 0.5) * (this.oceanScale * 1.1); }
            const dy = -this.oceanDepth + 4 + Math.random() * 6;
            const d = new Debris(this.scene, pos.x, dy, pos.z, { type: Math.random() < 0.5 ? 'crate' : 'barrel', scale: 1 });
            this.obstacles.push(d);
        }
        
        console.log(`Created ${this.obstacles.length} obstacles with collision (including GLTF model)`);
    },
    
    /**
     * Create ambient bubbles
     */
    createBubbles() {
        const bubbleGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const bubbleMat = new THREE.MeshBasicMaterial({
            color: 0xaaccee,
            transparent: true,
            opacity: 0.5
        });
        
        this.bubbles = [];
        
        // Many more bubbles for better atmosphere (3x)
        for (let i = 0; i < 1800; i++) {
            const bubble = new THREE.Mesh(bubbleGeo, bubbleMat.clone());
            bubble.scale.setScalar(0.2 + Math.random() * 1.0);
            bubble.position.set(
                (Math.random() - 0.5) * this.oceanScale * 1.8,
                -this.oceanDepth + Math.random() * this.oceanDepth * 0.95,
                (Math.random() - 0.5) * this.oceanScale * 1.8
            );
            bubble.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.03,
                0.05 + Math.random() * 0.1,
                (Math.random() - 0.5) * 0.03
            );
            this.scene.add(bubble);
            this.bubbles.push(bubble);
        }
    },
    
    /**
     * Setup player controls
     */
    setupControls() {
        window.addEventListener('keydown', e => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            
            // Toggle flashlight with F key
            if (key === 'f') {
                this.toggleFlashlight();
            }
            
            // Sprint with Shift key
            if (e.key === 'Shift' && this.sprint) {
                this.sprint.startSprint();
            }
        });
        
        window.addEventListener('keyup', e => {
            this.keys[e.key.toLowerCase()] = false;
            
            // Stop sprinting when Shift is released
            if (e.key === 'Shift' && this.sprint) {
                this.sprint.stopSprint();
            }
        });
        
        let mouseDown = false;
        
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                mouseDown = true;
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                mouseDown = false;
            }
        });
        
        document.addEventListener('mousemove', e => {
            if (mouseDown) {
                this.camera.rotation.order = 'YXZ';
                this.camera.rotation.y -= e.movementX * 0.005;
                this.camera.rotation.x -= e.movementY * 0.005;
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
            }
        });
    },
    
    /**
     * Toggle flashlight on/off
     */
    toggleFlashlight() {
        if (this.flashlight && this.flashlight.toggle) {
            this.flashlightOn = this.flashlight.toggle();
        }
    },
    
    /**
     * Handle window resize
     */
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },
    
    /**
     * Add a ripple drop
     */
    addDrop(x, y, radius, strength) {
        const sim = this.waterSim;
        if (!sim.dropMat) return;
        
        const quad = sim.quadScene.children[0];
        quad.material = sim.dropMat;
        sim.dropMat.uniforms.waterTexture.value = sim.current.texture;
        sim.dropMat.uniforms.center.value.set(x, y);
        sim.dropMat.uniforms.radius.value = radius;
        sim.dropMat.uniforms.strength.value = strength;
        
        this.renderer.setRenderTarget(sim.alt);
        this.renderer.render(sim.quadScene, sim.quadCamera);
        this.renderer.setRenderTarget(null);
        
        [sim.current, sim.alt] = [sim.alt, sim.current];
    },
    
    /**
     * Step water simulation
     */
    stepWaterSim() {
        const sim = this.waterSim;
        if (!sim.quadScene) return;
        
        const quad = sim.quadScene.children[0];
        
        // Random ripples
        sim.frame++;
        if (sim.frame % 120 === 0) {
            this.addDrop(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                0.05,
                (Math.random() - 0.5) * 0.04
            );
        }
        
        // Update heights
        quad.material = sim.updateMat;
        sim.updateMat.uniforms.waterTexture.value = sim.current.texture;
        this.renderer.setRenderTarget(sim.alt);
        this.renderer.render(sim.quadScene, sim.quadCamera);
        [sim.current, sim.alt] = [sim.alt, sim.current];
        
        // Compute normals
        quad.material = sim.normalMat;
        sim.normalMat.uniforms.waterTexture.value = sim.current.texture;
        this.renderer.setRenderTarget(sim.alt);
        this.renderer.render(sim.quadScene, sim.quadCamera);
        [sim.current, sim.alt] = [sim.alt, sim.current];
        
        this.renderer.setRenderTarget(null);
        
        // Update water material
        if (this.waterMaterial) {
            this.waterMaterial.uniforms.water.value = sim.current.texture;
        }
    },
    
    /**
     * Update caustics
     */
    updateCaustics() {
        const { scene, camera, rt, material } = this.caustics;
        if (!scene || !material || !rt) return;
        
        material.uniforms.water.value = this.waterSim.current.texture;
        
        this.renderer.setRenderTarget(rt);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear();
        this.renderer.render(scene, camera);
        this.renderer.setRenderTarget(null);
    },
    
    /**
     * Update game state
     */
    update(deltaTime) {
        // Update sprint and get current speed
        let currentSpeed = this.moveSpeed;
        if (this.sprint) {
            currentSpeed = this.sprint.update(deltaTime);
        }
        
        // Calculate intended movement
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
        
        const movement = new THREE.Vector3();
        
        if (this.keys['w']) movement.addScaledVector(forward, currentSpeed);
        if (this.keys['s']) movement.addScaledVector(forward, -currentSpeed);
        if (this.keys['a']) movement.addScaledVector(right, -currentSpeed);
        if (this.keys['d']) movement.addScaledVector(right, currentSpeed);
        
        // Apply movement with collision detection
        if (movement.length() > 0 && this.player && this.obstacles.length > 0) {
            this.player.tryMove(movement, this.obstacles);
        } else if (movement.length() > 0) {
            // Fallback if no collision system
            this.camera.position.add(movement);
        }
        
        // Bounds (hard limits)
        const limit = this.oceanScale * 0.9;
        this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -limit, limit);
        this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -limit, limit);
        this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, -this.oceanDepth + 5, this.waterLevel + 3);
        
        // Atmosphere based on depth
        const isUnderwater = this.camera.position.y < this.waterLevel;
        
        if (isUnderwater) {
            const depth = Math.abs(this.camera.position.y);
            const depthRatio = depth / this.oceanDepth;
            
            // Depth zones for fog:
            // 0-100m: Light fog (good visibility ~50-60m)
            // 100-350m: Medium fog (visibility ~30-40m)
            // 350-400m (bottom 50m): Dense fog (visibility ~15-20m)
            const bottomZoneStart = this.oceanDepth - 50;
            let fogDensity;
            let ambientIntensity;
            
            if (depth < 100) {
                // Shallow zone - visible fog
                fogDensity = 0.015 + (depth / 100) * 0.015;
                ambientIntensity = 0.4 - (depth / 100) * 0.15;
            } else if (depth < bottomZoneStart) {
                // Mid zone - thicker fog
                const midRatio = (depth - 100) / (bottomZoneStart - 100);
                fogDensity = 0.03 + midRatio * 0.02;
                ambientIntensity = 0.25 - midRatio * 0.1;
            } else {
                // Bottom 50m - very foggy
                const bottomRatio = (depth - bottomZoneStart) / 50;
                fogDensity = 0.05 + bottomRatio * 0.03;
                ambientIntensity = 0.15 - bottomRatio * 0.1;
            }
            
            this.scene.fog.density = fogDensity;
            this.ambientLight.intensity = Math.max(0.05, ambientIntensity);
            
            // Background color gets darker with depth
            const bgColor = this.shallowColor.clone().lerp(this.deepColor, depthRatio);
            bgColor.lerp(new THREE.Color(0x000205), Math.max(0, (depth - bottomZoneStart) / 50) * 0.5);
            this.scene.background = bgColor;
            
            // Update water material
            if (this.waterMaterial) {
                this.waterMaterial.uniforms.underwater.value = 1.0;
                this.waterMaterial.uniforms.fogDensity.value = fogDensity;
            }
            
            // Update floor material fog
            if (this.floorMaterial) {
                this.floorMaterial.uniforms.fogDensity.value = fogDensity;
            }
            
            // Update flashlight for depth
            if (this.flashlight && this.flashlight.updateForDepth) {
                this.flashlight.update();  // Update light positions each frame
                this.flashlight.updateForDepth(depth, this.oceanDepth);
            }

            // Feed flashlight uniforms to water for volumetric scattering
            if (this.waterMaterial && this.flashlight) {
                // Camera forward for direction
                const fwd = new THREE.Vector3();
                this.camera.getWorldDirection(fwd);
                this.waterMaterial.uniforms.flashlightPos.value.copy(this.camera.position);
                this.waterMaterial.uniforms.flashlightDir.value.copy(fwd);
                // Map intensity to a small normalized factor for shader use
                const intensityNorm = Math.min(1.0, (this.flashlight.spotlight.intensity || 0) / 2000.0);
                this.waterMaterial.uniforms.flashlightIntensity.value = intensityNorm;
            }
        } else {
            this.scene.fog.density = 0.002;
            this.scene.background = null;
            this.ambientLight.intensity = 0.5;
            
            if (this.waterMaterial) {
                this.waterMaterial.uniforms.underwater.value = 0.0;
            }
            
            if (this.floorMaterial) {
                this.floorMaterial.uniforms.fogDensity.value = 0.008;
            }
            
            // Update flashlight above water too
            if (this.flashlight && this.flashlight.update) {
                this.flashlight.update();
            }
        }
        
        // Update water simulation
        this.stepWaterSim();
        this.updateCaustics();
        
        // Update time uniform
        if (this.waterMaterial) {
            this.waterMaterial.uniforms.time.value += deltaTime;
        }
        
        // Update bubbles
        if (this.bubbles) {
            for (const bubble of this.bubbles) {
                bubble.position.add(bubble.userData.velocity);
                
                if (bubble.position.y > this.waterLevel - 2) {
                    bubble.position.y = -this.oceanDepth + 5;
                    bubble.position.x = (Math.random() - 0.5) * this.oceanScale;
                    bubble.position.z = (Math.random() - 0.5) * this.oceanScale;
                }
            }
        }

        // Update obstacle behavior (e.g., anglerfish meander/animation)
        for (const obstacle of this.obstacles) {
            if (typeof obstacle.update === 'function') {
                obstacle.update(deltaTime);
            }
        }

        // Enforce vertical limit for obstacles: don't let them move more than 3m above water surface
        for (const obstacle of this.obstacles) {
            try {
                const root = obstacle.group || obstacle.mesh || obstacle;
                if (root && root.position) {
                    root.position.y = Math.min(root.position.y, this.waterLevel + 3);
                    root.position.y = Math.max(root.position.y, -this.oceanDepth + 1);
                }
                // If obstacle is a simple collider object with center, clamp center.y too
                if (obstacle.center && typeof obstacle.center.y === 'number') {
                    obstacle.center.y = Math.min(obstacle.center.y, this.waterLevel + 3);
                    obstacle.center.y = Math.max(obstacle.center.y, -this.oceanDepth + 1);
                }
            } catch (e) {
                // ignore
            }
        }
        
        // Update depth display
        const depthEl = document.getElementById('depthValue');
        if (depthEl) {
            const depthVal = Math.max(0, Math.round(this.waterLevel - this.camera.position.y));
            depthEl.textContent = depthVal;
        }

        // Smooth distance-based fade so objects blend into fog
        const camPos = this.camera.position;
        // Start graying/fading farther so colors are visible within ~20m
        const fadeStart = 80;  // begin fade beyond ~80m
        const fadeEnd = 320;   // fully invisible by ~320m
        for (const obstacle of this.obstacles) {
            const root = obstacle.group || obstacle.mesh;
            if (!root) continue;
            const worldPos = new THREE.Vector3();
            root.getWorldPosition(worldPos);
            const d = worldPos.distanceTo(camPos);
            if (typeof obstacle.applyDistanceFade === 'function') {
                obstacle.applyDistanceFade(d, fadeStart, fadeEnd, 80);
                continue;
            }
            let opacity = 1.0;
            if (d > fadeStart) {
                const t = (d - fadeStart) / (fadeEnd - fadeStart);
                opacity = Math.max(0.0, 1.0 - THREE.MathUtils.clamp(t, 0, 1));
            }
            // Apply opacity to all meshes under this obstacle without changing color
            root.traverse((child) => {
                if (child.isMesh && child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    for (const mat of mats) {
                        mat.transparent = true;
                        mat.opacity = opacity;
                        mat.fog = true; // ensure fog applies but doesn’t recolor base
                        mat.depthWrite = opacity >= 1.0; // avoid sorting artifacts when fading
                    }
                }
            });
            root.visible = opacity > 0.01;
        }
    },
    
    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }
};

// Start
window.addEventListener('DOMContentLoaded', async () => {
    await Ocean.init();
    Ocean.animate();
});
