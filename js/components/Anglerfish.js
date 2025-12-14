import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';

/**
 * Anglerfish obstacle - meanders randomly with a front light
 */
export class Anglerfish {
    constructor(scene, modelPath, options = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.colliders = [];
        this.loaded = false;
        // Slow, aimless meander speed
        this.speed = options.speed || 0.12;
        // Allow wide roaming; not constrained to a small area
        this.wanderRadius = options.wanderRadius || 200;
        // Many GLTF fishes face -Z by default; apply a forward correction so they swim toward target
        this.forwardYawCorrection = options.forwardYawCorrection ?? Math.PI; // rotate 180° by default
        this.origin = new THREE.Vector3(options.x || 0, options.y || -20, options.z || 0);
        this.group.position.copy(this.origin);
        this.scene.add(this.group);

        // Front light simulating the anglerfish lure
        // Quadruple lure light intensity and extend reach
        this.light = new THREE.SpotLight(0xffeeaa, 18.0, 0, Math.PI / 5, 0.35, 2.0);
        // Physically correct attenuation
        this.light.decay = 2.0;
        this.light.castShadow = true;
        this.light.shadow.mapSize.width = 1024;
        this.light.shadow.mapSize.height = 1024;
        this.light.shadow.bias = -0.0005;
        // Place the lure light slightly forward of the fish's head
        this.light.position.set(0.0, 0.25, 0.9);
        this.light.target.position.set(0, 0.12, 4.0);
        this.group.add(this.light);
        this.group.add(this.light.target);

        // Soft glow in the spawn area to increase local brightness
        this.glow = new THREE.PointLight(0xffdd99, 2.4, 0);
        this.glow.decay = 2.0;
        this.glow.position.set(0.0, 0.2, 0.8);
        this.group.add(this.glow);

        // Debug sphere to visualize lure/light position
        const debugGeo = new THREE.SphereGeometry(0.08, 16, 12);
        const debugMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa });
        this.debugSphere = new THREE.Mesh(debugGeo, debugMat);
        this.debugSphere.position.copy(this.glow.position);
        this.group.add(this.debugSphere);

        // Animation mixer
        this.mixer = null;
        this.idleAction = null;
        
        // Load model
        const loader = new GLTFLoader();
        loader.load(modelPath, (gltf) => {
            const object = gltf.scene || gltf.scenes[0];
            if (!object) return;
            object.traverse((child) => {
                if (child.isMesh) {
                    const mat = child.material;
                    if (mat && mat.map) {
                        mat.map.colorSpace = THREE.SRGBColorSpace;
                        mat.map.needsUpdate = true;
                    }
                    // Ensure vibrant colors under physically correct lighting
                    if (mat && mat.isMeshStandardMaterial) {
                        mat.roughness = Math.min(0.9, mat.roughness ?? 0.8);
                        mat.metalness = Math.max(0.0, mat.metalness ?? 0.1);
                        mat.fog = true;
                    }
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            // Make fish much smaller
            object.scale.setScalar(options.scale || 0.12);
            this.group.add(object);

            // Setup animation (play first clip if present)
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(object);
                this.idleAction = this.mixer.clipAction(gltf.animations[0]);
                this.idleAction.play();
            }
            this.loaded = true;
        });

        // Random meander target
        this.target = this.origin.clone();
    }

    /**
     * Apply distance-based fading. Keep lure light visible slightly farther than the fish body.
     */
    applyDistanceFade(distance, fadeStart, fadeEnd, lightExtraRange = 120) {
        let opacity = 1.0;
        if (distance > fadeStart) {
            const t = (distance - fadeStart) / (fadeEnd - fadeStart);
            opacity = Math.max(0.0, 1.0 - THREE.MathUtils.clamp(t, 0, 1));
        }
        // Fade meshes
        this.group.traverse((child) => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                for (const mat of mats) {
                    mat.transparent = true;
                    mat.opacity = opacity;
                    mat.fog = true;
                    mat.depthWrite = opacity >= 1.0;
                }
            }
        });
        // Keep lights strong and visible much farther than body fade
        const lightFadeEnd = fadeEnd + lightExtraRange;
        const lightVisible = distance < lightFadeEnd;
        // Maintain strong intensity regardless of mesh opacity to ensure noticeable illumination
        this.light.visible = lightVisible;
        this.glow.visible = lightVisible;
        // Don't hide group entirely; visibility follows mesh opacity, but lights can remain visible
        this.group.visible = opacity > 0.01 || lightVisible;
    }

    update(delta) {
        // Play animation if available
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Slow, aimless meander: random walk with slight vertical bob
        const time = performance.now() * 0.001;
        if (Math.random() < 0.015) {
            const angle = Math.random() * Math.PI * 2;
            const r = this.wanderRadius * (0.5 + Math.random() * 0.8);
            const dx = Math.cos(angle) * r;
            const dz = Math.sin(angle) * r;
            const dy = (Math.random() - 0.5) * 4;
            this.target.set(this.origin.x + dx, this.origin.y + dy, this.origin.z + dz);
        }
        const dir = new THREE.Vector3().subVectors(this.target, this.group.position);
        const dist = dir.length();
        if (dist > 0.05) {
            dir.normalize();
            // Slow drift toward target
            this.group.position.addScaledVector(dir, this.speed * delta * 30);
            // Gentle vertical bobbing
            this.group.position.y += Math.sin(time * 0.6) * 0.02;
            // Orient toward movement direction with gentler turning (3-4x less)
            const lookAt = new THREE.Vector3().addVectors(this.group.position, dir);
            const baseQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.group.position, lookAt, new THREE.Vector3(0,1,0)));
            // Apply yaw correction so model's forward faces movement direction
            const yawCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), this.forwardYawCorrection);
            const targetQuat = baseQuat.multiply(yawCorrection);
            this.group.quaternion.slerp(targetQuat, 0.25);
        }

        // Keep debug sphere aligned with lure/glow
        if (this.debugSphere) {
            this.debugSphere.position.copy(this.glow.position);
        }
    }

    getColliders() {
        // Lightly collidable sphere around fish
        return [{ type: 'sphere', center: this.group.position.clone(), radius: 2 }];
    }
}