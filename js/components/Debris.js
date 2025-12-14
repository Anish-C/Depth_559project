import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Debris component - creates barrels, crates, and other ocean debris with collision
 */
export class Debris {
    constructor(scene, x, y, z, options = {}) {
        this.scene = scene;
        this.colliders = [];
        
        const type = options.type || 'crate';  // 'crate', 'barrel'
        const scale = options.scale || 1;
        
        this.mesh = null;
        
        switch (type) {
            case 'barrel':
                this.createBarrel(x, y, z, scale);
                break;
            default:
                this.createCrate(x, y, z, scale);
        }
    }
    
    createBarrel(x, y, z, scale) {
        const metalDebrisMat = new THREE.MeshStandardMaterial({
            color: 0x8C6E3C,
            roughness: 0.85,
            metalness: 0.2,
            fog: true
        });
        
        const radius = 1.5 * scale;
        const height = 4 * scale;
        
        this.mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, height, 12),
            metalDebrisMat
        );
        this.mesh.position.set(x, y, z);
        this.mesh.rotation.x = Math.random() * Math.PI;
        this.mesh.rotation.z = Math.random() * Math.PI;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // Sphere collider (simpler for tumbled barrels)
        this.colliders.push({
            type: 'sphere',
            center: new THREE.Vector3(x, y, z),
            radius: Math.max(radius, height / 2)
        });
    }
    
    createCrate(x, y, z, scale) {
        const debrisMat = new THREE.MeshStandardMaterial({
            color: 0x8C6E3C,
            roughness: 0.9,
            metalness: 0.1,
            fog: true
        });
        
        const size = (2 + Math.random() * 3) * scale;
        
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size, size, size),
            debrisMat
        );
        this.mesh.position.set(x, y, z);
        this.mesh.rotation.y = Math.random() * Math.PI;
        this.mesh.rotation.z = (Math.random() - 0.5) * 0.3;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // Box collider
        this.colliders.push({
            type: 'box',
            center: new THREE.Vector3(x, y, z),
            halfExtents: new THREE.Vector3(size / 2, size / 2, size / 2),
            rotation: 0
        });
    }
    
    getColliders() {
        return this.colliders;
    }
    
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
    }
}
