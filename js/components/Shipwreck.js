import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Shipwreck component - creates a sunken ship with collision
 */
export class Shipwreck {
    constructor(scene, x, y, z, rotation = 0, scale = 1, options = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.colliders = [];  // Array of collision boxes
        this.scale = scale;
        this.options = options;
        
        this.createShip(scale);
        
        // Position and rotate the whole ship
        this.group.position.set(x, y, z);
        this.group.rotation.y = rotation + Math.PI / 6;
        if (options.surface) {
            // Keep level at the surface
            this.group.rotation.z = 0.0;
            this.group.rotation.x = 0.0;
        } else {
            this.group.rotation.z = 0.1 + Math.random() * 0.1;
            this.group.rotation.x = (Math.random() - 0.5) * 0.1;
        }
        
        // Setup shadows
        this.group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        this.scene.add(this.group);
        
        // Create collision boxes after positioning
        this.setupColliders(x, y, z, rotation, scale);
    }
    
    createShip(scale) {
        // Materials
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0x8C6E3C,
            roughness: 0.9,
            metalness: 0.15,
            fog: true
        });
        
        const deckMat = new THREE.MeshStandardMaterial({
            color: 0x7A5F34,
            roughness: 0.92,
            metalness: 0.1,
            fog: true
        });
        
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x6B5430,
            roughness: 0.85,
            metalness: 0.25,
            fog: true
        });
        
        // Hull dimensions
        const hullLength = 70 * scale;
        const hullWidth = 20 * scale;
        const hullHeight = 15 * scale;
        
        // Hull
        const hull = new THREE.Mesh(
            new THREE.BoxGeometry(hullLength, hullHeight, hullWidth),
            hullMat
        );
        hull.position.y = hullHeight / 2;
        this.group.add(hull);
        
        // Deck
        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(hullLength - 5, 2 * scale, hullWidth - 3),
            deckMat
        );
        deck.position.y = hullHeight + scale;
        this.group.add(deck);
        
        // Bow
        const bow = new THREE.Mesh(
            new THREE.ConeGeometry(hullWidth / 2, 18 * scale, 4),
            hullMat
        );
        bow.rotation.z = -Math.PI / 2;
        bow.rotation.y = Math.PI / 4;
        bow.position.set(hullLength / 2 + 7 * scale, hullHeight / 2, 0);
        this.group.add(bow);
        
        // Cabin
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(18 * scale, 12 * scale, 14 * scale),
            deckMat
        );
        cabin.position.set(-hullLength / 4, hullHeight + 7 * scale, 0);
        this.group.add(cabin);
        
        // Broken masts
        const mast1 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.8 * scale, 1.5 * scale, 30 * scale, 8),
            hullMat
        );
        mast1.position.set(5 * scale, hullHeight + 15 * scale, 0);
        mast1.rotation.z = 0.4;
        mast1.rotation.x = 0.2;
        this.group.add(mast1);
        
        const mast2 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.6 * scale, 1.2 * scale, 20 * scale, 8),
            hullMat
        );
        mast2.position.set(-hullLength / 3, hullHeight + 10 * scale, 0);
        mast2.rotation.z = -0.5;
        this.group.add(mast2);
        
        // Railings
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(hullLength - 15, 3 * scale, 0.5 * scale),
            metalMat
        );
        rail.position.set(0, hullHeight + 2 * scale, hullWidth / 2 - scale);
        this.group.add(rail.clone());
        rail.position.z = -hullWidth / 2 + scale;
        this.group.add(rail);
        
        // Cargo and debris
        for (let i = 0; i < 8; i++) {
            const size = (2 + Math.random() * 3) * scale;
            const cargo = new THREE.Mesh(
                new THREE.BoxGeometry(size, size, size),
                deckMat
            );
            cargo.position.set(
                (Math.random() - 0.5) * hullLength * 0.7,
                hullHeight + size / 2 + scale,
                (Math.random() - 0.5) * hullWidth * 0.5
            );
            cargo.rotation.set(
                (Math.random() - 0.5) * 0.4,
                Math.random() * Math.PI,
                (Math.random() - 0.5) * 0.4
            );
            this.group.add(cargo);
        }
        
        // Anchor
        const anchor = new THREE.Mesh(
            new THREE.TorusGeometry(3 * scale, 0.5 * scale, 8, 16),
            metalMat
        );
        anchor.position.set(hullLength / 2 - 8 * scale, hullHeight - 3 * scale, hullWidth / 2 + scale);
        anchor.rotation.y = Math.PI / 2;
        this.group.add(anchor);
    }
    
    setupColliders(x, y, z, rotation, scale) {
        const hullLength = 70 * scale;
        const hullWidth = 20 * scale;
        const hullHeight = 15 * scale;
        
        // Main hull collision box (simplified)
        const cos = Math.cos(rotation + Math.PI / 6);
        const sin = Math.sin(rotation + Math.PI / 6);
        
        this.colliders.push({
            type: 'box',
            center: new THREE.Vector3(x, y + hullHeight / 2, z),
            halfExtents: new THREE.Vector3(hullLength / 2 + 10 * scale, hullHeight, hullWidth / 2),
            rotation: rotation + Math.PI / 6
        });
        
        // Cabin collision box
        const cabinOffsetX = -hullLength / 4;
        const cabinWorldX = x + cabinOffsetX * cos;
        const cabinWorldZ = z + cabinOffsetX * sin;
        
        this.colliders.push({
            type: 'box',
            center: new THREE.Vector3(cabinWorldX, y + hullHeight + 6 * scale, cabinWorldZ),
            halfExtents: new THREE.Vector3(9 * scale, 6 * scale, 7 * scale),
            rotation: rotation + Math.PI / 6
        });
    }
    
    /**
     * Get all collision boxes for this shipwreck
     */
    getColliders() {
        return this.colliders;
    }
    
    dispose() {
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
        this.scene.remove(this.group);
    }
}
