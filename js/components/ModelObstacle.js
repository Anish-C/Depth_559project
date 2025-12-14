import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';

/**
 * ModelObstacle - load a GLTF/GLB model as a collidable obstacle
 * Automatically computes a bounding-box collider for the loaded scene.
 */
export class ModelObstacle {
    constructor(scene, modelPath, options = {}) {
        this.scene = scene;
        this.modelPath = modelPath;
        this.options = options;
        this.group = new THREE.Group();
        this.colliders = [];
        this.loaded = false;
        this.preserveMaterials = options.preserveMaterials !== false; // default true
        
        // Defaults
        const pos = options.position || { x: 0, y: 0, z: 0 };
        const rotY = options.rotationY ?? 0;
        const scale = options.scale ?? 1;
        
        this.group.position.set(pos.x, pos.y, pos.z);
        this.group.rotation.y = rotY;
        this.group.scale.setScalar(scale);
        
        this.scene.add(this.group);
        
        this.promise = this.loadModel();
    }
    
    async loadModel() {
        const loader = new GLTFLoader();
        return new Promise((resolve) => {
            loader.load(this.modelPath, (gltf) => {
                const object = gltf.scene || gltf.scenes[0];
                if (!object) {
                    console.error('GLTF has no scene:', this.modelPath);
                    resolve(false);
                    return;
                }
                
                // Preserve original materials; set color spaces for textures; enable shadows
                object.traverse((child) => {
                    if (child.isMesh) {
                        const mat = child.material;
                        if (mat) {
                            // Preserve fog only if not preserving materials
                            if (!this.preserveMaterials) {
                                mat.fog = true;
                            }
                            // Ensure sRGB for color maps to avoid grey/desaturation
                            if (mat.map && mat.map.colorSpace !== THREE.SRGBColorSpace) {
                                mat.map.colorSpace = THREE.SRGBColorSpace;
                                mat.map.needsUpdate = true;
                            }
                            if (mat.emissiveMap && mat.emissiveMap.colorSpace !== THREE.SRGBColorSpace) {
                                mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                                mat.emissiveMap.needsUpdate = true;
                            }
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Attach to group for transform
                this.group.add(object);
                
                // Compute world-space bounding box for collider
                const box = new THREE.Box3().setFromObject(object);
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                box.getCenter(center);
                box.getSize(size);
                
                // Create a single box collider approximating the model
                this.colliders.push({
                    type: 'box',
                    center: center.clone().add(this.group.position),
                    halfExtents: new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2),
                    rotation: this.group.rotation.y
                });
                
                this.loaded = true;
                resolve(true);
            }, undefined, (err) => {
                console.error('Failed to load GLTF:', this.modelPath, err);
                resolve(false);
            });
        });
    }
    
    /**
     * Await model load completion
     */
    async whenReady() {
        if (this.loaded) return true;
        return await this.promise;
    }
    
    getColliders() {
        return this.colliders;
    }
    
    dispose() {
        this.group.traverse((child) => {
            if (child.isMesh) {
                child.geometry?.dispose?.();
                if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose());
                } else {
                    child.material?.dispose?.();
                }
            }
        });
        this.scene.remove(this.group);
    }
}
